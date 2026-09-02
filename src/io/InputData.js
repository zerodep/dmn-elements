import { DrgElement } from '../drgElement/DrgElement.js';
import { DmnError, DecisionError } from '../error/Errors.js';
import { coerceTypeRef } from '../typeRef.js';

/**
 * DMN input data element — supplies a named input value from the evaluation input
 * @param {any} inputDataDef dmn-moddle input data definition
 * @param {import('../Context.js').Context} context
 */
export function InputData(inputDataDef, context) {
  return new DrgElement(InputDataBehaviour, inputDataDef, context);
}

/**
 * @param {DrgElement} element
 */
export function InputDataBehaviour(element) {
  this.id = element.id;
  this.type = element.type;
  this.element = element;
  this.variable = element.behaviour.variable;
}

InputDataBehaviour.prototype.execute = function execute(executeMessage, callback) {
  const input = executeMessage?.input || {};
  const name = this.variable?.name || this.element.name || this.id;
  const value = name in input ? input[name] : this.element.environment.variables[name];

  let coerced;
  try {
    coerced = coerceTypeRef(value, this.variable?.typeRef, this.element);
  } catch (err) {
    // a plain error from a type override is wrapped like everywhere else, with the original as cause
    return callback(err instanceof DmnError ? err : new DecisionError(/** @type {Error} */ (err).message, this, err));
  }
  return callback(null, coerced);
};
