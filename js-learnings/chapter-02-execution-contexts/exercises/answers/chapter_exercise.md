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

1. GEC -> add FEC
2. add() (top), GEC(bottom)
3. Variable Environment - x, y and sum (parameters -x,y and variables - sum), Lexical Environment - VE + outer reference (GEC)
4. 3

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
  // console.log(y);       // what would happen if you uncommented this?
}

run();
```

**Trace:**

1. 2 - GEC, run FEC
2. No, it create a new Scope or Environmenta Record when {} is encountered
3. x and z (as z is a var) from run()'s scope, y from its own {} block scope
4. x and z (as z is a var) from run()'s scope, y cannot be accessed as it is out of {} ans not fall's under run's Lexical Environment
5. y is not defined because y is created inside the block {} not accessible outside the block

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

1. 4 - GEC, first EC, second EC, third EC
2. third -> second -> first -> global
3. "second" because second() function shadows/overwrites it
4. "first" becasue now instead of second() function first() function shadows/overwrites it

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

1. 2 - GEC (already exist), capture() EC
2. global
3. because var is a function or global scoped variable and when we print for the first time i value is already 3.
4. 3 separate block scoped ER

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

**Trace:**

1. GEC -> a() -> b() -> c()
2. each EC will be removed from the call stack and control will be handed over to its parent i.e caller function
3. it's return the whole call stack chain at that time
4. 1

---
