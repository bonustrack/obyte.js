const kbyte = require('kbyte');
const camelCase = require('lodash/camelCase');
const api = require('./api.json');

const client = new kbyte.Client('wss://byteball.org/bb');
const bb = class Client {};

Object.keys(api).forEach((name) => {
  bb[camelCase(name)] = (params, cb) => {
    if (!api[name].params && typeof params === 'function') {
      cb = params;
    }
    const promise = new Promise((resolve, reject) => {
      client.request(name, api[name].params ? params : null, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
    if (!cb) return promise;
    return promise
      .then(result => cb(null, result))
      .catch(err => cb(err, null));
  };
});

bb.getJoint('QUsS+EhZILpetbOPrkILsR4UTEd4IP9vxoTOY4vYUBg=', (err, result) => {
  console.log(1, err, JSON.stringify(result));
});

bb.getJoint('QUsS+EhZILpetbOPrkILsR4UTEd4IP9vxoTOY4vYUBg=').then((result) => {
  console.log(2, JSON.stringify(result));
}).catch((err) => {
  console.log(2, err);
});

bb.hubGetBots((err, result) => {
  console.log(3, err, JSON.stringify(result));
});

bb.hubGetBots().then((result) => {
  console.log(4, JSON.stringify(result));
}).catch((err) => {
  console.log(4, err);
});

bb.hubGetBots(null, (err, result) => {
  console.log(5, err, JSON.stringify(result));
});

bb.hubGetBots(null).then((result) => {
  console.log(6, JSON.stringify(result));
}).catch((err) => {
  console.log(6, err);
});

bb.lightGetAttestations({ address: 'ULQA63NGEZACP4N7ZMBUBISH6ZTCUS2Q' }, (err, result) => {
  console.log(7, err, JSON.stringify(result));
});
