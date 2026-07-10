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

Feature('relation decision logic', () => {
  Scenario('a decision with boxed relation logic', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the fees resource where the fee schedule is a relation', async () => {
      definition = await getDefinition(testHelpers.resource('fees.dmn'));
    });

    /** @type {any} */
    let result;
    When('the fee schedule is evaluated directly', async () => {
      result = await definition.evaluate('feeSchedule', {});
    });

    Then('the relation produced one context per row keyed by column name', () => {
      expect(result).to.deep.equal([
        { level: 'gold', fee: 0 },
        { level: 'silver', fee: 5 },
        { level: 'bronze', fee: 10 },
      ]);
    });

    When('the applicable fee is evaluated for a silver member', async () => {
      result = await definition.evaluate('applicableFee', { Level: 'silver' });
    });

    Then('the requiring decision filtered the relation rows', () => {
      expect(result).to.equal(5);
    });

    /** @type {any} */
    let traced;
    When('the applicable fee is traced', async () => {
      traced = await definition.trace('applicableFee', { Level: 'gold' });
    });

    Then('the fee schedule trace entry declares relation decision logic', () => {
      const entry = traced.trace.find((/** @type {any} */ e) => e.id === 'feeSchedule');
      expect(entry.decisionLogic).to.equal('dmn:Relation');
      expect(traced.result).to.equal(0);
    });
  });

  Scenario('a short row pads with null and column typeRef coerces cells', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="ratesDefinitions" name="Rates" namespace="https://example.com/dmn/rates">
  <decision id="rates" name="Rates">
    <variable id="ratesVariable" name="Rates" />
    <relation id="ratesRelation">
      <column id="nameColumn" name="name" typeRef="string" />
      <column id="rateColumn" name="rate" typeRef="number" />
      <row id="fixedRow">
        <literalExpression id="fixedName"><text>"fixed"</text></literalExpression>
        <literalExpression id="fixedRate"><text>"4.5"</text></literalExpression>
      </row>
      <row id="openRow">
        <literalExpression id="openName"><text>"open"</text></literalExpression>
      </row>
    </relation>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source with a string cell in a number column and a row missing its last cell', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the rates are evaluated', async () => {
      result = await definition.evaluate('rates', {});
    });

    Then('the cell was coerced and the missing cell is null', () => {
      expect(result).to.deep.equal([
        { name: 'fixed', rate: 4.5 },
        { name: 'open', rate: null },
      ]);
    });
  });

  Scenario('relation cells evaluate in the decision input scope', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="scopedDefinitions" name="Scoped" namespace="https://example.com/dmn/scoped">
  <inputData id="baseInput" name="Base">
    <variable id="baseVariable" name="Base" typeRef="number" />
  </inputData>
  <decision id="tiers" name="Tiers">
    <variable id="tiersVariable" name="Tiers" />
    <informationRequirement id="tiersRequiresBase">
      <requiredInput href="#baseInput" />
    </informationRequirement>
    <relation id="tiersRelation">
      <column id="tierColumn" name="tier" typeRef="string" />
      <column id="priceColumn" name="price" typeRef="number" />
      <row id="smallRow">
        <literalExpression id="smallTier"><text>"small"</text></literalExpression>
        <literalExpression id="smallPrice"><text>Base</text></literalExpression>
      </row>
      <row id="largeRow">
        <literalExpression id="largeTier"><text>"large"</text></literalExpression>
        <literalExpression id="largePrice"><text>Base * 2</text></literalExpression>
      </row>
    </relation>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where cells reference required input data', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the tiers are evaluated', async () => {
      result = await definition.evaluate('tiers', { Base: 10 });
    });

    Then('the cells saw the bound input', () => {
      expect(result).to.deep.equal([
        { tier: 'small', price: 10 },
        { tier: 'large', price: 20 },
      ]);
    });
  });

  Scenario('a relation as context entry', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="productDefinitions" name="Product" namespace="https://example.com/dmn/product">
  <decision id="cheapest" name="Cheapest">
    <variable id="cheapestVariable" name="Cheapest" />
    <context id="cheapestContext">
      <contextEntry id="productsEntry">
        <variable id="productsVariable" name="Products" />
        <relation id="productsRelation">
          <column id="productColumn" name="product" typeRef="string" />
          <column id="priceColumn" name="price" typeRef="number" />
          <row id="basicRow">
            <literalExpression id="basicProduct"><text>"basic"</text></literalExpression>
            <literalExpression id="basicPrice"><text>10</text></literalExpression>
          </row>
          <row id="premiumRow">
            <literalExpression id="premiumProduct"><text>"premium"</text></literalExpression>
            <literalExpression id="premiumPrice"><text>25</text></literalExpression>
          </row>
        </relation>
      </contextEntry>
      <contextEntry id="cheapestResultEntry">
        <literalExpression id="cheapestResultExpression"><text>Products[price = min(Products.price)].product[1]</text></literalExpression>
      </contextEntry>
    </context>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where a context entry is a relation', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the cheapest product is evaluated', async () => {
      result = await definition.evaluate('cheapest', {});
    });

    Then('the final result entry filtered the relation entry', () => {
      expect(result).to.equal('basic');
    });
  });

  Scenario('a business knowledge model with relation body', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="scheduleDefinitions" name="Schedule" namespace="https://example.com/dmn/schedule">
  <businessKnowledgeModel id="schedule" name="Schedule">
    <variable id="scheduleVariable" name="Schedule" />
    <encapsulatedLogic id="scheduleLogic">
      <formalParameter id="factorParameter" name="factor" typeRef="number" />
      <relation id="scheduleRelation">
        <column id="periodColumn" name="period" typeRef="string" />
        <column id="amountColumn" name="amount" typeRef="number" />
        <row id="monthlyRow">
          <literalExpression id="monthlyPeriod"><text>"monthly"</text></literalExpression>
          <literalExpression id="monthlyAmount"><text>10 * factor</text></literalExpression>
        </row>
      </relation>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <decision id="monthly" name="Monthly">
    <variable id="monthlyVariable" name="Monthly" />
    <knowledgeRequirement id="monthlyRequiresSchedule">
      <requiredKnowledge href="#schedule" />
    </knowledgeRequirement>
    <literalExpression id="monthlyExpression"><text>Schedule(3)[1].amount</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where the function body is a relation', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the decision picks a row from the invocation result', async () => {
      result = await definition.evaluate('monthly', {});
    });

    Then('the relation body produced the row', () => {
      expect(result).to.equal(30);
    });
  });

  Scenario('relation errors', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where a column has no name', async () => {
      definition = await getDefinition(`<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="unnamedDefinitions" name="Unnamed" namespace="https://example.com/dmn/unnamed">
  <decision id="unnamed" name="Unnamed">
    <variable id="unnamedVariable" name="Unnamed" />
    <relation id="unnamedRelation">
      <column id="unnamedColumn" typeRef="string" />
      <row id="unnamedRow">
        <literalExpression id="unnamedCell"><text>"x"</text></literalExpression>
      </row>
    </relation>
  </decision>
</definitions>`);
    });

    /** @type {any} */
    let error;
    When('the decision is evaluated', async () => {
      error = await definition.evaluate('unnamed', {}).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the unnamed column', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/relation column is missing a name/);
    });

    Given('a definition from an inline source where a cell is an unsupported expression', async () => {
      definition = await getDefinition(`<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="oddCellDefinitions" name="Odd cell" namespace="https://example.com/dmn/odd-cell">
  <decision id="oddCell" name="Odd cell">
    <variable id="oddCellVariable" name="Odd cell" />
    <relation id="oddCellRelation">
      <column id="oddCellColumn" name="value" />
      <row id="oddCellRow">
        <unaryTests id="oddCellTests" />
      </row>
    </relation>
  </decision>
</definitions>`);
    });

    When('the decision is evaluated', async () => {
      error = await definition.evaluate('oddCell', {}).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the unsupported cell expression', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/unsupported relation cell expression dmn:UnaryTests/);
    });
  });
});
