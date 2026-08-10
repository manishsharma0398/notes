# Cumulative Exercise — Chapters 1–9: `introspect`, an Object Inspector

**Time estimate:** 2–3 hours
**Concepts integrated:** Execution model, execution contexts, lexical scope, hoisting, `this`, closures, reference semantics, coercion, and the object model

---

## Project Brief

In Chapter 8's `microtest` you wrote a `stringify` that had to survive symbols, `-0`, and cycles. It worked, but it was still guessing at what an object *is* — it read values and hoped.

`introspect` is the real thing: an object inspector that reports what an object **actually** contains. Own vs inherited. Enumerable vs hidden. Data vs accessor. Symbol keys. Where on the prototype chain each property lives.

This is the tool behind `console.dir`, a debugger's variables pane, and every decent test-failure diff. And it is the one program where **every fact from this chapter is load-bearing** — a naive `for...in` + `obj[key]` implementation gets four separate things wrong, and each wrong thing is a chapter section.

**No frameworks. No libraries. Vanilla JS only.**

---

## What You'll Need From Each Chapter

| Chapter | Concept Applied |
|---|---|
| Ch 1 — Parsing & Execution | Declaration order in your module |
| Ch 2 — Execution Contexts | Recursion depth while walking a deep object graph |
| Ch 3 — Lexical Scope | Nested helpers closing over the `seen` set and options |
| Ch 4 — Hoisting | Mutually recursive helpers — which forms are usable before their definition |
| Ch 5 — `this` Binding | Getters you must *not* call, and why `desc.get.call(obj)` would be the wrong fix |
| Ch 6 — Closures | The inspector as a configured factory: `createInspector(options)` |
| Ch 7 — References | Cycles, shared subtrees, identity vs structure |
| Ch 8 — Coercion | Formatting values without triggering conversion (`${sym}` throws) |
| **Ch 9 — Objects** | **Descriptors, the chain walk, shadowing, enumeration APIs** |

---

## Phase 0 — The Naive Version (write it, then break it)

Start here deliberately:

```javascript
function naiveInspect(obj) {
  const out = {};
  for (const key in obj) out[key] = obj[key];
  return out;
}
```

Now run it against this and write down **four** distinct things it gets wrong:

```javascript
const proto = {
  inheritedThing: 1,
  get expensive() { console.log("GETTER RAN"); return 42; },
};
const target = Object.create(proto);
target.visible = "a";
Object.defineProperty(target, "hidden", { value: "b", enumerable: false });
target[Symbol("tag")] = "c";
target.self = target;

naiveInspect(target);
```

Keep your four answers in a comment at the top of the file. Everything below is fixing them one at a time.

---

## Phase 1 — Walk the Chain

```javascript
function getChain(obj) {
  // TODO Phase 1:
  // - Return an array of every object in obj's prototype chain, nearest first
  // - Do NOT include obj itself
  // - Object.create(null) → []
}

function ownKeysAt(level) {
  // TODO: every own key of `level` — strings AND symbols,
  //       enumerable AND non-enumerable. One API does this.
}
```

**Acceptance:**

```javascript
getChain([]).length;                    // 2  (Array.prototype, Object.prototype)
getChain(Object.create(null)).length;   // 0
getChain(new Date()).length;            // 2
```

---

## Phase 2 — Describe Without Touching

The core rule of the whole project:

> **Never read a property value. Read its descriptor.**

```javascript
function describeProperty(level, key, depth) {
  // TODO Phase 2:
  // - Object.getOwnPropertyDescriptor(level, key)
  // - Accessor property (desc.get or desc.set)?
  //     → report { kind: "accessor", getter: !!desc.get, setter: !!desc.set }
  //     → DO NOT CALL IT
  // - Data property?
  //     → report { kind: "data", value: desc.value }
  // - Always record: depth, enumerable, writable, configurable
}
```

**Why this matters more than it looks:** `obj[key]` on an accessor runs user code. In a debugger that means printing an object can mutate your program, hang, or throw. Reading the descriptor is the only safe inspection primitive — and it is the reason `Object.getOwnPropertyDescriptor` exists.

**Acceptance:**

```javascript
const o = { get boom() { throw new Error("invoked"); } };
inspect(o);   // must NOT throw, and must report boom as an accessor
```

If your inspector throws `"invoked"`, you read where you should have described.

---

## Phase 3 — Merge the Chain, Respecting Shadowing

```javascript
function inspect(obj, options) {
  // TODO Phase 3:
  // - Walk obj + its chain, depth 0, 1, 2, …
  // - Collect every key at every level
  // - A key that appears at MULTIPLE levels must be reported ONCE, at the
  //   depth where lookup would actually stop — and flagged `shadows: true`
  // - options.maxDepth        — stop walking after N prototype levels
  // - options.stopAtObjectPrototype (default true) — otherwise every object
  //   reports toString/valueOf/hasOwnProperty and the output is noise
  // - options.includeNonEnumerable (default true)
}
```

**Acceptance:**

```javascript
const proto = { greet: "proto version", onlyProto: 1 };
const o = Object.create(proto);
o.greet = "own version";

const r = inspect(o);
r.greet;      // { depth: 0, value: "own version", shadows: true }
r.onlyProto;  // { depth: 1, value: 1 }
```

The `shadows` flag is the thing a naive inspector can never tell you, and it is exactly what you want when debugging "why is this property not what I set it to."

---

## Phase 4 — Format Without Coercing

Reuse and harden the `stringify` from `microtest` Phase 4:

```javascript
function format(value) {
  // TODO Phase 4 — must never throw:
  // - Symbols: String(sym), never `${sym}`  (Ch 8 — the template literal throws)
  // - Distinguish "2" from 2, -0 from 0, null from "null" from undefined
  // - Distinguish [] from "" and {} from "[object Object]"
  // - Cycles → "[Circular]"
  // - Functions → "[Function: name]" (a function is an object with a `name`
  //   property — check whether it's own or inherited, it will surprise you)
  // - Objects with a null prototype → "[Object: null prototype]"
  // - Map/Set/Date → something better than "[object Object]"
}
```

**Acceptance — every pair must format differently:**

```javascript
[2, "2"], [0, -0], [null, "null"], [null, undefined],
[[], ""], [{}, "[object Object]"], [1n, 1], [Symbol("x"), "Symbol(x)"],
[new Date(0), 0], [Object.create(null), {}]
```

---

## Phase 5 — Render, and Diff

**5a — Render** a readable tree:

```
Object
├─ visible           "a"                     own
├─ hidden            "b"                     own, non-enumerable
├─ Symbol(tag)       "c"                     own, symbol
├─ self              [Circular]              own
├─ inheritedThing    1                       proto (depth 1)
└─ expensive         <getter>                proto (depth 1), not invoked
```

**5b — Diff two objects.** This is where the chapter pays off, because a useful diff must distinguish four cases a naive one collapses into "different":

- value differs
- key is own in one, inherited in the other (**same value, different origin**)
- key is enumerable in one, hidden in the other
- key is a data property in one, an accessor in the other

```javascript
const a = { x: 1 };
const b = Object.create({ x: 1 });

diff(a, b);
// NOT "identical" — same value, but own vs inherited.
// A JSON- or Object.keys-based diff reports these as equal. Yours must not.
```

Then wire it in: make `microtest`'s failure output use `introspect`'s renderer.

---

## Success Criteria

- [ ] Phase 0: Four distinct defects of the naive version, written down
- [ ] Phase 1: `getChain` handles null-prototype objects
- [ ] Phase 2: Getters are reported, never invoked — the `boom` test does not throw
- [ ] Phase 2: Non-enumerable and symbol keys are found
- [ ] Phase 3: Shadowed keys appear once, at the correct depth, flagged
- [ ] Phase 3: `stopAtObjectPrototype` keeps output readable
- [ ] Phase 4: All ten ambiguity pairs format differently; `format` never throws
- [ ] Phase 5a: Tree render, cycles shown as `[Circular]`
- [ ] Phase 5b: `diff` distinguishes own-vs-inherited for identical values
- [ ] Phase 5b: Wired into `microtest`'s failure output

---

## Hints

<details>
<summary>Hints (read only if stuck)</summary>

**Phase 0** — the four defects: inherited properties are mixed in with own ones indistinguishably; non-enumerable properties are missing; symbol keys are missing; the getter *runs*. (A fifth, if you passed a cyclic object: infinite recursion once you make it recursive.)

**Phase 1** — `Reflect.ownKeys(level)` is the one API that returns strings **and** symbols, enumerable **and** not.

**Phase 2** — an accessor descriptor has `get`/`set` and **no `value` field at all**. Test with `if ("value" in desc)` or `if (desc.get || desc.set)`, never by reading `desc.value` and checking for `undefined` — a data property can legitimately hold `undefined`.

**Phase 3** — walk depth 0 upward and record a key only if you haven't seen it. The first level that has it is where lookup would stop, so first-wins is automatically the shadowing rule. Track `seenKeys` in a `Set`; remember symbols work fine as Set members.

**Phase 4** — dispatch on `typeof` first; it is the only way to separate `1n` from `1` and a symbol from a string. For cycles, thread a `WeakSet` down the recursion exactly as `deepFreeze` did in Chapter 7.

**Phase 5b** — for each key present in either object, compare the full *descriptor plus depth*, not just the value. Two properties are "the same" only if value, kind, flags, and origin all match.

**The `name` surprise in Phase 4:** check `Object.hasOwn(function foo(){}, "name")`. Then check it on an arrow function assigned to a variable. Then on `function(){}` assigned to a variable. The answers explain a lot of confusing stack traces.

</details>

---

## Notes

- Write everything in `exercises/solution/introspect.js`
- Closures and factory functions — no classes
- `getChain`, `describeProperty`, `format`, and `diff` should each be independently testable
- Keep your Phase 0 answers and any written reasoning as comments — they are part of the deliverable
- When you finish, you have a debugger's core. Point it at `timelapse` and `microtest` and see what they actually contain.
