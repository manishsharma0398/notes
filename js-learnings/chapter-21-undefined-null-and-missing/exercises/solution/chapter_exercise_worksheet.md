# Chapter 21 Worksheet — `undefined`, `null`, and Missing

Work entirely in this file. Each question has its answer block **directly underneath it** — no
scrolling. **Predict before running.** A prediction you checked first is worth nothing.

For every answer, name the **state** — *holds a value*, *holds `undefined`*, *holds `null`*,
*absent*, *array hole* — and the **rule**: "`==` special-cases nullish", "relational coerces with
ToNumber", "falsy not nullish", "whole chain short-circuits", "defaults fire on `undefined` only",
"own-and-enumerable", "old methods skip holes", "spread creates the key".

Plain `node file.js` is enough for everything here.

---

## Program 1 — The five states

### A · what each check answers

```javascript
const user = { name: "ada", nickname: undefined, deleted: null };
for (const k of ["name", "nickname", "deleted", "email", "toString"]) {
  console.log(k, user[k], k in user, Object.hasOwn(user, k), user[k] !== undefined, Object.keys(user).includes(k));
}
```

```
             read        in     hasOwn   !==undef   inKeys
name     :
nickname :
deleted  :
email    :
toString :

the two rows a READ cannot distinguish:

the single check that separates them:

the row that is the reason `in` and `hasOwn` are different functions:
```

---

### B · assignment is not deletion

```javascript
const o = { a: 1, b: 2 };
o.a = undefined;
delete o.b;
console.log("a" in o, "b" in o);
console.log(Object.keys(o), JSON.stringify(o));
console.log(Object.entries(o).length, Object.values(o));
```

```
line 1:
line 2:
line 3:

one real place the difference changes BEHAVIOUR (not cleanliness):
```

---

### C · the untrusted object

```javascript
const bare = Object.create(null);  bare.x = 1;
const hostile = { hasOwnProperty: () => false, x: 1 };
// for each: "x" in obj, Object.hasOwn(obj,"x"), obj.hasOwnProperty("x")
```

```
bare    : in=        hasOwn=        hasOwnProperty=
hostile : in=        hasOwn=        hasOwnProperty=

the pre-ES2022 spelling that survives both:

what each part of it defends against:
```

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

```
1:
2:
3:
4:
5:

the pair that disagrees about whether null is an object:

which one tells the truth about the language, and why:

what the last two lines do inside an ES module, and why:
```

---

### E · shadowing

```javascript
function f(undefined) { return [undefined, typeof undefined, undefined === void 0, undefined == null]; }
console.log(f("surprise"));
console.log(f());
```

```
f("surprise"):

f():

why void 0 exists:

why you should still write `undefined` in your own code:
```

---

### F · six sources

```javascript
function noReturn() {}
const obj = {}; let declared;
console.log([noReturn(), obj.missing, declared, ((a) => a)(), [1, , 3][1], void 0]);
console.log(new Set([noReturn(), obj.missing, declared]).size);
```

```
line 1:
line 2:

how many distinct undefined values are there:

the equivalent answer for null:

a language operation that produces null on its own (and whether it counts):
```

---

## Program 3 — Comparison

### G · the trio

```javascript
console.log(null == 0, null >= 0, null > 0, null <= 0);
console.log(undefined == 0, undefined >= 0, undefined <= 0);
console.log(null == false, null == "", null == undefined, null === undefined);
console.log(Number(null), Number(undefined), Number(""), Number([]), Number([null]));
```

```
line 1:
line 2:
line 3:
line 4:

algorithm used by ==:

algorithm used by >=:

which value in line 4 explains which result above:
```

---

### H · the guard that lets both through

```javascript
function isAvailable(stock) {
  if (stock > 0) return "in stock";
  if (stock <= 0) return "out of stock";
  return "unknown";
}
console.log([5, 0, null, undefined, "", "3", NaN].map(isAvailable));
```

```
5:          0:          null:       undefined:
"":         "3":        NaN:

the input that takes a plausible branch for the WRONG reason:

the input that reaches "unknown" for a reason unrelated to intent:

the rewrite (one call) that sends every non-number to "unknown":
```

---

## Program 4 — `||`, `??`, and assignment

### I · the options table

```javascript
const opts = { retries: 0, prefix: "", verbose: false, timeout: undefined, tag: null };
// for each key: opts[k] || "FALLBACK"   vs   opts[k] ?? "FALLBACK"
```

```
            ||                    ??
retries :
prefix  :
verbose :
timeout :
tag     :

how many rows differ:

a case where I would deliberately choose || :

what ?? would get wrong there:
```

---

### J · precedence

```javascript
(0 ?? 1) || 2
0 ?? (1 || 2)
(null ?? 1) || 2
eval("0 ?? 1 || 2")
eval("0 || 1 ?? 2")
eval("0 ?? 1 ?? 2")
```

```
1:
2:
3:
4:
5:
6:

how many succeed:

lint rule or language rule:

the argument for the committee's choice:
```

---

### K · the write that doesn't happen

```javascript
const box = { _v: 0, get v() { log.push("get"); return this._v; }, set v(x) { log.push("set " + x); this._v = x; } };
box.v ??= 9;
box.v ||= 9;
box.v &&= 5;
box.v = box.v ?? 100;
```

```
after ??= :  _v=        log=
after ||= :  _v=        log=
after &&= :  _v=        log=
after = ?? : _v=        log=

three situations where the skipped write is the point:
1.
2.
3.
```

---

## Program 5 — Optional chaining

### L · how far the short circuit reaches

```javascript
const a = { b: null, c: { d: undefined } };
a.b?.x.y.z
a.c?.d?.e
a.c.d?.e.f.g
(a.b?.x).y
a.b?.x.y.z()
a.zzz.yyy?.x
```

```
1:
2:
3:
4:
5:
6:

why 3 and 6 differ, in one sentence about where the ?. sits:
```

---

### M · what gets evaluated

```javascript
o.absent?.(bump());        // n after:
o.present?.(bump());       // n after:
o.absent?.[bump()];        // n after:
```

```
after absent      :
after present     :
after computed key:

same rule as `false && sideEffect()` or a different one:

justification:
```

---

### N · what it will not do

```javascript
g?.boom                 // g has a throwing getter
g.val?.length + 1       // g.val is null
typeof (g.missing?.deep)
eval("g?.val = 1")
delete g?.val ; "val" in g
g.missing?.deep ?? "default"
```

```
1:
2:
3:
4:
5:
6:

line 2 produced a value, not an error. how that value causes an incident three services away:
```

---

## Program 6 — Defaults

### O · what fires

```javascript
const f = (a = "DEF") => JSON.stringify(a);
f(), f(undefined), f(null), f(""), f(0), f(false), f(NaN)

const g = ({ x = 1, y = 2 } = {}) => `${x},${y}`;
g(), g({}), g({ x: 0 }), g({ x: null }), g({ x: undefined }), g(null)
```

```
f  :

g  :

g(null):

the rule, in one sentence:

how it differs from ?? (name the one value):
```

---

### P · when they run

```javascript
let calls = 0; const next = () => ++calls;
function h(a = next(), b = a * 10, c = arguments.length) { return [a, b, c]; }
h(), h(), h(5)
eval("(function (p = q, q = 1) {})()")
```

```
h()  :
h()  :
h(5) :
eval :

what the third parameter's default observes:

what it does NOT observe:
```

---

### Q · what a default changes

```javascript
function mapped(x)          { arguments[0] = "B"; return x; }
function withDefault(x = 1) { arguments[0] = "B"; return x; }
function withRest(x, ...r)  { arguments[0] = "B"; return x; }
eval('(function (a = 1) { "use strict"; })')
```

```
mapped("A")      :
withDefault("A") :
withRest("A")    :
eval             :

the single property of the parameter list that explains all four:

why this would never come up in a file I wrote today:
```

---

### R · the question you cannot answer

```javascript
function probe(x) { return [x, arguments.length]; }
const arrow = (x) => [x, typeof arguments];
probe(), probe(undefined), probe(null), arrow(1)
```

```
probe()          :
probe(undefined) :
probe(null)      :
arrow(1)         :

a two-line API that answers "was this supplied?" without arguments.length:

which chapter mechanism it relies on:
```

---

## Program 7 — Boundaries

### S · what survives

```javascript
const src = { a: 1, b: undefined, c: null, d() {}, e: Symbol("s"), f: NaN, g: Infinity };
JSON.stringify(src)
JSON.stringify([1, undefined, null, () => {}, Symbol("s"), NaN])
JSON.parse(JSON.stringify(src))
structuredClone({ a: undefined, b: null })   // and "a" in clone
```

```
1:
2:
3:
4:

the three values that collapse to the same JSON output:

what each becomes in an object / in an array:

which round-trip is safe as a deep copy, and what Ch18 said:
```

---

### T · the spread bug

```javascript
{ ...DEFAULTS, ...{} }
{ ...DEFAULTS, ...{ retries: undefined } }
{ ...DEFAULTS, retries: missing.retries }
Object.assign({}, DEFAULTS, { retries: undefined })
```

```
1:
2:
3:
4:

why 1 and 3 are not the same operation:

the version of 3 that behaves like 1:
```

---

### U · holes

```javascript
const holey = [1, , 3]; const dense = [1, undefined, 3];
holey.length, 1 in holey, 1 in dense, Object.keys(holey)
holey.map(x => 9), dense.map(x => 9)
forEach visits / for..of iters
holey.includes(undefined), holey.indexOf(undefined)
[...holey], Array.from(holey), holey.flat()
new Array(3), new Array(3).fill(), Array.from({length:3}, (_, i) => i)
```

```
1:
2:
3:
4:
5:
6:

the two lines that change if forEach becomes for..of:

algorithm used by includes:

algorithm used by indexOf:
```

---

### V · the container that cannot tell you

```javascript
const m = new Map([["stored", undefined], ["real", 0]]);
// for "stored", "real", "absent":  m.get(k), m.has(k), Boolean(m.get(k))
```

```
stored :
real   :
absent :

the two-line cache-read bug this describes:

the one-word fix:
```

---

## Program 8 — Conventions

### W · three answers for "not found"

```
find           :
at             :
match          :
exec           :
Map.get        :
findIndex      :
indexOf        :
getPrototypeOf :

group 1 (undefined) — historical reason:

group 2 (null) — historical reason:

group 3 (-1) — historical reason:

the single expression that treats groups 1 and 2 uniformly:
```

---

## Build

### 1 · `stateOf(container, key)`

```
test table (one case per state per container type):

  plain object   : value=      undefined=      null=      absent=      hole=
  array          : value=      undefined=      null=      absent=      hole=
  Object.create(null): value=  undefined=      null=      absent=      hole=
  Map            : value=      undefined=      null=      absent=      hole=

container types that cannot produce which states:

for a Map, are "absent" and "holds undefined" distinguishable, and with what:
```

---

### 2 · `resolve(layers, policy)`

```
policy table — key present in layer 1, then in layer 2 as shown:

                              undefinedMeans=skip   undefinedMeans=clear
  layer 2 has undefined  :
  layer 2 has null (nullMeans=clear) :
  layer 2 has null (nullMeans=value) :
  layer 2 absent         :

the combination that makes "unset this" inexpressible:

what I would add to recover it:

how `from` records a layer that CLEARED a value:
```

---

### 3 · `getIn(obj, path, fallback)`

```
getIn returns for:
  path exists, real value      :
  path exists, holds undefined :
  path exists, holds null      :
  path broken at segment 2     :

how I avoided try/catch around the walk:

how I avoided throwing on null mid-path:

why a?.b?.c can NEVER implement this:
```

---

## What to verify

- [ ] Which checks distinguish which of the five states, and the pair nothing distinguishes:
- [ ] The two algorithms behind `null == 0` vs `null >= 0`:
- [ ] The eight falsy values, from memory (including the two people forget):
- [ ] One case where `||` is right and `??` is wrong:
- [ ] Why `a ?? b || c` is a `SyntaxError`, and the argument for it:
- [ ] What `??=` does that `x = x ?? y` doesn't:
- [ ] How far `?.` short-circuits, and the one thing that stops it:
- [ ] Three things `?.` does not protect against:
- [ ] The one value that distinguishes a default parameter from `??`:
- [ ] Two things a default changes besides supplying a value:
- [ ] `undefined` in a JSON object vs a JSON array, and why they differ:
- [ ] Which array methods skip holes and which fill them:
- [ ] The three "not found" conventions and their eras:

---

## The sentences I can now say out loud

*Write these in your own words — they are the ones the round is scored on.*

```
1. When to use null and when to use undefined (one sentence, with a case where it pays):

2. Why null == 0 is false and null >= 0 is true:

3. When you would deliberately choose || over ??:

4. What ?. protects you from, and what it costs:

5. Why a default parameter is not the same as ??:
```
