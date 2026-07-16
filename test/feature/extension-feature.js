// @ts-check
import * as testHelpers from '../helpers/testHelpers.js';
import { decisionTableSource } from '../helpers/factory.js';
import { Definition, DecisionError } from 'dmn-elements';

/**
 * @param {string | Buffer} source DMN XML
 * @param {import('#types').EnvironmentOptions} [options] environment options
 */
async function getDefinition(source, options) {
  return new Definition(await testHelpers.context(source, options));
}

Feature('extensions', () => {
  Scenario('an extension decorating a version-tagged decision', () => {
    /**
     * Vendor decoration: pick up camunda:versionTag, stamp it on the trace entry,
     * and record the versioned result to environment output on completion
     * @param {any} element
     * @param {any} context
     */
    function camundaVersionTag(element, { environment }) {
      const versionTag = element.behaviour.$attrs?.['camunda:versionTag'];
      if (!versionTag) return;
      return {
        /** @param {any} executeMessage */
        activate(executeMessage) {
          if (executeMessage.trace) executeMessage.trace.versionTag = versionTag;
        },
        /** @param {any} completeMessage */
        deactivate(completeMessage) {
          environment.output[element.id] = { versionTag, result: completeMessage.result };
        },
      };
    }

    /** @type {Definition} */
    let definition;
    Given(
      'a definition from the premium resource where the decision carries a camunda version tag, and a version tag extension',
      async () => {
        definition = await getDefinition(testHelpers.resource('premium.dmn'), {
          extensions: { camunda: camundaVersionTag },
        });
      }
    );

    /** @type {any} */
    let traced;
    When('the premium is traced', async () => {
      traced = await definition.trace('premium', { Age: 40, Coverage: 100000 });
    });

    Then('the premium evaluated unaffected', () => {
      expect(traced.result).to.equal(3000);
    });

    And('the extension stamped the version tag on the decision trace entry', () => {
      const entry = traced.trace.find((/** @type {any} */ e) => e.id === 'premium');
      expect(entry.versionTag).to.equal('1.0.1');
    });

    And('the completed evaluation was recorded to environment output', () => {
      expect(definition.environment.output).to.deep.equal({ premium: { versionTag: '1.0.1', result: 3000 } });
    });

    And('only the tagged decision loaded extension hooks', () => {
      expect(definition.context.getElementById('premium')?.extensions?.count).to.equal(1);
      expect(definition.context.getElementById('ageInput')?.extensions).to.be.undefined;
    });
  });

  Scenario('an extension that only decorates elements when minted', () => {
    /** @type {string[]} */
    const minted = [];
    /** @param {any} element */
    function mintTracker(element) {
      minted.push(element.id);
    }

    /** @type {Definition} */
    let definition;
    Given('a definition from the premium resource, with a mint-tracking extension', async () => {
      definition = await getDefinition(testHelpers.resource('premium.dmn'), { extensions: { mintTracker } });
    });

    /** @type {any} */
    let result;
    When('the premium is evaluated', async () => {
      result = await definition.evaluate('premium', { Age: 22, Coverage: 100000 });
    });

    Then('the walked DRG elements all passed through the extension, requirements first', () => {
      expect(result).to.equal(5000);
      expect(minted).to.deep.equal(['ageInput', 'coverageInput', 'premiumRate', 'premium']);
    });

    And('no hooks were attached', () => {
      expect(definition.context.getElementById('premium')?.extensions).to.be.undefined;
    });

    When('the premium is evaluated again', async () => {
      result = await definition.evaluate('premium', { Age: 40, Coverage: 100000 });
    });

    Then('elements minted once — the extension did not rerun', () => {
      expect(result).to.equal(3000);
      expect(minted).to.deep.equal(['ageInput', 'coverageInput', 'premiumRate', 'premium']);
    });
  });

  Scenario('an extension observing a failing evaluation', () => {
    const source = decisionTableSource({
      id: 'category',
      inputs: [{ text: 'Age' }],
      outputs: [{ name: 'category' }],
      rules: [
        { input: ['>= 18'], output: ['"adult"'] },
        { input: ['> 60'], output: ['"senior"'] },
      ],
    });

    /** @type {Record<string, Error>} */
    const failures = {};
    /** @type {string[]} */
    const activated = [];

    /** @param {any} element */
    function auditor(element) {
      return {
        /** @param {any} completeMessage */
        deactivate(completeMessage) {
          if (completeMessage.error) failures[element.id] = completeMessage.error;
        },
      };
    }
    /** @param {any} element */
    function marker(element) {
      return {
        activate() {
          activated.push(element.id);
        },
      };
    }

    /** @type {Definition} */
    let definition;
    Given('a UNIQUE decision table with overlapping rules, an auditing and a marking extension', async () => {
      definition = await getDefinition(source, { extensions: { auditor, marker } });
    });

    /** @type {any} */
    let error;
    When('the decision is evaluated where both rules match', async () => {
      error = await definition.evaluate('category', { Age: 65 }).catch((/** @type {Error} */ err) => err);
    });

    Then('the evaluation failed the hit policy', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/UNIQUE/);
    });

    And('the auditing extension observed the error on deactivate', () => {
      expect(failures.category).to.equal(error);
    });

    And('the marking extension activated without a deactivate hook of its own', () => {
      expect(activated).to.deep.equal(['category']);
      expect(definition.context.getElementById('category')?.extensions?.count).to.equal(2);
    });
  });
});
