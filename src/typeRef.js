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
 * double): temporal strings become FEEL temporal values, and per the DMN implicit
 * conversions a one-element list narrows to a declared scalar, a scalar widens to a
 * declared collection, and a date widens to a declared date and time.
 *
 * Other typeRefs resolve against the item definitions: aliases, allowed values and
 * type constraints, structures, and collections. Unknown typeRefs pass the value
 * through untouched, as do null and undefined.
 *
 * The environment setting `types` — a map of typeRef (exact match) to coercion
 * function `(value, typeRef, element) => coerced` — takes precedence over builtin
 * types and item definitions; an override owns its validation and throws a
 * DecisionError to fail.
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
 * @param {Set<string>} chain item definitions followed, for cycle detection
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
      if (typeof value === 'string') {
        const temporal = element.environment.resolveExpression(`${type}(raw)`, { raw: value });
        if (temporal === null || temporal === undefined) break;
        return temporal;
      }
      // DMN implicit conversion — a date widens to the date and time at midnight UTC
      if (type === 'date and time' && element.environment.resolveExpression('raw instance of date', { raw: value })) {
        return element.environment.resolveExpression('date and time(raw, time("00:00:00Z"))', { raw: value });
      }
      return value;
    }
  }

  throw new DecisionError(`<${element.id}> cannot coerce ${JSON.stringify(value)} to ${typeRef}`, element);
}

/** @internal coerce to the item definition the typeRef names, local or imported */
function coerceItemDefinition(value, typeRef, element, chain) {
  const resolved = element.context?.resolveItemDefinition(typeRef);
  if (!resolved) return value;

  // cycle key qualified by the owning model — equal names in different models are distinct types
  const key = `${resolved.context.definitions.namespace}#${resolved.itemDefinition.name}`;
  if (chain.has(key)) throw new DecisionError(`<${element.id}> circular item definition <${typeRef}>`, element);
  chain.add(key);

  // an imported item definition resolves its nested type references in its own model
  return coerceItem(value, resolved.itemDefinition, ownerIn(element, resolved.context), chain);
}

/** @internal the element as seen from the model owning a resolved item definition */
function ownerIn(element, context) {
  return context === element.context ? element : { id: element.id, type: element.type, environment: element.environment, context };
}

/**
 * Coerce an invocable's result to the output type its variable declares through an
 * item definition's `functionItem`. A typeRef naming no such item definition passes
 * the value through.
 * @param {any} value invocation result
 * @param {string | undefined} typeRef the invocable variable's typeRef
 * @param {{ id?: string, type?: string, environment: import('./Environment.js').Environment, context: import('./Context.js').Context }} element owning element
 * @returns {any} the coerced result
 * @throws {DecisionError} when the result cannot be coerced
 */
export function coerceFunctionResult(value, typeRef, element) {
  if (!typeRef) return value;
  const resolved = element.context.resolveItemDefinition(typeRef);
  const outputTypeRef = resolved?.itemDefinition.functionItem?.outputTypeRef;
  if (!outputTypeRef) return value;
  return coerceTypeRef(value, outputTypeRef, ownerIn(element, resolved.context));
}

/** @internal coerce to an item definition or item component */
function coerceItem(value, itemDef, element, chain) {
  if (value === null || value === undefined) return value;

  if (itemDef.isCollection) {
    if (!Array.isArray(value)) value = [value];
    // a fresh chain per element — like components, descending into the value makes recursion finite
    return validateTypeConstraint(
      value.map((item) => (item === null || item === undefined ? item : coerceItemValue(item, itemDef, element, new Set()))),
      itemDef,
      element
    );
  }

  // DMN singleton list conversion — a one-element list converts to its element for a non-collection type;
  // a type reference leaves the conversion to the referenced type, which may itself be a collection
  if (!itemDef.typeRef && Array.isArray(value) && value.length === 1) value = value[0];
  if (value === null || value === undefined) return value;
  return validateTypeConstraint(coerceItemValue(value, itemDef, element, chain), itemDef, element);
}

/** @internal DMN 1.5 type constraint over the value as a whole */
function validateTypeConstraint(value, itemDef, element) {
  const constraint = itemDef.typeConstraint?.text;
  if (constraint && !element.environment.unaryTest(constraint, { '?': value })) {
    throw new DecisionError(`<${element.id}> value ${JSON.stringify(value)} violates type constraint of ${itemDef.name}`, element);
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
      throw new DecisionError(`<${element.id}> cannot coerce ${JSON.stringify(value)} to ${itemDef.name}`, element);
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
    throw new DecisionError(`<${element.id}> value ${JSON.stringify(coerced)} violates allowed values of ${itemDef.name}`, element);
  }
  return coerced;
}
