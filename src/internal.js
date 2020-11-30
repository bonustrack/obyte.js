import ecdsa from 'secp256k1';
import createHash from 'create-hash';
import base32 from 'thirty-two';

const PARENT_UNITS_SIZE = 2 * 44;
const PARENT_UNITS_KEY_SIZE = 'parent_units'.length;
const SIGNATURE_SIZE = 88;
const PI = '14159265358979323846264338327950288419716939937510';
const STRING_JOIN_CHAR = '\x00';
const ZERO_STRING = '00000000';
const ARR_RELATIVE_OFFSETS = PI.split('');

export const camelCase = input =>
  input
    .split('/')
    .pop()
    .split('_')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')
    .replace(/^\w/, c => c.toLowerCase());

export async function createPaymentMessage(
  client,
  asset,
  outputs,
  address,
  payloadLength,
  lastBallMci,
) {
  const amount = outputs.reduce((a, b) => a + b.amount, 0);

  const targetAmount = asset ? amount : 700 + payloadLength + amount;

  const coinsForAmount = await client.api.pickDivisibleCoinsForAmount({
    addresses: [address],
    last_ball_mci: lastBallMci,
    amount: targetAmount,
    spend_unconfirmed: 'own',
    asset,
  });

  const inputs = coinsForAmount.inputs_with_proofs.map(input => input.input);

  const payload = {
    inputs,
    outputs: [{ address, amount: coinsForAmount.total_amount - amount }, ...outputs],
  };

  if (asset) {
    payload.asset = asset;
    if (payload.outputs[0].amount === 0)
      // amount 0 output is not valid
      payload.outputs = payload.outputs.slice(1);
  }

  return {
    app: 'payment',
    payload_hash: '--------------------------------------------',
    payload_location: 'inline',
    payload,
  };
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

function buffer2bin(buf) {
  const bytes = [];
  for (let i = 0; i < buf.length; i += 1) {
    let bin = buf[i].toString(2);
    if (bin.length < 8)
      // pad with zeros
      bin = ZERO_STRING.substring(bin.length, 8) + bin;
    bytes.push(bin);
  }
  return bytes.join('');
}

function bin2buffer(bin) {
  const len = bin.length / 8;
  const buf = Buffer.alloc(len);
  for (let i = 0; i < len; i += 1) buf[i] = parseInt(bin.substr(i * 8, 8), 2);
  return buf;
}

function checkLength(chashLength) {
  if (chashLength !== 160 && chashLength !== 288)
    throw Error(`unsupported c-hash length: ${chashLength}`);
}

function getChecksum(cleanData) {
  const fullChecksum = createHash('sha256')
    .update(cleanData)
    .digest();
  return Buffer.from([fullChecksum[5], fullChecksum[13], fullChecksum[21], fullChecksum[29]]);
}

function getNakedUnit(objUnit) {
  const objNakedUnit = JSON.parse(JSON.stringify(objUnit));
  delete objNakedUnit.unit;
  delete objNakedUnit.headers_commission;
  delete objNakedUnit.payload_commission;
  delete objNakedUnit.main_chain_index;

  if (objNakedUnit.messages) {
    for (let i = 0; i < objNakedUnit.messages.length; i += 1) {
      delete objNakedUnit.messages[i].payload;
      delete objNakedUnit.messages[i].payload_uri;
    }
  }
  return objNakedUnit;
}

/**
 * Converts the argument into a string by mapping data types to a prefixed string and concatenating all fields together.
 * @param obj the value to be converted into a string
 * @returns {string} the string version of the value
 */
export function getSourceString(obj) {
  const arrComponents = [];
  function extractComponents(variable) {
    if (variable === null) throw Error(`null value in ${JSON.stringify(obj)}`);
    switch (typeof variable) {
      case 'string':
        arrComponents.push('s', variable);
        break;
      case 'number':
        arrComponents.push('n', variable.toString());
        break;
      case 'boolean':
        arrComponents.push('b', variable.toString());
        break;
      case 'object':
        if (Array.isArray(variable)) {
          if (variable.length === 0) throw Error(`empty array in ${JSON.stringify(obj)}`);
          arrComponents.push('[');
          for (let i = 0; i < variable.length; i += 1) extractComponents(variable[i]);
          arrComponents.push(']');
        } else {
          const keys = Object.keys(variable).sort();
          if (keys.length === 0) throw Error(`empty object in ${JSON.stringify(obj)}`);
          keys.forEach(key => {
            if (typeof variable[key] === 'undefined')
              throw Error(`undefined at ${key} of ${JSON.stringify(obj)}`);
            arrComponents.push(key);
            extractComponents(variable[key]);
          });
        }
        break;
      default:
        throw Error(
          `hash: unknown type=${typeof variable} of ${variable}, object: ${JSON.stringify(obj)}`,
        );
    }
  }

  extractComponents(obj);
  return arrComponents.join(STRING_JOIN_CHAR);
}

export function getJsonSourceString(obj) {
  function stringify(variable) {
    if (variable === null) throw Error(`null value in ${JSON.stringify(obj)}`);
    switch (typeof variable) {
      case 'string':
        return JSON.stringify(variable);
      case 'number':
      case 'boolean':
        return variable.toString();
      case 'object':
        if (Array.isArray(variable)) {
          if (variable.length === 0) throw Error(`empty array in ${JSON.stringify(obj)}`);
          return `[${variable.map(stringify).join(',')}]`;
        }
        const keys = Object.keys(variable).sort(); // eslint-disable-line no-case-declarations
        if (keys.length === 0) throw Error(`empty object in ${JSON.stringify(obj)}`);
        return `{${keys
          .map(key => `${JSON.stringify(key)}:${stringify(variable[key])}`)
          .join(',')}}`;
      default:
        throw Error(
          `hash: unknown type=${typeof variable} of ${variable}, object: ${JSON.stringify(obj)}`,
        );
    }
  }
  return stringify(obj);
}

function calcOffsets(chashLength) {
  checkLength(chashLength);
  const arrOffsets = [];
  let offset = 0;
  let index = 0;

  for (let i = 0; offset < chashLength; i += 1) {
    const relativeOffset = parseInt(ARR_RELATIVE_OFFSETS[i], 10);
    if (relativeOffset !== 0) {
      offset += relativeOffset;
      if (chashLength === 288) offset += 4;
      if (offset >= chashLength) break;
      arrOffsets.push(offset);
      index += 1;
    }
  }

  if (index !== 32) {
    throw Error('wrong number of checksum bits');
  }

  return arrOffsets;
}

const arrOffsets160 = calcOffsets(160);
const arrOffsets288 = calcOffsets(288);

function separateIntoCleanDataAndChecksum(bin) {
  const len = bin.length;
  let arrOffsets;
  if (len === 160) arrOffsets = arrOffsets160;
  else if (len === 288) arrOffsets = arrOffsets288;
  else throw Error(`bad length=${len}, bin = ${bin}`);
  const arrFrags = [];
  const arrChecksumBits = [];
  let start = 0;
  for (let i = 0; i < arrOffsets.length; i += 1) {
    arrFrags.push(bin.substring(start, arrOffsets[i]));
    arrChecksumBits.push(bin.substr(arrOffsets[i], 1));
    start = arrOffsets[i] + 1;
  }
  // add last frag
  if (start < bin.length) arrFrags.push(bin.substring(start));
  const binCleanData = arrFrags.join('');
  const binChecksum = arrChecksumBits.join('');
  return { cleanData: binCleanData, checksum: binChecksum };
}

function mixChecksumIntoCleanData(binCleanData, binChecksum) {
  if (binChecksum.length !== 32) throw Error('bad checksum length');
  const len = binCleanData.length + binChecksum.length;
  let arrOffsets;
  if (len === 160) arrOffsets = arrOffsets160;
  else if (len === 288) arrOffsets = arrOffsets288;
  else throw Error(`bad length=${len}, clean data = ${binCleanData}, checksum = ${binChecksum}`);
  const arrFrags = [];
  const arrChecksumBits = binChecksum.split('');
  let start = 0;
  for (let i = 0; i < arrOffsets.length; i += 1) {
    const end = arrOffsets[i] - i;
    arrFrags.push(binCleanData.substring(start, end));
    arrFrags.push(arrChecksumBits[i]);
    start = end;
  }
  // add last frag
  if (start < binCleanData.length) arrFrags.push(binCleanData.substring(start));
  return arrFrags.join('');
}

function getChash(data, chashLength) {
  checkLength(chashLength);
  const hash = createHash(chashLength === 160 ? 'ripemd160' : 'sha256')
    .update(data, 'utf8')
    .digest();
  const truncatedHash = chashLength === 160 ? hash.slice(4) : hash; // drop first 4 bytes if 160
  const checksum = getChecksum(truncatedHash);

  const binCleanData = buffer2bin(truncatedHash);
  const binChecksum = buffer2bin(checksum);
  const binChash = mixChecksumIntoCleanData(binCleanData, binChecksum);
  const chash = bin2buffer(binChash);
  return chashLength === 160 ? base32.encode(chash).toString() : chash.toString('base64');
}

export function isChashValid(encoded) {
  const encodedLength = encoded.length;
  let chash;
  if (encodedLength !== 32 && encodedLength !== 48)
    // 160/5 = 32, 288/6 = 48
    throw Error(`wrong encoded length: ${encodedLength}`);
  try {
    chash = encodedLength === 32 ? base32.decode(encoded) : Buffer.from(encoded, 'base64');
  } catch (e) {
    console.log(e);
    return false;
  }
  const binChash = buffer2bin(chash);
  const separated = separateIntoCleanDataAndChecksum(binChash);
  const cleanData = bin2buffer(separated.cleanData);
  const checksum = bin2buffer(separated.checksum);
  return checksum.equals(getChecksum(cleanData));
}

export function chashGetChash160(data) {
  return getChash(data, 160);
}

export const toPublicKey = privKey => ecdsa.publicKeyCreate(privKey).toString('base64');

export function getLength(value, bWithKeys) {
  if (value === null) return 0;
  switch (typeof value) {
    case 'string':
      return value.length;
    case 'number':
      return 8;
    case 'object': {
      let len = 0;
      if (Array.isArray(value)) {
        value.forEach(element => {
          len += getLength(element, bWithKeys);
        });
      } else {
        Object.keys(value).forEach(key => {
          if (typeof value[key] === 'undefined')
            throw Error(`undefined at ${key} of ${JSON.stringify(value)}`);
          if (bWithKeys) len += key.length;
          len += getLength(value[key], bWithKeys);
        });
      }
      return len;
    }
    case 'boolean':
      return 1;
    default:
      throw Error(`unknown type=${typeof value} of ${value}`);
  }
}

export function getHeadersSize(objUnit, bWithKeys) {
  if (objUnit.content_hash) throw Error('trying to get headers size of stripped unit');
  const objHeader = JSON.parse(JSON.stringify(objUnit));
  delete objHeader.unit;
  delete objHeader.headers_commission;
  delete objHeader.payload_commission;
  delete objHeader.main_chain_index;
  delete objHeader.messages;
  delete objHeader.parent_units; // replaced with PARENT_UNITS_SIZE
  return (
    getLength(objHeader, bWithKeys) +
    PARENT_UNITS_SIZE +
    (bWithKeys ? PARENT_UNITS_KEY_SIZE : 0) +
    SIGNATURE_SIZE
  ); // unit is always single authored thus only has 1 signature in authentifiers
}

export function getTotalPayloadSize(objUnit, bWithKeys) {
  if (objUnit.content_hash) throw Error('trying to get payload size of stripped unit');
  return getLength({ messages: objUnit.messages }, bWithKeys);
}

export function getBase64Hash(obj, bJsonBased) {
  const sourceString = bJsonBased ? getJsonSourceString(obj) : getSourceString(obj);
  return createHash('sha256')
    .update(sourceString, 'utf8')
    .digest('base64');
}

export function getUnitHashToSign(objUnit) {
  const objNakedUnit = getNakedUnit(objUnit);
  for (let i = 0; i < objNakedUnit.authors.length; i += 1)
    delete objNakedUnit.authors[i].authentifiers;
  const sourceString = getJsonSourceString(objNakedUnit);
  return createHash('sha256')
    .update(sourceString, 'utf8')
    .digest();
}

function getUnitContentHash(objUnit) {
  return getBase64Hash(getNakedUnit(objUnit), true);
}

export function getUnitHash(objUnit) {
  if (objUnit.content_hash)
    // already stripped
    return getBase64Hash(getNakedUnit(objUnit), true);
  const objStrippedUnit = {
    content_hash: getUnitContentHash(objUnit),
    version: objUnit.version,
    alt: objUnit.alt,
    authors: objUnit.authors.map(author => ({ address: author.address })), // already sorted
  };
  if (objUnit.witness_list_unit) objStrippedUnit.witness_list_unit = objUnit.witness_list_unit;
  else objStrippedUnit.witnesses = objUnit.witnesses;
  if (objUnit.parent_units) {
    objStrippedUnit.parent_units = objUnit.parent_units;
    objStrippedUnit.last_ball = objUnit.last_ball;
    objStrippedUnit.last_ball_unit = objUnit.last_ball_unit;
  }
  objStrippedUnit.timestamp = objUnit.timestamp;
  return getBase64Hash(objStrippedUnit, true);
}

export function isNonemptyArray(arr) {
  return Array.isArray(arr) && arr.length > 0;
}

export function isArrayOfLength(arr, len) {
  return Array.isArray(arr) && arr.length === len;
}

export function isNonemptyObject(obj) {
  return obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).length > 0;
}

/**
 * True if there is at least one field in obj that is not in arrFields.
 */
export function hasFieldsExcept(obj, arrFields) {
  let exists = false;
  Object.keys(obj).forEach(field => {
    if (arrFields.indexOf(field) === -1) {
      exists = true;
    }
  });
  return exists;
}
