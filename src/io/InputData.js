import { DrgElement } from '../drgElement/DrgElement.js';
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
    return callback(/** @type {Error} */ (err));
  }
  return callback(null, coerced);
};
