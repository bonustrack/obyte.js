import { camelCase, repeatString, mapAPI } from '../src/internal';

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

  describe('should map API', () => {
    const mock = jest.fn().mockReturnValue(Promise.resolve());

    const api = {
      get_witnesses: {},
      get_joint: {
        params: 'string',
      },
    };

    const mappedAPI = mapAPI(api, (name, params) => mock(name, params));

    mappedAPI.getWitnesses();
    expect(mock).toHaveBeenCalledWith('get_witnesses', null);

    mock.mockClear();

    mappedAPI.getJoint('oj8yEksX9Ubq7lLc+p6F2uyHUuynugeVq4+ikT67X6E=');
    expect(mock).toHaveBeenCalledWith('get_joint', 'oj8yEksX9Ubq7lLc+p6F2uyHUuynugeVq4+ikT67X6E=');
  });
});
