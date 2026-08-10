# Chapter 3 — Interview Questions: Lexical Scope & the Scope Chain

---

## Q1 — The "why does this work differently" question

```javascript
var x = "global";

function readX() {
  console.log(x);
}

function trap() {
  var x = "trap";
  readX();
}

trap();
```

**Question:** What does this print, and why? What would it print in a language with dynamic scope?

<details>
<summary>Expected answer</summary>

Prints `"global"`.

`readX` was **defined** at global scope, so its `[[Environment]]` points to the Global Environment Record. The `x` inside `trap` is in a completely separate ER that is not in `readX`'s scope chain.

In a dynamically scoped language, `readX` would print `"trap"` because it would walk the *call stack* to find `x`, finding `trap`'s `x` first.

JavaScript's choice of lexical scope means you can determine a function's behavior by reading its source alone — a fundamental property for reasoning, refactoring, and tooling.
</details>

---

## Q2 — The `[[Environment]]` trap

```javascript
function makeAdder(x) {
  return function add(y) {
    return x + y;
  };
}

var add5 = makeAdder(5);
var add10 = makeAdder(10);

console.log(add5(3));  // ?
console.log(add10(3)); // ?
```

**Question:** `add5` and `add10` are both the `add` function. Why do they produce different results?

<details>
<summary>Expected answer</summary>

`8` and `13`.

Each call to `makeAdder` creates a **new Function EC** with its own Environment Record, in which `x` is bound to the argument passed. When `add` is defined inside, it captures that specific ER as its `[[Environment]]`.

`add5.[[Environment]]` → makeAdder EC where x = 5  
`add10.[[Environment]]` → makeAdder EC where x = 10

They are **two different function objects** (returned by two separate calls), each with a distinct `[[Environment]]`. This is the foundation of closures.
</details>

---

## Q3 — Shadowing and `globalThis`

```javascript
var value = "global";

function test() {
  var value = "local";
  console.log(value);          // ?
  console.log(globalThis.value); // ?
}

test();
```

**Question:** What are the two outputs, and what does the second line tell you about `var` in the global scope?

<details>
<summary>Expected answer</summary>

- `console.log(value)` → `"local"` (inner `value` shadows outer)
- `console.log(globalThis.value)` → `"global"`

`var` declarations at the **top level of a script** (not a module) create properties on `globalThis`. This means the global `value` is simultaneously a variable in the Global ER *and* a property on the global object. This dual nature is why `var` at the top level is considered dangerous — it pollutes the global namespace as an enumerable object property.

`let` and `const` at the top level do NOT create properties on `globalThis` — they live only in the Global ER's declarative record.
</details>

---

## Q4 — Why doesn't JavaScript have dynamic scope?

**Question (open-ended):** If JavaScript used dynamic scope instead of lexical scope, what would break?

<details>
<summary>Expected answer (key points)</summary>

1. **Closures would not exist** in their current form — the value of captured variables would depend on the call site.
2. **Static analysis and tooling** (e.g., linters, bundlers, tree-shaking) rely on knowing variable references at parse time. Dynamic scope makes this impossible.
3. **Reasoning about code** would require tracing the full call graph rather than reading the source, making refactoring dangerous.
4. **Modules** depend on lexical scope to provide proper encapsulation — with dynamic scope, any caller could implicitly "inject" values into a module's scope.
5. **Optimization** is fundamentally harder — engines like V8 optimize variable access by knowing at compile time exactly which ER a variable lives in.
</details>

---

## Q5 — The "gotcha" question: scope chain is not the prototype chain

**Question:** What is the difference between the scope chain and the prototype chain? Can you give a scenario where confusing them causes a bug?

<details>
<summary>Expected answer</summary>

- **Scope chain**: Used for **identifier lookup** (variable names). Walks Environment Records linked by outer references. Determined lexically.
- **Prototype chain**: Used for **property lookup** on objects (`obj.prop`). Walks `[[Prototype]]` links from object to object.

**Confusion scenario:**

```javascript
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function() {
  console.log(name); // BUG: `name` is looked up via scope chain, not `this`
};

new Animal("Dog").speak(); // "" or ReferenceError, not "Dog"
```

The developer intended `this.name` (prototype chain property access) but wrote `name` (scope chain identifier lookup). The scope chain finds the global `name` (which in a browser is `window.name`, an empty string) — not the instance property.

The fix: `console.log(this.name)`.
</details>

---

## Q6 — Accidental globals and strict mode

```javascript
function configure() {
  timeout = 5000; // No declaration
}

configure();
console.log(timeout); // ?
```

**Question:** What does this print in sloppy mode? What happens in strict mode? Why does strict mode exist at all?

<details>
<summary>Expected answer</summary>

- **Sloppy mode**: prints `5000`. The engine walks the scope chain, finds no `timeout` declaration, reaches the global ER, doesn't find it there either, and then *creates* it as a property on `globalThis`. This is an accidental global.
- **Strict mode**: throws `ReferenceError: timeout is not defined` at the assignment — before any damage is done.

Strict mode was introduced in ES5 (2009) to fix a collection of design mistakes in the language that could not be changed without breaking backward compatibility. It is opt-in per-file or per-function to avoid breaking existing code. ES modules are always in strict mode automatically.
</details>
