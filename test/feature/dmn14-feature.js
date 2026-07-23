// @ts-check
import * as testHelpers from '../helpers/testHelpers.js';
import { Definition, DecisionError } from 'dmn-elements';

/**
 * @param {string | Buffer} source DMN XML
 * @param {import('#types').EnvironmentOptions} [options] environment options
 */
async function getDefinition(source, options) {
  return new Definition(await testHelpers.context(source, options));
}

Feature('DMN 1.4 boxed expressions', () => {
  Scenario('a monitoring DRG combining conditional, filter, and iterators', () => {
    /** @type {Definition} */
    let definition;
    Given('a definition from the DMN 1.5 monitoring resource', async () => {
      definition = await getDefinition(testHelpers.resource('monitoring.dmn'));
    });

    /** @type {any} */
    let result;
    When('the status is evaluated with a critical reading', async () => {
      result = await definition.evaluate('status', { Readings: [95, 210, 150] });
    });

    Then('the conditional took the then branch on the some-quantified requirement', () => {
      expect(result).to.equal('alert');
    });

    When('the status is evaluated with nominal readings only', async () => {
      result = await definition.evaluate('status', { Readings: [95, 150] });
    });

    Then('the conditional took the else branch', () => {
      expect(result).to.equal('normal');
    });

    When('the high readings are evaluated', async () => {
      result = await definition.evaluate('highReadings', { Readings: [95, 210, 150] });
    });

    Then('the filter kept the matching readings', () => {
      expect(result).to.deep.equal([210, 150]);
    });

    When('the calibrated readings are evaluated', async () => {
      result = await definition.evaluate('calibrated', { Readings: [95, 210, 150] });
    });

    Then('the for iteration mapped every reading', () => {
      expect(result).to.deep.equal([93, 208, 148]);
    });

    When('all-nominal is evaluated with a critical reading', async () => {
      result = await definition.evaluate('allNominal', { Readings: [95, 210] });
    });

    Then('the every quantifier reports false', () => {
      expect(result).to.equal(false);
    });

    When('all-nominal is evaluated with nominal readings only', async () => {
      result = await definition.evaluate('allNominal', { Readings: [95, 150] });
    });

    Then('the every quantifier reports true', () => {
      expect(result).to.equal(true);
    });

    /** @type {any} */
    let traced;
    When('the status is traced', async () => {
      traced = await definition.trace('status', { Readings: [95, 210, 150] });
    });

    Then('the trace declares the conditional and quantified decision logic', () => {
      expect(traced.result).to.equal('alert');
      expect(traced.trace.find((/** @type {any} */ e) => e.id === 'status').decisionLogic).to.equal('dmn:Conditional');
      expect(traced.trace.find((/** @type {any} */ e) => e.id === 'hasCritical').decisionLogic).to.equal('dmn:Some');
    });
  });

  Scenario('a for iteration referencing partial results', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="runningDefinitions" name="Running total" namespace="https://example.com/dmn/running-total">
  <decision id="runningTotal" name="Running total">
    <variable id="runningTotalVariable" name="RunningTotal" />
    <for id="runningTotalFor" iteratorVariable="element">
      <in id="runningTotalIn"><literalExpression id="runningTotalInExpression"><text>[1,2,3]</text></literalExpression></in>
      <return id="runningTotalReturn"><literalExpression id="runningTotalReturnExpression"><text>if partial = [] then element else element + partial[-1]</text></literalExpression></return>
    </for>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where the return expression accumulates over partial', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the decision is evaluated', async () => {
      result = await definition.evaluate('runningTotal', {});
    });

    Then('each element saw the results so far', () => {
      expect(result).to.deep.equal([1, 3, 6]);
    });
  });

  Scenario('a filter over context elements', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="pricedDefinitions" name="Priced" namespace="https://example.com/dmn/priced">
  <decision id="priced" name="Priced">
    <variable id="pricedVariable" name="Priced" />
    <filter id="pricedFilter">
      <in id="pricedIn"><literalExpression id="pricedInExpression"><text>[{item: "socks", price: 5}, {item: "shoes", price: 90}]</text></literalExpression></in>
      <match id="pricedMatch"><literalExpression id="pricedMatchExpression"><text>price > Limit and item.price = price</text></literalExpression></match>
    </filter>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where the match reads entries, the item variable, and evaluation input', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the decision is evaluated', async () => {
      result = await definition.evaluate('priced', { Limit: 50 });
    });

    Then('the context entries were in scope alongside item and the input', () => {
      expect(result).to.deep.equal([{ item: 'shoes', price: 90 }]);
    });
  });

  Scenario('quantifiers over an empty list', () => {
    const source = (/** @type {string} */ kind, /** @type {string} */ id) => `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="${id}Definitions" name="${id}" namespace="https://example.com/dmn/${id}">
  <decision id="${id}" name="${id}">
    <variable id="${id}Variable" name="${id}" />
    <${kind} id="${id}Quantifier" iteratorVariable="element">
      <in id="${id}In"><literalExpression id="${id}InExpression"><text>[]</text></literalExpression></in>
      <satisfies id="${id}Satisfies"><literalExpression id="${id}SatisfiesExpression"><text>element > 0</text></literalExpression></satisfies>
    </${kind}>
  </decision>
</definitions>`;

    /** @type {any} */
    let result;
    When('a some quantifier over an empty list is evaluated', async () => {
      const definition = await getDefinition(source('some', 'someEmpty'));
      result = await definition.evaluate('someEmpty', {});
    });

    Then('some reports false', () => {
      expect(result).to.equal(false);
    });

    When('an every quantifier over an empty list is evaluated', async () => {
      const definition = await getDefinition(source('every', 'everyEmpty'));
      result = await definition.evaluate('everyEmpty', {});
    });

    Then('every reports true', () => {
      expect(result).to.equal(true);
    });
  });

  Scenario('a business knowledge model with conditional body', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="assessDefinitions" name="Assess" namespace="https://example.com/dmn/assess">
  <businessKnowledgeModel id="assess" name="Assess">
    <variable id="assessVariable" name="Assess" />
    <encapsulatedLogic id="assessLogic">
      <formalParameter id="scoreParameter" name="score" typeRef="number" />
      <conditional id="assessConditional">
        <if id="assessIf"><literalExpression id="assessIfExpression"><text>score >= 50</text></literalExpression></if>
        <then id="assessThen"><literalExpression id="assessThenExpression"><text>"pass"</text></literalExpression></then>
        <else id="assessElse"><literalExpression id="assessElseExpression"><text>"fail"</text></literalExpression></else>
      </conditional>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <decision id="verdict" name="Verdict">
    <variable id="verdictVariable" name="Verdict" />
    <knowledgeRequirement id="verdictRequiresAssess">
      <requiredKnowledge href="#assess" />
    </knowledgeRequirement>
    <literalExpression id="verdictExpression"><text>Assess(Score)</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where the function body is a conditional', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the decision invokes the function with a passing score', async () => {
      result = await definition.evaluate('verdict', { Score: 75 });
    });

    Then('the conditional body selected the then branch', () => {
      expect(result).to.equal('pass');
    });

    When('the decision invokes the function with a failing score', async () => {
      result = await definition.evaluate('verdict', { Score: 25 });
    });

    Then('the conditional body selected the else branch', () => {
      expect(result).to.equal('fail');
    });
  });

  Scenario('business knowledge models with filter and iterator bodies', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="statsDefinitions" name="Stats" namespace="https://example.com/dmn/stats">
  <businessKnowledgeModel id="highs" name="Highs">
    <variable id="highsVariable" name="Highs" />
    <encapsulatedLogic id="highsLogic">
      <formalParameter id="highsValues" name="values" />
      <filter id="highsFilter">
        <in id="highsIn"><literalExpression id="highsInE"><text>values</text></literalExpression></in>
        <match id="highsMatch"><literalExpression id="highsMatchE"><text>item &gt;= 100</text></literalExpression></match>
      </filter>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <businessKnowledgeModel id="doubled" name="Doubled">
    <variable id="doubledVariable" name="Doubled" />
    <encapsulatedLogic id="doubledLogic">
      <formalParameter id="doubledValues" name="values" />
      <for id="doubledFor" iteratorVariable="value">
        <in id="doubledIn"><literalExpression id="doubledInE"><text>values</text></literalExpression></in>
        <return id="doubledReturn"><literalExpression id="doubledReturnE"><text>value * 2</text></literalExpression></return>
      </for>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <businessKnowledgeModel id="anyHigh" name="AnyHigh">
    <variable id="anyHighVariable" name="AnyHigh" />
    <encapsulatedLogic id="anyHighLogic">
      <formalParameter id="anyHighValues" name="values" />
      <some id="anyHighSome" iteratorVariable="value">
        <in id="anyHighIn"><literalExpression id="anyHighInE"><text>values</text></literalExpression></in>
        <satisfies id="anyHighSatisfies"><literalExpression id="anyHighSatisfiesE"><text>value &gt;= 100</text></literalExpression></satisfies>
      </some>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <businessKnowledgeModel id="allHigh" name="AllHigh">
    <variable id="allHighVariable" name="AllHigh" />
    <encapsulatedLogic id="allHighLogic">
      <formalParameter id="allHighValues" name="values" />
      <every id="allHighEvery" iteratorVariable="value">
        <in id="allHighIn"><literalExpression id="allHighInE"><text>values</text></literalExpression></in>
        <satisfies id="allHighSatisfies"><literalExpression id="allHighSatisfiesE"><text>value &gt;= 100</text></literalExpression></satisfies>
      </every>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <decision id="report" name="Report">
    <variable id="reportVariable" name="Report" />
    <knowledgeRequirement id="reportRequiresHighs"><requiredKnowledge href="#highs" /></knowledgeRequirement>
    <knowledgeRequirement id="reportRequiresDoubled"><requiredKnowledge href="#doubled" /></knowledgeRequirement>
    <knowledgeRequirement id="reportRequiresAnyHigh"><requiredKnowledge href="#anyHigh" /></knowledgeRequirement>
    <knowledgeRequirement id="reportRequiresAllHigh"><requiredKnowledge href="#allHigh" /></knowledgeRequirement>
    <literalExpression id="reportExpression"><text>{highs: Highs(Values), doubled: Doubled(Values), any: AnyHigh(Values), all: AllHigh(Values)}</text></literalExpression>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source with filter, for, some, and every function bodies', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the decision invokes all four functions', async () => {
      result = await definition.evaluate('report', { Values: [5, 150] });
    });

    Then('each body kind evaluated over the argument list', () => {
      expect(result).to.deep.equal({ highs: [150], doubled: [10, 300], any: true, all: false });
    });
  });

  Scenario('boxed expressions nested as context entries', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="summaryDefinitions" name="Summary" namespace="https://example.com/dmn/summary">
  <decision id="summary" name="Summary">
    <variable id="summaryVariable" name="Summary" />
    <context id="summaryContext">
      <contextEntry id="overdueEntry">
        <variable id="overdueVariable" name="overdue" />
        <filter id="overdueFilter">
          <in id="overdueIn"><literalExpression id="overdueInExpression"><text>Invoices</text></literalExpression></in>
          <match id="overdueMatch"><literalExpression id="overdueMatchExpression"><text>item > 30</text></literalExpression></match>
        </filter>
      </contextEntry>
      <contextEntry id="resultEntry">
        <conditional id="resultConditional">
          <if id="resultIf"><literalExpression id="resultIfExpression"><text>count(overdue) = 0</text></literalExpression></if>
          <then id="resultThen"><literalExpression id="resultThenExpression"><text>"all current"</text></literalExpression></then>
          <else id="resultElse"><literalExpression id="resultElseExpression"><text>"chase " + string(count(overdue))</text></literalExpression></else>
        </conditional>
      </contextEntry>
    </context>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where context entries hold a filter and a conditional', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the decision is evaluated with overdue invoices', async () => {
      result = await definition.evaluate('summary', { Invoices: [12, 45, 60] });
    });

    Then('the final result entry conditional saw the filtered entry', () => {
      expect(result).to.equal('chase 2');
    });
  });

  Scenario('iterators nested as list elements', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="nestedIteratorsDefinitions" name="Nested iterators" namespace="https://example.com/dmn/nested-iterators">
  <decision id="nestedIterators" name="Nested iterators">
    <variable id="nestedIteratorsVariable" name="NestedIterators" />
    <list id="nestedIteratorsList">
      <for id="nestedFor" iteratorVariable="element">
        <in id="nestedForIn"><literalExpression id="nestedForInE"><text>[1,2]</text></literalExpression></in>
        <return id="nestedForReturn"><literalExpression id="nestedForReturnE"><text>element * 2</text></literalExpression></return>
      </for>
      <some id="nestedSome" iteratorVariable="element">
        <in id="nestedSomeIn"><literalExpression id="nestedSomeInE"><text>[1,2]</text></literalExpression></in>
        <satisfies id="nestedSomeSatisfies"><literalExpression id="nestedSomeSatisfiesE"><text>element = 2</text></literalExpression></satisfies>
      </some>
      <every id="nestedEvery" iteratorVariable="element">
        <in id="nestedEveryIn"><literalExpression id="nestedEveryInE"><text>[1,2]</text></literalExpression></in>
        <satisfies id="nestedEverySatisfies"><literalExpression id="nestedEverySatisfiesE"><text>element = 2</text></literalExpression></satisfies>
      </every>
    </list>
  </decision>
</definitions>`;

    /** @type {Definition} */
    let definition;
    Given('a definition from an inline source where list elements are a for, a some, and an every', async () => {
      definition = await getDefinition(source);
    });

    /** @type {any} */
    let result;
    When('the decision is evaluated', async () => {
      result = await definition.evaluate('nestedIterators', {});
    });

    Then('every nested iterator produced its boxed result', () => {
      expect(result).to.deep.equal([[2, 4], true, false]);
    });
  });

  Scenario('non-conforming boxed expression evaluations', () => {
    const decisionSource = (/** @type {string} */ id, /** @type {string} */ logic) => `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="${id}Definitions" name="${id}" namespace="https://example.com/dmn/${id}">
  <decision id="${id}" name="${id}">
    <variable id="${id}Variable" name="${id}" />
    ${logic}
  </decision>
</definitions>`;

    /** @param {string} id @param {string} logic */
    async function evaluateError(id, logic) {
      const definition = await getDefinition(decisionSource(id, logic));
      return definition.evaluate(id, {}).catch((/** @type {Error} */ err) => err);
    }

    /** @type {any} */
    let error;
    When('a conditional if entry evaluates to a non-boolean', async () => {
      error = await evaluateError(
        'stringIf',
        `<conditional id="c">
          <if id="cIf"><literalExpression id="cIfE"><text>"abc"</text></literalExpression></if>
          <then id="cThen"><literalExpression id="cThenE"><text>1</text></literalExpression></then>
          <else id="cElse"><literalExpression id="cElseE"><text>2</text></literalExpression></else>
        </conditional>`
      );
    });

    Then('a decision error points out the non-boolean if entry', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/if entry must evaluate to a boolean/);
    });

    When('a conditional without else takes the else branch', async () => {
      error = await evaluateError(
        'noElse',
        `<conditional id="n">
          <if id="nIf"><literalExpression id="nIfE"><text>false</text></literalExpression></if>
          <then id="nThen"><literalExpression id="nThenE"><text>1</text></literalExpression></then>
        </conditional>`
      );
    });

    Then('a decision error points out the missing else expression', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/has no else expression/);
    });

    When('a filter in entry evaluates to a non-list', async () => {
      error = await evaluateError(
        'scalarIn',
        `<filter id="f">
          <in id="fIn"><literalExpression id="fInE"><text>"not a list"</text></literalExpression></in>
          <match id="fMatch"><literalExpression id="fMatchE"><text>true</text></literalExpression></match>
        </filter>`
      );
    });

    Then('a decision error points out the non-list in entry', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/in entry must evaluate to a list/);
    });

    When('a filter match entry evaluates to a non-boolean', async () => {
      error = await evaluateError(
        'stringMatch',
        `<filter id="m">
          <in id="mIn"><literalExpression id="mInE"><text>[1,2]</text></literalExpression></in>
          <match id="mMatch"><literalExpression id="mMatchE"><text>"not a boolean"</text></literalExpression></match>
        </filter>`
      );
    });

    Then('a decision error points out the non-boolean match entry', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/match entry must evaluate to a boolean/);
    });

    When('a filter has no match expression', async () => {
      error = await evaluateError(
        'noMatch',
        `<filter id="e">
          <in id="eIn"><literalExpression id="eInE"><text>[]</text></literalExpression></in>
        </filter>`
      );
    });

    Then('a decision error points out the missing match expression', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/has no match expression/);
    });

    When('a for iteration has no iterator variable', async () => {
      error = await evaluateError(
        'noVariable',
        `<for id="v">
          <in id="vIn"><literalExpression id="vInE"><text>[1]</text></literalExpression></in>
          <return id="vReturn"><literalExpression id="vReturnE"><text>1</text></literalExpression></return>
        </for>`
      );
    });

    Then('a decision error points out the missing iterator variable', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/has no iterator variable/);
    });

    When('a for iteration has no return expression', async () => {
      error = await evaluateError(
        'noReturn',
        `<for id="r" iteratorVariable="element">
          <in id="rIn"><literalExpression id="rInE"><text>[1]</text></literalExpression></in>
        </for>`
      );
    });

    Then('a decision error points out the missing return expression', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/has no return expression/);
    });

    When('a for in entry evaluates to a non-list', async () => {
      error = await evaluateError(
        'forScalarIn',
        `<for id="s" iteratorVariable="element">
          <in id="sIn"><literalExpression id="sInE"><text>1</text></literalExpression></in>
          <return id="sReturn"><literalExpression id="sReturnE"><text>element</text></literalExpression></return>
        </for>`
      );
    });

    Then('a decision error points out the non-list in entry', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/in entry must evaluate to a list/);
    });

    When('a some satisfies entry evaluates to a non-boolean', async () => {
      error = await evaluateError(
        'stringSatisfies',
        `<some id="q" iteratorVariable="element">
          <in id="qIn"><literalExpression id="qInE"><text>[1,2]</text></literalExpression></in>
          <satisfies id="qSatisfies"><literalExpression id="qSatisfiesE"><text>if element = 2 then true else "not a boolean"</text></literalExpression></satisfies>
        </some>`
      );
    });

    Then('a decision error points out the non-boolean satisfies entry before the satisfying element', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/satisfies entry must evaluate to a boolean/);
    });

    When('an every quantifier has no satisfies expression', async () => {
      error = await evaluateError(
        'noSatisfies',
        `<every id="w" iteratorVariable="element">
          <in id="wIn"><literalExpression id="wInE"><text>[1]</text></literalExpression></in>
        </every>`
      );
    });

    Then('a decision error points out the missing satisfies expression', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/has no satisfies expression/);
    });

    When('an every quantifier has no iterator variable', async () => {
      error = await evaluateError(
        'everyNoVariable',
        `<every id="y">
          <in id="yIn"><literalExpression id="yInE"><text>[1]</text></literalExpression></in>
          <satisfies id="ySatisfies"><literalExpression id="ySatisfiesE"><text>true</text></literalExpression></satisfies>
        </every>`
      );
    });

    Then('a decision error points out the missing iterator variable', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/has no iterator variable/);
    });

    When('a conditional if entry holds an unsupported expression type', async () => {
      error = await evaluateError(
        'oddIf',
        `<conditional id="o">
          <if id="oIf"><unaryTests id="oTests" /></if>
          <then id="oThen"><literalExpression id="oThenE"><text>1</text></literalExpression></then>
          <else id="oElse"><literalExpression id="oElseE"><text>2</text></literalExpression></else>
        </conditional>`
      );
    });

    Then('a decision error points out the unsupported if expression', () => {
      expect(error).to.be.instanceof(DecisionError);
      expect(error.message).to.match(/unsupported if expression dmn:UnaryTests/);
    });
  });
});
