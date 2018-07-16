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
