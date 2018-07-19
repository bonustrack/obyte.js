import { Client as KbyteClient } from 'kbyte';
import api from './api.json';

export default class Client {
  constructor(address) {
    this.client = new KbyteClient(address);
    Object.keys(api).forEach(name => {
      const nameWithCamelCase = name
        .split('/')
        .pop()
        .split('_')
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join('')
        .replace(/^\w/, c => c.toLowerCase());
      this[nameWithCamelCase] = (params, cb) => {
        if (!api[name].params && typeof params === 'function') {
          cb = params; // eslint-disable-line no-param-reassign
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
        return promise.then(result => cb(null, result)).catch(err => cb(err, null));
      };
    });
  }
}
