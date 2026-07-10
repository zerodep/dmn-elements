import { DefinitionExecution } from './DefinitionExecution.js';

/**
 * Executable DMN definitions — the top-level element that walks the decision
 * requirement graph (DRG) and evaluates decisions.
 * @param {import('../Context.js').Context} context
 * @param {import('#types').EnvironmentOptions} [options] environment overrides
 */
export function Definition(context, options) {
  if (!(this instanceof Definition)) return new Definition(context, options);

  /** @type {import('../Environment.js').Environment} */
  this.environment = options ? context.environment.clone(options) : context.environment;
  /** @type {import('../Context.js').Context} */
  this.context = options ? context.clone(this.environment) : context;

  this.id = context.id;
  this.name = context.name;
  this.type = context.type;
}

/**
 * Evaluate a decision and, recursively, its required decisions.
 *
 * Evaluation is stateless and completes in one callback chain — DMN has no waiting
 * semantics. The callback shape exists to allow async host services at element
 * boundaries, not to persist or resume runs.
 * @overload
 * @param {string} decisionId
 * @param {(err: Error | null, result?: any) => void} callback called with the decision result
 * @returns {void}
 *
 * @overload
 * @param {string} decisionId
 * @param {Record<string, any>} [input] input data values, merged over environment variables
 * @returns {Promise<any>} decision result
 *
 * @overload
 * @param {string} decisionId
 * @param {Record<string, any> | null} input input data values, merged over environment variables
 * @param {(err: Error | null, result?: any) => void} callback called with the decision result
 * @returns {void}
 *
 * @param {string} decisionId
 * @param {Record<string, any> | ((err: Error | null, result?: any) => void) | null} [input]
 * @param {(err: Error | null, result?: any) => void} [callback]
 */
Definition.prototype.evaluate = function evaluate(decisionId, input, callback) {
  if (typeof input === 'function') {
    callback = input;
    input = undefined;
  }
  if (!callback) {
    return new Promise((resolve, reject) => {
      this.evaluate(decisionId, input, (err, result) => (err ? reject(err) : resolve(result)));
    });
  }
  const run = () => new DefinitionExecution(this).evaluate(decisionId, input || {}, callback);
  // imports resolve through the async resolveImport setting before the run starts,
  // so lookups during the synchronous evaluation are served from the loaded cache
  const loading = this.context.loadImports();
  if (!loading) return run();
  return void loading.then(run, callback);
};

/**
 * Evaluate a decision like {@link Definition#evaluate}, resolving with the result
 * and the evaluation trace — evaluated elements in completion order, each with its
 * requirement bindings, and hit policy resolution for decision tables.
 * @overload
 * @param {string} decisionId
 * @param {(err: Error | null, traced?: { result: any, trace: import('./DefinitionExecution.js').TraceEntry[] }) => void} callback
 * @returns {void}
 *
 * @overload
 * @param {string} decisionId
 * @param {Record<string, any>} [input] input data values, merged over environment variables
 * @returns {Promise<{ result: any, trace: import('./DefinitionExecution.js').TraceEntry[] }>}
 *
 * @overload
 * @param {string} decisionId
 * @param {Record<string, any> | null} input input data values, merged over environment variables
 * @param {(err: Error | null, traced?: { result: any, trace: import('./DefinitionExecution.js').TraceEntry[] }) => void} callback
 * @returns {void}
 *
 * @param {string} decisionId
 * @param {Record<string, any> | ((err: Error | null, traced?: any) => void) | null} [input]
 * @param {(err: Error | null, traced?: any) => void} [callback]
 */
Definition.prototype.trace = function trace(decisionId, input, callback) {
  if (typeof input === 'function') {
    callback = input;
    input = undefined;
  }
  if (!callback) {
    return new Promise((resolve, reject) => {
      this.trace(decisionId, input, (err, traced) => (err ? reject(err) : resolve(traced)));
    });
  }

  const run = () => {
    const execution = new DefinitionExecution(this);
    return execution.evaluate(decisionId, input || {}, (err, result) => {
      if (err) return callback(err);
      return callback(null, { result, trace: execution.trace });
    });
  };
  const loading = this.context.loadImports();
  if (!loading) return run();
  return void loading.then(run, callback);
};

/** @param {string} id */
Definition.prototype.getDecisionById = function getDecisionById(id) {
  return this.context.getDecisionById(id);
};
