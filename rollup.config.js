import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default [
  {
    input: './build/es6/index.js',
    output: [
      {
        file: './dist/dat-shared-doc.cjs.js',
        format: 'cjs',
        sourcemap: true,
      },
    ],
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: true,
      }),
      commonjs(),
    ],
  }
];