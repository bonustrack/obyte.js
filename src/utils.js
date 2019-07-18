import wif from 'wif';
import { chashGetChash160, getSourceString, isChashValid, getJsonSourceString } from './internal';

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

export default {
  getChash160,
  toWif,
  fromWif,
  isValidAddress,
};
