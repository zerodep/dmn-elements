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

Feature('list decision logic', () => {
  Scenario('a decision with boxed list logic', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the notifications resource where the recipients are a list', async () => {
      definition = await getDefinition(testHelpers.resource('notifications.dmn'));
    });

    /** @type {any} */
    let result;
    When('the recipients are evaluated directly', async () => {
      result = await definition.evaluate('recipients', { Manager: 'manager@example.com' });
    });

    Then('the list evaluated each element in order', () => {
      expect(result).to.deep.equal(['support@example.com', 'manager@example.com', 'audit@example.com']);
    });

    When('the escalation recipient is evaluated', async () => {
      result = await definition.evaluate('escalation', { Manager: 'manager@example.com' });
    });

    Then('the requiring decision indexed into the list', () => {
      expect(result).to.equal('manager@example.com');
    });

    /** @type {any} */
    let traced;
    When('the escalation is traced', async () => {
      traced = await definition.trace('escalation', { Manager: 'manager@example.com' });
    });

    Then('the recipients trace entry declares list decision logic', () => {
      const entry = traced.trace.find((/** @type {any} */ e) => e.id === 'recipients');
      expect(entry.decisionLogic).to.equal('dmn:List');
      expect(traced.result).to.equal('manager@example.com');
    });
  });

  Scenario('boxed expressions as list elements', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="mixedDefinitions" name="Mixed" namespace="https://example.com/dmn/mixed">
  <decision id="mixed" name="Mixed">
    <variable id="mixedVariable" name="Mixed" />
    <list id="mixedList">
      <literalExpression id="plainElement"><text>1</text></literalExpression>
      <context id="contextElement">
        <contextEntry id="innerEntry">
          <variable id="innerVariable" name="inner" />
          <literalExpression id="innerExpression"><text>2</text></literalExpression>
        </contextEntry>
        <contextEntry id="innerResultEntry">
          <literalExpression id="innerResultExpression"><text>inner * 10</text></literalExpression>
        </contextEntry>
      </context>
      <list id="nestedList">
        <literalExpression id="nestedElement"><text>3</text></literalExpression>
      </list>
    </list>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where list elements are a literal, a context, and a nested list', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the decision is evaluated', async () => {
      result = await definition.evaluate('mixed', {});
    });

    Then('every element produced its boxed result', () => {
      expect(result).to.deep.equal([1, 20, [3]]);
    });
  });

  Scenario('an empty list', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="emptyDefinitions" name="Empty" namespace="https://example.com/dmn/empty">
  <decision id="empty" name="Empty">
    <variable id="emptyVariable" name="Empty" />
    <list id="emptyList" />
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where the list has no elements', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the decision is evaluated', async () => {
      result = await definition.evaluate('empty', {});
    });

    Then('the result is an empty list', () => {
      expect(result).to.deep.equal([]);
    });
  });

  Scenario('a business knowledge model with list body', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="optionsDefinitions" name="Options" namespace="https://example.com/dmn/options">
  <businessKnowledgeModel id="options" name="Options">
    <variable id="optionsVariable" name="Options" />
    <encapsulatedLogic id="optionsLogic">
      <formalParameter id="nParameter" name="n" typeRef="number" />
      <list id="optionsList">
        <literalExpression id="singleOption"><text>n</text></literalExpression>
        <literalExpression id="doubleOption"><text>n * 2</text></literalExpression>
      </list>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <decision id="upgrade" name="Upgrade">
    <variable id="upgradeVariable" name="Upgrade" />
    <knowledgeRequirement id="upgradeRequiresOptions">
      <requiredKnowledge href="#options" />
    </knowledgeRequirement>
    <literalExpression id="upgradeExpression"><text>Options(2)[2]</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where the function body is a list', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the decision picks an element from the invocation result', async () => {
      result = await definition.evaluate('upgrade', {});
    });

    Then('the list body produced the element', () => {
      expect(result).to.equal(4);
    });
  });

  Scenario('an unsupported list element expression', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="oddElementDefinitions" name="Odd element" namespace="https://example.com/dmn/odd-element">
  <decision id="oddElement" name="Odd element">
    <variable id="oddElementVariable" name="Odd element" />
    <list id="oddElementList">
      <unaryTests id="oddElementTests" />
    </list>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where a list element is a unary tests expression', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let error;
    When('the decision is evaluated', async () => {
      error = await definition.evaluate('oddElement', {}).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the unsupported element expression', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/unsupported list element expression dmn:UnaryTests/);
    });
  });
});
