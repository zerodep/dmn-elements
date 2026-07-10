// @ts-check
import * as testHelpers from '../helpers/testHelpers.js';
import { Context, Definition, DecisionError, Environment, serializeDefinitions } from 'dmn-elements';

/**
 * Precompile: parse at build time, serialize, revive from JSON at runtime —
 * no dmn-moddle involved past the serialize step
 * @param {string} resource resource file name
 * @param {import('#types').EnvironmentOptions} [options] environment options
 */
async function revivedDefinition(resource, options) {
  const definitions = await testHelpers.moddleContext(testHelpers.resource(resource));
  const revived = JSON.parse(serializeDefinitions(definitions));
  return new Definition(new Context(revived, new Environment({ Logger: testHelpers.Logger, ...options })));
}

Feature('precompiled definitions', () => {
  Scenario('definitions serialized to JSON evaluate like the source', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition revived from serialized membership definitions', async () => {
      definition = await revivedDefinition('membership.dmn');
    });

    /** @type {any} */
    let result;
    When('the dependent fee decision is evaluated', async () => {
      result = await definition.evaluate('fee', { Age: 30 });
    });

    Then('the DRG walk produced the fee', () => {
      expect(result).to.equal(100);
    });

    /** @type {any} */
    let traced;
    When('the fee is traced', async () => {
      traced = await definition.trace('fee', { Age: 30 });
    });

    Then('the trace holds the dependency completion order', () => {
      expect(traced.result).to.equal(100);
      expect(traced.trace.map((/** @type {any} */ entry) => entry.id)).to.deep.equal(['category', 'fee']);
    });
  });

  Scenario('every decision logic kind evaluates from revived definitions', () => {
    /** @type {any} */
    let result;
    When('a revived business knowledge model invocation is evaluated', async () => {
      result = await (await revivedDefinition('discount.dmn')).evaluate('price', { Amount: 100 });
    });

    Then('the FEEL function applied', () => {
      expect(result).to.equal(90);
    });

    When('a revived decision service is evaluated', async () => {
      result = await (await revivedDefinition('pricing.dmn')).evaluate('quote', { Amount: 200 });
    });

    Then('the service walked its encapsulated decision', () => {
      expect(result).to.equal(180);
    });

    When('a revived boxed function definition is evaluated', async () => {
      result = await (await revivedDefinition('conversion.dmn')).evaluate('converted', { Price: 125, Rate: 1.25 });
    });

    Then('the context entry function applied', () => {
      expect(result).to.equal(100);
    });
  });

  Scenario('item definitions and imports round-trip', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition revived from serialized applicant definitions', async () => {
      definition = await revivedDefinition('applicant.dmn');
    });

    /** @type {any} */
    let result;
    When('eligibility is evaluated with a coercible structure', async () => {
      result = await definition.evaluate('eligibility', { Applicant: { age: '35', employment: 'employed' } });
    });

    Then('the revived item definitions coerced the components', () => {
      expect(result).to.be.true;
    });

    /** @type {any} */
    let error;
    When('eligibility is evaluated outside the allowed values', async () => {
      error = await definition
        .evaluate('eligibility', { Applicant: { age: 20, employment: 'student' } })
        .catch((/** @type {Error} */ err) => err);
    });

    Then('the revived allowed values still validate', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/violates allowed values of tEmployment/);
    });

    Given('a definition revived from serialized shipment definitions, resolving its import from revived JSON too', async () => {
      definition = await revivedDefinition('shipment.dmn', {
        settings: {
          async resolveImport() {
            const imported = await testHelpers.moddleContext(testHelpers.resource('logistics-types.dmn'));
            return JSON.parse(serializeDefinitions(imported));
          },
        },
      });
    });

    When('the shipping cost is evaluated through the imported type', async () => {
      result = await definition.evaluate('shippingCost', { Parcel: { weight: '6', express: true } });
    });

    Then('the revived import coerced the nested type', () => {
      expect(result).to.equal(40);
    });
  });

  Scenario('the serialized JSON is lean plain data', () => {
    /** @type {string} */
    let serialized;
    Given('serialized dinner definitions', async () => {
      serialized = serializeDefinitions(await testHelpers.moddleContext(testHelpers.resource('dinner.dmn')));
    });

    Then('moddle internals and diagram interchange are gone, element types are kept', () => {
      expect(serialized).to.not.include('dmnDI');
      expect(serialized).to.not.include('$parent');
      expect(serialized).to.not.include('$descriptor');
      const revived = JSON.parse(serialized);
      expect(revived.$type).to.equal('dmn:Definitions');
      expect(revived.drgElement.map((/** @type {any} */ element) => element.$type)).to.include('dmn:Decision');
    });
  });
});
