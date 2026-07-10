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

Feature('invocation decision logic', () => {
  Scenario('a decision invoking a business knowledge model with bound parameters', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the premium resource where the premium invokes the premium rate model', async () => {
      definition = await getDefinition(testHelpers.resource('premium.dmn'));
    });

    /** @type {any} */
    let result;
    When('the premium is evaluated for a young policy holder', async () => {
      result = await definition.evaluate('premium', { Age: 22, Coverage: 100000 });
    });

    Then('the bindings fed the rate model and the high rate applied', () => {
      expect(result).to.equal(5000);
    });

    When('the premium is evaluated for an experienced policy holder', async () => {
      result = await definition.evaluate('premium', { Age: 40, Coverage: 100000 });
    });

    Then('the low rate applied', () => {
      expect(result).to.equal(3000);
    });

    /** @type {any} */
    let traced;
    When('the premium is traced', async () => {
      traced = await definition.trace('premium', { Age: 40, Coverage: 100000 });
    });

    Then('the decision trace entry declares invocation decision logic', () => {
      const entry = traced.trace.find((/** @type {any} */ e) => e.id === 'premium');
      expect(entry.decisionLogic).to.equal('dmn:Invocation');
      expect(traced.result).to.equal(3000);
    });
  });

  Scenario('bindings map to formal parameters by name, not order', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="subtractDefinitions" name="Subtract" namespace="https://example.com/dmn/subtract">
  <businessKnowledgeModel id="subtract" name="Subtract">
    <variable id="subtractVariable" name="Subtract" />
    <encapsulatedLogic id="subtractLogic">
      <formalParameter id="minuendParameter" name="minuend" typeRef="number" />
      <formalParameter id="subtrahendParameter" name="subtrahend" typeRef="number" />
      <literalExpression id="subtractBody"><text>minuend - subtrahend</text></literalExpression>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <decision id="difference" name="Difference">
    <variable id="differenceVariable" name="Difference" />
    <knowledgeRequirement id="differenceRequiresSubtract">
      <requiredKnowledge href="#subtract" />
    </knowledgeRequirement>
    <invocation id="differenceInvocation">
      <literalExpression id="differenceCalledFunction"><text>Subtract</text></literalExpression>
      <binding>
        <parameter id="differenceSubtrahendParameter" name="subtrahend" />
        <literalExpression id="differenceSubtrahendFormula"><text>3</text></literalExpression>
      </binding>
      <binding>
        <parameter id="differenceMinuendParameter" name="minuend" />
        <literalExpression id="differenceMinuendFormula"><text>10</text></literalExpression>
      </binding>
    </invocation>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where the bindings are declared in reverse parameter order', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the difference is evaluated', async () => {
      result = await definition.evaluate('difference', {});
    });

    Then('each binding reached its named parameter', () => {
      expect(result).to.equal(7);
    });
  });

  Scenario('a decision invoking a decision service', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="orderDefinitions" name="Order" namespace="https://example.com/dmn/order">
  <inputData id="priceInput" name="Price">
    <variable id="priceVariable" name="Price" typeRef="number" />
  </inputData>
  <inputData id="rateInput" name="Rate">
    <variable id="rateVariable" name="Rate" typeRef="number" />
  </inputData>
  <decision id="gross" name="Gross">
    <variable id="grossVariable" name="Gross" />
    <literalExpression id="grossExpression"><text>0</text></literalExpression>
  </decision>
  <decision id="net" name="Net">
    <variable id="netVariable" name="Net" />
    <informationRequirement id="netRequiresGross">
      <requiredDecision href="#gross" />
    </informationRequirement>
    <informationRequirement id="netRequiresRate">
      <requiredInput href="#rateInput" />
    </informationRequirement>
    <literalExpression id="netExpression"><text>Gross - Gross * Rate</text></literalExpression>
  </decision>
  <decisionService id="netService" name="Net service">
    <outputDecision href="#net" />
    <inputDecision href="#gross" />
    <inputData href="#rateInput" />
  </decisionService>
  <decision id="order" name="Order">
    <variable id="orderVariable" name="Order" />
    <informationRequirement id="orderRequiresPrice">
      <requiredInput href="#priceInput" />
    </informationRequirement>
    <knowledgeRequirement id="orderRequiresService">
      <requiredKnowledge href="#netService" />
    </knowledgeRequirement>
    <invocation id="orderInvocation">
      <literalExpression id="orderCalledFunction"><text>Net service</text></literalExpression>
      <binding>
        <parameter id="orderRateParameter" name="Rate" />
        <literalExpression id="orderRateFormula"><text>0.25</text></literalExpression>
      </binding>
      <binding>
        <parameter id="orderGrossParameter" name="Gross" />
        <literalExpression id="orderGrossFormula"><text>Price</text></literalExpression>
      </binding>
    </invocation>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where a decision invokes a decision service with named bindings', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the order is evaluated', async () => {
      result = await definition.evaluate('order', { Price: 200 });
    });

    Then('the service parameters were bound by name and the seeded input decision was never evaluated', () => {
      expect(result).to.equal(150);
    });
  });

  Scenario('an invocation of a host-provided function without parameter metadata', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="feeDefinitions" name="Fee" namespace="https://example.com/dmn/fee">
  <inputData id="amountInput" name="Amount">
    <variable id="amountVariable" name="Amount" typeRef="number" />
  </inputData>
  <decision id="fee" name="Fee">
    <variable id="feeVariable" name="Fee" />
    <informationRequirement id="feeRequiresAmount">
      <requiredInput href="#amountInput" />
    </informationRequirement>
    <invocation id="feeInvocation">
      <literalExpression id="feeCalledFunction"><text>Apply fee</text></literalExpression>
      <binding>
        <parameter id="feeAmountParameter" name="amount" />
        <literalExpression id="feeAmountFormula"><text>Amount</text></literalExpression>
      </binding>
    </invocation>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition where the called function is an environment variable function', async () => {
      definition = await getDefinition(source, { variables: { 'Apply fee': (/** @type {number} */ amount) => amount + 10 } });
    });

    /** @type {any} */
    let result;
    When('the fee is evaluated', async () => {
      result = await definition.evaluate('fee', { Amount: 5 });
    });

    Then('the bindings applied positionally in declaration order', () => {
      expect(result).to.equal(15);
    });
  });

  Scenario('a binding without a formula binds null', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="classifyDefinitions" name="Classify" namespace="https://example.com/dmn/classify">
  <businessKnowledgeModel id="classify" name="Classify">
    <variable id="classifyVariable" name="Classify" />
    <encapsulatedLogic id="classifyLogic">
      <formalParameter id="xParameter" name="x" />
      <literalExpression id="classifyBody"><text>if x = null then "none" else "some"</text></literalExpression>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <decision id="classification" name="Classification">
    <variable id="classificationVariable" name="Classification" />
    <knowledgeRequirement id="classificationRequiresClassify">
      <requiredKnowledge href="#classify" />
    </knowledgeRequirement>
    <invocation id="classificationInvocation">
      <literalExpression id="classificationCalledFunction"><text>Classify</text></literalExpression>
      <binding>
        <parameter id="classificationXParameter" name="x" />
      </binding>
    </invocation>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where the binding has no formula', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the classification is evaluated', async () => {
      result = await definition.evaluate('classification', {});
    });

    Then('the parameter was bound to null', () => {
      expect(result).to.equal('none');
    });
  });

  Scenario('an invocation nested as binding formula', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="nestedInvocationDefinitions" name="Nested invocation" namespace="https://example.com/dmn/nested-invocation">
  <businessKnowledgeModel id="addTen" name="Add ten">
    <variable id="addTenVariable" name="Add ten" />
    <encapsulatedLogic id="addTenLogic">
      <formalParameter id="baseParameter" name="base" typeRef="number" />
      <literalExpression id="addTenBody"><text>base + 10</text></literalExpression>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <decision id="total" name="Total">
    <variable id="totalVariable" name="Total" />
    <knowledgeRequirement id="totalRequiresAddTen">
      <requiredKnowledge href="#addTen" />
    </knowledgeRequirement>
    <invocation id="outerInvocation">
      <literalExpression id="outerCalledFunction"><text>Add ten</text></literalExpression>
      <binding>
        <parameter id="outerBaseParameter" name="base" />
        <invocation id="innerInvocation">
          <literalExpression id="innerCalledFunction"><text>Add ten</text></literalExpression>
          <binding>
            <parameter id="innerBaseParameter" name="base" />
            <literalExpression id="innerBaseFormula"><text>5</text></literalExpression>
          </binding>
        </invocation>
      </binding>
    </invocation>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where a binding formula is itself an invocation', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the total is evaluated', async () => {
      result = await definition.evaluate('total', {});
    });

    Then('the inner invocation result fed the outer binding', () => {
      expect(result).to.equal(25);
    });
  });

  Scenario('boxed expressions as binding formulas', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="describeDefinitions" name="Describe" namespace="https://example.com/dmn/describe">
  <inputData id="ageInput" name="Age">
    <variable id="ageVariable" name="Age" typeRef="number" />
  </inputData>
  <businessKnowledgeModel id="describe" name="Describe">
    <variable id="describeVariable" name="Describe" />
    <encapsulatedLogic id="describeLogic">
      <formalParameter id="sizeParameter" name="size" typeRef="number" />
      <formalParameter id="categoryParameter" name="category" typeRef="string" />
      <literalExpression id="describeBody"><text>category + " " + string(size)</text></literalExpression>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <decision id="description" name="Description">
    <variable id="descriptionVariable" name="Description" />
    <informationRequirement id="descriptionRequiresAge">
      <requiredInput href="#ageInput" />
    </informationRequirement>
    <knowledgeRequirement id="descriptionRequiresDescribe">
      <requiredKnowledge href="#describe" />
    </knowledgeRequirement>
    <invocation id="descriptionInvocation">
      <literalExpression id="descriptionCalledFunction"><text>Describe</text></literalExpression>
      <binding>
        <parameter id="descriptionSizeParameter" name="size" />
        <context id="sizeContext">
          <contextEntry id="widthEntry">
            <variable id="widthVariable" name="w" />
            <literalExpression id="widthExpression"><text>2</text></literalExpression>
          </contextEntry>
          <contextEntry id="sizeResultEntry">
            <literalExpression id="sizeResultExpression"><text>w * 3</text></literalExpression>
          </contextEntry>
        </context>
      </binding>
      <binding>
        <parameter id="descriptionCategoryParameter" name="category" />
        <decisionTable id="categoryTable">
          <input id="categoryInput"><inputExpression id="categoryInputExpression" typeRef="number"><text>Age</text></inputExpression></input>
          <output id="categoryOutput" name="category" />
          <rule id="adultRule">
            <inputEntry id="adultEntry"><text>&gt;= 18</text></inputEntry>
            <outputEntry id="adultCategory"><text>"adult"</text></outputEntry>
          </rule>
          <rule id="minorRule">
            <inputEntry id="minorEntry"><text>&lt; 18</text></inputEntry>
            <outputEntry id="minorCategory"><text>"minor"</text></outputEntry>
          </rule>
        </decisionTable>
      </binding>
    </invocation>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where binding formulas are a context and a decision table', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the description is evaluated', async () => {
      result = await definition.evaluate('description', { Age: 30 });
    });

    Then('both boxed formulas produced binding values', () => {
      expect(result).to.equal('adult 6');
    });
  });

  Scenario('an invocation as context entry', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="entryDefinitions" name="Entry" namespace="https://example.com/dmn/entry">
  <businessKnowledgeModel id="addTen" name="Add ten">
    <variable id="addTenVariable" name="Add ten" />
    <encapsulatedLogic id="addTenLogic">
      <formalParameter id="baseParameter" name="base" typeRef="number" />
      <literalExpression id="addTenBody"><text>base + 10</text></literalExpression>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <decision id="total" name="Total">
    <variable id="totalVariable" name="Total" />
    <knowledgeRequirement id="totalRequiresAddTen">
      <requiredKnowledge href="#addTen" />
    </knowledgeRequirement>
    <context id="totalContext">
      <contextEntry id="feeEntry">
        <variable id="feeVariable" name="Fee" />
        <invocation id="feeInvocation">
          <literalExpression id="feeCalledFunction"><text>Add ten</text></literalExpression>
          <binding>
            <parameter id="feeBaseParameter" name="base" />
            <literalExpression id="feeBaseFormula"><text>5</text></literalExpression>
          </binding>
        </invocation>
      </contextEntry>
      <contextEntry id="totalResultEntry">
        <literalExpression id="totalResultExpression"><text>Fee * 2</text></literalExpression>
      </contextEntry>
    </context>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where a context entry is an invocation', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the total is evaluated', async () => {
      result = await definition.evaluate('total', {});
    });

    Then('the invocation entry fed the final result entry', () => {
      expect(result).to.equal(30);
    });
  });

  Scenario('a business knowledge model with invocation body', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="quadrupleDefinitions" name="Quadruple" namespace="https://example.com/dmn/quadruple">
  <businessKnowledgeModel id="double" name="Double">
    <variable id="doubleVariable" name="Double" />
    <encapsulatedLogic id="doubleLogic">
      <formalParameter id="doubleNParameter" name="n" typeRef="number" />
      <literalExpression id="doubleBody"><text>n * 2</text></literalExpression>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <businessKnowledgeModel id="quadruple" name="Quadruple">
    <variable id="quadrupleVariable" name="Quadruple" />
    <knowledgeRequirement id="quadrupleRequiresDouble">
      <requiredKnowledge href="#double" />
    </knowledgeRequirement>
    <encapsulatedLogic id="quadrupleLogic">
      <formalParameter id="quadrupleNParameter" name="n" typeRef="number" />
      <invocation id="quadrupleInvocation">
        <literalExpression id="quadrupleCalledFunction"><text>Double</text></literalExpression>
        <binding>
          <parameter id="quadrupleBaseParameter" name="n" />
          <literalExpression id="quadrupleBaseFormula"><text>n * 2</text></literalExpression>
        </binding>
      </invocation>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <decision id="result" name="Result">
    <variable id="resultVariable" name="Result" />
    <knowledgeRequirement id="resultRequiresQuadruple">
      <requiredKnowledge href="#quadruple" />
    </knowledgeRequirement>
    <literalExpression id="resultExpression"><text>Quadruple(3)</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where a knowledge model body invokes its required knowledge', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the decision invokes the outer knowledge model from FEEL', async () => {
      result = await definition.evaluate('result', {});
    });

    Then('the invocation body applied the required knowledge', () => {
      expect(result).to.equal(12);
    });
  });

  Scenario('invocation errors', () => {
    /**
     * @param {string} id
     * @param {string} invocationXml
     */
    function decisionSource(id, invocationXml) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="${id}Definitions" name="Errors" namespace="https://example.com/dmn/${id}">
  <businessKnowledgeModel id="addTen" name="Add ten">
    <variable id="addTenVariable" name="Add ten" />
    <encapsulatedLogic id="addTenLogic">
      <formalParameter id="baseParameter" name="base" typeRef="number" />
      <literalExpression id="addTenBody"><text>base + 10</text></literalExpression>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <decision id="${id}" name="Broken">
    <variable id="${id}Variable" name="Broken" />
    <knowledgeRequirement id="${id}RequiresAddTen">
      <requiredKnowledge href="#addTen" />
    </knowledgeRequirement>
    ${invocationXml}
  </decision>
</definitions>`;
    }

    /**
     * @param {string} id
     * @param {string} invocationXml
     */
    async function evaluateBroken(id, invocationXml) {
      const definition = await getDefinition(decisionSource(id, invocationXml));
      return definition.evaluate(id, {}).catch((/** @type {Error} */ err) => err);
    }

    /** @type {any} */
    let error;
    When('a decision with an invocation without called function is evaluated', async () => {
      error = await evaluateBroken(
        'noFunction',
        `<invocation id="noFunctionInvocation">
      <binding>
        <parameter id="noFunctionParameter" name="base" />
        <literalExpression id="noFunctionFormula"><text>1</text></literalExpression>
      </binding>
    </invocation>`
      );
    });

    Then('a decision error points out the missing called function', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/has no called function/);
    });

    When('the called function expression resolves to a non-function', async () => {
      error = await evaluateBroken(
        'notAFunction',
        `<invocation id="notAFunctionInvocation">
      <literalExpression id="notAFunctionCalledFunction"><text>1 + 1</text></literalExpression>
    </invocation>`
      );
    });

    Then('a decision error points out that no function was resolved', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/did not resolve to a function/);
    });

    When('a binding is missing its parameter name', async () => {
      error = await evaluateBroken(
        'unnamed',
        `<invocation id="unnamedInvocation">
      <literalExpression id="unnamedCalledFunction"><text>Add ten</text></literalExpression>
      <binding>
        <literalExpression id="unnamedFormula"><text>1</text></literalExpression>
      </binding>
    </invocation>`
      );
    });

    Then('a decision error points out the unnamed binding', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/binding is missing a parameter name/);
    });

    When('a binding names a parameter the function does not declare', async () => {
      error = await evaluateBroken(
        'unknown',
        `<invocation id="unknownInvocation">
      <literalExpression id="unknownCalledFunction"><text>Add ten</text></literalExpression>
      <binding>
        <parameter id="unknownParameter" name="years" />
        <literalExpression id="unknownFormula"><text>1</text></literalExpression>
      </binding>
    </invocation>`
      );
    });

    Then('a decision error points out the unknown parameter', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/binds unknown parameter "years"/);
    });

    When('the called function is an unsupported expression', async () => {
      error = await evaluateBroken(
        'oddFunction',
        `<invocation id="oddFunctionInvocation">
      <unaryTests id="oddFunctionTests" />
    </invocation>`
      );
    });

    Then('a decision error points out the unsupported called function expression', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/unsupported called function expression dmn:UnaryTests/);
    });

    When('a binding formula is an unsupported expression', async () => {
      error = await evaluateBroken(
        'oddBinding',
        `<invocation id="oddBindingInvocation">
      <literalExpression id="oddBindingCalledFunction"><text>Add ten</text></literalExpression>
      <binding>
        <parameter id="oddBindingParameter" name="base" />
        <unaryTests id="oddBindingTests" />
      </binding>
    </invocation>`
      );
    });

    Then('a decision error points out the unsupported binding expression', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/unsupported binding expression dmn:UnaryTests/);
    });
  });
});
