# Chapter Exercise — Lexical Scope & Scope Chain Tracing

## Problem Statement

You will manually trace **scope chain lookups** for a series of JavaScript programs.
For each program, **do not run the code first**. Write your answers, then verify by running.

For each program:
1. Draw the scope chain (Environment Records linked by outer references)
2. Trace each identifier lookup: which ER is it found in?
3. Predict the output
4. Answer the specific follow-up question

---

## Program 1 — Basic Chain Walk

```javascript
var a = "alpha";

function outer() {
  var b = "beta";

  function middle() {
    var c = "gamma";

    function inner() {
      var d = "delta";
      console.log(a, b, c, d); // << SNAPSHOT
    }

    inner();
  }

  middle();
}

outer();
```

**Trace:**

1. Draw the scope chain at `// << SNAPSHOT`. List every ER in order (innermost → outermost) and which variable each one holds.
2. For each variable printed (`a`, `b`, `c`, `d`), state which ER it is found in.
3. Predicted output: `__________`
4. If you removed `var d = "delta"` from `inner`, what would happen when `console.log` tries to access `d`?

---

## Program 2 — Shadowing

```javascript
var status = "idle";

function system() {
  var status = "running";

  function report() {
    console.log(status); // << SNAPSHOT A
  }

  function override() {
    var status = "overridden";
    report(); // << call site
  }

  override();
  console.log(status); // << SNAPSHOT B
}

system();
console.log(status); // << SNAPSHOT C
```

**Trace:**

1. At SNAPSHOT A: which `status` does `report()` see, and why?
2. At SNAPSHOT B: which `status` is logged?
3. At SNAPSHOT C: which `status` is logged?
4. Why does the call to `report()` from inside `override()` NOT see `override`'s `status`?

---

## Program 3 — `[[Environment]]` Independence

```javascript
function makeGreeter(greeting) {
  return function greet(name) {
    console.log(greeting + ", " + name + "!");
  };
}

var sayHello = makeGreeter("Hello");
var sayHi    = makeGreeter("Hi");

sayHello("Alice");
sayHi("Bob");
sayHello("Charlie");
```

**Trace:**

1. How many times is a new Function EC created for `makeGreeter` during this program's execution?
2. How many separate `greeting` bindings exist in memory after the three calls below are set up? Where do they live?
3. Predicted output (all three lines): `__________`
4. Can `sayHi` ever access `sayHello`'s `greeting`? Why or why not?

---

## Program 4 — Block Scope Chain

```javascript
function process() {
  var level = "function";

  {
    let level = "block-1";

    {
      let level = "block-2";
      console.log(level); // << SNAPSHOT A
    }

    console.log(level); // << SNAPSHOT B
  }

  console.log(level); // << SNAPSHOT C
}

process();
```

**Trace:**

1. How many Environment Records exist at SNAPSHOT A? List them and what each holds.
2. At each snapshot, which `level` is printed?
3. When the inner `{}` block exits, what happens to its ER?
4. `var level` is in `process()`'s VE. If you changed it to `let level`, would anything observable change? Explain why or why not.

---

## Program 5 — Accidental Global (Sloppy Mode)

```javascript
// This file does NOT have "use strict"

function setup() {
  config = { retries: 3 }; // No var/let/const
}

setup();
console.log(config.retries); // ?
```

**Trace:**

1. What is the output?
2. Walk through the scope chain lookup for `config` at the assignment line. What happens when the engine reaches the end of the chain?
3. Is `config` now a variable or a property? What is the difference?
4. What single change to the file would make this throw a `ReferenceError` instead?

---

## What to Verify

- [ ] You drew scope chains before running any code
- [ ] You correctly identified which ER each identifier resolves to
- [ ] You predicted all outputs correctly
- [ ] Program 2: you can explain why call site does NOT affect scope lookup
- [ ] Program 3: you understand that two calls to `makeGreeter` create two separate ERs with independent `greeting` bindings
- [ ] Program 4: you can trace block ER creation and disposal
- [ ] Program 5: you can explain the accidental global mechanism and how strict mode prevents it

---

## Hints

<details>
<summary>Hint for Program 1</summary>
Draw the chain top-down: Global ER → outer's ER → middle's ER → inner's ER. For each variable, ask: "Is this name declared in the current ER?" If not, step up one level.
</details>

<details>
<summary>Hint for Program 2</summary>
`report`'s `[[Environment]]` is captured when `report` is *defined* — inside `system()`. It never includes `override()`'s ER, regardless of where `report` is called from.
</details>

<details>
<summary>Hint for Program 3</summary>
Each call to `makeGreeter` produces a *new* Function EC with a *new* ER. The returned function captures *that specific* ER. Two calls = two separate `greeting` bindings.
</details>

<details>
<summary>Hint for Program 4</summary>
Count ERs carefully at SNAPSHOT A: process's ER (for `var level`), block-1's ER (for first `let level`), block-2's ER (for second `let level`). That's 3 ERs inside the function, plus the Global ER.
</details>

<details>
<summary>Hint for Program 5</summary>
When the engine does a write lookup (`config = …`) and reaches the Global ER without finding `config`, in sloppy mode it creates a property on `globalThis` instead of throwing. The key distinction: `var config` would create a declarative binding in the Global ER; the accidental global creates an *object property* on `globalThis`.
</details>
