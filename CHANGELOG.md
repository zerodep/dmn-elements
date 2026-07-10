# Changelog

## Unreleased

### Added

- `dmn:Invocation` decision logic — boxed invocations bind parameters by name
- `dmn:Relation` decision logic — a relation evaluates to a list of row contexts
- `dmn:List` decision logic — a boxed list evaluates to the list of its element values
- `dmn:FunctionDefinition` decision logic — a boxed function definition evaluates to a FEEL-invocable function closing over its definition scope
- Type coercion overrides per typeRef via the environment setting `types`
- Item definitions — a typeRef naming a `dmn:ItemDefinition` coerces through its alias, validates allowed values, coerces structure components, and coerces collection elements
- Opt-in decision result validation via the environment setting `validateResult` — results are coerced and validated against the decision variable type
