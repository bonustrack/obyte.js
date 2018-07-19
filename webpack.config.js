/* global __dirname, require, module */
const path = require('path');
const { env } = require('yargs').argv;
const pkg = require('./package.json');

const libraryName = pkg.name;

const outputFile = env === 'build' ? `${libraryName}.min.js` : `${libraryName}.js`;

const config = {
  mode: env === 'build' ? 'production' : 'development',
  entry: path.resolve(__dirname, './src/index.js'),
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, './lib'),
    filename: outputFile,
    library: libraryName,
    libraryTarget: 'umd',
    umdNamedDefine: true,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      },
    ],
  },
};

module.exports = config;
