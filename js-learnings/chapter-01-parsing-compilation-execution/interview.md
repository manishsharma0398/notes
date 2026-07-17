# Chapter 1 — Senior Interview Questions
## Parsing, Compilation, and Execution

---

### Q1: "Why does JavaScript behave this way?"

**Question:**
Why does JavaScript hoist `var` declarations but not their assignments? And why does `let` behave differently?

**What a strong answer covers:**
- Hoisting is a consequence of the two-pass model: the compiler registers all declarations before execution begins.
- `var` is initialized to `undefined` at compile time — this was an early design choice for forgiving scripting behavior (originally JS targeted non-programmers).
- `let`/`const` were introduced in ES6 with the intent of making bugs more visible. The TDZ means "you declared it, but you haven't initialized it yet — accessing it is almost certainly a bug." The TDZ is deliberate, not an accident.
- `function` declarations are fully hoisted (with value) because functions often need to call each other mutually — hoisting allows forward references.

---

### Q2: "What breaks if this worked differently?"

**Question:**
If JavaScript used dynamic scoping instead of lexical scoping, what would break?

**What a strong answer covers:**
- Closures would be impossible or meaningless. A closure captures the *lexical* environment — if scope changed at call time, a returned function would look up variables in the caller's scope, making closures unpredictable.
- Module systems (ESM, CommonJS) depend on lexical scope to isolate module-level bindings.
- Static analysis tools (bundlers, minifiers, IDEs) rely on being able to determine scope without running the code. Dynamic scoping makes this impossible.
- `this` keyword already provides a form of dynamic binding — and it's one of JavaScript's most confusing features. Dynamically scoped variables would multiply that confusion.

---

### Q3: "Why doesn't this alternative exist?"

**Question:**
Why can't JavaScript detect *all* errors (like calling a non-function) before execution?

**What a strong answer covers:**
- JavaScript's type system is dynamic — variable types are only known at runtime. A variable that holds a function in one branch might hold a number in another.
- To detect all errors statically, the engine would need to track every possible value a variable might hold across all code paths — this is the job of a static type checker (TypeScript, Flow), not a JS engine.
- Even TypeScript with `noImplicitAny` cannot guarantee all runtime errors are caught — it operates on a structural type model that can be bypassed with `any` or type assertions.
- This is a fundamental trade-off: dynamic typing gives flexibility at the cost of compile-time safety.

---

### ⚠️ Trap Questions

**Trap 1:**
```javascript
console.log(typeof undeclaredVariable);
```
What does this log?
- Answer: `"undefined"` — NOT a ReferenceError.
- Why: `typeof` is special — it does not evaluate its operand; it checks the scope without throwing for undeclared identifiers. It's the only operator with this behavior.

---

**Trap 2:**
```javascript
var x = 1;
function foo() {
  console.log(x);
  var x = 2;
}
foo();
```
What logs?
- Answer: `undefined`
- Why: Inside `foo`, `var x` is hoisted to the top of the function scope and initialized to `undefined`. The `console.log(x)` sees the *local* `x` (which is `undefined`), not the global `x` (which is `1`). The hoisted local `x` shadows the global before the assignment runs.

---

**Trap 3:**
```javascript
function foo() {
  return
  {
    value: 42
  };
}
console.log(foo());
```
What logs?
- Answer: `undefined`
- Why: **Automatic Semicolon Insertion (ASI)**. The parser inserts a semicolon after `return` because the next token (`{`) is on a new line. The function returns `undefined`. The object literal is dead code. This is a parse-phase behavior — a direct consequence of the parser's ASI rules. Always put `{` on the same line as `return`.

---

**Trap 4:**
```javascript
let a = 1;
{
  console.log(a); // ?
  let a = 2;
}
```
What happens?
- Answer: `ReferenceError: Cannot access 'a' before initialization`
- Why: The block-scoped `let a = 2` is hoisted to the top of the block and placed in TDZ. The `console.log` executes inside that block and hits the TDZ. The outer `a = 1` is shadowed and inaccessible. This is often called the "TDZ shadow."
