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
  /** @type {import('../Context.js').Extensions | undefined} extension hooks, when registered extensions returned any */
  this.extensions = context.loadExtensions(this);
}

/**
 * Evaluate element — mints a Behaviour instance and executes it, running any
 * extension hooks around the execution
 * @param {any} executeMessage requirements output and evaluation input
 * @param {(err: Error | null, result?: any) => void} callback
 */
DrgElement.prototype.evaluate = function evaluate(executeMessage, callback) {
  this.logger.debug(`<${this.id}> evaluate`);
  const extensions = this.extensions;
  if (!extensions) return new this.Behaviour(this).execute(executeMessage, callback);

  extensions.activate(executeMessage);
  return new this.Behaviour(this).execute(executeMessage, (err, result) => {
    extensions.deactivate({ ...executeMessage, ...(err ? { error: err } : { result }) });
    return callback(err, result);
  });
};
