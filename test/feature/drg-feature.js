// @ts-check
import * as testHelpers from '../helpers/testHelpers.js';
import { Definition, DecisionError } from 'dmn-elements';

Feature('decision requirement graph', () => {
  Scenario('a diamond requirement is evaluated once per run', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the diamond resource where top requires left and right, both requiring base', async () => {
      definition = new Definition(await testHelpers.context(testHelpers.resource('diamond.dmn')));
    });

    let count = 0;
    /** @type {any} */
    let result;
    When('top is evaluated with a sequence service as input', async () => {
      result = await definition.evaluate('top', { Next: () => ++count });
    });

    Then('left and right saw the same base result', () => {
      expect(result).to.be.true;
    });

    And('base was evaluated once', () => {
      expect(count).to.equal(1);
    });
  });

  Scenario('a requirement pointing at nothing', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="ghostDefinitions" name="Ghost" namespace="https://example.com/dmn/ghost">
  <decision id="haunted" name="Haunted">
    <informationRequirement id="hauntedRequiresGhost">
      <requiredInput href="#ghost" />
    </informationRequirement>
    <literalExpression id="hauntedExpression"><text>Ghost</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source with a requirement href to a missing element', async () => {
      definition = new Definition(await testHelpers.context(source));
    });

    /** @type {any} */
    let error;
    When('the decision is evaluated', async () => {
      error = await definition.evaluate('haunted', {}).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the missing target', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/target was not found/);
    });
  });

  Scenario('a decision without decision logic', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="emptyDefinitions" name="Empty" namespace="https://example.com/dmn/empty">
  <decision id="undecided" name="Undecided" />
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where the decision has no logic', async () => {
      definition = new Definition(await testHelpers.context(source));
    });

    /** @type {any} */
    let error;
    When('the decision is evaluated', async () => {
      error = await definition.evaluate('undecided', {}).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the missing logic', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/no decision logic/);
    });
  });

  Scenario('a decision with unsupported decision logic', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="contextDefinitions" name="Relation logic" namespace="https://example.com/dmn/relation">
  <decision id="relational" name="Relational">
    <relation id="relationLogic" />
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where the decision logic is a relation', async () => {
      definition = new Definition(await testHelpers.context(source));
    });

    /** @type {any} */
    let error;
    When('the decision is evaluated', async () => {
      error = await definition.evaluate('relational', {}).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the unsupported logic', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/unsupported decision logic dmn:Relation/);
    });
  });

  Scenario('a required business knowledge model without encapsulated logic', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="bkmDefinitions" name="BKM" namespace="https://example.com/dmn/bkm">
  <businessKnowledgeModel id="taxRules" name="Tax rules" />
  <decision id="tax" name="Tax">
    <knowledgeRequirement id="taxRequiresRules">
      <requiredKnowledge href="#taxRules" />
    </knowledgeRequirement>
    <literalExpression id="taxExpression"><text>1</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where the required business knowledge model has no logic', async () => {
      definition = new Definition(await testHelpers.context(source));
    });

    /** @type {any} */
    let error;
    When('the decision is evaluated', async () => {
      error = await definition.evaluate('tax', {}).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the missing encapsulated logic', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/no encapsulated logic/);
    });
  });

  Scenario('environment overrides at definition construction', () => {
    /** @type {import('dmn-elements').Context} */
    let context;
    /** @type {Definition} */
    let definition;
    Given('a definition from the dinner resource with a season variable override', async () => {
      context = await testHelpers.context(testHelpers.resource('dinner.dmn'));
      definition = new Definition(context, { variables: { Season: 'Winter' } });
    });

    Then('the definition got a cloned environment and context', () => {
      expect(definition.environment, 'environment').to.not.equal(context.environment);
      expect(definition.context, 'context').to.not.equal(context);
    });

    /** @type {any} */
    let result;
    When('dish is evaluated without input', async () => {
      result = await definition.evaluate('dish', {});
    });

    Then('the override variable fed the decision', () => {
      expect(result).to.equal('Roast beef');
    });

    And('the decision is retrievable from the definition', () => {
      expect(definition.getDecisionById('dish')).to.be.ok;
    });
  });

  Scenario('evaluate with only a callback', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the dinner resource', async () => {
      definition = new Definition(await testHelpers.context(testHelpers.resource('dinner.dmn')));
    });

    /** @type {any} */
    let result;
    When('dish is evaluated with a callback and no input', (done) => {
      definition.evaluate('dish', (err, res) => {
        if (err) return done(err);
        result = res;
        done();
      });
    });

    Then('no rule matched without a season', () => {
      expect(result).to.be.null;
    });
  });

  Scenario('input data without a variable falls back to element name', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="lightDefinitions" name="Light" namespace="https://example.com/dmn/light">
  <inputData id="colorInput" name="Color" />
  <decision id="signal" name="Signal">
    <informationRequirement id="signalRequiresColor">
      <requiredInput href="#colorInput" />
    </informationRequirement>
    <decisionTable id="signalTable">
      <input id="signalInput"><inputExpression id="signalInputExpression"><text>Color</text></inputExpression></input>
      <output id="signalOutput" name="signal" />
      <rule id="redRule">
        <inputEntry id="redEntry"><text>"red"</text></inputEntry>
        <outputEntry id="redSignal"><text>"stop"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where input data lacks a variable', async () => {
      definition = new Definition(await testHelpers.context(source));
    });

    /** @type {any} */
    let result;
    When('the decision is evaluated with a value keyed by element name', async () => {
      result = await definition.evaluate('signal', { Color: 'red' });
    });

    Then('the input data value was resolved', () => {
      expect(result).to.equal('stop');
    });
  });

  Scenario('broken FEEL in a literal expression', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="brokenDefinitions" name="Broken" namespace="https://example.com/dmn/broken">
  <decision id="broken" name="Broken">
    <literalExpression id="brokenExpression"><text>"Hello </text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source with an unterminated FEEL string', async () => {
      definition = new Definition(await testHelpers.context(source));
    });

    /** @type {any} */
    let error;
    When('the decision is evaluated', async () => {
      error = await definition.evaluate('broken', {}).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error wraps the FEEL error', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.inner).to.be.instanceof(Error);
    });
  });

  Scenario('an empty literal expression', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="silentDefinitions" name="Silent" namespace="https://example.com/dmn/silent">
  <decision id="silent" name="Silent">
    <literalExpression id="silentExpression"><text></text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source with an empty literal expression', async () => {
      definition = new Definition(await testHelpers.context(source));
    });

    /** @type {any} */
    let result;
    When('the decision is evaluated', async () => {
      result = await definition.evaluate('silent', {});
    });

    Then('the result is null', () => {
      expect(result).to.be.null;
    });
  });
});
