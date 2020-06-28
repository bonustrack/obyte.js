import WSClient from './wsclient';
import utils from './utils';
import {
  DEFAULT_NODE,
  VERSION,
  VERSION_TESTNET,
  ALT,
  ALT_TESTNET,
  VERSION_WITHOUT_KEY_SIZES,
  KEY_SIZE_UPGRADE_MCI,
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
    this.client = new WSClient(nodeAddress, this.options.reconnect || false);
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

        messages.sort(a => {
          return a.app === 'payment' && !a.payload.asset ? -1 : 1; // we place byte payment message first
        });
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
        const [lightProps, objDefinition] = await Promise.all([
          self.api.getParentsAndLastBallAndWitnessListUnit({ witnesses }),
          self.api.getDefinitionForAddress({ address }),
        ]);
        const bWithKeys =
          conf.testnet || lightProps.last_stable_mc_ball_mci >= KEY_SIZE_UPGRADE_MCI;
        let version;
        if (conf.testnet) version = VERSION_TESTNET;
        else if (bWithKeys) version = VERSION;
        else version = VERSION_WITHOUT_KEY_SIZES;
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
          witness_list_unit: lightProps.witness_list_unit,
          timestamp: Math.round(Date.now() / 1000),
        };

        const author = { address, authentifiers: bWithKeys ? path : {} }; // we temporarily place the path there to have its length counted
        if (isDefinitionRequired) {
          author.definition = definition;
        }
        unit.authors.push(author);

        const headersCommission = getHeadersSize(unit, bWithKeys);
        const payloadCommission = getTotalPayloadSize(unit, bWithKeys);

        unitMessages[0].payload.outputs[0].amount -= headersCommission + payloadCommission;
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

    Object.keys(expandApi).forEach(funcName => {
      expandApi[funcName].bind(this.api);
    });

    Object.assign(this.api, mapAPI(api, requestAsync), expandApi);
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
