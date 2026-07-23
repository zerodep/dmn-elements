import { DmnError, DecisionError } from '../error/Errors.js';
import { childExpressionValue } from './expressionValue.js';

/**
 * Boxed for iteration — dmn:For as decision logic (DMN 1.4).
 *
 * The in child expression must evaluate to a list; the return expression
 * evaluates per element with the iterator variable bound, plus the FEEL
 * iteration variable `partial` holding the results so far.
 * @param {any} forDef dmn-moddle for definition
 * @param {import('../Context.js').Context} context
 */
export function BoxedFor(forDef, context) {
  this.id = forDef.id;
  this.type = forDef.$type;
  this.behaviour = forDef;
  this.context = context;
  this.environment = context.environment;
  this.logger = context.environment.Logger(this.type.toLowerCase());
}

/**
 * @param {{ input?: Record<string, any> }} executeMessage evaluation input context
 * @param {(err: Error | null, result?: any) => void} callback
 */
BoxedFor.prototype.execute = function execute(executeMessage, callback) {
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
 * @returns {any[]} one return value per element
 */
BoxedFor.prototype.evaluate = function evaluateFor(input = {}) {
  const iteratorVariable = this.behaviour.iteratorVariable;
  if (!iteratorVariable) throw new DecisionError(`<${this.id}> has no iterator variable`, this);
  const list = childExpressionValue(this, this.behaviour.in, input, 'in');
  if (!Array.isArray(list)) throw new DecisionError(`<${this.id}> in entry must evaluate to a list`, this);
  const returnDef = this.behaviour.return;
  if (!returnDef?.expression) throw new DecisionError(`<${this.id}> has no return expression`, this);

  this.logger.debug(`<${this.id}> iterate ${list.length} element${list.length === 1 ? '' : 's'} as ${iteratorVariable}`);

  const results = [];
  for (const element of list) {
    results.push(childExpressionValue(this, returnDef, { ...input, [iteratorVariable]: element, partial: [...results] }, 'return'));
  }
  return results;
};
