// @ts-check
import { Context, Environment, InformationRequirement, KnowledgeRequirement, AuthorityRequirement } from 'dmn-elements';
import * as testHelpers from './helpers/testHelpers.js';

const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="drgDefinitions" name="DRG" namespace="https://example.com/dmn/drg">
  <inputData id="ageInput" name="Age">
    <variable id="ageVariable" name="Age" typeRef="number" />
  </inputData>
  <knowledgeSource id="policyManual" name="Policy manual" />
  <businessKnowledgeModel id="ageRules" name="Age rules" />
  <decision id="category" name="Category">
    <variable id="categoryVariable" name="Category" />
    <informationRequirement id="categoryRequiresAge">
      <requiredInput href="#ageInput" />
    </informationRequirement>
    <knowledgeRequirement id="categoryRequiresRules">
      <requiredKnowledge href="#ageRules" />
    </knowledgeRequirement>
    <authorityRequirement id="categoryRequiresManual">
      <requiredAuthority href="#policyManual" />
    </authorityRequirement>
    <literalExpression id="categoryExpression"><text>Age</text></literalExpression>
  </decision>
</definitions>`;

describe('Context', () => {
  /** @type {Context} */
  let context;
  before('a context from a DRG source with all element kinds', async () => {
    context = await testHelpers.context(source);
  });

  describe('ctor', () => {
    it('works without new', async () => {
      const definitions = await testHelpers.moddleContext(source);
      // @ts-ignore intentional call without new
      expect(Context(definitions)).to.be.instanceof(Context);
    });

    it('defaults environment', async () => {
      const definitions = await testHelpers.moddleContext(source);
      expect(new Context(definitions).environment).to.be.instanceof(Environment);
    });
  });

  describe('getElementById(id)', () => {
    it('mints a runtime element and caches it', () => {
      const element = /** @type {any} */ (context.getElementById('category'));
      expect(element, 'element').to.be.ok;
      expect(element.id).to.equal('category');
      expect(context.getElementById('category'), 'same instance').to.equal(element);
    });

    it('returns undefined for unknown id', () => {
      expect(context.getElementById('unknown')).to.be.undefined;
    });

    it('a knowledge source evaluates without result', (done) => {
      /** @type {any} */ (context.getElementById('policyManual')).evaluate(
        { input: {} },
        (/** @type {any} */ err, /** @type {any} */ result) => {
          if (err) return done(err);
          expect(result).to.be.undefined;
          done();
        }
      );
    });

    it('a business knowledge model without logic errors on evaluate', (done) => {
      /** @type {any} */ (context.getElementById('ageRules')).evaluate({ input: {} }, (/** @type {any} */ err) => {
        expect(err).to.match(/no encapsulated logic/);
        done();
      });
    });
  });

  describe('getRequirements(drgElementDef)', () => {
    it('resolves requirement hrefs of all kinds', () => {
      const requirements = context.getRequirements(context.getDecisionById('category'));
      expect(requirements.map((/** @type {any} */ required) => required.id)).to.deep.equal(['ageInput', 'ageRules']);
    });

    it('is empty for an element without requirements', () => {
      const inputData = context.getDrgElementById('ageInput');
      expect(context.getRequirements(inputData)).to.deep.equal([]);
    });
  });

  describe('clone()', () => {
    it('shares definitions, replaces environment when passed', () => {
      const newEnvironment = new Environment();
      const clone = context.clone(newEnvironment);
      expect(clone, 'new context').to.not.equal(context);
      expect(clone.definitions, 'same definitions').to.equal(context.definitions);
      expect(clone.environment, 'new environment').to.equal(newEnvironment);
      expect(context.clone().environment, 'kept environment').to.equal(context.environment);
    });
  });
});

describe('requirements', () => {
  /** @type {any} */
  let decisionDef;
  before('a parsed decision with all requirement kinds', async () => {
    const definitions = await testHelpers.moddleContext(source);
    decisionDef = definitions.drgElement.find((/** @type {any} */ e) => e.id === 'category');
  });

  it('InformationRequirement holds the required input reference', () => {
    const requirement = new InformationRequirement(decisionDef.informationRequirement[0], /** @type {any} */ (null));
    expect(requirement.type).to.equal('dmn:InformationRequirement');
    expect(requirement.required.href).to.equal('#ageInput');
  });

  it('KnowledgeRequirement holds the required knowledge reference', () => {
    const requirement = new KnowledgeRequirement(decisionDef.knowledgeRequirement[0], /** @type {any} */ (null));
    expect(requirement.type).to.equal('dmn:KnowledgeRequirement');
    expect(requirement.required.href).to.equal('#ageRules');
  });

  it('AuthorityRequirement holds the required authority reference', () => {
    const requirement = new AuthorityRequirement(decisionDef.authorityRequirement[0], /** @type {any} */ (null));
    expect(requirement.type).to.equal('dmn:AuthorityRequirement');
    expect(requirement.required.href).to.equal('#policyManual');
  });

  describe('imports', () => {
    it('an imported item definition reference throws before loadImports is awaited', async () => {
      const importedContext = await testHelpers.context(testHelpers.resource('shipment.dmn'), {
        settings: {
          async resolveImport() {
            return await testHelpers.moddleContext(testHelpers.resource('logistics-types.dmn'));
          },
        },
      });

      expect(() => importedContext.getItemDefinitionByName('logistics.tParcel')).to.throw(/is not loaded, await loadImports/);

      await importedContext.loadImports();
      expect(importedContext.getItemDefinitionByName('logistics.tParcel')).to.have.property('name', 'tParcel');
    });
  });
});
