# Chapter Exercise — Hoisting Tracing

## Problem Statement

For each program below, **do not run the code first**. For each one:

1. Mentally run the **creation phase**: list every binding registered, in the order the engine would register them, and its initial value (`undefined`, full function object, or `<TDZ>`).
2. Predict the exact output (or the exact error type and message) for every marked line.
3. Answer the follow-up question.
4. Only after writing your answers, run the file to check yourself.

---

## Program 1 — Creation Phase Ordering

```javascript
console.log(a);          // << LINE A
console.log(typeof b);   // << LINE B
console.log(typeof f);   // << LINE C

var a = 1;
let b = 2;

function f() {
  return "f called";
}
```

**Trace:**

1. List the Global Environment Record's bindings and initial values *before* line A executes.
2. Predicted output for LINE A: `__________`
3. Predicted output for LINE B: `__________`
4. Predicted output for LINE C: `__________`
5. Why does LINE A succeed (with a value) while LINE B throws, even though both `a` and `b` are declared after their respective log lines?

---

## Program 2 — Function Declaration vs. `var` Collision

```javascript
console.log(typeof mode);  // << LINE A

var mode = "manual";

function mode() {
  return "auto";
}

console.log(typeof mode);  // << LINE B

mode = 42;

console.log(typeof mode);  // << LINE C
```

**Trace:**

1. During the creation phase, which is registered first — the `var` or the `function`? Which one's value "wins" by the time creation phase finishes, and why?
2. Predicted output: LINE A `__________`, LINE B `__________`, LINE C `__________`
3. Explain, in terms of creation-phase order vs. execution-phase order, why the three lines produce three different results.

---

## Program 3 — TDZ and `typeof`

```javascript
function check() {
  console.log(typeof neverDeclared); // << LINE A

  try {
    console.log(typeof inTdz);       // << LINE B
  } catch (e) {
    console.log(e.constructor.name); // << LINE C
  }

  let inTdz = "ready";
  console.log(typeof inTdz);          // << LINE D
}

check();
```

**Trace:**

1. Predicted output: LINE A `__________`
2. Does LINE B print anything, or does control jump to the catch block? Predicted value of LINE C: `__________`
3. Predicted output: LINE D `__________`
4. Explain precisely why `typeof neverDeclared` and `typeof inTdz` (before its declaration) behave differently, even though both are "not yet available" in some sense.

---

## Program 4 — Function Expression Hoisting

```javascript
function runBoth() {
  try {
    alpha();
  } catch (e) {
    console.log("alpha:", e.constructor.name);
  }

  try {
    beta();
  } catch (e) {
    console.log("beta:", e.constructor.name);
  }

  var alpha = function () {
    console.log("alpha called");
  };

  let beta = function () {
    console.log("beta called");
  };
}

runBoth();
```

**Trace:**

1. What creation-phase binding exists for `alpha` before its declaration line? What about `beta`?
2. Predicted error type for the `alpha()` call: `__________`. For the `beta()` call: `__________`.
3. Why are the two error types different, given that both `alpha` and `beta` are "function expressions assigned to a variable"?

---

## Program 5 — Block-Scoped Function Declarations (Annex B)

```javascript
// This file does NOT have "use strict"

console.log(typeof helper); // << LINE A

if (true) {
  console.log(typeof helper); // << LINE B

  function helper() {
    return "helping";
  }
}

console.log(typeof helper); // << LINE C
```

**Trace:**

1. Predicted output: LINE A `__________`, LINE B `__________`, LINE C `__________`
2. At LINE A, has the Annex B "copy to outer binding" step happened yet? Why or why not?
3. If this file had `"use strict"` at the top, which of the three lines would change, and to what?

---

## What to Verify

- [ ] You wrote out the creation-phase binding table (name → initial value) before predicting any output
- [ ] You correctly distinguished `TypeError` (var, calling `undefined`) from `ReferenceError` (let/const/class, TDZ) in every relevant program
- [ ] Program 2: you can explain the two-step process — creation-phase overwrite (function beats var) then execution-phase reassignment (last assignment wins)
- [ ] Program 3: you can explain why `typeof` is unsafe on TDZ bindings but safe on genuinely undeclared names
- [ ] Program 5: you can explain what Annex B does, when it applies (sloppy mode only), and why it's not something to design around

---

## Hints

<details>
<summary>Hint for Program 1</summary>
Build the table first: `a` → creation phase → `undefined`. `b` → creation phase → `<TDZ>`. `f` → creation phase → the full function object. Only then reason about what each `console.log` sees.
</details>

<details>
<summary>Hint for Program 2</summary>
Creation phase processes `var mode` first (→ `undefined`), then the function declaration `function mode(){}` overwrites it (→ function object). That's the state before ANY line of the script body runs. Execution phase then just runs top to bottom like normal code — the `var mode = "manual"` line is a plain assignment at that point, and `mode = 42` is another plain assignment later.
</details>

<details>
<summary>Hint for Program 3</summary>
`typeof neverDeclared` — no binding exists anywhere for that name, so `typeof` safely returns `"undefined"`. `typeof inTdz` — a binding for `inTdz` DOES exist (registered in creation phase), but it's uninitialized. `typeof` still has to evaluate its operand, and evaluating a TDZ binding throws — `typeof` cannot "peek" at an uninitialized binding safely.
</details>

<details>
<summary>Hint for Program 4</summary>
`alpha` is a `var` → creation phase gives it `undefined` → calling `undefined()` is a `TypeError`. `beta` is a `let` → creation phase leaves it in TDZ → accessing it at all (including calling it) is a `ReferenceError`.
</details>

<details>
<summary>Hint for Program 5</summary>
Inside the block, `helper` is fully hoisted and usable from the top of the block (like a block-scoped declaration). The Annex B copy to the outer `var`-style binding only happens once execution actually reaches and runs the block — so before the `if` runs, the outer `helper` exists but is still `undefined`. In strict mode, this copying step is disabled entirely, and the function stays block-scoped only.
</details>
