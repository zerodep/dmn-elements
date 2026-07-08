/**
 * DMN information requirement — edge in the DRG from a decision to a required
 * decision or required input data
 * @param {any} requirementDef dmn-moddle information requirement definition
 * @param {import('../Context.js').Context} context
 */
export function InformationRequirement(requirementDef, context) {
  this.id = requirementDef.id;
  this.type = requirementDef.$type;
  this.behaviour = requirementDef;
  this.context = context;
  this.required = requirementDef.requiredDecision || requirementDef.requiredInput;
}
