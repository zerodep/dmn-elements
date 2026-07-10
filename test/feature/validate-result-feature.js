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

Feature('decision result validation', () => {
  Scenario('a decision result validated against the decision variable item definition', () => {
    /** @type {Definition} */
    let definition;
    Given(
      'a definition from the risk resource with the validateResult setting, where a catch-all rule outputs an unmapped class',
      async () => {
        definition = await getDefinition(testHelpers.resource('risk.dmn'), { settings: { validateResult: true } });
      }
    );

    /** @type {any} */
    let result;
    When('the risk class is evaluated with a mapped score', async () => {
      result = await definition.evaluate('riskClass', { Score: 30 });
    });

    Then('the valid result passed', () => {
      expect(result).to.equal('low');
    });

    /** @type {any} */
    let error;
    When('the risk class is evaluated with a score only the catch-all rule matches', async () => {
      error = await definition.evaluate('riskClass', { Score: 95 }).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the allowed values violation', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/violates allowed values of tRiskClass/);
    });
  });

  Scenario('result validation is off by default', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the risk resource without the setting', async () => {
      definition = await getDefinition(testHelpers.resource('risk.dmn'));
    });

    /** @type {any} */
    let result;
    When('the risk class is evaluated with a score only the catch-all rule matches', async () => {
      result = await definition.evaluate('riskClass', { Score: 95 });
    });

    Then('the unmapped result passed through untouched', () => {
      expect(result).to.equal('unmapped');
    });
  });

  Scenario('the validated result is coerced through the decision variable typeRef', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="answerDefinitions" name="Answer" namespace="https://example.com/dmn/answer">
  <decision id="answer" name="Answer">
    <variable id="answerVariable" name="Answer" typeRef="number" />
    <literalExpression id="answerExpression"><text>"42"</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition with the validateResult setting where a decision typed number yields a string', async () => {
      definition = await getDefinition(source, { settings: { validateResult: true } });
    });

    /** @type {any} */
    let result;
    When('the answer is evaluated', async () => {
      result = await definition.evaluate('answer', {});
    });

    Then('the result was coerced to a number', () => {
      expect(result).to.equal(42);
    });
  });
});
