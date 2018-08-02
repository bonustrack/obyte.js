import {
  repeatString,
  requiresDefinition,
  createPaymentMessage,
  sortOutputs,
  mapAPI,
  sign,
  toPublicKey,
  getHeadersSize,
  getTotalPayloadSize,
  getChash160,
  getBase64Hash,
  getUnitHashToSign,
  getUnitHash,
} from './internal';
import WSClient from './wsclient';
import { DEFAULT_NODE, VERSION, ALT } from './constants';
import api from './api.json';
import apps from './apps.json';

export default class Client {
  constructor(nodeAddress = DEFAULT_NODE) {
    const self = this;

    this.client = new WSClient(nodeAddress);
    this.cachedWitnesses = null;

    const requestAsync = (name, params) =>
      new Promise((resolve, reject) => {
        this.client.request(name, params, (err, result) => {
          if (err) return reject(err);
          return resolve(result);
        });
      });

    Object.assign(this, mapAPI(api, requestAsync));

    this.compose = {
      async message(app, payload, privKeyBuf) {
        const pubkey = toPublicKey(privKeyBuf);
        const definition = ['sig', { pubkey }];
        const address = getChash160(definition);

        const witnesses = await self.getCachedWitnesses();

        const [lightProps, history] = await Promise.all([
          self.getParentsAndLastBallAndWitnessListUnit({ witnesses }),
          self.getHistory({ witnesses, addresses: [address] }),
        ]);

        const bytePayment = await createPaymentMessage(
          self,
          lightProps,
          null,
          app !== 'payment' || payload.asset ? [] : payload.outputs,
          address,
        );
        const customMessages = [bytePayment];

        if (app === 'payment') {
          if (payload.asset) {
            const assetPayment = await createPaymentMessage(
              self,
              lightProps,
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

        const requireDefinition = requiresDefinition(address, history);

        const unit = {
          version: VERSION,
          alt: ALT,
          messages: [...customMessages],
          authors: [],
          parent_units: lightProps.parent_units,
          last_ball: lightProps.last_stable_mc_ball,
          last_ball_unit: lightProps.last_stable_mc_ball_unit,
          witness_list_unit: lightProps.witness_list_unit,
        };

        let author = { address, authentifiers: {} };
        if (requireDefinition) {
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
        customMessages[0].payload_hash = objectHash.getBase64Hash(customMessages[0].payload);

        if (payload.asset) {
          customMessages[1].payload.outputs.sort(sortOutputs);
          customMessages[1].payload_hash = getBase64Hash(customMessages[1].payload);
        }

        unit.headers_commission = headersCommission;
        unit.payload_commission = payloadCommission;
        unit.timestamp = Math.round(Date.now() / 1000);

        const textToSign = getUnitHashToSign(unit);
        const signature = sign(textToSign, privKeyBuf);
        author = { address, authentifiers: { r: signature } };
        unit.authors = [author];

        unit.messages = [...customMessages];
        unit.unit = getUnitHash(unit);

        return unit;
      },
    };

    this.post = {
      async message(app, payload, privKeyBuf) {
        const unit = await self.compose.message(app, payload, privKeyBuf);
        return self.broadcast(unit);
      },
    };

    Object.assign(this.compose, mapAPI(apps, this.compose.message));
    Object.assign(this.post, mapAPI(apps, this.post.message));
  }

  async broadcast(unit) {
    await this.postJoint({ unit });
    return unit.unit;
  }

  async getCachedWitnesses() {
    if (this.cachedWitnesses) return this.cachedWitnesses;

    this.cachedWitnesses = await this.getWitnesses();
    return this.cachedWitnesses;
  }

  close() {
    this.client.close();
  }
}
