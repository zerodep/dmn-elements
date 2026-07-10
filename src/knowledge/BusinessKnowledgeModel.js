import { DrgElement } from '../drgElement/DrgElement.js';
import { BoxedContext } from '../decisionLogic/BoxedContext.js';
import { BoxedList } from '../decisionLogic/BoxedList.js';
import { DecisionTable } from '../decisionLogic/DecisionTable.js';
import { FunctionDefinition } from '../decisionLogic/FunctionDefinition.js';
import { Invocation } from '../decisionLogic/Invocation.js';
import { LiteralExpression } from '../decisionLogic/LiteralExpression.js';
import { Relation } from '../decisionLogic/Relation.js';
import { DecisionError } from '../error/Errors.js';
import { coerceTypeRef } from '../typeRef.js';

/**
 * DMN business knowledge model — reusable decision logic invocable from FEEL as a
 * function named by the model, in any decision or business knowledge model that
 * requires it via a knowledge requirement
 * @param {any} bkmDef dmn-moddle business knowledge model definition
 * @param {import('../Context.js').Context} context
 */
export function BusinessKnowledgeModel(bkmDef, context) {
  return new DrgElement(BusinessKnowledgeModelBehaviour, bkmDef, context);
}

/**
 * @param {DrgElement} element
 */
export function BusinessKnowledgeModelBehaviour(element) {
  this.id = element.id;
  this.type = element.type;
  this.element = element;
  this.encapsulatedLogic = element.behaviour.encapsulatedLogic;
}

/**
 * Evaluates to the FEEL-invocable function. The function scope is closed per the DMN
 * spec: formal parameters and required knowledge only, never the caller's evaluation
 * input. Callable from FEEL with positional or named arguments.
 * @param {{ input?: Record<string, any> }} executeMessage required knowledge bindings
 * @param {(err: Error | null, result?: (...args: any[]) => any) => void} callback called with the function
 */
BusinessKnowledgeModelBehaviour.prototype.execute = function execute(executeMessage, callback) {
  const logic = this.encapsulatedLogic;
  if (!logic) return callback(new DecisionError(`<${this.id}> has no encapsulated logic`, this));
  if (logic.kind && logic.kind !== 'FEEL') {
    return callback(new DecisionError(`<${this.id}> unsupported encapsulated logic kind ${logic.kind}`, this));
  }

  let bodyLogic;
  switch (logic.body?.$type) {
    case 'dmn:DecisionTable':
      bodyLogic = new DecisionTable(logic.body, this.element.context);
      break;
    case 'dmn:LiteralExpression':
      bodyLogic = new LiteralExpression(logic.body, this.element.context);
      break;
    case 'dmn:Context':
      bodyLogic = new BoxedContext(logic.body, this.element.context);
      break;
    case 'dmn:Invocation':
      bodyLogic = new Invocation(logic.body, this.element.context);
      break;
    case 'dmn:Relation':
      bodyLogic = new Relation(logic.body, this.element.context);
      break;
    case 'dmn:List':
      bodyLogic = new BoxedList(logic.body, this.element.context);
      break;
    case 'dmn:FunctionDefinition':
      bodyLogic = new FunctionDefinition(logic.body, this.element.context);
      break;
    default:
      return callback(new DecisionError(`<${this.id}> unsupported encapsulated logic body ${logic.body?.$type}`, this));
  }

  const parameters = logic.formalParameter || [];
  const knowledge = executeMessage?.input || {};
  const element = this.element;

  const invokeBkm = function invokeBkm(...args) {
    element.logger.debug(`<${element.id}> invoked with ${args.length} argument${args.length === 1 ? '' : 's'}`);
    const scope = { ...knowledge };
    for (let idx = 0; idx < parameters.length; idx++) {
      const parameter = parameters[idx];
      scope[parameter.name] = coerceTypeRef(args[idx], parameter.typeRef, element);
    }
    return bodyLogic.evaluate(scope);
  };
  // formal parameter names, so a boxed invocation can map named bindings to positions
  invokeBkm.parameters = parameters.map((parameter) => parameter.name);
  // and for feelin ($args), so FEEL named-argument invocation maps and parameter count is enforced
  invokeBkm.$args = invokeBkm.parameters;

  return callback(null, invokeBkm);
};
