/**
 * Ambient declarations for untyped test dependencies.
 */

declare module 'dmn-moddle' {
  export class DmnModdle {
    constructor(packages?: Record<string, any>);
    fromXML(xml: string): Promise<{ rootElement: any; warnings: any[] }>;
  }
}
