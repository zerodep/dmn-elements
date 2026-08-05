/**
 * DMN knowledge requirement — edge in the DRG from a decision or business knowledge
 * model to a required business knowledge model
 * @param {any} requirementDef dmn-moddle knowledge requirement definition
 * @param {import('../Context.js').Context} context
 */
export function KnowledgeRequirement(requirementDef, context) {
  /** @type {string} */
  this.id = requirementDef.id;
  /** @type {string} */
  this.type = requirementDef.$type;
  this.behaviour = requirementDef;
  this.context = context;
  this.required = requirementDef.requiredKnowledge;
}
