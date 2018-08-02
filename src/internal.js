import ecdsa from 'secp256k1';

export const camelCase = input =>
  input
    .split('/')
    .pop()
    .split('_')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')
    .replace(/^\w/, c => c.toLowerCase());

export const repeatString = (str, times) =>
  str.repeat ? str.repeat(times) : new Array(times + 1).join(str);

export function requiresDefinition(address, history) {
  let requireDefinition = true;

  const joints = history.joints.concat(history.unstable_mc_joints);
  joints.forEach(joint => {
    joint.unit.authors.forEach(author => {
      if (author.address === address && author.definition) {
        requireDefinition = false;
      }
    });
  });

  return requireDefinition;
}

export function createNakedPaymentMessage(outputs, address) {
  const amount = outputs.reduce((a, b) => a + b.amount, 0);

  return {
    app: 'payment',
    payload_hash: '--------------------------------------------',
    payload_location: 'inline',
    payload: {
      inputs: [
        {
          unit: '--------------------------------------------',
          message_index: 0,
          output_index: 0,
        },
      ],
      outputs: [{ address, amount }, ...outputs],
    },
  };
}

export async function createPaymentMessage(client, lightProps, asset, fees, outputs, address) {
  const amount = outputs.reduce((a, b) => a + b.amount, 0);

  console.log('fees', fees);

  const targetAmount = amount + fees;
  const coinsForAmount = await client.pickDivisibleCoinsForAmount({
    addresses: [address],
    last_ball_mci: lightProps.last_stable_mc_ball_mci,
    amount: targetAmount,
    spend_unconfirmed: 'own',
    asset,
  });

  const inputs = coinsForAmount.inputs_with_proofs.map(input => input.input);

  const payload = {
    inputs,
    outputs: [{ address, amount: coinsForAmount.total_amount - amount - fees }, ...outputs],
  };

  if (asset) {
    payload.asset = asset;
  }

  const payment = {
    app: 'payment',
    payload_hash: '--------------------------------------------',
    payload_location: 'inline',
    payload,
  };

  return payment;
}

export function sortOutputs(a, b) {
  const localeCompare = a.address.localeCompare(b.address);
  return localeCompare || a.amount - b.amount;
}

export const mapAPI = (api, impl) =>
  Object.keys(api).reduce(
    (prev, name) => ({
      ...prev,
      [camelCase(name)]: (...params) => {
        let cb = params.length !== 0 ? params[params.length - 1] : null;

        if (typeof cb === 'function') {
          params = params.slice(0, -1); // eslint-disable-line no-param-reassign
        } else {
          cb = null;
        }

        const promise = impl(name, ...params);

        if (!cb) return promise;
        return promise.then(result => cb(null, result)).catch(err => cb(err, null));
      },
    }),
    {},
  );

export const sign = (hash, privKey) => {
  const res = ecdsa.sign(hash, privKey);
  return res.signature.toString('base64');
};

export const toPublicKey = privKey => ecdsa.publicKeyCreate(privKey).toString('base64');
