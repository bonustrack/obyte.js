import wif from 'wif';
import {
  chashGetChash160,
  getSourceString,
  isChashValid,
  getJsonSourceString,
  getUnitHashToSign,
  getSignedPackageHashToSign,
  sign,
  verify,
  toPublicKey,
  isNonemptyArray,
  isNonemptyObject,
  hasFieldsExcept,
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

function validateSignedMessage(objSignedMessage, address, message) {
  // https://github.com/byteball/aa-channels-lib/blob/master/modules/signed_message.js
  if (typeof objSignedMessage !== 'object') return false;
  if (
    hasFieldsExcept(objSignedMessage, [
      'signed_message',
      'authors',
      'last_ball_unit',
      'timestamp',
      'version',
    ])
  )
    return false;
  if (!('signed_message' in objSignedMessage)) return false;
  if (message && message !== objSignedMessage.signed_message) return false;
  if (
    'version' in objSignedMessage &&
    !(VERSION === objSignedMessage.version || VERSION_TESTNET === objSignedMessage.version)
  )
    return false;
  const { authors } = objSignedMessage;
  if (!isNonemptyArray(authors)) return false;
  if (authors.length > 1) return false;
  const objAuthor = authors[0];
  if (hasFieldsExcept(objAuthor, ['address', 'definition', 'authentifiers'])) return false;
  if (!isValidAddress(objAuthor.address)) return false;
  if (address && address !== objAuthor.address) return false;
  if (!isNonemptyObject(objAuthor.authentifiers)) return false;
  const bHasDefinition = 'definition' in objAuthor;
  if (!bHasDefinition) return false;
  const { definition } = objAuthor;
  if (!Array.isArray(definition)) return false;
  if (definition[0] !== 'sig') return false;
  if (typeof definition[1] !== 'object') return false;
  try {
    if (getChash160(definition) !== objAuthor.address) return false;
  } catch (e) {
    return false;
  }
  let unitHashToSign;
  try {
    unitHashToSign = getSignedPackageHashToSign(objSignedMessage);
  } catch (e) {
    return false;
  }
  const signature = objAuthor.authentifiers.r;
  if (!signature) return false;
  return verify(unitHashToSign, signature, definition[1].pubkey);
}

export default {
  getChash160,
  toWif,
  fromWif,
  isValidAddress,
  signMessage,
  validateSignedMessage,
};
