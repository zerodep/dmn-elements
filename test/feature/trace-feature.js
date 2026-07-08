// @ts-check
import * as testHelpers from '../helpers/testHelpers.js';
import { Definition } from 'dmn-elements';

Feature('evaluation trace', () => {
  Scenario('tracing dependent decision tables', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the membership resource', async () => {
      definition = new Definition(await testHelpers.context(testHelpers.resource('membership.dmn')));
    });

    /** @type {any} */
    let traced;
    When('fee is traced with an adult age', async () => {
      traced = await definition.trace('fee', { Age: 30 });
    });

    Then('the result is the evaluated fee', () => {
      expect(traced.result).to.equal(100);
    });

    And('the trace holds both decisions in completion order', () => {
      expect(traced.trace.map((/** @type {any} */ entry) => entry.id)).to.deep.equal(['category', 'fee']);
    });

    And('the category entry tells which rule matched and how', () => {
      const [category] = traced.trace;
      expect(category).to.deep.include({
        type: 'dmn:Decision',
        name: 'Category',
        decisionLogic: 'dmn:DecisionTable',
        hitPolicy: 'UNIQUE',
        result: 'adult',
      });
      expect(category.matchedRules).to.deep.equal(['adultRule']);
    });

    And('the category entry binds the age input data with its value', () => {
      const [category] = traced.trace;
      expect(category.requirements).to.deep.equal([
        { id: 'categoryRequiresAge', required: 'ageInput', type: 'dmn:InputData', bound: 'Age', value: 30 },
      ]);
    });

    And('the fee entry binds the category result', () => {
      const fee = traced.trace[1];
      expect(fee.matchedRules).to.deep.equal(['adultFeeRule']);
      expect(fee.requirements).to.deep.equal([
        { id: 'feeRequiresCategory', required: 'category', type: 'dmn:Decision', bound: 'Category', value: 'adult' },
      ]);
    });
  });

  Scenario('tracing a business knowledge model invocation', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the discount resource', async () => {
      definition = new Definition(await testHelpers.context(testHelpers.resource('discount.dmn')));
    });

    /** @type {any} */
    let traced;
    When('price is traced', async () => {
      traced = await definition.trace('price', { Amount: 100 });
    });

    Then('the result is the discounted price', () => {
      expect(traced.result).to.equal(90);
    });

    And('the trace holds the knowledge binding and the decision', () => {
      expect(traced.trace.map((/** @type {any} */ entry) => entry.id)).to.deep.equal(['applyDiscount', 'price']);
      expect(traced.trace[0]).to.deep.include({ type: 'dmn:BusinessKnowledgeModel', name: 'Apply discount' });
    });

    And('the price entry shows the literal expression and its requirements', () => {
      const price = traced.trace[1];
      expect(price).to.deep.include({ decisionLogic: 'dmn:LiteralExpression', result: 90 });
      expect(price.requirements).to.deep.equal([
        { id: 'priceRequiresAmount', required: 'amountInput', type: 'dmn:InputData', bound: 'Amount', value: 100 },
        { id: 'priceRequiresDiscount', required: 'applyDiscount', type: 'dmn:BusinessKnowledgeModel', bound: 'Apply discount' },
      ]);
    });
  });

  Scenario('a memoized decision is traced once', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the diamond resource', async () => {
      definition = new Definition(await testHelpers.context(testHelpers.resource('diamond.dmn')));
    });

    /** @type {any} */
    let traced;
    When('top is traced', async () => {
      traced = await definition.trace('top', { Next: () => 1 });
    });

    Then('base appears once although required twice', () => {
      expect(traced.result).to.be.true;
      expect(traced.trace.map((/** @type {any} */ entry) => entry.id)).to.deep.equal(['base', 'left', 'right', 'top']);
    });
  });

  Scenario('tracing with a node style callback', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the dinner resource', async () => {
      definition = new Definition(await testHelpers.context(testHelpers.resource('dinner.dmn')));
    });

    /** @type {any} */
    let traced;
    When('dish is traced passing a callback', (done) => {
      definition.trace('dish', { Season: 'Winter' }, (err, result) => {
        if (err) return done(err);
        traced = result;
        done();
      });
    });

    Then('the callback received result and trace', () => {
      expect(traced.result).to.equal('Roast beef');
      expect(traced.trace).to.have.length(1);
      expect(traced.trace[0].matchedRules).to.deep.equal(['winterRule']);
    });

    When('dish is traced with only a callback', (done) => {
      definition.trace('dish', (err, result) => {
        if (err) return done(err);
        traced = result;
        done();
      });
    });

    Then('no rule matched without input, which the trace shows', () => {
      expect(traced.result).to.be.null;
      expect(traced.trace[0].matchedRules).to.deep.equal([]);
    });
  });

  Scenario('evaluate is unaffected by tracing', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the dinner resource', async () => {
      definition = new Definition(await testHelpers.context(testHelpers.resource('dinner.dmn')));
    });

    /** @type {any} */
    let result;
    When('dish is evaluated', async () => {
      result = await definition.evaluate('dish', { Season: 'Winter' });
    });

    Then('the bare result is returned', () => {
      expect(result).to.equal('Roast beef');
    });
  });
});
