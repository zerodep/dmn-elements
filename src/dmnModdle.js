import dmn13 from 'dmn-moddle/resources/dmn/json/dmn13.json' with { type: 'json' };

/**
 * @typedef {{ name: string, prefix: string, uri: string, xml: Record<string, any>, types: Record<string, any>[] }} ModdlePackage
 */

/**
 * DMN 1.4 boxed expression grammar on top of dmn-moddle's DMN 1.3 metamodel —
 * conditional, filter, and the iterators (for, some, every) with their child
 * expression wrappers, per the DMN 1.4/1.5 XSD.
 */
const boxedExpressionTypes = [
  {
    name: 'ChildExpression',
    properties: [
      { name: 'id', isAttr: true, isId: true, type: 'String' },
      { name: 'expression', type: 'Expression' },
    ],
  },
  {
    name: 'TypedChildExpression',
    superClass: ['ChildExpression'],
    properties: [{ name: 'typeRef', isAttr: true, type: 'String' }],
  },
  {
    name: 'Conditional',
    superClass: ['Expression'],
    properties: [
      { name: 'if', type: 'ChildExpression', xml: { serialize: 'property' } },
      { name: 'then', type: 'ChildExpression', xml: { serialize: 'property' } },
      { name: 'else', type: 'ChildExpression', xml: { serialize: 'property' } },
    ],
  },
  {
    name: 'Filter',
    superClass: ['Expression'],
    properties: [
      { name: 'in', type: 'ChildExpression', xml: { serialize: 'property' } },
      { name: 'match', type: 'ChildExpression', xml: { serialize: 'property' } },
    ],
  },
  {
    name: 'Iterator',
    isAbstract: true,
    superClass: ['Expression'],
    properties: [
      { name: 'iteratorVariable', isAttr: true, type: 'String' },
      { name: 'in', type: 'TypedChildExpression', xml: { serialize: 'property' } },
    ],
  },
  {
    name: 'For',
    superClass: ['Iterator'],
    properties: [{ name: 'return', type: 'ChildExpression', xml: { serialize: 'property' } }],
  },
  {
    name: 'Quantified',
    isAbstract: true,
    superClass: ['Iterator'],
    properties: [{ name: 'satisfies', type: 'ChildExpression', xml: { serialize: 'property' } }],
  },
  { name: 'Some', superClass: ['Quantified'], properties: [] },
  { name: 'Every', superClass: ['Quantified'], properties: [] },
];

/**
 * DMN 1.5 addition — item definitions constrain their value as a whole with
 * typeConstraint unary tests (allowedValues keeps constraining the element type),
 * per the DMN 1.5 XSD sequence typeRef, allowedValues, typeConstraint
 */
const extendedTypes = dmn13.types.map((type) =>
  type.name === 'ItemDefinition'
    ? {
        ...type,
        properties: type.properties.flatMap((property) =>
          property.name === 'allowedValues'
            ? [property, { name: 'typeConstraint', type: 'UnaryTests', xml: { serialize: 'property' } }]
            : [property]
        ),
      }
    : type
);

/**
 * dmn-moddle's DMN 1.3 package extended with the DMN 1.4 boxed expressions and
 * the DMN 1.5 item definition typeConstraint.
 * Pass as the `dmn` package to DmnModdle to replace the built-in one:
 * `new DmnModdle({ dmn })`
 * @type {ModdlePackage}
 */
export const dmn = {
  ...dmn13,
  types: [...extendedTypes, ...boxedExpressionTypes],
};

const namespaceRewrites = [
  ['https://www.omg.org/spec/DMN/20230324/MODEL/', 'https://www.omg.org/spec/DMN/20191111/MODEL/'],
  ['https://www.omg.org/spec/DMN/20230324/DMNDI/', 'https://www.omg.org/spec/DMN/20191111/DMNDI/'],
  ['https://www.omg.org/spec/DMN/20211108/MODEL/', 'https://www.omg.org/spec/DMN/20191111/MODEL/'],
  ['https://www.omg.org/spec/DMN/20211108/DMNDI/', 'https://www.omg.org/spec/DMN/20191111/DMNDI/'],
];

/**
 * Rewrite DMN 1.4/1.5 namespace URIs in DMN XML to the DMN 1.3 URIs the
 * extended package is registered under — the 1.4/1.5 grammar additions are
 * upward compatible, so an aligned document parses losslessly
 * @param {string | { toString(): string }} source DMN XML
 * @returns {string} DMN XML with aligned namespaces
 */
export function alignDmnNamespaces(source) {
  let xml = source.toString();
  for (const [from, to] of namespaceRewrites) xml = xml.replaceAll(from, to);
  return xml;
}
