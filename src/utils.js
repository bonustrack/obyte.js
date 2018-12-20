import wif from 'wif';
import { chashGetChash160, getSourceString } from './internal';

export function getChash160(obj) {
  return chashGetChash160(getSourceString(obj));
}

export function toWif(privateKey, testnet) {
  const version = testnet ? 239 : 128;
  return wif.encode(version, privateKey, false);
}

export function fromWif(string, testnet) {
  const version = testnet ? 239 : 128;
  return wif.decode(string, version);
}
