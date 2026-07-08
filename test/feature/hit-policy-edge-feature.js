// @ts-check
import * as testHelpers from '../helpers/testHelpers.js';
import * as factory from '../helpers/factory.js';
import { Definition, DecisionError } from 'dmn-elements';

/**
 * @param {string | Buffer} source DMN XML
 * @param {import('#types').EnvironmentOptions} [options] environment options
 */
async function getDefinition(source, options) {
  return new Definition(await testHelpers.context(source, options));
}

const bonusTable = {
  id: 'bonus',
  hitPolicy: 'COLLECT',
  inputs: [{ text: 'Amount' }],
  outputs: [{ name: 'bonus' }],
  rules: [
    { input: ['> 0'], output: ['10'] },
    { input: ['> 100'], output: ['20'] },
  ],
};

Feature('hit policy edge cases', () => {
  Scenario('collect hit policy MIN and MAX aggregations', () => {
    /** @type {Definition} */
    let definition;
    Given('the bonus table with MIN aggregation', async () => {
      definition = await getDefinition(factory.decisionTableSource({ ...bonusTable, aggregation: 'MIN' }));
    });

    /** @type {any} */
    let result;
    When('evaluated with an amount matching both rules', async () => {
      result = await definition.evaluate('bonus', { Amount: 200 });
    });

    Then('the smallest output is returned', () => {
      expect(result).to.equal(10);
    });

    Given('the bonus table with MAX aggregation', async () => {
      definition = await getDefinition(factory.decisionTableSource({ ...bonusTable, aggregation: 'MAX' }));
    });

    When('evaluated with an amount matching both rules', async () => {
      result = await definition.evaluate('bonus', { Amount: 200 });
    });

    Then('the largest output is returned', () => {
      expect(result).to.equal(20);
    });
  });

  Scenario('collect aggregation over no matched rules', () => {
    /** @type {Definition} */
    let definition;
    Given('the bonus table with SUM aggregation', async () => {
      definition = await getDefinition(factory.decisionTableSource({ ...bonusTable, aggregation: 'SUM' }));
    });

    /** @type {any} */
    let result;
    When('evaluated with an amount matching no rule', async () => {
      result = await definition.evaluate('bonus', { Amount: -1 });
    });

    Then('the aggregation is null', () => {
      expect(result).to.be.null;
    });
  });

  Scenario('collect aggregation requires a single output', () => {
    /** @type {Definition} */
    let definition;
    Given('a collect SUM table with two outputs', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          ...bonusTable,
          aggregation: 'SUM',
          outputs: [{ name: 'bonus' }, { name: 'points' }],
          rules: [{ input: ['> 0'], output: ['10', '1'] }],
        })
      );
    });

    /** @type {any} */
    let error;
    When('evaluated with a matching amount', async () => {
      error = await definition.evaluate('bonus', { Amount: 200 }).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error requires a single output', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/single output/);
    });
  });

  Scenario('collect aggregation over non-numeric outputs', () => {
    /** @type {Definition} */
    let definition;
    Given('a collect SUM table where outputs are strings', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'perks',
          hitPolicy: 'COLLECT',
          aggregation: 'SUM',
          inputs: [{ text: 'Amount' }],
          outputs: [{ name: 'perk' }],
          rules: [
            { input: ['> 0'], output: ['"coffee"'] },
            { input: ['> 100'], output: ['"cake"'] },
          ],
        })
      );
    });

    /** @type {any} */
    let error;
    When('evaluated with an amount matching both rules', async () => {
      error = await definition.evaluate('perks', { Amount: 200 }).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error requires numeric outputs', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/numeric outputs/);
    });
  });

  Scenario('an unsupported collect aggregation', () => {
    /** @type {Definition} */
    let definition;
    Given('the bonus table with bogus AVG aggregation', async () => {
      definition = await getDefinition(factory.decisionTableSource({ ...bonusTable, aggregation: 'AVG' }));
    });

    /** @type {any} */
    let error;
    When('evaluated with a matching amount', async () => {
      error = await definition.evaluate('bonus', { Amount: 200 }).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the aggregation', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/aggregation AVG/);
    });
  });

  Scenario('an unsupported hit policy', () => {
    /** @type {Definition} */
    let definition;
    Given('a table with bogus hit policy MAGIC', async () => {
      definition = await getDefinition(factory.decisionTableSource({ ...bonusTable, hitPolicy: 'MAGIC' }));
    });

    /** @type {any} */
    let error;
    When('evaluated with a matching amount', async () => {
      error = await definition.evaluate('bonus', { Amount: 200 }).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the hit policy', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/hit policy MAGIC/);
    });
  });

  Scenario('priority hit policy requires output values', () => {
    /** @type {Definition} */
    let definition;
    Given('a PRIORITY table without output values', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'risk',
          hitPolicy: 'PRIORITY',
          inputs: [{ text: 'Amount' }],
          outputs: [{ name: 'risk' }],
          rules: [
            { input: ['> 0'], output: ['"Low"'] },
            { input: ['> 100'], output: ['"High"'] },
          ],
        })
      );
    });

    /** @type {any} */
    let error;
    When('evaluated with an amount matching both rules', async () => {
      error = await definition.evaluate('risk', { Amount: 200 }).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error requires output values', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/output values/);
    });
  });

  Scenario('output values that do not list a matched output', () => {
    /** @type {Definition} */
    let definition;
    Given('a PRIORITY table where a rule output is not listed in output values', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'risk',
          hitPolicy: 'PRIORITY',
          inputs: [{ text: 'Amount' }],
          outputs: [{ name: 'risk', outputValues: '"High","Low"' }],
          rules: [
            { input: ['> 0'], output: ['"Whatever"'] },
            { input: ['> 100'], output: ['"Low"'] },
          ],
        })
      );
    });

    /** @type {any} */
    let result;
    When('evaluated with an amount matching both rules', async () => {
      result = await definition.evaluate('risk', { Amount: 200 });
    });

    Then('the listed output outranks the unlisted', () => {
      expect(result).to.equal('Low');
    });
  });

  Scenario('output order over multiple output columns', () => {
    /** @type {Definition} */
    let definition;
    Given('the assessment resource with prioritized risk and action columns', async () => {
      definition = await getDefinition(testHelpers.resource('assessment.dmn'));
    });

    /** @type {any} */
    let result;
    When('evaluated', async () => {
      result = await definition.evaluate('assessment', { Amount: 1 });
    });

    Then('outputs are ordered column by column', () => {
      expect(result).to.deep.equal([
        { risk: 'High', action: 'stop' },
        { risk: 'High', action: 'go' },
        { risk: 'Low', action: 'go' },
        { risk: 'Low', action: 'go' },
      ]);
    });
  });

  Scenario('default output entries with multiple outputs', () => {
    /** @type {Definition} */
    let definition;
    Given('a two output table where only dish has a default', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'dinner',
          inputs: [{ text: 'Season' }],
          outputs: [{ name: 'dish', defaultOutputEntry: '"Pasta"' }, { name: 'wine' }],
          rules: [{ input: ['"Winter"'], output: ['"Roast beef"', '"Red"'] }],
        })
      );
    });

    /** @type {any} */
    let result;
    When('evaluated with an unmapped season', async () => {
      result = await definition.evaluate('dinner', { Season: 'Autumn' });
    });

    Then('defaults fill the result, missing defaults are null', () => {
      expect(result).to.deep.equal({ dish: 'Pasta', wine: null });
    });
  });
});
