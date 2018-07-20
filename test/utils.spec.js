import { utils } from '..';

describe('utils', () => {
  describe('isSeedValid', () => {
    it('should return true for valid seeds', () => {
      const seeds = [
        'erupt reveal wolf usual water case wash obey joke maximum cloth quality',
        'parent cruise female dinosaur orphan inhale future torch injury uphold loyal shoe',
        'neck pond powder rude refuse vehicle broken security wish meadow dilemma glare',
      ];

      for (let seed of seeds) {
        expect(utils.isSeedValid(seed)).toBe(true);
      }
    });

    it('should return false for invalid seeds', () => {
      const seeds = [
        {},
        521521,
        'hello world',
        'parent cruise female dinosaur orphan inhale dyskietka torch injury uphold loyal shoe',
        'neck pond neck rude refuse vehicle broken security wish meadow dilemma glare',
      ];

      for (let seed of seeds) {
        expect(utils.isSeedValid(seed)).toBe(false);
      }
    });
  });

  describe('generateRandomSeed', () => {
    it('should generate valid seed', () => {
      const seed = utils.generateRandomSeed();
      expect(utils.isSeedValid(seed)).toBe(true);
    });
  });
});
