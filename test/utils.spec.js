import { getChash160 } from '../src/utils';
import definition from './definition.json';

describe('utils', () => {
  describe('getChash160', () => {
    it('should convert definition to valid address', () => {
      expect(getChash160(definition)).toEqual('5TROF7O466QKXR3N6AUYKYYQ2JCY24EJ');
    });
  });
});
