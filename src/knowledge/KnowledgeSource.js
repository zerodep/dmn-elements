import { DrgElement } from '../drgElement/DrgElement.js';

/**
 * DMN knowledge source — documentation-only DRG element (authority for a decision),
 * no evaluation semantics
 * @param {any} knowledgeSourceDef dmn-moddle knowledge source definition
 * @param {import('../Context.js').Context} context
 */
export function KnowledgeSource(knowledgeSourceDef, context) {
  return new DrgElement(KnowledgeSourceBehaviour, knowledgeSourceDef, context);
}

/**
 * @param {DrgElement} element
 */
export function KnowledgeSourceBehaviour(element) {
  this.id = element.id;
  this.type = element.type;
  this.element = element;
}

KnowledgeSourceBehaviour.prototype.execute = function execute(executeMessage, callback) {
  return callback(null);
};
