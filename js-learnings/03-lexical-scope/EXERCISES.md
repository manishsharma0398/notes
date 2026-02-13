# Chapter 3: Prediction Exercise

Predict the output before running the code.

---

## Exercise 1: Basic Scope Chain

```javascript
let x = "global";

function outer() {
  let y = "outer";
  
  function inner() {
    console.log(x);
    console.log(y);
  }
  
  inner();
}

outer();
```

**Prediction:**
- Line 7: ___________
- Line 8: ___________

**Why can `inner()` access both?**

---

## Exercise 2: Lexical vs Where Called

```javascript
let x = "global";

function showX() {
  console.log(x);
}

function caller() {
  let x = "caller";
  showX();
}

caller();
```

**Prediction:** ___________

**Why doesn't it use caller's `x`?**

---

## Exercise 3: var vs let in Blocks

```javascript
if (true) {
  var a = 10;
  let b = 20;
}

console.log(a);
console.log(b);
```

**Prediction:**
- Line 6: ___________
- Line 7: ___________

---

## Exercise 4: Loop Closures

```javascript
// Scenario A
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log("var:", i), 0);
}

// Scenario B
for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log("let:", j), 0);
}
```

**Prediction:**
- Scenario A output: ___________
- Scenario B output: ___________

---

## Exercise 5: Shadowing

```javascript
let x = 1;

function test() {
  console.log(x);
  let x = 2;
  console.log(x);
}

test();
```

**Prediction:**
- Line 4: ___________
- Line 6: ___________

---

## Exercise 6: TDZ + Shadowing

```javascript
let value = "outer";

{
  console.log(value);
  let value = "inner";
}
```

**Prediction:** Will this work? If error, what kind?

---

## Exercise 7: Scope Chain Length

```javascript
let a = 1;

function level1() {
  let b = 2;
  
  function level2() {
    let c = 3;
    console.log(a, b, c);
  }
  
  level2();
}

level1();
```

**Prediction:** ___________

**Draw the scope chain.**

---

## Exercise 8: Parameters Shadow

```javascript
let name = "global";

function greet(name) {
  console.log(name);
  name = "modified";
}

greet("argument");
console.log(name);
```

**Prediction:**
- Line 4: ___________
- Line 9: ___________

---

## Exercise 9: Closure Capture

```javascript
function create() {
  let x = 10;
  return function() {
    console.log(x);
  };
}

const fn = create();
fn();
```

**Prediction:** ___________

**How does the returned function access `x`?**

---

## Exercise 10: Multiple Closures

```javascript
function makeCounter() {
  let count = 0;
  return function() {
    count++;
    return count;
  };
}

const c1 = makeCounter();
const c2 = makeCounter();

console.log(c1());
console.log(c1());
console.log(c2());
console.log(c1());
```

**Prediction:**
- Line 12: ___________
- Line 13: ___________
- Line 14: ___________
- Line 15: ___________

**Do c1 and c2 share the same `count`?**

---

## After Your Predictions...

1. Run each exercise
2. Compare to predictions
3. Review README.md for mismatches
4. Explain the behavior using scope chain

---

## Key Insights

If you got these wrong:
- **Lexical scope = where defined, not where called**
- **Scope chain goes inner → outer → global**
- **var = function-scoped, let/const = block-scoped**
- **Shadowing stops scope chain lookup early**
- **TDZ applies to entire block, even before declaration**
