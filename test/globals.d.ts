/**
 * Test globals: mocha-cakes-2 BDD vocabulary and chai's registered expect
 * (see test/helpers/setup.js).
 */

type SuiteFn = (title: string, fn: () => void) => void;
type StepFn = (title: string, fn?: (done: (err?: Error) => void) => void | Promise<void>) => void;

declare global {
  const Feature: SuiteFn;
  const Scenario: SuiteFn;
  const Given: StepFn;
  const When: StepFn;
  const Then: StepFn;
  const And: StepFn;
  const But: StepFn;
  const beforeEachScenario: (fn: () => void | Promise<void>) => void;
  const afterEachScenario: (fn: () => void | Promise<void>) => void;
  const expect: Chai.ExpectStatic;
}

export {};
