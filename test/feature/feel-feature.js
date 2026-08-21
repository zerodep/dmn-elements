import * as testHelpers from '../helpers/testHelpers.js';
import * as factory from '../helpers/factory.js';
import * as ck from 'chronokinesis';
import { Definition, DecisionError } from 'dmn-elements';

/**
 * FEEL semantics belong to feelin (tested upstream against the DMN TCK).
 * These features cover the seam this project owns: unary tests bound to `?`,
 * environment variables vs evaluation input, and FEEL results crossing element
 * boundaries.
 */

/**
 * @param {string | Buffer} source DMN XML
 * @param {import('#types').EnvironmentOptions} [options] environment options
 */
async function getDefinition(source, options) {
  return new Definition(await testHelpers.context(source, options));
}

Feature('FEEL seam', () => {
  Scenario('unary test flavors in input entries', () => {
    /** @type {Definition} */
    let definition;
    Given('the shipping resource using ranges, negation, value lists, and irrelevant entries', async () => {
      definition = await getDefinition(testHelpers.resource('shipping.dmn'));
    });

    /** @type {any} */

    let result;
    When('evaluated with a light non-red package', async () => {
      result = await definition.evaluate('shipping', { Weight: 2, Color: 'white' });
    });

    Then('the range and the negation matched', () => {
      expect(result).to.equal('letter');
    });

    When('evaluated with a light red package', async () => {
      result = await definition.evaluate('shipping', { Weight: 2, Color: 'red' });
    });

    Then('the irrelevant entry matched instead', () => {
      expect(result).to.equal('parcel');
    });

    When('evaluated with a heavy blue package', async () => {
      result = await definition.evaluate('shipping', { Weight: 10, Color: 'blue' });
    });

    Then('the value list matched', () => {
      expect(result).to.equal('freight');
    });

    When('evaluated with a heavy red package', async () => {
      result = await definition.evaluate('shipping', { Weight: 10, Color: 'red' });
    });

    Then('no rule matched', () => {
      expect(result).to.be.null;
    });
  });

  Scenario('environment variables reach FEEL, evaluation input takes precedence', () => {
    const accessTable = factory.decisionTableSource({
      id: 'access',
      inputs: [{ text: 'Age' }],
      outputs: [{ name: 'access' }],
      rules: [
        { input: ['>= MinimumAge'], output: ['"granted"'] },
        { input: ['< MinimumAge'], output: ['"denied"'] },
      ],
    });

    /** @type {Definition} */

    let definition;
    Given('an access table comparing against an environment variable', async () => {
      definition = await getDefinition(accessTable, { variables: { MinimumAge: 18 } });
    });

    /** @type {any} */

    let result;
    When('evaluated with an age above the environment minimum', async () => {
      result = await definition.evaluate('access', { Age: 20 });
    });

    Then('access is granted', () => {
      expect(result).to.equal('granted');
    });

    When('evaluated with the minimum age overridden by evaluation input', async () => {
      result = await definition.evaluate('access', { Age: 20, MinimumAge: 30 });
    });

    Then('the evaluation input won and access is denied', () => {
      expect(result).to.equal('denied');
    });
  });

  Scenario('environment services are callable in FEEL under services', () => {
    /** @type {Definition} */
    let definition;
    Given('the screening resource where the input expression calls services.creditScore(Applicant)', async () => {
      definition = await getDefinition(testHelpers.resource('screening.dmn'), {
        services: {
          creditScore(/** @type {{income: number}} */ applicant) {
            return applicant.income >= 4000 ? 700 : 500;
          },
        },
      });
    });

    /** @type {any} */

    let result;
    When('evaluated with a high-income applicant', async () => {
      result = await definition.evaluate('screening', { Applicant: { income: 5000 } });
    });

    Then('the service-scored applicant is approved', () => {
      expect(result).to.equal('approved');
    });

    When('evaluated with a low-income applicant', async () => {
      result = await definition.evaluate('screening', { Applicant: { income: 1000 } });
    });

    Then('the service-scored applicant is up for review', () => {
      expect(result).to.equal('review');
    });
  });

  Scenario('a throwing service function fails the evaluation', () => {
    /** @type {Definition} */
    let definition;
    Given('the screening resource with a credit score service that throws', async () => {
      definition = await getDefinition(testHelpers.resource('screening.dmn'), {
        services: {
          // the parameter must be declared — feelin nulls surplus-argument invocations without calling
          creditScore(/** @type {{income: number}} */ applicant) {
            throw new Error(`credit bureau unavailable for income ${applicant.income}`);
          },
        },
      });
    });

    /** @type {any} */

    let error;
    When('evaluated', async () => {
      error = await definition.evaluate('screening', { Applicant: { income: 5000 } }).catch((/** @type {Error} */ err) => err);
    });

    Then('the evaluation rejects with a decision error carrying the service error message', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/credit bureau unavailable/);
    });

    And('the original service error is chained as cause', () => {
      expect(error.cause, 'cause').to.be.instanceof(Error);
      expect(error.cause.message).to.equal('credit bureau unavailable for income 5000');
    });
  });

  Scenario('services are callable in unary tests, and evaluation input can shadow them', () => {
    const scoreTable = factory.decisionTableSource({
      id: 'grading',
      inputs: [{ text: 'Score' }],
      outputs: [{ name: 'grade' }],
      rules: [
        { input: ['>= services.passingScore()'], output: ['"pass"'] },
        { input: ['< services.passingScore()'], output: ['"fail"'] },
      ],
    });

    /** @type {Definition} */

    let definition;
    Given('a grading table with a rule entry calling services.passingScore()', async () => {
      definition = await getDefinition(scoreTable, { services: { passingScore: () => 60 } });
    });

    /** @type {any} */

    let result;
    When('evaluated with a score above the service threshold', async () => {
      result = await definition.evaluate('grading', { Score: 75 });
    });

    Then('the grade is a pass', () => {
      expect(result).to.equal('pass');
    });

    When('evaluated with input named services shadowing the overlay', async () => {
      result = await definition.evaluate('grading', { Score: 75, services: { passingScore: () => 80 } });
    });

    Then('the shadowing services decided and the grade is a fail', () => {
      expect(result).to.equal('fail');
    });
  });

  Scenario('FEEL expressions in output entries', () => {
    /** @type {Definition} */
    let definition;
    Given('a fee table where the output entry is computed from input', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'fee',
          inputs: [{ text: 'Amount' }],
          outputs: [{ name: 'fee' }],
          rules: [{ input: ['> 0'], output: ['Amount * 0.1'] }],
        })
      );
    });

    /** @type {any} */

    let result;
    When('evaluated with an amount', async () => {
      result = await definition.evaluate('fee', { Amount: 200 });
    });

    Then('the output entry was evaluated as FEEL', () => {
      expect(result).to.equal(20);
    });
  });

  Scenario('a literal expression decision', () => {
    const greetingSource = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="greetingDefinitions" name="Greeting" namespace="https://example.com/dmn/greeting">
  <decision id="greeting" name="Greeting">
    <variable id="greetingVariable" name="Greeting" typeRef="string" />
    <literalExpression id="greetingExpression"><text>"Hello " + Name</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */

    let definition;
    Given('a definition from an inline source with a literal expression decision', async () => {
      definition = await getDefinition(greetingSource);
    });

    /** @type {any} */

    let result;
    When('evaluated with a name', async () => {
      result = await definition.evaluate('greeting', { Name: 'Pål' });
    });

    Then('the FEEL expression produced the greeting', () => {
      expect(result).to.equal('Hello Pål');
    });
  });

  Scenario('temporal builtins follow a mocked clock', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="overdueDefinitions" name="Overdue" namespace="https://example.com/dmn/overdue">
  <decision id="overdue" name="Overdue">
    <variable id="overdueVariable" name="Overdue" typeRef="boolean" />
    <literalExpression id="overdueExpression"><text>date(Due) &lt; today()</text></literalExpression>
  </decision>
</definitions>`;

    after(ck.reset);

    /** @type {Definition} */
    let definition;
    Given('a decision comparing a due date to today, and a clock frozen before the due date', async () => {
      ck.freeze(new Date('2026-01-01T12:00:00Z'));
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('evaluated', async () => {
      result = await definition.evaluate('overdue', { Due: '2026-06-01' });
    });

    Then('nothing is overdue', () => {
      expect(result).to.be.false;
    });

    When('the clock travels past the due date and the same input is evaluated', async () => {
      ck.travel(new Date('2027-01-01T12:00:00Z'));
      result = await definition.evaluate('overdue', { Due: '2026-06-01' });
    });

    Then('the same definition and input is overdue', () => {
      expect(result).to.be.true;
    });
  });

  Scenario('temporal values cross the seam', () => {
    /** @type {Definition} */
    let definition;
    Given('a membership table comparing dates', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'membership',
          hitPolicy: 'FIRST',
          inputs: [{ text: 'date(Expiry)' }],
          outputs: [{ name: 'status' }],
          rules: [
            { input: ['>= date("2026-07-08")'], output: ['"active"'] },
            { input: ['-'], output: ['"expired"'] },
          ],
        })
      );
    });

    /** @type {any} */

    let result;
    When('evaluated with a future expiry date string', async () => {
      result = await definition.evaluate('membership', { Expiry: '2027-01-01' });
    });

    Then('the membership is active', () => {
      expect(result).to.equal('active');
    });

    When('evaluated with a past expiry date string', async () => {
      result = await definition.evaluate('membership', { Expiry: '2020-01-01' });
    });

    Then('the membership expired', () => {
      expect(result).to.equal('expired');
    });
  });
});
