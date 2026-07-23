# Changelog

## Unreleased

## v0.0.3 - 2026-07-23

### Added

- DMN 1.4 boxed expressions evaluate: conditional, filter, and the iterators (for, some, every) — as decision logic, context entries, list elements, and function bodies. A filter match sees the implicit `item` variable and a context element's entries; a for return sees the iterator variable and `partial` (the results so far); non-conforming values (non-list `in`, non-boolean `if`/`match`/`satisfies`) raise `DecisionError`
- DMN 1.5 item definition `typeConstraint` — unary tests validating the value as a whole (bound to `?`) wherever typeRefs coerce, while `allowedValues` keeps constraining the element type; a collection's elements answer to allowed values and the list itself to the type constraint. Violations raise `DecisionError`. The `dmn-elements/dmn-moddle` grammar carries the element
- New `dmn-elements/dmn-moddle` export for host-side parsing: `dmn` — dmn-moddle's DMN package extended with the 1.4 boxed expression grammar (`new DmnModdle({ dmn })`) — and `alignDmnNamespaces(source)`, rewriting DMN 1.4/1.5 namespace URIs to the 1.3 URIs the package is registered under
- dmn-moddle declared as an optional peer dependency — only needed with the `dmn-elements/dmn-moddle` subpath

### Changed

- DMN TCK conformance: overall 85.2% (was 84.9%) — the DMN 1.4 boxed expression cases (1150–1154) now pass in full

## v0.0.2 - 2026-07-16

### Added

- Extensions via the environment `extensions` option — named functions called per DRG element that decorate the model beyond the DMN schema, e.g. from vendor attributes, optionally hooking in around each evaluation
- Serialized definitions keep vendor extension attributes (`$attrs`), so extensions decorate revived trees like the source

## v0.0.1 - 2026-07-13

First published release — DRG walking and every concrete DMN 1.3 boxed expression evaluate.

### Added

- `dmn:Invocation` decision logic — boxed invocations bind parameters by name
- `dmn:Relation` decision logic — a relation evaluates to a list of row contexts
- `dmn:List` decision logic — a boxed list evaluates to the list of its element values
- `dmn:FunctionDefinition` decision logic — a boxed function definition evaluates to a FEEL-invocable function closing over its definition scope
- Type coercion overrides per typeRef via the environment setting `types`
- Item definitions — a typeRef naming a `dmn:ItemDefinition` coerces through its alias, validates allowed values, coerces structure components, and coerces collection elements
- Opt-in decision result validation via the environment setting `validateResult` — results are coerced and validated against the decision variable type
- Imported type libraries via the environment setting `resolveImport` — the host resolves a declared `dmn:Import` to its parsed definitions (async supported); qualified typeRefs like `logistics.tParcel` then coerce and validate through the imported item definitions
- `serializeDefinitions(definitions)` — precompile parsed definitions to lean JSON; the revived JSON evaluates without dmn-moddle at runtime
- FEEL named-argument invocation of business knowledge models, decision services, and boxed function definitions
- Imported DRG elements — requirement hrefs qualified with an imported namespace resolve into the imported model; the imported element evaluates in its own model and binds under its qualified name (`common.Greeting`)

### Changed

- Decision service positional parameters are input data followed by input decisions, per the DMN TCK
- A decision without decision logic evaluates to null instead of failing
- Invoking a function with surplus arguments yields null; a decision service invoked with too few arguments fails

### Fixed

- Default output entries apply when no rule matches, regardless of hit policy
- PRIORITY and OUTPUT ORDER rank on the output columns that declare output values
- A one-element list coerces to its element for scalar types (DMN singleton list conversion)
- Collections of a named item definition type no longer trip the circular type guard
- Requirement hrefs qualified with the model's own namespace resolve
