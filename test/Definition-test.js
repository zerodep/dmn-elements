import { Definition } from 'dmn-elements';
import * as testHelpers from './helpers/testHelpers.js';

describe('Definition', () => {
  describe('ctor', () => {
    it('works without new', async () => {
      const context = await testHelpers.context(testHelpers.resource('dinner.dmn'));
      // @ts-ignore intentional call without new
      const definition = Definition(context);
      expect(definition).to.be.instanceof(Definition);
      expect(definition.context).to.equal(context);
    });
  });
});
