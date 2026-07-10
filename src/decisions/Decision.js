import { DrgElement } from '../drgElement/DrgElement.js';
import { BoxedContext } from '../decisionLogic/BoxedContext.js';
import { BoxedList } from '../decisionLogic/BoxedList.js';
import { DecisionTable } from '../decisionLogic/DecisionTable.js';
import { FunctionDefinition } from '../decisionLogic/FunctionDefinition.js';
import { Invocation } from '../decisionLogic/Invocation.js';
import { LiteralExpression } from '../decisionLogic/LiteralExpression.js';
import { Relation } from '../decisionLogic/Relation.js';
import { DmnError, DecisionError } from '../error/Errors.js';
import { coerceTypeRef } from '../typeRef.js';

/**
 * DMN decision element — dispatches to its decision logic (decision table,
 * literal expression) when evaluated
 * @param {any} decisionDef dmn-moddle decision definition
 * @param {import('../Context.js').Context} context
 */
export function Decision(decisionDef, context) {
  return new DrgElement(DecisionBehaviour, decisionDef, context);
}

/**
 * @param {DrgElement} element
 */
export function DecisionBehaviour(element) {
  this.id = element.id;
  this.type = element.type;
  this.element = element;
  this.decisionLogic = element.behaviour.decisionLogic;
}

DecisionBehaviour.prototype.execute = function execute(executeMessage, callback) {
  const decisionLogic = this.decisionLogic;
  if (!decisionLogic) return callback(new DecisionError(`<${this.id}> has no decision logic`, this));
  if (executeMessage?.trace) executeMessage.trace.decisionLogic = decisionLogic.$type;

  // opt-in via the validateResult setting: the result is coerced and validated
  // against the decision variable typeRef, e.g. an item definition's allowed values
  if (this.element.environment.settings.validateResult) callback = this._validatedCallback(callback);

  switch (decisionLogic.$type) {
    case 'dmn:DecisionTable':
      return new DecisionTable(decisionLogic, this.element.context).execute(executeMessage, callback);
    case 'dmn:LiteralExpression':
      return new LiteralExpression(decisionLogic, this.element.context).execute(executeMessage, callback);
    case 'dmn:Context':
      return new BoxedContext(decisionLogic, this.element.context).execute(executeMessage, callback);
    case 'dmn:Invocation':
      return new Invocation(decisionLogic, this.element.context).execute(executeMessage, callback);
    case 'dmn:Relation':
      return new Relation(decisionLogic, this.element.context).execute(executeMessage, callback);
    case 'dmn:List':
      return new BoxedList(decisionLogic, this.element.context).execute(executeMessage, callback);
    case 'dmn:FunctionDefinition':
      return new FunctionDefinition(decisionLogic, this.element.context).execute(executeMessage, callback);
    default:
      return callback(new DecisionError(`<${this.id}> unsupported decision logic ${decisionLogic.$type}`, this));
  }
};

/** @internal */
DecisionBehaviour.prototype._validatedCallback = function validatedCallback(callback) {
  const element = this.element;
  return (err, result) => {
    if (err) return callback(err);
    let coerced;
    try {
      coerced = coerceTypeRef(result, element.behaviour.variable?.typeRef, element);
    } catch (validationErr) {
      return callback(
        validationErr instanceof DmnError
          ? validationErr
          : new DecisionError(/** @type {Error} */ (validationErr).message, this, validationErr)
      );
    }
    return callback(null, coerced);
  };
};
