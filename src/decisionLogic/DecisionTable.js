import { DecisionError } from '../error/Errors.js';
import { coerceTypeRef } from '../typeRef.js';
import { executeLogic } from './executeLogic.js';

/**
 * Decision table evaluation — inputs, outputs, rules, and hit policy resolution.
 *
 * Input entries are FEEL unary tests evaluated with the input expression result on `?`.
 * Irrelevant entries (`-` or empty) match anything. A single output column yields the
 * bare output value, multiple output columns yield an object keyed by output name.
 * @param {any} decisionTableDef dmn-moddle decision table definition
 * @param {import('../Context.js').Context} context
 */
export function DecisionTable(decisionTableDef, context) {
  /** @type {string | undefined} */
  this.id = decisionTableDef.id;
  /** @type {string} */
  this.type = decisionTableDef.$type;
  this.behaviour = decisionTableDef;
  this.context = context;
  this.environment = context.environment;
  this.logger = context.environment.Logger(this.type.toLowerCase());

  const { input = [], output = [], rule = [], hitPolicy = 'UNIQUE', aggregation } = decisionTableDef;
  /** @type {any[]} input clauses */
  this.inputs = input;
  /** @type {any[]} output clauses */
  this.outputs = output;
  /** @type {any[]} rules, in declaration order */
  this.rules = rule;
  /** @type {string} hit policy, UNIQUE when undeclared */
  this.hitPolicy = hitPolicy;
  /** @type {string | undefined} COLLECT aggregation */
  this.aggregation = aggregation;
}

/**
 * @param {{ input?: Record<string, any> }} executeMessage evaluation input context
 * @param {(err: Error | null, result?: any) => void} callback
 */
DecisionTable.prototype.execute = function execute(executeMessage, callback) {
  return executeLogic(this, executeMessage, callback);
};

/**
 * Evaluate synchronously, e.g. as encapsulated logic invoked from FEEL
 * @param {Record<string, any>} [input] evaluation input context
 * @param {import('../definition/DefinitionExecution.js').TraceEntry} [trace] trace entry to annotate with hit policy and matched rules
 * @returns {any} hit policy resolved result
 */
DecisionTable.prototype.evaluate = function evaluateTable(input = {}, trace) {
  if (!this.outputs.length) throw new DecisionError(`<${this.id}> decision table has no output`, this);

  const { rules, hitPolicy, aggregation, environment } = this;

  const inputValues = this.inputs.map((clause) => {
    const inputExpression = clause.inputExpression;
    const text = inputExpression?.text;
    return text ? coerceTypeRef(environment.resolveExpression(text, input), inputExpression.typeRef, this) : null;
  });

  const matched = rules.filter((rule) => this._matchesRule(rule, inputValues, input));
  this.logger.debug(
    `<${this.id}> ${matched.length} of ${rules.length} rules matched${matched.length ? `: ${matched.map((rule) => rule.id).join(', ')}` : ''}, resolving hit policy ${hitPolicy}`
  );

  if (trace) {
    trace.hitPolicy = hitPolicy;
    if (aggregation) trace.aggregation = aggregation;
    trace.matchedRules = matched.map((rule) => rule.id);
  }

  return this._resolveHitPolicy(matched, input);
};

/** @internal */
DecisionTable.prototype._matchesRule = function matchesRule(rule, inputValues, input) {
  return (rule.inputEntry || []).every((entry, idx) => {
    const text = entry.text?.trim();
    if (!text || text === '-') return true;
    return this.environment.unaryTest(text, { ...input, '?': inputValues[idx] }) === true;
  });
};

/** @internal */
DecisionTable.prototype._resolveHitPolicy = function resolveHitPolicy(matched, input) {
  const hitPolicy = this.hitPolicy;
  // per the spec, default output entries are the result whenever no rule matched, regardless of hit policy
  if (!matched.length && this.outputs.some((output) => output.defaultOutputEntry)) return this._defaultOutput(input);

  switch (hitPolicy) {
    case 'UNIQUE': {
      if (matched.length > 1) throw this._hitPolicyError(hitPolicy, matched);
      return matched.length ? this._ruleOutput(matched[0], input) : null;
    }
    case 'ANY': {
      if (!matched.length) return null;
      const outputs = matched.map((rule) => this._ruleOutput(rule, input));
      const first = JSON.stringify(outputs[0]);
      if (!outputs.every((output) => JSON.stringify(output) === first)) throw this._hitPolicyError(hitPolicy, matched);
      return outputs[0];
    }
    case 'FIRST':
      return matched.length ? this._ruleOutput(matched[0], input) : null;
    case 'PRIORITY':
      return matched.length ? this._sortByPriority(hitPolicy, matched, input)[0] : null;
    case 'RULE ORDER':
      return matched.map((rule) => this._ruleOutput(rule, input));
    case 'OUTPUT ORDER':
      return this._sortByPriority(hitPolicy, matched, input);
    case 'COLLECT':
      return this._collect(matched, input);
    default:
      throw new DecisionError(`<${this.id}> unsupported hit policy ${hitPolicy}`, this);
  }
};

/**
 * Output of a matched rule — bare value for a single output column, otherwise an
 * object keyed by output name
 * @internal
 */
DecisionTable.prototype._ruleOutput = function ruleOutput(rule, input) {
  const outputs = this.outputs;
  const entries = rule.outputEntry;
  if (outputs.length < 2) return this._entryValue(entries?.[0], input, outputs[0].typeRef);

  /** @type {Record<string, any>} */
  const result = {};
  for (const [idx, output] of outputs.entries()) {
    result[outputName(output)] = this._entryValue(entries?.[idx], input, output.typeRef);
  }
  return result;
};

/** @internal */
DecisionTable.prototype._entryValue = function entryValue(entry, input, typeRef) {
  const text = entry?.text;
  if (!text?.trim()) return null;
  return coerceTypeRef(this.environment.resolveExpression(text, input), typeRef, this);
};

/**
 * Default output entries apply when no rule matched — the caller checks that at least one output declares one
 * @internal
 */
DecisionTable.prototype._defaultOutput = function defaultOutput(input) {
  const outputs = this.outputs;
  if (outputs.length < 2) return this._entryValue(outputs[0].defaultOutputEntry, input, outputs[0].typeRef);

  /** @type {Record<string, any>} */
  const result = {};
  for (const output of outputs) {
    result[outputName(output)] = output.defaultOutputEntry ? this._entryValue(output.defaultOutputEntry, input, output.typeRef) : null;
  }
  return result;
};

/**
 * Order matched rule outputs by output values priority, highest priority first
 * @internal
 */
DecisionTable.prototype._sortByPriority = function sortByPriority(hitPolicy, matched, input) {
  const outputs = this.outputs;
  // ranking considers the output columns that declare output values — a column without them is rank-neutral
  const priorities = outputs.map((output) => {
    const text = output.outputValues?.text;
    return text ? this.environment.resolveExpression(`[${text}]`, input) : null;
  });
  if (!priorities.some(Boolean)) {
    throw new DecisionError(`<${this.id}> hit policy ${hitPolicy} requires output values on at least one output`, this);
  }

  const ranked = matched.map((rule) => {
    const value = this._ruleOutput(rule, input);
    const vector =
      outputs.length < 2
        ? [priorityIndex(priorities[0], value)]
        : outputs.map((output, idx) => (priorities[idx] ? priorityIndex(priorities[idx], value[outputName(output)]) : 0));
    return { value, vector };
  });

  ranked.sort((a, b) => {
    for (let idx = 0; idx < a.vector.length; idx++) {
      if (a.vector[idx] !== b.vector[idx]) return a.vector[idx] - b.vector[idx];
    }
    return 0;
  });

  return ranked.map((rank) => rank.value);
};

/** @internal */
DecisionTable.prototype._collect = function collect(matched, input) {
  const values = matched.map((rule) => this._ruleOutput(rule, input));
  const aggregation = this.aggregation;
  if (!aggregation) return values;
  if (this.outputs.length > 1) {
    throw new DecisionError(`<${this.id}> COLLECT aggregation requires a single output`, this);
  }

  switch (aggregation) {
    case 'COUNT':
      return values.length;
    case 'SUM':
    case 'MIN':
    case 'MAX': {
      if (values.some((value) => typeof value !== 'number')) {
        throw new DecisionError(`<${this.id}> COLLECT ${aggregation} aggregation requires numeric outputs`, this);
      }
      if (!values.length) return null;
      if (aggregation === 'SUM') return values.reduce((sum, value) => sum + value, 0);
      return aggregation === 'MIN' ? Math.min(...values) : Math.max(...values);
    }
    default:
      throw new DecisionError(`<${this.id}> unsupported COLLECT aggregation ${aggregation}`, this);
  }
};

/** @internal */
DecisionTable.prototype._hitPolicyError = function hitPolicyError(hitPolicy, matched) {
  const ruleIds = matched.map((rule) => `<${rule.id}>`).join(', ');
  return new DecisionError(`<${this.id}> ${hitPolicy} hit policy violated by rules ${ruleIds}`, this);
};

/** an output column without a name is keyed by its id */
function outputName(output) {
  return output.name || output.id;
}

function priorityIndex(priorityValues, value) {
  const idx = priorityValues.indexOf(value);
  return idx === -1 ? priorityValues.length : idx;
}
