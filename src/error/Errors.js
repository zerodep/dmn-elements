/**
 * Base error for dmn-elements
 */
export class DmnError extends Error {
  /**
   * @param {string} description
   * @param {{ id?: string, type?: string }} [source] element that raised the error
   * @param {ErrorOptions} [options] passed to Error, e.g. `cause`
   */
  constructor(description, source, options) {
    super(description, options);
    this.name = this.constructor.name;
    this.source = source && { id: source.id, type: source.type };
  }
}

/**
 * Raised when evaluating a decision fails, e.g. a FEEL error or a violated hit policy
 */
export class DecisionError extends DmnError {
  /**
   * @param {string} description
   * @param {{ id?: string, type?: string }} [source]
   * @param {Error} [cause] original error, e.g. from feelin, chained as standard `cause`
   */
  constructor(description, source, cause) {
    super(description, source, cause && { cause });
  }
}
