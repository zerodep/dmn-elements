import { Expressions } from './Expressions.js';

const kServices = Symbol.for('services');
const kVariables = Symbol.for('variables');

/**
 * Shared evaluation environment: variables, services, settings, and the FEEL engine.
 *
 * Mirrors bpmn-elements Environment, minus scripts and timers — DMN evaluation is
 * expression-only and has no waiting semantics.
 * @param {import('#types').EnvironmentOptions} [options]
 */
export function Environment(options = {}) {
  if (!(this instanceof Environment)) return new Environment(options);

  /** @type {Record<string, any>} unlisted constructor options */
  this.options = validateOptions(options);
  /** @type {import('#types').IExpressions} */
  this.expressions = options.expressions || new Expressions();
  /** @type {Record<string, Function> | undefined} */
  this.extensions = options.extensions;
  /** @type {Record<string, any>} */
  this.output = options.output || {};
  /** @type {Record<string, any>} */
  this.settings = { ...options.settings };
  /** @type {(scope: string) => import('#types').ILogger} */
  this.Logger = options.Logger || DummyLogger;
  this[kServices] = options.services || {};
  this[kVariables] = options.variables || {};
}

Object.defineProperties(Environment.prototype, {
  variables: {
    get() {
      return this[kVariables];
    },
  },
  services: {
    get() {
      return this[kServices];
    },
    set(value) {
      const services = this[kServices];
      for (const name in services) {
        if (!(name in value)) delete services[name];
      }
      Object.assign(services, value);
    },
  },
});

Environment.prototype.getState = function getState() {
  return {
    settings: { ...this.settings },
    variables: { ...this[kVariables] },
    output: { ...this.output },
  };
};

/**
 * Merge state over current
 * @param {ReturnType<Environment['getState']>} [state]
 */
Environment.prototype.recover = function recover(state) {
  if (!state) return this;
  if (state.settings) Object.assign(this.settings, state.settings);
  if (state.variables) Object.assign(this[kVariables], state.variables);
  if (state.output) Object.assign(this.output, state.output);
  return this;
};

/**
 * Clone environment, sharing expressions and services, resetting output
 * @param {import('#types').EnvironmentOptions} [overrideOptions] take precedence over current
 * @returns {Environment}
 */
Environment.prototype.clone = function clone(overrideOptions = {}) {
  const services = this[kServices];
  const clonedOptions = {
    ...this.options,
    expressions: this.expressions,
    extensions: this.extensions,
    Logger: this.Logger,
    output: {},
    settings: { ...this.settings },
    variables: { ...this[kVariables] },
    ...overrideOptions,
    services,
  };
  if (overrideOptions.services) clonedOptions.services = { ...services, ...overrideOptions.services };

  return new this.constructor(clonedOptions);
};

/** @param {Record<string, any>} newVars merged over current variables */
Environment.prototype.assignVariables = function assignVariables(newVars) {
  if (!newVars || typeof newVars !== 'object') return;
  Object.assign(this[kVariables], newVars);
};

/** @param {Record<string, any>} newSettings merged over current settings */
Environment.prototype.assignSettings = function assignSettings(newSettings) {
  if (!newSettings || typeof newSettings !== 'object') return this;
  Object.assign(this.settings, newSettings);
  return this;
};

/**
 * @param {string} name
 * @returns {Function | undefined}
 */
Environment.prototype.getServiceByName = function getServiceByName(name) {
  return this[kServices][name];
};

/**
 * @param {string} name
 * @param {Function} fn
 */
Environment.prototype.addService = function addService(name, fn) {
  this[kServices][name] = fn;
};

/**
 * Evaluate a FEEL expression with environment variables as base context
 * @param {string} expression
 * @param {Record<string, any>} [context] merged over environment variables
 */
Environment.prototype.resolveExpression = function resolveExpression(expression, context) {
  return this.expressions.resolveExpression(expression, { ...this[kVariables], ...context });
};

/**
 * Evaluate a FEEL unary tests expression with environment variables as base context
 * @param {string} test
 * @param {Record<string, any>} [context] merged over environment variables, tested value on key `?`
 */
Environment.prototype.unaryTest = function unaryTest(test, context) {
  return this.expressions.unaryTest(test, { ...this[kVariables], ...context });
};

function validateOptions(input) {
  const options = {};
  for (const key in input) {
    switch (key) {
      case 'expressions': {
        const expressions = input[key];
        if (!expressions || typeof expressions.resolveExpression !== 'function' || typeof expressions.unaryTest !== 'function') {
          throw new Error('expressions is expected to have a resolveExpression and a unaryTest function');
        }
        break;
      }
      case 'extensions': {
        const extensions = input[key];
        if (extensions === undefined) break;
        if (typeof extensions !== 'object') throw new Error('extensions is expected to be an object');
        for (const name in extensions) {
          if (typeof extensions[name] !== 'function') throw new Error(`extensions[${name}] is not a function`);
        }
        break;
      }
      case 'Logger':
      case 'output':
      case 'services':
      case 'settings':
      case 'variables':
        break;
      default:
        options[key] = input[key];
    }
  }
  return options;
}

function DummyLogger() {
  return {
    debug() {},
    error() {},
    warn() {},
  };
}
