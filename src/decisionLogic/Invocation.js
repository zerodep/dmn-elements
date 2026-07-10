import { DmnError, DecisionError } from '../error/Errors.js';
import { expressionValue } from './expressionValue.js';

/**
 * Boxed invocation evaluation — dmn:Invocation as decision logic.
 *
 * The called function expression resolves to a FEEL-invocable function, e.g. a
 * business knowledge model or decision service bound by a knowledge requirement.
 * Bindings map to the function's formal parameters by name; a function without
 * parameter metadata is applied with the binding values in declaration order.
 * @param {any} invocationDef dmn-moddle invocation definition
 * @param {import('../Context.js').Context} context
 */
export function Invocation(invocationDef, context) {
  this.id = invocationDef.id;
  this.type = invocationDef.$type;
  this.behaviour = invocationDef;
  this.context = context;
  this.environment = context.environment;
  this.logger = context.environment.Logger(this.type.toLowerCase());
}

/**
 * @param {{ input?: Record<string, any> }} executeMessage evaluation input context
 * @param {(err: Error | null, result?: any) => void} callback
 */
Invocation.prototype.execute = function execute(executeMessage, callback) {
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
 * @returns {any} the called function result
 */
Invocation.prototype.evaluate = function evaluateInvocation(input = {}) {
  const calledFunction = this.behaviour.calledFunction;
  if (!calledFunction) throw new DecisionError(`<${this.id}> has no called function`, this);

  const fn = this._expressionValue(calledFunction, input, 'called function');
  if (typeof fn !== 'function') throw new DecisionError(`<${this.id}> called function did not resolve to a function`, this);

  const bindings = this.behaviour.binding || [];
  this.logger.debug(`<${this.id}> invoke with ${bindings.length} binding${bindings.length === 1 ? '' : 's'}`);

  /** @type {Record<string, any>} */
  const bound = {};
  const ordered = [];
  for (const binding of bindings) {
    const name = binding.parameter?.name;
    if (!name) throw new DecisionError(`<${this.id}> binding is missing a parameter name`, this);
    const value = binding.bindingFormula ? this._expressionValue(binding.bindingFormula, input, 'binding') : null;
    bound[name] = value;
    ordered.push(value);
  }

  const parameters = fn.parameters;
  if (!Array.isArray(parameters)) return fn(...ordered);

  for (const name in bound) {
    if (!parameters.includes(name)) throw new DecisionError(`<${this.id}> binds unknown parameter "${name}"`, this);
  }
  return fn(...parameters.map((name) => bound[name]));
};

/** @internal */
Invocation.prototype._expressionValue = function invocationExpressionValue(expression, scope, role) {
  return expressionValue(expression, this.context, scope, this, role);
};
