# Chapter 4 Interview Questions: Hoisting

---

## Question 1: What is Hoisting?

**Q:** Explain what hoisting is and clarify the common misconception.

**Expected Answer:**
- **Common misconception:** JavaScript moves declarations to the top
- **Reality:** During compilation, declarations are registered in scope before execution
- Nothing "moves" — declarations are just processed first
- **var:** Registered and initialized to `undefined`
- **let/const:** Registered but stay in TDZ
- **Functions:** Fully registered (name + body)

---

## Question 2: var vs let Hoisting

**Q:** What's the output?

```javascript
console.log(a);
console.log(b);

var a = 1;
let b = 2;
```

**Expected Answer:**
- Line 1: `undefined`
- Line 2: ReferenceError

**Why:**
- `var a` hoisted and initialized to undefined
- `let b` hoisted but in TDZ

---

## Question 3: TDZ Explanation

**Q:** What is the Temporal Dead Zone?

**Expected Answer:**
- Time between scope entry and variable declaration
- Variable exists (hoisted) but is inaccessible
- Accessing it → ReferenceError
- Applies to `let`, `const`, `class`
- **Purpose:** Catch bugs, enforce initialization order

---

## Question 4: Function Declaration vs Expression

**Q:** Which works and why?

```javascript
// A
foo();
function foo() { console.log("A"); }

// B
bar();
const bar = function() { console.log("B"); };
```

**Expected Answer:**
- **A:** Works — function declaration fully hoisted
- **B:** ReferenceError — `const bar` in TDZ

---

## Question 5: Shadowing with Hoisting

**Q:** What does this log?

```javascript
var x = "global";

function test() {
  console.log(x);
  var x = "local";
}

test();
```

**Expected Answer:**
`undefined`

**Why:**
- Local `var x` hoisted to top of `test()`
- Shadows global `x`
- At `console.log`, local `x` is `undefined`

---

## Question 6: typeof and TDZ

**Q:** What's the difference?

```javascript
console.log(typeof a);  // ?
console.log(typeof b);  // ?
let b = 10;
```

**Expected Answer:**
- Line 1: `"undefined"` (a doesn't exist)
- Line 2: ReferenceError (b in TDZ)

**Why:** `typeof` doesn't protect against TDZ variables.

---

## Question 7: Function Override

**Q:** What's the output?

```javascript
var foo = "variable";

function foo() {
  return "function";
}

console.log(typeof foo);
```

**Expected Answer:**
`"function"`

**Why:**
- During compilation: function declaration overrides `var`
- After compilation: `foo = <function>`
- Execution hasn't reassigned it yet

---

## Question 8: Parameter TDZ

**Q:** Will this work?

```javascript
function test(a = b, b = 2) {
  console.log(a, b);
}
test();
```

**Expected Answer:**
ReferenceError

**Why:**
- Parameters evaluated left to right
- `a = b` tries to use `b` before it's initialized
- `b` is in TDZ

---

## Question 9: Block Scope + TDZ

**Q:** What happens?

```javascript
let x = "outer";
{
  console.log(x);
  let x = "inner";
}
```

**Expected Answer:**
ReferenceError

**Why:**
- Block-scoped `let x` shadows outer from start of block
- Inner `x` is in TDZ at `console.log`

---

## Question 10: Hoisting Scope

**Q:** Does hoisting cross function boundaries?

```javascript
function outer() {
  function inner() {
    var x = 10;
  }
  console.log(x);
}
```

**Expected Answer:**
No. ReferenceError.

**Why:**
- Hoisting is per-scope
- `x` hoisted to `inner()` scope only
- Not accessible in `outer()`

---

## Interview Traps

### Trap 1:
```javascript
for (var i = 0; i < 3; i++) {}
console.log(i);  // ?
```
**Answer:** `3` — `var i` hoisted to function/global scope.

---

### Trap 2:
```javascript
console.log(typeof MyClass);  // ?
class MyClass {}
```
**Answer:** ReferenceError — classes in TDZ.

---

### Trap 3:
```javascript
var x = 1;
var x = 2;
console.log(x);  // ?
```
**Answer:** `2` — `var` allows re-declaration.

---

## Precision Questions

### Q1: "Hoisting moves code to the top." Fix this.

**Better:** "During compilation, declarations are registered in scope before execution begins, with different initialization behaviors for var (undefined) vs let/const (TDZ)."

---

### Q2: Why does TDZ exist?

**Answer:**
- Prevent accessing uninitialized variables
- Catch bugs early
- Enable `const` semantics (must initialize with value)
- More predictable behavior

---

### Q3: Why does hoisting exist at all?

**Answer:**
- Historical: mutual recursion support
- Technical: compile-time scope analysis
- Performance: engine optimizations
- Closures: knowing what to capture
