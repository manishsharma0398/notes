# Chapter 3 Worksheet — Lexical Scope & Scope Chain Tracing

Trace each program before running it. Fill in the blanks below.

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

1. Draw the scope chain at `// << SNAPSHOT`. List every ER in order (innermost → outermost) and which variable each one holds.
   Answer: inner's() [[Outer]] -> middle() LE -> outer() LE -> Global LE -> null
   inner() ER:
   d
   middle() ER:
   c
   outer() ER:
   b
   Global ER:
   a

2. For each variable printed (`a`, `b`, `c`, `d`), state which ER it is found in.
   Answer: a=Global's, b=outer's, c=middle's, d=inner's

3. Predicted output: `__________`
   Answer: alpha beta gamma delta

4. If you removed `var d = "delta"` from `inner`, what would happen when `console.log` tries to access `d`?
   Answer: Reference Error: d is not defined

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

1. At SNAPSHOT A: which `status` does `report()` see, and why?
   Answer: running because scope is determined at creation time and not by calling time, At creation report Outer reference pointed to system's LE.

2. At SNAPSHOT B: which `status` is logged?
   Answer: running

3. At SNAPSHOT C: which `status` is logged?
   Answer: idle

4. Why does the call to `report()` from inside `override()` NOT see `override`'s `status`?
   Answer: because JS Lexical Scope is static type and not dynamic Type. report() Outer points to system() LE.

---

## Program 3 — `[[Environment]]` Independence

```javascript
function makeGreeter(greeting) {
  return function greet(name) {
    console.log(greeting + ", " + name + "!");
  };
}

var sayHello = makeGreeter("Hello");
var sayHi = makeGreeter("Hi");

sayHello("Alice");
sayHi("Bob");
sayHello("Charlie");
```

1. How many times is a new Function EC created for `makeGreeter` during this program's execution?
   Answer: 2 - sayHello and sayHi initialization

2. How many separate `greeting` bindings exist in memory after the three calls below are set up? Where do they live?
   Answer: 2 - inside closure's captured Environment Record

3. Predicted output (all three lines): `__________`
   Answer:
   Hello, Alice!
   Hi, Bob!
   Hello, Charlie!

4. Can `sayHi` ever access `sayHello`'s `greeting`? Why or why not?
   Answer: no. Each call to makeGreeter creates a separate greet function object with its own [[Environment]] slot, pointing to a different captured ER. There is no path sayHi can walk to ever reach sayHello's captured ER.

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

1. How many Environment Records exist at SNAPSHOT A? List them and what each holds.
   Answer: Global ER , process ER -> level="function", level1 block ER -> level="block-1", level2 block ER -> level="block-2"

2. At each snapshot, which `level` is printed?
   Answer: A -> level="block-2", B -> level="block-1", C -> level="function",

3. When the inner `{}` block exits, what happens to its ER?
   Answer: its Lexical Environment gets destroyed

4. `var level` is in `process()`'s VE. If you changed it to `let level`, would anything observable change? Explain why or why not.
   Answer: No, observable change to this program. changing from var to let will remove the var reference from Variable Environment to its Lexical Environment, both LE and VE point to same Environment Record.

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

1. What is the output?
   Answer: 3

2. Walk through the scope chain lookup for `config` at the assignment line. What happens when the engine reaches the end of the chain?
   Answer: In setup execution, JS tries to find config in setup ER it can't find there so it tries to find it in Global ER as in sloppy instead of throwing config is attached to Global ER

3. Is `config` now a variable or a property? What is the difference?
   Answer: config is a property of global object, retries is a propery of config.

4. What single change to the file would make this throw a `ReferenceError` instead?
   Answer: adding let or const before config = {retries:3}
