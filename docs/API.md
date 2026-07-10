# API

Runnable examples in this document are verified with [texample](https://www.npmjs.com/package/texample) (`npm run test:md`). See [Examples](Examples.md) for more.

<!-- toc -->

- [Definition](#definition)
  - [`new Definition(context[, options])`](#new-definitioncontext-options)
  - [`definition.evaluate(decisionId[, input][, callback])`](#definitionevaluatedecisionid-input-callback)
  - [`definition.trace(decisionId[, input][, callback])`](#definitiontracedecisionid-input-callback)
  - [`definition.getDecisionById(decisionId)`](#definitiongetdecisionbyiddecisionid)
- [Environment](#environment)
- [Settings](#settings)
  - [`types`](#types)
  - [`validateResult`](#validateresult)
  - [`resolveImport`](#resolveimport)
- [Precompiled definitions](#precompiled-definitions)

<!-- tocstop -->

## Definition

Executable DMN definitions — the top-level element that walks the decision requirement graph (DRG) and evaluates decisions.

### `new Definition(context[, options])`

- `context`: a `Context` wrapping the parsed dmn-moddle definitions and an `Environment` — the host parses DMN XML with [dmn-moddle](https://github.com/bpmn-io/dmn-moddle) and passes the root element
- `options`: optional [environment options](#environment) — when passed, the definition clones the context environment with the overrides

```js
import { DmnModdle } from 'dmn-moddle';
import { Context, Definition, Environment } from 'dmn-elements';

const { rootElement } = await new DmnModdle().fromXML(source);
const definition = new Definition(new Context(rootElement, new Environment()));
```

### `definition.evaluate(decisionId[, input][, callback])`

Evaluate a decision and, recursively, its required decisions. Requirements bind under each element's variable name: required decisions evaluate first (memoized per run), input data values pull from `input`, and business knowledge models and decision services bind as FEEL-invocable functions.

- `decisionId`: id of a `dmn:Decision` — or a `dmn:DecisionService`, whose input decision values must then be provided in `input` bound by variable name
- `input`: input data values by variable name, merged over environment variables
- `callback`: optional node style callback `(err, result)` — without it a promise is returned

Returns the bare decision result: a single decision table output yields the value, multiple outputs an object keyed by output name; a multi-output decision service yields an object keyed by output decision variable name. Evaluation failures — hit policy violations, failed type coercions, FEEL errors — reject with a `DecisionError`.

Evaluation is stateless: every call is a fresh run, nothing survives between calls.

### `definition.trace(decisionId[, input][, callback])`

Evaluate like [`evaluate`](#definitionevaluatedecisionid-input-callback), resolving with `{ result, trace }` — the evaluated elements in completion order (dependencies before dependents), each with its requirement bindings, and hit policy resolution for decision tables. See the [trace example](Examples.md#trace-an-evaluation).

### `definition.getDecisionById(decisionId)`

Returns the dmn-moddle decision definition, or `undefined`.

## Environment

`new Environment(options)` carries the pluggable seams shared by an evaluation:

| Option        | Purpose                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `variables`   | base FEEL context — evaluation input takes precedence                                                                                 |
| `settings`    | engine configuration, see [Settings](#settings)                                                                                       |
| `expressions` | FEEL engine, feelin by default — a replacement must implement `resolveExpression(expression, context)` and `unaryTest(test, context)` |
| `services`    | named host functions, available through `getServiceByName`                                                                            |
| `output`      | shared output object                                                                                                                  |
| `extensions`  | named extension functions                                                                                                             |
| `Logger`      | logger factory `(scope) => ({ debug, error, warn })`, silent by default — see [Debug](../README.md#debug)                             |

## Settings

Settings are plain values on `environment.settings`.

### `types`

Per-typeRef coercion overrides: a map of typeRef (exact match) to coercion function `(value, typeRef, element) => coerced`. An override takes precedence over the builtin FEEL types and item definitions, and owns its validation — throw a `DecisionError` to fail the evaluation.

```javascript
import { DmnModdle } from 'dmn-moddle';
import { Context, Definition, Environment } from 'dmn-elements';

const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="gradeDefinitions" name="Grade" namespace="https://example.com/dmn/grade">
  <decision id="grade" name="Grade">
    <variable id="gradeVariable" name="Grade" typeRef="string" />
    <decisionTable id="gradeTable" hitPolicy="FIRST">
      <input id="scoreInput">
        <inputExpression id="scoreInputExpression" typeRef="tScore"><text>Score</text></inputExpression>
      </input>
      <output id="gradeOutput" name="grade" />
      <rule id="goldRule">
        <inputEntry id="goldEntry"><text>&gt; 80</text></inputEntry>
        <outputEntry id="goldGrade"><text>"gold"</text></outputEntry>
      </rule>
      <rule id="silverRule">
        <inputEntry id="silverEntry"><text>-</text></inputEntry>
        <outputEntry id="silverGrade"><text>"silver"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

const environment = new Environment({
  settings: {
    types: {
      tScore(value) {
        return Number(String(value).replace(' pts', ''));
      },
    },
  },
});

const { rootElement } = await new DmnModdle().fromXML(source);
const definition = new Definition(new Context(rootElement, environment));

console.log(await definition.evaluate('grade', { Score: '85 pts' }));
// gold
```

### `validateResult`

Off by default. When true, every decision result is coerced and validated against the decision variable's typeRef before the decision completes — a result outside an item definition's allowed values fails the evaluation instead of flowing downstream.

```javascript
import { DmnModdle } from 'dmn-moddle';
import { Context, Definition, Environment } from 'dmn-elements';

const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="riskDefinitions" name="Risk" namespace="https://example.com/dmn/risk">
  <itemDefinition id="tRiskClass" name="tRiskClass">
    <typeRef>string</typeRef>
    <allowedValues id="riskClassValues"><text>"low", "medium", "high"</text></allowedValues>
  </itemDefinition>
  <decision id="riskClass" name="Risk class">
    <variable id="riskClassVariable" name="Risk class" typeRef="tRiskClass" />
    <literalExpression id="riskClassExpression"><text>if Score &lt; 40 then "low" else "unmapped"</text></literalExpression>
  </decision>
</definitions>`;

const { rootElement } = await new DmnModdle().fromXML(source);
const definition = new Definition(new Context(rootElement, new Environment({ settings: { validateResult: true } })));

console.log(await definition.evaluate('riskClass', { Score: 30 }));
// low

console.log(await definition.evaluate('riskClass', { Score: 95 }).catch((err) => err.message));
// <riskClass> value "unmapped" violates allowed values of tRiskClass
```

### `resolveImport`

Declares how imported models load — the engine never touches the file system. `resolveImport(importDef)` receives the declared `dmn:Import` (`name`, `namespace`, `locationURI`, `importType`) and returns the imported model's parsed dmn-moddle definitions, or a promise thereof. Each import resolves once per definition; imports of imports resolve recursively.

A typeRef qualified by the import name (`common.tLevel`) then coerces and validates through the imported item definitions, and requirement hrefs qualified with an imported namespace (`https://…/common-types#someDecision`) resolve into the imported model — the imported element evaluates in its own model and binds under its qualified name (`common.Some Decision`). Referencing a declared import without this setting fails the evaluation; an unused import declaration needs no resolver.

```javascript
import { DmnModdle } from 'dmn-moddle';
import { Context, Definition, Environment } from 'dmn-elements';

const typesSource = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="commonTypes" name="Common types" namespace="https://example.com/dmn/common-types">
  <itemDefinition id="tLevel" name="tLevel">
    <typeRef>string</typeRef>
    <allowedValues id="levelValues"><text>"gold", "silver", "bronze"</text></allowedValues>
  </itemDefinition>
</definitions>`;

const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="membershipDefinitions" name="Membership" namespace="https://example.com/dmn/membership">
  <import name="common" namespace="https://example.com/dmn/common-types" locationURI="common-types.dmn" importType="https://www.omg.org/spec/DMN/20191111/MODEL/" />
  <inputData id="levelInput" name="Level">
    <variable id="levelVariable" name="Level" typeRef="common.tLevel" />
  </inputData>
  <decision id="fee" name="Fee">
    <variable id="feeVariable" name="Fee" typeRef="number" />
    <informationRequirement id="feeRequiresLevel">
      <requiredInput href="#levelInput" />
    </informationRequirement>
    <literalExpression id="feeExpression"><text>if Level = "gold" then 0 else 10</text></literalExpression>
  </decision>
</definitions>`;

const environment = new Environment({
  settings: {
    async resolveImport(importDef) {
      const { rootElement } = await new DmnModdle().fromXML(typesSource);
      return rootElement;
    },
  },
});

const { rootElement } = await new DmnModdle().fromXML(source);
const definition = new Definition(new Context(rootElement, environment));

console.log(await definition.evaluate('fee', { Level: 'gold' }));
// 0

console.log(await definition.evaluate('fee', { Level: 'platinum' }).catch((err) => err.message));
// <levelInput> value "platinum" violates allowed values of tLevel
```

## Precompiled definitions

`serializeDefinitions(definitions)` serializes parsed dmn-moddle definitions to lean JSON — moddle internals never serialize and diagram interchange is stripped. The engine reads only plain data, so the revived JSON evaluates like the source tree. Parse once at build time, ship the JSON, and evaluate without dmn-moddle in the runtime bundle:

```javascript
import { DmnModdle } from 'dmn-moddle';
import { Context, Definition, Environment, serializeDefinitions } from 'dmn-elements';

const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="dinnerDefinitions" name="Dinner" namespace="https://example.com/dmn/dinner">
  <inputData id="seasonInput" name="Season">
    <variable id="seasonVariable" name="Season" typeRef="string" />
  </inputData>
  <decision id="dish" name="Dish">
    <variable id="dishVariable" name="Dish" typeRef="string" />
    <informationRequirement id="dishRequiresSeason">
      <requiredInput href="#seasonInput" />
    </informationRequirement>
    <literalExpression id="dishExpression"><text>if Season = "Winter" then "Roast beef" else "Light salad"</text></literalExpression>
  </decision>
</definitions>`;

// build time: parse and serialize, e.g. to a file next to the bundle
const { rootElement } = await new DmnModdle().fromXML(source);
const precompiled = serializeDefinitions(rootElement);

// runtime: revive — no dmn-moddle needed from here on
const definition = new Definition(new Context(JSON.parse(precompiled), new Environment()));

console.log(await definition.evaluate('dish', { Season: 'Winter' }));
// Roast beef
```

The serialization is one-way: a revived tree evaluates, but cannot be written back to DMN XML — that needs the moddle instances.
