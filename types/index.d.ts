declare module 'dmn-elements' {
	/**
	 * Element registry over a dmn-moddle definitions tree — the host parses the XML and
	 * passes the root `dmn:Definitions` element; runtime elements are minted on demand.
	 * @param definitions dmn-moddle definitions (root element from `DmnModdle#fromXML`)
	 * 
	 */
	export function Context(definitions: any, environment?: Environment): Context;
	export class Context {
		/**
		 * Element registry over a dmn-moddle definitions tree — the host parses the XML and
		 * passes the root `dmn:Definitions` element; runtime elements are minted on demand.
		 * @param definitions dmn-moddle definitions (root element from `DmnModdle#fromXML`)
		 * 
		 */
		constructor(definitions: any, environment?: Environment);
		definitions: any;
		
		id: string;
		
		name: string;
		
		type: string;
		environment: Environment | undefined;
		/**
		 * All DRG elements: decisions, input data, business knowledge models, and knowledge sources
		 * @returns dmn-moddle DRG element definitions
		 */
		getDrgElements(): any[];
		/** @returns dmn-moddle decision definitions */
		getDecisions(): any[];
		
		getDecisionById(id: string): any;
		
		getDrgElementById(id: string): any;
		/**
		 * DRG element by reference href — `#elementId`, qualified with the model
		 * namespace, or qualified with a declared import's namespace
		 * @returns dmn-moddle DRG element definition
		 */
		getDrgElementByHref(href: string): any | undefined;
		/**
		 * DRG element by reference href, with the context that owns it — an element of
		 * an imported model resolves and evaluates in the imported model's context
		 * @param href `#elementId`, or `namespace#elementId`
		 * @throws {DecisionError} when the href references a declared import that is not loaded
		 */
		resolveDrgElementRef(href: string): {
			elementDef: any;
			context: Context;
			importName?: string;
		} | undefined;
		/**
		 * Item definition by type name, as referenced by a typeRef
		 * @param name local name, or qualified by import name (`logistics.tParcel`)
		 * @returns dmn-moddle item definition
		 */
		getItemDefinitionByName(name: string): any | undefined;
		/**
		 * Item definition by type name, with the context that owns it — an imported item
		 * definition resolves its own nested type references in the imported model
		 * @param name local name, or qualified by import name (`logistics.tParcel`)
		 * @throws {DecisionError} when the name references a declared import that is not loaded
		 */
		resolveItemDefinition(name: string): {
			itemDefinition: any;
			context: Context;
		} | undefined;
		/**
		 * Resolve declared imports through the `resolveImport` environment setting, which
		 * returns the imported model's parsed definitions or a promise thereof. Nested imports
		 * resolve once per namespace.
		 *
		 * Definition#evaluate and #trace await this before each run; call it directly when
		 * using the context synchronously. Without the setting, a reference to an imported
		 * type fails the evaluation instead.
		 * @param seen resolved contexts by namespace
		 * @returns undefined when there is nothing to load
		 */
		loadImports(seen?: Map<string, Context>): Promise<Context> | undefined;
		
		_loadImports(resolveImport: any, seen: any): Promise<this>;
		/**
		 * DRG elements the passed element requires, resolved from information- and knowledge requirements
		 * @param drgElementDef dmn-moddle DRG element definition
		 * @returns required dmn-moddle DRG element definitions
		 */
		getRequirements(drgElementDef: any): any[];
		/**
		 * Get, or lazily mint, a runtime DRG element instance
		 * */
		getElementById(id: string): DrgElement | undefined;
		/**
		 * Load registered environment extensions for a DRG element. Each extension factory
		 * is called with the element and this context and may decorate the element; returned
		 * activate/deactivate hooks run around each evaluation
		 * @returns undefined when no extension returned hooks
		 */
		loadExtensions(element: DrgElement): Extensions | undefined;
		/**
		 * Clone context, e.g. to evaluate with a new environment
		 * 
		 */
		clone(newEnvironment?: Environment): any;
	}
	/**
	 * Extension hooks loaded for one element — factories that return nothing are
	 * mint-time decorators only and add no hooks
	 * */
	function Extensions(element: DrgElement, context: Context, factories: ExtensionFactory[]): void;
	class Extensions {
		/**
		 * Extension hooks loaded for one element — factories that return nothing are
		 * mint-time decorators only and add no hooks
		 * */
		constructor(element: DrgElement, context: Context, factories: ExtensionFactory[]);
		extensions: {
			activate(message: any): void;
			deactivate(message: any): void;
		}[];
		get count(): number;
		/** @param executeMessage evaluation input, and the trace entry for traced elements */
		activate(executeMessage: any): void;
		/** @param completeMessage the execute message with the evaluation `result`, or the `error` on failure */
		deactivate(completeMessage: any): void;
	}
	/**
	 * Shared evaluation environment: variables, services, settings, and the FEEL engine.
	 * 
	 */
	export function Environment(options?: EnvironmentOptions): Environment;
	export class Environment {
		/**
		 * Shared evaluation environment: variables, services, settings, and the FEEL engine.
		 * 
		 */
		constructor(options?: EnvironmentOptions);
		/** @type {Record<string, any>} unlisted constructor options */
		options: Record<string, any>;
		
		extensions: Record<string, Function> | undefined;
		
		output: Record<string, any>;
		
		settings: EnvironmentSettings;
		
		Logger: (scope: string) => ILogger;
		
		expressions: IExpressions;
		getState(): {
			settings: {
				[x: string]: any;
				validateResult?: boolean;
				types?: Record<string, (value: any, typeRef: string, element: {
					id?: string;
					type?: string;
					environment: any;
					context?: any;
				}) => any>;
				resolveImport?: (importDef: {
					name: string;
					namespace: string;
					locationURI?: string;
					importType?: string;
					[x: string]: any;
				}) => any;
			};
			variables: {
				[x: string]: any;
			};
			output: {
				[x: string]: any;
			};
		};
		/**
		 * Merge state over current
		 * 
		 */
		recover(state?: ReturnType<Environment["getState"]>): this;
		/**
		 * Clone environment: override options take precedence, services and a host-provided
		 * expressions engine are shared, output starts empty
		 * @param overrideOptions take precedence over current
		 * */
		clone(overrideOptions?: EnvironmentOptions): Environment;
		/** @param newVars merged over current variables */
		assignVariables(newVars: Record<string, any>): void;
		/** @param newSettings merged over current settings */
		assignSettings(newSettings: EnvironmentSettings): this;
		
		getServiceByName(name: string): Function | undefined;
		
		addService(name: string, fn: Function): void;
		/**
		 * Evaluate a FEEL expression with environment variables as base context and
		 * services exposed under `services` — a variable or context key named
		 * `services` shadows the overlay
		 * @param context merged over environment variables
		 */
		resolveExpression(expression: string, context?: Record<string, any>): any;
		/**
		 * Evaluate a FEEL unary tests expression with environment variables as base context and
		 * services exposed under `services`
		 * @param context merged over environment variables, tested value on key `?`
		 */
		unaryTest(test: string, context?: Record<string, any>): boolean;
		[kOwnExpressions]: boolean;
		[kServices]: Record<string, (...args: any[]) => any>;
		[kGuardedServices]: Record<string, Function>;
		[kVariables]: Record<string, any>;
	}
	const kOwnExpressions: unique symbol;
	const kServices: unique symbol;
	const kGuardedServices: unique symbol;
	const kVariables: unique symbol;
	/**
	 * FEEL expression engine backed by feelin.
	 *
	 * Pluggable via Environment option `expressions`. A replacement must implement
	 * `resolveExpression(expression, context)` and `unaryTest(test, context)`.
	 * Evaluation warnings reported by feelin are logged at `warn` level.
	 * @param logger receives feelin warnings, silent by default
	 */
	export function Expressions(logger?: ILogger): Expressions;
	export class Expressions {
		/**
		 * FEEL expression engine backed by feelin.
		 *
		 * Pluggable via Environment option `expressions`. A replacement must implement
		 * `resolveExpression(expression, context)` and `unaryTest(test, context)`.
		 * Evaluation warnings reported by feelin are logged at `warn` level.
		 * @param logger receives feelin warnings, silent by default
		 */
		constructor(logger?: ILogger);
		
		logger: ILogger;
		/**
		 * Evaluate a FEEL expression
		 * @param expression FEEL expression
		 * @param context expression input context
		 * @returns evaluation result
		 */
		resolveExpression(expression: string, context?: Record<string, any>): any;
		/**
		 * Evaluate a FEEL unary tests expression, e.g. a decision table input entry
		 * @param test FEEL unary tests
		 * @param context expression input context, the tested input value is expected on key `?`
		 * @returns whether the tested value matches
		 */
		unaryTest(test: string, context?: Record<string, any>): boolean;
		
		_warn(expression: string, warnings: {
			type: string;
			message: string;
		}[]): void;
	}
	/**
	 * Executable DMN definitions — the top-level element that walks the decision
	 * requirement graph (DRG) and evaluates decisions.
	 * @param options environment overrides
	 */
	export function Definition(context: Context, options?: EnvironmentOptions): Definition;
	export class Definition {
		/**
		 * Executable DMN definitions — the top-level element that walks the decision
		 * requirement graph (DRG) and evaluates decisions.
		 * @param options environment overrides
		 */
		constructor(context: Context, options?: EnvironmentOptions);
		
		environment: Environment;
		
		context: Context;
		
		id: string;
		
		name: string;
		
		type: string;
		/**
		 * Evaluate a decision and, recursively, its required decisions. The id of a decision
		 * service or business knowledge model evaluates that invocable instead.
		 * 
		 */
		evaluate(decisionId: string, callback: (err: Error | null, result?: any) => void): void;
		/**
		 * Evaluate a decision and, recursively, its required decisions. The id of a decision
		 * service or business knowledge model evaluates that invocable instead.
		 * 
		 */
		evaluate(decisionId: string, input?: Record<string, any> | undefined): Promise<any>;
		/**
		 * Evaluate a decision and, recursively, its required decisions. The id of a decision
		 * service or business knowledge model evaluates that invocable instead.
		 * 
		 */
		evaluate(decisionId: string, input: Record<string, any> | null, callback: (err: Error | null, result?: any) => void): void;
		/**
		 * Evaluate a decision like {@link Definition#evaluate}, resolving with the result
		 * and the evaluation trace — evaluated elements in completion order, each with its
		 * requirement bindings, and hit policy resolution for decision tables.
		 * 
		 */
		trace(decisionId: string, callback: (err: Error | null, traced?: {
			result: any;
			trace: TraceEntry[];
		}) => void): void;
		/**
		 * Evaluate a decision like {@link Definition#evaluate}, resolving with the result
		 * and the evaluation trace — evaluated elements in completion order, each with its
		 * requirement bindings, and hit policy resolution for decision tables.
		 * 
		 */
		trace(decisionId: string, input?: Record<string, any> | undefined): Promise<{
			result: any;
			trace: TraceEntry[];
		}>;
		/**
		 * Evaluate a decision like {@link Definition#evaluate}, resolving with the result
		 * and the evaluation trace — evaluated elements in completion order, each with its
		 * requirement bindings, and hit policy resolution for decision tables.
		 * 
		 */
		trace(decisionId: string, input: Record<string, any> | null, callback: (err: Error | null, traced?: {
			result: any;
			trace: TraceEntry[];
		}) => void): void;
		
		getDecisionById(id: string): any;
	}
	/**
	 * Generic DRG element wrapper.
	 *
	 * Element factories pair this wrapper with an element-specific Behaviour that
	 * implements `execute(executeMessage, callback)`.
	 * @param Behaviour element behaviour constructor
	 * @param elementDef dmn-moddle element definition
	 * */
	export function DrgElement(Behaviour: Function, elementDef: any, context: Context): void;
	export class DrgElement {
		/**
		 * Generic DRG element wrapper.
		 *
		 * Element factories pair this wrapper with an element-specific Behaviour that
		 * implements `execute(executeMessage, callback)`.
		 * @param Behaviour element behaviour constructor
		 * @param elementDef dmn-moddle element definition
		 * */
		constructor(Behaviour: Function, elementDef: any, context: Context);
		
		id: string;
		
		type: string;
		
		name: string;
		behaviour: any;
		Behaviour: Function;
		context: Context;
		environment: Environment | undefined;
		logger: ILogger;
		/**
		 * Extension hooks, when registered extensions returned any
		 * */
		extensions: Extensions | undefined;
		/**
		 * Evaluate the element, running extension hooks around its behaviour
		 * @param executeMessage requirements output and evaluation input
		 * */
		evaluate(executeMessage: any, callback: (err: Error | null, result?: any) => void): any;
	}
	/**
	 * Coerce a value to its declared typeRef.
	 *
	 * Handles FEEL type names and Camunda Modeler's Java-ish aliases (integer, long,
	 * double): temporal strings become FEEL temporal values, and per the DMN implicit
	 * conversions a one-element list narrows to a declared scalar, a scalar widens to a
	 * declared collection, and a date widens to a declared date and time.
	 *
	 * Other typeRefs resolve against the item definitions: aliases, allowed values and
	 * type constraints, structures, and collections. Unknown typeRefs pass the value
	 * through untouched, as do null and undefined.
	 *
	 * The environment setting `types` — a map of typeRef (exact match) to coercion
	 * function `(value, typeRef, element) => coerced` — takes precedence over builtin
	 * types and item definitions; an override owns its validation and throws a
	 * DecisionError to fail.
	 * @param typeRef declared type, e.g. on a variable, input expression, output, or formal parameter
	 * @param element owning element, for FEEL access, item definition lookup, and error source
	 * @returns the coerced value
	 * @throws {DecisionError} when the value cannot be coerced
	 */
	export function coerceTypeRef(value: any, typeRef: string | undefined, element: {
		id?: string;
		type?: string;
		environment: Environment;
		context?: Context;
	}): any;
	/**
	 * Serialize parsed dmn-moddle definitions to lean JSON for precompiled execution —
	 * `new Context(JSON.parse(serialized))` evaluates like the source tree. Diagram
	 * interchange is stripped, vendor extension attributes are kept. One-way: a revived
	 * tree cannot be written back to DMN XML.
	 * @param definitions dmn-moddle definitions (root element from `DmnModdle#fromXML`)
	 * @returns JSON
	 */
	export function serializeDefinitions(definitions: any): string;
	/**
	 * Base error for dmn-elements
	 */
	export class DmnError extends Error {
		/**
		 * @param source element that raised the error
		 * @param options passed to Error, e.g. `cause`
		 */
		constructor(description: string, source?: {
			id?: string;
			type?: string;
		}, options?: ErrorOptions);
		source: {
			id: string | undefined;
			type: string | undefined;
		} | undefined;
	}
	/**
	 * Raised when evaluating a decision fails, e.g. a FEEL error or a violated hit policy
	 */
	export class DecisionError extends DmnError {
		/**
		 * @param cause original error, e.g. from feelin, chained as standard `cause`
		 */
		constructor(description: string, source?: {
			id?: string;
			type?: string;
		}, cause?: Error);
	}
  interface IExpressions {
	resolveExpression(expression: string, context?: Record<string, any>): any;
	unaryTest(test: string, context?: Record<string, any>): boolean;
  }

  interface ILogger {
	debug(...args: any[]): void;
	error(...args: any[]): void;
	warn(...args: any[]): void;
  }

  interface IExtension {
	/** runs before each evaluation of the element, with the execute message */
	activate?(executeMessage: any): void;
	/** runs after each evaluation completes, with the execute message plus `result` or `error` */
	deactivate?(completeMessage: any): void;
  }

  /**
   * Called when a DRG element is minted — decorate the element, and optionally
   * return hooks that run around each evaluation
   */
  type ExtensionFactory = (element: any, context: any) => IExtension | void;

  /** engine settings on `environment.settings` — see docs/API.md Settings */
  interface EnvironmentSettings {
	/** coerce and validate decision results against the decision variable typeRef, and invocable results against their declared function item output type */
	validateResult?: boolean;
	/** coercion per typeRef (exact match), consulted before builtin types and item definitions — the override owns its validation */
	types?: Record<string, (value: any, typeRef: string, element: { id?: string; type?: string; environment: any; context?: any }) => any>;
	/** parsed definitions of an imported model, or a promise thereof — the host parses */
	resolveImport?: (importDef: { name: string; namespace: string; locationURI?: string; importType?: string; [x: string]: any }) => any;
	[x: string]: any;
  }

  interface EnvironmentOptions {
	expressions?: IExpressions;
	extensions?: Record<string, ExtensionFactory>;
	Logger?: (scope: string) => ILogger;
	output?: Record<string, any>;
	services?: Record<string, (...args: any[]) => any>;
	settings?: EnvironmentSettings;
	variables?: Record<string, any>;
	[x: string]: any;
  }
	/**
	 * one resolved requirement of a traced element
	 */
	type TraceRequirement = {
		/**
		 * requirement id
		 */
		id: string;
		/**
		 * required element id
		 */
		required: string;
		/**
		 * required element type
		 */
		type: string;
		/**
		 * name the result was bound under
		 */
		bound: string;
		/**
		 * bound value, absent for knowledge bindings
		 */
		value?: any;
	};
	/**
	 * one evaluated element, in completion order
	 */
	type TraceEntry = {
		/**
		 * element id
		 */
		id: string;
		/**
		 * element type
		 */
		type: string;
		/**
		 * element name
		 */
		name?: string | undefined;
		/**
		 * resolved requirements
		 */
		requirements: TraceRequirement[];
		/**
		 * decision logic type, decisions only
		 */
		decisionLogic?: string | undefined;
		/**
		 * decision tables only
		 */
		hitPolicy?: string | undefined;
		/**
		 * COLLECT decision tables only
		 */
		aggregation?: string | undefined;
		/**
		 * matched rule ids, decision tables only
		 */
		matchedRules?: string[] | undefined;
		/**
		 * evaluation result, absent for knowledge bindings
		 */
		result?: any;
	};
	/**
	 * DMN decision element — evaluates its decision logic
	 * @param decisionDef dmn-moddle decision definition
	 * */
	export function Decision(decisionDef: any, context: Context): DrgElement;

	export function DecisionBehaviour(element: DrgElement): void;
	export class DecisionBehaviour {
		
		constructor(element: DrgElement);
		id: string;
		type: string;
		element: DrgElement;
		decisionLogic: any;
		execute(executeMessage: any, callback: any): any;
		
		_validatedCallback(callback: any): (err: any, result: any) => any;
	}
	/**
	 * Boxed conditional evaluation — dmn:Conditional as decision logic (DMN 1.4).
	 *
	 * The if child expression must evaluate to a boolean — true selects the then
	 * branch, false the else branch; only the selected branch evaluates.
	 * @param conditionalDef dmn-moddle conditional definition
	 * */
	export function BoxedConditional(conditionalDef: any, context: Context): void;
	export class BoxedConditional {
		/**
		 * Boxed conditional evaluation — dmn:Conditional as decision logic (DMN 1.4).
		 *
		 * The if child expression must evaluate to a boolean — true selects the then
		 * branch, false the else branch; only the selected branch evaluates.
		 * @param conditionalDef dmn-moddle conditional definition
		 * */
		constructor(conditionalDef: any, context: Context);
		
		id: string | undefined;
		
		type: string;
		behaviour: any;
		context: Context;
		environment: Environment | undefined;
		logger: ILogger;
		/**
		 * @param executeMessage evaluation input context
		 * */
		execute(executeMessage: {
			input?: Record<string, any>;
		}, callback: (err: Error | null, result?: any) => void): void;
		/**
		 * Evaluate synchronously, e.g. as encapsulated logic invoked from FEEL
		 * @param input evaluation input context
		 * @returns the selected branch result
		 */
		evaluate(input?: Record<string, any>): any;
	}
	/**
	 * Boxed context evaluation — dmn:Context as decision logic.
	 *
	 * Entries evaluate in order, each named entry binding its value into scope for
	 * subsequent entries. An entry without a variable is the final result entry and
	 * yields the context result; without one the result is an object of all entries.
	 * @param contextDef dmn-moddle context definition
	 * */
	export function BoxedContext(contextDef: any, context: Context): void;
	export class BoxedContext {
		/**
		 * Boxed context evaluation — dmn:Context as decision logic.
		 *
		 * Entries evaluate in order, each named entry binding its value into scope for
		 * subsequent entries. An entry without a variable is the final result entry and
		 * yields the context result; without one the result is an object of all entries.
		 * @param contextDef dmn-moddle context definition
		 * */
		constructor(contextDef: any, context: Context);
		
		id: string | undefined;
		
		type: string;
		behaviour: any;
		context: Context;
		environment: Environment | undefined;
		logger: ILogger;
		/**
		 * @param executeMessage evaluation input context
		 * */
		execute(executeMessage: {
			input?: Record<string, any>;
		}, callback: (err: Error | null, result?: any) => void): void;
		/**
		 * Evaluate synchronously, e.g. as encapsulated logic invoked from FEEL
		 * @param input evaluation input context
		 * @returns the final result entry value, or an object of all named entries
		 */
		evaluate(input?: Record<string, any>): any;
		
		_entryValue(entry: any, scope: any): any;
	}
	/**
	 * Boxed filter evaluation — dmn:Filter as decision logic (DMN 1.4).
	 *
	 * The in child expression must evaluate to a list; the match expression
	 * evaluates per element with the FEEL filter scope — the implicit variable
	 * `item` and, for context elements, their entries — and must yield a boolean.
	 * @param filterDef dmn-moddle filter definition
	 * */
	export function BoxedFilter(filterDef: any, context: Context): void;
	export class BoxedFilter {
		/**
		 * Boxed filter evaluation — dmn:Filter as decision logic (DMN 1.4).
		 *
		 * The in child expression must evaluate to a list; the match expression
		 * evaluates per element with the FEEL filter scope — the implicit variable
		 * `item` and, for context elements, their entries — and must yield a boolean.
		 * @param filterDef dmn-moddle filter definition
		 * */
		constructor(filterDef: any, context: Context);
		
		id: string | undefined;
		
		type: string;
		behaviour: any;
		context: Context;
		environment: Environment | undefined;
		logger: ILogger;
		/**
		 * @param executeMessage evaluation input context
		 * */
		execute(executeMessage: {
			input?: Record<string, any>;
		}, callback: (err: Error | null, result?: any) => void): void;
		/**
		 * Evaluate synchronously, e.g. as encapsulated logic invoked from FEEL
		 * @param input evaluation input context
		 * @returns the elements whose match evaluated to true
		 */
		evaluate(input?: Record<string, any>): any[];
	}
	/**
	 * Boxed for iteration — dmn:For as decision logic (DMN 1.4).
	 *
	 * The in child expression must evaluate to a list; the return expression
	 * evaluates per element with the iterator variable bound, plus the FEEL
	 * iteration variable `partial` holding the results so far.
	 * @param forDef dmn-moddle for definition
	 * */
	export function BoxedFor(forDef: any, context: Context): void;
	export class BoxedFor {
		/**
		 * Boxed for iteration — dmn:For as decision logic (DMN 1.4).
		 *
		 * The in child expression must evaluate to a list; the return expression
		 * evaluates per element with the iterator variable bound, plus the FEEL
		 * iteration variable `partial` holding the results so far.
		 * @param forDef dmn-moddle for definition
		 * */
		constructor(forDef: any, context: Context);
		
		id: string | undefined;
		
		type: string;
		behaviour: any;
		context: Context;
		environment: Environment | undefined;
		logger: ILogger;
		/**
		 * @param executeMessage evaluation input context
		 * */
		execute(executeMessage: {
			input?: Record<string, any>;
		}, callback: (err: Error | null, result?: any) => void): void;
		/**
		 * Evaluate synchronously, e.g. as encapsulated logic invoked from FEEL
		 * @param input evaluation input context
		 * @returns one return value per element
		 */
		evaluate(input?: Record<string, any>): any[];
	}
	/**
	 * Boxed list evaluation — dmn:List as decision logic.
	 *
	 * Elements evaluate independently in the evaluation input scope, in declaration
	 * order; the list evaluates to the list of element values.
	 * @param listDef dmn-moddle list definition
	 * */
	export function BoxedList(listDef: any, context: Context): void;
	export class BoxedList {
		/**
		 * Boxed list evaluation — dmn:List as decision logic.
		 *
		 * Elements evaluate independently in the evaluation input scope, in declaration
		 * order; the list evaluates to the list of element values.
		 * @param listDef dmn-moddle list definition
		 * */
		constructor(listDef: any, context: Context);
		
		id: string | undefined;
		
		type: string;
		behaviour: any;
		context: Context;
		environment: Environment | undefined;
		logger: ILogger;
		/**
		 * @param executeMessage evaluation input context
		 * */
		execute(executeMessage: {
			input?: Record<string, any>;
		}, callback: (err: Error | null, result?: any) => void): void;
		/**
		 * Evaluate synchronously, e.g. as encapsulated logic invoked from FEEL
		 * @param input evaluation input context
		 * @returns one value per element
		 */
		evaluate(input?: Record<string, any>): any[];
	}
	/**
	 * Decision table evaluation — inputs, outputs, rules, and hit policy resolution.
	 *
	 * Input entries are FEEL unary tests evaluated with the input expression result on `?`.
	 * Irrelevant entries (`-` or empty) match anything. A single output column yields the
	 * bare output value, multiple output columns yield an object keyed by output name.
	 * @param decisionTableDef dmn-moddle decision table definition
	 * */
	export function DecisionTable(decisionTableDef: any, context: Context): void;
	export class DecisionTable {
		/**
		 * Decision table evaluation — inputs, outputs, rules, and hit policy resolution.
		 *
		 * Input entries are FEEL unary tests evaluated with the input expression result on `?`.
		 * Irrelevant entries (`-` or empty) match anything. A single output column yields the
		 * bare output value, multiple output columns yield an object keyed by output name.
		 * @param decisionTableDef dmn-moddle decision table definition
		 * */
		constructor(decisionTableDef: any, context: Context);
		
		id: string | undefined;
		
		type: string;
		behaviour: any;
		context: Context;
		environment: Environment | undefined;
		logger: ILogger;
		/** @type {any[]} input clauses */
		inputs: any[];
		/** @type {any[]} output clauses */
		outputs: any[];
		/** @type {any[]} rules, in declaration order */
		rules: any[];
		/** @type {string} hit policy, UNIQUE when undeclared */
		hitPolicy: string;
		/** @type {string | undefined} COLLECT aggregation */
		aggregation: string | undefined;
		/**
		 * @param executeMessage evaluation input context
		 * */
		execute(executeMessage: {
			input?: Record<string, any>;
		}, callback: (err: Error | null, result?: any) => void): void;
		/**
		 * Evaluate synchronously, e.g. as encapsulated logic invoked from FEEL
		 * @param input evaluation input context
		 * @param trace trace entry to annotate with hit policy and matched rules
		 * @returns hit policy resolved result
		 */
		evaluate(input?: Record<string, any>, trace?: TraceEntry): any;
		
		_matchesRule(rule: any, inputValues: any, input: any): any;
		
		_resolveHitPolicy(matched: any, input: any): any;
		/**
		 * Output of a matched rule — bare value for a single output column, otherwise an
		 * object keyed by output name
		 * */
		_ruleOutput(rule: any, input: any): any;
		
		_entryValue(entry: any, input: any, typeRef: any): any;
		/**
		 * Default output entries, applied when no rule matched
		 * */
		_defaultOutput(input: any): any;
		/**
		 * Order matched rule outputs by output values priority, highest priority first
		 * */
		_sortByPriority(hitPolicy: any, matched: any, input: any): any;
		
		_collect(matched: any, input: any): any;
		
		_hitPolicyError(hitPolicy: any, matched: any): DecisionError;
	}
	/**
	 * Boxed function definition evaluation — dmn:FunctionDefinition as decision logic.
	 *
	 * Evaluates to a FEEL-invocable function closing over its definition scope, e.g.
	 * earlier entries of the boxed context defining it.
	 * @param functionDef dmn-moddle function definition
	 * */
	export function FunctionDefinition(functionDef: any, context: Context): void;
	export class FunctionDefinition {
		/**
		 * Boxed function definition evaluation — dmn:FunctionDefinition as decision logic.
		 *
		 * Evaluates to a FEEL-invocable function closing over its definition scope, e.g.
		 * earlier entries of the boxed context defining it.
		 * @param functionDef dmn-moddle function definition
		 * */
		constructor(functionDef: any, context: Context);
		
		id: string | undefined;
		
		type: string;
		behaviour: any;
		context: Context;
		environment: Environment | undefined;
		logger: ILogger;
		/**
		 * @param executeMessage evaluation input context
		 * */
		execute(executeMessage: {
			input?: Record<string, any>;
		}, callback: (err: Error | null, result?: any) => void): void;
		/**
		 * Evaluate synchronously to the FEEL-invocable function
		 * @param input definition scope the function closes over
		 * @returns the function
		 */
		evaluate(input?: Record<string, any>): (...args: any[]) => any;
	}
	/**
	 * Boxed invocation evaluation — dmn:Invocation as decision logic.
	 *
	 * The called function expression resolves to a FEEL-invocable function, e.g. a
	 * business knowledge model or decision service bound by a knowledge requirement.
	 * Bindings map to the function's formal parameters by name; a function without
	 * parameter metadata is applied with the binding values in declaration order.
	 * @param invocationDef dmn-moddle invocation definition
	 * */
	export function Invocation(invocationDef: any, context: Context): void;
	export class Invocation {
		/**
		 * Boxed invocation evaluation — dmn:Invocation as decision logic.
		 *
		 * The called function expression resolves to a FEEL-invocable function, e.g. a
		 * business knowledge model or decision service bound by a knowledge requirement.
		 * Bindings map to the function's formal parameters by name; a function without
		 * parameter metadata is applied with the binding values in declaration order.
		 * @param invocationDef dmn-moddle invocation definition
		 * */
		constructor(invocationDef: any, context: Context);
		
		id: string | undefined;
		
		type: string;
		behaviour: any;
		context: Context;
		environment: Environment | undefined;
		logger: ILogger;
		/**
		 * @param executeMessage evaluation input context
		 * */
		execute(executeMessage: {
			input?: Record<string, any>;
		}, callback: (err: Error | null, result?: any) => void): void;
		/**
		 * Evaluate synchronously, e.g. as encapsulated logic invoked from FEEL
		 * @param input evaluation input context
		 * @returns the called function result
		 */
		evaluate(input?: Record<string, any>): any;
		
		_expressionValue(expression: any, scope: any, role: any): any;
	}
	/**
	 * Literal expression evaluation — a single FEEL expression as decision logic
	 * @param literalExpressionDef dmn-moddle literal expression definition
	 * */
	export function LiteralExpression(literalExpressionDef: any, context: Context): void;
	export class LiteralExpression {
		/**
		 * Literal expression evaluation — a single FEEL expression as decision logic
		 * @param literalExpressionDef dmn-moddle literal expression definition
		 * */
		constructor(literalExpressionDef: any, context: Context);
		
		id: string | undefined;
		
		type: string;
		behaviour: any;
		context: Context;
		environment: Environment | undefined;
		logger: ILogger;
		/**
		 * @param executeMessage evaluation input context
		 * */
		execute(executeMessage: {
			input?: Record<string, any>;
		}, callback: (err: Error | null, result?: any) => void): void;
		/**
		 * Evaluate synchronously, e.g. as encapsulated logic invoked from FEEL
		 * @param input evaluation input context
		 * @returns expression result, null when the expression is empty
		 */
		evaluate(input?: Record<string, any>): any;
	}
	/**
	 * Boxed relation evaluation — dmn:Relation as decision logic.
	 *
	 * A vertical table of expressions: each row evaluates to a context keyed by
	 * column name, the relation to the list of rows. Cells evaluate independently
	 * in the evaluation input scope; a row shorter than the columns binds null for
	 * the missing cells; cell values are coerced to the column typeRef.
	 * @param relationDef dmn-moddle relation definition
	 * */
	export function Relation(relationDef: any, context: Context): void;
	export class Relation {
		/**
		 * Boxed relation evaluation — dmn:Relation as decision logic.
		 *
		 * A vertical table of expressions: each row evaluates to a context keyed by
		 * column name, the relation to the list of rows. Cells evaluate independently
		 * in the evaluation input scope; a row shorter than the columns binds null for
		 * the missing cells; cell values are coerced to the column typeRef.
		 * @param relationDef dmn-moddle relation definition
		 * */
		constructor(relationDef: any, context: Context);
		
		id: string | undefined;
		
		type: string;
		behaviour: any;
		context: Context;
		environment: Environment | undefined;
		logger: ILogger;
		/**
		 * @param executeMessage evaluation input context
		 * */
		execute(executeMessage: {
			input?: Record<string, any>;
		}, callback: (err: Error | null, result?: any) => void): void;
		/**
		 * Evaluate synchronously, e.g. as encapsulated logic invoked from FEEL
		 * @param input evaluation input context
		 * @returns one context per row, keyed by column name
		 */
		evaluate(input?: Record<string, any>): Record<string, any>[];
	}
	/**
	 * @param someDef dmn-moddle some definition
	 * */
	export function BoxedSome(someDef: any, context: Context): void;
	export class BoxedSome {
		/**
		 * @param someDef dmn-moddle some definition
		 * */
		constructor(someDef: any, context: Context);
	}
	/**
	 * @param everyDef dmn-moddle every definition
	 * */
	export function BoxedEvery(everyDef: any, context: Context): void;
	export class BoxedEvery {
		/**
		 * @param everyDef dmn-moddle every definition
		 * */
		constructor(everyDef: any, context: Context);
	}
	/**
	 * DMN input data element — supplies a named input value from the evaluation input
	 * @param inputDataDef dmn-moddle input data definition
	 * */
	export function InputData(inputDataDef: any, context: Context): DrgElement;

	export function InputDataBehaviour(element: DrgElement): void;
	export class InputDataBehaviour {
		
		constructor(element: DrgElement);
		id: string;
		type: string;
		element: DrgElement;
		variable: any;
		execute(executeMessage: any, callback: any): any;
	}
	/**
	 * DMN business knowledge model — reusable decision logic invocable from FEEL as a
	 * function named by the model, in any decision or business knowledge model that
	 * requires it via a knowledge requirement
	 * @param bkmDef dmn-moddle business knowledge model definition
	 * */
	export function BusinessKnowledgeModel(bkmDef: any, context: Context): DrgElement;

	export function BusinessKnowledgeModelBehaviour(element: DrgElement): void;
	export class BusinessKnowledgeModelBehaviour {
		
		constructor(element: DrgElement);
		id: string;
		type: string;
		element: DrgElement;
		encapsulatedLogic: any;
		/**
		 * Evaluates to the FEEL-invocable function, with a closed scope — formal parameters
		 * and required knowledge only. Callable with positional or named arguments.
		 * @param executeMessage required knowledge bindings
		 * @param callback called with the function
		 */
		execute(executeMessage: {
			input?: Record<string, any>;
		}, callback: (err: Error | null, result?: (...args: any[]) => any) => void): void;
	}
	/**
	 * DMN knowledge source — documentation-only DRG element (authority for a decision),
	 * no evaluation semantics
	 * @param knowledgeSourceDef dmn-moddle knowledge source definition
	 * */
	export function KnowledgeSource(knowledgeSourceDef: any, context: Context): DrgElement;

	export function KnowledgeSourceBehaviour(element: DrgElement): void;
	export class KnowledgeSourceBehaviour {
		
		constructor(element: DrgElement);
		id: string;
		type: string;
		element: DrgElement;
		execute(executeMessage: any, callback: any): any;
	}
	/**
	 * DMN information requirement — edge in the DRG from a decision to a required
	 * decision or required input data
	 * @param requirementDef dmn-moddle information requirement definition
	 * */
	export function InformationRequirement(requirementDef: any, context: Context): void;
	export class InformationRequirement {
		/**
		 * DMN information requirement — edge in the DRG from a decision to a required
		 * decision or required input data
		 * @param requirementDef dmn-moddle information requirement definition
		 * */
		constructor(requirementDef: any, context: Context);
		
		id: string;
		
		type: string;
		behaviour: any;
		context: Context;
		required: any;
	}
	/**
	 * DMN knowledge requirement — edge in the DRG from a decision or business knowledge
	 * model to a required business knowledge model
	 * @param requirementDef dmn-moddle knowledge requirement definition
	 * */
	export function KnowledgeRequirement(requirementDef: any, context: Context): void;
	export class KnowledgeRequirement {
		/**
		 * DMN knowledge requirement — edge in the DRG from a decision or business knowledge
		 * model to a required business knowledge model
		 * @param requirementDef dmn-moddle knowledge requirement definition
		 * */
		constructor(requirementDef: any, context: Context);
		
		id: string;
		
		type: string;
		behaviour: any;
		context: Context;
		required: any;
	}
	/**
	 * DMN authority requirement — documentation-only edge to a knowledge source,
	 * no evaluation semantics
	 * @param requirementDef dmn-moddle authority requirement definition
	 * */
	export function AuthorityRequirement(requirementDef: any, context: Context): void;
	export class AuthorityRequirement {
		/**
		 * DMN authority requirement — documentation-only edge to a knowledge source,
		 * no evaluation semantics
		 * @param requirementDef dmn-moddle authority requirement definition
		 * */
		constructor(requirementDef: any, context: Context);
		
		id: string;
		
		type: string;
		behaviour: any;
		context: Context;
		required: any;
	}

	export {};
}

declare module 'dmn-elements/errors' {
	/**
	 * Base error for dmn-elements
	 */
	export class DmnError extends Error {
		/**
		 * @param source element that raised the error
		 * @param options passed to Error, e.g. `cause`
		 */
		constructor(description: string, source?: {
			id?: string;
			type?: string;
		}, options?: ErrorOptions);
		source: {
			id: string | undefined;
			type: string | undefined;
		} | undefined;
	}
	/**
	 * Raised when evaluating a decision fails, e.g. a FEEL error or a violated hit policy
	 */
	export class DecisionError extends DmnError {
		/**
		 * @param cause original error, e.g. from feelin, chained as standard `cause`
		 */
		constructor(description: string, source?: {
			id?: string;
			type?: string;
		}, cause?: Error);
	}

	export {};
}

declare module 'dmn-elements/dmn-moddle' {
	/**
	 * Rewrite DMN 1.4/1.5 namespace URIs in DMN XML to the DMN 1.3 URIs the
	 * extended package is registered under
	 * @param source DMN XML
	 * @returns DMN XML with aligned namespaces
	 */
	export function alignDmnNamespaces(source: string | {
		toString(): string;
	}): string;
	/**
	 * dmn-moddle's DMN 1.3 package extended with the DMN 1.4 boxed expressions and
	 * the DMN 1.5 item definition typeConstraint.
	 * Pass as the `dmn` package to DmnModdle to replace the built-in one:
	 * `new DmnModdle({ dmn })`
	 * */
	export const dmn: PackageDefinition;
	export type PackageDefinition = import("moddle").PackageDefinition;
	export type TypeDefinition = import("moddle").TypeDefinition;

	export {};
}

//# sourceMappingURL=index.d.ts.map