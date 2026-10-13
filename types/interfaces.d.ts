export interface IExpressions {
  resolveExpression(expression: string, context?: Record<string, any>): any;
  unaryTest(test: string, context?: Record<string, any>): boolean;
}

export interface ILogger {
  debug(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
}

export interface IExtension {
  /** runs before each evaluation of the element, with the execute message */
  activate?(executeMessage: any): void;
  /** runs after each evaluation completes, with the execute message plus `result` or `error` */
  deactivate?(completeMessage: any): void;
}

/**
 * Called when a DRG element is minted — decorate the element, and optionally
 * return hooks that run around each evaluation
 */
export type ExtensionFactory = (element: any, context: any) => IExtension | void;

/** engine settings on `environment.settings` — see docs/API.md Settings */
export interface EnvironmentSettings {
  /** coerce and validate decision results against the decision variable typeRef, and invocable results against their declared function item output type */
  validateResult?: boolean;
  /** coercion per typeRef (exact match), consulted before builtin types and item definitions — the override owns its validation */
  types?: Record<string, (value: any, typeRef: string, element: { id?: string; type?: string; environment: any; context?: any }) => any>;
  /** parsed definitions of an imported model, or a promise thereof — the host parses */
  resolveImport?: (importDef: { name: string; namespace: string; locationURI?: string; importType?: string; [x: string]: any }) => any;
  [x: string]: any;
}

export interface EnvironmentOptions {
  expressions?: IExpressions;
  extensions?: Record<string, ExtensionFactory>;
  Logger?: (scope: string) => ILogger;
  output?: Record<string, any>;
  services?: Record<string, (...args: any[]) => any>;
  settings?: EnvironmentSettings;
  variables?: Record<string, any>;
  [x: string]: any;
}

// Getters defined with Object.defineProperties are opaque to tsc declaration emit —
// augment them onto the generated class (same approach as bpmn-elements).
declare module 'dmn-elements' {
  interface Environment {
    readonly variables: Record<string, any>;
    services: Record<string, Function>;
  }
}
