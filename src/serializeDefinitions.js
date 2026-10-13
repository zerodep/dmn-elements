/**
 * Serialize parsed dmn-moddle definitions to lean JSON for precompiled execution —
 * `new Context(JSON.parse(serialized))` evaluates like the source tree. Diagram
 * interchange is stripped, vendor extension attributes are kept. One-way: a revived
 * tree cannot be written back to DMN XML.
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
