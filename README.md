# dmn-elements

[![Build](https://github.com/zerodep/dmn-elements/actions/workflows/build.yaml/badge.svg)](https://github.com/zerodep/dmn-elements/actions/workflows/build.yaml)

Executable decision elements based on DMN 1.3.

Walks the decision requirement graph (DRG) and evaluates decisions — decision tables and literal expressions — standing on maintained upstream pieces:

- [dmn-moddle](https://github.com/bpmn-io/dmn-moddle) parses DMN XML (host-side, dev dependency)
- [feelin](https://github.com/nikku/feelin) evaluates FEEL expressions and unary tests (peer dependency)

Sibling of [bpmn-elements](https://github.com/paed01/bpmn-elements), sharing its idiom: isomorphic, tree-shakeable, minimal runtime dependencies.

## Documentation

- [API](docs/API.md) — `Definition` and environment settings
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

## Status

Scaffolding. See AGENTS.md for architecture decisions.
