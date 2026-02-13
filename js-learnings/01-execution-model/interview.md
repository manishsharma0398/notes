# Chapter 1 Interview Questions: JavaScript Execution Model

---

## Question 1: Parsing vs Execution

**Q:** Why can't you catch a syntax error with `try/catch`?

```javascript
try {
  let x = ;
} catch(e) {
  console.log("Caught!");
}
```

**Expected Answer:**
- Parsing happens before execution
- `try/catch` is an execution-time feature
- The syntax error stops the script during parsing
- Nothing executes if parsing fails
- The catch block never runs because execution never starts

**Follow-up:** What's the difference between a SyntaxError and a ReferenceError?

---

## Question 2: Hoisting Mechanics

**Q:** Explain why this code works and what "hoisting" actually means at the language level.

```javascript
console.log(foo());  // ?
function foo() { return 42; }
```

**Expected Answer:**
- JavaScript compiles the entire scope before execution
- During compilation, function declarations are registered (name + body)
- "Hoisting" is a mental model; the real mechanism is scope registration at compile time
- By the time `console.log(foo())` executes, `foo` already exists in scope
- The engine doesn't literally "move" code; it just processes declarations first

**Follow-up:** What's different if `function foo()` is changed to `const foo = function()`?

---

## Question 3: Temporal Dead Zone

**Q:** What is the Temporal Dead Zone and why does it exist?

```javascript
console.log(x);  // ?
let x = 5;
```

**Expected Answer:**
- TDZ = time between scope start and variable declaration line
- `let/const` are hoisted (registered at compile time) but left uninitialized
- Accessing them in TDZ = ReferenceError
- **Why it exists:** Prevents accessing variables before they have meaningful values, catching bugs early
- Enforces temporal ordering: you must declare before use

**Follow-up:** How is this different from `var`?

---

## Question 4: Function Declaration vs Expression

**Q:** Predict the output and explain the difference.

```javascript
// Scenario A
foo();
function foo() { console.log("A"); }

// Scenario B
bar();
var bar = function() { console.log("B"); };
```

**Expected Answer:**
- **Scenario A:** Outputs "A" — function declarations are fully hoisted
- **Scenario B:** TypeError: bar is not a function
  - `var bar` is hoisted and initialized to `undefined`
  - Trying to call `undefined()` causes TypeError
- The difference: declarations hoist name + body, expressions only hoist the variable name

**Follow-up:** What if `var bar` becomes `const bar`?

---

## Question 5: Why This Behavior?

**Q:** Why does JavaScript compile code before executing it instead of just interpreting line by line?

**Expected Answer:**
- **Performance:** JIT compilation enables optimizations (type inference, inline caching, dead code elimination)
- **Scope analysis:** Engine needs to know all variables in a scope upfront to build scope chains correctly
- **Error detection:** Catch syntax errors before execution starts
- **Closures:** Compiler must detect when inner functions reference outer variables to maintain scope references
- **Hoisting semantics:** Allows useful patterns like mutual recursion between functions

**Follow-up:** What's the trade-off of compilation?

---

## Question 6: Breaking Assumptions

**Q:** Why does this fail?

```javascript
let x = 5;
let x = 10;
```

**Expected Answer:**
- During compilation, `x` is registered twice in the same scope
- The compiler detects the duplicate declaration and throws SyntaxError
- This happens at compile time, before any execution
- **Why the limitation:** `let/const` enforce block-scoping discipline; re-declaration is almost always a mistake

**Follow-up:** What about `var x`? Why is it different?

---

## Question 7: Execution Order

**Q:** What happens during each phase when this code runs?

```javascript
greet("Alice");
var name = "Bob";
function greet(person) {
  console.log("Hello, " + person);
}
```

**Expected Answer:**

**Parsing:**
- Tokenize all code
- Build AST
- Validate syntax

**Compilation:**
- Register `name` → set to `undefined`
- Register `greet` → full function object created
- scope metadata: `{ name: undefined, greet: <function> }`

**Execution:**
- Line 1: Call `greet("Alice")` → creates execution context → logs "Hello, Alice"
- Line 2: Assign `name = "Bob"`
- Line 3-5: Already compiled, nothing happens

**Follow-up:** What if `greet` was a `const` arrow function?

---

## Question 8: Edge Case - Conditional Declarations

**Q:** Is this code safe? What happens?

```javascript
if (false) {
  function foo() { console.log("Never runs?"); }
}
foo();
```

**Expected Answer:**
- **In non-strict mode:** Implementation-dependent (undefined behavior)
  - Some engines hoist `foo` as `undefined`, causing TypeError
  - Some engines hoist the full function, causing it to run
- **In strict mode:** `foo` is block-scoped, ReferenceError outside the `if`
- **Why:** Historically, function declarations weren't allowed in blocks; modern spec tries to reconcile old behavior with block scoping
- **Best practice:** Always use function expressions in conditionals

**Follow-up:** How would you fix this?

---

## Question 9: What Can't JavaScript Do?

**Q:** Why can't JavaScript re-declare `let` variables in the same scope?

```javascript
let x = 5;
let x = 10;  // SyntaxError
```

**Expected Answer:**
- During compilation, each `let` declaration registers `x` in the scope record
- The compiler detects the duplicate and throws an error
- **Why the language prevents this:** Block-scoped variables shouldn't be re-declared; it's almost always a bug
- **Design trade-off:** Strictness prevents subtle bugs but reduces flexibility
- Contrast with `var`, which allows re-declaration (function-scoped, looser semantics)

**Follow-up:** What if they're in nested blocks?

---

## Question 10: Production Bug Scenario

**Q:** You have a production bug where a variable is `undefined` when it should have a value. How does understanding the execution model help you debug?

**Expected Answer:**
- Check if the variable is being accessed before its declaration (TDZ for `let/const`, undefined for `var`)
- Verify the variable is in the correct scope (check scope chain)
- Confirm the assignment actually executes (conditional logic might skip it)
- Look for hoisting issues: function expression vs declaration
- Use browser debugger to inspect the call stack and scope chain at runtime

**Key insight:** Knowing that declarations happen at compile time and assignments at execution time guides your investigation.

**Follow-up:** Give an example of a subtle hoisting bug.

---

## Interview Traps (Quick Fire)

### Trap 1:
```javascript
var foo = 1;
function bar() {
  if (!foo) {
    var foo = 10;
  }
  console.log(foo);  // ?
}
bar();
```
**Answer:** `10` — `var foo` is hoisted to function scope, shadowing outer `foo`. `!foo` is true (`undefined` is falsy), so `foo = 10` executes.

---

### Trap 2:
```javascript
let a = 1;
{
  console.log(a);  // ?
  let a = 2;
}
```
**Answer:** ReferenceError — TDZ applies to the block-scoped `a`.

---

### Trap 3:
```javascript
function outer() {
  inner();
  function inner() { console.log("Called"); }
}
outer();
```
**Answer:** Outputs "Called" — function declarations are hoisted within their scope.

---

## Precision Questions (Senior-Level)

### Q1: "Hoisting moves declarations to the top of the scope." True or false?

**Answer:** False. Hoisting is a mental model. What actually happens: during compilation, declarations are registered in the scope record. No code is moved.

---

### Q2: Why doesn't this alternative exist: no hoisting at all?

**Answer:**
- Breaking change (legacy code relies on it)
- Useful patterns (mutual recursion, forward references)
- Performance (scope analysis needs upfront knowledge)
- The cost is manageable with `let/const` and strict mode

---

### Q3: What breaks if JavaScript didn't compile before executing?

**Answer:**
- Scope chains couldn't be built correctly
- No optimization (slower execution)
- Closures wouldn't work reliably
- Error detection would be runtime-only (worse DX)
- Hoisting patterns impossible
