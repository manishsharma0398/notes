# Chapter 4 Worksheet — Hoisting Tracing

Trace each program before running it. Fill in the blanks below.

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

1. List the Global Environment Record's bindings and initial values *before* line A executes.
Answer:

2. Predicted output for LINE A: `__________`
Answer:

3. Predicted output for LINE B: `__________`
Answer:

4. Predicted output for LINE C: `__________`
Answer:

5. Why does LINE A succeed (with a value) while LINE B throws, even though both `a` and `b` are declared after their respective log lines?
Answer:

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

1. During the creation phase, which is registered first — the `var` or the `function`? Which one's value "wins" by the time creation phase finishes, and why?
Answer:

2. Predicted output: LINE A `__________`, LINE B `__________`, LINE C `__________`
Answer:

3. Explain, in terms of creation-phase order vs. execution-phase order, why the three lines produce three different results.
Answer:

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

1. Predicted output: LINE A `__________`
Answer:

2. Does LINE B print anything, or does control jump to the catch block? Predicted value of LINE C: `__________`
Answer:

3. Predicted output: LINE D `__________`
Answer:

4. Explain precisely why `typeof neverDeclared` and `typeof inTdz` (before its declaration) behave differently, even though both are "not yet available" in some sense.
Answer:

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

1. What creation-phase binding exists for `alpha` before its declaration line? What about `beta`?
Answer:

2. Predicted error type for the `alpha()` call: `__________`. For the `beta()` call: `__________`.
Answer:

3. Why are the two error types different, given that both `alpha` and `beta` are "function expressions assigned to a variable"?
Answer:

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

1. Predicted output: LINE A `__________`, LINE B `__________`, LINE C `__________`
Answer:

2. At LINE A, has the Annex B "copy to outer binding" step happened yet? Why or why not?
Answer:

3. If this file had `"use strict"` at the top, which of the three lines would change, and to what?
Answer:
