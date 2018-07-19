module.exports = {
  extends: ['airbnb-base', 'prettier'],
  plugins: ['prettier'],
  env: {
    node: true,
    browser: true,
    jest: true,
  },
  rules: {
    'prettier/prettier': 'error',
  },
};
