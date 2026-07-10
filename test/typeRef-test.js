// @ts-check
import { coerceTypeRef, Environment, DecisionError } from 'dmn-elements';

describe('coerceTypeRef(value, typeRef, element)', () => {
  const element = { id: 'typed', type: 'dmn:InputData', environment: new Environment() };

  describe('numbers', () => {
    for (const typeRef of ['number', 'integer', 'long', 'double', 'decimal']) {
      it(`${typeRef} coerces a numeric string`, () => {
        expect(coerceTypeRef('12.5', typeRef, element)).to.equal(12.5);
      });
    }

    it('passes a number through', () => {
      expect(coerceTypeRef(42, 'number', element)).to.equal(42);
    });

    it('throws DecisionError on a non-numeric string', () => {
      expect(() => coerceTypeRef('many', 'number', element)).to.throw(DecisionError, /coerce/);
    });

    it('throws DecisionError on a boolean', () => {
      expect(() => coerceTypeRef(true, 'number', element)).to.throw(DecisionError, /coerce/);
    });
  });

  describe('strings', () => {
    it('passes a string through', () => {
      expect(coerceTypeRef('yes', 'string', element)).to.equal('yes');
    });

    it('coerces numbers and booleans', () => {
      expect(coerceTypeRef(42, 'string', element)).to.equal('42');
      expect(coerceTypeRef(false, 'string', element)).to.equal('false');
    });

    it('throws DecisionError on an object', () => {
      expect(() => coerceTypeRef({}, 'string', element)).to.throw(DecisionError, /coerce/);
    });
  });

  describe('booleans', () => {
    it('passes a boolean through', () => {
      expect(coerceTypeRef(true, 'boolean', element)).to.equal(true);
    });

    it('coerces "true" and "false"', () => {
      expect(coerceTypeRef('true', 'boolean', element)).to.equal(true);
      expect(coerceTypeRef('false', 'boolean', element)).to.equal(false);
    });

    it('throws DecisionError on anything else', () => {
      expect(() => coerceTypeRef('yes', 'boolean', element)).to.throw(DecisionError, /coerce/);
    });
  });

  describe('temporals', () => {
    it('date coerces an ISO string to a FEEL date', () => {
      const coerced = coerceTypeRef('2026-07-09', 'date', element);
      expect(coerced).to.be.an('object');
      expect(element.environment.resolveExpression('d >= date("2026-01-01")', { d: coerced })).to.be.true;
    });

    it('time coerces an ISO string', () => {
      expect(coerceTypeRef('12:30:00', 'time', element)).to.be.an('object');
    });

    it('dateTime and "date and time" coerce an ISO string', () => {
      expect(coerceTypeRef('2026-07-09T12:30:00', 'dateTime', element)).to.be.an('object');
      expect(coerceTypeRef('2026-07-09T12:30:00', 'date and time', element)).to.be.an('object');
    });

    it('duration flavors coerce ISO durations', () => {
      expect(coerceTypeRef('P1D', 'duration', element)).to.be.an('object');
      expect(coerceTypeRef('P1D', 'dayTimeDuration', element)).to.be.an('object');
      expect(coerceTypeRef('P1Y', 'yearMonthDuration', element)).to.be.an('object');
      expect(coerceTypeRef('P1Y2M', 'years and months duration', element)).to.be.an('object');
    });

    it('passes an already coerced temporal through', () => {
      const temporal = element.environment.resolveExpression('date("2026-07-09")');
      expect(coerceTypeRef(temporal, 'date', element)).to.equal(temporal);
    });

    it('throws DecisionError on a string that is no date', () => {
      expect(() => coerceTypeRef('someday', 'date', element)).to.throw(DecisionError, /coerce/);
    });
  });

  describe('singleton list conversion', () => {
    it('a singleton list coerces to a scalar type through its element', () => {
      expect(coerceTypeRef(['John'], 'string', element)).to.equal('John');
      expect(coerceTypeRef(['42'], 'number', element)).to.equal(42);
    });

    it('a longer list still fails scalar coercion', () => {
      expect(() => coerceTypeRef(['John', 'Jane'], 'string', element)).to.throw(DecisionError, /coerce/);
    });
  });

  describe('pass through', () => {
    it('null, undefined, and missing typeRef pass through', () => {
      expect(coerceTypeRef(null, 'number', element)).to.be.null;
      expect(coerceTypeRef(undefined, 'number', element)).to.be.undefined;
      expect(coerceTypeRef('42', undefined, element)).to.equal('42');
    });

    it('unknown typeRefs, e.g. item definitions, pass through', () => {
      const order = { total: 1 };
      expect(coerceTypeRef(order, 'tOrder', element)).to.equal(order);
    });
  });

  describe('type overrides via settings', () => {
    /** @param {Record<string, (value: any, typeRef: string, element: any) => any>} types */
    function overriddenElement(types) {
      return { id: 'overridden', type: 'dmn:InputData', environment: new Environment({ settings: { types } }) };
    }

    it('an override coerces an unknown typeRef, e.g. an item definition', () => {
      const el = overriddenElement({ tScore: (value) => Number(String(value).replace(' pts', '')) });
      expect(coerceTypeRef('85 pts', 'tScore', el)).to.equal(85);
    });

    it('an override takes precedence over a builtin type', () => {
      const el = overriddenElement({ double: (value) => Math.round(Number(value)) });
      expect(coerceTypeRef('12.4', 'double', el)).to.equal(12);
    });

    it('the override is called with value, typeRef, and the owning element', () => {
      /** @type {any[]} */
      let args = [];
      const el = overriddenElement({
        tOrder(...overrideArgs) {
          args = overrideArgs;
          return 'handled';
        },
      });
      expect(coerceTypeRef('rush', 'tOrder', el)).to.equal('handled');
      expect(args).to.deep.equal(['rush', 'tOrder', el]);
    });

    it('typeRef match is exact — no alias normalization', () => {
      const el = overriddenElement({ tOrder: () => 'handled' });
      expect(coerceTypeRef('rush', 'TORDER', el)).to.equal('rush');
    });

    it('null and undefined pass through without consulting the override', () => {
      let called = false;
      const el = overriddenElement({
        tOrder() {
          called = true;
        },
      });
      expect(coerceTypeRef(null, 'tOrder', el)).to.be.null;
      expect(coerceTypeRef(undefined, 'tOrder', el)).to.be.undefined;
      expect(called).to.be.false;
    });

    it('an error thrown by the override propagates', () => {
      const el = overriddenElement({
        tOrder() {
          throw new DecisionError('no such order type', el);
        },
      });
      expect(() => coerceTypeRef('rush', 'tOrder', el)).to.throw(DecisionError, /no such order type/);
    });
  });
});
