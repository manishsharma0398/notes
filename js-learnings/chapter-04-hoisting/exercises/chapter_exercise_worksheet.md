# Chapter 4 Worksheet — Hoisting Tracing

Trace each program before running it. Fill in the blanks below.

---

## Program 1 — Creation Phase Ordering

```javascript
console.log(a); // << LINE A
console.log(typeof b); // << LINE B
console.log(typeof f); // << LINE C

var a = 1;
let b = 2;

function f() {
  return "f called";
}
```

1. List the Global Environment Record's bindings and initial values _before_ line A executes.
   Answer:
   a = undefined (hoisted)
   b = no value (hoisted in Temporal Dead Zone, memory allocated but not initialized)
   f = function f whole reference

2. Predicted output for LINE A: `__________`
   Answer: undefined

3. Predicted output for LINE B: `__________`
   Answer: Reference Error: cannot be 'b' before initialization

4. Predicted output for LINE C: `__________`
   Answer: function

5. Why does LINE A succeed (with a value) while LINE B throws, even though both `a` and `b` are declared after their respective log lines?
   Answer: var gets initialized with undefined while let is not initialized at hoisting during the function's creation phase. Since, for b there is a binding existing but in Temporal Dead zone.

---

## Program 2 — Function Declaration vs. `var` Collision

```javascript
console.log(typeof mode); // << LINE A

var mode = "manual";

function mode() {
  return "auto";
}

console.log(typeof mode); // << LINE B

mode = 42;

console.log(typeof mode); // << LINE C
```

1. During the creation phase, which is registered first — the `var` or the `function`? Which one's value "wins" by the time creation phase finishes, and why?
   Answer: at creation var wins but at execution time function wins

2. Predicted output: LINE A `__________`, LINE B `__________`, LINE C `__________`
   Answer: undefined, function, function

3. Explain, in terms of creation-phase order vs. execution-phase order, why the three lines produce three different results.
   Answer:

---

## Program 3 — TDZ and `typeof`

```javascript
function check() {
  console.log(typeof neverDeclared); // << LINE A

  try {
    console.log(typeof inTdz); // << LINE B
  } catch (e) {
    console.log(e.constructor.name); // << LINE C
  }

  let inTdz = "ready";
  console.log(typeof inTdz); // << LINE D
}

check();
```

1. Predicted output: LINE A `__________`
   Answer: undefined

2. Does LINE B print anything, or does control jump to the catch block? Predicted value of LINE C: `__________`
   Answer: ReferenceError

3. Predicted output: LINE D `__________`
   Answer: string

4. Explain precisely why `typeof neverDeclared` and `typeof inTdz` (before its declaration) behave differently, even though both are "not yet available" in some sense.
   Answer: There is a subtle diffrence neverDeclared does not exist in check()'s ER bindings whereas inTdz has a binding whose value is not set anything yet i.e it is in Temporal Dead Zone Phase

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
   Answer: alpha -> undefined (hoisted as var declared), beta -> memory created, bindng exists but no value for it yet, hoisted in TDZ.

2. Predicted error type for the `alpha()` call: `__________`. For the `beta()` call: `__________`.
   Answer: alpha -> TypeError, beta -> ReferenceError

3. Why are the two error types different, given that both `alpha` and `beta` are "function expressions assigned to a variable"?
   Answer: yes, both are function expression but their variable identifieres are differnt - var and let. function expressions behaviour depends on the behaviur of the varibale identifier attached to them.

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
   Answer: undefined, function, function

2. At LINE A, has the Annex B "copy to outer binding" step happened yet? Why or why not?
   Answer: no, it has not happened yet. the execution has not entered the if block yet.

3. If this file had `"use strict"` at the top, which of the three lines would change, and to what?
   Answer: undefined, function, function -> undefined
