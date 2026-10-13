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

  Scenario('a date result widens to the date and time declared on the decision variable', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="dueDefinitions" name="Due" namespace="https://example.com/dmn/due">
  <decision id="dueAt" name="Due at">
    <variable id="dueAtVariable" name="Due at" typeRef="date and time" />
    <literalExpression id="dueAtExpression"><text>date(2000, 1, 2)</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition with a decision typed date and time whose logic yields a date, with the validateResult setting', async () => {
      definition = await getDefinition(source, { settings: { validateResult: true } });
    });

    /** @type {any} */
    let result;
    When('the decision is evaluated', async () => {
      result = await definition.evaluate('dueAt', {});
    });

    Then('the result is the date and time at midnight UTC', () => {
      expect(definition.environment.resolveExpression('r = date and time("2000-01-02T00:00:00Z")', { r: result })).to.be.true;
    });
  });

  Scenario('invocable results validated against the function item output type', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="scoresDefinitions" name="Scores" namespace="https://example.com/dmn/scores">
  <itemDefinition id="tScores" name="tScores" isCollection="true">
    <typeRef>number</typeRef>
  </itemDefinition>
  <itemDefinition id="fnScores" name="fnScores">
    <functionItem id="fnScoresItem" outputTypeRef="tScores" />
  </itemDefinition>
  <itemDefinition id="fnNumber" name="fnNumber">
    <functionItem id="fnNumberItem" outputTypeRef="number" />
  </itemDefinition>
  <businessKnowledgeModel id="seven" name="Seven">
    <variable id="sevenVariable" name="Seven" typeRef="fnScores" />
    <encapsulatedLogic id="sevenLogic" kind="FEEL">
      <literalExpression id="sevenExpression"><text>7</text></literalExpression>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <businessKnowledgeModel id="plainSeven" name="Plain seven">
    <variable id="plainSevenVariable" name="Plain seven" typeRef="tScores" />
    <encapsulatedLogic id="plainSevenLogic" kind="FEEL">
      <literalExpression id="plainSevenExpression"><text>7</text></literalExpression>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <businessKnowledgeModel id="word" name="Word">
    <variable id="wordVariable" name="Word" typeRef="fnNumber" />
    <encapsulatedLogic id="wordLogic" kind="FEEL">
      <literalExpression id="wordExpression"><text>"abc"</text></literalExpression>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <decisionService id="scoresService" name="Scores service">
    <variable id="scoresServiceVariable" name="Scores service" typeRef="fnScores" />
    <outputDecision href="#body" />
  </decisionService>
  <decisionService id="wordService" name="Word service">
    <variable id="wordServiceVariable" name="Word service" typeRef="fnNumber" />
    <outputDecision href="#wordBody" />
  </decisionService>
  <decision id="body" name="Body">
    <variable id="bodyVariable" name="Body" />
    <literalExpression id="bodyExpression"><text>7</text></literalExpression>
  </decision>
  <decision id="wordBody" name="Word body">
    <variable id="wordBodyVariable" name="Word body" />
    <literalExpression id="wordBodyExpression"><text>"abc"</text></literalExpression>
  </decision>
  <decision id="viaFeel" name="Via FEEL">
    <variable id="viaFeelVariable" name="Via FEEL" />
    <knowledgeRequirement id="viaFeelRequiresService">
      <requiredKnowledge href="#scoresService" />
    </knowledgeRequirement>
    <literalExpression id="viaFeelExpression"><text>Scores service()</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition with invocables typed by function item definitions, with the validateResult setting', async () => {
      definition = await getDefinition(source, { settings: { validateResult: true } });
    });

    /** @type {any} */
    let result;
    When('the business knowledge model returning a scalar is evaluated directly', async () => {
      result = await definition.evaluate('seven', {});
    });

    Then('the result widened to the declared output collection', () => {
      expect(result).to.deep.equal([7]);
    });

    When('the decision service returning a scalar is evaluated directly', async () => {
      result = await definition.evaluate('scoresService', {});
    });

    Then('the service result widened to the declared output collection', () => {
      expect(result).to.deep.equal([7]);
    });

    When('a decision invokes the decision service from FEEL', async () => {
      result = await definition.evaluate('viaFeel', {});
    });

    Then('the invocation result widened as well', () => {
      expect(result).to.deep.equal([7]);
    });

    When('a business knowledge model whose variable type is no function item is evaluated', async () => {
      result = await definition.evaluate('plainSeven', {});
    });

    Then('the result passed through untouched', () => {
      expect(result).to.equal(7);
    });

    /** @type {any} */
    let error;
    When('a business knowledge model returning a value outside its output type is evaluated', async () => {
      error = await definition.evaluate('word', {}).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the failed coercion', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/cannot coerce "abc" to number/);
    });

    When('a decision service returning a value outside its output type is evaluated', async () => {
      error = await definition.evaluate('wordService', {}).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the failed service result coercion', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/cannot coerce "abc" to number/);
    });

    Given('the same definition without the setting', async () => {
      definition = await getDefinition(source);
    });

    When('the business knowledge model returning a scalar is evaluated directly', async () => {
      result = await definition.evaluate('seven', {});
    });

    Then('the scalar passed through', () => {
      expect(result).to.equal(7);
    });
  });

  Scenario('a failing decision with result validation', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition with the validateResult setting where a UNIQUE table has two catch-all rules', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'clash',
          inputs: [{ text: 'Amount' }],
          outputs: [{ name: 'value', typeRef: 'number' }],
          rules: [
            { input: ['-'], output: ['1'] },
            { input: ['-'], output: ['2'] },
          ],
        }),
        { settings: { validateResult: true } }
      );
    });

    /** @type {any} */
    let error;
    When('the decision is evaluated', async () => {
      error = await definition.evaluate('clash', { Amount: 1 }).catch((/** @type {Error} */ err) => err);
    });

    Then('the hit policy violation is reported', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/UNIQUE hit policy violated/);
    });
  });

  Scenario('a type override throwing a plain error during result validation', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="strictDefinitions" name="Strict" namespace="https://example.com/dmn/strict">
  <decision id="strict" name="Strict">
    <variable id="strictVariable" name="Strict" typeRef="tStrict" />
    <literalExpression id="strictExpression"><text>42</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition with the validateResult setting and a types override that throws a plain error', async () => {
      definition = await getDefinition(source, {
        settings: {
          validateResult: true,
          types: {
            tStrict() {
              throw new Error('rejected by host');
            },
          },
        },
      });
    });

    /** @type {any} */
    let error;
    When('the decision is evaluated', async () => {
      error = await definition.evaluate('strict', {}).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error carries the message with the plain error as cause', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.equal('rejected by host');
      expect(error.cause).to.be.instanceof(Error).and.not.instanceof(DecisionError);
    });
  });
});
