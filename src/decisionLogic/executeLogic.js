import { DmnError, DecisionError } from '../error/Errors.js';

/**
 * Run decision logic through the callback seam — the synchronous evaluate result
 * or an error. Errors raised by host code (a service, a type override) are wrapped
 * in a DecisionError sourced at the logic, with the original error as cause
 * @param {{ id?: string, type?: string, evaluate(input?: Record<string, any>, trace?: any): any }} logic decision logic instance
 * @param {{ input?: Record<string, any>, trace?: any }} executeMessage evaluation input context, and the trace entry when traced
 * @param {(err: Error | null, result?: any) => void} callback
 */
export function executeLogic(logic, executeMessage, callback) {
  let result;
  try {
    result = logic.evaluate(executeMessage?.input, executeMessage?.trace);
  } catch (err) {
    return callback(err instanceof DmnError ? err : new DecisionError(/** @type {Error} */ (err).message, logic, err));
  }
  return callback(null, result);
}
