# Chapter Exercise — Execution Context Lifecycle Tracing

## Problem Statement

You will manually trace the **execution context lifecycle** for a series of JavaScript programs. For each program:

1. List every EC created (in order), with its type (Global / Function).
2. For each EC, state what is in its **Variable Environment** and **Lexical Environment** at the end of the creation phase.
3. Trace the **call stack state** at the point marked `// << SNAPSHOT`.
4. State the final output.

Do **not** run the code first. Write your trace in a separate file (`trace-answers.md`), then verify by running the programs.

---

## Program 1 — Baseline

```javascript
var a = 1;
let b = 2;

function add(x, y) {
  var sum = x + y;
  return sum;
}

var result = add(a, b); // << SNAPSHOT (take snapshot INSIDE add, before return)
console.log(result);
```

**Trace:**
1. List all ECs created and their types.
2. At `// << SNAPSHOT`, draw the call stack (top to bottom).
3. For `add`'s EC, what is in its Variable Environment and Lexical Environment at the creation phase?
4. Final output: ___________

---

## Program 2 — Block Scope Boundary

```javascript
function run() {
  var x = "function-scoped";

  {
    let y = "block-scoped";
    var z = "also-function-scoped";
    console.log(x, y, z); // << SNAPSHOT A
  }

  console.log(x, z);      // << SNAPSHOT B
  // console.log(y);       // what would happen if you uncommented this?
}

run();
```

**Trace:**
1. How many ECs are created? List them.
2. Does entering the `{}` block create a new EC? What does it create instead?
3. At SNAPSHOT A: what is accessible? From which environment?
4. At SNAPSHOT B: what changed in the Lexical Environment?
5. What error type would `console.log(y)` throw, and why?

---

## Program 3 — Outer Reference Chain

```javascript
var level = "global";

function first() {
  var level = "first";

  function second() {
    var level = "second";

    function third() {
      console.log(level); // << SNAPSHOT
    }

    third();
  }

  second();
}

first();
```

**Trace:**
1. How many ECs are pushed before SNAPSHOT? List them in order.
2. Draw the outer reference chain for `third`'s EC.
3. What does `console.log(level)` print and why?
4. Now: if you **remove** `var level = "second"` from `second()`, what changes in the trace? What does the log print?

---

## Program 4 — The var-in-loop Problem

```javascript
var results = [];

for (var i = 0; i < 3; i++) {
  results.push(function capture() {
    return i;
  });
}

console.log(results[0]()); // ?
console.log(results[1]()); // ?
console.log(results[2]()); // ?
```

**Trace:**
1. How many ECs exist when `results[0]()` is called?
2. Where does `i` live (which environment record)?
3. Explain precisely why all three functions return the same value.
4. If `var i` were changed to `let i`, how many environment records would `i` appear in?

---

## Program 5 — Reading `Error.stack`

```javascript
function c() {
  throw new Error("boom");
}
function b() { c(); }
function a() { b(); }

try {
  a();
} catch (err) {
  console.log(err.stack);
}
```

**Trace:**
1. At the moment the error is thrown, what is the call stack?
2. As the error propagates through b → a → global, what happens to each EC?
3. `err.stack` is a string. What information does it expose about the EC history?
4. After the `catch` block runs, how many ECs remain?

---

## Acceptance Criteria

- [ ] You traced Programs 1–5 **before** running them.
- [ ] Your trace correctly identifies every EC created (no extras, no missed ones).
- [ ] You correctly distinguished which identifiers live in Variable Environment vs Lexical Environment.
- [ ] You can explain from memory why `var` inside a block leaks out.
- [ ] You can explain from memory why all 3 functions in Program 4 return the same value.
- [ ] For Program 3: you correctly updated your trace after removing the `var level = "second"` line.

---

## Hints

<details>
<summary>Hint for Program 1</summary>
`add(a, b)` passes values, not references. What is `x` in add's EC — is it in the Variable Environment or Lexical Environment? Where do function parameters go?
</details>

<details>
<summary>Hint for Program 2</summary>
Count ECs carefully. The `{}` block does NOT create one. The key question is: after the block exits, what happens to the Environment Record for `y`?
</details>

<details>
<summary>Hint for Program 4</summary>
Ask: when `results[0]()` is called and creates a new EC for `capture`, where does `capture`'s outer reference point? Then ask: where does `i` live in that chain?
</details>

<details>
<summary>Hint for Program 5</summary>
What happens to an EC when an error propagates through it uncaught? Is the EC popped immediately, or does it wait for the error to be caught?
</details>
