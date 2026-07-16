# Changelog

## Unreleased

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
