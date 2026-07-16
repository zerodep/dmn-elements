/**
 * Serialize parsed dmn-moddle definitions to lean JSON for precompiled execution.
 *
 * The engine reads only plain enumerable data — `$type` strings, element
 * properties, and href references — so the revived JSON evaluates like the
 * source tree: `new Context(JSON.parse(serialized))`. Moddle internals
 * (`$parent`, `$descriptor`) are non-enumerable or prototype-bound and never
 * serialize; diagram interchange (`dmnDI`) is stripped as runtime dead weight.
 * Vendor extension attributes (`$attrs`, also non-enumerable) are kept when
 * present, so environment extensions decorate revived trees like the source.
 * One-way: a revived tree evaluates, but cannot be written back to DMN XML —
 * that needs the moddle instances.
 * @param {any} definitions dmn-moddle definitions (root element from `DmnModdle#fromXML`)
 * @returns {string} JSON
 */
export function serializeDefinitions(definitions) {
  return JSON.stringify(definitions, (key, value) => {
    if (key === 'dmnDI') return undefined;
    if (value?.$attrs && Object.keys(value.$attrs).length) return { ...value, $attrs: value.$attrs };
    return value;
  });
}
