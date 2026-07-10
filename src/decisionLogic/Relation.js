import { DmnError, DecisionError } from '../error/Errors.js';
import { coerceTypeRef } from '../typeRef.js';
import { expressionValue } from './expressionValue.js';

/**
 * Boxed relation evaluation — dmn:Relation as decision logic.
 *
 * A vertical table of expressions: each row evaluates to a context keyed by
 * column name, the relation to the list of rows. Cells evaluate independently
 * in the evaluation input scope; a row shorter than the columns binds null for
 * the missing cells; cell values are coerced to the column typeRef.
 * @param {any} relationDef dmn-moddle relation definition
 * @param {import('../Context.js').Context} context
 */
export function Relation(relationDef, context) {
  this.id = relationDef.id;
  this.type = relationDef.$type;
  this.behaviour = relationDef;
  this.context = context;
  this.environment = context.environment;
  this.logger = context.environment.Logger(this.type.toLowerCase());
}

/**
 * @param {{ input?: Record<string, any> }} executeMessage evaluation input context
 * @param {(err: Error | null, result?: any) => void} callback
 */
Relation.prototype.execute = function execute(executeMessage, callback) {
  let result;
  try {
    result = this.evaluate(executeMessage?.input);
  } catch (err) {
    return callback(err instanceof DmnError ? err : new DecisionError(/** @type {Error} */ (err).message, this, err));
  }
  return callback(null, result);
};

/**
 * Evaluate synchronously, e.g. as encapsulated logic invoked from FEEL
 * @param {Record<string, any>} [input] evaluation input context
 * @returns {Record<string, any>[]} one context per row, keyed by column name
 */
Relation.prototype.evaluate = function evaluateRelation(input = {}) {
  const columns = this.behaviour.column || [];
  for (const column of columns) {
    if (!column.name) throw new DecisionError(`<${this.id}> relation column is missing a name`, this);
  }

  const rows = this.behaviour.row || [];
  this.logger.debug(`<${this.id}> evaluate ${rows.length} row${rows.length === 1 ? '' : 's'}`);

  return rows.map((/** @type {any} */ row) => {
    const cells = row.elements || [];
    /** @type {Record<string, any>} */
    const rowResult = {};
    for (const [idx, column] of columns.entries()) {
      const cell = cells[idx];
      const value = cell ? expressionValue(cell, this.context, input, this, 'relation cell') : null;
      rowResult[column.name] = coerceTypeRef(value, column.typeRef, this);
    }
    return rowResult;
  });
};
