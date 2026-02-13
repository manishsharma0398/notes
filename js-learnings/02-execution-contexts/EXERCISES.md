# Chapter 2: Prediction Exercise

Before reviewing the examples, predict the output of these code snippets.

---

## Exercise 1: Call Stack Order

**Predict the console output order:**

```javascript
function first() {
  console.log("first start");
  second();
  console.log("first end");
}

function second() {
  console.log("second start");
  third();
  console.log("second end");
}

function third() {
  console.log("third");
}

first();
```

**Your prediction:**
1. ___________
2. ___________
3. ___________
4. ___________
5. ___________

**Draw the call stack at each step.**

---

## Exercise 2: Hoisting in Context

**Predict the output:**

```javascript
function test() {
  console.log(a);
  console.log(b);
  console.log(c());
  
  var a = 1;
  let b = 2;
  function c() { return 3; }
}

test();
```

**Your prediction:**
- Line 2: ___________
- Line 3: ___________
- Line 4: ___________

---

## Exercise 3: Lexical Scope Chain

**Predict the output:**

```javascript
let x = "global";

function outer() {
  let x = "outer";
  
  function inner() {
    console.log(x);
  }
  
  return inner;
}

const fn = outer();
fn();
```

**Your prediction:** ___________

**Why does it use outer's `x` not global's `x`?**

---

## Exercise 4: Recursion Depth

**Predict what happens:**

```javascript
function count(n) {
  if (n === 0) return;
  count(n - 1);
}

count(3);
```

**Your prediction:**
- Maximum call stack depth: ___________
- Output: ___________

**Draw the call stack evolution.**

---

## Exercise 5: `var` vs `let` in Loops

**Predict the output:**

```javascript
// Scenario A
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}

// Scenario B
for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log(j), 0);
}
```

**Your prediction:**
- Scenario A: ___________
- Scenario B: ___________

**Why is there a difference?**

---

## Exercise 6: Context Destruction

**Predict what happens:**

```javascript
function outer() {
  let x = 10;
}

outer();
console.log(x);
```

**Your prediction:**
- Will this work?
- If error, what kind?

---

## Exercise 7: Variable Shadowing

**Predict the output:**

```javascript
let x = 1;

function test() {
  console.log(x);
  let x = 2;
  console.log(x);
}

test();
```

**Your prediction:**
- Line 4: ___________
- Line 6: ___________

---

## Exercise 8: `arguments` Object

**Predict (non-strict mode):**

```javascript
function test(a, b) {
  console.log(arguments[0]);
  a = 10;
  console.log(arguments[0]);
  console.log(arguments.length);
}

test(1, 2);
```

**Your prediction:**
- Line 2: ___________
- Line 4: ___________
- Line 5: ___________

**What changes in strict mode?**

---

## After Your Predictions...

1. Run each exercise
2. Compare to your predictions
3. Review README.md for mismatches
4. Explain why the behavior differs

---

## Key Insight

If you got these wrong, remember:
- **Call stack = LIFO**
- **Creation phase ≠ Execution phase**
- **Lexical scope = where defined, not where called**
- **Closures keep variables alive after context destruction**
