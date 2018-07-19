import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
import globals from 'rollup-plugin-node-globals';
import builtins from 'rollup-plugin-node-builtins';

const input = 'src/index.js';
const resolveConfig = {
  preferBuiltins: false,
};

export default [
  {
    input,
    plugins: [resolve(resolveConfig), commonjs(), json(), globals(), builtins()],
    output: {
      file: 'lib/byteball.js',
      format: 'cjs',
    },
  },
  {
    input,
    plugins: [resolve(resolveConfig), commonjs(), json(), globals(), builtins()],
    output: {
      file: 'lib/byteball.min.js',
      name: 'Byteball',
      format: 'iife',
    },
  },
];
