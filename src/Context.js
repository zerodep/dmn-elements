import { Environment } from './Environment.js';
import { Decision } from './decisions/Decision.js';
import { InputData } from './io/InputData.js';
import { BusinessKnowledgeModel } from './knowledge/BusinessKnowledgeModel.js';
import { KnowledgeSource } from './knowledge/KnowledgeSource.js';

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
 * DRG elements the passed element requires, resolved from information- and knowledge requirements
 * @param {any} drgElementDef dmn-moddle DRG element definition
 * @returns {any[]} required dmn-moddle DRG element definitions
 */
Context.prototype.getRequirements = function getRequirements(drgElementDef) {
  const required = [];
  for (const requirement of [...(drgElementDef.informationRequirement || []), ...(drgElementDef.knowledgeRequirement || [])]) {
    const target = requirement.requiredDecision || requirement.requiredInput || requirement.requiredKnowledge;
    // dmn-moddle keeps DRG edges as unresolved DMNElementReference hrefs, e.g. #decisionId
    const resolved = target?.href?.[0] === '#' ? this.getDrgElementById(target.href.slice(1)) : target;
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
