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
 * engine (date, time, date and time, duration). Unknown typeRefs, e.g. item
 * definition references, pass the value through untouched, as do null and undefined.
 * @param {any} value
 * @param {string | undefined} typeRef declared type, e.g. on a variable, input expression, output, or formal parameter
 * @param {{ id?: string, type?: string, environment: import('./Environment.js').Environment }} element owning element, for FEEL access and error source
 * @returns {any} the coerced value
 * @throws {DecisionError} when the value cannot be coerced
 */
export function coerceTypeRef(value, typeRef, element) {
  if (value === null || value === undefined || !typeRef) return value;
  const type = typeAliases[typeRef.replace(/\s/g, '').toLowerCase()];
  if (!type) return value;

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
