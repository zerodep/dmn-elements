import { DmnError, DecisionError } from '../error/Errors.js';
import { childExpressionValue } from './expressionValue.js';

/**
 * Boxed quantified iteration — dmn:Some and dmn:Every as decision logic (DMN 1.4).
 *
 * The in child expression must evaluate to a list; the satisfies expression
 * evaluates per element with the iterator variable bound and must yield a
 * boolean. Some is true when any element satisfies (false over an empty list),
 * every is true when all elements satisfy (true over an empty list) — both
 * short-circuit on the deciding element.
 * @param {any} quantifiedDef dmn-moddle some/every definition
 * @param {import('../Context.js').Context} context
 */
function BoxedQuantified(quantifiedDef, context) {
  this.id = quantifiedDef.id;
  this.type = quantifiedDef.$type;
  this.behaviour = quantifiedDef;
  this.context = context;
  this.environment = context.environment;
  this.logger = context.environment.Logger(this.type.toLowerCase());
}

/**
 * @param {{ input?: Record<string, any> }} executeMessage evaluation input context
 * @param {(err: Error | null, result?: any) => void} callback
 */
BoxedQuantified.prototype.execute = function execute(executeMessage, callback) {
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
 * @returns {boolean} whether the quantifier holds over the list
 */
BoxedQuantified.prototype.evaluate = function evaluateQuantified(input = {}) {
  const iteratorVariable = this.behaviour.iteratorVariable;
  if (!iteratorVariable) throw new DecisionError(`<${this.id}> has no iterator variable`, this);
  const list = childExpressionValue(this, this.behaviour.in, input, 'in');
  if (!Array.isArray(list)) throw new DecisionError(`<${this.id}> in entry must evaluate to a list`, this);
  const satisfiesDef = this.behaviour.satisfies;
  if (!satisfiesDef?.expression) throw new DecisionError(`<${this.id}> has no satisfies expression`, this);

  const some = this._some;
  this.logger.debug(`<${this.id}> ${some ? 'some' : 'every'} of ${list.length} element${list.length === 1 ? '' : 's'}`);

  for (const element of list) {
    const satisfied = childExpressionValue(this, satisfiesDef, { ...input, [iteratorVariable]: element }, 'satisfies');
    if (typeof satisfied !== 'boolean') throw new DecisionError(`<${this.id}> satisfies entry must evaluate to a boolean`, this);
    // the deciding element — a satisfied some, an unsatisfied every
    if (satisfied === some) return some;
  }
  return !some;
};

/**
 * @param {any} someDef dmn-moddle some definition
 * @param {import('../Context.js').Context} context
 */
export function BoxedSome(someDef, context) {
  BoxedQuantified.call(this, someDef, context);
  /** @internal */
  this._some = true;
}
BoxedSome.prototype = Object.create(BoxedQuantified.prototype, { constructor: { value: BoxedSome } });

/**
 * @param {any} everyDef dmn-moddle every definition
 * @param {import('../Context.js').Context} context
 */
export function BoxedEvery(everyDef, context) {
  BoxedQuantified.call(this, everyDef, context);
  /** @internal */
  this._some = false;
}
BoxedEvery.prototype = Object.create(BoxedQuantified.prototype, { constructor: { value: BoxedEvery } });
