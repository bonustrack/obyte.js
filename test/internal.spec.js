import crypto from 'crypto';
import { camelCase, repeatString, sortOutputs, mapAPI, sign, toPublicKey } from '../src/internal';

describe('internal', () => {
  describe('camelCase', () => {
    it('should convert method names', () => {
      expect(camelCase('load')).toEqual('load');
      expect(camelCase('get_something')).toEqual('getSomething');
      expect(camelCase('get_something_else')).toEqual('getSomethingElse');
    });

    it('should handle method names with prefix', () => {
      expect(camelCase('light/load')).toEqual('load');
      expect(camelCase('hub/get_interesting_data')).toEqual('getInterestingData');
    });
  });

  describe('repeatString', () => {
    it('should repeat string', () => {
      expect(repeatString('hey', 1)).toEqual('hey');
      expect(repeatString('hello', 3)).toEqual('hellohellohello');

      expect(repeatString(5, 2)).toEqual('55');
    });
  });

  describe('sortOutputs', () => {
    it('should sort outputs by address', () => {
      let actual = sortOutputs(
        {
          address: 'KSCCYOEMOMUMJXROLK4HWLTJBWFXICRB',
          amount: 21542,
        },
        {
          address: 'ULQA63NGEZACP4N7ZMBUBISH6ZTCUS2Q',
          amount: 6612,
        },
      );

      expect(actual).toEqual(-1);

      actual = sortOutputs(
        {
          address: 'ULQA63NGEZACP4N7ZMBUBISH6ZTCUS2Q',
          amount: 21542,
        },
        {
          address: 'NX2BTV43XN6BOTCYZUUFU6TK7DVOC4LU',
          amount: 6612,
        },
      );

      expect(actual).toEqual(1);
    });

    it('should sort outputs by amount if addresses are the same', () => {
      let actual = sortOutputs(
        {
          address: 'KSCCYOEMOMUMJXROLK4HWLTJBWFXICRB',
          amount: 21542,
        },
        {
          address: 'KSCCYOEMOMUMJXROLK4HWLTJBWFXICRB',
          amount: 6612,
        },
      );

      expect(actual).toEqual(14930);

      actual = sortOutputs(
        {
          address: 'KSCCYOEMOMUMJXROLK4HWLTJBWFXICRB',
          amount: 21542,
        },
        {
          address: 'KSCCYOEMOMUMJXROLK4HWLTJBWFXICRB',
          amount: 42555,
        },
      );

      expect(actual).toEqual(-21013);
    });

    it('should detect equal payments', () => {
      const actual = sortOutputs(
        {
          address: 'KSCCYOEMOMUMJXROLK4HWLTJBWFXICRB',
          amount: 21542,
        },
        {
          address: 'KSCCYOEMOMUMJXROLK4HWLTJBWFXICRB',
          amount: 21542,
        },
      );

      expect(actual).toEqual(0);
    });
  });

  describe('should map API', () => {
    const mock = jest.fn().mockReturnValue(Promise.resolve());

    const api = {
      get_witnesses: {},
      get_joint: {
        params: 'string',
      },
    };

    const mappedAPI = mapAPI(api, mock);

    mappedAPI.getWitnesses();
    expect(mock).toHaveBeenCalledWith('get_witnesses');

    mock.mockClear();

    mappedAPI.getJoint('oj8yEksX9Ubq7lLc+p6F2uyHUuynugeVq4+ikT67X6E=');
    expect(mock).toHaveBeenCalledWith('get_joint', 'oj8yEksX9Ubq7lLc+p6F2uyHUuynugeVq4+ikT67X6E=');

    mock.mockClear();

    mappedAPI.getJoint('oj8yEksX9Ubq7lLc+p6F2uyHUuynugeVq4+ikT67X6E=', 'auth');
    expect(mock).toHaveBeenCalledWith(
      'get_joint',
      'oj8yEksX9Ubq7lLc+p6F2uyHUuynugeVq4+ikT67X6E=',
      'auth',
    );
  });

  describe('sign', () => {
    const privKey = 'o3QzctZnfJPw0u8z2Sj6j2gCOvf1L4+CtmSfdy/B4Gk=';
    const privKeyBuf = Buffer.from(privKey, 'base64');
    const hash = crypto.createHash('sha256').update('hello world', 'utf8').digest();

    it('should create valid signature', () => {
      expect(sign(hash, privKeyBuf)).toEqual('ssCl6equnJZGgKzTSJqsRr3tDN8BzmriGdMYPrVHyhYy+E/KV6/cA+sYX5i7TJ9voYpfd23EAFAYQoGy905Jgg==');
    });
  });

  describe('toPublicKey', () => {
    const privKey = 'PtEd3lkAsTmEhk4eIMrzda1DCDM0WyFellEZBawTZXg=';
    const privKeyBuf = Buffer.from(privKey, 'base64');

    it('should convert privKeyBuf to valid public key', () => {
      expect(toPublicKey(privKeyBuf)).toEqual('A19xfW9UANOlhj9cK/13BdJCEgMJ2lH+iYvayv0FPLbN');
    });
  });
});
