import { DmnError, DecisionError } from '../error/Errors.js';
import { coerceTypeRef } from '../typeRef.js';
import { expressionValue } from './expressionValue.js';

/**
 * Boxed context evaluation — dmn:Context as decision logic.
 *
 * Entries evaluate in order, each named entry binding its value into scope for
 * subsequent entries. An entry without a variable is the final result entry and
 * yields the context result; without one the result is an object of all entries.
 * @param {any} contextDef dmn-moddle context definition
 * @param {import('../Context.js').Context} context
 */
export function BoxedContext(contextDef, context) {
  this.id = contextDef.id;
  this.type = contextDef.$type;
  this.behaviour = contextDef;
  this.context = context;
  this.environment = context.environment;
  this.logger = context.environment.Logger(this.type.toLowerCase());
}

/**
 * @param {{ input?: Record<string, any> }} executeMessage evaluation input context
 * @param {(err: Error | null, result?: any) => void} callback
 */
BoxedContext.prototype.execute = function execute(executeMessage, callback) {
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
 * @returns {any} the final result entry value, or an object of all named entries
 */
BoxedContext.prototype.evaluate = function evaluateContext(input = {}) {
  const entries = this.behaviour.contextEntry || [];
  this.logger.debug(`<${this.id}> evaluate ${entries.length} context entr${entries.length === 1 ? 'y' : 'ies'}`);

  const scope = { ...input };
  /** @type {Record<string, any>} */
  const combined = {};

  for (const entry of entries) {
    const value = this._entryValue(entry, scope);
    const name = entry.variable?.name;
    if (!name) return value;

    const coerced = coerceTypeRef(value, entry.variable.typeRef, this);
    scope[name] = coerced;
    combined[name] = coerced;
  }

  return combined;
};

/** @internal */
BoxedContext.prototype._entryValue = function entryValue(entry, scope) {
  const expression = entry.value;
  if (!expression) return null;
  return expressionValue(expression, this.context, scope, this, 'context entry');
};
