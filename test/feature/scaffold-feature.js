// @ts-check
import * as testHelpers from '../helpers/testHelpers.js';
import { Environment } from 'dmn-elements';

Feature('scaffold', () => {
  Scenario('FEEL expressions are evaluated with feelin', () => {
    /** @type {Environment} */
    let environment;
    Given('an environment with variables', () => {
      environment = new Environment({ variables: { amount: 100, threshold: 42 } });
    });

    /** @type {any} */

    let result;
    When('a FEEL expression is resolved', () => {
      result = environment.resolveExpression('amount > threshold');
    });

    Then('feelin evaluated it against environment variables', () => {
      expect(result).to.be.true;
    });

    When('a FEEL unary tests expression is evaluated', () => {
      result = environment.unaryTest('[42..99]', { '?': 43 });
    });

    Then('the tested value matched', () => {
      expect(result).to.be.true;
    });
  });

  Scenario('a DMN source with a decision table', () => {
    /** @type {import('dmn-elements').Context} */
    let context;
    Given('a context built from dinner decisions', async () => {
      context = await testHelpers.context(testHelpers.resource('dinner.dmn'));
    });

    Then('the decision is found by id', () => {
      const decision = context.getDecisionById('dish');
      expect(decision).to.be.ok;
      expect(decision).to.have.property('name', 'Dish');
      expect(decision.decisionLogic).to.have.property('$type', 'dmn:DecisionTable');
    });

    And('the decision requires the season input data', () => {
      const requirements = context.getRequirements(context.getDecisionById('dish'));
      expect(requirements).to.have.length(1);
      expect(requirements[0]).to.have.property('id', 'seasonInput');
    });
  });
});
