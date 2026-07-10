import { Environment } from './Environment.js';
import { Decision } from './decisions/Decision.js';
import { DecisionError } from './error/Errors.js';
import { InputData } from './io/InputData.js';
import { BusinessKnowledgeModel } from './knowledge/BusinessKnowledgeModel.js';
import { KnowledgeSource } from './knowledge/KnowledgeSource.js';

const kImports = Symbol.for('imports');

const defaultTypes = {
  'dmn:Decision': Decision,
  'dmn:InputData': InputData,
  'dmn:BusinessKnowledgeModel': BusinessKnowledgeModel,
  'dmn:KnowledgeSource': KnowledgeSource,
};

/**
 * Per-evaluation element registry and lazy factory.
 *
 * Consumes a dmn-moddle definitions tree directly — there is no serializer step as in
 * bpmn-elements, since stateless evaluation never needs to round-trip run state.
 * The host parses XML with dmn-moddle and passes the root `dmn:Definitions` element.
 * @param {any} definitions dmn-moddle definitions (root element from `DmnModdle#fromXML`)
 * @param {Environment} [environment]
 */
export function Context(definitions, environment) {
  if (!(this instanceof Context)) return new Context(definitions, environment);

  this.definitions = definitions;
  this.id = definitions.id;
  this.name = definitions.name;
  this.type = definitions.$type;
  this.environment = environment || new Environment();
  /** @internal minted element instances keyed by id */
  this.refs = new Map();
  /** @internal resolved import contexts keyed by import name */
  this[kImports] = new Map();
}

/**
 * All DRG elements: decisions, input data, business knowledge models, and knowledge sources
 * @returns {any[]} dmn-moddle DRG element definitions
 */
Context.prototype.getDrgElements = function getDrgElements() {
  return this.definitions.drgElement || [];
};

/** @returns {any[]} dmn-moddle decision definitions */
Context.prototype.getDecisions = function getDecisions() {
  return this.getDrgElements().filter((e) => e.$type === 'dmn:Decision');
};

/** @param {string} id */
Context.prototype.getDecisionById = function getDecisionById(id) {
  return this.getDecisions().find((e) => e.id === id);
};

/** @param {string} id */
Context.prototype.getDrgElementById = function getDrgElementById(id) {
  return this.getDrgElements().find((e) => e.id === id);
};

/**
 * DRG element by reference href — `#elementId`, qualified with the model
 * namespace, or qualified with a declared import's namespace
 * @param {string} href
 * @returns {any | undefined} dmn-moddle DRG element definition
 */
Context.prototype.getDrgElementByHref = function getDrgElementByHref(href) {
  return this.resolveDrgElementRef(href)?.elementDef;
};

/**
 * DRG element by reference href, with the context that owns it — an element of
 * an imported model resolves and evaluates in the imported model's context
 * @param {string} href `#elementId`, or `namespace#elementId`
 * @returns {{ elementDef: any, context: Context, importName?: string } | undefined}
 * @throws {DecisionError} when the href references a declared import that is not loaded
 */
Context.prototype.resolveDrgElementRef = function resolveDrgElementRef(href) {
  const hashIdx = href.indexOf('#');
  if (hashIdx < 0) {
    const elementDef = this.getDrgElementById(href);
    return elementDef && { elementDef, context: this };
  }

  const namespace = href.slice(0, hashIdx);
  const id = href.slice(hashIdx + 1);
  if (!namespace || namespace === this.definitions.namespace) {
    const elementDef = this.getDrgElementById(id);
    return elementDef && { elementDef, context: this };
  }

  const importDef = (this.definitions.import || []).find((declared) => declared.namespace === namespace);
  if (!importDef) return undefined;

  const imported = this[kImports].get(importDef.name);
  if (!imported) {
    throw new DecisionError(
      typeof this.environment.settings.resolveImport === 'function'
        ? `<${this.id}> import <${importDef.name}> is not loaded, await loadImports() first`
        : `<${this.id}> import <${importDef.name}> requires a resolveImport environment setting`,
      this
    );
  }
  const elementDef = imported.getDrgElementById(id);
  return elementDef && { elementDef, context: imported, importName: importDef.name };
};

/**
 * Item definition by type name, as referenced by a typeRef
 * @param {string} name local name, or qualified by import name (`logistics.tParcel`)
 * @returns {any | undefined} dmn-moddle item definition
 */
Context.prototype.getItemDefinitionByName = function getItemDefinitionByName(name) {
  return this.resolveItemDefinition(name)?.itemDefinition;
};

/**
 * Item definition by type name, with the context that owns it — an imported item
 * definition resolves its own nested type references in the imported model
 * @param {string} name local name, or qualified by import name (`logistics.tParcel`)
 * @returns {{ itemDefinition: any, context: Context } | undefined}
 * @throws {DecisionError} when the name references a declared import that is not loaded
 */
Context.prototype.resolveItemDefinition = function resolveItemDefinition(name) {
  const local = (this.definitions.itemDefinition || []).find((item) => item.name === name);
  if (local) return { itemDefinition: local, context: this };

  const dotIdx = name.indexOf('.');
  if (dotIdx < 1) return undefined;
  const importName = name.slice(0, dotIdx);
  if (!(this.definitions.import || []).some((importDef) => importDef.name === importName)) return undefined;

  const imported = this[kImports].get(importName);
  if (!imported) {
    throw new DecisionError(
      typeof this.environment.settings.resolveImport === 'function'
        ? `<${this.id}> import <${importName}> is not loaded, await loadImports() first`
        : `<${this.id}> import <${importName}> requires a resolveImport environment setting`,
      this
    );
  }
  return imported.resolveItemDefinition(name.slice(dotIdx + 1));
};

/**
 * Resolve declared imports through the `resolveImport` environment setting —
 * `resolveImport(importDef)` returns the imported model's parsed dmn-moddle
 * definitions, or a promise thereof (the host parses; dmn-moddle is async).
 * Recursive imports resolve once per namespace, cycles bind to the loaded model.
 *
 * Definition#evaluate and #trace await this before each run; call it directly when
 * using the context synchronously. Without the setting, loading is skipped and a
 * reference to an imported type fails the evaluation instead.
 * @param {Map<string, Context>} [seen] resolved contexts by namespace
 * @returns {Promise<Context> | undefined} undefined when there is nothing to load
 */
Context.prototype.loadImports = function loadImports(seen) {
  const imports = this.definitions.import || [];
  if (!imports.length) return;
  if (imports.every((importDef) => this[kImports].has(importDef.name))) return;
  const resolveImport = this.environment.settings.resolveImport;
  if (typeof resolveImport !== 'function') return;

  return this._loadImports(resolveImport, seen || new Map([[this.definitions.namespace, this]]));
};

/** @internal */
Context.prototype._loadImports = async function loadImportsAsync(resolveImport, seen) {
  for (const importDef of this.definitions.import) {
    if (this[kImports].has(importDef.name)) continue;

    let imported = seen.get(importDef.namespace);
    if (!imported) {
      const definitions = await resolveImport(importDef);
      if (!definitions) {
        throw new DecisionError(`<${this.id}> import <${importDef.name}> did not resolve (${importDef.namespace})`, this);
      }
      imported = new this.constructor(definitions, this.environment);
      seen.set(importDef.namespace, imported);
      await imported.loadImports(seen);
    }
    this[kImports].set(importDef.name, imported);
  }
  return this;
};

/**
 * DRG elements the passed element requires, resolved from information- and knowledge requirements
 * @param {any} drgElementDef dmn-moddle DRG element definition
 * @returns {any[]} required dmn-moddle DRG element definitions
 */
Context.prototype.getRequirements = function getRequirements(drgElementDef) {
  const required = [];
  for (const requirement of [...(drgElementDef.informationRequirement || []), ...(drgElementDef.knowledgeRequirement || [])]) {
    const target = requirement.requiredDecision || requirement.requiredInput || requirement.requiredKnowledge;
    // dmn-moddle keeps DRG edges as unresolved DMNElementReference hrefs, e.g. #decisionId
    const resolved = target?.href ? this.getDrgElementByHref(target.href) : target;
    if (resolved) required.push(resolved);
  }
  return required;
};

/**
 * Get, or lazily mint, a runtime DRG element instance
 * @param {string} id
 * @returns {import('./drgElement/DrgElement.js').DrgElement | undefined}
 */
Context.prototype.getElementById = function getElementById(id) {
  let element = this.refs.get(id);
  if (element) return element;

  const elementDef = this.getDrgElementById(id);
  if (!elementDef) return;

  const factory = defaultTypes[elementDef.$type];
  if (!factory) return;

  element = factory(elementDef, this);
  this.refs.set(id, element);
  return element;
};

/**
 * Clone context, e.g. to evaluate with a new environment
 * @param {Environment} [newEnvironment]
 */
Context.prototype.clone = function clone(newEnvironment) {
  return new this.constructor(this.definitions, newEnvironment || this.environment);
};
