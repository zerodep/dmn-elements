// @ts-check
/**
 * DMN XML source builders for tests.
 *
 * Inline sources skip DMNDI — only committed .dmn resources are required to
 * open in Camunda Modeler (see AGENTS.md).
 */

/**
 * Build a single decision table definitions source
 * @param {{
 *   id?: string,
 *   name?: string,
 *   hitPolicy?: string,
 *   aggregation?: string,
 *   inputs?: { text: string, typeRef?: string }[],
 *   outputs?: { name?: string, typeRef?: string, outputValues?: string, defaultOutputEntry?: string }[],
 *   rules?: { input?: string[], output?: string[] }[],
 * }} table
 * @returns {string} DMN XML
 */
export function decisionTableSource({ id = 'decision', name = id, hitPolicy, aggregation, inputs = [], outputs = [], rules = [] }) {
  const rows = [];

  rows.push(
    `<decisionTable id="${id}Table"${hitPolicy ? ` hitPolicy="${hitPolicy}"` : ''}${aggregation ? ` aggregation="${aggregation}"` : ''}>`
  );

  for (const [idx, input] of inputs.entries()) {
    const typeRef = input.typeRef ? ` typeRef="${input.typeRef}"` : '';
    rows.push(
      `  <input id="${id}Input${idx}"><inputExpression id="${id}InputExpression${idx}"${typeRef}><text>${escapeXml(input.text)}</text></inputExpression></input>`
    );
  }

  for (const [idx, output] of outputs.entries()) {
    const attributes = `id="${id}Output${idx}"${output.name ? ` name="${output.name}"` : ''}${output.typeRef ? ` typeRef="${output.typeRef}"` : ''}`;
    if (!output.outputValues && !output.defaultOutputEntry) {
      rows.push(`  <output ${attributes} />`);
      continue;
    }
    rows.push(`  <output ${attributes}>`);
    if (output.outputValues)
      rows.push(`    <outputValues id="${id}OutputValues${idx}"><text>${escapeXml(output.outputValues)}</text></outputValues>`);
    if (output.defaultOutputEntry) {
      rows.push(
        `    <defaultOutputEntry id="${id}DefaultOutput${idx}"><text>${escapeXml(output.defaultOutputEntry)}</text></defaultOutputEntry>`
      );
    }
    rows.push('  </output>');
  }

  for (const [idx, rule] of rules.entries()) {
    rows.push(`  <rule id="${id}Rule${idx}">`);
    for (const [entryIdx, entry] of (rule.input || []).entries()) {
      rows.push(`    <inputEntry id="${id}Rule${idx}Input${entryIdx}"><text>${escapeXml(entry)}</text></inputEntry>`);
    }
    for (const [entryIdx, entry] of (rule.output || []).entries()) {
      rows.push(`    <outputEntry id="${id}Rule${idx}Output${entryIdx}"><text>${escapeXml(entry)}</text></outputEntry>`);
    }
    rows.push('  </rule>');
  }

  rows.push('</decisionTable>');

  return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="${id}Definitions" name="${name} definitions" namespace="https://example.com/dmn/test">
  <decision id="${id}" name="${name}">
    <variable id="${id}Variable" name="${name}" />
    ${rows.join('\n    ')}
  </decision>
</definitions>`;
}

/** @param {any} text */
function escapeXml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
