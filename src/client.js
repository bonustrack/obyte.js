import {
  repeatString,
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
} from './internal';
import { getChash160, fromWif } from './utils';
import WSClient from './wsclient';
import { DEFAULT_NODE, VERSION, VERSION_TESTNET, ALT, ALT_TESTNET } from './constants';
import api from './api.json';
import apps from './apps.json';

export default class Client {
  constructor(nodeAddress = DEFAULT_NODE, clientOptions = {}) {
    const self = this;

    this.options = typeof clientOptions === 'object' ? clientOptions : { testnet: clientOptions };
    this.client = new WSClient(nodeAddress);
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
        let isDefinitionRequired = false;
        const conf =
          typeof options === 'object'
            ? { ...self.options, ...options }
            : { ...self.options, wif: options };
        const privKeyBuf = conf.privateKey || fromWif(conf.wif, conf.testnet).privateKey;
        const pubkey = toPublicKey(privKeyBuf);
        const definition = conf.definition || ['sig', { pubkey }];
        const address = conf.address || getChash160(definition);
        const path = conf.path || 'r';

        const witnesses = await self.getCachedWitnesses();
        const [lightProps, objDefinition] = await Promise.all([
          self.api.getParentsAndLastBallAndWitnessListUnit({ witnesses }),
          self.api.getDefinitionForAddress({ address }),
        ]);
        if (!objDefinition.definition && objDefinition.is_stable) {
          isDefinitionRequired = true;
        } else if (!objDefinition.is_stable)
          throw new Error(
            `Definition or definition change for address ${address} is not stable yet`,
          );

        if (objDefinition.definition_chash !== getChash160(definition))
          throw new Error(
            `Definition chash of address doesn't match the definition chash provided`,
          );

        const bytePayment = await createPaymentMessage(
          self,
          null,
          app !== 'payment' || payload.asset ? [] : payload.outputs,
          address,
        );
        const customMessages = [bytePayment];

        if (app === 'payment') {
          if (payload.asset) {
            const assetPayment = await createPaymentMessage(
              self,
              payload.asset,
              payload.outputs,
              address,
            );
            customMessages.push(assetPayment);
          }
        } else {
          customMessages.push({
            app,
            payload_hash: getBase64Hash(payload),
            payload_location: 'inline',
            payload,
          });
        }

        const unit = {
          version: conf.testnet ? VERSION_TESTNET : VERSION,
          alt: conf.testnet ? ALT_TESTNET : ALT,
          messages: [...customMessages],
          authors: [],
          parent_units: lightProps.parent_units,
          last_ball: lightProps.last_stable_mc_ball,
          last_ball_unit: lightProps.last_stable_mc_ball_unit,
          witness_list_unit: lightProps.witness_list_unit,
        };
        unit.timestamp = Math.round(Date.now() / 1000);

        const author = { address, authentifiers: {} };
        if (isDefinitionRequired) {
          author.definition = definition;
        }

        const assocSigningPaths = {};
        const assocLengthsBySigningPaths = { r: 88 };
        const arrSigningPaths = Object.keys(assocLengthsBySigningPaths);
        assocSigningPaths[address] = arrSigningPaths;
        for (let j = 0; j < arrSigningPaths.length; j += 1) {
          author.authentifiers[arrSigningPaths[j]] = repeatString(
            '-',
            assocLengthsBySigningPaths[arrSigningPaths[j]],
          );
        }
        unit.authors.push(author);

        const headersCommission = getHeadersSize(unit);
        const payloadCommission = getTotalPayloadSize(unit);

        customMessages[0].payload.outputs[0].amount -= headersCommission + payloadCommission;
        customMessages[0].payload.outputs.sort(sortOutputs);
        customMessages[0].payload_hash = getBase64Hash(customMessages[0].payload);

        if (payload.asset) {
          customMessages[1].payload.outputs.sort(sortOutputs);
          customMessages[1].payload_hash = getBase64Hash(customMessages[1].payload);
        }

        unit.headers_commission = headersCommission;
        unit.payload_commission = payloadCommission;

        const textToSign = getUnitHashToSign(unit);
        unit.authors[0].authentifiers = {};
        unit.authors[0].authentifiers[path] = sign(textToSign, privKeyBuf);

        unit.messages = [...customMessages];
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
