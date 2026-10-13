import { evaluate, unaryTest } from 'feelin';
import { DummyLogger } from './DummyLogger.js';

/**
 * FEEL expression engine backed by feelin.
 *
 * Pluggable via Environment option `expressions`. A replacement must implement
 * `resolveExpression(expression, context)` and `unaryTest(test, context)`.
 *
 * feelin reports evaluation warnings (unknown variables and context keys, missing
 * functions, invalid built-in arguments) alongside the value — FEEL yields null in
 * these cases without an error, so they are logged at `warn` level
 * @param {import('#types').ILogger} [logger] receives feelin warnings, silent by default
 */
export function Expressions(logger) {
  if (!(this instanceof Expressions)) return new Expressions(logger);
  /** @type {import('#types').ILogger} */
  this.logger = logger || DummyLogger();
}

/**
 * Evaluate a FEEL expression
 * @param {string} expression FEEL expression
 * @param {Record<string, any>} [context] expression input context
 * @returns {any} evaluation result
 */
Expressions.prototype.resolveExpression = function resolveExpression(expression, context) {
  const { value, warnings } = evaluate(expression, context);
  this._warn(expression, warnings);
  return value;
};

/**
 * Evaluate a FEEL unary tests expression, e.g. a decision table input entry
 * @param {string} test FEEL unary tests
 * @param {Record<string, any>} [context] expression input context, the tested input value is expected on key `?`
 * @returns {boolean} whether the tested value matches
 */
Expressions.prototype.unaryTest = function evaluateUnaryTest(test, context) {
  const { value, warnings } = unaryTest(test, context);
  this._warn(test, warnings);
  return value;
};

/**
 * @internal
 * @param {string} expression
 * @param {{ type: string, message: string }[]} warnings
 */
Expressions.prototype._warn = function warn(expression, warnings) {
  for (const warning of warnings) {
    this.logger.warn(`<${expression}> ${warning.type}: ${warning.message}`);
  }
};
