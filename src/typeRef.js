import { DecisionError } from './error/Errors.js';

const typeAliases = {
  string: 'string',
  boolean: 'boolean',
  number: 'number',
  integer: 'number',
  long: 'number',
  double: 'number',
  decimal: 'number',
  real: 'number',
  date: 'date',
  time: 'time',
  datetime: 'date and time',
  dateandtime: 'date and time',
  duration: 'duration',
  daytimeduration: 'duration',
  daysandtimeduration: 'duration',
  yearmonthduration: 'duration',
  yearsandmonthsduration: 'duration',
};

/**
 * Coerce a value to its declared typeRef.
 *
 * Handles FEEL type names and Camunda Modeler's Java-ish aliases (integer, long,
 * double). Temporal strings are converted through the environment's expression
 * engine (date, time, date and time, duration).
 *
 * Other typeRefs resolve against the definitions' item definitions when the
 * element carries a context: a typeRef alias follows the chain, allowed values
 * are validated as FEEL unary tests, item components coerce the matching
 * properties of a structure, and a collection coerces each element. Unknown
 * typeRefs pass the value through untouched, as do null and undefined.
 *
 * A host can override or extend coercion per typeRef through the environment
 * setting `types` — a map of typeRef (exact match) to coercion function
 * `(value, typeRef, element) => coerced`. Overrides take precedence over the
 * builtin types and item definitions, and own their validation — throw a
 * DecisionError to fail loudly.
 * @param {any} value
 * @param {string | undefined} typeRef declared type, e.g. on a variable, input expression, output, or formal parameter
 * @param {{ id?: string, type?: string, environment: import('./Environment.js').Environment, context?: import('./Context.js').Context }} element owning element, for FEEL access, item definition lookup, and error source
 * @returns {any} the coerced value
 * @throws {DecisionError} when the value cannot be coerced
 */
export function coerceTypeRef(value, typeRef, element) {
  return coerce(value, typeRef, element, new Set());
}

/**
 * @internal
 * @param {Set<string>} chain item definition names followed by typeRef aliasing, for cycle detection
 */
function coerce(value, typeRef, element, chain) {
  if (value === null || value === undefined || !typeRef) return value;

  const override = element.environment.settings.types?.[typeRef];
  if (override) return override(value, typeRef, element);

  const type = typeAliases[typeRef.replace(/\s/g, '').toLowerCase()];
  if (!type) return coerceItemDefinition(value, typeRef, element, chain);

  // DMN singleton list conversion — a one-element list converts to its element for a scalar type
  if (Array.isArray(value) && value.length === 1) return coerce(value[0], typeRef, element, chain);

  switch (type) {
    case 'string':
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      break;
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      break;
    case 'number': {
      if (typeof value === 'number') return value;
      if (typeof value !== 'string' || !value.trim()) break;
      const number = Number(value);
      if (Number.isNaN(number)) break;
      return number;
    }
    default: {
      if (typeof value !== 'string') return value;
      const temporal = element.environment.resolveExpression(`${type}(raw)`, { raw: value });
      if (temporal === null || temporal === undefined) break;
      return temporal;
    }
  }

  throw new DecisionError(`<${element.id}> cannot coerce ${JSON.stringify(value)} to ${typeRef}`, element);
}

/** @internal look the typeRef up among the definitions' (or their imports') item definitions, guarding alias cycles */
function coerceItemDefinition(value, typeRef, element, chain) {
  const resolved = element.context?.resolveItemDefinition(typeRef);
  if (!resolved) return value;

  // cycle key qualified by the owning model — equal names in different models are distinct types
  const key = `${resolved.context.definitions.namespace}#${resolved.itemDefinition.name}`;
  if (chain.has(key)) throw new DecisionError(`<${element.id}> circular item definition <${typeRef}>`, element);
  chain.add(key);

  // an imported item definition resolves its nested type references in its own model
  const owner =
    resolved.context === element.context
      ? element
      : { id: element.id, type: element.type, environment: element.environment, context: resolved.context };
  return coerceItem(value, resolved.itemDefinition, owner, chain);
}

/** @internal an item definition or item component — a collection coerces each element */
function coerceItem(value, itemDef, element, chain) {
  if (value === null || value === undefined) return value;

  if (itemDef.isCollection) {
    if (!Array.isArray(value)) {
      throw new DecisionError(`<${element.id}> cannot coerce ${JSON.stringify(value)} to collection ${itemName(itemDef)}`, element);
    }
    // a fresh chain per element — like components, descending into the value makes recursion finite
    return validateTypeConstraint(
      value.map((item) => (item === null || item === undefined ? item : coerceItemValue(item, itemDef, element, new Set()))),
      itemDef,
      element
    );
  }

  // DMN singleton list conversion — a one-element list converts to its element for a non-collection type
  if (Array.isArray(value) && value.length === 1) value = value[0];
  if (value === null || value === undefined) return value;
  return validateTypeConstraint(coerceItemValue(value, itemDef, element, chain), itemDef, element);
}

/** @internal DMN 1.5 type constraint — unary tests over the value as a whole, where allowed values constrain the element type */
function validateTypeConstraint(value, itemDef, element) {
  const constraint = itemDef.typeConstraint?.text;
  if (constraint && !element.environment.unaryTest(constraint, { '?': value })) {
    throw new DecisionError(`<${element.id}> value ${JSON.stringify(value)} violates type constraint of ${itemName(itemDef)}`, element);
  }
  return value;
}

/** @internal */
function coerceItemValue(value, itemDef, element, chain) {
  let coerced = value;
  if (itemDef.typeRef) {
    coerced = coerce(value, itemDef.typeRef, element, chain);
  } else if (itemDef.itemComponent?.length) {
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new DecisionError(`<${element.id}> cannot coerce ${JSON.stringify(value)} to ${itemName(itemDef)}`, element);
    }
    coerced = { ...value };
    for (const component of itemDef.itemComponent) {
      if (!(component.name in coerced)) continue;
      // a fresh chain per component — descending into the value makes recursive types finite
      coerced[component.name] = coerceItem(coerced[component.name], component, element, new Set());
    }
  }

  const allowed = itemDef.allowedValues?.text;
  if (allowed && !element.environment.unaryTest(allowed, { '?': coerced })) {
    throw new DecisionError(`<${element.id}> value ${JSON.stringify(coerced)} violates allowed values of ${itemName(itemDef)}`, element);
  }
  return coerced;
}

/** @internal */
function itemName(itemDef) {
  return itemDef.name || itemDef.id;
}
