declare module 'dmn-elements' {
	/**
	 * Per-evaluation element registry and lazy factory.
	 *
	 * Consumes a dmn-moddle definitions tree directly — there is no serializer step as in
	 * bpmn-elements, since stateless evaluation never needs to round-trip run state.
	 * The host parses XML with dmn-moddle and passes the root `dmn:Definitions` element.
	 * @param definitions dmn-moddle definitions (root element from `DmnModdle#fromXML`)
	 * 
	 */
	export function Context(definitions: any, environment?: Environment): Context;
	export class Context {
		/**
		 * Per-evaluation element registry and lazy factory.
		 *
		 * Consumes a dmn-moddle definitions tree directly — there is no serializer step as in
		 * bpmn-elements, since stateless evaluation never needs to round-trip run state.
		 * The host parses XML with dmn-moddle and passes the root `dmn:Definitions` element.
		 * @param definitions dmn-moddle definitions (root element from `DmnModdle#fromXML`)
		 * 
		 */
		constructor(definitions: any, environment?: Environment);
		definitions: any;
		id: any;
		name: any;
		type: any;
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
		 * Clone context, e.g. to evaluate with a new environment
		 * 
		 */
		clone(newEnvironment?: Environment): any;
	}
	/**
	 * Shared evaluation environment: variables, services, settings, and the FEEL engine.
	 *
	 * Mirrors bpmn-elements Environment, minus scripts and timers — DMN evaluation is
	 * expression-only and has no waiting semantics.
	 * 
	 */
	export function Environment(options?: EnvironmentOptions): Environment;
	export class Environment {
		/**
		 * Shared evaluation environment: variables, services, settings, and the FEEL engine.
		 *
		 * Mirrors bpmn-elements Environment, minus scripts and timers — DMN evaluation is
		 * expression-only and has no waiting semantics.
		 * 
		 */
		constructor(options?: EnvironmentOptions);
		/** @type {Record<string, any>} unlisted constructor options */
		options: Record<string, any>;
		
		expressions: IExpressions;
		
		extensions: Record<string, Function> | undefined;
		
		output: Record<string, any>;
		
		settings: Record<string, any>;
		
		Logger: (scope: string) => ILogger;
		getState(): {
			settings: {
				[x: string]: any;
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
		 * Clone environment, sharing expressions and services, resetting output
		 * @param overrideOptions take precedence over current
		 * */
		clone(overrideOptions?: EnvironmentOptions): Environment;
		/** @param newVars merged over current variables */
		assignVariables(newVars: Record<string, any>): void;
		/** @param newSettings merged over current settings */
		assignSettings(newSettings: Record<string, any>): this;
		
		getServiceByName(name: string): Function | undefined;
		
		addService(name: string, fn: Function): void;
		/**
		 * Evaluate a FEEL expression with environment variables as base context
		 * @param context merged over environment variables
		 */
		resolveExpression(expression: string, context?: Record<string, any>): any;
		/**
		 * Evaluate a FEEL unary tests expression with environment variables as base context
		 * @param context merged over environment variables, tested value on key `?`
		 */
		unaryTest(test: string, context?: Record<string, any>): boolean;
		[kServices]: Record<string, (...args: any[]) => void>;
		[kVariables]: Record<string, any>;
	}
	const kServices: unique symbol;
	const kVariables: unique symbol;
	/**
	 * FEEL expression engine backed by feelin.
	 *
	 * Pluggable via Environment option `expressions`. A replacement must implement
	 * `resolveExpression(expression, context)` and `unaryTest(test, context)`.
	 */
	export function Expressions(): Expressions;
	export class Expressions {
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
		id: any;
		name: any;
		type: any;
		/**
		 * Evaluate a decision and, recursively, its required decisions.
		 *
		 * Evaluation is stateless and completes in one callback chain — DMN has no waiting
		 * semantics. The callback shape exists to allow async host services at element
		 * boundaries, not to persist or resume runs.
		 * 
		 */
		evaluate(decisionId: string, callback: (err: Error | null, result?: any) => void): void;
		/**
		 * Evaluate a decision and, recursively, its required decisions.
		 *
		 * Evaluation is stateless and completes in one callback chain — DMN has no waiting
		 * semantics. The callback shape exists to allow async host services at element
		 * boundaries, not to persist or resume runs.
		 * 
		 */
		evaluate(decisionId: string, input?: Record<string, any> | undefined): Promise<any>;
		/**
		 * Evaluate a decision and, recursively, its required decisions.
		 *
		 * Evaluation is stateless and completes in one callback chain — DMN has no waiting
		 * semantics. The callback shape exists to allow async host services at element
		 * boundaries, not to persist or resume runs.
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
	 * Generic DRG element wrapper — the activity/Activity.js analogue.
	 *
	 * Element factories pair this wrapper with an element-specific Behaviour that
	 * implements `execute(executeMessage, callback)`.
	 * @param Behaviour element behaviour constructor
	 * @param elementDef dmn-moddle element definition
	 * */
	export function DrgElement(Behaviour: Function, elementDef: any, context: Context): void;
	export class DrgElement {
		/**
		 * Generic DRG element wrapper — the activity/Activity.js analogue.
		 *
		 * Element factories pair this wrapper with an element-specific Behaviour that
		 * implements `execute(executeMessage, callback)`.
		 * @param Behaviour element behaviour constructor
		 * @param elementDef dmn-moddle element definition
		 * */
		constructor(Behaviour: Function, elementDef: any, context: Context);
		id: any;
		type: any;
		name: any;
		behaviour: any;
		Behaviour: Function;
		context: Context;
		environment: Environment | undefined;
		logger: ILogger;
		/**
		 * Evaluate element — mints a Behaviour instance and executes it
		 * @param executeMessage requirements output and evaluation input
		 * */
		evaluate(executeMessage: any, callback: (err: Error | null, result?: any) => void): any;
	}
	/**
	 * Coerce a value to its declared typeRef.
	 *
	 * Handles FEEL type names and Camunda Modeler's Java-ish aliases (integer, long,
	 * double). Temporal strings are converted through the environment's expression
	 * engine (date, time, date and time, duration). Unknown typeRefs, e.g. item
	 * definition references, pass the value through untouched, as do null and undefined.
	 * @param typeRef declared type, e.g. on a variable, input expression, output, or formal parameter
	 * @param element owning element, for FEEL access and error source
	 * @returns the coerced value
	 * @throws {DecisionError} when the value cannot be coerced
	 */
	export function coerceTypeRef(value: any, typeRef: string | undefined, element: {
		id?: string;
		type?: string;
		environment: Environment;
	}): any;
	/**
	 * Base error for dmn-elements
	 */
	export class DmnError extends Error {
		/**
		 * @param source element that raised the error
		 */
		constructor(description: string, source?: {
			id?: string;
			type?: string;
		});
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
		 * @param inner original error, e.g. from feelin
		 */
		constructor(description: string, source?: {
			id?: string;
			type?: string;
		}, inner?: Error);
		inner: Error | undefined;
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

  interface EnvironmentOptions {
	expressions?: IExpressions;
	extensions?: Record<string, (element: any, context: any) => any>;
	Logger?: (scope: string) => ILogger;
	output?: Record<string, any>;
	services?: Record<string, (...args: any[]) => void>;
	settings?: Record<string, any>;
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
	 * DMN decision element — dispatches to its decision logic (decision table,
	 * literal expression) when evaluated
	 * @param decisionDef dmn-moddle decision definition
	 * */
	export function Decision(decisionDef: any, context: Context): DrgElement;

	export function DecisionBehaviour(element: DrgElement): void;
	export class DecisionBehaviour {
		
		constructor(element: DrgElement);
		id: any;
		type: any;
		element: DrgElement;
		decisionLogic: any;
		execute(executeMessage: any, callback: any): any;
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
		id: any;
		type: any;
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
		id: any;
		type: any;
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
		 * Default output entries apply when no rule matched
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
		id: any;
		type: any;
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
	 * DMN input data element — supplies a named input value from the evaluation input
	 * @param inputDataDef dmn-moddle input data definition
	 * */
	export function InputData(inputDataDef: any, context: Context): DrgElement;

	export function InputDataBehaviour(element: DrgElement): void;
	export class InputDataBehaviour {
		
		constructor(element: DrgElement);
		id: any;
		type: any;
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
		id: any;
		type: any;
		element: DrgElement;
		encapsulatedLogic: any;
		/**
		 * Evaluates to the FEEL-invocable function. The function scope is closed per the DMN
		 * spec: formal parameters (positional arguments — feelin does not support named
		 * arguments for host functions) and required knowledge only, never the caller's
		 * evaluation input.
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
		id: any;
		type: any;
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
		id: any;
		type: any;
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
		id: any;
		type: any;
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
		id: any;
		type: any;
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
		 */
		constructor(description: string, source?: {
			id?: string;
			type?: string;
		});
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
		 * @param inner original error, e.g. from feelin
		 */
		constructor(description: string, source?: {
			id?: string;
			type?: string;
		}, inner?: Error);
		inner: Error | undefined;
	}

	export {};
}

//# sourceMappingURL=index.d.ts.map