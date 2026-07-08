/**
 * Builds the CJS distribution. `preserveModules` keeps the dist/ tree mirroring src/
 * so package.json subpath exports (./errors) resolve without extra entries.
 */
export default {
  input: ['src/index.js', 'src/error/Errors.js'],
  external: ['feelin'],
  plugins: [
    {
      // package "type" is module, so dist needs its own package.json to be treated as commonjs
      name: 'emit-cjs-package-type',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'package.json', source: '{\n  "type": "commonjs"\n}\n' });
      },
    },
  ],
  output: {
    dir: 'dist',
    format: 'cjs',
    exports: 'named',
    preserveModules: true,
    preserveModulesRoot: 'src',
  },
};
