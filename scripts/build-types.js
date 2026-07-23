import { createBundle } from 'dts-buddy';

createBundle({
  project: 'tsconfig.json',
  output: 'types/index.d.ts',
  modules: {
    'dmn-elements': 'src/index.js',
    'dmn-elements/errors': 'src/error/Errors.js',
    'dmn-elements/dmn-moddle': 'src/dmnModdle.js',
  },
}).catch((err) => {
  process.exitCode = 1;
  // eslint-disable-next-line no-console
  console.error(err);
});
