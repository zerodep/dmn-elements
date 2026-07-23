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

Feature('item definition types', () => {
  Scenario('an input data typed by a structured item definition', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the applicant resource where the applicant is a structure with a constrained component', async () => {
      definition = await getDefinition(testHelpers.resource('applicant.dmn'));
    });

    /** @type {any} */
    let result;
    When('eligibility is evaluated with the age component as a string', async () => {
      result = await definition.evaluate('eligibility', { Applicant: { age: '35', employment: 'employed' } });
    });

    Then('the component typeRef coerced the age and the rules matched', () => {
      expect(result).to.be.true;
    });

    When('eligibility is evaluated for a minor', async () => {
      result = await definition.evaluate('eligibility', { Applicant: { age: 16, employment: 'employed' } });
    });

    Then('the catch-all rule applied', () => {
      expect(result).to.be.false;
    });

    When('eligibility is evaluated without the age component', async () => {
      result = await definition.evaluate('eligibility', { Applicant: { employment: 'employed' } });
    });

    Then('the missing component stayed absent and the catch-all rule applied', () => {
      expect(result).to.be.false;
    });

    /** @type {any} */
    let error;
    When('eligibility is evaluated with an employment outside the allowed values', async () => {
      error = await definition
        .evaluate('eligibility', { Applicant: { age: 20, employment: 'student' } })
        .catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the allowed values violation', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/violates allowed values of tEmployment/);
    });

    When('eligibility is evaluated with an applicant that is no structure', async () => {
      error = await definition.evaluate('eligibility', { Applicant: 'nobody' }).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the failed structure coercion', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/cannot coerce "nobody" to tApplicant/);
    });
  });

  Scenario('an item definition aliasing another item definition', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="aliasDefinitions" name="Alias" namespace="https://example.com/dmn/alias">
  <itemDefinition id="tScore" name="tScore">
    <typeRef>tPoints</typeRef>
  </itemDefinition>
  <itemDefinition id="tPoints" name="tPoints">
    <typeRef>number</typeRef>
  </itemDefinition>
  <decision id="grade" name="Grade">
    <variable id="gradeVariable" name="Grade" />
    <decisionTable id="gradeTable" hitPolicy="FIRST">
      <input id="scoreInput">
        <inputExpression id="scoreInputExpression" typeRef="tScore"><text>Score</text></inputExpression>
      </input>
      <output id="gradeOutput" name="grade" />
      <rule id="goldRule">
        <inputEntry id="goldEntry"><text>&gt; 80</text></inputEntry>
        <outputEntry id="goldGrade"><text>"gold"</text></outputEntry>
      </rule>
      <rule id="silverRule">
        <inputEntry id="silverEntry"><text>-</text></inputEntry>
        <outputEntry id="silverGrade"><text>"silver"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where the input expression type aliases through two item definitions', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the grade is evaluated with the score as a string', async () => {
      result = await definition.evaluate('grade', { Score: '85' });
    });

    Then('the alias chain reached the number type and coerced the value', () => {
      expect(result).to.equal('gold');
    });
  });

  Scenario('a collection item definition', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="scoresDefinitions" name="Scores" namespace="https://example.com/dmn/scores">
  <itemDefinition id="tScores" name="tScores" isCollection="true">
    <typeRef>number</typeRef>
  </itemDefinition>
  <inputData id="scoresInput" name="Scores">
    <variable id="scoresVariable" name="Scores" typeRef="tScores" />
  </inputData>
  <decision id="total" name="Total">
    <variable id="totalVariable" name="Total" />
    <informationRequirement id="totalRequiresScores">
      <requiredInput href="#scoresInput" />
    </informationRequirement>
    <literalExpression id="totalExpression"><text>sum(Scores)</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where the input data is a collection of numbers', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the total is evaluated with numeric strings', async () => {
      result = await definition.evaluate('total', { Scores: ['1', '2'] });
    });

    Then('each element was coerced', () => {
      expect(result).to.equal(3);
    });

    /** @type {any} */
    let error;
    When('the total is evaluated with a value that is no list', async () => {
      error = await definition.evaluate('total', { Scores: 5 }).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the failed collection coercion', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/cannot coerce 5 to collection tScores/);
    });
  });

  Scenario('item definitions with DMN 1.5 type constraints', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="rewardDefinitions" name="Reward" namespace="https://example.com/dmn/reward">
  <itemDefinition id="tScores" name="tScores" isCollection="true">
    <typeRef>number</typeRef>
    <allowedValues id="tScoresAllowed"><text>[0..100]</text></allowedValues>
    <typeConstraint id="tScoresConstraint"><text>count(?) &lt;= 3</text></typeConstraint>
  </itemDefinition>
  <itemDefinition id="tBonus" name="tBonus">
    <typeRef>number</typeRef>
    <typeConstraint id="tBonusConstraint"><text>&lt;= 50</text></typeConstraint>
  </itemDefinition>
  <inputData id="scoresInput" name="Scores">
    <variable id="scoresVariable" name="Scores" typeRef="tScores" />
  </inputData>
  <inputData id="bonusInput" name="Bonus">
    <variable id="bonusVariable" name="Bonus" typeRef="tBonus" />
  </inputData>
  <decision id="reward" name="Reward">
    <variable id="rewardVariable" name="Reward" />
    <informationRequirement id="rewardRequiresScores">
      <requiredInput href="#scoresInput" />
    </informationRequirement>
    <informationRequirement id="rewardRequiresBonus">
      <requiredInput href="#bonusInput" />
    </informationRequirement>
    <literalExpression id="rewardExpression"><text>sum(Scores) + Bonus</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where a collection and a scalar item definition carry type constraints', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the reward is evaluated within all constraints', async () => {
      result = await definition.evaluate('reward', { Scores: ['10', 20], Bonus: 30 });
    });

    Then('elements coerced and both type constraints passed', () => {
      expect(result).to.equal(60);
    });

    /** @type {any} */
    let error;
    When('the reward is evaluated with too many scores', async () => {
      error = await definition.evaluate('reward', { Scores: [1, 2, 3, 4], Bonus: 30 }).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the collection type constraint violation', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/violates type constraint of tScores/);
    });

    When('the reward is evaluated with a score outside the allowed values', async () => {
      error = await definition.evaluate('reward', { Scores: [10, 200], Bonus: 30 }).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the allowed values violation of the element type', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/violates allowed values of tScores/);
    });

    When('the reward is evaluated with a too large bonus', async () => {
      error = await definition.evaluate('reward', { Scores: [10], Bonus: 60 }).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the scalar type constraint violation', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/violates type constraint of tBonus/);
    });
  });

  Scenario('a collection of a named item definition type', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="pointsDefinitions" name="Points" namespace="https://example.com/dmn/points">
  <itemDefinition id="tPoint" name="tPoint">
    <typeRef>number</typeRef>
  </itemDefinition>
  <itemDefinition id="tPoints" name="tPoints" isCollection="true">
    <typeRef>tPoint</typeRef>
  </itemDefinition>
  <inputData id="pointsInput" name="Points">
    <variable id="pointsVariable" name="Points" typeRef="tPoints" />
  </inputData>
  <decision id="total" name="Total">
    <variable id="totalVariable" name="Total" />
    <informationRequirement id="totalRequiresPoints">
      <requiredInput href="#pointsInput" />
    </informationRequirement>
    <literalExpression id="totalExpression"><text>sum(Points)</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition where the collection element type is itself a named item definition', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the total is evaluated with several elements', async () => {
      result = await definition.evaluate('total', { Points: ['1', '2', '3'] });
    });

    Then('every element followed the alias chain without a false circularity', () => {
      expect(result).to.equal(6);
    });
  });

  Scenario('circular item definitions', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="circularDefinitions" name="Circular" namespace="https://example.com/dmn/circular">
  <itemDefinition id="tA" name="tA">
    <typeRef>tB</typeRef>
  </itemDefinition>
  <itemDefinition id="tB" name="tB">
    <typeRef>tA</typeRef>
  </itemDefinition>
  <inputData id="aInput" name="A">
    <variable id="aVariable" name="A" typeRef="tA" />
  </inputData>
  <decision id="echo" name="Echo">
    <variable id="echoVariable" name="Echo" />
    <informationRequirement id="echoRequiresA">
      <requiredInput href="#aInput" />
    </informationRequirement>
    <literalExpression id="echoExpression"><text>A</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where two item definitions alias each other', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let error;
    When('the decision is evaluated', async () => {
      error = await definition.evaluate('echo', { A: 1 }).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the circular item definition', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/circular item definition <tA>/);
    });
  });

  Scenario('a type override via settings takes precedence over an item definition', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="overrideDefinitions" name="Override" namespace="https://example.com/dmn/override">
  <itemDefinition id="tEmployment" name="tEmployment">
    <typeRef>string</typeRef>
    <allowedValues id="employmentValues">
      <text>"employed", "self-employed", "unemployed"</text>
    </allowedValues>
  </itemDefinition>
  <inputData id="employmentInput" name="Employment">
    <variable id="employmentVariable" name="Employment" typeRef="tEmployment" />
  </inputData>
  <decision id="echo" name="Echo">
    <variable id="echoVariable" name="Echo" />
    <informationRequirement id="echoRequiresEmployment">
      <requiredInput href="#employmentInput" />
    </informationRequirement>
    <literalExpression id="echoExpression"><text>Employment</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition with a constrained item definition and an override for the same type', async () => {
      definition = await getDefinition(source, {
        settings: { types: { tEmployment: (/** @type {any} */ value) => value } },
      });
    });

    /** @type {any} */
    let result;
    When('the decision is evaluated with a value the item definition would reject', async () => {
      result = await definition.evaluate('echo', { Employment: 'student' });
    });

    Then('the override won and the allowed values were never checked', () => {
      expect(result).to.equal('student');
    });
  });
});
