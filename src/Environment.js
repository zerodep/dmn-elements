import { Expressions } from './Expressions.js';
import { DecisionError } from './error/Errors.js';

const kServices = Symbol.for('services');
const kGuardedServices = Symbol.for('guarded services');
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
  this[kGuardedServices] = guardServices(this[kServices], this.Logger('environment'));
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
 * Evaluate a FEEL expression with environment variables as base context and
 * services exposed under `services` — a variable or context key named
 * `services` shadows the overlay
 * @param {string} expression
 * @param {Record<string, any>} [context] merged over environment variables
 */
Environment.prototype.resolveExpression = function resolveExpression(expression, context) {
  return this.expressions.resolveExpression(expression, { services: this[kGuardedServices], ...this[kVariables], ...context });
};

/**
 * Evaluate a FEEL unary tests expression with environment variables as base context and
 * services exposed under `services`
 * @param {string} test
 * @param {Record<string, any>} [context] merged over environment variables, tested value on key `?`
 */
Environment.prototype.unaryTest = function unaryTest(test, context) {
  return this.expressions.unaryTest(test, { services: this[kGuardedServices], ...this[kVariables], ...context });
};

/**
 * Overlay services with a proxy that fails a promise-returning service loudly —
 * FEEL evaluation is synchronous, so a leaked promise would silently corrupt the
 * result instead of erroring, and its eventual rejection could never be observed.
 * Reading an unregistered service name logs a warning, since FEEL resolves the
 * invocation to null without an error
 * @param {Record<string, Function>} services
 * @param {import('#types').ILogger} logger
 * @returns {Record<string, Function>}
 */
function guardServices(services, logger) {
  const wrappers = new Map();
  const warned = new Set();
  return new Proxy(services, {
    // feelin probes context keys with `in` — warn once per unregistered name
    has(target, name) {
      const found = name in target;
      if (!found && typeof name === 'string' && !warned.has(name)) {
        warned.add(name);
        logger.warn(`<services.${name}> is not a registered service, a FEEL invocation yields null`);
      }
      return found;
    },
    get(target, name) {
      const fn = target[name];
      if (typeof fn !== 'function') return fn;
      let wrapper = wrappers.get(fn);
      if (!wrapper) {
        wrapper = function guardedService(...args) {
          const result = fn.apply(this, args);
          if (typeof result?.then === 'function') {
            result.then(undefined, () => {
              /* the promise is discarded, so its rejection is not unhandled */
            });
            throw new DecisionError(`service <${String(name)}> returned a promise, service functions must be synchronous`);
          }
          return result;
        };
        // feelin source-parses the signature for parameter names and arity
        wrapper.toString = () => fn.toString();
        if (fn.$args) wrapper.$args = fn.$args;
        wrappers.set(fn, wrapper);
      }
      return wrapper;
    },
  });
}

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
