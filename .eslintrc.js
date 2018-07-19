module.exports = {
  extends: ['airbnb-base', 'prettier'],
  plugins: ['prettier'],
  env: {
    node: true,
    browser: true,
    jest: true,
  },
  rules: {
    'no-console': 'off',
    'prettier/prettier': 'error',
  },
};
