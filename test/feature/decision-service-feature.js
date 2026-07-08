// @ts-check
import * as testHelpers from '../helpers/testHelpers.js';
import { Definition, DecisionError } from 'dmn-elements';

const feeServiceSource = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="feeServiceDefinitions" name="Fee service" namespace="https://example.com/dmn/fee-service">
  <inputData id="ageInput" name="Age">
    <variable id="ageVariable" name="Age" typeRef="number" />
  </inputData>
  <decision id="category" name="Category">
    <variable id="categoryVariable" name="Category" typeRef="string" />
    <decisionTable id="categoryTable">
      <input id="categoryInput"><inputExpression id="categoryInputExpression"><text>Age</text></inputExpression></input>
      <output id="categoryOutput" name="category" />
      <rule id="boomRule"><inputEntry id="boomEntry"><text>-</text></inputEntry><outputEntry id="boomOutput"><text>"boom"</text></outputEntry></rule>
      <rule id="bangRule"><inputEntry id="bangEntry"><text>-</text></inputEntry><outputEntry id="bangOutput"><text>"bang"</text></outputEntry></rule>
    </decisionTable>
  </decision>
  <decision id="fee" name="Fee">
    <variable id="feeVariable" name="Fee" typeRef="number" />
    <informationRequirement id="feeRequiresCategory">
      <requiredDecision href="#category" />
    </informationRequirement>
    <informationRequirement id="feeRequiresAge">
      <requiredInput href="#ageInput" />
    </informationRequirement>
    <literalExpression id="feeExpression"><text>if Category = "adult" then Age * 2 else 0</text></literalExpression>
  </decision>
  <decisionService id="feeService" name="Fee service">
    <variable id="feeServiceVariable" name="Fee service" />
    <outputDecision href="#fee" />
    <inputDecision href="#category" />
    <inputData href="#ageInput" />
  </decisionService>
  <decision id="invoice" name="Invoice">
    <variable id="invoiceVariable" name="Invoice" typeRef="number" />
    <knowledgeRequirement id="invoiceRequiresFeeService">
      <requiredKnowledge href="#feeService" />
    </knowledgeRequirement>
    <literalExpression id="invoiceExpression"><text>Fee service("adult", 30)</text></literalExpression>
  </decision>
</definitions>`;

Feature('decision service', () => {
  Scenario('evaluating a decision service directly', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the pricing resource', async () => {
      definition = new Definition(await testHelpers.context(testHelpers.resource('pricing.dmn')));
    });

    /** @type {any} */
    let result;
    When('the pricing service is evaluated with a large amount', async () => {
      result = await definition.evaluate('pricingService', { Amount: 200 });
    });

    Then('the output decision result is returned, discounted by the encapsulated decision', () => {
      expect(result).to.equal(180);
    });

    When('the pricing service is evaluated with a small amount', async () => {
      result = await definition.evaluate('pricingService', { Amount: 50 });
    });

    Then('no discount applies', () => {
      expect(result).to.equal(50);
    });

    /** @type {any} */
    let traced;
    When('the pricing service is traced', async () => {
      traced = await definition.trace('pricingService', { Amount: 200 });
    });

    Then('the trace holds the encapsulated decision, the output decision, and the service', () => {
      expect(traced.result).to.equal(180);
      expect(traced.trace.map((/** @type {any} */ entry) => entry.id)).to.deep.equal(['discountRate', 'netPrice', 'pricingService']);
      expect(traced.trace[2]).to.deep.include({ type: 'dmn:DecisionService', name: 'Pricing service', result: 180 });
    });
  });

  Scenario('invoking a decision service as a FEEL function', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the pricing resource where quote requires the pricing service', async () => {
      definition = new Definition(await testHelpers.context(testHelpers.resource('pricing.dmn')));
    });

    /** @type {any} */
    let result;
    When('quote is evaluated', async () => {
      result = await definition.evaluate('quote', { Amount: 200 });
    });

    Then('the invoked service produced the quote', () => {
      expect(result).to.equal(180);
    });
  });

  Scenario('input decisions are provided, never evaluated', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where the input decision would violate its hit policy if evaluated', async () => {
      definition = new Definition(await testHelpers.context(feeServiceSource));
    });

    /** @type {any} */
    let result;
    When('the requiring decision invokes the service with category and age arguments', async () => {
      result = await definition.evaluate('invoice', {});
    });

    Then('the provided input decision value fed the output decision', () => {
      expect(result).to.equal(60);
    });

    When('the service is evaluated directly with the input decision value in input', async () => {
      result = await definition.evaluate('feeService', { Category: 'adult', Age: 20 });
    });

    Then('the seeded value was used', () => {
      expect(result).to.equal(40);
    });
  });

  Scenario('a directly evaluated service misses an input decision value', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the fee service source', async () => {
      definition = new Definition(await testHelpers.context(feeServiceSource));
    });

    /** @type {any} */
    let error;
    When('the service is evaluated without the input decision value', async () => {
      error = await definition.evaluate('feeService', { Age: 20 }).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error requires the input decision value', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/input decision.*Category/);
    });
  });

  Scenario('multiple output decisions form a result object', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="duoDefinitions" name="Duo" namespace="https://example.com/dmn/duo">
  <decision id="first" name="First">
    <variable id="firstVariable" name="First" />
    <literalExpression id="firstExpression"><text>1</text></literalExpression>
  </decision>
  <decision id="second" name="Second">
    <variable id="secondVariable" name="Second" />
    <literalExpression id="secondExpression"><text>2</text></literalExpression>
  </decision>
  <decisionService id="duoService" name="Duo service">
    <outputDecision href="#first" />
    <outputDecision href="#second" />
  </decisionService>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source with a two output service', async () => {
      definition = new Definition(await testHelpers.context(source));
    });

    /** @type {any} */
    let result;
    When('the service is evaluated', async () => {
      result = await definition.evaluate('duoService', {});
    });

    Then('the result is keyed by output decision variable name', () => {
      expect(result).to.deep.equal({ First: 1, Second: 2 });
    });
  });

  Scenario('a failing decision inside an invoked service', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="brokenDefinitions" name="Broken" namespace="https://example.com/dmn/broken-service">
  <decision id="verdict" name="Verdict">
    <variable id="verdictVariable" name="Verdict" />
    <decisionTable id="verdictTable">
      <input id="verdictInput"><inputExpression id="verdictInputExpression"><text>Anything</text></inputExpression></input>
      <output id="verdictOutput" name="verdict" />
      <rule id="guiltyRule"><inputEntry id="guiltyEntry"><text>-</text></inputEntry><outputEntry id="guiltyVerdict"><text>"guilty"</text></outputEntry></rule>
      <rule id="acquittedRule"><inputEntry id="acquittedEntry"><text>-</text></inputEntry><outputEntry id="acquittedVerdict"><text>"acquitted"</text></outputEntry></rule>
    </decisionTable>
  </decision>
  <decisionService id="brokenService" name="Broken service">
    <variable id="brokenServiceVariable" name="Broken service" />
    <outputDecision href="#verdict" />
  </decisionService>
  <decision id="caller" name="Caller">
    <knowledgeRequirement id="callerRequiresBroken">
      <requiredKnowledge href="#brokenService" />
    </knowledgeRequirement>
    <literalExpression id="callerExpression"><text>Broken service()</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where the service output decision violates its hit policy', async () => {
      definition = new Definition(await testHelpers.context(source));
    });

    /** @type {any} */
    let error;
    When('the requiring decision invokes the service', async () => {
      error = await definition.evaluate('caller', {}).catch((/** @type {Error} */ err) => err);
    });

    Then('the decision error propagated through the FEEL invocation', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/UNIQUE/);
    });
  });

  Scenario('a decision service without output decisions', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="hollowDefinitions" name="Hollow" namespace="https://example.com/dmn/hollow">
  <decisionService id="hollowService" name="Hollow service" />
  <decision id="caller" name="Caller">
    <knowledgeRequirement id="callerRequiresHollow">
      <requiredKnowledge href="#hollowService" />
    </knowledgeRequirement>
    <literalExpression id="callerExpression"><text>Hollow service()</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source with an output-less service', async () => {
      definition = new Definition(await testHelpers.context(source));
    });

    /** @type {any} */
    let error;
    When('the requiring decision is evaluated', async () => {
      error = await definition.evaluate('caller', {}).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error requires output decisions', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/no output decision/);
    });

    When('the service is evaluated directly', async () => {
      error = await definition.evaluate('hollowService', {}).catch((/** @type {Error} */ err) => err);
    });

    Then('the same decision error is raised', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/no output decision/);
    });
  });
});
