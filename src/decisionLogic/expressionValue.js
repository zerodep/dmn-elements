import { DecisionError } from '../error/Errors.js';
import { BoxedContext } from './BoxedContext.js';
import { BoxedList } from './BoxedList.js';
import { DecisionTable } from './DecisionTable.js';
import { FunctionDefinition } from './FunctionDefinition.js';
import { Invocation } from './Invocation.js';
import { LiteralExpression } from './LiteralExpression.js';
import { Relation } from './Relation.js';

/**
 * Evaluate a boxed expression nested inside other decision logic — a context
 * entry, an invocation's called function or binding formula, a relation cell
 * @param {any} expressionDef dmn-moddle expression definition
 * @param {import('../Context.js').Context} context
 * @param {Record<string, any>} scope evaluation input context
 * @param {{ id?: string, type?: string }} owner element holding the expression, for error source
 * @param {string} role the expression's role in the owner, for error messages
 * @returns {any} the expression result
 * @throws {DecisionError} when the expression type is unsupported
 */
export function expressionValue(expressionDef, context, scope, owner, role) {
  switch (expressionDef.$type) {
    case 'dmn:LiteralExpression':
      return new LiteralExpression(expressionDef, context).evaluate(scope);
    case 'dmn:DecisionTable':
      return new DecisionTable(expressionDef, context).evaluate(scope);
    case 'dmn:Context':
      return new BoxedContext(expressionDef, context).evaluate(scope);
    case 'dmn:Invocation':
      return new Invocation(expressionDef, context).evaluate(scope);
    case 'dmn:Relation':
      return new Relation(expressionDef, context).evaluate(scope);
    case 'dmn:List':
      return new BoxedList(expressionDef, context).evaluate(scope);
    case 'dmn:FunctionDefinition':
      return new FunctionDefinition(expressionDef, context).evaluate(scope);
    default:
      throw new DecisionError(`<${owner.id}> unsupported ${role} expression ${expressionDef.$type}`, owner);
  }
}
