/**
 * Hashing conformance against real mainnet units of every protocol version.
 * The fixtures in units.fixtures.json are actual joints fetched from a hub
 * (v1 = genesis unit); getUnitHash must reproduce their unit ids exactly.
 * If units.fixtures.json is missing, rebuild it: node test/regenerate-fixtures.js
 */
import {
  getUnitHash,
  getBase64Hash,
  getSourceString,
  getJsonSourceString,
} from '../src/internal';
import fixtures from './units.fixtures.json';

describe('getUnitHash on real mainnet units', () => {
  Object.keys(fixtures).forEach((label) => {
    const { expected_unit: expectedUnit, unit } = fixtures[label];

    it(`reproduces the ${label} unit hash (version ${unit.version})`, () => {
      expect(getUnitHash(unit)).toEqual(expectedUnit);
    });

    it(`reproduces the ${label} inline payload hashes`, () => {
      const bJsonBased = unit.version !== '1.0';
      unit.messages.forEach((message) => {
        if (message.payload_location === 'inline' && message.payload !== undefined) {
          expect(getBase64Hash(message.payload, bJsonBased)).toEqual(message.payload_hash);
        }
      });
    });
  });
});

describe('getJsonSourceString (ocore string_utils conformance)', () => {
  it('escapes surrogate pairs like ocore toWellFormedJsonStringify', () => {
    // ocore escapes EVERY surrogate code unit, even valid pairs like emoji
    expect(getJsonSourceString('\u{1F600}')).toEqual('"\\ud83d\\ude00"');
    expect(getJsonSourceString({ text: 'hi \u{1F600}' })).toEqual('{"text":"hi \\ud83d\\ude00"}');
  });

  it('escapes lone surrogates', () => {
    expect(getJsonSourceString('\ud800')).toEqual('"\\ud800"');
  });

  it('escapes surrogates in object keys', () => {
    expect(getJsonSourceString({ 'k\u{1F600}': 1 })).toEqual('{"k\\ud83d\\ude00":1}');
  });

  it('throws on non-finite numbers', () => {
    expect(() => getJsonSourceString({ n: Infinity })).toThrow('invalid number');
    expect(() => getJsonSourceString({ n: NaN })).toThrow('invalid number');
  });

  it('stringifies plain objects with sorted keys', () => {
    expect(getJsonSourceString({ b: 'x', a: 1, c: true })).toEqual('{"a":1,"b":"x","c":true}');
  });
});

describe('getSourceString (ocore string_utils conformance)', () => {
  it('throws on 00 bytes in string values', () => {
    expect(() => getSourceString('a\u0000b')).toThrow('00 byte in string value');
    expect(() => getSourceString({ k: 'a\u0000b' })).toThrow('00 byte in string value');
  });

  it('throws on 00 bytes in object keys', () => {
    expect(() => getSourceString({ 'a\u0000b': 1 })).toThrow('00 byte in object key');
  });

  it('throws on non-finite numbers', () => {
    expect(() => getSourceString({ n: Infinity })).toThrow('invalid number');
    expect(() => getSourceString({ n: NaN })).toThrow('invalid number');
  });
});
