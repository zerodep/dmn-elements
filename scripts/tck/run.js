/* eslint-disable no-console, no-process-exit */
// DMN TCK conformance sweep runner — diagnostic tooling, not part of the package.
// Usage: npm run test:tck [-- case-name-filter]
// Writes REPORT.md next to this file; the TCK clone itself stays in gitignored tmp/.
import fs from 'node:fs';
import path from 'node:path';
import { Parser } from 'saxen';
import { DmnModdle } from 'dmn-moddle';
import { Context, Definition, Environment, Expressions } from 'dmn-elements';
import { dmn, alignDmnNamespaces } from 'dmn-elements/dmn-moddle';

const TCK_ROOT = new URL('../../tmp/tck/TestCases', import.meta.url).pathname;
const LEVELS = ['compliance-level-2', 'compliance-level-3'];
const filter = process.argv[2];

if (!fs.existsSync(TCK_ROOT)) {
  console.error('DMN TCK test cases not found. Clone them first (sparse, test cases only):');
  console.error('  git clone --depth 1 --filter=blob:none --sparse https://github.com/dmn-tck/tck.git tmp/tck');
  console.error('  git -C tmp/tck sparse-checkout set TestCases');
  process.exit(1);
}

const feel = new Expressions();

/** Minimal DOM over saxen for the TCK test-case XML */
function parseXml(source) {
  const root = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  const parser = new Parser();
  parser.on('openTag', (elementName, attrGetter, decodeEntities) => {
    const attrs = {};
    const rawAttrs = attrGetter();
    for (const key in rawAttrs) attrs[key] = decodeEntities(rawAttrs[key]);
    const node = { name: elementName.replace(/^.*:/, ''), attrs, children: [], text: '' };
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  });
  parser.on('closeTag', () => stack.pop());
  parser.on('text', (value, decodeEntities) => {
    stack[stack.length - 1].text += decodeEntities(value);
  });
  parser.on('error', (err) => {
    throw err;
  });
  parser.parse(source);
  return root;
}

const byName = (node, name) => node.children.filter((child) => child.name === name);
const oneByName = (node, name) => node.children.find((child) => child.name === name);

/** TCK value node → JS value; temporals become markers converted/compared through FEEL */
function buildValue(node) {
  const valueNode = oneByName(node, 'value');
  if (valueNode) {
    if (valueNode.attrs['xsi:nil'] === 'true') return null;
    const type = (valueNode.attrs['xsi:type'] || '').replace(/^.*:/, '');
    const text = valueNode.text;
    switch (type) {
      case 'decimal':
      case 'double': {
        if (text === 'INF') return Infinity;
        if (text === '-INF') return -Infinity;
        if (text === 'NaN') return NaN;
        return Number(text);
      }
      case 'boolean':
        return text === 'true';
      case 'date':
      case 'time':
      case 'dateTime':
      case 'duration':
        return { $temporal: type, text };
      default:
        return text;
    }
  }
  const listNode = oneByName(node, 'list');
  if (listNode) return byName(listNode, 'item').map((item) => buildValue(item));
  const components = byName(node, 'component');
  if (components.length) {
    const result = {};
    for (const component of components) result[component.attrs.name] = buildValue(component);
    return result;
  }
  return null;
}

/** convert a built value into FEEL-typed input */
function toFeelInput(value) {
  if (Array.isArray(value)) return value.map(toFeelInput);
  if (value && typeof value === 'object') {
    if (value.$temporal) {
      const ctor = { date: 'date', time: 'time', dateTime: 'date and time', duration: 'duration' }[value.$temporal];
      return feel.resolveExpression(`${ctor}(raw)`, { raw: value.text });
    }
    const result = {};
    for (const key in value) result[key] = toFeelInput(value[key]);
    return result;
  }
  return value;
}

/** deep compare engine result against TCK expected value */
function matches(actual, expected) {
  if (expected === null || expected === undefined) return actual === null || actual === undefined;
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && actual.length === expected.length && expected.every((item, idx) => matches(actual[idx], item));
  }
  if (typeof expected === 'object') {
    if (expected.$temporal) {
      if (actual === null || actual === undefined) return false;
      try {
        return feel.resolveExpression('a = b', { a: actual, b: toFeelInput(expected) }) === true;
      } catch {
        return false;
      }
    }
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) return false;
    const expectedKeys = Object.keys(expected);
    const actualKeys = Object.keys(actual).filter((key) => actual[key] !== undefined);
    if (expectedKeys.length !== actualKeys.length) return false;
    return expectedKeys.every((key) => matches(actual[key], expected[key]));
  }
  if (typeof expected === 'number') {
    if (typeof actual !== 'number') return false;
    if (Number.isNaN(expected)) return Number.isNaN(actual);
    if (!Number.isFinite(expected)) return actual === expected;
    return Math.abs(actual - expected) <= Math.max(1e-8, Math.abs(expected) * 1e-9);
  }
  return actual === expected;
}

function categorize(message) {
  if (/failed to parse/.test(message)) return 'model-parse-error';
  if (/was not found in/.test(message)) return 'element-not-found';
  if (/unsupported decision logic|unsupported .* expression|unsupported encapsulated/.test(message)) return 'unsupported-logic';
  if (/requires a resolveImport|import </.test(message)) return 'imports';
  if (/hit policy|violates|cannot coerce/.test(message)) return 'engine-semantics';
  return 'evaluation-error';
}

const summary = { pass: 0, fail: 0, error: 0 };
const categories = new Map();
const caseResults = [];

for (const level of LEVELS) {
  const levelDir = path.join(TCK_ROOT, level);
  const caseDirs = fs
    .readdirSync(levelDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !filter || name.includes(filter))
    .sort();

  for (const caseName of caseDirs) {
    const caseDir = path.join(levelDir, caseName);
    const files = fs.readdirSync(caseDir);
    const testFiles = files.filter((file) => /-test-.*\.xml$/.test(file));
    const modelFiles = files.filter((file) => file.endsWith('.dmn'));

    const caseResult = { level, name: caseName, pass: 0, fail: 0, error: 0, notes: new Set() };
    caseResults.push(caseResult);

    // parse all models in the dir; imports resolve by namespace
    const models = new Map();
    let modelError;
    for (const modelFile of modelFiles) {
      try {
        const { rootElement } = await new DmnModdle({ dmn }).fromXML(
          alignDmnNamespaces(fs.readFileSync(path.join(caseDir, modelFile), 'utf8'))
        );
        models.set(rootElement.namespace, { rootElement, file: modelFile });
      } catch (err) {
        modelError = `${modelFile}: ${err.message}`;
      }
    }

    for (const testFile of testFiles) {
      const doc = parseXml(fs.readFileSync(path.join(caseDir, testFile), 'utf8'));
      const testCasesNode = oneByName(doc, 'testCases');
      const modelName = oneByName(testCasesNode, 'modelName')?.text?.trim();
      const model = [...models.values()].find((entry) => entry.file === modelName) || [...models.values()][0];

      for (const testCase of byName(testCasesNode, 'testCase')) {
        const invocableName = testCase.attrs.invocableName;
        const input = {};
        for (const inputNode of byName(testCase, 'inputNode')) {
          try {
            input[inputNode.attrs.name] = toFeelInput(buildValue(inputNode));
          } catch {
            input[inputNode.attrs.name] = buildValue(inputNode);
          }
        }

        for (const resultNode of byName(testCase, 'resultNode')) {
          const expectedNode = oneByName(resultNode, 'expected');
          if (!expectedNode) continue;
          const expected = buildValue(expectedNode);
          const label = `${caseName}#${testCase.attrs.id}:${resultNode.attrs.name}`;

          if (modelError || !model) {
            summary.error++;
            caseResult.error++;
            track(categories, 'model-parse-error', label, modelError || 'no model');
            caseResult.notes.add('model-parse-error');
            continue;
          }

          try {
            const definitions = model.rootElement;
            const targetName = invocableName || resultNode.attrs.name;
            const target = (definitions.drgElement || []).find((element) => element.name === targetName);
            if (!target) throw new Error(`decision named "${targetName}" was not found in ${model.file}`);

            const environment = new Environment({
              settings: {
                validateResult: true,
                resolveImport(importDef) {
                  const imported = models.get(importDef.namespace);
                  if (!imported) throw new Error(`import ${importDef.namespace} not in case dir`);
                  return imported.rootElement;
                },
              },
            });
            const definition = new Definition(new Context(definitions, environment));
            let actual = await definition.evaluate(target.id, input);
            // a multi-output decision service yields an object keyed by output decision name; the resultNode addresses one
            if (
              invocableName &&
              invocableName !== resultNode.attrs.name &&
              actual &&
              typeof actual === 'object' &&
              resultNode.attrs.name in actual
            ) {
              actual = actual[resultNode.attrs.name];
            }

            if (matches(actual, expected)) {
              summary.pass++;
              caseResult.pass++;
            } else {
              summary.fail++;
              caseResult.fail++;
              track(categories, 'mismatch', label, `expected ${preview(expected)} got ${preview(actual)}`);
              caseResult.notes.add('mismatch');
            }
          } catch (err) {
            // the TCK testcase schema has no error assertion — an expected null accepts an evaluation error
            if (expected === null && err.name === 'DecisionError') {
              summary.pass++;
              caseResult.pass++;
              continue;
            }
            summary.error++;
            caseResult.error++;
            const category = categorize(err.message);
            track(categories, category, label, err.message.slice(0, 140));
            caseResult.notes.add(category);
          }
        }
      }
    }
  }
}

function track(map, category, label, detail) {
  if (!map.has(category)) map.set(category, []);
  map.get(category).push({ label, detail });
}

function preview(value) {
  try {
    const json = JSON.stringify(value);
    return json && json.length > 80 ? json.slice(0, 80) + '…' : json;
  } catch {
    return String(value);
  }
}

// report
const total = summary.pass + summary.fail + summary.error;
const lines = [];
lines.push('# DMN TCK conformance sweep');
lines.push('');
lines.push(
  `Assertions: ${total} — pass ${summary.pass} (${((summary.pass / total) * 100).toFixed(1)}%), mismatch ${summary.fail}, error ${summary.error}`
);
lines.push('');
for (const level of LEVELS) {
  const levelResults = caseResults.filter((entry) => entry.level === level);
  const pass = levelResults.reduce((sum, entry) => sum + entry.pass, 0);
  const all = levelResults.reduce((sum, entry) => sum + entry.pass + entry.fail + entry.error, 0);
  lines.push(`## ${level}: ${pass}/${all} (${((pass / all) * 100).toFixed(1)}%)`);
  lines.push('');
  for (const entry of levelResults) {
    const totalCase = entry.pass + entry.fail + entry.error;
    const status = entry.pass === totalCase ? 'PASS' : entry.pass === 0 ? 'FAIL' : 'PARTIAL';
    lines.push(`- ${status} ${entry.name}: ${entry.pass}/${totalCase}${entry.notes.size ? ` (${[...entry.notes].join(', ')})` : ''}`);
  }
  lines.push('');
}
lines.push('## Failure categories');
lines.push('');
for (const [category, items] of [...categories.entries()].sort((a, b) => b[1].length - a[1].length)) {
  lines.push(`### ${category} (${items.length})`);
  lines.push('');
  for (const item of items.slice(0, 12)) lines.push(`- ${item.label} — ${item.detail}`);
  if (items.length > 12) lines.push(`- … ${items.length - 12} more`);
  lines.push('');
}

// a filtered run is diagnostic — only a full sweep updates the committed report
if (!filter) {
  fs.writeFileSync(new URL('./REPORT.md', import.meta.url), lines.join('\n'));
  console.log(lines.slice(0, 8).join('\n'));
  console.log('\nFull report: scripts/tck/REPORT.md');
} else {
  console.log(lines.join('\n'));
}
