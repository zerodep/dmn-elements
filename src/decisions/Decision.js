import { DrgElement } from '../drgElement/DrgElement.js';
import { BoxedContext } from '../decisionLogic/BoxedContext.js';
import { DecisionTable } from '../decisionLogic/DecisionTable.js';
import { LiteralExpression } from '../decisionLogic/LiteralExpression.js';
import { DecisionError } from '../error/Errors.js';

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

  switch (decisionLogic.$type) {
    case 'dmn:DecisionTable':
      return new DecisionTable(decisionLogic, this.element.context).execute(executeMessage, callback);
    case 'dmn:LiteralExpression':
      return new LiteralExpression(decisionLogic, this.element.context).execute(executeMessage, callback);
    case 'dmn:Context':
      return new BoxedContext(decisionLogic, this.element.context).execute(executeMessage, callback);
    default:
      return callback(new DecisionError(`<${this.id}> unsupported decision logic ${decisionLogic.$type}`, this));
  }
};
