import kbyte from 'kbyte';
import bluebird from 'bluebird';
import Mnemonic from 'bitcore-mnemonic';
import objectLength from 'byteballcore/object_length';
import objectHash from 'byteballcore/object_hash';
import constants from 'byteballcore/constants';
import ecdsaSig from 'byteballcore/signature';

bluebird.promisifyAll(kbyte.Client.prototype);
const client = new kbyte.Client('wss://byteball.org/bb');

const repeatString = (str, times) => (
  str.repeat ? str.repeat(times) : (new Array(times + 1)).join(str)
);

const compose = async (app, payload, { address, privKeyBuf, definition }, cb) => {
  const objMessage = { app };
  objMessage.payload_hash = objectHash.getBase64Hash(payload);
  objMessage.payload_location = 'inline';
  objMessage.payload = payload;

  const witnesses = await client.requestAsync('get_witnesses', null);
  const lightProps = await client.requestAsync('light/get_parents_and_last_ball_and_witness_list_unit', { witnesses });

  const targetAmount = 1000;
  const coinsForAmount = await client.requestAsync('light/pick_divisible_coins_for_amount', {
    addresses: [address],
    last_ball_mci: 1000000000,
    amount: targetAmount,
    spend_unconfirmed: 'own',
  });
  const inputs = coinsForAmount.inputs_with_proofs.map(input => input.input);
  const amount = coinsForAmount.total_amount;
  console.log('Inputs & amount', JSON.stringify(inputs), amount);

  const objPaymentMessage = {
    app: 'payment',
    payload_hash: '--------------------------------------------',
    payload_location: 'inline',
    payload: { inputs, outputs: [{ address, amount: 0 }] },
  };

  const objUnit = {
    version: constants.version,
    alt: constants.alt,
    messages: [objMessage, objPaymentMessage],
    authors: [],
    parent_units: lightProps.parent_units,
    last_ball: lightProps.last_stable_mc_ball,
    last_ball_unit: lightProps.last_stable_mc_ball_unit,
    witness_list_unit: lightProps.witness_list_unit,
  };

  let objAuthor = { address, authentifiers: {} };
  if (definition) {
    objAuthor.definition = definition;
  }
  const assocSigningPaths = {};
  const assocLengthsBySigningPaths = { r: 88 };
  const arrSigningPaths = Object.keys(assocLengthsBySigningPaths);
  assocSigningPaths[address] = arrSigningPaths;
  for (let j = 0; j < arrSigningPaths.length; j++) {
    objAuthor.authentifiers[arrSigningPaths[j]] = repeatString('-', assocLengthsBySigningPaths[arrSigningPaths[j]]);
  }
  objUnit.authors.push(objAuthor);

  const headersCommission = objectLength.getHeadersSize(objUnit);
  const payloadCommission = objectLength.getTotalPayloadSize(objUnit);

  objPaymentMessage.payload.outputs[0].amount = amount - headersCommission - payloadCommission;
  objPaymentMessage.payload_hash = objectHash.getBase64Hash(objPaymentMessage.payload);

  objUnit.headers_commission = headersCommission;
  objUnit.payload_commission = payloadCommission;
  objUnit.timestamp = Math.round(Date.now() / 1000);

  const textToSign = objectHash.getUnitHashToSign(objUnit);
  const signature = ecdsaSig.sign(textToSign, privKeyBuf);
  objAuthor = { address, authentifiers: { r: signature } };
  if (definition) {
    objAuthor.definition = definition;
  }
  objUnit.authors = [objAuthor];

  objUnit.messages = [objMessage, objPaymentMessage];
  objUnit.unit = objectHash.getUnitHash(objUnit);

  console.log('Unit', objUnit.unit, objUnit.authors[0].authentifiers.r, objUnit.headers_commission, objUnit.payload_commission);
  console.log(JSON.stringify(objUnit));
  console.log(`https://explorer.byteball.org/#${objUnit.unit}`);

  /** Post joint
   client.request('post_joint', { unit: objUnit }, (err, result) => {
    cb(err, result);
  }); */
};

/** Config start */
const seed = '';
const path = "m/44'/0'/1'/0/0";
/** Config end */

/** Unsafe start */
const mnemonic = new Mnemonic(seed);
const xPrivKey = mnemonic.toHDPrivateKey();
const { privateKey } = xPrivKey.derive(path);
const privKeyBuf = privateKey.bn.toBuffer({ size: 32 });
const pubkey = privateKey.publicKey.toBuffer().toString('base64');
const definition = ['sig', { pubkey }];
const address = objectHash.getChash160(definition);
console.log('Address', address);
/** Unsafe end */

compose('data', { test: 'Hello world!' }, { privKeyBuf, address, definition }, (err, result) => {
  console.log('Compose', err, result);
});
