export interface IExpressions {
  resolveExpression(expression: string, context?: Record<string, any>): any;
  unaryTest(test: string, context?: Record<string, any>): boolean;
}

export interface ILogger {
  debug(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
}

export interface EnvironmentOptions {
  expressions?: IExpressions;
  extensions?: Record<string, (element: any, context: any) => any>;
  Logger?: (scope: string) => ILogger;
  output?: Record<string, any>;
  services?: Record<string, (...args: any[]) => void>;
  settings?: Record<string, any>;
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
