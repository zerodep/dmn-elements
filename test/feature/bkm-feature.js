// @ts-check
import * as testHelpers from '../helpers/testHelpers.js';
import { Definition, DecisionError } from 'dmn-elements';

const feeSource = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="feeDefinitions" name="Fee" namespace="https://example.com/dmn/fee">
  <businessKnowledgeModel id="feeByAge" name="Fee by age">
    <variable id="feeByAgeVariable" name="Fee by age" />
    <encapsulatedLogic id="feeByAgeLogic">
      <formalParameter id="ageParameter" name="age" typeRef="number" />
      <decisionTable id="feeByAgeTable">
        <input id="feeByAgeInput"><inputExpression id="feeByAgeInputExpression" typeRef="number"><text>age</text></inputExpression></input>
        <output id="feeByAgeOutput" name="fee" typeRef="number" />
        <rule id="adultFeeRule">
          <inputEntry id="adultFeeEntry"><text>&gt;= 18</text></inputEntry>
          <outputEntry id="adultFeeAmount"><text>100</text></outputEntry>
        </rule>
        <rule id="minorFeeRule">
          <inputEntry id="minorFeeEntry"><text>&lt; 18</text></inputEntry>
          <outputEntry id="minorFeeAmount"><text>0</text></outputEntry>
        </rule>
      </decisionTable>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <decision id="fee" name="Fee">
    <variable id="feeVariable" name="Fee" />
    <knowledgeRequirement id="feeRequiresFeeByAge">
      <requiredKnowledge href="#feeByAge" />
    </knowledgeRequirement>
    <literalExpression id="feeExpression"><text>Fee by age(Age)</text></literalExpression>
  </decision>
</definitions>`;

const chainedSource = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="chainedDefinitions" name="Chained" namespace="https://example.com/dmn/chained">
  <businessKnowledgeModel id="vat" name="Vat">
    <variable id="vatVariable" name="Vat" />
    <encapsulatedLogic id="vatLogic">
      <formalParameter id="vatAmountParameter" name="amount" typeRef="number" />
      <literalExpression id="vatBody"><text>amount * 0.25</text></literalExpression>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <businessKnowledgeModel id="netPrice" name="Net price">
    <variable id="netPriceVariable" name="Net price" />
    <encapsulatedLogic id="netPriceLogic">
      <formalParameter id="netAmountParameter" name="amount" typeRef="number" />
      <literalExpression id="netPriceBody"><text>amount + Vat(amount)</text></literalExpression>
    </encapsulatedLogic>
    <knowledgeRequirement id="netPriceRequiresVat">
      <requiredKnowledge href="#vat" />
    </knowledgeRequirement>
  </businessKnowledgeModel>
  <decision id="total" name="Total">
    <variable id="totalVariable" name="Total" />
    <knowledgeRequirement id="totalRequiresNetPrice">
      <requiredKnowledge href="#netPrice" />
    </knowledgeRequirement>
    <literalExpression id="totalExpression"><text>Net price(Amount)</text></literalExpression>
  </decision>
</definitions>`;

Feature('business knowledge model', () => {
  Scenario('a decision invokes a business knowledge model as a FEEL function', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the discount resource where price requires the apply discount function', async () => {
      definition = new Definition(await testHelpers.context(testHelpers.resource('discount.dmn')));
    });

    /** @type {any} */
    let result;
    When('price is evaluated with an amount', async () => {
      result = await definition.evaluate('price', { Amount: 100 });
    });

    Then('the invoked function applied the discount', () => {
      expect(result).to.equal(90);
    });
  });

  Scenario('a business knowledge model with a decision table body', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where the fee function is a decision table', async () => {
      definition = new Definition(await testHelpers.context(feeSource));
    });

    /** @type {any} */
    let result;
    When('fee is evaluated with an adult age', async () => {
      result = await definition.evaluate('fee', { Age: 30 });
    });

    Then('the decision table body resolved the fee', () => {
      expect(result).to.equal(100);
    });

    When('fee is evaluated with a minor age', async () => {
      result = await definition.evaluate('fee', { Age: 12 });
    });

    Then('the minor fee is returned', () => {
      expect(result).to.equal(0);
    });
  });

  Scenario('a business knowledge model requiring another business knowledge model', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where net price invokes vat', async () => {
      definition = new Definition(await testHelpers.context(chainedSource));
    });

    /** @type {any} */
    let result;
    When('total is evaluated with an amount', async () => {
      result = await definition.evaluate('total', { Amount: 100 });
    });

    Then('the chained functions produced the total', () => {
      expect(result).to.equal(125);
    });
  });

  Scenario('encapsulated logic sees only its parameters and required knowledge', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="scopeDefinitions" name="Scope" namespace="https://example.com/dmn/scope">
  <businessKnowledgeModel id="reveal" name="Reveal">
    <variable id="revealVariable" name="Reveal" />
    <encapsulatedLogic id="revealLogic">
      <literalExpression id="revealBody"><text>Secret</text></literalExpression>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <decision id="leak" name="Leak">
    <variable id="leakVariable" name="Leak" />
    <knowledgeRequirement id="leakRequiresReveal">
      <requiredKnowledge href="#reveal" />
    </knowledgeRequirement>
    <literalExpression id="leakExpression"><text>Reveal()</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where the function body references a caller variable', async () => {
      definition = new Definition(await testHelpers.context(source));
    });

    /** @type {any} */
    let result;
    When('the decision is evaluated with the variable in evaluation input', async () => {
      result = await definition.evaluate('leak', { Secret: 42 });
    });

    Then('the closed function scope did not see it', () => {
      expect(result).to.be.null;
    });
  });

  Scenario('a business knowledge model with unsupported logic kind', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="javaDefinitions" name="Java" namespace="https://example.com/dmn/java">
  <businessKnowledgeModel id="javaRules" name="Java rules">
    <encapsulatedLogic id="javaLogic" kind="Java">
      <literalExpression id="javaBody"><text>1</text></literalExpression>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <decision id="javaDecision" name="Java decision">
    <knowledgeRequirement id="javaDecisionRequiresRules">
      <requiredKnowledge href="#javaRules" />
    </knowledgeRequirement>
    <literalExpression id="javaDecisionExpression"><text>Java rules()</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source with Java encapsulated logic', async () => {
      definition = new Definition(await testHelpers.context(source));
    });

    /** @type {any} */
    let error;
    When('the requiring decision is evaluated', async () => {
      error = await definition.evaluate('javaDecision', {}).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the unsupported kind', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/kind Java/);
    });
  });

  Scenario('a business knowledge model with unsupported body', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="bodyDefinitions" name="Body" namespace="https://example.com/dmn/body">
  <businessKnowledgeModel id="contextRules" name="Context rules">
    <encapsulatedLogic id="contextLogic">
      <relation id="relationBody" />
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <decision id="contextDecision" name="Context decision">
    <knowledgeRequirement id="contextDecisionRequiresRules">
      <requiredKnowledge href="#contextRules" />
    </knowledgeRequirement>
    <literalExpression id="contextDecisionExpression"><text>Context rules()</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where the encapsulated logic body is a relation', async () => {
      definition = new Definition(await testHelpers.context(source));
    });

    /** @type {any} */
    let error;
    When('the requiring decision is evaluated', async () => {
      error = await definition.evaluate('contextDecision', {}).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the unsupported body', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/unsupported encapsulated logic body dmn:Relation/);
    });
  });

  Scenario('a knowledge source as required knowledge', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="manualDefinitions" name="Manual" namespace="https://example.com/dmn/manual">
  <decision id="documented" name="Documented">
    <knowledgeRequirement id="documentedRequiresManual">
      <requiredKnowledge href="#policyManual" />
    </knowledgeRequirement>
    <literalExpression id="documentedExpression"><text>1</text></literalExpression>
  </decision>
  <knowledgeSource id="policyManual" name="Policy manual" />
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where required knowledge points at a knowledge source', async () => {
      definition = new Definition(await testHelpers.context(source));
    });

    /** @type {any} */
    let error;
    When('the decision is evaluated', async () => {
      error = await definition.evaluate('documented', {}).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the unsupported target', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/unsupported target dmn:KnowledgeSource/);
    });
  });

  Scenario('circular knowledge requirements', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="loopDefinitions" name="Loop" namespace="https://example.com/dmn/loop">
  <businessKnowledgeModel id="pingRules" name="Ping">
    <encapsulatedLogic id="pingLogic">
      <literalExpression id="pingBody"><text>Pong()</text></literalExpression>
    </encapsulatedLogic>
    <knowledgeRequirement id="pingRequiresPong">
      <requiredKnowledge href="#pongRules" />
    </knowledgeRequirement>
  </businessKnowledgeModel>
  <businessKnowledgeModel id="pongRules" name="Pong">
    <encapsulatedLogic id="pongLogic">
      <literalExpression id="pongBody"><text>Ping()</text></literalExpression>
    </encapsulatedLogic>
    <knowledgeRequirement id="pongRequiresPing">
      <requiredKnowledge href="#pingRules" />
    </knowledgeRequirement>
  </businessKnowledgeModel>
  <decision id="rally" name="Rally">
    <knowledgeRequirement id="rallyRequiresPing">
      <requiredKnowledge href="#pingRules" />
    </knowledgeRequirement>
    <literalExpression id="rallyExpression"><text>Ping()</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source with mutually required functions', async () => {
      definition = new Definition(await testHelpers.context(source));
    });

    /** @type {any} */
    let error;
    When('the requiring decision is evaluated', async () => {
      error = await definition.evaluate('rally', {}).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the circular requirement', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/circular/i);
    });
  });
});
