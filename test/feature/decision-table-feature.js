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

Feature('decision table', () => {
  Scenario('unique hit policy, from the dinner resource', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the dinner resource', async () => {
      definition = await getDefinition(testHelpers.resource('dinner.dmn'));
    });

    /** @type {any} */

    let result;
    When('dish is evaluated with season Winter', async () => {
      result = await definition.evaluate('dish', { Season: 'Winter' });
    });

    Then('roast beef is served', () => {
      expect(result).to.equal('Roast beef');
    });

    When('dish is evaluated with season Summer', async () => {
      result = await definition.evaluate('dish', { Season: 'Summer' });
    });

    Then('a light salad is served', () => {
      expect(result).to.equal('Light salad');
    });

    When('dish is evaluated with an unmapped season', async () => {
      result = await definition.evaluate('dish', { Season: 'Spring' });
    });

    Then('nothing is served', () => {
      expect(result).to.be.null;
    });
  });

  Scenario('unique hit policy is violated', () => {
    /** @type {Definition} */
    let definition;
    Given('an inline source where age rules overlap', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'ageGroup',
          inputs: [{ text: 'Age' }],
          outputs: [{ name: 'group' }],
          rules: [
            { input: ['>= 18'], output: ['"adult"'] },
            { input: ['>= 65'], output: ['"senior"'] },
          ],
        })
      );
    });

    /** @type {any} */

    let error;
    When('evaluated with an age matching both rules', async () => {
      error = await definition.evaluate('ageGroup', { Age: 70 }).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error names the violated hit policy', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/UNIQUE/);
    });
  });

  Scenario('first hit policy takes the first matching rule', () => {
    /** @type {Definition} */
    let definition;
    Given('an inline source with overlapping rules and hit policy FIRST', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'ageGroup',
          hitPolicy: 'FIRST',
          inputs: [{ text: 'Age' }],
          outputs: [{ name: 'group' }],
          rules: [
            { input: ['>= 18'], output: ['"adult"'] },
            { input: ['>= 65'], output: ['"senior"'] },
          ],
        })
      );
    });

    /** @type {any} */

    let result;
    When('evaluated with an age matching both rules', async () => {
      result = await definition.evaluate('ageGroup', { Age: 70 });
    });

    Then('the first rule output is returned', () => {
      expect(result).to.equal('adult');
    });
  });

  Scenario('any hit policy requires equal outputs', () => {
    /** @type {Definition} */
    let definition;
    Given('an inline source where overlapping rules agree, with hit policy ANY', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'ageGroup',
          hitPolicy: 'ANY',
          inputs: [{ text: 'Age' }],
          outputs: [{ name: 'group' }],
          rules: [
            { input: ['>= 18'], output: ['"adult"'] },
            { input: ['> 17'], output: ['"adult"'] },
          ],
        })
      );
    });

    /** @type {any} */

    let result;
    When('evaluated with an age matching both rules', async () => {
      result = await definition.evaluate('ageGroup', { Age: 30 });
    });

    Then('the agreed output is returned', () => {
      expect(result).to.equal('adult');
    });

    Given('an inline source where overlapping rules disagree, with hit policy ANY', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'ageGroup',
          hitPolicy: 'ANY',
          inputs: [{ text: 'Age' }],
          outputs: [{ name: 'group' }],
          rules: [
            { input: ['>= 18'], output: ['"adult"'] },
            { input: ['>= 65'], output: ['"senior"'] },
          ],
        })
      );
    });

    /** @type {any} */

    let error;
    When('evaluated with an age matching both rules', async () => {
      error = await definition.evaluate('ageGroup', { Age: 70 }).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error names the violated hit policy', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/ANY/);
    });
  });

  Scenario('priority hit policy picks by output values order', () => {
    /** @type {Definition} */
    let definition;
    Given('an inline source with risk output values High, Medium, Low and hit policy PRIORITY', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'risk',
          hitPolicy: 'PRIORITY',
          inputs: [{ text: 'Amount' }],
          outputs: [{ name: 'risk', outputValues: '"High","Medium","Low"' }],
          rules: [
            { input: ['> 0'], output: ['"Low"'] },
            { input: ['> 100'], output: ['"High"'] },
          ],
        })
      );
    });

    /** @type {any} */

    let result;
    When('evaluated with an amount matching both rules', async () => {
      result = await definition.evaluate('risk', { Amount: 200 });
    });

    Then('the highest priority output wins', () => {
      expect(result).to.equal('High');
    });
  });

  Scenario('output order hit policy sorts outputs by priority', () => {
    /** @type {Definition} */
    let definition;
    Given('the risk table with hit policy OUTPUT ORDER', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'risk',
          hitPolicy: 'OUTPUT ORDER',
          inputs: [{ text: 'Amount' }],
          outputs: [{ name: 'risk', outputValues: '"High","Medium","Low"' }],
          rules: [
            { input: ['> 0'], output: ['"Low"'] },
            { input: ['> 100'], output: ['"High"'] },
          ],
        })
      );
    });

    /** @type {any} */

    let result;
    When('evaluated with an amount matching both rules', async () => {
      result = await definition.evaluate('risk', { Amount: 200 });
    });

    Then('outputs are returned in priority order', () => {
      expect(result).to.deep.equal(['High', 'Low']);
    });
  });

  Scenario('rule order hit policy returns outputs in rule order', () => {
    /** @type {Definition} */
    let definition;
    Given('the risk table with hit policy RULE ORDER', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'risk',
          hitPolicy: 'RULE ORDER',
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

    let result;
    When('evaluated with an amount matching both rules', async () => {
      result = await definition.evaluate('risk', { Amount: 200 });
    });

    Then('outputs are returned in rule order', () => {
      expect(result).to.deep.equal(['Low', 'High']);
    });

    When('evaluated with an amount matching no rule', async () => {
      result = await definition.evaluate('risk', { Amount: -1 });
    });

    Then('an empty list is returned', () => {
      expect(result).to.deep.equal([]);
    });
  });

  Scenario('collect hit policy, with and without aggregation', () => {
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

    /** @type {Definition} */

    let definition;
    Given('the collect bonus resource without aggregation', async () => {
      definition = await getDefinition(testHelpers.resource('bonus.dmn'));
    });

    /** @type {any} */

    let result;
    When('evaluated with an amount matching both rules', async () => {
      result = await definition.evaluate('bonus', { Amount: 200 });
    });

    Then('all matched outputs are collected', () => {
      expect(result).to.deep.equal([10, 20]);
    });

    Given('the same table with SUM aggregation', async () => {
      definition = await getDefinition(factory.decisionTableSource({ ...bonusTable, aggregation: 'SUM' }));
    });

    When('evaluated with an amount matching both rules', async () => {
      result = await definition.evaluate('bonus', { Amount: 200 });
    });

    Then('the outputs are summed', () => {
      expect(result).to.equal(30);
    });

    Given('the same table with COUNT aggregation', async () => {
      definition = await getDefinition(factory.decisionTableSource({ ...bonusTable, aggregation: 'COUNT' }));
    });

    When('evaluated with an amount matching both rules', async () => {
      result = await definition.evaluate('bonus', { Amount: 200 });
    });

    Then('the outputs are counted', () => {
      expect(result).to.equal(2);
    });
  });

  Scenario('multiple outputs form a result object', () => {
    /** @type {Definition} */
    let definition;
    Given('an inline source with dish and wine outputs', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'dinner',
          inputs: [{ text: 'Season' }],
          outputs: [{ name: 'dish' }, { name: 'wine' }],
          rules: [{ input: ['"Winter"'], output: ['"Roast beef"', '"Red"'] }],
        })
      );
    });

    /** @type {any} */

    let result;
    When('evaluated with season Winter', async () => {
      result = await definition.evaluate('dinner', { Season: 'Winter' });
    });

    Then('the result is keyed by output name', () => {
      expect(result).to.deep.equal({ dish: 'Roast beef', wine: 'Red' });
    });
  });

  Scenario('irrelevant input entries match anything', () => {
    /** @type {Definition} */
    let definition;
    Given('an inline source where the single rule input entry is a dash', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'fallback',
          inputs: [{ text: 'Season' }],
          outputs: [{ name: 'dish' }],
          rules: [{ input: ['-'], output: ['"Stew"'] }],
        })
      );
    });

    /** @type {any} */

    let result;
    When('evaluated with any season', async () => {
      result = await definition.evaluate('fallback', { Season: 'Whenever' });
    });

    Then('the rule matches', () => {
      expect(result).to.equal('Stew');
    });
  });

  Scenario('default output entry applies when no rule matches', () => {
    /** @type {Definition} */
    let definition;
    Given('an inline source with a default output entry', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'dinner',
          inputs: [{ text: 'Season' }],
          outputs: [{ name: 'dish', defaultOutputEntry: '"Pasta"' }],
          rules: [{ input: ['"Winter"'], output: ['"Roast beef"'] }],
        })
      );
    });

    /** @type {any} */

    let result;
    When('evaluated with an unmapped season', async () => {
      result = await definition.evaluate('dinner', { Season: 'Autumn' });
    });

    Then('the default output is returned', () => {
      expect(result).to.equal('Pasta');
    });
  });
});
