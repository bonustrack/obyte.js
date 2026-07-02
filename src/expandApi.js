import utils from './utils';
import { withDefaultRegistry } from './internal';
import { OFFICIAL_TOKEN_REGISTRY_ADDRESS } from './constants';

function getOfficialTokenRegistryAddress() {
  return OFFICIAL_TOKEN_REGISTRY_ADDRESS;
}

async function getSymbolByAsset(registryOrAsset, maybeAsset) {
  const [tokenRegistryAddress, asset] = withDefaultRegistry(registryOrAsset, maybeAsset);
  if (asset === null || asset === 'base') {
    return 'GBYTE';
  }
  if (typeof asset !== 'string') {
    return null;
  }

  if (!utils.isValidAddress(tokenRegistryAddress)) {
    return null;
  }

  const aaStateVars = await this.getAaStateVars({
    address: tokenRegistryAddress,
    var_prefix: `a2s_${asset}`,
  });

  if (`a2s_${asset}` in aaStateVars) {
    return aaStateVars[`a2s_${asset}`];
  }
  return asset.replace(/[+=]/g, '').substr(0, 6);
}

async function getAssetBySymbol(registryOrSymbol, maybeSymbol) {
  const [tokenRegistryAddress, symbol] = withDefaultRegistry(registryOrSymbol, maybeSymbol);
  if (typeof symbol !== 'string') {
    return null;
  }

  if (symbol === 'GBYTE' || symbol === 'MBYTE' || symbol === 'KBYTE' || symbol === 'BYTE') {
    return 'base';
  }

  if (!utils.isValidAddress(tokenRegistryAddress)) {
    return null;
  }

  const aaStateVars = await this.getAaStateVars({
    address: tokenRegistryAddress,
    var_prefix: `s2a_${symbol}`,
  });

  if (`s2a_${symbol}` in aaStateVars) {
    return aaStateVars[`s2a_${symbol}`];
  }
  return null;
}

async function getDecimalsBySymbolOrAsset(registryOrValue, maybeValue) {
  const [tokenRegistryAddress, symbolOrAsset] = withDefaultRegistry(registryOrValue, maybeValue);
  if (!utils.isValidAddress(tokenRegistryAddress)) {
    throw Error('Not valid tokenRegistryAddress');
  }

  if (!symbolOrAsset) throw Error('symbolOrAsset is undefined');

  if (typeof symbolOrAsset !== 'string') throw Error('not valid symbolOrAsset');

  if (symbolOrAsset === 'base' || symbolOrAsset === 'GBYTE') {
    return 9;
  }

  let asset;

  if (symbolOrAsset.length === 44) {
    asset = symbolOrAsset;
  } else if (symbolOrAsset === symbolOrAsset.toUpperCase()) {
    const aaStateVarsWithPrefix = await this.getAaStateVars({
      address: tokenRegistryAddress,
      var_prefix: `s2a_${symbolOrAsset}`,
    });

    if (!(`s2a_${symbolOrAsset}` in aaStateVarsWithPrefix)) {
      throw Error(`no such symbol ${symbolOrAsset}`);
    }

    asset = aaStateVarsWithPrefix[`s2a_${symbolOrAsset}`];
  } else {
    throw Error('not valid symbolOrAsset');
  }

  const aaStateVarsWithPrefix = await this.getAaStateVars({
    address: tokenRegistryAddress,
    var_prefix: `current_desc_${asset}`,
  });

  if (!(`current_desc_${asset}` in aaStateVarsWithPrefix)) {
    throw Error(`no decimals for ${symbolOrAsset}`);
  }

  const descHash = aaStateVarsWithPrefix[`current_desc_${asset}`];

  const decimalsStateVar = await this.getAaStateVars({
    address: tokenRegistryAddress,
    var_prefix: `decimals_${descHash}`,
  });

  const decimals = decimalsStateVar[`decimals_${descHash}`];

  if (typeof decimals !== 'number') {
    throw Error(`no decimals for ${symbolOrAsset}`);
  } else {
    return decimals;
  }
}

export default {
  getSymbolByAsset,
  getAssetBySymbol,
  getOfficialTokenRegistryAddress,
  getDecimalsBySymbolOrAsset,
};
