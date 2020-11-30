import wif from 'wif';
import {
  chashGetChash160,
  getSourceString,
  isChashValid,
  getJsonSourceString,
  getUnitHashToSign,
  sign,
  toPublicKey,
  isNonemptyArray,
  isArrayOfLength,
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

function validateSignedMessage(objSignedMessage, address) {
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
  if (
    'version' in objSignedMessage &&
    !(VERSION === objSignedMessage.version || VERSION_TESTNET === objSignedMessage.version)
  )
    return false;
  const { authors } = objSignedMessage;
  if (!isNonemptyArray(authors)) return false;
  if (!address && !isArrayOfLength(authors, 1)) return false;
  let theAuthor;
  for (let i = 0; i < authors.length; i += 1) {
    const author = authors[i];
    if (hasFieldsExcept(author, ['address', 'definition', 'authentifiers'])) return false;
    if (author.address === address) theAuthor = author;
    else if (!isValidAddress(author.address)) return false;
    if (!isNonemptyObject(author.authentifiers)) return false;
  }
  if (!theAuthor) {
    if (address) return false;
    [theAuthor] = authors;
  }
  const objAuthor = theAuthor;
  const bHasDefinition = 'definition' in objAuthor;
  if (!bHasDefinition) return false;
  try {
    if (getChash160(objAuthor.definition) !== objAuthor.address) return false;
  } catch (e) {
    return false;
  }
  return true;
}

export default {
  getChash160,
  toWif,
  fromWif,
  isValidAddress,
  signMessage,
  validateSignedMessage,
};
