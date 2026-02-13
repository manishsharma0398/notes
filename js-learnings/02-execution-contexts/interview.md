# Chapter 2 Interview Questions: Execution Contexts and Call Stack

---

## Question 1: Execution Context Components

**Q:** What are the three components of an execution context, and what does each contain?

**Expected Answer:**
1. **Variable Environment:** Stores local variables, function declarations, parameters, and the `arguments` object
2. **Lexical Environment:** A reference to the outer (enclosing) scope, enabling scope chain lookup
3. **`this` Binding:** The value of the `this` keyword for this context

**Follow-up:** What's the difference between Variable Environment and Lexical Environment?

---

## Question 2: Call Stack Mechanics

**Q:** Explain what happens to the call stack when this code runs:

```javascript
function a() { b(); }
function b() { c(); }
function c() { console.log("done"); }
a();
```

**Expected Answer:**
1. Start: `[Global]`
2. a() called: `[Global, a]`
3. b() called: `[Global, a, b]`
4. c() called: `[Global, a, b, c]`
5. c() returns: `[Global, a, b]`
6. b() returns: `[Global, a]`
7. a() returns: `[Global]`

LIFO — Last In, First Out.

---

## Question 3: Creation vs Execution Phase

**Q:** What's available in which phase?

```javascript
function test() {
  console.log(a);
  console.log(b);
  var a = 1;
  let b = 2;
}
```

**Expected Answer:**
- Creation: `a = undefined`, `b = <uninitialized>`
- Line 2: Logs `undefined`
- Line 3: ReferenceError (TDZ)

---

## Question 4: Lexical Environment Chain

**Q:** How does JavaScript find `globalVar`?

```javascript
let globalVar = "global";
function outer() {
  function inner() {
    console.log(globalVar);
  }
  inner();
}
outer();
```

**Expected Answer:**
1. Check inner() → Not found
2. Check outer() → Not found
3. Check Global → Found!

This is the **scope chain**.

---

## Question 5: Stack Overflow

**Q:** Why stack overflow?

```javascript
function factorial(n) {
  return n * factorial(n - 1);
}
factorial(5);
```

**Expected Answer:**
No base case → infinite recursion → stack limit exceeded.

**Fix:** Add `if (n <= 1) return 1;`

---

## Question 6: `var` in Loops

**Q:** Why `3, 3, 3` not `0, 1, 2`?

```javascript
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
```

**Expected Answer:**
`var i` is shared. Loop finishes before callbacks run. All see `i = 3`.

**Fix:** Use `let i` (block-scoped).

---

## Question 7: `arguments` Aliasing

**Q:** Strict vs non-strict mode?

```javascript
function test(a) {
  a = 10;
  console.log(arguments[0]);
}
test(5);
```

**Expected Answer:**
- Non-strict: `10` (aliased)
- Strict: `5` (no aliasing)

---

## Question 8: Context Destruction

**Q:** Why does closures keep variables alive?

```javascript
function outer() {
  let x = 10;
  return function inner() {
    console.log(x);
  };
}
const fn = outer();
fn();  // Works
```

**Expected Answer:**
Execution context removed from stack, but `x` stays in memory because `inner` references it (closure).

---

## Question 9: Single-Threaded

**Q:** Why does this block?

```javascript
function slow() {
  for (let i = 0; i < 1e9; i++) {}
}
console.log("Before");
slow();
console.log("After");  // Waits
```

**Expected Answer:**
One call stack. Can't execute anything else while `slow()` is running.

---

## Question 10: Debug Stack Overflow

**Q:** Production stack overflow. How to debug?

**Expected Strategy:**
1. Check for missing base case
2. Verify base case is reachable
3. Add depth limit
4. Consider iterative solution

**Can't catch:** No stack space for catch block.
