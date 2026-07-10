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

Feature('typeRef coercion', () => {
  Scenario('input data typeRef coerces the supplied value', () => {
    /** @type {Definition} */
    let definition;
    Given('the bonus resource where the amount input data is typed double by Camunda Modeler', async () => {
      definition = await getDefinition(testHelpers.resource('bonus.dmn'));
    });

    /** @type {any} */
    let result;
    When('bonus is evaluated with the amount as a string', async () => {
      result = await definition.evaluate('bonus', { Amount: '200' });
    });

    Then('the coerced number matched the rules', () => {
      expect(result).to.deep.equal([10, 20]);
    });

    /** @type {any} */
    let error;
    When('bonus is evaluated with an amount that is no number', async () => {
      error = await definition.evaluate('bonus', { Amount: 'plenty' }).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the failed input data coercion', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/coerce "plenty" to double/);
    });
  });

  Scenario('input expression typeRef coerces before unary tests', () => {
    /** @type {Definition} */
    let definition;
    Given('an inline source where the input expression is typed number', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'grade',
          inputs: [{ text: 'Score', typeRef: 'number' }],
          outputs: [{ name: 'grade' }],
          rules: [
            { input: ['> 100'], output: ['"gold"'] },
            { input: ['<= 100'], output: ['"silver"'] },
          ],
        })
      );
    });

    /** @type {any} */
    let result;
    When('evaluated with the score as a string', async () => {
      result = await definition.evaluate('grade', { Score: '200' });
    });

    Then('the coerced number matched', () => {
      expect(result).to.equal('gold');
    });
  });

  Scenario('output typeRef coerces the output entry value', () => {
    /** @type {Definition} */
    let definition;
    Given('an inline source where the output is typed number but the entry is a string literal', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'answer',
          inputs: [{ text: 'Question' }],
          outputs: [{ name: 'answer', typeRef: 'number' }],
          rules: [{ input: ['-'], output: ['"42"'] }],
        })
      );
    });

    /** @type {any} */
    let result;
    When('evaluated', async () => {
      result = await definition.evaluate('answer', { Question: 'life' });
    });

    Then('the output is a number', () => {
      expect(result).to.equal(42);
    });
  });

  Scenario('temporal typeRef coerces a date string', () => {
    /** @type {Definition} */
    let definition;
    Given('an inline source where the input expression is typed date', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'membership',
          hitPolicy: 'FIRST',
          inputs: [{ text: 'Expiry', typeRef: 'date' }],
          outputs: [{ name: 'status' }],
          rules: [
            { input: ['>= date("2026-07-09")'], output: ['"active"'] },
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

    Then('the coerced date matched', () => {
      expect(result).to.equal('active');
    });
  });

  Scenario('business knowledge model parameter typeRef coerces arguments', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="paramDefinitions" name="Param" namespace="https://example.com/dmn/param">
  <businessKnowledgeModel id="applyDiscount" name="Apply discount">
    <variable id="applyDiscountVariable" name="Apply discount" />
    <encapsulatedLogic id="applyDiscountLogic">
      <formalParameter id="amountParameter" name="amount" typeRef="number" />
      <formalParameter id="rateParameter" name="rate" typeRef="number" />
      <literalExpression id="applyDiscountBody"><text>amount - amount * rate</text></literalExpression>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <decision id="price" name="Price">
    <variable id="priceVariable" name="Price" />
    <knowledgeRequirement id="priceRequiresDiscount">
      <requiredKnowledge href="#applyDiscount" />
    </knowledgeRequirement>
    <literalExpression id="priceExpression"><text>Apply discount("100", 0.1)</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where the function is invoked with a string argument', async () => {
      definition = new Definition(await testHelpers.context(source));
    });

    /** @type {any} */
    let result;
    When('price is evaluated', async () => {
      result = await definition.evaluate('price', {});
    });

    Then('the coerced argument fed the calculation', () => {
      expect(result).to.equal(90);
    });
  });

  Scenario('an unknown typeRef passes the value through', () => {
    /** @type {Definition} */
    let definition;
    Given('an inline source where the input expression references an item definition', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'orders',
          inputs: [{ text: 'Order', typeRef: 'tOrder' }],
          outputs: [{ name: 'handled' }],
          rules: [{ input: ['"rush"'], output: ['true'] }],
        })
      );
    });

    /** @type {any} */
    let result;
    When('evaluated with a value of the custom type', async () => {
      result = await definition.evaluate('orders', { Order: 'rush' });
    });

    Then('the value was matched untouched', () => {
      expect(result).to.be.true;
    });
  });

  Scenario('a type override via settings coerces an item definition type', () => {
    /** @type {Definition} */
    let definition;
    Given('an inline source with a custom typed input expression and a type override in environment settings', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'grade',
          inputs: [{ text: 'Score', typeRef: 'tScore' }],
          outputs: [{ name: 'grade' }],
          rules: [
            { input: ['> 80'], output: ['"gold"'] },
            { input: ['<= 80'], output: ['"silver"'] },
          ],
        }),
        {
          settings: {
            types: {
              tScore: (/** @type {any} */ value) => Number(String(value).replace(' pts', '')),
            },
          },
        }
      );
    });

    /** @type {any} */
    let result;
    When('evaluated with a value only the override understands', async () => {
      result = await definition.evaluate('grade', { Score: '85 pts' });
    });

    Then('the override coerced the value before the unary tests', () => {
      expect(result).to.equal('gold');
    });
  });

  Scenario('a value that cannot be coerced', () => {
    /** @type {Definition} */
    let definition;
    Given('an inline source where the input expression is typed number', async () => {
      definition = await getDefinition(
        factory.decisionTableSource({
          id: 'grade',
          inputs: [{ text: 'Score', typeRef: 'number' }],
          outputs: [{ name: 'grade' }],
          rules: [{ input: ['> 100'], output: ['"gold"'] }],
        })
      );
    });

    /** @type {any} */
    let error;
    When('evaluated with a non-numeric string', async () => {
      error = await definition.evaluate('grade', { Score: 'many' }).catch((/** @type {Error} */ err) => err);
    });

    Then('a decision error points out the failed coercion', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/coerce/);
    });
  });
});
