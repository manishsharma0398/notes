# Chapter 2 — Senior Interview Questions
## Execution Contexts & The Call Stack

---

### Q1: "Why does JavaScript behave this way?"

**Question:**
Why does JavaScript use a Variable Environment *separate* from the Lexical Environment? Why not put everything in one place?

**What a strong answer covers:**
- `var` predates block scoping. In ES3/ES5, there was only one environment per function — everything was "var." Block scoping didn't exist.
- When ES6 introduced `let` and `const` with block scope, the engine needed a way to have "moving" scope inside a fixed function boundary.
- The solution was two environments: VariableEnvironment (frozen at function entry — backward-compatible `var` behavior), and LexicalEnvironment (a pointer that advances as blocks are entered/exited).
- This also means a `catch` block in `try/catch` can introduce a block-scoped binding for the error variable without breaking `var` semantics in the surrounding function.
- It's a backward-compatibility seam — not the ideal design, but the one that didn't break the web.

---

### Q2: "What breaks if this worked differently?"

**Question:**
What would break if every block `{}` created a new Execution Context instead of a new Environment Record?

**What a strong answer covers:**
- Creating an EC is expensive — it involves allocating scope objects, setting up `this`, resolving the outer reference. Doing this for every `if`, `for`, and `{}` in a hot loop would destroy performance.
- `return` from inside a block would be ambiguous — which EC are you returning from?
- `this` would need to be re-resolved in every block, or inherited (but inheritance rules would need to be specified).
- Error stack traces would become bloated — every `{}` would appear as a stack frame.
- The distinction between "scope" and "call frame" (which is meaningful for debugging, profiling, and error reporting) would collapse.

---

### Q3: "Why doesn't this alternative exist?"

**Question:**
Why can't JavaScript implement TCO (Tail-Call Optimization) universally, so recursive algorithms don't blow the stack?

**What a strong answer covers:**
- TCO *is* in the ES6 spec. In a proper tail call, the current EC can be replaced by the new one rather than stacking on top, because we'll never need to return to it.
- V8 implemented "ShadowRealm"-style TCO under a flag but removed it because it broke `Error.stack` — developers rely on stack traces for debugging, and TCO erases frames from the trace.
- Safari/JSC is the only major engine that implements it today.
- The debate reveals a tension: the spec says TCO exists, but engines prioritize developer experience (stack traces) over theoretical correctness. This is an example of how JavaScript is shaped by practical constraints, not just the spec.
- The workaround is trampolining — returning a function instead of calling it, and wrapping the loop externally.

---

### ⚠️ Trap Questions

**Trap 1:**
```javascript
var x = "outer";

function foo() {
  console.log(x); // ?
  if (true) {
    var x = "inner";
  }
}
foo();
```
What logs?
- Answer: `undefined`
- Why: `var x = "inner"` inside the `if` block is still in `foo`'s VariableEnvironment (var ignores blocks). During creation phase, `x` is registered in `foo`'s Variable Environment as `undefined`. The `console.log(x)` runs before the assignment `x = "inner"` executes.

---

**Trap 2:**
```javascript
let x = "global";
function foo() {
  return function bar() {
    return x;
  };
}
function baz() {
  let x = "baz";
  return foo()(); // call foo(), then call the returned bar()
}
console.log(baz());
```
What logs?
- Answer: `"global"`
- Why: `bar` is defined inside `foo`. `foo`'s outer reference → Global ER. `bar`'s outer reference → `foo`'s ER → Global ER. When `bar` looks up `x`, the chain is: `bar` ER (no x) → `foo` ER (no x) → Global ER (`x = "global"`). `baz`'s local `x = "baz"` is completely outside this chain.

---

**Trap 3:**
```javascript
function outer() {
  let count = 0;

  function inner() {
    count++;
    return count;
  }

  return inner;
}

const a = outer();
const b = outer();

a();
a();
b();

console.log(a()); // ?
console.log(b()); // ?
```
What logs?
- Answer: `a()` → `3`, `b()` → `2`
- Why: Each call to `outer()` creates a new EC and a new Environment Record with its own `count`. `a` and `b` close over **different** Environment Records. They do not share state. `a` has been called 3 times total (two above + one in the log), `b` has been called 2 times.

---

**Trap 4: The TDZ at block boundary**
```javascript
let x = 1;
{
  x = 2;      // ← what happens here?
  let x = 3;
}
console.log(x);
```
What logs or throws?
- Answer: `ReferenceError: Cannot access 'x' before initialization`
- Why: The block introduces `let x = 3`. This is hoisted to the top of the block's ER and put in TDZ. The assignment `x = 2` accesses `x` — the block's ER is searched first, finds `x` in TDZ, throws. The outer `x = 1` is shadowed and unreachable inside this block.

---

**Trap 5: for loop variable with let — per-iteration binding**
```javascript
const fns = [];
for (let i = 0; i < 3; i++) {
  fns.push(() => i);
}
console.log(fns.map(f => f()));
```
What logs?
- Answer: `[0, 1, 2]`
- Why: Each iteration of a `for (let ...)` loop creates a **new block ER** and copies the current `i` into it. Each arrow function closes over a **different ER** with a different `i`. This is a spec-guaranteed behavior — the engine re-creates the binding each iteration and initializes it from the previous iteration's value.
