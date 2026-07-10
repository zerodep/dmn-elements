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

Feature('function definition decision logic', () => {
  Scenario('a boxed function definition as context entry', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the conversion resource where a context entry defines the conversion function', async () => {
      definition = await getDefinition(testHelpers.resource('conversion.dmn'));
    });

    /** @type {any} */
    let result;
    When('the converted price is evaluated', async () => {
      result = await definition.evaluate('converted', { Price: 125, Rate: 1.25 });
    });

    Then('the final result entry invoked the defined function', () => {
      expect(result).to.equal(100);
    });
  });

  Scenario('a function definition closes over its definition scope', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="closureDefinitions" name="Closure" namespace="https://example.com/dmn/closure">
  <decision id="closure" name="Closure">
    <variable id="closureVariable" name="Closure" />
    <context id="closureContext">
      <contextEntry id="baseEntry">
        <variable id="baseVariable" name="Base" />
        <literalExpression id="baseExpression"><text>10</text></literalExpression>
      </contextEntry>
      <contextEntry id="addEntry">
        <variable id="addVariable" name="add" />
        <functionDefinition id="addFunction">
          <formalParameter id="nParameter" name="n" typeRef="number" />
          <literalExpression id="addBody"><text>n + Base</text></literalExpression>
        </functionDefinition>
      </contextEntry>
      <contextEntry id="closureResultEntry">
        <literalExpression id="closureResultExpression"><text>add(5)</text></literalExpression>
      </contextEntry>
    </context>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where the function body references an earlier context entry', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the decision is evaluated', async () => {
      result = await definition.evaluate('closure', {});
    });

    Then('the invocation saw the entry bound before the function was defined', () => {
      expect(result).to.equal(15);
    });
  });

  Scenario('a decision with function definition logic invoked by a requiring decision', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="addDefinitions" name="Add" namespace="https://example.com/dmn/add">
  <decision id="add" name="Add">
    <variable id="addVariable" name="Add" />
    <functionDefinition id="addFunction" kind="FEEL">
      <formalParameter id="aParameter" name="a" typeRef="number" />
      <formalParameter id="bParameter" name="b" typeRef="number" />
      <literalExpression id="addBody"><text>a + b</text></literalExpression>
    </functionDefinition>
  </decision>
  <decision id="sum" name="Sum">
    <variable id="sumVariable" name="Sum" />
    <informationRequirement id="sumRequiresAdd">
      <requiredDecision href="#add" />
    </informationRequirement>
    <invocation id="sumInvocation">
      <literalExpression id="sumCalledFunction"><text>Add</text></literalExpression>
      <binding>
        <parameter id="sumBParameter" name="b" />
        <literalExpression id="sumBFormula"><text>"2"</text></literalExpression>
      </binding>
      <binding>
        <parameter id="sumAParameter" name="a" />
        <literalExpression id="sumAFormula"><text>1</text></literalExpression>
      </binding>
    </invocation>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where a decision defines a function and another invokes it with named bindings', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the sum is evaluated', async () => {
      result = await definition.evaluate('sum', {});
    });

    Then('the bindings mapped by parameter name and the string argument was coerced', () => {
      expect(result).to.equal(3);
    });
  });

  Scenario('a business knowledge model returning a function', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="makerDefinitions" name="Maker" namespace="https://example.com/dmn/maker">
  <businessKnowledgeModel id="multiplier" name="Multiplier">
    <variable id="multiplierVariable" name="Multiplier" />
    <encapsulatedLogic id="multiplierLogic">
      <formalParameter id="factorParameter" name="factor" typeRef="number" />
      <functionDefinition id="multiplierFunction">
        <formalParameter id="valueParameter" name="value" typeRef="number" />
        <literalExpression id="multiplierBody"><text>value * factor</text></literalExpression>
      </functionDefinition>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <decision id="doubled" name="Doubled">
    <variable id="doubledVariable" name="Doubled" />
    <knowledgeRequirement id="doubledRequiresMultiplier">
      <requiredKnowledge href="#multiplier" />
    </knowledgeRequirement>
    <context id="doubledContext">
      <contextEntry id="timesTwoEntry">
        <variable id="timesTwoVariable" name="times two" />
        <literalExpression id="timesTwoExpression"><text>Multiplier(2)</text></literalExpression>
      </contextEntry>
      <contextEntry id="doubledResultEntry">
        <literalExpression id="doubledResultExpression"><text>times two(21)</text></literalExpression>
      </contextEntry>
    </context>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where a knowledge model body is a function definition', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the curried function is invoked', async () => {
      result = await definition.evaluate('doubled', {});
    });

    Then('the inner function closed over the knowledge model parameter', () => {
      expect(result).to.equal(42);
    });
  });

  Scenario('function definition errors', () => {
    /**
     * @param {string} id
     * @param {string} decisionLogicXml the decision's logic
     */
    async function evaluateBroken(id, decisionLogicXml) {
      const definition = await getDefinition(`<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="${id}Definitions" name="Broken" namespace="https://example.com/dmn/${id}">
  <decision id="${id}" name="Broken">
    <variable id="${id}Variable" name="Broken" />
    ${decisionLogicXml}
  </decision>
</definitions>`);
      return definition.evaluate(id, {}).catch((/** @type {Error} */ err) => err);
    }

    /** @type {any} */
    let error;
    When('a decision defining a Java function is evaluated', async () => {
      error = await evaluateBroken(
        'javaKind',
        `<functionDefinition id="javaFunction" kind="Java">
      <literalExpression id="javaBody"><text>1</text></literalExpression>
    </functionDefinition>`
      );
    });

    Then('a decision error points out the unsupported kind', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/unsupported function definition kind Java/);
    });

    When('a decision defining a function without body is evaluated', async () => {
      error = await evaluateBroken('noBody', `<functionDefinition id="noBodyFunction" />`);
    });

    Then('a decision error points out the missing body', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/has no function body/);
    });

    When('a decision defining a function with an unsupported body is evaluated', async () => {
      // the body dispatches lazily on invocation, so this one invokes through a context
      error = await evaluateBroken(
        'oddBody',
        `<context id="oddBodyContext">
      <contextEntry id="oddBodyFnEntry">
        <variable id="oddBodyFnVariable" name="fn" />
        <functionDefinition id="oddBodyFunction">
          <unaryTests id="oddBodyTests" />
        </functionDefinition>
      </contextEntry>
      <contextEntry id="oddBodyResultEntry">
        <literalExpression id="oddBodyResultExpression"><text>fn(1)</text></literalExpression>
      </contextEntry>
    </context>`
      );
    });

    Then('a decision error points out the unsupported body expression', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/unsupported function body expression dmn:UnaryTests/);
    });
  });
});
