// @ts-check
import * as testHelpers from '../helpers/testHelpers.js';
import { Definition, DecisionError } from 'dmn-elements';

const circularSource = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="circularDefinitions" name="Circular" namespace="https://example.com/dmn/circular">
  <decision id="chicken" name="Chicken">
    <informationRequirement id="chickenRequiresEgg">
      <requiredDecision href="#egg" />
    </informationRequirement>
    <literalExpression id="chickenExpression"><text>Egg</text></literalExpression>
  </decision>
  <decision id="egg" name="Egg">
    <informationRequirement id="eggRequiresChicken">
      <requiredDecision href="#chicken" />
    </informationRequirement>
    <literalExpression id="eggExpression"><text>Chicken</text></literalExpression>
  </decision>
</definitions>`;

Feature('definition', () => {
  Scenario('a decision requires another decision', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the membership resource where fee requires category which requires age input', async () => {
      definition = new Definition(await testHelpers.context(testHelpers.resource('membership.dmn')));
    });

    /** @type {any} */

    let result;
    When('fee is evaluated with an adult age', async () => {
      result = await definition.evaluate('fee', { Age: 30 });
    });

    Then('the dependent category decision fed the fee decision', () => {
      expect(result).to.equal(100);
    });

    When('fee is evaluated with a minor age', async () => {
      result = await definition.evaluate('fee', { Age: 12 });
    });

    Then('the minor fee is returned', () => {
      expect(result).to.equal(0);
    });
  });

  Scenario('evaluate with a node style callback', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the dinner resource', async () => {
      definition = new Definition(await testHelpers.context(testHelpers.resource('dinner.dmn')));
    });

    /** @type {any} */

    let result;
    When('dish is evaluated passing a callback', (done) => {
      definition.evaluate('dish', { Season: 'Winter' }, (err, res) => {
        if (err) return done(err);
        result = res;
        done();
      });
    });

    Then('the callback received the result', () => {
      expect(result).to.equal('Roast beef');
    });
  });

  Scenario('an unknown decision is addressed', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the dinner resource', async () => {
      definition = new Definition(await testHelpers.context(testHelpers.resource('dinner.dmn')));
    });

    /** @type {any} */

    let error;
    When('an unknown decision id is evaluated', async () => {
      error = await definition.evaluate('dessert', { Season: 'Winter' }).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the unknown decision', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/dessert.*not found/);
    });
  });

  Scenario('a definition evaluates repeatedly with stable results', () => {
    /** @type {Definition} */
    let definition;
    const input = { Season: 'Winter' };
    Given('a definition from the dinner resource with environment variables', async () => {
      definition = new Definition(await testHelpers.context(testHelpers.resource('dinner.dmn'), { variables: { untouched: true } }));
    });

    /** @type {any[]} */
    let results;
    When('dish is evaluated three times with the same input object', async () => {
      results = [
        await definition.evaluate('dish', input),
        await definition.evaluate('dish', input),
        await definition.evaluate('dish', input),
      ];
    });

    Then('every run produced the same result', () => {
      expect(results).to.deep.equal(['Roast beef', 'Roast beef', 'Roast beef']);
    });

    When('evaluations with different input interleave', async () => {
      results = await Promise.all([
        definition.evaluate('dish', input),
        definition.evaluate('dish', { Season: 'Summer' }),
        definition.evaluate('dish', input),
      ]);
    });

    Then('each run got the result of its own input', () => {
      expect(results).to.deep.equal(['Roast beef', 'Light salad', 'Roast beef']);
    });

    And('the caller input object was not mutated', () => {
      expect(input).to.deep.equal({ Season: 'Winter' });
    });

    And('the environment was not mutated', () => {
      expect(definition.environment.variables).to.deep.equal({ untouched: true });
      expect(definition.environment.output).to.deep.equal({});
    });
  });

  Scenario('decisions require each other', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source with circular requirements', async () => {
      definition = new Definition(await testHelpers.context(circularSource));
    });

    /** @type {any} */

    let error;
    When('one of the circular decisions is evaluated', async () => {
      error = await definition.evaluate('chicken', {}).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the circular requirement', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/circular/i);
    });
  });
});
