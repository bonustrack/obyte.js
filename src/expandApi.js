import utils from './utils';

async function getSymbolByAsset(tokenRegistryAddress, asset) {
  if (asset === null || asset === 'base') {
    return 'GBYTE';
  }
  if (typeof asset !== 'string') {
    return null;
  }

  if (!utils.isValidAddress(tokenRegistryAddress)) {
    return null;
  }

  const aaStateVars = await this.getAaStateVars({ address: tokenRegistryAddress });

  if (`a2s_${asset}` in aaStateVars) {
    return aaStateVars[`a2s_${asset}`];
  }
  return asset.replace(/[+=]/, '').substr(0, 6);
}

async function getAssetBySymbol(tokenRegistryAddress, symbol) {
  if (typeof symbol !== 'string') {
    return null;
  }

  if (symbol === 'GBYTE' || symbol === 'MBYTE' || symbol === 'KBYTE' || symbol === 'BYTE') {
    return null;
  }

  if (!utils.isValidAddress(tokenRegistryAddress)) {
    return null;
  }

  const aaStateVars = await this.getAaStateVars({ address: tokenRegistryAddress });

  if (`s2a_${symbol}` in aaStateVars) {
    return aaStateVars[`s2a_${symbol}`];
  }
  return null;
}

export default { getSymbolByAsset, getAssetBySymbol };
