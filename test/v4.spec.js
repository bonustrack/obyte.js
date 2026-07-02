/**
 * v4 compose + API mapping tests, fully offline: the WSClient module is mocked so
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

const V4_PROPS = {
  timestamp: 1700000000,
  parent_units: ['pBAbllHPZKWxs4VQikR2dsxmJBJlbnnqDzPJ3Qiiun8='],
  last_stable_mc_ball: 'mYSB+hzqVWT5163HfbNu4vV7IIzT2+5nKxEX2x8U65o=',
  last_stable_mc_ball_unit: 'SaLC9xO2c+6d2sQGH0Iij8MkftUFOIS68kU6ltIkhkU=',
  last_stable_mc_ball_mci: 12000000,
  tps_fee: 12,
  count_primary_aa_triggers: 0,
};

function makeClient({ lightProps = V4_PROPS, totalAmount = 1000000 } = {}) {
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

describe('v4 compose', () => {
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
    expect(unit.timestamp).toEqual(V4_PROPS.timestamp);
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
    const noFee = makeClient({ lightProps: { ...V4_PROPS, tps_fee: 0 } });
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
      lightProps: { ...V4_PROPS, count_primary_aa_triggers: 1 },
    });
    const unit = await client.compose.payment(
      { outputs: [{ address: RECIPIENT, amount: 1000 }] },
      { privateKey, max_aa_responses: 5 },
    );

    expect(parentsRequest(client).params.max_aa_responses).toEqual(5);
    expect(unit.max_aa_responses).toEqual(5);
    expect(getUnitHash(unit)).toEqual(unit.unit);
  });

  it('composes a 3.0 unit with witness_list_unit from a pre-v4 quote', async () => {
    const client = makeClient({
      lightProps: {
        timestamp: 1650000000,
        parent_units: V4_PROPS.parent_units,
        last_stable_mc_ball: V4_PROPS.last_stable_mc_ball,
        last_stable_mc_ball_unit: V4_PROPS.last_stable_mc_ball_unit,
        last_stable_mc_ball_mci: 6000000,
        witness_list_unit: 'J8QFgTLI+3EkuAxX+eL6a0q114PJ4h4EOAiHAzxUp24=',
      },
    });
    const unit = await client.compose.payment(
      { outputs: [{ address: RECIPIENT, amount: 1000 }] },
      { privateKey },
    );

    expect(unit.version).toEqual('3.0');
    expect(unit.witness_list_unit).toEqual('J8QFgTLI+3EkuAxX+eL6a0q114PJ4h4EOAiHAzxUp24=');
    expect('tps_fee' in unit).toEqual(false);
    expect(1000000).toEqual(
      outputsTotal(unit) + unit.headers_commission + unit.payload_commission,
    );
    expect(getUnitHash(unit)).toEqual(unit.unit);
  });

  it('composes a 4.0t unit on testnet past its v4 upgrade mci', async () => {
    const client = makeClient({
      lightProps: { ...V4_PROPS, last_stable_mc_ball_mci: 4000000 },
    });
    const unit = await client.compose.payment(
      { outputs: [{ address: RECIPIENT, amount: 1000 }] },
      { privateKey, testnet: true },
    );

    expect(unit.version).toEqual('4.0t');
    expect(unit.alt).toEqual('2');
    expect(unit.tps_fee).toEqual(12);
  });

  it('composes a 3.0t unit on testnet before its v4 upgrade mci', async () => {
    const client = makeClient({
      lightProps: {
        ...V4_PROPS,
        last_stable_mc_ball_mci: 3000000,
        tps_fee: undefined,
        witness_list_unit: 'J8QFgTLI+3EkuAxX+eL6a0q114PJ4h4EOAiHAzxUp24=',
      },
    });
    const unit = await client.compose.payment(
      { outputs: [{ address: RECIPIENT, amount: 1000 }] },
      { privateKey, testnet: true },
    );

    expect(unit.version).toEqual('3.0t');
    expect('tps_fee' in unit).toEqual(false);
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
