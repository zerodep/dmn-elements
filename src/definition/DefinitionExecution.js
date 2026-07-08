import { DecisionError } from '../error/Errors.js';

/**
 * @typedef {object} TraceRequirement one resolved requirement of a traced element
 * @property {string} id requirement id
 * @property {string} required required element id
 * @property {string} type required element type
 * @property {string} bound name the result was bound under
 * @property {any} [value] bound value, absent for knowledge bindings
 *
 * @typedef {object} TraceEntry one evaluated element, in completion order
 * @property {string} id element id
 * @property {string} type element type
 * @property {string} [name] element name
 * @property {TraceRequirement[]} requirements resolved requirements
 * @property {string} [decisionLogic] decision logic type, decisions only
 * @property {string} [hitPolicy] decision tables only
 * @property {string} [aggregation] COLLECT decision tables only
 * @property {string[]} [matchedRules] matched rule ids, decision tables only
 * @property {any} [result] evaluation result, absent for knowledge bindings
 */

/**
 * One evaluation run — walks the decision requirement graph bottom up, memoizing
 * decision results and business knowledge model bindings, guarding against circular
 * requirements. Collects an evaluation trace in completion order.
 *
 * Stateless by design: nothing survives the run (see AGENTS.md).
 * @param {import('./Definition.js').Definition} definition
 */
export function DefinitionExecution(definition) {
  this.definition = definition;
  this.context = definition.context;
  this.environment = definition.environment;
  this.logger = definition.environment.Logger(definition.type.toLowerCase());
  /** @type {TraceEntry[]} evaluated elements in completion order */
  this.trace = [];
  /** @internal decision results and knowledge bindings by element id */
  this.results = new Map();
  /** @internal elements being evaluated, for cycle detection */
  this.visiting = new Set();
}

/**
 * @param {string} decisionId
 * @param {Record<string, any>} input input data values
 * @param {(err: Error | null, result?: any) => void} callback
 */
DefinitionExecution.prototype.evaluate = function evaluate(decisionId, input, callback) {
  const decisionDef = this.context.getDecisionById(decisionId);
  if (!decisionDef) {
    const serviceDef = this.context.getDrgElementById(decisionId);
    if (serviceDef?.$type === 'dmn:DecisionService') {
      this.logger.debug(`<${this.definition.id}> run decision service <${decisionId}>`);
      return this._evaluateService(serviceDef, { ...input }, callback);
    }
    return callback(new DecisionError(`<${decisionId}> was not found in ${this.definition.id}`, this.definition));
  }
  this.logger.debug(`<${this.definition.id}> run decision <${decisionId}>`);
  return this._evaluateDecision(decisionDef, { ...input }, callback);
};

/**
 * Evaluate a decision service: seed provided input decision values, then evaluate
 * the output decisions — encapsulated decisions are reached through requirements
 * @internal
 */
DefinitionExecution.prototype._evaluateService = function evaluateService(serviceDef, input, callback) {
  const parts = this._resolveServiceParts(serviceDef);
  if (parts instanceof DecisionError) return callback(parts);

  /** @type {TraceEntry} */
  const entry = { id: serviceDef.id, type: serviceDef.$type, name: serviceDef.name, requirements: [] };

  for (const inputDecision of parts.inputDecisions) {
    const bound = resultName(inputDecision);
    if (!(bound in input)) {
      return callback(
        new DecisionError(`<${serviceDef.id}> input decision <${inputDecision.id}> expects a value bound to ${bound}`, serviceDef)
      );
    }
    const value = input[bound];
    this.results.set(inputDecision.id, value);
    entry.requirements.push({ id: inputDecision.id, required: inputDecision.id, type: inputDecision.$type, bound, value });
  }

  return this._evaluateOutputs(parts.outputs, input, (err, result) => {
    if (err) return callback(err);
    this.logger.debug(`<${serviceDef.id}> completed`);
    entry.result = result;
    this.trace.push(entry);
    return callback(null, result);
  });
};

/**
 * Resolve a decision service's output and input decision references
 * @internal
 * @returns {{ outputs: any[], inputDecisions: any[] } | DecisionError}
 */
DefinitionExecution.prototype._resolveServiceParts = function resolveServiceParts(serviceDef) {
  const context = this.context;

  const resolve = (refs, role) => {
    const resolved = [];
    for (const ref of refs || []) {
      const target = ref?.href?.[0] === '#' ? context.getDrgElementById(ref.href.slice(1)) : ref;
      if (!target) return new DecisionError(`<${serviceDef.id}> ${role} ${ref?.href} was not found`, serviceDef);
      resolved.push(target);
    }
    return resolved;
  };

  const outputs = resolve(serviceDef.outputDecision, 'output decision');
  if (outputs instanceof DecisionError) return outputs;
  if (!outputs.length) return new DecisionError(`<${serviceDef.id}> has no output decisions`, serviceDef);

  const inputDecisions = resolve(serviceDef.inputDecision, 'input decision');
  if (inputDecisions instanceof DecisionError) return inputDecisions;

  const inputData = resolve(serviceDef.inputData, 'input data');
  if (inputData instanceof DecisionError) return inputData;

  return { outputs, inputDecisions, inputData };
};

/**
 * Evaluate output decisions sequentially — a single output decision yields its bare
 * result, multiple yield an object keyed by output decision variable name
 * @internal
 */
DefinitionExecution.prototype._evaluateOutputs = function evaluateOutputs(outputs, input, callback) {
  /** @type {Record<string, any>} */
  const combined = {};

  const next = (idx) => {
    if (idx >= outputs.length) {
      return callback(null, outputs.length < 2 ? combined[resultName(outputs[0])] : combined);
    }
    return this._evaluateDecision(outputs[idx], input, (err, result) => {
      if (err) return callback(err);
      combined[resultName(outputs[idx])] = result;
      return next(idx + 1);
    });
  };

  return next(0);
};

/**
 * @internal
 */
DefinitionExecution.prototype._evaluateDecision = function evaluateDecision(decisionDef, input, callback) {
  const id = decisionDef.id;
  if (this.results.has(id)) {
    this.logger.debug(`<${id}> return memoized result`);
    return callback(null, this.results.get(id));
  }
  if (this.visiting.has(id)) return callback(new DecisionError(`circular requirement detected at <${id}>`, decisionDef));
  this.visiting.add(id);

  /** @type {TraceEntry} */
  const entry = { id, type: decisionDef.$type, name: decisionDef.name, requirements: [] };

  this._resolveRequirements(decisionDef, input, entry, (requirementErr) => {
    if (requirementErr) return callback(requirementErr);

    this.context.getElementById(id).evaluate({ input, trace: entry }, (err, result) => {
      this.visiting.delete(id);
      if (err) return callback(err);
      this.logger.debug(`<${id}> completed`);
      entry.result = result;
      this.trace.push(entry);
      this.results.set(id, result);
      return callback(null, result);
    });
  });
};

/**
 * Evaluate required decisions, input data, and business knowledge models, binding
 * results to the evaluation input under each element's variable name and recording
 * the bindings on the requiring element's trace entry
 * @internal
 */
DefinitionExecution.prototype._resolveRequirements = function resolveRequirements(drgElementDef, input, entry, callback) {
  const context = this.context;
  const requirements = [...(drgElementDef.informationRequirement || []), ...(drgElementDef.knowledgeRequirement || [])];

  const next = (idx) => {
    if (idx >= requirements.length) return callback(null);

    const requirement = requirements[idx];
    const targetRef = requirement.requiredDecision || requirement.requiredInput || requirement.requiredKnowledge;
    const target = targetRef?.href?.[0] === '#' ? context.getDrgElementById(targetRef.href.slice(1)) : targetRef;
    if (!target)
      return callback(new DecisionError(`<${drgElementDef.id}> requirement <${requirement.id}> target was not found`, drgElementDef));

    switch (target.$type) {
      case 'dmn:Decision':
        this.logger.debug(`<${drgElementDef.id}> requires decision <${target.id}>`);
        return this._evaluateDecision(target, input, (err, result) => {
          if (err) return callback(err);
          this.logger.debug(`<${drgElementDef.id}> bound <${resultName(target)}> from decision <${target.id}>`);
          input[resultName(target)] = result;
          entry.requirements.push({
            id: requirement.id,
            required: target.id,
            type: target.$type,
            bound: resultName(target),
            value: result,
          });
          return next(idx + 1);
        });
      case 'dmn:InputData':
        this.logger.debug(`<${drgElementDef.id}> requires input data <${target.id}>`);
        return context.getElementById(target.id).evaluate({ input }, (err, value) => {
          if (err) return callback(err);
          // an absent value must not shadow environment variables in the expression context
          if (value !== undefined) input[resultName(target)] = value;
          entry.requirements.push({ id: requirement.id, required: target.id, type: target.$type, bound: resultName(target), value });
          return next(idx + 1);
        });
      case 'dmn:BusinessKnowledgeModel':
        this.logger.debug(`<${drgElementDef.id}> requires knowledge <${target.id}>`);
        return this._evaluateBkm(target, (err, invocable) => {
          if (err) return callback(err);
          this.logger.debug(`<${drgElementDef.id}> bound function <${resultName(target)}> from <${target.id}>`);
          input[resultName(target)] = invocable;
          entry.requirements.push({ id: requirement.id, required: target.id, type: target.$type, bound: resultName(target) });
          return next(idx + 1);
        });
      case 'dmn:DecisionService':
        this.logger.debug(`<${drgElementDef.id}> requires decision service <${target.id}>`);
        return this._bindService(target, (err, invocable) => {
          if (err) return callback(err);
          this.logger.debug(`<${drgElementDef.id}> bound function <${resultName(target)}> from <${target.id}>`);
          input[resultName(target)] = invocable;
          entry.requirements.push({ id: requirement.id, required: target.id, type: target.$type, bound: resultName(target) });
          return next(idx + 1);
        });
      default:
        return callback(
          new DecisionError(`<${drgElementDef.id}> requirement <${requirement.id}> unsupported target ${target.$type}`, drgElementDef)
        );
    }
  };

  return next(0);
};

/**
 * Bind a business knowledge model as a FEEL-invocable function. The function scope
 * is closed: its own required knowledge is resolved here, the caller's evaluation
 * input never leaks in.
 * @internal
 */
DefinitionExecution.prototype._evaluateBkm = function evaluateBkm(bkmDef, callback) {
  const id = bkmDef.id;
  if (this.results.has(id)) return callback(null, this.results.get(id));
  if (this.visiting.has(id)) return callback(new DecisionError(`circular requirement detected at <${id}>`, bkmDef));
  this.visiting.add(id);

  /** @type {TraceEntry} */
  const entry = { id, type: bkmDef.$type, name: bkmDef.name, requirements: [] };

  const knowledge = {};
  this._resolveRequirements(bkmDef, knowledge, entry, (requirementErr) => {
    if (requirementErr) return callback(requirementErr);

    this.context.getElementById(id).evaluate({ input: knowledge }, (err, invocable) => {
      this.visiting.delete(id);
      if (err) return callback(err);
      this.trace.push(entry);
      this.results.set(id, invocable);
      return callback(null, invocable);
    });
  });
};

/**
 * Bind a decision service as a FEEL-invocable function. Positional parameters are
 * the service's input decisions followed by its input data, per the DMN spec. Each
 * invocation runs a fresh sub-execution — input decision arguments are seeded, the
 * caller's evaluation input never leaks in — sharing this run's cycle guard and trace.
 * @internal
 */
DefinitionExecution.prototype._bindService = function bindService(serviceDef, callback) {
  const id = serviceDef.id;
  if (this.results.has(id)) return callback(null, this.results.get(id));

  const parts = this._resolveServiceParts(serviceDef);
  if (parts instanceof DecisionError) return callback(parts);

  const parameters = [
    ...parts.inputDecisions.map((target) => ({ seedId: target.id, name: resultName(target) })),
    ...parts.inputData.map((target) => ({ seedId: undefined, name: resultName(target) })),
  ];

  const execution = this;
  const invocable = function invokeService(...args) {
    execution.logger.debug(`<${id}> invoked with ${args.length} argument${args.length === 1 ? '' : 's'}`);

    const sub = new DefinitionExecution(execution.definition);
    sub.visiting = execution.visiting;
    sub.trace = execution.trace;

    /** @type {Record<string, any>} */
    const scope = {};
    for (const [idx, parameter] of parameters.entries()) {
      scope[parameter.name] = args[idx];
      if (parameter.seedId) sub.results.set(parameter.seedId, args[idx]);
    }

    let completed = false;
    /** @type {Error | null} */
    let failure = null;
    let outcome;
    sub._evaluateOutputs(parts.outputs, scope, (err, result) => {
      completed = true;
      failure = err;
      outcome = result;
    });
    // FEEL invocation is synchronous — evaluation completes within the call today,
    // guard in case async host seams are involved in the future
    if (!completed) throw new DecisionError(`<${id}> did not complete synchronously`, serviceDef);
    if (failure) throw failure;
    return outcome;
  };

  /** @type {TraceEntry} */
  const entry = { id, type: serviceDef.$type, name: serviceDef.name, requirements: [] };
  this.trace.push(entry);
  this.results.set(id, invocable);
  return callback(null, invocable);
};

function resultName(drgElementDef) {
  return drgElementDef.variable?.name || drgElementDef.name || drgElementDef.id;
}
