import Mnemonic from 'bitcore-mnemonic';

const generateRandomSeed = () => {
  let mnemonic = new Mnemonic();
  while (!Mnemonic.isValid(mnemonic.toString())) {
    mnemonic = new Mnemonic();
  }
  return mnemonic.phrase;
};

function isSeedValid(seed) {
  // isValid will throw if one of those is not satisfied.
  if (typeof seed !== 'string' || seed.split(' ').length !== 12) return false;

  return Mnemonic.isValid(seed);
}

export default { generateRandomSeed, isSeedValid };
