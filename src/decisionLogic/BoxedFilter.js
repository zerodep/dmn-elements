import { DmnError, DecisionError } from '../error/Errors.js';
import { childExpressionValue } from './expressionValue.js';

/**
 * Boxed filter evaluation — dmn:Filter as decision logic (DMN 1.4).
 *
 * The in child expression must evaluate to a list; the match expression
 * evaluates per element with the FEEL filter scope — the implicit variable
 * `item` and, for context elements, their entries — and must yield a boolean.
 * @param {any} filterDef dmn-moddle filter definition
 * @param {import('../Context.js').Context} context
 */
export function BoxedFilter(filterDef, context) {
  this.id = filterDef.id;
  this.type = filterDef.$type;
  this.behaviour = filterDef;
  this.context = context;
  this.environment = context.environment;
  this.logger = context.environment.Logger(this.type.toLowerCase());
}

/**
 * @param {{ input?: Record<string, any> }} executeMessage evaluation input context
 * @param {(err: Error | null, result?: any) => void} callback
 */
BoxedFilter.prototype.execute = function execute(executeMessage, callback) {
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
 * @returns {any[]} the elements whose match evaluated to true
 */
BoxedFilter.prototype.evaluate = function evaluateFilter(input = {}) {
  const list = childExpressionValue(this, this.behaviour.in, input, 'in');
  if (!Array.isArray(list)) throw new DecisionError(`<${this.id}> in entry must evaluate to a list`, this);
  const matchDef = this.behaviour.match;
  if (!matchDef?.expression) throw new DecisionError(`<${this.id}> has no match expression`, this);

  this.logger.debug(`<${this.id}> filter ${list.length} element${list.length === 1 ? '' : 's'}`);

  const result = [];
  for (const item of list) {
    // FEEL filter scope — a context element exposes its entries alongside `item`
    const entries = item && typeof item === 'object' && !Array.isArray(item) ? item : undefined;
    const match = childExpressionValue(this, matchDef, { ...input, ...entries, item }, 'match');
    if (typeof match !== 'boolean') throw new DecisionError(`<${this.id}> match entry must evaluate to a boolean`, this);
    if (match) result.push(item);
  }
  return result;
};
