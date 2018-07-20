import { camelCase, repeatString } from '../src/internal';

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
});
