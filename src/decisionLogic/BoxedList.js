import { DmnError, DecisionError } from '../error/Errors.js';
import { expressionValue } from './expressionValue.js';

/**
 * Boxed list evaluation — dmn:List as decision logic.
 *
 * Elements evaluate independently in the evaluation input scope, in declaration
 * order; the list evaluates to the list of element values.
 * @param {any} listDef dmn-moddle list definition
 * @param {import('../Context.js').Context} context
 */
export function BoxedList(listDef, context) {
  this.id = listDef.id;
  this.type = listDef.$type;
  this.behaviour = listDef;
  this.context = context;
  this.environment = context.environment;
  this.logger = context.environment.Logger(this.type.toLowerCase());
}

/**
 * @param {{ input?: Record<string, any> }} executeMessage evaluation input context
 * @param {(err: Error | null, result?: any) => void} callback
 */
BoxedList.prototype.execute = function execute(executeMessage, callback) {
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
 * @returns {any[]} one value per element
 */
BoxedList.prototype.evaluate = function evaluateList(input = {}) {
  const elements = this.behaviour.elements || [];
  this.logger.debug(`<${this.id}> evaluate ${elements.length} element${elements.length === 1 ? '' : 's'}`);
  return elements.map((/** @type {any} */ element) => expressionValue(element, this.context, input, this, 'list element'));
};
