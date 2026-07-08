/**
 * DMN authority requirement — documentation-only edge to a knowledge source,
 * no evaluation semantics
 * @param {any} requirementDef dmn-moddle authority requirement definition
 * @param {import('../Context.js').Context} context
 */
export function AuthorityRequirement(requirementDef, context) {
  this.id = requirementDef.id;
  this.type = requirementDef.$type;
  this.behaviour = requirementDef;
  this.context = context;
  this.required = requirementDef.requiredAuthority;
}
