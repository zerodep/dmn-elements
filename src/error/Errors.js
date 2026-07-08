/**
 * Base error for dmn-elements
 */
export class DmnError extends Error {
  /**
   * @param {string} description
   * @param {{ id?: string, type?: string }} [source] element that raised the error
   */
  constructor(description, source) {
    super(description);
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
   * @param {Error} [inner] original error, e.g. from feelin
   */
  constructor(description, source, inner) {
    super(description, source);
    if (inner) this.inner = inner;
  }
}
