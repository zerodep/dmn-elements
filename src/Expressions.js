import { evaluate, unaryTest } from 'feelin';

/**
 * FEEL expression engine backed by feelin.
 *
 * Pluggable via Environment option `expressions`. A replacement must implement
 * `resolveExpression(expression, context)` and `unaryTest(test, context)`.
 */
export function Expressions() {
  if (!(this instanceof Expressions)) return new Expressions();
}

/**
 * Evaluate a FEEL expression
 * @param {string} expression FEEL expression
 * @param {Record<string, any>} [context] expression input context
 * @returns {any} evaluation result
 */
Expressions.prototype.resolveExpression = function resolveExpression(expression, context) {
  // feelin >= 7 returns { value, warnings }
  return evaluate(expression, context).value;
};

/**
 * Evaluate a FEEL unary tests expression, e.g. a decision table input entry
 * @param {string} test FEEL unary tests
 * @param {Record<string, any>} [context] expression input context, the tested input value is expected on key `?`
 * @returns {boolean} whether the tested value matches
 */
Expressions.prototype.unaryTest = function evaluateUnaryTest(test, context) {
  return unaryTest(test, context).value;
};
