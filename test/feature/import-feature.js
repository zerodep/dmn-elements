// @ts-check
import * as testHelpers from '../helpers/testHelpers.js';
import { Definition, DecisionError } from 'dmn-elements';

/**
 * @param {string | Buffer} source DMN XML
 * @param {import('#types').EnvironmentOptions} [options] environment options
 */
async function getDefinition(source, options) {
  return new Definition(await testHelpers.context(source, options));
}

Feature('imported definitions', () => {
  Scenario('an input data typed by an imported item definition', () => {
    /** @type {any[]} */
    const resolveCalls = [];

    /** @type {Definition} */
    let definition;
    Given('a definition from the shipment resource with an async resolveImport setting parsing the logistics types', async () => {
      definition = await getDefinition(testHelpers.resource('shipment.dmn'), {
        settings: {
          async resolveImport(/** @type {any} */ importDef) {
            resolveCalls.push(importDef);
            return await testHelpers.moddleContext(testHelpers.resource('logistics-types.dmn'));
          },
        },
      });
    });

    /** @type {any} */
    let result;
    When('the shipping cost is evaluated with the weight as a string', async () => {
      result = await definition.evaluate('shippingCost', { Parcel: { weight: '6', express: false } });
    });

    Then('the imported nested type coerced the weight and the heavy rule matched', () => {
      expect(result).to.equal(25);
    });

    When('the shipping cost is evaluated for an express parcel', async () => {
      result = await definition.evaluate('shippingCost', { Parcel: { weight: 2, express: true } });
    });

    Then('the light express rule matched', () => {
      expect(result).to.equal(20);
    });

    And('the import was resolved once, with the declared import', () => {
      expect(resolveCalls).to.have.length(1);
      expect(resolveCalls[0].name).to.equal('logistics');
      expect(resolveCalls[0].namespace).to.equal('https://example.com/dmn/logistics-types');
      expect(resolveCalls[0].locationURI).to.equal('logistics-types.dmn');
    });

    /** @type {any} */
    let traced;
    When('the shipping cost is traced', async () => {
      traced = await definition.trace('shippingCost', { Parcel: { weight: '6', express: true } });
    });

    Then('the trace evaluated through the imported type as well', () => {
      expect(traced.result).to.equal(40);
      expect(resolveCalls).to.have.length(1);
    });
  });

  Scenario('a referenced import without a resolveImport setting', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the shipment resource without the setting', async () => {
      definition = await getDefinition(testHelpers.resource('shipment.dmn'));
    });

    /** @type {any} */
    let error;
    When('the shipping cost is evaluated', async () => {
      error = await definition.evaluate('shippingCost', { Parcel: { weight: 2, express: false } }).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error requires the resolveImport setting', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/import <logistics> requires a resolveImport environment setting/);
    });
  });

  Scenario('a declared but unreferenced import evaluates without a resolver', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="unusedDefinitions" name="Unused" namespace="https://example.com/dmn/unused">
  <import name="logistics" namespace="https://example.com/dmn/logistics-types" locationURI="logistics-types.dmn" importType="https://www.omg.org/spec/DMN/20191111/MODEL/" />
  <decision id="plain" name="Plain">
    <variable id="plainVariable" name="Plain" />
    <literalExpression id="plainExpression"><text>1 + 1</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition declaring an import that no expression references, without a resolver', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the decision is evaluated', async () => {
      result = await definition.evaluate('plain', {});
    });

    Then('the evaluation completed', () => {
      expect(result).to.equal(2);
    });
  });

  Scenario('a resolveImport that does not resolve the import', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the shipment resource where resolveImport returns nothing', async () => {
      definition = await getDefinition(testHelpers.resource('shipment.dmn'), {
        settings: { async resolveImport() {} },
      });
    });

    /** @type {any} */
    let error;
    When('the shipping cost is traced', async () => {
      error = await definition.trace('shippingCost', { Parcel: { weight: 2, express: false } }).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the unresolved import', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/import <logistics> did not resolve/);
    });
  });

  Scenario('a qualified typeRef without a matching import declaration', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="strayDefinitions" name="Stray" namespace="https://example.com/dmn/stray">
  <inputData id="orderInput" name="Order">
    <variable id="orderVariable" name="Order" typeRef="unknown.tThing" />
  </inputData>
  <decision id="echo" name="Echo">
    <variable id="echoVariable" name="Echo" />
    <informationRequirement id="echoRequiresOrder">
      <requiredInput href="#orderInput" />
    </informationRequirement>
    <literalExpression id="echoExpression"><text>Order</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition where a typeRef is qualified but no import matches the prefix', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the decision is evaluated', async () => {
      result = await definition.evaluate('echo', { Order: 'as is' });
    });

    Then('the unknown type passed the value through untouched', () => {
      expect(result).to.equal('as is');
    });
  });
});
