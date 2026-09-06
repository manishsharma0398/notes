# 02 — Function Polyfills

The category that contains the single most reliable level-separator in the JS machine round:
**`bind` that works with `new`**. Almost everyone writes a `bind` that passes the obvious test and
fails the moment the bound function is used as a constructor.

**Theory:** `js-learnings` Ch5 (`this` binding), Ch10 (`new`, constructors, classes), Ch11
(functions as objects). Ch11 is the one that makes `.length` and `.name` make sense.

**How to drill:** pick one, start a timer, close these notes, write it in `solution/<name>.js`,
run its test. Record time, first-try pass, and which hint you needed.

```bash
node --test "js-machine-round/02-function-polyfills/tests/*.test.js"
```

Problems 1–4 build on each other in order. **Do not skip to `myBind`** — it needs `myCall` and
`myNew` to be understood, and that dependency is the reason interviewers ask them as a sequence.

---

## 1 · `myCall(fn, thisArg, ...args)` — target 5 min · warm-up

Implement `Function.prototype.call` as a standalone function.

```javascript
function greet(greeting) { return `${greeting}, ${this.name}`; }
myCall(greet, { name: "Manish" }, "Hi");   // "Hi, Manish"
```

**Ask out loud before typing:** you are not allowed to use `call`, `apply` or `bind`. What is the
one remaining way to control what `this` is when a function runs?

**Edge cases being tested**

- The temporary property you add to `thisArg` must be **removed afterwards** — and must not
  clobber an existing property of the same name. What key guarantees that (Ch11)?
- `thisArg` of `null`/`undefined`: sloppy mode substitutes `globalThis`, strict mode does not
  (Ch22). Pick a behaviour and be able to say which mode you matched.
- A primitive `thisArg` — is it boxed? Say what your implementation does and what the real one
  does in each mode.
- The return value is forwarded.

**What they're scoring:** that you reach for "call it as a method of the object" without being
led there, and that you clean up after yourself.

---

## 2 · `myApply(fn, thisArg, argsArray)` — target 4 min · warm-up

Same, with an array of arguments.

**Edge cases being tested**

- No `argsArray` at all — `myApply(fn, obj)` must work, not throw.
- An array-like (`{ 0: "a", length: 1 }`) rather than a real array. The real `apply` accepts it.
- `null`/`undefined` as the args argument is legal and means "no arguments".

**What they're scoring:** noticing that `apply` and `call` differ in *exactly one* way, and not
writing the whole thing twice.

---

## 3 · `myNew(Ctor, ...args)` — target 7 min · **the one people skip**

Implement the `new` operator as a function.

```javascript
function Point(x, y) { this.x = x; this.y = y; }
Point.prototype.dist = function () { return Math.hypot(this.x, this.y); };
const p = myNew(Point, 3, 4);
p.dist();            // 5
p instanceof Point;  // true
```

**Say out loud:** `new` does four things. Name all four before writing any of them.

**Edge cases being tested**

- The new object's prototype is `Ctor.prototype` — **read at call time**, not captured earlier.
- A constructor that **returns an object** — that object wins over `this`. Verified:
  `new (function(){ this.a=1; return {b:2}; })()` is `{b:2}`.
- A constructor that **returns a primitive** — it is ignored, and you get `this`. Verified: the
  same function returning `42` gives `{a:1}`.
- `instanceof` holds.

**What they're scoring:** the return-value rule. Most people implement three of the four steps and
forget that a constructor's return value can override the instance. It is also the rule that makes
problem 4 tractable.

---

## 4 · `myBind(fn, thisArg, ...preset)` — target 12 min · **the level separator**

```javascript
const bound = myBind(greet, { name: "Manish" }, "Hi");
bound();                       // "Hi, Manish"

// and then the part everyone misses:
function Point(x, y) { this.x = x; this.y = y; }
Point.prototype.dist = function () { return Math.hypot(this.x, this.y); };
const B = myBind(Point, { ignored: true }, 3);
const p = new B(4);
p.x;                 // 3   — the preset arg survived
p.y;                 // 4
p instanceof Point;  // true — the prototype chain survived
p.ignored;           // undefined — the bound `this` was IGNORED
```

**Ask out loud:** what should happen if someone calls `new` on a bound function?

**Edge cases being tested** — all verified against the real `bind`:

- **Called with `new`, the bound `this` is discarded** and a real instance is constructed.
- **The prototype chain is preserved**: `new bound(...) instanceof original` is `true`.
- Preset arguments are prepended in both the normal-call and `new` cases.
- Arguments at call time are appended after the preset ones.
- `bound.length === original.length - preset.length`, floored at 0. (Real: `f(a,b,c)` has length
  3; `f.bind(null, 1)` has length 2.)
- `bound.name === "bound " + original.name`.
- A bound function has **no own `prototype` property**. Check what that implies for your
  implementation strategy.

**What they're scoring:** whether `new` support appears without being asked for. If you write the
three-line version and then say *"this breaks if someone calls `new` on it, do you want me to
handle that?"* — you have already passed this question.

---

## 5 · `debounce(fn, wait, options)` — target 10 min · asked constantly

Delay invocation until `wait` ms have passed with no further calls.

```javascript
const d = debounce(save, 100);
d(); d(); d();      // save runs ONCE, 100ms after the last call
```

**Edge cases being tested**

- Only the **last** call's arguments and `this` are used.
- The timer **resets** on every call — three calls 50ms apart fire once, not three times.
- `{ leading: true }` — fire on the first call instead of the last. With both `leading` and
  `trailing`, a single isolated call must not fire twice.
- `.cancel()` — a pending call never fires.
- `.flush()` — a pending call fires immediately.

**What they're scoring:** the reset, and then whether you volunteer `cancel`. In a React or
cleanup context an un-cancellable debounce is a bug (Ch17 — the pending timer holds its closure).

---

## 6 · `throttle(fn, limit, options)` — target 8 min

At most one invocation per `limit` ms.

**Ask out loud:** debounce and throttle are confused constantly. State the difference in one
sentence before you write anything.

**Edge cases being tested**

- Ten calls in rapid succession within one window → **one** invocation, not ten.
- The **first** call fires immediately (leading edge) by default.
- A call arriving mid-window is not lost if `trailing` is on — it fires at the window's end with
  the *latest* arguments.
- With `{ leading: false, trailing: false }` nothing ever fires. Say why that combination is
  allowed to exist.
- `this` and arguments forwarded correctly.

**What they're scoring:** the one-sentence distinction, and knowing that "throttle" without saying
*which edge* is an underspecified answer.

---

## Hints

Read one at a time, and record which one you needed.

**1 · myCall**
1. There is exactly one way left to set `this`: make the function a *method* of the object and
   call it as one.
2. A string key can collide with something the caller already has. `Symbol()` cannot (Ch11).
3. Clean up in a `finally`, so a throwing `fn` does not leave your temporary key behind (Ch16).

**2 · myApply**
1. Spread the array into your `myCall`. Do not reimplement anything.
2. `Array.from` turns an array-like into an array; `?? []` handles the missing case (Ch21 — and
   note `||` would be wrong here for the same reason it is always wrong).

**3 · myNew**
1. Create an object; wire its prototype; run the constructor with `this` set to it; decide what
   to return.
2. `Object.create(Ctor.prototype)` does the first two steps together.
3. The return rule: if the constructor returned an *object*, that wins. `typeof` is the check, and
   remember `typeof null` is `"object"` (Ch21) so `null` must not win.

**4 · myBind**
1. The returned function must behave in two completely different ways depending on how it is
   called. What can it inspect to tell which situation it is in?
2. `new.target` answers that question directly inside a normal function.
3. If you cannot use `new.target`, `this instanceof boundFn` is the classic pre-ES6 test — and
   working out why that works is worth more than the syntax.
4. `.length` and `.name` are not writable by assignment; they need `Object.defineProperty`
   (Ch11 — they are configurable but not writable).

**5 · debounce**
1. One timer id in the closure. Every call clears it and sets a new one.
2. For `leading`, you need to know whether a timer was already pending *before* this call.
3. `cancel` and `flush` need the pending arguments stored, not just the timer id.

**6 · throttle**
1. Either a timestamp of the last invocation, or a boolean gate with a timer to reopen it. Pick
   one; they behave differently at the trailing edge.
2. For trailing, the last call inside the window must be *saved*, and fired when the window ends.
3. If you find yourself with both a timestamp and a timer, decide which one owns the truth.

---

## What to verify

- [ ] Every problem attempted with a **timer running** and the time recorded.
- [ ] Whether the tests passed on the first run — that number is the real score.
- [ ] `myCall`'s temporary key cannot collide, and is cleaned up even when `fn` throws.
- [ ] `myApply` reuses `myCall` rather than duplicating it.
- [ ] You can name all four things `new` does, out loud, without notes.
- [ ] `myNew`'s return rule handled, including that `null` must not win.
- [ ] **`myBind` handles `new`**, and you can explain how the returned function detects it.
- [ ] `.length` and `.name` on the bound function match the real `bind`.
- [ ] You volunteered `cancel` on `debounce` without being prompted.
- [ ] You can state debounce vs throttle in one sentence, cold.
- [ ] A problem is **done** when you can write it clean, inside the target, twice, a week apart.
