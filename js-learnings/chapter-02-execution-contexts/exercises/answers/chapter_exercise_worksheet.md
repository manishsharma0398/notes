# Chapter 2 Worksheet — Execution Context Lifecycle Tracing

Trace each program before running it. Fill in the blanks below.

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

1. List all ECs created and their types.
   Answer:
   add() = Fnction Execution Context , GEC

2. At `// << SNAPSHOT`, draw the call stack (top to bottom).
   Answer:
   add()
   GEC

3. For `add`'s EC, what is in its Variable Environment and Lexical Environment at the creation phase?
   Answer: Varaible Environment - x = 1, y = 2, sum = undefined. Variable Environment sum = undefined, Variable Environment is just a reference to vars in Lexical Environment in modern JS according to ECMA script specs.

4. Final output: \***\*\_\_\_\*\***
   Answer: 3

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

  console.log(x, z); // << SNAPSHOT B
  // console.log(y); // what would happen if you uncommented this?
}

run();
```

1. How many ECs are created? List them.
   Answer: GEC() , run()

2. Does entering the `{}` block create a new EC? What does it create instead?
   Answer: No {} block doesn't cretae a new EC, instead it creates a new Lexical Environment with outer reference to run().

3. At SNAPSHOT A: what is accessible? From which environment?
   Answer: x and z from run(), y from {}.

4. At SNAPSHOT B: what changed in the Lexical Environment?
   Answer: the run's Lexical Environment Context points back to run's ER, the run's ER was never replaced , it was changed to know which/what is being executed currently.

5. What error type would `console.log(y)` throw, and why?
   Answer: Reference Error: y is not defined

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

1. How many ECs are pushed before SNAPSHOT? List them in order.
   Answer: GEC() -> first() -> second() -> third()

2. Draw the outer reference chain for `third`'s EC.
   Answer: [[Outer]] = second() Lexical Environment -> first() Lexical Environment -> Global's Lexical Environment -> null

3. What does `console.log(level)` print and why?
   Answer:second

4. Now: if you **remove** `var level = "second"` from `second()`, what changes in the trace? What does the log print?
   Answer: JS Engine tries to find level in third() LE, it doesn't find their using scope chain it searches on second() LE and again it checks on first() LE it finds there.log prints "first"

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

1. How many ECs exist when `results[0]()` is called?
   Answer: 2 - GEC(), capture()

2. Where does `i` live (which environment record)?
   Answer: Global

3. Explain precisely why all three functions return the same value.
   Answer: since var is function scoped so, var gets added to Global's ER and after the for loop completes the i's value is set 3. so when the do console.logs through scope chain they access the variable i from Global ER. so, every console logs 3

4. If `var i` were changed to `let i`, how many environment records would `i` appear in?
   Answer: as let is block scoped so every loop iteration a fresh i is created, so i appears in 3 environmnet record with i values set to 0,1,2 respectively

---

## Program 5 — Reading `Error.stack`

```javascript
function c() {
  throw new Error("boom");
}
function b() {
  c();
}
function a() {
  b();
}

try {
  a();
} catch (err) {
  console.log(err.stack);
}
```

1. At the moment the error is thrown, what is the call stack?
   Answer:
   c()
   b()
   a()
   GEC

2. As the error propagates through b → a → global, what happens to each EC?
   Answer: the EC is destroyed handling the control to its calling or parent function.

3. `err.stack` is a string. What information does it expose about the EC history?
   Answer: it prints the call stack at that time when error is thrown c() -> b() -> a() -> GEC()

4. After the `catch` block runs, how many ECs remain?
   Answer: only GEC remain at that very moment
