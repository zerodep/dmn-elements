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

  Scenario('a decision requiring an imported decision', () => {
    const greetingSource = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="greetingDefinitions" name="Greeting" namespace="https://example.com/dmn/greeting">
  <inputData id="nameInput" name="Name">
    <variable id="nameVariable" name="Name" typeRef="string" />
  </inputData>
  <decision id="greeting" name="Greeting">
    <variable id="greetingVariable" name="Greeting" typeRef="string" />
    <informationRequirement id="greetingRequiresName">
      <requiredInput href="#nameInput" />
    </informationRequirement>
    <literalExpression id="greetingExpression"><text>"Hello " + Name</text></literalExpression>
  </decision>
</definitions>`;

    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="welcomeDefinitions" name="Welcome" namespace="https://example.com/dmn/welcome">
  <import name="common" namespace="https://example.com/dmn/greeting" locationURI="greeting.dmn" importType="https://www.omg.org/spec/DMN/20191111/MODEL/" />
  <decision id="welcome" name="Welcome">
    <variable id="welcomeVariable" name="Welcome" typeRef="string" />
    <informationRequirement id="welcomeRequiresGreeting">
      <requiredDecision href="https://example.com/dmn/greeting#greeting" />
    </informationRequirement>
    <literalExpression id="welcomeExpression"><text>common.Greeting + "!"</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition importing a model and requiring its decision across models', async () => {
      definition = await getDefinition(source, {
        settings: {
          async resolveImport() {
            return await testHelpers.moddleContext(greetingSource);
          },
        },
      });
    });

    /** @type {any} */
    let result;
    When('the welcome is evaluated with the imported input data value supplied flat', async () => {
      result = await definition.evaluate('welcome', { Name: 'Pål' });
    });

    Then('the imported decision evaluated in its own model and bound under the import name', () => {
      expect(result).to.equal('Hello Pål!');
    });

    /** @type {any} */
    let traced;
    When('the welcome is traced', async () => {
      traced = await definition.trace('welcome', { Name: 'Pål' });
    });

    Then('the trace binds the imported decision under its qualified name', () => {
      const entry = traced.trace.find((/** @type {any} */ e) => e.id === 'welcome');
      expect(entry.requirements[0]).to.deep.include({ required: 'greeting', bound: 'common.Greeting', value: 'Hello Pål' });
    });
  });

  Scenario('a decision requiring an imported business knowledge model', () => {
    const librarySource = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="libraryDefinitions" name="Library" namespace="https://example.com/dmn/library">
  <businessKnowledgeModel id="addTen" name="Add ten">
    <variable id="addTenVariable" name="Add ten" />
    <encapsulatedLogic id="addTenLogic">
      <formalParameter id="baseParameter" name="base" typeRef="number" />
      <literalExpression id="addTenBody"><text>base + 10</text></literalExpression>
    </encapsulatedLogic>
  </businessKnowledgeModel>
</definitions>`;

    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="sumDefinitions" name="Sum" namespace="https://example.com/dmn/sum">
  <import name="lib" namespace="https://example.com/dmn/library" locationURI="library.dmn" importType="https://www.omg.org/spec/DMN/20191111/MODEL/" />
  <decision id="total" name="Total">
    <variable id="totalVariable" name="Total" typeRef="number" />
    <knowledgeRequirement id="totalRequiresAddTen">
      <requiredKnowledge href="https://example.com/dmn/library#addTen" />
    </knowledgeRequirement>
    <literalExpression id="totalExpression"><text>lib.Add ten(5)</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition importing a knowledge library', async () => {
      definition = await getDefinition(source, {
        settings: {
          async resolveImport() {
            return await testHelpers.moddleContext(librarySource);
          },
        },
      });
    });

    /** @type {any} */
    let result;
    When('the total is evaluated', async () => {
      result = await definition.evaluate('total', {});
    });

    Then('the imported knowledge model was invoked through its qualified name', () => {
      expect(result).to.equal(15);
    });
  });

  Scenario('nested imports with colliding element ids', () => {
    // models B and C both hold a decision with id "shared" — memoization must be per model (TCK 0089 shape)
    const modelC = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="cDefinitions" name="C" namespace="https://example.com/dmn/model-c">
  <decision id="shared" name="C Value">
    <variable id="cValueVariable" name="C Value" typeRef="string" />
    <literalExpression id="cValueExpression"><text>"c"</text></literalExpression>
  </decision>
</definitions>`;

    const modelB = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="bDefinitions" name="B" namespace="https://example.com/dmn/model-b">
  <import name="c" namespace="https://example.com/dmn/model-c" locationURI="model-c.dmn" importType="https://www.omg.org/spec/DMN/20191111/MODEL/" />
  <decision id="shared" name="B Value">
    <variable id="bValueVariable" name="B Value" typeRef="string" />
    <informationRequirement id="bRequiresC">
      <requiredDecision href="https://example.com/dmn/model-c#shared" />
    </informationRequirement>
    <literalExpression id="bValueExpression"><text>"b" + c.C Value</text></literalExpression>
  </decision>
</definitions>`;

    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="aDefinitions" name="A" namespace="https://example.com/dmn/model-a">
  <import name="b" namespace="https://example.com/dmn/model-b" locationURI="model-b.dmn" importType="https://www.omg.org/spec/DMN/20191111/MODEL/" />
  <import name="c direct" namespace="https://example.com/dmn/model-c" locationURI="model-c.dmn" importType="https://www.omg.org/spec/DMN/20191111/MODEL/" />
  <decision id="combined" name="Combined">
    <variable id="combinedVariable" name="Combined" typeRef="string" />
    <informationRequirement id="combinedRequiresB">
      <requiredDecision href="https://example.com/dmn/model-b#shared" />
    </informationRequirement>
    <informationRequirement id="combinedRequiresC">
      <requiredDecision href="https://example.com/dmn/model-c#shared" />
    </informationRequirement>
    <literalExpression id="combinedExpression"><text>b.B Value + "-" + c direct.C Value</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition importing a model that itself imports another, with colliding decision ids', async () => {
      const models = new Map([
        ['https://example.com/dmn/model-b', modelB],
        ['https://example.com/dmn/model-c', modelC],
      ]);
      definition = await getDefinition(source, {
        settings: {
          async resolveImport(/** @type {any} */ importDef) {
            return await testHelpers.moddleContext(/** @type {string} */ (models.get(importDef.namespace)));
          },
        },
      });
    });

    /** @type {any} */
    let result;
    When('the combined decision is evaluated', async () => {
      result = await definition.evaluate('combined', {});
    });

    Then('each model evaluated its own decision despite the id collision', () => {
      expect(result).to.equal('bc-c');
    });
  });

  Scenario('a requirement href into an undeclared namespace', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="strayRefDefinitions" name="Stray ref" namespace="https://example.com/dmn/stray-ref">
  <decision id="lost" name="Lost">
    <variable id="lostVariable" name="Lost" />
    <informationRequirement id="lostRequiresElsewhere">
      <requiredDecision href="https://example.com/dmn/undeclared#someDecision" />
    </informationRequirement>
    <literalExpression id="lostExpression"><text>1</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition with a requirement href whose namespace no import declares', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let error;
    When('the decision is evaluated', async () => {
      error = await definition.evaluate('lost', {}).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the missing target', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/target was not found/);
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
