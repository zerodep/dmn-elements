import { DmnError, DecisionError } from '../error/Errors.js';
import { coerceTypeRef } from '../typeRef.js';
import { expressionValue } from './expressionValue.js';

/**
 * Boxed function definition evaluation — dmn:FunctionDefinition as decision logic.
 *
 * Evaluates to a FEEL-invocable function. Unlike a business knowledge model,
 * whose scope is closed to formal parameters and required knowledge, an inline
 * function definition is a closure over its definition scope, per FEEL function
 * semantics — e.g. earlier entries of the boxed context defining it.
 * @param {any} functionDef dmn-moddle function definition
 * @param {import('../Context.js').Context} context
 */
export function FunctionDefinition(functionDef, context) {
  this.id = functionDef.id;
  this.type = functionDef.$type;
  this.behaviour = functionDef;
  this.context = context;
  this.environment = context.environment;
  this.logger = context.environment.Logger(this.type.toLowerCase());
}

/**
 * @param {{ input?: Record<string, any> }} executeMessage evaluation input context
 * @param {(err: Error | null, result?: any) => void} callback
 */
FunctionDefinition.prototype.execute = function execute(executeMessage, callback) {
  let result;
  try {
    result = this.evaluate(executeMessage?.input);
  } catch (err) {
    return callback(err instanceof DmnError ? err : new DecisionError(/** @type {Error} */ (err).message, this, err));
  }
  return callback(null, result);
};

/**
 * Evaluate synchronously to the FEEL-invocable function
 * @param {Record<string, any>} [input] definition scope the function closes over
 * @returns {(...args: any[]) => any} the function
 */
FunctionDefinition.prototype.evaluate = function evaluateFunctionDefinition(input = {}) {
  const behaviour = this.behaviour;
  if (behaviour.kind && behaviour.kind !== 'FEEL') {
    throw new DecisionError(`<${this.id}> unsupported function definition kind ${behaviour.kind}`, this);
  }
  const body = behaviour.body;
  if (!body) throw new DecisionError(`<${this.id}> has no function body`, this);

  const parameters = behaviour.formalParameter || [];
  const definitionScope = { ...input };
  const definition = this;

  const invocable = function invokeFunction(...args) {
    definition.logger.debug(`<${definition.id}> invoked with ${args.length} argument${args.length === 1 ? '' : 's'}`);
    const scope = { ...definitionScope };
    for (let idx = 0; idx < parameters.length; idx++) {
      const parameter = parameters[idx];
      scope[parameter.name] = coerceTypeRef(args[idx], parameter.typeRef, definition);
    }
    return expressionValue(body, definition.context, scope, definition, 'function body');
  };
  // formal parameter names, so a boxed invocation can map named bindings to positions
  invocable.parameters = parameters.map((parameter) => parameter.name);
  // and for feelin ($args), so FEEL named-argument invocation maps and parameter count is enforced
  invocable.$args = invocable.parameters;

  return invocable;
};
