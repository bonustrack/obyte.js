import WSClient from './wsclient';
import utils from './utils';
import {
  DEFAULT_NODE,
  ALT,
  ALT_TESTNET,
  VERSION,
  VERSION_TESTNET,
  MAX_AA_RESPONSES,
  SYSTEM_VOTE_COUNT_FEE,
} from './constants';
import {
  createPaymentMessage,
  sortOutputs,
  mapAPI,
  sign,
  toPublicKey,
  getHeadersSize,
  getTotalPayloadSize,
  getBase64Hash,
  getUnitHashToSign,
  getUnitHash,
  getLength,
} from './internal';
import api from './api.json';
import apps from './apps.json';
import expandApi from './expandApi';

export default class Client {
  constructor(nodeAddress = DEFAULT_NODE, clientOptions = {}) {
    const self = this;

    this.options = typeof clientOptions === 'object' ? clientOptions : { testnet: clientOptions };
    this.client = new WSClient(
      nodeAddress,
      this.options.reconnect || false,
      this.options.closeIfError || false,
    );

    this.cachedWitnesses = null;

    const requestAsync = (name, params) =>
      new Promise((resolve, reject) => {
        this.client.request(name, params, (err, result) => {
          if (err) return reject(err);
          return resolve(result);
        });
      });

    this.api = {};

    this.compose = {
      async message(app, payload, options = {}) {
        const messages = app === 'multi' ? payload : [{ app, payload }];

        messages.sort(
          (a) => (a.app === 'payment' && !a.payload.asset ? -1 : 1), // we place byte payment message first
        );
        if (messages[0].app !== 'payment' || messages[0].payload.asset)
          // if no byte payment, we add one
          messages.unshift({ app: 'payment', payload: { outputs: [] } });

        let isDefinitionRequired = false;
        const conf =
          typeof options === 'object'
            ? { ...self.options, ...options }
            : { ...self.options, wif: options };
        const privKeyBuf = conf.privateKey || utils.fromWif(conf.wif, conf.testnet).privateKey;
        const pubkey = toPublicKey(privKeyBuf);
        const definition = conf.definition || ['sig', { pubkey }];
        const address = conf.address || utils.getChash160(definition);
        const path = conf.path || 'r';

        const witnesses = await self.getCachedWitnesses();
        // v4+ hubs reject the request without from_addresses ("bad from addresses"):
        // they need the author and output addresses to compute tps_fee
        const outputAddresses = [
          ...new Set(
            messages
              .filter((m) => m.app === 'payment')
              .reduce((a, m) => a.concat(m.payload.outputs || []), [])
              .map((o) => o.address)
              .filter(Boolean)
              .concat(address),
          ),
        ];
        const maxAaResponses =
          typeof conf.max_aa_responses === 'number' ? conf.max_aa_responses : MAX_AA_RESPONSES;
        const [lightProps, objDefinition] = await Promise.all([
          self.api.getParentsAndLastBallAndWitnessListUnit({
            witnesses,
            from_addresses: [address],
            output_addresses: outputAddresses,
            max_aa_responses: maxAaResponses,
          }),
          self.api.getDefinitionForAddress({ address }),
        ]);
        // a v4 hub always quotes tps_fee (we send from_addresses); its absence means
        // the chain is still pre-v4 or the hub runs outdated ocore — composing
        // pre-v4 units (versions 1.0-3.0) is not supported anymore
        if (typeof lightProps.tps_fee !== 'number') {
          throw new Error(
            'the hub did not quote tps_fee — it is on a pre-v4 chain or runs outdated software; composing pre-v4 units is not supported',
          );
        }
        const version = conf.testnet ? VERSION_TESTNET : VERSION;
        const bWithKeys = true; // all v4 units count object keys toward size
        // tps_fee is a required unit field and enters the input/output balance
        const tpsFee = lightProps.tps_fee;
        // a system_vote_count message costs a fixed fee that also enters the balance
        const voteCountFee = messages.some((m) => m.app === 'system_vote_count')
          ? SYSTEM_VOTE_COUNT_FEE
          : 0;
        const extraFees = tpsFee + voteCountFee;
        const bJsonBased = true;

        if (!objDefinition.definition && objDefinition.is_stable) {
          isDefinitionRequired = true;
        } else if (!objDefinition.is_stable)
          throw new Error(
            `Definition or definition change for address ${address} is not stable yet`,
          );

        if (objDefinition.definition_chash !== utils.getChash160(definition))
          throw new Error(
            `Definition chash of address doesn't match the definition chash provided`,
          );

        const payloadsLength = messages.reduce(
          (a, b) => a + 78 + getLength(b.app, bWithKeys) + getLength(b.payload, bWithKeys),
          0,
        ); // 78 for payload_location and payload_hash

        async function createUnitMessage(message) {
          if (message.app === 'payment') {
            const assetPayment = await createPaymentMessage(
              self,
              message.payload.asset,
              message.payload.outputs,
              address,
              payloadsLength,
              lightProps.last_stable_mc_ball_mci,
              extraFees,
            );
            assetPayment.payload.outputs.sort(sortOutputs);
            assetPayment.payload_hash = getBase64Hash(assetPayment.payload, bJsonBased);
            return assetPayment;
          }
          return {
            app: message.app,
            payload_hash: getBase64Hash(message.payload, bJsonBased),
            payload_location: 'inline',
            payload: message.payload,
          };
        }

        const unitMessages = await Promise.all(messages.map(createUnitMessage));

        const unit = {
          version,
          alt: conf.testnet ? ALT_TESTNET : ALT,
          messages: [...unitMessages],
          authors: [],
          parent_units: lightProps.parent_units,
          last_ball: lightProps.last_stable_mc_ball,
          last_ball_unit: lightProps.last_stable_mc_ball_unit,
          // the hub quoted tps_fee for its own timestamp, so we must reuse it
          timestamp: lightProps.timestamp || Math.round(Date.now() / 1000),
        };
        unit.tps_fee = tpsFee;
        if (lightProps.count_primary_aa_triggers && typeof conf.max_aa_responses === 'number') {
          unit.max_aa_responses = conf.max_aa_responses;
        }

        const author = { address, authentifiers: path }; // we temporarily place the path there to have its length counted
        if (isDefinitionRequired) {
          author.definition = definition;
        }
        unit.authors.push(author);

        const headersCommission = getHeadersSize(unit, bWithKeys);
        const payloadCommission = getTotalPayloadSize(unit, bWithKeys);

        for (let i = 0; i < unitMessages[0].payload.outputs.length; i += 1) {
          if (unitMessages[0].payload.outputs[i].address === address) {
            // it's change output
            unitMessages[0].payload.outputs[i].amount -=
              headersCommission + payloadCommission + extraFees;
            break;
          }
        }

        unitMessages[0].payload.outputs.sort(sortOutputs);
        unitMessages[0].payload_hash = getBase64Hash(unitMessages[0].payload, bJsonBased);

        unit.headers_commission = headersCommission;
        unit.payload_commission = payloadCommission;

        const textToSign = getUnitHashToSign(unit);
        unit.authors[0].authentifiers = {};
        unit.authors[0].authentifiers[path] = sign(textToSign, privKeyBuf);

        unit.messages = [...unitMessages];
        unit.unit = getUnitHash(unit);

        return unit;
      },
    };

    this.post = {
      async message(app, payload, options) {
        const unit = await self.compose.message(app, payload, options);
        return self.broadcast(unit);
      },
    };

    Object.assign(this.api, mapAPI(api, requestAsync));
    // bind expandApi helpers to this.api so `this.getAaStateVars(...)` works even
    // when a method is destructured off the api object (the previous loop discarded
    // the result of .bind(), so it was a no-op)
    Object.keys(expandApi).forEach((funcName) => {
      this.api[funcName] = expandApi[funcName].bind(this.api);
    });

    Object.assign(this.compose, mapAPI(apps, this.compose.message));
    Object.assign(this.post, mapAPI(apps, this.post.message));
  }

  async broadcast(unit) {
    await this.api.postJoint({ unit });
    return unit.unit;
  }

  async getCachedWitnesses() {
    if (this.cachedWitnesses) return this.cachedWitnesses;

    this.cachedWitnesses = await this.api.getWitnesses();
    return this.cachedWitnesses;
  }

  onConnect(cb) {
    this.client.onConnect(cb);
  }

  onError(cb) {
    this.client.onError(cb);
  }

  subscribe(cb) {
    this.client.subscribe(cb);
  }

  justsaying(subject, body) {
    this.client.justsaying(subject, body);
  }

  close() {
    this.client.close();
  }
}
