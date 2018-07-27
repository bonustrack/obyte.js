import { Client as KbyteClient } from 'kbyte';
import objectHash from 'byteballcore/object_hash';
import constants from 'byteballcore/constants';
import objectLength from 'byteballcore/object_length';
import ecdsaSig from 'byteballcore/signature';
import { repeatString, mapAPI } from './internal';
import api from './api.json';
import apps from './apps.json';

export default class Client {
  constructor(nodeAddress = 'wss://byteball.org/bb') {
    const self = this;

    this.client = new KbyteClient(nodeAddress);

    const requestAsync = (name, params) =>
      new Promise((resolve, reject) => {
        this.client.request(name, params, (err, result) => {
          if (err) return reject(err);
          return resolve(result);
        });
      });

    Object.assign(this, mapAPI(api, requestAsync));

    this.compose = {
      async message(app, payload, auth) {
        const { address, privKeyBuf, definition } = auth;

        const message = {
          app,
          payload_hash: objectHash.getBase64Hash(payload),
          payload_location: 'inline',
          payload,
        };

        const witnesses = await self.getWitnesses();

        const [lightProps, history] = await Promise.all([
          self.getParentsAndLastBallAndWitnessListUnit({ witnesses }),
          self.getHistory({ witnesses, addresses: [address] }),
        ]);

        let requireDefinition = true;
        const joints = history.joints.concat(history.unstable_mc_joints);
        joints.forEach(joint => {
          joint.unit.authors.forEach(author => {
            if (author.address === address && author.definition) {
              requireDefinition = false;
            }
          });
        });

        const targetAmount = 1000;
        const coinsForAmount = await self.pickDivisibleCoinsForAmount({
          addresses: [address],
          last_ball_mci: lightProps.last_stable_mc_ball_mci,
          amount: targetAmount,
          spend_unconfirmed: 'own',
        });

        const inputs = coinsForAmount.inputs_with_proofs.map(input => input.input);

        const paymentPayload = {
          inputs,
          outputs: [{ address, amount: coinsForAmount.total_amount }],
        };

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
      },
    };

    this.post = {
      async message(app, payload, auth) {
        const unit = await self.compose.message(app, payload, auth);
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
}
