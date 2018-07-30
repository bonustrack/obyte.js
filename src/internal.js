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

export const toPublicKey = (privKey) => {
  return ecdsa.publicKeyCreate(privKey).toString('base64');
};

