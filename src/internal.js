export const camelCase = input =>
  input
    .split('/')
    .pop()
    .split('_')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')
    .replace(/^\w/, c => c.toLowerCase());

export const repeatString = (str, times) =>
  str.repeat ? str.repeat(times) : new Array(times + 1).join(str);
