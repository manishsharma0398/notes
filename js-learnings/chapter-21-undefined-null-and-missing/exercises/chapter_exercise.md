# Chapter 21 — Chapter Exercise: `undefined`, `null`, and Missing

**Time:** 30–60 minutes. **Scope:** this chapter only.
**Worksheet:** `solution/chapter_exercise_worksheet.md` — every question duplicated with a blank
answer block underneath. Work there.

**Predict before you run.** A prediction you checked first is worth nothing. For every answer, name
the **state** — *holds a value*, *holds `undefined`*, *holds `null`*, *absent*, *array hole* — and
the **rule**: "`==` special-cases nullish", "relational coerces with ToNumber", "falsy not nullish",
"whole chain short-circuits", "defaults fire on `undefined` only", "own-and-enumerable", "old
methods skip holes", "spread creates the key".

Plain `node file.js` is enough for everything here.

---

## Program 1 — The five states

### A · what each check answers

```javascript
const user = { name: "ada", nickname: undefined, deleted: null };
const keys = ["name", "nickname", "deleted", "email", "toString"];

for (const k of keys) {
  console.log(k, user[k], k in user, Object.hasOwn(user, k), user[k] !== undefined, Object.keys(user).includes(k));
}
```

*Predict all five rows. Then: which two rows are indistinguishable by **reading** the property, and
which single check separates them? Which row is the reason `in` and `hasOwn` are different
functions?*

### B · assignment is not deletion

```javascript
const o = { a: 1, b: 2 };
o.a = undefined;
delete o.b;
console.log("a" in o, "b" in o);
console.log(Object.keys(o), JSON.stringify(o));
console.log(Object.entries(o).length, Object.values(o));
```

*Predict every value. Then name one real place where the difference between the two changes
behaviour — not "it's cleaner", an actual behavioural difference.*

### C · the untrusted object

```javascript
const bare = Object.create(null);
bare.x = 1;
const hostile = { hasOwnProperty: () => false, x: 1 };

for (const [label, obj] of [["bare", bare], ["hostile", hostile]]) {
  console.log(label, "x" in obj, Object.hasOwn(obj, "x"));
  try { console.log(label, obj.hasOwnProperty("x")); } catch (e) { console.log(label, e.constructor.name); }
}
```

*Predict all six outputs. Then write the pre-ES2022 spelling that survives both cases, and say what
each part of it is defending against.*

---

## Program 2 — Identity

### D · the two of them

```javascript
console.log(typeof undefined, typeof null);
console.log(null instanceof Object);
console.log(Object.prototype.toString.call(null), Object.prototype.toString.call(undefined));
console.log(Object.getOwnPropertyDescriptor(globalThis, "undefined"));
undefined = 42;
console.log(undefined);
```

*Predict everything. Two of these lines disagree about whether `null` is an object — say which pair,
and which one is telling the truth about the language. Then: what would the last two lines do inside
an ES module, and why?*

### E · shadowing

```javascript
function f(undefined) {
  return [undefined, typeof undefined, undefined === void 0, undefined == null];
}
console.log(f("surprise"));
console.log(f());
```

*Predict both arrays. Then explain, in one sentence, why `void 0` exists and why you should still
write `undefined` in your own code.*

### F · six sources

```javascript
function noReturn() {}
const obj = {};
let declared;
console.log([noReturn(), obj.missing, declared, ((a) => a)(), [1, , 3][1], void 0]);
console.log(new Set([noReturn(), obj.missing, declared]).size);
```

*Predict both lines. Then answer the question the second line is really asking: how many distinct
`undefined` values are there, and what is the equivalent answer for `null`? Finally: name a
language operation that produces `null` on its own. (There is a trick here.)*

---

## Program 3 — Comparison

### G · the trio

```javascript
console.log(null == 0, null >= 0, null > 0, null <= 0);
console.log(undefined == 0, undefined >= 0, undefined <= 0);
console.log(null == false, null == "", null == undefined, null === undefined);
console.log(Number(null), Number(undefined), Number(""), Number([]), Number([null]));
```

*Predict all sixteen values. Then explain lines 1 and 2 with **two different algorithms named** —
not with "coercion is weird". The fourth line is the evidence; say which value in it explains which
result above.*

### H · the guard that lets both through

```javascript
function isAvailable(stock) {
  if (stock > 0) return "in stock";
  if (stock <= 0) return "out of stock";
  return "unknown";
}
console.log([5, 0, null, undefined, "", "3", NaN].map(isAvailable));
```

*Predict all seven. Two of the inputs take a branch that looks correct and is wrong for a different
reason each time — identify both. Then rewrite the guard so every non-number returns `"unknown"`,
using one call.*

---

## Program 4 — `||`, `??`, and assignment

### I · the options table

```javascript
const opts = { retries: 0, prefix: "", verbose: false, timeout: undefined, tag: null };
for (const k of Object.keys(opts)) {
  console.log(k, JSON.stringify(opts[k] || "FALLBACK"), JSON.stringify(opts[k] ?? "FALLBACK"));
}
```

*Predict all five rows, both columns. How many rows differ? Then answer the question that decides
the round: **name a case where you would deliberately choose `||`**, and say what `??` would get
wrong there.*

### J · precedence

```javascript
console.log((0 ?? 1) || 2);
console.log(0 ?? (1 || 2));
console.log((null ?? 1) || 2);
try { eval("0 ?? 1 || 2"); } catch (e) { console.log(e.constructor.name, e.message); }
try { eval("0 || 1 ?? 2"); } catch (e) { console.log(e.constructor.name, e.message); }
try { eval("0 ?? 1 ?? 2"); console.log("chaining ?? is", eval("0 ?? 1 ?? 2")); } catch (e) { console.log(e.constructor.name); }
```

*Predict all six. Two of them succeed and four don't — or is it the other way round? Then: is this a
lint rule or a language rule, and what is the argument for the committee's choice?*

### K · the write that doesn't happen

```javascript
const log = [];
const box = {
  _v: 0,
  get v() { log.push("get"); return this._v; },
  set v(x) { log.push("set " + x); this._v = x; },
};

box.v ??= 9;   console.log(box._v, log.join(" | "));
box.v ||= 9;   console.log(box._v, log.join(" | "));
box.v &&= 5;   console.log(box._v, log.join(" | "));
box.v = box.v ?? 100;  console.log(box._v, log.join(" | "));
```

*Predict the log after each line. Then: name three situations where the skipped write is the whole
point of using `??=`.*

---

## Program 5 — Optional chaining

### L · how far the short circuit reaches

```javascript
const a = { b: null, c: { d: undefined } };
console.log(a.b?.x.y.z);
console.log(a.c?.d?.e);
console.log(a.c.d?.e.f.g);
try { console.log((a.b?.x).y); } catch (e) { console.log("4:", e.constructor.name); }
try { console.log(a.b?.x.y.z()); } catch (e) { console.log("5:", e.constructor.name); }
try { console.log(a.zzz.yyy?.x); } catch (e) { console.log("6:", e.constructor.name); }
```

*Predict all six. Lines 3 and 6 look symmetrical and behave differently — say why in one sentence
about where the `?.` sits relative to the failure.*

### M · what gets evaluated

```javascript
let n = 0;
const bump = () => { n++; return 1; };
const o = { present: (x) => x };

o.absent?.(bump());
console.log("after absent:", n);
o.present?.(bump());
console.log("after present:", n);
o.absent?.[bump()];
console.log("after computed key:", n);
```

*Predict all three counts. Then: is this the same rule as `false && sideEffect()`, or a different
one? Justify.*

### N · what it will not do

```javascript
const g = { get boom() { throw new Error("getter"); }, val: null };
try { g?.boom; } catch (e) { console.log("1:", e.message); }
console.log("2:", g.val?.length + 1);
console.log("3:", typeof (g.missing?.deep));
try { eval("g?.val = 1"); } catch (e) { console.log("4:", e.constructor.name, e.message); }
console.log("5:", delete g?.val, "val" in g);
console.log("6:", g.missing?.deep ?? "default");
```

*Predict all six. Then answer: line 2 produced a value rather than an error. Describe, concretely,
how that value causes an incident three services away.*

---

## Program 6 — Defaults

### O · what fires

```javascript
const f = (a = "DEF") => JSON.stringify(a);
console.log([f(), f(undefined), f(null), f(""), f(0), f(false), f(NaN)].join(" "));

const g = ({ x = 1, y = 2 } = {}) => `${x},${y}`;
console.log([g(), g({}), g({ x: 0 }), g({ x: null }), g({ x: undefined })].join(" | "));
try { g(null); } catch (e) { console.log("g(null) ->", e.constructor.name + ":", e.message); }
```

*Predict everything. Then state the rule in one sentence, and say how it differs from `??` — the
difference is one value.*

### P · when they run

```javascript
let calls = 0;
const next = () => ++calls;
function h(a = next(), b = a * 10, c = arguments.length) { return [a, b, c]; }
console.log(h(), h(), h(5));
try { eval("(function (p = q, q = 1) {})()"); } catch (e) { console.log("->", e.constructor.name + ":", e.message); }
```

*Predict all four outputs including `arguments.length` in each case. The third parameter's default
is the interesting one — explain what it observes and what it does not.*

### Q · what a default changes

```javascript
function mapped(x) { arguments[0] = "B"; return x; }
function withDefault(x = 1) { arguments[0] = "B"; return x; }
function withRest(x, ...rest) { arguments[0] = "B"; return x; }
console.log(mapped("A"), withDefault("A"), withRest("A"));
try { eval('(function (a = 1) { "use strict"; })'); } catch (e) { console.log(e.constructor.name + ":", e.message); }
```

*Predict all four. Then: what single property of the parameter list explains all four results, and
why would this never come up in a file you wrote today?*

### R · the question you cannot answer

```javascript
function probe(x) { return [x, arguments.length]; }
const arrow = (x) => [x, typeof arguments];
console.log(probe(), probe(undefined), probe(null));
console.log(arrow(1));
```

*Predict. Then design a two-line API that answers "was this option supplied?" without
`arguments.length` — and say which chapter mechanism it relies on.*

---

## Program 7 — Boundaries

### S · what survives

```javascript
const src = { a: 1, b: undefined, c: null, d() {}, e: Symbol("s"), f: NaN, g: Infinity };
console.log(JSON.stringify(src));
console.log(JSON.stringify([1, undefined, null, () => {}, Symbol("s"), NaN]));
console.log(JSON.parse(JSON.stringify(src)));
const cloned = structuredClone({ a: undefined, b: null });
console.log(cloned, "a" in cloned);
```

*Predict all four. Three different values collapse to the same JSON output — name them and what they
become in each container. Then: which of these round-trips is safe to use as a deep copy, and what
Chapter 18 said about that.*

### T · the spread bug

```javascript
const DEFAULTS = { retries: 3, tag: "app" };
const missing = {};
const explicit = { retries: undefined };
console.log({ ...DEFAULTS, ...missing });
console.log({ ...DEFAULTS, ...explicit });
console.log({ ...DEFAULTS, retries: missing.retries });
console.log(Object.assign({}, DEFAULTS, explicit));
```

*Predict all four. Lines 1 and 3 look like the same operation and are not — explain the difference
in terms of what spread copies. Then write the version of line 3 that behaves like line 1.*

### U · holes

```javascript
const holey = [1, , 3];
const dense = [1, undefined, 3];
console.log(holey.length, 1 in holey, 1 in dense, Object.keys(holey));
console.log(holey.map((x) => 9), dense.map((x) => 9));
let visits = 0; holey.forEach(() => visits++); console.log("forEach visits:", visits);
let iters = 0; for (const _ of holey) iters++; console.log("for..of iters:", iters);
console.log(holey.includes(undefined), holey.indexOf(undefined));
console.log([...holey], Array.from(holey), holey.flat());
console.log(new Array(3), new Array(3).fill(), Array.from({ length: 3 }, (_, i) => i));
```

*Predict every value. Two lines here would change behaviour if someone refactored `forEach` into
`for...of` — identify them. Then: `includes` and `indexOf` disagree on the same array; name the
algorithm each uses.*

### V · the container that cannot tell you

```javascript
const m = new Map([["stored", undefined], ["real", 0]]);
for (const k of ["stored", "real", "absent"]) {
  console.log(k, m.get(k), m.has(k), Boolean(m.get(k)));
}
```

*Predict all nine values. Then: write the two-line cache-read bug this table describes, and the
one-word fix.*

---

## Program 8 — Conventions

### W · three answers for "not found"

```javascript
const results = [
  ["find", [1, 2].find((x) => x > 9)],
  ["at", [1, 2].at(9)],
  ["match", "ab".match(/z/)],
  ["exec", /z/.exec("ab")],
  ["Map.get", new Map().get("k")],
  ["findIndex", [1, 2].findIndex((x) => x > 9)],
  ["indexOf", "ab".indexOf("z")],
  ["getPrototypeOf", Object.getPrototypeOf(Object.create(null))],
];
console.log(results.map(([n, v]) => `${n}=${String(v)}`).join(" "));
```

*Predict all eight. Group them into the three conventions and give the **historical reason** for
each group. Then write the single expression that treats the first two groups uniformly.*

---

## Build

Three primitives. No libraries.

### 1 · `stateOf(container, key)` → which of the five

```javascript
function stateOf(container, key) {
  // -> "value" | "undefined" | "null" | "absent" | "hole"
}
```

It must work for plain objects, arrays, `Object.create(null)`, and a `Map`. `"hole"` is only
possible for arrays. Write the test table first — one case per state per container type — and note
which container types cannot produce which states.

The interesting question to answer in a comment: **for a `Map`, are "absent" and "holds undefined"
distinguishable, and with what?**

### 2 · `resolve(layers, policy)` → layered config

```javascript
function resolve(layers, policy = { undefinedMeans: "skip", nullMeans: "clear" }) {
  // layers: [{ name, values }, ...] lowest priority first
  // -> { value: {...}, from: { key: layerName } }
}
```

Later layers win. But the two policy knobs decide what an *absence in a later layer* does, and the
whole exercise is that these are decisions, not defaults:

- `undefinedMeans: "skip"` — the key is ignored, the earlier layer survives.
- `undefinedMeans: "clear"` — the key is set to `undefined`, erasing the earlier layer.
- `nullMeans: "clear"` / `"value"` — is `null` a deletion or a legitimate value?

`from` must record which layer each final value came from, including when a layer *cleared* it.

Then answer, in the file: **which combination of the two policies makes the resolver unable to
express "unset this"**, and what you would do about it.

### 3 · `getIn(obj, path, fallback)` → a deep read that tells you why

```javascript
function getIn(obj, path, fallback) {
  // -> { value, found: boolean, stoppedAt: number | null }
}
```

`getIn(o, ["a", "b", "c"], 0)`. It must distinguish:

- the path exists and holds a real value;
- the path exists and holds `undefined` (`found: true`, fallback **not** applied);
- the path exists and holds `null`;
- the path is broken at some segment (`stoppedAt` is that index).

Requirements: no `try`/`catch` around the walk, and it must not throw on `null` mid-path. Arrays and
`Object.create(null)` both have to work.

Then write the sentence answering: **why can `a?.b?.c` never implement this?** That is the question
an interviewer asks about optional chaining, and this is its concrete form.

---

## What to verify

- [ ] Which of the five states each of `in`, `hasOwn`, `!== undefined` and `Object.keys` can
      distinguish, and which pair nothing distinguishes.
- [ ] Two different algorithms, named, that explain `null == 0` versus `null >= 0`.
- [ ] The eight falsy values, from memory, including the two people forget.
- [ ] One case where `||` is the right operator and `??` is wrong.
- [ ] Why `a ?? b || c` is a `SyntaxError` and what the argument for that is.
- [ ] What `??=` does that `x = x ?? y` doesn't.
- [ ] How far `?.` short-circuits, and the one thing that stops it.
- [ ] Three things `?.` does not protect you from.
- [ ] The single value that distinguishes a default parameter from `??`.
- [ ] Two things adding a default changes about a function besides the default.
- [ ] What happens to `undefined` in a JSON object versus a JSON array, and why they differ.
- [ ] Which array methods skip holes and which fill them.
- [ ] The three "not found" conventions and their eras.

---

## Hints

<details>
<summary>A/B/C — the five states</summary>

Start from "what can a *read* tell you", and you'll find it collapses three of the five into one
answer. Then ask what each of the other checks adds. For C: two different things can go wrong when
you call a method on data you didn't build — the method being replaced, and there being no method
at all.
</details>

<details>
<summary>D/E/F — identity</summary>

For D: one of those lines is a tag read and one is a spec-level branch. For the module question,
recall what Chapter 20 said is permanently on in module code.

For F's Set question: `undefined` and `null` are primitives, and Chapter 7 covers what that means
for identity. For "an operation that produces `null`": think about what `Object.getPrototypeOf`
returns at the top of a chain, and whether that counts as the language producing one or as a
convention.
</details>

<details>
<summary>G/H — comparison</summary>

Write out what each operator does *before* comparing: one of them has a step that the other one
skips entirely. `Number([])` and `Number([null])` in line 4 are there to show you that the coercion
path is a real algorithm you can trace, not a lookup table.

For H: one input takes the `<= 0` branch when it shouldn't, and one input takes the `"unknown"`
branch — which is right, but for a reason that has nothing to do with your intent.
</details>

<details>
<summary>I/J/K — the operators</summary>

For I's "when would you use `||`": think about a value where the empty case and the absent case are
genuinely the same thing to the person who produced it.

For J: `??` chained with itself is fine; the restriction is specifically about mixing. Ask what
either precedence would silently do to code written expecting the other.

For K: the getter/setter log tells you exactly which internal operations ran. Compare the last line
to the first.
</details>

<details>
<summary>L/M/N — optional chaining</summary>

For L: the rule is that the short circuit covers the rest of the *chain*, and a chain has a
syntactic end. Line 6 has the `?.` in a different position relative to the thing that's missing.

For M: compare with `false && f()`. Both skip, but ask *what unit* is being skipped in each — one
skips an operand, the other skips a suffix of a chain.

For N line 2: the value is not an error, and it is also not a number you'd want. Follow it through a
`JSON.stringify` and see what the next service receives.
</details>

<details>
<summary>O/P/Q/R — defaults</summary>

The rule is a single `===` comparison against a single value. Say which value, and then O's `??`
question answers itself.

For P: `arguments.length` counts what was *passed*, not what the parameters ended up holding. For Q:
there is a term in the spec for a parameter list containing anything other than plain identifiers —
find what it disables.

For R: the design you want turns "was an argument passed" into "is a key present", which is Program
1 arriving again.
</details>

<details>
<summary>S/T/U/V — boundaries</summary>

For S: `JSON.stringify` has a fixed list of things it cannot represent, and its behaviour differs by
*container* because one of them has to preserve indices.

For T: spread copies own enumerable keys. Ask whether `{ k: expr }` creates a key when `expr` is
`undefined` — the answer is the bug.

For U: two different sets of methods, written a decade apart, with two different ideas about what an
absent index means. For V: the `Boolean(m.get(k))` column is the bug in one line.
</details>

<details>
<summary>Build 2 — `resolve`</summary>

Write the policy table before the code: four combinations of the two knobs, and for each, what
happens to a key present in layer 1 and `undefined` in layer 2, and present in layer 1 and `null` in
layer 2. One of those four combinations has no way to express deletion at all — that's the answer
you're asked for.
</details>

<details>
<summary>Build 3 — `getIn`</summary>

The walk needs to stop for a different reason than "the value is undefined". Two separate questions
at each step: can I read through this, and does the key exist here. You already have both from
Program 1, and the second one is what `?.` cannot do.
</details>
