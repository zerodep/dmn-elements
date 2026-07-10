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
    this.results.set(refKey(this.context, inputDecision.id), value);
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
 * @param {import('../Context.js').Context} [context] the service's owning context
 * @returns {{ outputs: any[], inputDecisions: any[] } | DecisionError}
 */
DefinitionExecution.prototype._resolveServiceParts = function resolveServiceParts(serviceDef, context = this.context) {
  const resolve = (refs, role) => {
    const resolved = [];
    for (const ref of refs || []) {
      const target = ref?.href ? context.getDrgElementByHref(ref.href) : ref;
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
DefinitionExecution.prototype._evaluateOutputs = function evaluateOutputs(outputs, input, callback, context = this.context) {
  /** @type {Record<string, any>} */
  const combined = {};

  const next = (idx) => {
    if (idx >= outputs.length) {
      return callback(null, outputs.length < 2 ? combined[resultName(outputs[0])] : combined);
    }
    return this._evaluateDecision(
      outputs[idx],
      input,
      (err, result) => {
        if (err) return callback(err);
        combined[resultName(outputs[idx])] = result;
        return next(idx + 1);
      },
      context
    );
  };

  return next(0);
};

/**
 * @internal
 * @param {import('../Context.js').Context} [context] owning context — an imported decision evaluates in its own model
 */
DefinitionExecution.prototype._evaluateDecision = function evaluateDecision(decisionDef, input, callback, context = this.context) {
  const id = decisionDef.id;
  const key = refKey(context, id);
  if (this.results.has(key)) {
    this.logger.debug(`<${id}> return memoized result`);
    return callback(null, this.results.get(key));
  }
  if (this.visiting.has(key)) return callback(new DecisionError(`circular requirement detected at <${id}>`, decisionDef));
  this.visiting.add(key);

  /** @type {TraceEntry} */
  const entry = { id, type: decisionDef.$type, name: decisionDef.name, requirements: [] };

  this._resolveRequirements(
    decisionDef,
    input,
    entry,
    (requirementErr) => {
      if (requirementErr) return callback(requirementErr);

      context.getElementById(id).evaluate({ input, trace: entry }, (err, result) => {
        this.visiting.delete(key);
        if (err) return callback(err);
        this.logger.debug(`<${id}> completed`);
        entry.result = result;
        this.trace.push(entry);
        this.results.set(key, result);
        return callback(null, result);
      });
    },
    context
  );
};

/**
 * Evaluate required decisions, input data, and business knowledge models, binding
 * results to the evaluation input under each element's variable name — nested
 * under the import name for imported elements (`common.Greeting`) — and recording
 * the bindings on the requiring element's trace entry
 * @internal
 * @param {import('../Context.js').Context} [context] the requiring element's owning context
 */
DefinitionExecution.prototype._resolveRequirements = function resolveRequirements(
  drgElementDef,
  input,
  entry,
  callback,
  context = this.context
) {
  const requirements = [...(drgElementDef.informationRequirement || []), ...(drgElementDef.knowledgeRequirement || [])];

  const bind = (importName, name, value) => {
    if (!importName) {
      input[name] = value;
      return name;
    }
    input[importName] = { ...input[importName], [name]: value };
    return `${importName}.${name}`;
  };

  const next = (idx) => {
    if (idx >= requirements.length) return callback(null);

    const requirement = requirements[idx];
    const targetRef = requirement.requiredDecision || requirement.requiredInput || requirement.requiredKnowledge;
    const resolved = targetRef?.href ? context.resolveDrgElementRef(targetRef.href) : targetRef && { elementDef: targetRef, context };
    if (!resolved)
      return callback(new DecisionError(`<${drgElementDef.id}> requirement <${requirement.id}> target was not found`, drgElementDef));

    const { elementDef: target, context: targetContext, importName } = resolved;

    switch (target.$type) {
      case 'dmn:Decision':
        this.logger.debug(`<${drgElementDef.id}> requires decision <${target.id}>`);
        return this._evaluateDecision(
          target,
          input,
          (err, result) => {
            if (err) return callback(err);
            const bound = bind(importName, resultName(target), result);
            this.logger.debug(`<${drgElementDef.id}> bound <${bound}> from decision <${target.id}>`);
            entry.requirements.push({ id: requirement.id, required: target.id, type: target.$type, bound, value: result });
            return next(idx + 1);
          },
          targetContext
        );
      case 'dmn:InputData':
        this.logger.debug(`<${drgElementDef.id}> requires input data <${target.id}>`);
        return targetContext.getElementById(target.id).evaluate({ input }, (err, value) => {
          if (err) return callback(err);
          const name = resultName(target);
          // an absent value must not shadow environment variables in the expression context
          if (value !== undefined) bind(importName, name, value);
          entry.requirements.push({
            id: requirement.id,
            required: target.id,
            type: target.$type,
            bound: importName ? `${importName}.${name}` : name,
            value,
          });
          return next(idx + 1);
        });
      case 'dmn:BusinessKnowledgeModel':
        this.logger.debug(`<${drgElementDef.id}> requires knowledge <${target.id}>`);
        return this._evaluateBkm(
          target,
          (err, invocable) => {
            if (err) return callback(err);
            const bound = bind(importName, resultName(target), invocable);
            this.logger.debug(`<${drgElementDef.id}> bound function <${bound}> from <${target.id}>`);
            entry.requirements.push({ id: requirement.id, required: target.id, type: target.$type, bound });
            return next(idx + 1);
          },
          targetContext
        );
      case 'dmn:DecisionService':
        this.logger.debug(`<${drgElementDef.id}> requires decision service <${target.id}>`);
        return this._bindService(
          target,
          (err, invocable) => {
            if (err) return callback(err);
            const bound = bind(importName, resultName(target), invocable);
            this.logger.debug(`<${drgElementDef.id}> bound function <${bound}> from <${target.id}>`);
            entry.requirements.push({ id: requirement.id, required: target.id, type: target.$type, bound });
            return next(idx + 1);
          },
          targetContext
        );
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
 * @param {import('../Context.js').Context} [context] owning context — an imported model binds in its own model
 */
DefinitionExecution.prototype._evaluateBkm = function evaluateBkm(bkmDef, callback, context = this.context) {
  const id = bkmDef.id;
  const key = refKey(context, id);
  if (this.results.has(key)) return callback(null, this.results.get(key));
  if (this.visiting.has(key)) return callback(new DecisionError(`circular requirement detected at <${id}>`, bkmDef));
  this.visiting.add(key);

  /** @type {TraceEntry} */
  const entry = { id, type: bkmDef.$type, name: bkmDef.name, requirements: [] };

  const knowledge = {};
  this._resolveRequirements(
    bkmDef,
    knowledge,
    entry,
    (requirementErr) => {
      if (requirementErr) return callback(requirementErr);

      context.getElementById(id).evaluate({ input: knowledge }, (err, invocable) => {
        this.visiting.delete(key);
        if (err) return callback(err);
        this.trace.push(entry);
        this.results.set(key, invocable);
        return callback(null, invocable);
      });
    },
    context
  );
};

/**
 * Bind a decision service as a FEEL-invocable function. Positional parameters are
 * the service's input data followed by its input decisions, in declaration order —
 * the order the DMN TCK pins (0085). Each invocation runs a fresh sub-execution —
 * input decision arguments are seeded, the caller's evaluation input never leaks
 * in — sharing this run's cycle guard and trace.
 * @internal
 */
DefinitionExecution.prototype._bindService = function bindService(serviceDef, callback, context = this.context) {
  const id = serviceDef.id;
  const key = refKey(context, id);
  if (this.results.has(key)) return callback(null, this.results.get(key));

  const parts = this._resolveServiceParts(serviceDef, context);
  if (parts instanceof DecisionError) return callback(parts);

  const parameters = [
    ...parts.inputData.map((target) => ({ seedId: undefined, name: resultName(target) })),
    ...parts.inputDecisions.map((target) => ({ seedId: target.id, name: resultName(target) })),
  ];

  const execution = this;
  const invocable = function invokeService(...args) {
    execution.logger.debug(`<${id}> invoked with ${args.length} argument${args.length === 1 ? '' : 's'}`);
    // feelin rejects surplus arguments through $args; guard the missing ones (DMN TCK 0085)
    if (args.length < parameters.length) {
      throw new DecisionError(`<${id}> expects ${parameters.length} arguments, got ${args.length}`, serviceDef);
    }

    const sub = new DefinitionExecution(execution.definition);
    sub.visiting = execution.visiting;
    sub.trace = execution.trace;

    /** @type {Record<string, any>} */
    const scope = {};
    for (const [idx, parameter] of parameters.entries()) {
      scope[parameter.name] = args[idx];
      if (parameter.seedId) sub.results.set(refKey(context, parameter.seedId), args[idx]);
    }

    let completed = false;
    /** @type {Error | null} */
    let failure = null;
    let outcome;
    sub._evaluateOutputs(
      parts.outputs,
      scope,
      (err, result) => {
        completed = true;
        failure = err;
        outcome = result;
      },
      context
    );
    // FEEL invocation is synchronous — evaluation completes within the call today,
    // guard in case async host seams are involved in the future
    if (!completed) throw new DecisionError(`<${id}> did not complete synchronously`, serviceDef);
    if (failure) throw failure;
    return outcome;
  };
  // parameter names, so a boxed invocation can map named bindings to positions
  invocable.parameters = parameters.map((parameter) => parameter.name);
  // and for feelin ($args), so FEEL named-argument invocation maps and parameter count is enforced
  invocable.$args = invocable.parameters;

  /** @type {TraceEntry} */
  const entry = { id, type: serviceDef.$type, name: serviceDef.name, requirements: [] };
  this.trace.push(entry);
  this.results.set(key, invocable);
  return callback(null, invocable);
};

function resultName(drgElementDef) {
  return drgElementDef.variable?.name || drgElementDef.name || drgElementDef.id;
}

/** @internal memoization key — namespace-qualified, element ids are only unique per model */
function refKey(context, id) {
  return `${context.definitions.namespace}#${id}`;
}
