import { utils } from '../src';
import definition from './definition.json';

describe('utils', () => {
  describe('getChash160', () => {
    it('should convert definition to valid address', () => {
      expect(utils.getChash160(definition)).toEqual('5TROF7O466QKXR3N6AUYKYYQ2JCY24EJ');
    });
  });

  describe('toWif', () => {
    it('should convert private key to wif', () => {
      const privKey = 'o3QzctZnfJPw0u8z2Sj6j2gCOvf1L4+CtmSfdy/B4Gk=';
      const privateKey = Buffer.from(privKey, 'base64');
      expect(utils.toWif(privateKey, false)).toEqual(
        '5K4GnuRfVa5YGuCLX988AoRHaQDksx4shW6TzSJm8y6itNhpAqY',
      );
    });
  });

  describe('fromWif', () => {
    it('should convert wif to private key', () => {
      const wif = '5JHx9t7DSSnYwroYbBFodKLDGZggsgfBpaMFok6VMPPMu49UJgA';
      const { privateKey } = utils.fromWif(wif, false);
      // fromWif returns a Uint8Array (works in the browser without a Buffer polyfill)
      expect(privateKey).toBeInstanceOf(Uint8Array);
      expect(Buffer.from(privateKey).toString('base64')).toEqual(
        'PtEd3lkAsTmEhk4eIMrzda1DCDM0WyFellEZBawTZXg=',
      );
    });
  });

  describe('isValidAddress', () => {
    it('should be correctly generated address', () => {
      expect(utils.isValidAddress(utils.getChash160(definition))).toEqual(true);
    });
    it('should be correctly typed address', () => {
      expect(utils.isValidAddress('KSCCYOEMOMUMJXROLK4HWLTJBWFXICRB')).toEqual(true);
    });
    it('should be incorrectly typed address', () => {
      expect(utils.isValidAddress('KSCCYOEMOMUMJXROLK4HWLTJBWFXICR8')).toEqual(false);
    });
  });

  describe('signMessage', () => {
    it('should sign message with private key', () => {
      const privKey = 'o3QzctZnfJPw0u8z2Sj6j2gCOvf1L4+CtmSfdy/B4Gk=';
      const privateKey = Buffer.from(privKey, 'base64');
      const objSignedMessage = utils.signMessage('a', { privateKey, testnet: false });
      const signedMessageJson = JSON.stringify(objSignedMessage);
      const signedMessageBase64 = Buffer.from(signedMessageJson).toString('base64');
      expect(signedMessageBase64).toEqual(
        'eyJ2ZXJzaW9uIjoiNC4wIiwic2lnbmVkX21lc3NhZ2UiOiJhIiwiYXV0aG9ycyI6W3siYWRkcmVzcyI6Iko1R1FDSFFNN1dKR1RJUTI1RkRQUjRRS0RHQ0FESkdUIiwiZGVmaW5pdGlvbiI6WyJzaWciLHsicHVia2V5IjoiQTFGVkY0QTJIcHJSRGxjNlZvYlIxWjBvUEF6NXpaQjdQRk1tazZSVUkwN3kifV0sImF1dGhlbnRpZmllcnMiOnsiciI6ImQ1QkRpSmgwMndIUlYwdGNOWjZpUmkyb2R0cTliNjY3SDVIb2czdFIxVUlNSEJTbHFPMGFxcTVQK2hIU1N0UU02WUFJSklpcXRXWklyT0ttMzFaWVdRPT0ifX1dfQ==',
      );
    });
    it('should sign message with wif in object', () => {
      const wif = '5JHx9t7DSSnYwroYbBFodKLDGZggsgfBpaMFok6VMPPMu49UJgA';
      const objSignedMessage = utils.signMessage('a', { wif, testnet: false });
      const signedMessageJson = JSON.stringify(objSignedMessage);
      const signedMessageBase64 = Buffer.from(signedMessageJson).toString('base64');
      expect(signedMessageBase64).toEqual(
        'eyJ2ZXJzaW9uIjoiNC4wIiwic2lnbmVkX21lc3NhZ2UiOiJhIiwiYXV0aG9ycyI6W3siYWRkcmVzcyI6IldQQkk0UUhaR0o0SEZOQVRPTVBNNDJIREg1UURGSlJXIiwiZGVmaW5pdGlvbiI6WyJzaWciLHsicHVia2V5IjoiQTE5eGZXOVVBTk9saGo5Y0svMTNCZEpDRWdNSjJsSCtpWXZheXYwRlBMYk4ifV0sImF1dGhlbnRpZmllcnMiOnsiciI6IjBjWURwWXZRSm1NUnlQL1N4eFFCRXpDd2VTSWNqN0RTTjVSckR3eFloZFlka2FqYmJwUTlxekN5V0hFVU9NNUFkK085NlY4aWJGakplYUpkcnZ4TzZBPT0ifX1dfQ==',
      );
    });
    it('should sign message with wif as string', () => {
      const wif = '5JHx9t7DSSnYwroYbBFodKLDGZggsgfBpaMFok6VMPPMu49UJgA';
      const objSignedMessage = utils.signMessage('a', wif);
      const signedMessageJson = JSON.stringify(objSignedMessage);
      const signedMessageBase64 = Buffer.from(signedMessageJson).toString('base64');
      expect(signedMessageBase64).toEqual(
        'eyJ2ZXJzaW9uIjoiNC4wIiwic2lnbmVkX21lc3NhZ2UiOiJhIiwiYXV0aG9ycyI6W3siYWRkcmVzcyI6IldQQkk0UUhaR0o0SEZOQVRPTVBNNDJIREg1UURGSlJXIiwiZGVmaW5pdGlvbiI6WyJzaWciLHsicHVia2V5IjoiQTE5eGZXOVVBTk9saGo5Y0svMTNCZEpDRWdNSjJsSCtpWXZheXYwRlBMYk4ifV0sImF1dGhlbnRpZmllcnMiOnsiciI6IjBjWURwWXZRSm1NUnlQL1N4eFFCRXpDd2VTSWNqN0RTTjVSckR3eFloZFlka2FqYmJwUTlxekN5V0hFVU9NNUFkK085NlY4aWJGakplYUpkcnZ4TzZBPT0ifX1dfQ==',
      );
    });
  });

  describe('validateSignedMessage', () => {
    it('should validate signed message', () => {
      const signedMessageBase64 =
        'eyJ2ZXJzaW9uIjoiMy4wIiwic2lnbmVkX21lc3NhZ2UiOiJhIiwiYXV0aG9ycyI6W3siYWRkcmVzcyI6Iko1R1FDSFFNN1dKR1RJUTI1RkRQUjRRS0RHQ0FESkdUIiwiZGVmaW5pdGlvbiI6WyJzaWciLHsicHVia2V5IjoiQTFGVkY0QTJIcHJSRGxjNlZvYlIxWjBvUEF6NXpaQjdQRk1tazZSVUkwN3kifV0sImF1dGhlbnRpZmllcnMiOnsiciI6IkZiNERlbmczWHVuSUZ3TytZM0thZ0pyOUg5MUtMN3c1UUk4aFIwN3hwSkorY3BjU0RZbFQwc25sSXNwNDRJUWJiMURHK2NUdzVYSjljbDRCMGxjNDNRPT0ifX1dfQ==';
      const signedMessageJson = Buffer.from(signedMessageBase64, 'base64').toString('utf8');
      const objSignedMessage = JSON.parse(signedMessageJson);
      expect(
        utils.validateSignedMessage(objSignedMessage, 'J5GQCHQM7WJGTIQ25FDPR4QKDGCADJGT', 'a'),
      ).toEqual(true);
      expect(
        utils.validateSignedMessage(objSignedMessage, 'J5GQCHQM7WJGTIQ25FDPR4QKDGCADJGT'),
      ).toEqual(true);
      expect(utils.validateSignedMessage(objSignedMessage, null, 'a')).toEqual(true);
      expect(utils.validateSignedMessage(objSignedMessage)).toEqual(true);
    });
    it('should not validate signed message', () => {
      const signedMessageBase64 =
        'eyJ2ZXJzaW9uIjoiMy4wIiwic2lnbmVkX21lc3NhZ2UiOiJhIiwiYXV0aG9ycyI6W3siYWRkcmVzcyI6Iko1R1FDSFFNN1dKR1RJUTI1RkRQUjRRS0RHQ0FESkdUIiwiZGVmaW5pdGlvbiI6WyJzaWciLHsicHVia2V5IjoiQTFGVkY0QTJIcHJSRGxjNlZvYlIxWjBvUEF6NXpaQjdQRk1tazZSVUkwN3kifV0sImF1dGhlbnRpZmllcnMiOnsiciI6IkZiNERlbmczWHVuSUZ3TytZM0thZ0pyOUg5MUtMN3c1UUk4aFIwN3hwSkorY3BjU0RZbFQwc25sSXNwNDRJUWJiMURHK2NUdzVYSjljbDRCMGxjNDNRPT0ifX1dfQ==';
      const signedMessageJson = Buffer.from(signedMessageBase64, 'base64').toString('utf8');
      const objSignedMessage = JSON.parse(signedMessageJson);
      expect(
        utils.validateSignedMessage(objSignedMessage, 'KSCCYOEMOMUMJXROLK4HWLTJBWFXICRB', 'a'),
      ).toEqual(false);
      expect(
        utils.validateSignedMessage(objSignedMessage, 'KSCCYOEMOMUMJXROLK4HWLTJBWFXICRB'),
      ).toEqual(false);
      expect(utils.validateSignedMessage(objSignedMessage, null, 'b')).toEqual(false);
    });
    it('should not validate signed message without definition', () => {
      const signedMessageBase64 =
        'eyJ2ZXJzaW9uIjoiMy4wIiwic2lnbmVkX21lc3NhZ2UiOiJhIiwiYXV0aG9ycyI6W3siYWRkcmVzcyI6Iko1R1FDSFFNN1dKR1RJUTI1RkRQUjRRS0RHQ0FESkdUIiwiYXV0aGVudGlmaWVycyI6eyJyIjoiRmI0RGVuZzNYdW5JRndPK1kzS2FnSnI5SDkxS0w3dzVRSThoUjA3eHBKSitjcGNTRFlsVDBzbmxJc3A0NElRYmIxREcrY1R3NVhKOWNsNEIwbGM0M1E9PSJ9fV19';
      const signedMessageJson = Buffer.from(signedMessageBase64, 'base64').toString('utf8');
      const objSignedMessage = JSON.parse(signedMessageJson);
      expect(
        utils.validateSignedMessage(objSignedMessage, 'J5GQCHQM7WJGTIQ25FDPR4QKDGCADJGT', 'a'),
      ).toEqual(false);
    });
    it('should not validate signed message without authentifiers', () => {
      const signedMessageBase64 =
        'eyJ2ZXJzaW9uIjoiMy4wIiwic2lnbmVkX21lc3NhZ2UiOiJhIiwiYXV0aG9ycyI6W3siYWRkcmVzcyI6Iko1R1FDSFFNN1dKR1RJUTI1RkRQUjRRS0RHQ0FESkdUIiwiZGVmaW5pdGlvbiI6WyJzaWciLHsicHVia2V5IjoiQTFGVkY0QTJIcHJSRGxjNlZvYlIxWjBvUEF6NXpaQjdQRk1tazZSVUkwN3kifV0sImF1dGhlbnRpZmllcnMiOnt9fV19===';
      const signedMessageJson = Buffer.from(signedMessageBase64, 'base64').toString('utf8');
      const objSignedMessage = JSON.parse(signedMessageJson);
      expect(
        utils.validateSignedMessage(objSignedMessage, 'J5GQCHQM7WJGTIQ25FDPR4QKDGCADJGT', 'a'),
      ).toEqual(false);
    });
    it('should not validate signed message without authors', () => {
      const signedMessageBase64 = 'eyJ2ZXJzaW9uIjoiMy4wIiwic2lnbmVkX21lc3NhZ2UiOiJhIn0=';
      const signedMessageJson = Buffer.from(signedMessageBase64, 'base64').toString('utf8');
      const objSignedMessage = JSON.parse(signedMessageJson);
      expect(
        utils.validateSignedMessage(objSignedMessage, 'J5GQCHQM7WJGTIQ25FDPR4QKDGCADJGT', 'a'),
      ).toEqual(false);
    });
    it('validates a freshly signed 4.0 message (roundtrip)', () => {
      const wif = '5JHx9t7DSSnYwroYbBFodKLDGZggsgfBpaMFok6VMPPMu49UJgA';
      const objSignedMessage = utils.signMessage('hello', { wif });
      expect(objSignedMessage.version).toEqual('4.0');
      expect(
        utils.validateSignedMessage(objSignedMessage, objSignedMessage.authors[0].address, 'hello'),
      ).toEqual(true);
    });
    it('rejects versions outside the ocore supported list', () => {
      const wif = '5JHx9t7DSSnYwroYbBFodKLDGZggsgfBpaMFok6VMPPMu49UJgA';
      const objSignedMessage = utils.signMessage('hello', { wif });
      objSignedMessage.version = '5.0';
      expect(utils.validateSignedMessage(objSignedMessage)).toEqual(false);
    });
    it('should return false (not throw) for non-object input', () => {
      expect(utils.validateSignedMessage(null)).toEqual(false);
      expect(utils.validateSignedMessage(undefined)).toEqual(false);
      expect(utils.validateSignedMessage('not an object')).toEqual(false);
      expect(utils.validateSignedMessage(42)).toEqual(false);
      expect(utils.validateSignedMessage([])).toEqual(false);
    });
  });
});
