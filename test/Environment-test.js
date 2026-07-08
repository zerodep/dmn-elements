// @ts-check
import { Environment, Expressions } from 'dmn-elements';

describe('Environment', () => {
  describe('ctor', () => {
    it('works without new', () => {
      // @ts-ignore intentional call without new
      expect(Environment()).to.be.instanceof(Environment);
    });

    it('keeps unlisted options', () => {
      const environment = new Environment({ myOption: 1, settings: { strict: true } });
      expect(environment.options).to.deep.equal({ myOption: 1 });
      expect(environment.settings).to.deep.equal({ strict: true });
    });

    it('throws if expressions lack the expected functions', () => {
      expect(() => new Environment({ expressions: /** @type {any} */ ({}) })).to.throw(/resolveExpression/);
    });

    it('throws if extensions is not an object', () => {
      expect(() => new Environment({ extensions: /** @type {any} */ ('nope') })).to.throw(/object/);
    });

    it('throws if an extension is not a function', () => {
      expect(() => new Environment({ extensions: /** @type {any} */ ({ myExt: 'nope' }) })).to.throw(/myExt/);
    });

    it('accepts extensions as an object of functions', () => {
      const environment = new Environment({ extensions: { myExt() {} } });
      expect(environment.extensions).to.have.property('myExt');
    });

    it('default logger is callable and silent', () => {
      const logger = new Environment().Logger('test-scope');
      logger.debug('hush');
      logger.error('hush');
      logger.warn('hush');
    });
  });

  describe('getState() and recover()', () => {
    it('getState returns copies of settings, variables, and output', () => {
      const environment = new Environment({ settings: { strict: true }, variables: { amount: 1 } });
      const state = environment.getState();
      expect(state).to.deep.equal({ settings: { strict: true }, variables: { amount: 1 }, output: {} });

      state.variables.amount = 2;
      expect(environment.variables.amount).to.equal(1);
    });

    it('recover merges state over current', () => {
      const environment = new Environment({ variables: { amount: 1, kept: true } });
      environment.recover({ variables: { amount: 2 }, settings: { strict: true }, output: { done: 1 } });

      expect(environment.variables).to.deep.equal({ amount: 2, kept: true });
      expect(environment.settings).to.deep.equal({ strict: true });
      expect(environment.output).to.deep.equal({ done: 1 });
    });

    it('recover without state is a noop returning the environment', () => {
      const environment = new Environment({ variables: { amount: 1 } });
      expect(environment.recover()).to.equal(environment);
      expect(environment.variables).to.deep.equal({ amount: 1 });
    });
  });

  describe('clone()', () => {
    it('clones variables and settings, resets output', () => {
      const environment = new Environment({ settings: { strict: true }, variables: { amount: 1 } });
      environment.output.done = 1;

      const clone = environment.clone();
      expect(clone.variables).to.deep.equal({ amount: 1 });
      expect(clone.settings).to.deep.equal({ strict: true });
      expect(clone.output).to.deep.equal({});

      clone.assignVariables({ amount: 2 });
      expect(environment.variables.amount).to.equal(1);
    });

    it('override options take precedence', () => {
      const environment = new Environment({ variables: { amount: 1 } });
      const clone = environment.clone({ variables: { amount: 2 } });
      expect(clone.variables).to.deep.equal({ amount: 2 });
    });

    it('merges override services with existing', () => {
      const environment = new Environment({ services: { keep() {} } });
      const clone = environment.clone({ services: { added() {} } });
      expect(clone.getServiceByName('keep'), 'kept service').to.be.a('function');
      expect(clone.getServiceByName('added'), 'added service').to.be.a('function');
    });

    it('shares the expressions instance', () => {
      const expressions = new Expressions();
      const environment = new Environment({ expressions });
      expect(environment.clone().expressions).to.equal(expressions);
    });
  });

  describe('services', () => {
    it('addService and getServiceByName round trip', () => {
      const environment = new Environment();
      const service = () => {};
      environment.addService('myService', service);
      expect(environment.getServiceByName('myService')).to.equal(service);
      expect(environment.getServiceByName('unknown')).to.be.undefined;
    });

    it('services setter prunes removed and assigns new', () => {
      const environment = new Environment({ services: { removed() {}, kept() {} } });
      const services = environment.services;
      environment.services = { kept() {}, added() {} };

      expect(environment.services, 'same services object').to.equal(services);
      expect(environment.getServiceByName('removed'), 'removed').to.be.undefined;
      expect(environment.getServiceByName('kept'), 'kept').to.be.a('function');
      expect(environment.getServiceByName('added'), 'added').to.be.a('function');
    });
  });

  describe('assignVariables() and assignSettings()', () => {
    it('assignVariables merges and ignores non-objects', () => {
      const environment = new Environment({ variables: { amount: 1 } });
      environment.assignVariables({ threshold: 2 });
      environment.assignVariables(/** @type {any} */ ('nope'));
      expect(environment.variables).to.deep.equal({ amount: 1, threshold: 2 });
    });

    it('assignSettings merges, returns the environment, and ignores non-objects', () => {
      const environment = new Environment({ settings: { strict: true } });
      expect(environment.assignSettings({ enableTrace: true })).to.equal(environment);
      expect(environment.assignSettings(/** @type {any} */ (null))).to.equal(environment);
      expect(environment.settings).to.deep.equal({ strict: true, enableTrace: true });
    });
  });
});

describe('Expressions', () => {
  it('works without new', () => {
    // @ts-ignore intentional call without new
    expect(Expressions()).to.be.instanceof(Expressions);
  });
});
