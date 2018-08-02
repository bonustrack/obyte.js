import ecdsa from 'secp256k1';
import createHash from 'create-hash';
import base32 from 'thirty-two';

const PARENT_UNITS_SIZE = 2 * 44;
const PI = '14159265358979323846264338327950288419716939937510';
const zeroString = '00000000';
const arrRelativeOffsets = PI.split('');

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

export async function createPaymentMessage(client, lightProps, asset, outputs, address) {
  const amount = outputs.reduce((a, b) => a + b.amount, 0);

  const targetAmount = asset ? amount : 1000 + amount;
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
    outputs: [{ address, amount: coinsForAmount.total_amount - amount }, ...outputs],
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

function getLength(value) {
  if (value === null) return 0;
  switch (typeof value) {
    case 'string':
      return value.length;
    case 'number':
      return 8;
    // return value.toString().length;
    case 'object':
      let len = 0;
      if (Array.isArray(value)) {
        value.forEach(element => {
          len += getLength(element);
        });
      } else {
        for (const key in value) {
          if (typeof value[key] === 'undefined')
            throw Error(`undefined at ${key} of ${JSON.stringify(value)}`);
          len += getLength(value[key]);
        }
      }
      return len;
    case 'boolean':
      return 1;
    default:
      throw Error(`unknown type=${typeof value} of ${value}`);
  }
}

export function getHeadersSize(objUnit) {
  if (objUnit.content_hash) throw Error('trying to get headers size of stripped unit');
  const objHeader = JSON.parse(JSON.stringify(objUnit));
  delete objHeader.unit;
  delete objHeader.headers_commission;
  delete objHeader.payload_commission;
  delete objHeader.main_chain_index;
  delete objHeader.timestamp;
  delete objHeader.messages;
  delete objHeader.parent_units; // replaced with PARENT_UNITS_SIZE
  return getLength(objHeader) + PARENT_UNITS_SIZE;
}

export function getTotalPayloadSize(objUnit) {
  if (objUnit.content_hash) throw Error('trying to get payload size of stripped unit');
  return getLength(objUnit.messages);
}

function calcOffsets(chashLength) {
  checkLength(chashLength);
  const arrOffsets = [];
  let offset = 0;
  let index = 0;

  for (let i = 0; offset < chashLength; i++) {
    const relativeOffset = parseInt(arrRelativeOffsets[i]);
    if (relativeOffset === 0) continue;
    offset += relativeOffset;
    if (chashLength === 288) offset += 4;
    if (offset >= chashLength) break;
    arrOffsets.push(offset);
    // console.log('index='+index+', offset='+offset);
    index++;
  }

  if (index !== 32) {
    throw Error('wrong number of checksum bits');
  }

  return arrOffsets;
}

const arrOffsets160 = calcOffsets(160);
const arrOffsets288 = calcOffsets(288);

export function getChash160(obj) {
  return chashGetChash160(getSourceString(obj));
}

export function getBase64Hash(obj) {
  return createHash('sha256')
    .update(getSourceString(obj), 'utf8')
    .digest('base64');
}

export function getUnitHashToSign(objUnit) {
  const objNakedUnit = getNakedUnit(objUnit);
  for (let i = 0; i < objNakedUnit.authors.length; i++)
    delete objNakedUnit.authors[i].authentifiers;
  return createHash('sha256')
    .update(getSourceString(objNakedUnit), 'utf8')
    .digest();
}

export function getUnitHash(objUnit) {
  if (objUnit.content_hash)
    // already stripped
    return getBase64Hash(getNakedUnit(objUnit));
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
  return getBase64Hash(objStrippedUnit);
}

function getNakedUnit(objUnit) {
  const objNakedUnit = JSON.parse(JSON.stringify(objUnit));
  delete objNakedUnit.unit;
  delete objNakedUnit.headers_commission;
  delete objNakedUnit.payload_commission;
  delete objNakedUnit.main_chain_index;
  delete objNakedUnit.timestamp;
  // delete objNakedUnit.last_ball_unit;
  if (objNakedUnit.messages) {
    for (let i = 0; i < objNakedUnit.messages.length; i++) {
      delete objNakedUnit.messages[i].payload;
      delete objNakedUnit.messages[i].payload_uri;
    }
  }
  // console.log('naked Unit: ', objNakedUnit);
  // console.log('original Unit: ', objUnit);
  return objNakedUnit;
}

function getUnitContentHash(objUnit) {
  return getBase64Hash(getNakedUnit(objUnit));
}

const STRING_JOIN_CHAR = '\x00';

/**
 * Converts the argument into a string by mapping data types to a prefixed string and concatenating all fields together.
 * @param obj the value to be converted into a string
 * @returns {string} the string version of the value
 */
function getSourceString(obj) {
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
          for (let i = 0; i < variable.length; i++) extractComponents(variable[i]);
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

function chashGetChash160(data) {
  return getChash(data, 160);
}

function getChash(data, chashLength) {
  // console.log('getChash: '+data);
  checkLength(chashLength);
  const hash = createHash(chashLength === 160 ? 'ripemd160' : 'sha256')
    .update(data, 'utf8')
    .digest();
  // console.log('hash', hash);
  const truncatedHash = chashLength === 160 ? hash.slice(4) : hash; // drop first 4 bytes if 160
  // console.log('clean data', truncatedHash);
  const checksum = getChecksum(truncatedHash);
  // console.log('checksum', checksum);
  // console.log('checksum', buffer2bin(checksum));

  const binCleanData = buffer2bin(truncatedHash);
  const binChecksum = buffer2bin(checksum);
  const binChash = mixChecksumIntoCleanData(binCleanData, binChecksum);
  // console.log(binCleanData.length, binChecksum.length, binChash.length);
  const chash = bin2buffer(binChash);
  // console.log('chash     ', chash);
  return chashLength === 160 ? base32.encode(chash).toString() : chash.toString('base64');
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
  for (let i = 0; i < arrOffsets.length; i++) {
    const end = arrOffsets[i] - i;
    arrFrags.push(binCleanData.substring(start, end));
    arrFrags.push(arrChecksumBits[i]);
    start = end;
  }
  // add last frag
  if (start < binCleanData.length) arrFrags.push(binCleanData.substring(start));
  return arrFrags.join('');
}

function buffer2bin(buf) {
  const bytes = [];
  for (let i = 0; i < buf.length; i++) {
    let bin = buf[i].toString(2);
    if (bin.length < 8)
      // pad with zeros
      bin = zeroString.substring(bin.length, 8) + bin;
    bytes.push(bin);
  }
  return bytes.join('');
}

function bin2buffer(bin) {
  const len = bin.length / 8;
  const buf = new Buffer(len);
  for (let i = 0; i < len; i++) buf[i] = parseInt(bin.substr(i * 8, 8), 2);
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
  return new Buffer([fullChecksum[5], fullChecksum[13], fullChecksum[21], fullChecksum[29]]);
}
