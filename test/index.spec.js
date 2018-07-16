/* global describe, it, before */

import chai from 'chai';
import { Client, utils } from '../lib/byteball.js';

chai.expect();
const expect = chai.expect;
let lib;

describe('Given an instance of my Dog library', () => {
  before(() => {
    lib = utils;
  });
  describe('when I need the name', () => {
    it('should return the name', () => {
      expect('Dog').to.be.equal('Dog');
    });
  });
});

const client = new Client('wss://byteball.org/bb');

client.getJoint('QUsS+EhZILpetbOPrkILsR4UTEd4IP9vxoTOY4vYUBg=').then((result) => {
  console.log(2, JSON.stringify(result));
}).catch((err) => {
  console.log(2, err);
});

client.getJoint('123465', (err, result) => {
  console.log(1, err, JSON.stringify(result));
});

client.hubGetBots((err, result) => {
  console.log(3, err, JSON.stringify(result));
});

client.hubGetBots().then((result) => {
  console.log(4, JSON.stringify(result));
}).catch((err) => {
  console.log(4, err);
});

client.hubGetBots(null, (err, result) => {
  console.log(5, err, JSON.stringify(result));
});

client.hubGetBots(null).then((result) => {
  console.log(6, JSON.stringify(result));
}).catch((err) => {
  console.log(6, err);
});

client.lightGetAttestations({ address: 'NX2BTV43XN6BOTCYZUUFU6TK7DVOC4LU' }, (err, result) => {
  console.log(7, err, JSON.stringify(result));
});

client.lightGetAttestation({
  attestor_address: 'JEDZYC2HMGDBIDQKG3XSTXUSHMCBK725',
  field: 'steem_username',
  value: 'sekhmet',
}, (err, result) => {
  console.log(8, err, JSON.stringify(result));
});

