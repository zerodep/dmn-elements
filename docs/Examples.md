# Examples

Runnable examples, verified with [texample](https://www.npmjs.com/package/texample) (`npm run test:md`).

## Evaluate a decision table

Parse DMN XML with dmn-moddle, wrap the definitions in a context, and evaluate a decision:

```javascript
import { DmnModdle } from 'dmn-moddle';
import { Context, Definition, Environment } from 'dmn-elements';

const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="dinnerDefinitions" name="Dinner" namespace="https://example.com/dmn/dinner">
  <inputData id="seasonInput" name="Season">
    <variable id="seasonVariable" name="Season" typeRef="string" />
  </inputData>
  <decision id="dish" name="Dish">
    <variable id="dishVariable" name="Dish" typeRef="string" />
    <informationRequirement id="dishRequiresSeason">
      <requiredInput href="#seasonInput" />
    </informationRequirement>
    <decisionTable id="dishTable" hitPolicy="UNIQUE">
      <input id="seasonTableInput" label="Season">
        <inputExpression id="seasonInputExpression" typeRef="string"><text>Season</text></inputExpression>
      </input>
      <output id="dishTableOutput" name="dish" typeRef="string" />
      <rule id="winterRule">
        <inputEntry id="winterEntry"><text>"Winter"</text></inputEntry>
        <outputEntry id="winterDish"><text>"Roast beef"</text></outputEntry>
      </rule>
      <rule id="summerRule">
        <inputEntry id="summerEntry"><text>"Summer"</text></inputEntry>
        <outputEntry id="summerDish"><text>"Light salad"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

const { rootElement } = await new DmnModdle().fromXML(source);
const definition = new Definition(new Context(rootElement, new Environment()));

console.log(await definition.evaluate('dish', { Season: 'Winter' }));
// Roast beef
```

## Invoke a business knowledge model

A knowledge requirement binds a business knowledge model as a FEEL function, named by the model, with positional arguments mapped to its formal parameters:

```javascript
import { DmnModdle } from 'dmn-moddle';
import { Context, Definition, Environment } from 'dmn-elements';

const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="discountDefinitions" name="Discount" namespace="https://example.com/dmn/discount">
  <businessKnowledgeModel id="applyDiscount" name="Apply discount">
    <variable id="applyDiscountVariable" name="Apply discount" />
    <encapsulatedLogic id="applyDiscountLogic" kind="FEEL">
      <formalParameter id="amountParameter" name="amount" typeRef="number" />
      <formalParameter id="rateParameter" name="rate" typeRef="number" />
      <literalExpression id="applyDiscountBody"><text>amount - amount * rate</text></literalExpression>
    </encapsulatedLogic>
  </businessKnowledgeModel>
  <decision id="price" name="Price">
    <variable id="priceVariable" name="Price" typeRef="number" />
    <knowledgeRequirement id="priceRequiresDiscount">
      <requiredKnowledge href="#applyDiscount" />
    </knowledgeRequirement>
    <literalExpression id="priceExpression"><text>Apply discount(Amount, 0.1)</text></literalExpression>
  </decision>
</definitions>`;

const { rootElement } = await new DmnModdle().fromXML(source);
const definition = new Definition(new Context(rootElement, new Environment()));

console.log(await definition.evaluate('price', { Amount: 100 }));
// 90
```

## Environment variables

Environment variables are the base FEEL context — evaluation input takes precedence. Variables can also be passed as overrides when constructing the definition:

```javascript
import { DmnModdle } from 'dmn-moddle';
import { Context, Definition, Environment } from 'dmn-elements';

const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="accessDefinitions" name="Access" namespace="https://example.com/dmn/access">
  <decision id="access" name="Access">
    <variable id="accessVariable" name="Access" typeRef="string" />
    <decisionTable id="accessTable">
      <input id="ageTableInput" label="Age">
        <inputExpression id="ageInputExpression" typeRef="number"><text>Age</text></inputExpression>
      </input>
      <output id="accessOutput" name="access" typeRef="string" />
      <rule id="grantedRule">
        <inputEntry id="grantedEntry"><text>&gt;= MinimumAge</text></inputEntry>
        <outputEntry id="grantedAccess"><text>"granted"</text></outputEntry>
      </rule>
      <rule id="deniedRule">
        <inputEntry id="deniedEntry"><text>&lt; MinimumAge</text></inputEntry>
        <outputEntry id="deniedAccess"><text>"denied"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

const { rootElement } = await new DmnModdle().fromXML(source);
const context = new Context(rootElement, new Environment({ variables: { MinimumAge: 18 } }));

const definition = new Definition(context);
console.log(await definition.evaluate('access', { Age: 20 }));
// granted

const strictDefinition = new Definition(context, { variables: { MinimumAge: 30 } });
console.log(await strictDefinition.evaluate('access', { Age: 20 }));
// denied
```

## Trace an evaluation

`trace` evaluates like `evaluate` but resolves with the result and the evaluation trace — evaluated elements in completion order, with requirement bindings and, for decision tables, hit policy and matched rules:

```javascript
import { DmnModdle } from 'dmn-moddle';
import { Context, Definition, Environment } from 'dmn-elements';

const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="dinnerDefinitions" name="Dinner" namespace="https://example.com/dmn/dinner">
  <inputData id="seasonInput" name="Season">
    <variable id="seasonVariable" name="Season" typeRef="string" />
  </inputData>
  <decision id="dish" name="Dish">
    <variable id="dishVariable" name="Dish" typeRef="string" />
    <informationRequirement id="dishRequiresSeason">
      <requiredInput href="#seasonInput" />
    </informationRequirement>
    <decisionTable id="dishTable" hitPolicy="UNIQUE">
      <input id="seasonTableInput" label="Season">
        <inputExpression id="seasonInputExpression" typeRef="string"><text>Season</text></inputExpression>
      </input>
      <output id="dishTableOutput" name="dish" typeRef="string" />
      <rule id="winterRule">
        <inputEntry id="winterEntry"><text>"Winter"</text></inputEntry>
        <outputEntry id="winterDish"><text>"Roast beef"</text></outputEntry>
      </rule>
      <rule id="summerRule">
        <inputEntry id="summerEntry"><text>"Summer"</text></inputEntry>
        <outputEntry id="summerDish"><text>"Light salad"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

const { rootElement } = await new DmnModdle().fromXML(source);
const definition = new Definition(new Context(rootElement, new Environment()));

const { result, trace } = await definition.trace('dish', { Season: 'Winter' });

console.log(result);
// Roast beef
console.log(JSON.stringify(trace, null, 2));
// [
//   {
//     "id": "dish",
//     "type": "dmn:Decision",
//     "name": "Dish",
//     "requirements": [
//       { "id": "dishRequiresSeason", "required": "seasonInput", "type": "dmn:InputData", "bound": "Season", "value": "Winter" }
//     ],
//     "decisionLogic": "dmn:DecisionTable",
//     "hitPolicy": "UNIQUE",
//     "matchedRules": ["winterRule"],
//     "result": "Roast beef"
//   }
// ]
```

## Node style callbacks

Evaluate takes a node style callback instead of returning a promise:

```javascript
import { DmnModdle } from 'dmn-moddle';
import { Context, Definition, Environment } from 'dmn-elements';

const source = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="greetingDefinitions" name="Greeting" namespace="https://example.com/dmn/greeting">
  <decision id="greeting" name="Greeting">
    <variable id="greetingVariable" name="Greeting" typeRef="string" />
    <literalExpression id="greetingExpression"><text>"Hello " + Name</text></literalExpression>
  </decision>
</definitions>`;

const { rootElement } = await new DmnModdle().fromXML(source);
const definition = new Definition(new Context(rootElement, new Environment()));

definition.evaluate('greeting', { Name: 'Pål' }, (err, result) => {
  if (err) throw err;
  console.log(result);
  // Hello Pål
});
```
