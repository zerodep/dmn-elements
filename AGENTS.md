# dmn-elements

Executable DMN elements — parse DMN XML (host-side), walk the decision requirement graph (DRG), and evaluate decisions (decision tables, literal expressions) with FEEL.

## Why this project exists

The isomorphic "DMN XML in, decision result out" engine category is abandonware (as of 2026-07):

- `dmn-eval-js` (@hbtgmbh/dmn-eval-js) frozen at 1.5.0, last published ~2019. All forks (stx-dmn-eval-js, dmn-eval-js-pablo, dmn-eval-js-es5, dmn-server) similarly stale.
- `js-feel` / EdgeVerve `feel` ~6 years cold.

But the layers underneath are alive and maintained by the bpmn-io/nikku (Camunda-adjacent) ecosystem:

- **feelin** 7.x — actively developed FEEL parser/interpreter, tested against the DMN TCK. The only runtime dependency, declared as a **peerDependency** (author decision 2026-07-10) so the host controls the feelin version and dedupes with its own feelin usage; npm ≥ 7 auto-installs it.
- **dmn-moddle** 12.x — DMN 1.3 read/write model layer (moddle 8), sibling of bpmn-moddle. Dev dependency; the host parses.

So the only thing worth building — and the only thing this project owns — is the **execution/orchestration layer**: walking the DRG and running decision logic against evaluated FEEL. Parsing (dmn-moddle) and FEEL semantics (feelin) stay upstream. The npm name `dmn-elements` was unclaimed as of 2026-07-08.

## Architecture bet

Mirror **bpmn-elements** (`../../bpmn-org/runner`, github.com/paed01/bpmn-elements) in structure, idiom, and tooling. Same author, same "moddle + execution glue" shape.

### No state handling — the deliberate divergence from bpmn-elements

DMN evaluation is a pure function of its inputs: FEEL is side-effect-free, and DMN has no waiting semantics (no timers, no messages, no human tasks — all input data is supplied up front). bpmn-elements needs getState/recover/resume and durable smqp brokers because BPMN runs park on the outside world for days; nothing in DMN parks. Therefore:

- **No run-state persistence**: no getState/recover/resume on Definition, no STATE_VERSION, no serialized run state. If the host dies mid-evaluation, re-run — evaluation is cheap and deterministic.
- **No smqp broker**: audit/observability comes from a returned evaluation trace (per decision: matched rules, hit policy resolution, output), not an event stream. Adding events later is additive if ever needed.
- **No serializer layer**: bpmn-elements consumes moddle-context-serializer output; that exists to round-trip run state. With no persistence, `Context` consumes the dmn-moddle definitions tree directly.
- **Callback-shaped execution anyway**: `execute(executeMessage, callback)` on behaviours, so async host services (DB-backed input data, service-implemented BKMs) can slot in at element boundaries. Async can never live _inside_ FEEL — feelin is synchronous and a host function returning a promise would leak the promise object into FEEL semantics.

### Element idiom (from bpmn-elements)

- Element type = factory function `Foo(elementDef, context)` returning `new DrgElement(FooBehaviour, elementDef, context)`; the Behaviour implements `execute(executeMessage, callback)`. Behaviours are exported so hosts can subclass/replace.
- Identify element kind by `Behaviour` identity, not the `type` string.
- `Environment` carries the pluggable seams: `expressions` (feelin default — a replacement must implement `resolveExpression` and `unaryTest`), `services`, `settings`, `variables`, `output`, `extensions`, `Logger`. No `scripts`, no `timers` (expression-only, no waiting).
- Folder mapping: `definition/` ≈ definition/, `drgElement/` ≈ activity/, `decisions/` + `knowledge/` + `io/` ≈ tasks/events/, `decisionLogic/` holds DecisionTable + LiteralExpression, `requirements/` ≈ flows/ (DRG edges), `error/Errors.js` same.

## Upstream API gotchas (verified)

- **feelin ≥ 7 returns `{ value, warnings }`** from both `evaluate()` and `unaryTest()` — unwrap `.value` (src/Expressions.js). Unary tests take the tested value on context key `?`.
- **dmn-moddle keeps DRG edges as unresolved `DMNElementReference` hrefs** (`#elementId`) — `Context.getRequirements` resolves them against the definitions tree.
- **dmn-moddle exports named `DmnModdle`**, not default: `import { DmnModdle } from 'dmn-moddle'`.
- DMN 1.3 namespace: `https://www.omg.org/spec/DMN/20191111/MODEL/` (see test/resources/dinner.dmn).
- **Test resources must include DMNDI** (`dmndi:DMNDiagram` with `DMNShape` per DRG element and `DMNEdge` per requirement) so the diagrams open in Camunda Modeler / dmn-js. Defaults: decision shape 180×80, input data 125×45; edge `dmnElementRef` points at the requirement id. dinner.dmn is the template.
- **feelin drags in luxon** (~70 kB min / ~23 kB gzip in a browser bundle; no tz data shipped — uses platform Intl) because FEEL's temporal types (`date`, `time`, `date and time`, both duration kinds) mandate calendar/zone-aware semantics. Imported top-level by feelin's builtins, so it never tree-shakes away even if models are date-free. Author dislikes the weight; escape hatch is the pluggable `Environment` `expressions` seam (slimmer FEEL subset engine); watch feelin for a native Temporal migration upstream.

## Build & tooling decisions

- **ESM-only, no build step** (author decision 2026-07-10, reversing the earlier CJS dist): feelin 7 is ESM-only, so a CJS dist only worked on Node ≥ 20.19/22.12 (`require(esm)`) anyway — same floor as consuming the ESM source directly via `require(esm)`. The rollup config, `dist/`, and the `require` export conditions were removed; `exports` conditions are `types` + `default` pointing at `src/`. CJS consumers on modern Node can still `require('dmn-elements')` through `require(esm)`.
- Types via **dts-buddy** (`scripts/build-types.js`) into `types/index.d.ts`, regenerated on prepack.
- eslint 10 + c8 11 at latest per author request.
- **Local Node via fnm + .nvmrc** (author instruction): discover and run the project Node with `fnm exec -- <command>` from the project dir — fnm resolves `.nvmrc` (currently 22). The system default node is 18, which trips eslint 10's stylish formatter (`util.styleText`, needs ≥ 20.12) and cannot `require(esm)` — always go through fnm.
- Style mirrors bpmn-elements: prettier (single quotes, 140 width, es5 commas), semicolons required, `no-console`, mocha + mocha-cakes-2 BDD (`Feature/Scenario/Given/When/Then`), chai `register-expect` (global `expect`), tsconfig with `#types` → `types/interfaces.d.ts`.

## Working agreements

- **No git commits** from agents. Scaffold and edit files only; the author commits.
- Significant project decisions and context go into this file (AGENTS.md), not external memory.
- TDD default (as in bpmn-elements): red → green → refactor; never weaken assertions to pass. JSDoc concise, intent not implementation.
- **Never assert on logging output** (as in bpmn-elements). Debug logging exists for developers (`Logger` environment option, `DEBUG=dmn-elements:*` with the debug-based logger — see README); log lines run under the silent default DummyLogger in tests, which keeps them covered without testing them.
- Before done: `npm test` (runs suite, then lint + prettier + typecheck + `test:md` via posttest).
- **Markdown code examples are executed** by texample (`npm run test:md` over docs/Examples.md and README.md). ` ```javascript ` blocks must be self-contained runnable ESM (they run in a vm with package self-reference available); use ` ```js ` for illustrative-only snippets that must not run.

## Test conventions

- All feature tests are BDD (mocha-cakes-2) and build their definition from either an **inline DMN source or a resource** — never hand-constructed moddle objects. Inline table sources come from `test/helpers/factory.js` `decisionTableSource(...)`; multi-decision DRGs are handwritten inline XML.
- **Every feature area anchors on at least one committed `.dmn` resource** (author instruction) — the happy-path scenario uses a real, modeler-viewable file so `test/resources/` doubles as an example gallery; inline sources stay for variants and error cases. Current gallery: `dinner.dmn` (UNIQUE decision table), `membership.dmn` (dependent decisions + input data), `shipping.dmn` (unary test flavors, FIRST), `assessment.dmn` (OUTPUT ORDER, two prioritized output columns), `diamond.dmn` (diamond DRG, memoization), `discount.dmn` (BKM invocation with knowledge + information requirements), `bonus.dmn` (COLLECT hit policy), `pricing.dmn` (decision service with encapsulated decision, divider-line DI), `loan.dmn` (boxed context with final result entry).
- **No FEEL-semantics tests**: FEEL operators/types/functions are feelin's contract (DMN TCK upstream). We only test the seam we own — unary tests bound to `?`, environment variables vs evaluation input precedence, FEEL values crossing element boundaries (see test/feature/feel-feature.js).
- **Clock-dependent tests use chronokinesis** (freeze/travel/reset; feelin's `now()`/`today()` follow the mocked Date). Always `after(ck.reset)` in the scenario. Repeat-evaluation determinism is pinned by the "evaluates repeatedly with stable results" scenario in definition-feature — evaluation must stay stateless per run (fresh DefinitionExecution, cloned input, read-only environment).
- **Tests import from `'dmn-elements'`** (package self-reference via exports), never `../../src/index.js` — so tsc resolves the generated `types/index.d.ts` and type drift fails the gate.
- **Tests are type-checked**: root `checkJs` stays `false` (src unchecked, as in bpmn-elements); every test file opts in with a `// @ts-check` pragma. BDD globals declared in `test/globals.d.ts`, untyped test deps (dmn-moddle) in `test/modules.d.ts` (ambient, no export). `pretypecheck` regenerates `types/index.d.ts` so checks never run against stale types. Public API needing promise/callback duality uses JSDoc `@overload` (see Definition.evaluate) — a plain union return type breaks `.catch(...)` in checked callers.
- tsconfig `"types"` is a whitelist — add new global @types packages (node, chai) there or they silently don't load.

## Status (2026-07-08)

- Coverage: 99.9% lines / 90.8% branches / 100% functions (189 steps). The coverage sweep caught three real bugs, all fixed: `Environment.options` leaked known option keys into passthrough, `Environment.clone()` threw when `extensions` was unset (undefined failed validateOptions), and an absent input-data value bound `undefined` into the evaluation input, shadowing same-named environment variables in the FEEL context spread. Unit tests (describe/it, allowed alongside BDD features) live in `test/*-test.js` for API surface without a natural source-driven scenario (Environment, Context internals).
- Typed-surface gotchas from the sweep: JSDoc `@overload` order matters — the callback overload must precede the optional-input one or two-arg callback calls lose contextual typing; `Object.defineProperties` getters need the `declare module 'dmn-elements'` augmentation in types/interfaces.d.ts; the factory-guard `if (!(this instanceof ...))` early return makes tsc emit `| undefined` on constructor fields unless they carry explicit `/** @type {...} */`.
- BKM as FEEL function invocation implemented TDD (215 steps green, 100% line coverage):
  - A `knowledgeRequirement` binds the required `BusinessKnowledgeModel` into the requiring element's FEEL context as a JS function under its variable name — invoked from FEEL like `Apply discount(Amount, 0.1)` (feelin calls host functions; spaced names work; **positional arguments only** — feelin passes named-argument invocations as null for host functions).
  - The function scope is **closed** per spec: formal parameters + the BKM's own required knowledge (BKMs can require BKMs, resolved recursively with the same memoization/cycle detection); the caller's evaluation input never leaks in (verified by test).
  - Body dispatch: `dmn:LiteralExpression` | `dmn:DecisionTable` via their **synchronous `evaluate(input)`** methods (added alongside callback `execute` — FEEL invocation cannot be async). Errors thrown in the body propagate through feelin into the caller's DecisionError.
  - Explicit DecisionErrors: BKM without `encapsulatedLogic`, non-FEEL `kind` (Java/PMML), unsupported body type, `dmn:DecisionService` as required knowledge.
  - dmn-moddle shape: `bkm.encapsulatedLogic` is a `dmn:FunctionDefinition` with `formalParameter` (InformationItem[]), `kind`, and `body` (the wrapped expression).
- Decision table evaluation implemented TDD (95 BDD steps green + lint/typecheck/dist):
  - `Definition.evaluate(decisionId, input[, callback])` — promise or node callback; walks the DRG via `DefinitionExecution` (per-run memoized results, cycle detection, requirement binding under variable name).
  - `DecisionTable`: all hit policies — UNIQUE (violation → DecisionError), FIRST, ANY (must agree), PRIORITY / OUTPUT ORDER (via outputValues, missing → error), RULE ORDER, COLLECT ± SUM/COUNT/MIN/MAX (SUM/MIN/MAX guard that all outputs are numbers → DecisionError otherwise); `-`/empty entries match-all; single output → bare value, multiple → object keyed by output name; defaultOutputEntry on no match; no match → null (single-hit) / [] (multi-hit).
  - `LiteralExpression`, `InputData` (value pull with typeRef coercion), `Context.getElementById` mints runtime elements from a `dmn:*` type map (the TypeResolver seam).
- typeRef coercion implemented TDD (263 steps green, 100% line coverage): `coerceTypeRef(value, typeRef, element)` in src/typeRef.js, exported from the package.
  - Applied at four seams: input data variable, decision table input expressions (before unary tests), output entries (rule + default), BKM formal parameters.
  - Accepts FEEL type names **and Camunda Modeler's Java-ish aliases** (integer/long/double/decimal — the modeler rewrites `number` → `double` on save, see bonus.dmn). Temporal strings convert through the pluggable expression engine (`date(raw)` etc.), so a custom expressions implementation needs those builtins.
  - Lenient where the spec is open: null/undefined and unknown typeRefs (item definition references) pass through untouched; already-typed values pass through. Loud where it matters: impossible coercions throw DecisionError (`cannot coerce "plenty" to double`).
  - Decision variable typeRef is deliberately NOT coerced — outputs and literal expressions already produce FEEL-typed values; revisit if item definitions land.
  - d.ts gotcha: a JSDoc `[optional]` param before a required one emits invalid TS (`TS1016`) — declare `{string | undefined}` instead.
- Evaluation trace implemented TDD (298 steps green, 100% line coverage): `Definition.trace(decisionId, input[, callback])` → `{ result, trace }` — same machinery as `evaluate` (which stays bare-result), the per-run `DefinitionExecution` exposes its `trace` array.
  - Trace entries in **completion order** (post-order — dependencies before dependents; memoized decisions and knowledge bindings appear once). Entry: `{ id, type, name, requirements: [{ id, required, type, bound, value? }], decisionLogic?, hitPolicy?, aggregation?, matchedRules?, result? }`.
  - Collection is always on (per-run allocations are trivial); decision tables annotate the entry through `executeMessage.trace` handed down by DefinitionExecution → DecisionBehaviour → DecisionTable.evaluate's optional second param. BKM body evaluations invoked from FEEL are NOT traced per-invocation (only the binding) — revisit if invocation-level audit is needed.
- Decision services implemented TDD (327 steps green, 100% line coverage), both call styles:
  - **Direct**: `definition.evaluate(serviceId, input)` — input decision values must be provided in input, bound by variable name (missing → DecisionError); they are **seeded into the run's memo, never evaluated** (spec semantics, pinned by a test whose input decision would violate its hit policy if evaluated). Output decisions evaluate through the normal walk (encapsulated decisions reached via requirements). Single output → bare result; multiple → object keyed by output decision variable name.
  - **As FEEL function** via `requiredKnowledge`: positional parameters are input decisions then input data, in definition order (DMN spec). Each invocation runs a **fresh sub-execution** (closed scope, arguments seeded) that shares the parent run's cycle-guard set and trace array — invocation-time evaluations appear in the trace, each invocation re-evaluates (no cross-invocation memo). Errors inside the service propagate through feelin into the caller's DecisionError. A sync-completion guard throws if a future async seam ever breaks FEEL's synchrony assumption.
  - Service completeness is NOT validated (an output decision may require elements outside the service) — lenient walk; revisit if strictness is wanted.
  - DMNDI: decision service shapes carry a `dmndi:DMNDecisionServiceDividerLine` (see pricing.dmn).
- `dmn:Context` decision logic implemented TDD (345 steps green, 100% line coverage): `BoxedContext` in src/decisionLogic/BoxedContext.js, exported.
  - Boxed context semantics: entries evaluate in order, each named entry binds into scope for later entries (variable typeRef coerced); an entry **without a variable is the final result entry** and yields the context result; otherwise the result is an object of all named entries. Entry without expression → null.
  - Entry expressions dispatch to LiteralExpression, DecisionTable, or nested BoxedContext (recursive); anything else (dmn:Relation, dmn:Invocation) → DecisionError. Works as decision logic AND as BKM encapsulated-logic body (`Rectangle(4, 3).area`).
  - dmn-moddle shape: `context.contextEntry[]` with `variable` (InformationItem) and **`value`** (the expression element — not `expression`).
  - loan.dmn is the resource anchor (monthly payment via chained entries + final result entry; FEEL `**` exponentiation works in feelin).
- Not supported yet: `dmn:Invocation`/`dmn:Relation` decision logic, named-argument BKM/service invocation, invocation-level BKM tracing, service completeness validation.
- Next candidates: type overrides via settings, `dmn:Invocation` decision logic.
