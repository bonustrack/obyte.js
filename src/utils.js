import Mnemonic from 'bitcore-mnemonic';

const generateRandomSeed = () => {
  let mnemonic = new Mnemonic();
  while (!Mnemonic.isValid(mnemonic.toString())) {
    mnemonic = new Mnemonic();
  }
  return mnemonic.phrase;
};

const isSeedValid = seed => Mnemonic.isValid(seed);

export {
  generateRandomSeed,
  isSeedValid,
};
