# dmn-elements

[![Build](https://github.com/zerodep/dmn-elements/actions/workflows/build.yaml/badge.svg)](https://github.com/zerodep/dmn-elements/actions/workflows/build.yaml)[![Coverage Status](https://coveralls.io/repos/github/zerodep/dmn-elements/badge.svg?branch=main)](https://coveralls.io/github/zerodep/dmn-elements?branch=main)

Executable decision elements based on DMN 1.3.

Walks the decision requirement graph (DRG) and evaluates decisions — decision tables and literal expressions — standing on maintained upstream pieces:

- [dmn-moddle](https://github.com/bpmn-io/dmn-moddle) parses DMN XML (host-side, dev dependency)
- [feelin](https://github.com/nikku/feelin) evaluates FEEL expressions and unary tests (peer dependency)

Sibling of [bpmn-elements](https://github.com/paed01/bpmn-elements), sharing its idiom: isomorphic, tree-shakeable, minimal runtime dependencies.

## Documentation

- [API](docs/API.md) — `Definition`, environment settings, and extensions
- [Examples](docs/Examples.md) — runnable examples

## Debug

Element execution is logged through the pluggable `Logger` environment option — silent by default. To follow the execution tree, pass a [debug](https://www.npmjs.com/package/debug)-backed logger:

```javascript
import Debug from 'debug';
import { Context, Definition, Environment } from 'dmn-elements';

const environment = new Environment({
  Logger(scope) {
    return {
      debug: Debug(`dmn-elements:${scope}`),
      error: Debug(`dmn-elements:error:${scope}`),
      warn: Debug(`dmn-elements:warn:${scope}`),
    };
  },
});
```

Run with `DEBUG=dmn-elements:*`:

```
dmn-elements:dmn:definitions <membershipDefinitions> run decision <fee>
dmn-elements:dmn:definitions <fee> requires decision <category>
dmn-elements:dmn:definitions <category> requires input data <ageInput>
dmn-elements:dmn:inputdata <ageInput> evaluate
dmn-elements:dmn:decision <category> evaluate
dmn-elements:dmn:decisiontable <categoryTable> 1 of 2 rules matched: adultRule, resolving hit policy UNIQUE
dmn-elements:dmn:definitions <category> completed
dmn-elements:dmn:definitions <fee> bound <Category> from decision <category>
dmn-elements:dmn:decision <fee> evaluate
dmn-elements:dmn:decisiontable <feeTable> 1 of 2 rules matched: adultFeeRule, resolving hit policy UNIQUE
dmn-elements:dmn:definitions <fee> completed
```

## DMN conformance

Checked against the [DMN TCK](https://github.com/dmn-tck/tck) (July 2026):

- **Compliance level 2: 100%** (126/126 assertions)
- Compliance level 3: 84.3% (2840/3369)
- Overall: 84.9% (2966/3495)

All boxed expressions of DMN 1.3 evaluate: decision tables, literal expressions, contexts, invocations, relations, lists, and function definitions — plus decision services, business knowledge models, item definitions, and multi-model imports. The remaining gap is dominated by FEEL edge-case semantics owned by [feelin](https://github.com/nikku/feelin) (arithmetic corner cases, `instance of`, temporal functions) and DMN 1.4+ boxed expressions not yet in [dmn-moddle](https://github.com/bpmn-io/dmn-moddle)'s grammar.

The full per-case report lives in [scripts/tck/REPORT.md](scripts/tck/REPORT.md) — regenerate it with `npm run test:tck` (it tells you how to fetch the TCK test cases on first run).

# Ecosystem

- [bpmn-elements](https://github.com/paed01/bpmn-elements) — isomorphic BPMN 2.0 execution elements, the sibling this project mirrors
- [bpmn-engine](https://github.com/paed01/bpmn-engine) — BPMN 2.0 execution engine
- [bpmn-middleware](https://github.com/zerodep/bpmn-middleware) — Express middleware exposing the engine over HTTP. Holds example to combine `dmn-elements` with BPMN execution engine
