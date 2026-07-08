/**
 * Generic DRG element wrapper — the activity/Activity.js analogue.
 *
 * Element factories pair this wrapper with an element-specific Behaviour that
 * implements `execute(executeMessage, callback)`.
 * @param {Function} Behaviour element behaviour constructor
 * @param {any} elementDef dmn-moddle element definition
 * @param {import('../Context.js').Context} context
 */
export function DrgElement(Behaviour, elementDef, context) {
  this.id = elementDef.id;
  this.type = elementDef.$type;
  this.name = elementDef.name;
  this.behaviour = elementDef;
  this.Behaviour = Behaviour;
  this.context = context;
  this.environment = context.environment;
  this.logger = context.environment.Logger(this.type.toLowerCase());
}

/**
 * Evaluate element — mints a Behaviour instance and executes it
 * @param {any} executeMessage requirements output and evaluation input
 * @param {(err: Error | null, result?: any) => void} callback
 */
DrgElement.prototype.evaluate = function evaluate(executeMessage, callback) {
  this.logger.debug(`<${this.id}> evaluate`);
  return new this.Behaviour(this).execute(executeMessage, callback);
};
