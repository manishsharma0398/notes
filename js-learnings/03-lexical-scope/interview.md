# Chapter 3 Interview Questions: Lexical Scope and Scope Chain

---

## Question 1: Lexical Scope Definition

**Q:** What is lexical scope and how is it different from dynamic scope?

**Expected Answer:**
- **Lexical scope:** Scope determined by where code is **written** (compile time)
- **Dynamic scope:** Scope determined by where code is **called** (runtime)
- JavaScript uses lexical scope
- Inner functions access variables from where they're **defined**, not where they're **called**

**Follow-up:** Why did JavaScript choose lexical over dynamic scope?

**Answer:** Predictability, optimization, security, enables closures.

---

## Question 2: Scope Chain Lookup

**Q:** Explain the lookup process for this code:

```javascript
let a = 1;
function outer() {
  let b = 2;
  function inner() {
    let c = 3;
    console.log(a, b, c);
  }
  inner();
}
outer();
```

**Expected Answer:**
Lookup for each variable in `inner()`:

**For `c`:**
1. Check inner() scope → Found!

**For `b`:**
1. Check inner() scope → Not found
2. Check outer() scope → Found!

**For `a`:**
1. Check inner() scope → Not found
2. Check outer() scope → Not found
3. Check global scope → Found!

This chain is the **scope chain**.

---

## Question 3: Block vs Function Scope

**Q:** What's the difference in output?

```javascript
// Scenario A
if (true) {
  var x = 10;
}
console.log(x);  // ?

// Scenario B
if (true) {
  let y = 20;
}
console.log(y);  // ?
```

**Expected Answer:**
- **A:** `10` — `var` is function-scoped, ignores blocks
- **B:** ReferenceError — `let` is block-scoped

**Follow-up:** What about inside a function?

```javascript
function test() {
  if (true) {
    var x = 10;
  }
  console.log(x);  // ?
}
```

**Answer:** Still `10` — `var` is hoisted to function scope.

---

## Question 4: Shadowing

**Q:** What will this log?

```javascript
let x = "global";

function test() {
  let x = "local";
  console.log(x);
}

test();
console.log(x);
```

**Expected Answer:**
- Line 5: `"local"` — local x shadows global
- Line 8: `"global"` — global x unchanged

**Follow-up:** Can you access global x from inside test()?

**Answer:** Generally no (unless using `window.x` in browser for `var`, but not for `let`/`const`).

---

## Question 5: Loop Scope Trap

**Q:** Why different output?

```javascript
// A
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}

// B
for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log(j), 0);
}
```

**Expected Answer:**
- **A:** `3, 3, 3` — `var i` shared across all iterations
- **B:** `0, 1, 2` — `let j` creates new binding per iteration

**Why:** Block scope creates separate `j` for each iteration; callbacks capture different variables.

---

## Question 6: TDZ + Shadowing

**Q:** Will this work?

```javascript
let x = "outer";

function test() {
  console.log(x);
  let x = "inner";
}

test();
```

**Expected Answer:**
ReferenceError

**Why:**
- Inner `let x` shadows outer from start of function scope
- But inner `x` is in TDZ until declaration line
- Accessing it → ReferenceError

**Follow-up:** What if you remove `let x = "inner"`?

**Answer:** Logs `"outer"` — no shadowing, uses outer scope.

---

## Question 7: Lexical Scope Proof

**Q:** What does this log? Why?

```javascript
let x = "global";

function outer() {
  let x = "outer";
  return function inner() {
    console.log(x);
  };
}

const fn = outer();
fn();
```

**Expected Answer:**
Logs `"outer"`

**Why:** `inner` is **defined** inside `outer`, so it lexically captures `outer`'s scope. Doesn't matter that `fn()` is called from global scope.

This proves lexical scope and is the basis for closures.

---

## Question 8: Scope Chain Direction

**Q:** Can outer scopes access inner scope variables?

```javascript
function outer() {
  function inner() {
    let x = 10;
  }
  inner();
  console.log(x);  // ?
}
```

**Expected Answer:**
ReferenceError

**Why:** Scope chain only goes **up** (inner → outer), not down. `outer` can't access `inner`'s variables.

---

## Question 9: Parameters and Shadowing

**Q:** What happens here?

```javascript
let x = "global";

function test(x) {
  console.log(x);
  x = "modified";
  console.log(x);
}

test("argument");
console.log(x);
```

**Expected Answer:**
- Line 4: `"argument"` — parameter `x` shadows global
- Line 6: `"modified"` — parameter modified
- Line 10: `"global"` — global `x` unchanged

**Why:** Parameters create local variables that shadow outer ones.

---

## Question 10: Production Debugging

**Q:** You have a closure bug where a variable has the wrong value. How does understanding scope chain help debug?

**Expected Strategy:**
1. **Check where function is defined** (not where it's called)
2. **Trace scope chain** from function up to global
3. **Look for shadowing** — same-named variables in different scopes
4. **Check for TDZ issues** — accessing before declaration
5. **Verify `var` vs `let`** in loops — shared vs per-iteration

**Key insight:** Closures capture variables by reference, not value. If the variable changes, the closure sees the change.

---

## Interview Traps (Quick Fire)

### Trap 1:
```javascript
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
```
**Answer:** `3, 3, 3` — shared `var i`.

---

### Trap 2:
```javascript
let x = 1;
{
  console.log(x);  // ?
  let x = 2;
}
```
**Answer:** ReferenceError — TDZ for inner `x`.

---

### Trap 3:
```javascript
function test() {
  console.log(typeof x);  // ?
  let x = 5;
}
test();
```
**Answer:** ReferenceError — `typeof` doesn't protect against TDZ.

---

## Precision Questions

### Q1: "Closures are when a function remembers its variables." Precise?

**Better:** "A closure is when a function retains access to its lexical scope even after the outer function has returned, preventing garbage collection of those scope variables."

---

### Q2: Why does JavaScript need scope chain?

**Answer:**
- Enable nested functions to access outer variables
- Support closures
- Implement lexical scoping
- Provide encapsulation and modularity

---

### Q3: What breaks if scope chain didn't exist?

**Answer:**
- No closures
- Inner functions couldn't access outer variables
- Every function would only see global scope
- No encapsulation possible
