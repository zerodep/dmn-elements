// @ts-check
import * as testHelpers from '../helpers/testHelpers.js';
import { Definition, DecisionError } from 'dmn-elements';

Feature('context decision logic', () => {
  Scenario('a decision with boxed context logic', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the loan resource where the payment is calculated in context entries', async () => {
      definition = new Definition(await testHelpers.context(testHelpers.resource('loan.dmn')));
    });

    /** @type {any} */
    let result;
    When('the loan payment is evaluated', async () => {
      result = await definition.evaluate('loanPayment', { Amount: 100000, Rate: 0.05, Years: 10 });
    });

    Then('later entries saw earlier bindings and the final result entry produced the payment', () => {
      expect(result).to.be.closeTo(1060.66, 0.01);
    });
  });

  Scenario('a context without a final result entry yields all entries', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="pairDefinitions" name="Pair" namespace="https://example.com/dmn/pair">
  <decision id="pair" name="Pair">
    <variable id="pairVariable" name="Pair" />
    <context id="pairContext">
      <contextEntry id="firstEntry">
        <variable id="firstVariable" name="First" />
        <literalExpression id="firstExpression"><text>1</text></literalExpression>
      </contextEntry>
      <contextEntry id="secondEntry">
        <variable id="secondVariable" name="Second" />
        <literalExpression id="secondExpression"><text>First + 1</text></literalExpression>
      </contextEntry>
      <contextEntry id="emptyEntry">
        <variable id="emptyVariable" name="Empty" />
      </contextEntry>
    </context>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where all context entries are named', async () => {
      definition = new Definition(await testHelpers.context(source));
    });

    /** @type {any} */
    let result;
    When('the decision is evaluated', async () => {
      result = await definition.evaluate('pair', {});
    });

    Then('the result holds every entry, an entry without expression is null', () => {
      expect(result).to.deep.equal({ First: 1, Second: 2, Empty: null });
    });
  });

  Scenario('a nested context entry', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="nestedDefinitions" name="Nested" namespace="https://example.com/dmn/nested">
  <decision id="nested" name="Nested">
    <variable id="nestedVariable" name="Nested" />
    <context id="outerContext">
      <contextEntry id="innerEntry">
        <variable id="innerVariable" name="Inner" />
        <context id="innerContext">
          <contextEntry id="xEntry">
            <variable id="xVariable" name="x" />
            <literalExpression id="xExpression"><text>1</text></literalExpression>
          </contextEntry>
          <contextEntry id="yEntry">
            <variable id="yVariable" name="y" />
            <literalExpression id="yExpression"><text>x + 1</text></literalExpression>
          </contextEntry>
        </context>
      </contextEntry>
      <contextEntry id="resultEntry">
        <literalExpression id="resultExpression"><text>Inner.y * 10</text></literalExpression>
      </contextEntry>
    </context>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source with a context inside a context', async () => {
      definition = new Definition(await testHelpers.context(source));
    });

    /** @type {any} */
    let result;
    When('the decision is evaluated', async () => {
      result = await definition.evaluate('nested', {});
    });

    Then('the nested context result was accessible to the final entry', () => {
      expect(result).to.equal(20);
    });
  });

  Scenario('a decision table as context entry', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="tableEntryDefinitions" name="Table entry" namespace="https://example.com/dmn/table-entry">
  <decision id="charge" name="Charge">
    <variable id="chargeVariable" name="Charge" />
    <context id="chargeContext">
      <contextEntry id="categoryEntry">
        <variable id="categoryVariable" name="Category" typeRef="string" />
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
      </contextEntry>
      <contextEntry id="chargeResultEntry">
        <literalExpression id="chargeResultExpression"><text>if Category = "adult" then 100 else 0</text></literalExpression>
      </contextEntry>
    </context>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where a context entry is a decision table', async () => {
      definition = new Definition(await testHelpers.context(source));
    });

    /** @type {any} */
    let result;
    When('the decision is evaluated with an adult age', async () => {
      result = await definition.evaluate('charge', { Age: 30 });
    });

    Then('the table entry result fed the final entry', () => {
      expect(result).to.equal(100);
    });
  });

  Scenario('a business knowledge model with context body', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="statsDefinitions" name="Stats" namespace="https://example.com/dmn/stats">
  <businessKnowledgeModel id="rectangle" name="Rectangle">
    <variable id="rectangleVariable" name="Rectangle" />
    <encapsulatedLogic id="rectangleLogic">
      <formalParameter id="widthParameter" name="width" typeRef="number" />
      <formalParameter id="heightParameter" name="height" typeRef="number" />
      <context id="rectangleContext">
        <contextEntry id="areaEntry">
          <variable id="areaVariable" name="area" />
          <literalExpression id="areaExpression"><text>width * height</text></literalExpression>
        </contextEntry>
        <contextEntry id="circumferenceEntry">
          <variable id="circumferenceVariable" name="circumference" />
          <literalExpression id="circumferenceExpression"><text>2 * (width + height)</text></literalExpression>
        </contextEntry>
      </context>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <decision id="measure" name="Measure">
    <variable id="measureVariable" name="Measure" />
    <knowledgeRequirement id="measureRequiresRectangle">
      <requiredKnowledge href="#rectangle" />
    </knowledgeRequirement>
    <literalExpression id="measureExpression"><text>Rectangle(4, 3).area</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where the function body is a context', async () => {
      definition = new Definition(await testHelpers.context(source));
    });

    /** @type {any} */
    let result;
    When('the decision picks a context entry from the invocation result', async () => {
      result = await definition.evaluate('measure', {});
    });

    Then('the context body produced the entry', () => {
      expect(result).to.equal(12);
    });
  });

  Scenario('an unsupported context entry expression', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="oddDefinitions" name="Odd" namespace="https://example.com/dmn/odd">
  <decision id="odd" name="Odd">
    <variable id="oddVariable" name="Odd" />
    <context id="oddContext">
      <contextEntry id="oddEntry">
        <variable id="oddEntryVariable" name="Entry" />
        <unaryTests id="oddTests" />
      </contextEntry>
    </context>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where a context entry is a unary tests expression', async () => {
      definition = new Definition(await testHelpers.context(source));
    });

    /** @type {any} */
    let error;
    When('the decision is evaluated', async () => {
      error = await definition.evaluate('odd', {}).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the unsupported entry expression', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/unsupported context entry expression dmn:UnaryTests/);
    });
  });
});
