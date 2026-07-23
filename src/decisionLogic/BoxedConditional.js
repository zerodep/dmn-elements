import { DmnError, DecisionError } from '../error/Errors.js';
import { childExpressionValue } from './expressionValue.js';

/**
 * Boxed conditional evaluation — dmn:Conditional as decision logic (DMN 1.4).
 *
 * The if child expression must evaluate to a boolean — true selects the then
 * branch, false the else branch; only the selected branch evaluates.
 * @param {any} conditionalDef dmn-moddle conditional definition
 * @param {import('../Context.js').Context} context
 */
export function BoxedConditional(conditionalDef, context) {
  this.id = conditionalDef.id;
  this.type = conditionalDef.$type;
  this.behaviour = conditionalDef;
  this.context = context;
  this.environment = context.environment;
  this.logger = context.environment.Logger(this.type.toLowerCase());
}

/**
 * @param {{ input?: Record<string, any> }} executeMessage evaluation input context
 * @param {(err: Error | null, result?: any) => void} callback
 */
BoxedConditional.prototype.execute = function execute(executeMessage, callback) {
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
 * @returns {any} the selected branch result
 */
BoxedConditional.prototype.evaluate = function evaluateConditional(input = {}) {
  const condition = childExpressionValue(this, this.behaviour.if, input, 'if');
  if (typeof condition !== 'boolean') throw new DecisionError(`<${this.id}> if entry must evaluate to a boolean`, this);
  const branch = condition ? 'then' : 'else';
  this.logger.debug(`<${this.id}> takes ${branch} branch`);
  return childExpressionValue(this, this.behaviour[branch], input, branch);
};
