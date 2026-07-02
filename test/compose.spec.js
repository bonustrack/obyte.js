/**
 * Compose + API mapping tests, fully offline: the WSClient module is mocked so
 * every hub command is routed to a canned per-command handler and recorded, letting
 * tests assert both the composed unit and the exact wire requests.
 * @jest-environment node
 */

jest.mock('../src/wsclient', () =>
  jest.fn().mockImplementation(function FakeWSClient(address) {
    this.address = address;
    this.open = true;
    this.requests = [];
    this.handlers = {};
    this.onConnect = jest.fn();
    this.onError = jest.fn();
    this.subscribe = jest.fn();
    this.justsaying = jest.fn();
    this.close = jest.fn();
    this.request = (command, params, cb) => {
      this.requests.push({ command, params });
      const handler = this.handlers[command];
      try {
        cb(null, handler ? handler(params) : { mock: true });
      } catch (e) {
        cb(String(e), null);
      }
    };
  }),
);

const Client = require('../src/client');
const utils = require('../src/utils');
const api = require('../src/api.json');
const apps = require('../src/apps.json');
const {
  camelCase,
  toPublicKey,
  getUnitHash,
  getUnitHashToSign,
  verify,
} = require('../src/internal');

const privateKey = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const pubkey = toPublicKey(privateKey);
const address = utils.getChash160(['sig', { pubkey }]);
const RECIPIENT = '2TO6NYBGX3NF5QS24MQLFR7KXYAMCIE5';
const FAKE_INPUT_UNIT = 'oj8yEksX9Ubq7lLc+p6F2uyHUuynugeVq4+ikT67X6E=';
const WITNESSES = Array.from({ length: 12 }, (_, i) => `WITNESS${i}`);

const HUB_QUOTE = {
  timestamp: 1700000000,
  parent_units: ['pBAbllHPZKWxs4VQikR2dsxmJBJlbnnqDzPJ3Qiiun8='],
  last_stable_mc_ball: 'mYSB+hzqVWT5163HfbNu4vV7IIzT2+5nKxEX2x8U65o=',
  last_stable_mc_ball_unit: 'SaLC9xO2c+6d2sQGH0Iij8MkftUFOIS68kU6ltIkhkU=',
  last_stable_mc_ball_mci: 12000000,
  tps_fee: 12,
  count_primary_aa_triggers: 0,
};

function makeClient({ lightProps = HUB_QUOTE, totalAmount = 1000000 } = {}) {
  const client = new Client('wss://fake');
  client.client.handlers = {
    get_witnesses: () => WITNESSES,
    'light/get_parents_and_last_ball_and_witness_list_unit': () => ({ ...lightProps }),
    'light/get_definition_for_address': (params) => ({
      definition_chash: params.address,
      is_stable: true,
    }),
    'light/pick_divisible_coins_for_amount': () => ({
      inputs_with_proofs: [
        { input: { unit: FAKE_INPUT_UNIT, message_index: 0, output_index: 0 } },
      ],
      total_amount: totalAmount,
    }),
  };
  return client;
}

const outputsTotal = (unit) =>
  unit.messages
    .find((m) => m.app === 'payment')
    .payload.outputs.reduce((acc, o) => acc + o.amount, 0);

const parentsRequest = (client) =>
  client.client.requests.find(
    (r) => r.command === 'light/get_parents_and_last_ball_and_witness_list_unit',
  );

const pickRequest = (client) =>
  client.client.requests.find((r) => r.command === 'light/pick_divisible_coins_for_amount');

describe('compose', () => {
  it('composes a version 4.0 unit from a v4 hub quote', async () => {
    const client = makeClient();
    const unit = await client.compose.payment(
      { outputs: [{ address: RECIPIENT, amount: 1000 }] },
      { privateKey },
    );

    expect(unit.version).toEqual('4.0');
    expect(unit.alt).toEqual('1');
    expect(unit.tps_fee).toEqual(12);
    // the hub computed tps_fee for its own timestamp, so compose must reuse it
    expect(unit.timestamp).toEqual(HUB_QUOTE.timestamp);
    expect('witnesses' in unit).toEqual(false);
    expect('witness_list_unit' in unit).toEqual(false);
    expect('max_aa_responses' in unit).toEqual(false);

    // balance equation of ocore validation.js: inputs = outputs + fees
    expect(1000000).toEqual(
      outputsTotal(unit) + unit.headers_commission + unit.payload_commission + unit.tps_fee,
    );

    // the whole signing pipeline must be self-consistent
    expect(getUnitHash(unit)).toEqual(unit.unit);
    expect(verify(getUnitHashToSign(unit), unit.authors[0].authentifiers.r, pubkey)).toEqual(
      true,
    );
  });

  it('requests the quote with from/output addresses and default max_aa_responses', async () => {
    const client = makeClient();
    await client.compose.payment(
      { outputs: [{ address: RECIPIENT, amount: 1000 }] },
      { privateKey },
    );

    const { params } = parentsRequest(client);
    expect(params.witnesses).toEqual(WITNESSES);
    expect(params.from_addresses).toEqual([address]);
    expect(params.output_addresses.sort()).toEqual([RECIPIENT, address].sort());
    expect(params.max_aa_responses).toEqual(10);
  });

  it('covers tps_fee when picking coins', async () => {
    const withFee = makeClient();
    await withFee.compose.payment(
      { outputs: [{ address: RECIPIENT, amount: 1000 }] },
      { privateKey },
    );
    const noFee = makeClient({ lightProps: { ...HUB_QUOTE, tps_fee: 0 } });
    await noFee.compose.payment(
      { outputs: [{ address: RECIPIENT, amount: 1000 }] },
      { privateKey },
    );

    const amountWithFee = pickRequest(withFee).params.amount;
    const amountNoFee = pickRequest(noFee).params.amount;
    expect(amountWithFee - amountNoFee).toEqual(12);
  });

  it('writes max_aa_responses into the unit when set explicitly and AAs are triggered', async () => {
    const client = makeClient({
      lightProps: { ...HUB_QUOTE, count_primary_aa_triggers: 1 },
    });
    const unit = await client.compose.payment(
      { outputs: [{ address: RECIPIENT, amount: 1000 }] },
      { privateKey, max_aa_responses: 5 },
    );

    expect(parentsRequest(client).params.max_aa_responses).toEqual(5);
    expect(unit.max_aa_responses).toEqual(5);
    expect(getUnitHash(unit)).toEqual(unit.unit);
  });

  it('refuses to compose against a pre-v4 chain', async () => {
    const client = makeClient({
      lightProps: {
        timestamp: 1650000000,
        parent_units: HUB_QUOTE.parent_units,
        last_stable_mc_ball: HUB_QUOTE.last_stable_mc_ball,
        last_stable_mc_ball_unit: HUB_QUOTE.last_stable_mc_ball_unit,
        last_stable_mc_ball_mci: 6000000,
        witness_list_unit: 'J8QFgTLI+3EkuAxX+eL6a0q114PJ4h4EOAiHAzxUp24=',
      },
    });
    await expect(
      client.compose.payment({ outputs: [{ address: RECIPIENT, amount: 1000 }] }, { privateKey }),
    ).rejects.toThrow('pre-v4 chain');
  });

  it('composes a 4.0t unit on testnet past its v4 upgrade mci', async () => {
    const client = makeClient({
      lightProps: { ...HUB_QUOTE, last_stable_mc_ball_mci: 4000000 },
    });
    const unit = await client.compose.payment(
      { outputs: [{ address: RECIPIENT, amount: 1000 }] },
      { privateKey, testnet: true },
    );

    expect(unit.version).toEqual('4.0t');
    expect(unit.alt).toEqual('2');
    expect(unit.tps_fee).toEqual(12);
  });

  it('refuses to compose on testnet before its v4 upgrade mci', async () => {
    const client = makeClient({
      lightProps: {
        ...HUB_QUOTE,
        last_stable_mc_ball_mci: 3000000,
        tps_fee: undefined,
        witness_list_unit: 'J8QFgTLI+3EkuAxX+eL6a0q114PJ4h4EOAiHAzxUp24=',
      },
    });
    await expect(
      client.compose.payment(
        { outputs: [{ address: RECIPIENT, amount: 1000 }] },
        { privateKey, testnet: true },
      ),
    ).rejects.toThrow('pre-v4 chain');
  });

  it('charges the fixed 1e9 fee for system_vote_count', async () => {
    const client = makeClient({ totalAmount: 3e9 });
    const unit = await client.compose.systemVoteCount('base_tps_fee', { privateKey });

    expect(unit.messages.some((m) => m.app === 'system_vote_count')).toEqual(true);
    expect(3e9).toEqual(
      outputsTotal(unit) +
        unit.headers_commission +
        unit.payload_commission +
        unit.tps_fee +
        1e9,
    );
    // input selection must also cover the fee
    expect(pickRequest(client).params.amount).toBeGreaterThan(1e9);
    expect(getUnitHash(unit)).toEqual(unit.unit);
  });

  it('composes a system_vote unit without extra fees', async () => {
    const client = makeClient();
    const unit = await client.compose.systemVote(
      { subject: 'base_tps_fee', value: 10 },
      { privateKey },
    );

    const voteMessage = unit.messages.find((m) => m.app === 'system_vote');
    expect(voteMessage.payload).toEqual({ subject: 'base_tps_fee', value: 10 });
    expect(1000000).toEqual(
      outputsTotal(unit) + unit.headers_commission + unit.payload_commission + unit.tps_fee,
    );
    expect(getUnitHash(unit)).toEqual(unit.unit);
  });
});

describe('token registry helpers (default registry)', () => {
  const OFFICIAL = 'O6H6ZIFI57X3PLTYHOCVYPP5A553CYFQ';
  const ASSET = 'n9y3VomFeWFeZZ2PcSEcmyBb/bI7CzKcYsFF2umf4X0=';
  const DESC = 'descHashdescHashdescHashdescHashdescHash12s=';

  function makeRegistryClient() {
    const client = new Client('wss://fake');
    const captured = [];
    client.client.handlers = {
      'light/get_aa_state_vars': (params) => {
        captured.push(params);
        if (params.var_prefix.startsWith('a2s_')) return { [`a2s_${ASSET}`]: 'TST' };
        if (params.var_prefix.startsWith('s2a_')) return { s2a_TST: ASSET };
        if (params.var_prefix.startsWith('current_desc_')) {
          return { [`current_desc_${ASSET}`]: DESC };
        }
        if (params.var_prefix.startsWith('decimals_')) return { [`decimals_${DESC}`]: 8 };
        return {};
      },
    };
    return { client, captured };
  }

  it('getSymbolByAsset with one argument uses the official registry', async () => {
    const { client, captured } = makeRegistryClient();
    expect(await client.api.getSymbolByAsset(ASSET)).toEqual('TST');
    expect(captured[0].address).toEqual(OFFICIAL);
  });

  it('getSymbolByAsset still accepts an explicit registry', async () => {
    const { client, captured } = makeRegistryClient();
    expect(await client.api.getSymbolByAsset(address, ASSET)).toEqual('TST');
    expect(captured[0].address).toEqual(address);
  });

  it('null registry with two arguments falls back to the official one', async () => {
    const { client, captured } = makeRegistryClient();
    expect(await client.api.getAssetBySymbol(null, 'TST')).toEqual(ASSET);
    expect(captured[0].address).toEqual(OFFICIAL);
  });

  it('base/GBYTE shortcuts work without any request', async () => {
    const { client, captured } = makeRegistryClient();
    expect(await client.api.getSymbolByAsset('base')).toEqual('GBYTE');
    expect(await client.api.getSymbolByAsset(null)).toEqual('GBYTE');
    expect(await client.api.getAssetBySymbol('GBYTE')).toEqual('base');
    expect(await client.api.getDecimalsBySymbolOrAsset('GBYTE')).toEqual(9);
    expect(captured.length).toEqual(0);
  });

  it('getDecimalsBySymbolOrAsset with one argument resolves through the official registry', async () => {
    const { client, captured } = makeRegistryClient();
    expect(await client.api.getDecimalsBySymbolOrAsset('TST')).toEqual(8);
    expect(captured.every((p) => p.address === OFFICIAL)).toEqual(true);
  });
});

describe('API mapping', () => {
  it('exposes every api.json command as a method sending that exact command', async () => {
    const client = new Client('wss://fake');
    const commands = Object.keys(api);
    for (let i = 0; i < commands.length; i += 1) {
      const method = camelCase(commands[i]);
      expect(typeof client.api[method]).toEqual('function');
      await client.api[method]({}); // eslint-disable-line no-await-in-loop
      const lastRequest = client.client.requests[client.client.requests.length - 1];
      expect(lastRequest.command).toEqual(commands[i]);
    }
  });

  it('exposes every app as compose/post methods', () => {
    const client = new Client('wss://fake');
    Object.keys(apps).forEach((app) => {
      const method = camelCase(app);
      expect(typeof client.compose[method]).toEqual('function');
      expect(typeof client.post[method]).toEqual('function');
    });
  });
});
