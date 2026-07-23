import { DecisionError } from '../error/Errors.js';
import { BoxedConditional } from './BoxedConditional.js';
import { BoxedContext } from './BoxedContext.js';
import { BoxedFilter } from './BoxedFilter.js';
import { BoxedFor } from './BoxedFor.js';
import { BoxedList } from './BoxedList.js';
import { BoxedSome, BoxedEvery } from './BoxedQuantified.js';
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
    case 'dmn:Conditional':
      return new BoxedConditional(expressionDef, context).evaluate(scope);
    case 'dmn:Filter':
      return new BoxedFilter(expressionDef, context).evaluate(scope);
    case 'dmn:For':
      return new BoxedFor(expressionDef, context).evaluate(scope);
    case 'dmn:Some':
      return new BoxedSome(expressionDef, context).evaluate(scope);
    case 'dmn:Every':
      return new BoxedEvery(expressionDef, context).evaluate(scope);
    default:
      throw new DecisionError(`<${owner.id}> unsupported ${role} expression ${expressionDef.$type}`, owner);
  }
}

/**
 * Evaluate a DMN 1.4 child expression wrapper — a conditional's if/then/else,
 * a filter's in/match, an iterator's in/return/satisfies
 * @param {{ id?: string, type?: string, context: import('../Context.js').Context }} owner element holding the child expression
 * @param {any} childDef dmn-moddle child expression definition
 * @param {Record<string, any>} scope evaluation input context
 * @param {string} role the child expression's role in the owner, for error messages
 * @returns {any} the wrapped expression result
 * @throws {DecisionError} when the child expression is absent or its expression type is unsupported
 */
export function childExpressionValue(owner, childDef, scope, role) {
  const expressionDef = childDef?.expression;
  if (!expressionDef) throw new DecisionError(`<${owner.id}> has no ${role} expression`, owner);
  return expressionValue(expressionDef, owner.context, scope, owner, role);
}
