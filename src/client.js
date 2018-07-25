import { Client as KbyteClient } from 'kbyte';
import objectHash from 'byteballcore/object_hash';
import constants from 'byteballcore/constants';
import objectLength from 'byteballcore/object_length';
import ecdsaSig from 'byteballcore/signature';
import { camelCase, repeatString } from './internal';
import api from './api.json';

export default class Client {
  constructor(address) {
    this.client = new KbyteClient(address);
    Object.keys(api).forEach(name => {
      this[camelCase(name)] = (params, cb) => {
        if (!api[name].params && typeof params === 'function') {
          cb = params; // eslint-disable-line no-param-reassign
        }
        const promise = new Promise((resolve, reject) => {
          this.client.request(name, api[name].params ? params : null, (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });
        if (!cb) return promise;
        return promise.then(result => cb(null, result)).catch(err => cb(err, null));
      };
    });
  }

  async compose(app, payload, auth) {
    const { address, privKeyBuf } = auth;

    const message = {
      app,
      payload_hash: objectHash.getBase64Hash(payload),
      payload_location: 'inline',
      payload,
    };

    const witnesses = await this.getWitnesses();
    const lightProps = await this.getParentsAndLastBallAndWitnessListUnit({ witnesses });

    const targetAmount = 1000;
    const coinsForAmount = await this.pickDivisibleCoinsForAmount({
      addresses: [address],
      last_ball_mci: lightProps.last_stable_mc_ball_mci,
      amount: targetAmount,
      spend_unconfirmed: 'own',
    });

    const inputs = coinsForAmount.inputs_with_proofs.map(input => input.input);

    const paymentPayload = { inputs, outputs: [{ address, amount: coinsForAmount.total_amount }] };

    const paymentMessage = {
      app: 'payment',
      payload_hash: '--------------------------------------------',
      payload_location: 'inline',
      payload: paymentPayload,
    };

    const unit = {
      version: constants.version,
      alt: constants.alt,
      messages: [message, paymentMessage],
      authors: [],
      parent_units: lightProps.parent_units,
      last_ball: lightProps.last_stable_mc_ball,
      last_ball_unit: lightProps.last_stable_mc_ball_unit,
      witness_list_unit: lightProps.witness_list_unit,
    };

    let author = { address, authentifiers: {} };
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

    const headersCommission = objectLength.getHeadersSize(unit);
    const payloadCommission = objectLength.getTotalPayloadSize(unit);

    paymentMessage.payload.outputs[0].amount -= headersCommission + payloadCommission;
    paymentMessage.payload_hash = objectHash.getBase64Hash(paymentMessage.payload);

    unit.headers_commission = headersCommission;
    unit.payload_commission = payloadCommission;
    unit.timestamp = Math.round(Date.now() / 1000);

    const textToSign = objectHash.getUnitHashToSign(unit);
    const signature = ecdsaSig.sign(textToSign, privKeyBuf);
    author = { address, authentifiers: { r: signature } };
    unit.authors = [author];

    unit.messages = [message, paymentMessage];
    unit.unit = objectHash.getUnitHash(unit);

    return unit;
  }

  async broadcast(unit) {
    await this.postJoint({ unit });
    return unit.unit;
  }

  async post(app, payload, auth) {
    const unit = await this.compose(
      app,
      payload,
      auth,
    );
    return this.broadcast(unit);
  }
}
