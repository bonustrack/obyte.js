const kbyte = require('kbyte');
const camelCase = require('lodash/camelCase');
const api = require('./api.json');

class Client {
  constructor(address) {
    this.client = new kbyte.Client(address);

    Object.keys(api).forEach((name) => {
      this[camelCase(name)] = (params, cb) => {
        if (!api[name].params && typeof params === 'function') {
          cb = params;
        }
        const promise = new Promise((resolve, reject) => {
          this.client.request(name, api[name].params ? params : null, (err, result) => {
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
  }
}

exports.Client = Client;
