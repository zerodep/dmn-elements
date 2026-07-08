import { DmnError, DecisionError } from '../error/Errors.js';

/**
 * Literal expression evaluation — a single FEEL expression as decision logic
 * @param {any} literalExpressionDef dmn-moddle literal expression definition
 * @param {import('../Context.js').Context} context
 */
export function LiteralExpression(literalExpressionDef, context) {
  this.id = literalExpressionDef.id;
  this.type = literalExpressionDef.$type;
  this.behaviour = literalExpressionDef;
  this.context = context;
  this.environment = context.environment;
  this.logger = context.environment.Logger(this.type.toLowerCase());
}

/**
 * @param {{ input?: Record<string, any> }} executeMessage evaluation input context
 * @param {(err: Error | null, result?: any) => void} callback
 */
LiteralExpression.prototype.execute = function execute(executeMessage, callback) {
  let result;
  try {
    result = this.evaluate(executeMessage?.input);
  } catch (err) {
    return callback(err instanceof DmnError ? err : new DecisionError(/** @type {Error} */ (err).message, this, err));
  }
  return callback(null, result);
};

/**
 * Evaluate synchronously, e.g. as encapsulated logic invoked from FEEL
 * @param {Record<string, any>} [input] evaluation input context
 * @returns {any} expression result, null when the expression is empty
 */
LiteralExpression.prototype.evaluate = function evaluateExpression(input = {}) {
  const text = this.behaviour.text;
  if (!text?.trim()) return null;
  this.logger.debug(`<${this.id}> evaluate`);
  return this.environment.resolveExpression(text, input);
};
