# Chapter 4 — Interview Questions: Hoisting

---

## Q1 — The "why does this behave differently" question

```javascript
console.log(typeof a);
console.log(typeof b);

var a = 1;
let b = 2;
```

**Question:** What do the two lines print? Why don't they behave the same way, given that both `a` and `b` are declared later in the same scope?

<details>
<summary>Expected answer</summary>

Prints `"undefined"` then throws `ReferenceError: Cannot access 'b' before initialization`.

Both `a` and `b` get bindings registered in the creation phase — in that sense both are "hoisted." The difference is the **initial value** of the binding: `var` bindings are initialized to `undefined` immediately, so `typeof a` safely reads that. `let` bindings are left uninitialized (TDZ) until their declaration line actually executes — `typeof` does not bypass the TDZ check, so accessing `b` at all (even via `typeof`) throws.

This is the core proof that "`let` isn't hoisted" is an imprecise claim — if `b` had no binding whatsoever, `typeof b` would safely return `"undefined"`, exactly like a truly undeclared name. The fact that it throws instead proves the engine already knows `b` exists.
</details>

---

## Q2 — The function vs. var naming collision

```javascript
console.log(typeof value);

var value = "assigned";

function value() {
  return "function";
}

console.log(typeof value);
```

**Question:** What do the two `console.log` calls print? Walk through why the creation phase and execution phase give different answers here.

<details>
<summary>Expected answer</summary>

Prints `"function"` then `"string"`.

**Creation phase** processes `var value` first (registers `value` → `undefined`), then processes the function declaration `function value(){}`, which **overwrites** that binding with the full function object. So immediately at the top of the scope, `value` is already a function — that's why the first `typeof` prints `"function"`.

**Execution phase** then runs top to bottom: the `var value = "assigned"` line performs a plain assignment (the `var` keyword itself does nothing at this point — the binding already exists), overwriting the function with the string `"assigned"`. So the second `typeof` prints `"string"`.

This shows two separate mechanisms: creation-phase overwrite order (function declarations processed after and taking priority over plain `var` registrations) vs. execution-phase assignment order (whichever assignment runs last, wins — regardless of what declared the name).
</details>

---

## Q3 — The TDZ and `try/catch` trap

```javascript
function attempt() {
  try {
    console.log(count);
  } catch (e) {
    console.log("caught:", e.constructor.name);
  }
  let count = 5;
}
attempt();
```

**Question:** What is logged? Does wrapping the access in `try/catch` let you recover a usable value for `count` before its declaration?

<details>
<summary>Expected answer</summary>

Logs `caught: ReferenceError`.

`try/catch` lets you catch the *error object* thrown when accessing a TDZ binding, but it does **not** give you any usable value for `count` — there is no fallback value to fall through to. The TDZ isn't like an exception you can "handle and continue with a default" — the binding genuinely has no value until its declaration line executes. This is intentional: the TDZ's entire purpose is to make "used before ready" fail loudly rather than silently degrade to some placeholder value (which is exactly the `var`/`undefined` problem it was designed to replace).
</details>

---

## Q4 — "Why does this throw" (open-ended design question)

**Question:** Why did TC39 design `let`/`const` to throw on TDZ access instead of just initializing them to `undefined` like `var`, which would have been simpler and fully backward compatible?

<details>
<summary>Expected answer (key points)</summary>

1. **`var`'s "reads `undefined`" behavior hides real bugs.** A typo'd variable name, a variable used one line too early, or a variable assumed to hold config that hasn't loaded yet — all of these silently produce `undefined` with `var`, and the bug often surfaces far from its cause.
2. **Fail fast, fail loud.** The TDZ turns "used before ready" into an immediate, precisely located `ReferenceError` at the exact line where the misuse happens — dramatically easier to debug than a mysterious `undefined` propagating through later logic.
3. **Consistency with `const`.** `const` cannot be `undefined`-then-assigned (that would violate "cannot be reassigned" the moment you try to give it its real value) — so `const` *needs* some other semantics before its line runs, and TC39 chose to apply the same TDZ semantics to `let` for consistency, rather than having subtly different rules for the two.
4. **What would break without it:** temporal bugs where a variable is technically "in scope" but logically not ready yet (e.g., variables that depend on other module-level initialization order) would silently produce wrong-but-valid-looking values instead of crashing where the mistake actually is.
</details>

---

## Q5 — Function expression vs. function declaration hoisting

```javascript
foo(); // ?
bar(); // ?

function foo() {
  console.log("foo");
}

var bar = function () {
  console.log("bar");
};
```

**Question:** One of these calls succeeds and one fails. Which is which, what's the exact error (if any), and why do function declarations and function expressions assigned to `var` behave differently despite both eventually holding a function?

<details>
<summary>Expected answer</summary>

`foo()` succeeds, printing `"foo"`. `bar()` throws `TypeError: bar is not a function`.

`foo` is a **function declaration** — the entire function object is registered as its value during the creation phase, so it's fully callable from the very top of the scope.

`bar` is a **variable** (`var`) whose *value* happens to be a function expression. Only the variable name gets a creation-phase binding, initialized to `undefined` — the function expression on the right-hand side is not evaluated until execution reaches that line. So at the point `bar()` is called, `bar` is still `undefined`, and calling `undefined` as a function throws a `TypeError`, not a `ReferenceError` (the binding exists and has a value — it's just not a callable one yet).

The distinction: hoisting behavior is a property of the **declaration form**, not of "eventually being a function."
</details>

---

## Q6 — Why doesn't JavaScript hoist function expressions like function declarations?

**Question:** If hoisting function declarations fully (with their body) is useful for things like mutual recursion between top-level functions, why doesn't the language do the same for function expressions assigned to variables?

<details>
<summary>Expected answer (key points)</summary>

1. **Expressions are evaluated left-to-right, in place, like any other value-producing code.** A function expression is not fundamentally different from `var x = 5 + someOtherVar` — you wouldn't expect `5 + someOtherVar` to be computed "early" either. Special-casing function expressions to hoist their value would break the general rule that expressions evaluate where they appear.
2. **It would make forward-reference bugs invisible.** If `var greet = function(){ ... }` were usable before its line, code could accidentally call functions whose closures capture variables that haven't been initialized yet, silently reading `undefined` for things that should have real values by call time.
3. **Declarations are explicitly meant for structuring a scope up front** (this is why mutual recursion works between two `function` declarations) — expressions are ordinary values assigned to bindings, and the language deliberately keeps their timing predictable and identical to any other assignment.
4. **What would break:** module and script initialization order would become far harder to reason about — you'd lose the guarantee that a `var`/`let` binding's *value* only exists after its assignment has actually run.
</details>
