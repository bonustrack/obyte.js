import wif from 'wif';
import {
  chashGetChash160,
  getSourceString,
  isChashValid,
  getJsonSourceString,
  getUnitHashToSign,
  sign,
  toPublicKey,
} from './internal';
import { VERSION, VERSION_TESTNET } from './constants';

function getChash160(obj) {
  const sourceString =
    Array.isArray(obj) && obj.length === 2 && obj[0] === 'autonomous agent'
      ? getJsonSourceString(obj)
      : getSourceString(obj);
  return chashGetChash160(sourceString);
}

function toWif(privateKey, testnet) {
  const version = testnet ? 239 : 128;
  return wif.encode(version, privateKey, false);
}

function fromWif(string, testnet) {
  const version = testnet ? 239 : 128;
  return wif.decode(string, version);
}

function isValidAddress(address) {
  return (
    typeof address === 'string' &&
    address === address.toUpperCase() &&
    address.length === 32 &&
    isChashValid(address)
  );
}

function signMessage(message, options = {}) {
  const conf = typeof options === 'object' ? options : { wif: options };
  const privKeyBuf = conf.privateKey || fromWif(conf.wif, conf.testnet).privateKey;
  const pubkey = toPublicKey(privKeyBuf);
  const definition = conf.definition || ['sig', { pubkey }];
  const address = conf.address || getChash160(definition);
  const path = conf.path || 'r';
  const version = conf.testnet ? VERSION_TESTNET : VERSION;

  const objUnit = {
    version,
    signed_message: message,
    authors: [
      {
        address,
        definition,
      },
    ],
  };
  const textToSign = getUnitHashToSign(objUnit);
  objUnit.authors[0].authentifiers = {};
  objUnit.authors[0].authentifiers[path] = sign(textToSign, privKeyBuf);

  return objUnit;
}

export default {
  getChash160,
  toWif,
  fromWif,
  isValidAddress,
  signMessage,
};
