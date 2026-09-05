# Chapter 21 — `undefined`, `null`, and Missing: Revision Notes

*This is the file to read the morning of an interview. Mechanism only, no prose.*
*Spoken answers with timings: `interview.md`. Full 20-minute round: `mock.md`.*

## The eight facts

1. **Five states, not two:** holds a value · holds `undefined` · holds `null` · absent · array hole.
   Only `in` / `Object.hasOwn` separates "holds `undefined`" from "absent".
2. **`undefined` is what the LANGUAGE produces; `null` is what YOU or an API assign.** No JS
   operation ever produces a `null` on its own.
3. **`typeof null === "object"`** — a 1995 tag-bits bug, unfixable (web compat).
4. **`null == undefined` is `true`** and nothing else is. But **`null >= 0` is `true`** while
   `null == 0` is `false` — different algorithms.
5. **`||` tests falsy (8); `??` tests nullish (2).** The gap: `0 · "" · false · NaN · -0 · 0n`.
6. **`?.` short-circuits the WHOLE chain**, not one link. A parenthesis ends the chain.
7. **Default params + destructuring defaults fire on `undefined` ONLY.** `null` goes through.
8. **`arguments.length` is the only way to tell "not passed" from "passed `undefined`"** — and
   arrows don't have it.

---

## The design rule (this is the answer to "when do you use each")

```
   undefined  →  the SYSTEM has nothing    (nobody decided)
   null       →  SOMEONE decided nothing   (an explicit, recorded absence)
```

`PATCH { "nickname": null }` = delete it. Omitting the key = don't touch it. Flatten both to
"missing" and you cannot express deletion. **That is why the difference matters.**

---

## Five states

```
const user = { name: "ada", nickname: undefined, deleted: null };   // email absent
```

| key | read | `in` | `hasOwn` | `!== undefined` | in `Object.keys` |
|---|---|---|---|---|---|
| `name` | `'ada'` | true | true | true | true |
| `nickname` | `undefined` | **true** | **true** | false | true |
| `deleted` | `null` | true | true | true | true |
| `email` | `undefined` | **false** | **false** | false | false |
| `toString` | `[Function]` | **true** | **false** | true | false |

**A read cannot tell `nickname` from `email`.** `in` walks the prototype chain; `hasOwn` doesn't.

| check | question it asks |
|---|---|
| `obj.k !== undefined` | is there a usable value — conflates absent with `undefined` |
| `"k" in obj` | reachable at all, **including inherited** |
| `Object.hasOwn(obj, "k")` | did *this* object declare it — usually the one you want |
| `Object.keys(o).includes(k)` | own **and enumerable** — and allocates |

`Object.hasOwn` (ES2022) replaced `Object.prototype.hasOwnProperty.call(o, k)`; the long spelling
existed because an object can own a key named `hasOwnProperty`, or have no prototype
(`Object.create(null)`).

**`delete o.a` ≠ `o.a = undefined`:**
```
after o.a = undefined : "a" in o -> true    Object.keys -> ['a']
after delete o.a      : "a" in o -> false   Object.keys -> []
```

**Scale, measured on a 50,000-key object:**
```
'k' in obj                     : 37 ns/op
Object.keys(obj).includes('k') : 19.3 ms/op   (528,000x slower)
```
Both correct; one allocates a 50k array per call. *Fine for a ten-key options object, wrong for a
cache.*

---

## Where each comes from

Six sources of `undefined`, zero of `null`:

```
no return statement · missing property · uninitialised let · missing argument ·
array hole read · void operator
```

### `typeof null`

```
typeof null            : "object"        <- the bug
null instanceof Object : false           <- the language contradicting itself
Object.prototype.toString.call(null)     : [object Null]
```
Original tag bits: `000` = object; `null` was the all-zero machine pointer. Proposed fix rejected in
ES4 — too much deployed code branches on `typeof x === "object"`.

### `undefined` is an identifier, `null` is a literal

```
descriptor of globalThis.undefined: { value: undefined, writable: false, enumerable: false, configurable: false }
undefined = 42   ->  silently ignored (sloppy) / TypeError (strict)
```

**Still shadowable in a local scope:**
```javascript
function shadow(undefined) { return [undefined, typeof undefined, undefined === void 0]; }
shadow("surprise")  //  [ 'surprise', 'string', false ]
```
→ why minifiers emit `void 0` (unshadowable operator, 2 chars shorter). In your own code use
`undefined`; the threat died in ES5.

---

## Equality and the relational trap

```
null == undefined   true      null >= 0   TRUE     <- the trap
null === undefined  false     null >  0   false
null == 0           false     null <= 0   true
null == false       false     undefined >= 0   false
```

- **`==` has a hard-coded special case:** `null` and `undefined` are loosely equal to each other and
  to *nothing else*. **No coercion is attempted.**
- **Relational operators coerce with `ToNumber`.** `Number(null)` is `0`, so `null >= 0` is `0 >= 0`.
- `Number(undefined)` is `NaN` → every comparison false (Ch19).

**Say:** *`null >= 0` and `null == 0` disagree because they're different algorithms — `>=` coerces,
`==` special-cases nullish and coerces nothing.*

**The one `==` worth keeping:** `x == null` ≡ `x === null || x === undefined`, nothing else.
Lint config: `eqeqeq: ["error", "always", { null: "ignore" }]`.

---

## `||` vs `??`

```
falsy (8) : false · 0 · -0 · 0n · "" · null · undefined · NaN
nullish(2):                          null · undefined
```

Both short-circuit; both return an **operand**, not a boolean. Only the test differs.

```javascript
const opts = { retries: 0, prefix: "", verbose: false, timeout: undefined };
```

| field | `\|\|` | `??` |
|---|---|---|
| `retries: 0` | **3** ← "no retries" became three | 0 |
| `prefix: ""` | **'app'** | `''` |
| `verbose: false` | **true** ← opt-out became opt-in | false |
| `timeout: undefined` | 1000 | 1000 ← the only agreement |

**When you DO want `||`:** when falsy genuinely means absent for that type — a form field where
`""` and "not filled in" are the same thing. "Always use `??`" is a rule-repeater's answer.

**Cannot be mixed — parse error, not lint:**
```
null ?? false || true   ->  SyntaxError: Unexpected token '||'
(0 ?? 1) || 2  ->  2          0 ?? (1 || 2)  ->  0      <- genuinely different
```
The committee refused to pick a precedence because either choice silently does the other thing.

**Logical assignment skips the WRITE:**
```javascript
target.v ??= 9;   // [get v]              — 0 is not nullish -> NO SET
target.v ||= 9;   // [get v] [set v] 9    — 0 is falsy -> SET
```
`x = x ?? y` always calls the setter; `x ??= y` doesn't. Matters for setters, `Proxy` traps,
reactive dependency tracking, frozen objects.

**`??` cannot save you from the read:**
`cfg.db.host ?? "localhost"` → `TypeError` when `db` is `null`. That needs `?.`.

---

## Optional chaining

```javascript
const a = { b: null };
a.b?.c.d.e      // undefined — the WHOLE remaining chain is skipped
(a.b?.c).d      // TypeError — parentheses END the chain
```

**You do not need `a?.b?.c?.d`.** Writing it says you think each `?.` guards its own link.

Three forms: `a?.b` · `a?.()` (checks the thing being *called* — `options.onDone?.()`) · `a?.[k]`.

**Skips argument evaluation:** `noFn.run?.(arg())` → `arg()` never runs.

**What it does NOT do:**
```
throwy?.x      -> "getter blew up"   only guards null/undefined, not other errors
a.b?.c + 1     = NaN                 does not make the RESULT safe
a?.b = 1       -> SyntaxError: Invalid left-hand side in assignment
delete a?.zzz  -> true               delete IS allowed
```

**The smell:** `user?.profile?.settings?.theme?.color` = four statements that you don't know your
data's shape. Ask which one can actually be missing; usually one, and the rest hide the next
structural change.

**Different questions:** `?.` = "can I read through this?" · `??` = "is what I got absent?"

---

## Default parameters

**Fires iff the argument is `undefined`.**

```
greet()          -> world      greet(null) -> null    <- null is a value
greet(undefined) -> world      greet("")   -> ""      greet(0) -> 0
```

**A default is `!== undefined`, not `??`** — narrower than `??`, which also catches `null`. Two
features added for the same reason, with different rules. Common wrong answer.

Destructuring is identical — which is what makes `= {}` work:
```javascript
({ retries = 3, tag = "app" } = {})
show({ retries: 0 })         -> 0        show({ retries: null }) -> null
show({ retries: undefined }) -> 3
```

**Evaluated at CALL time, left to right, in their own scope:**
```
counter(), counter(), counter()  ->  1 2 3    (no shared-mutable-default trap, unlike Python)
ordered(a=1, b=a+1, c=b+1)       ->  [1,2,3];  ordered(10) -> [10,11,12]
(a = b, b = 2)  ->  ReferenceError: Cannot access 'b' before initialization   <- param TDZ
```

**A default makes the parameter list "non-simple", which changes two other things:**
```
without a default: arguments is MAPPED   -> arguments[0]="changed" changes x
with a default:    arguments is NOT      -> x unchanged
"use strict" directive in the body -> SyntaxError: Illegal 'use strict' directive in function
                                      with non-simple parameter list
```
(Also triggered by rest params and destructuring patterns.) Irrelevant in a module — already strict.

**The thing you cannot do:**
```
probe()          -> { value: undefined, argsLength: 0 }
probe(undefined) -> { value: undefined, argsLength: 1 }
```
`arguments.length` is the only discriminator; **arrow functions don't have it**. If the distinction
matters, take an options object and use `in`.

---

## Across boundaries

**JSON — `undefined` is not representable:**
```
JSON.stringify({ a:1, b:undefined, c:null, d:()=>{}, e:Symbol() })  ->  {"a":1,"c":null}
JSON.stringify([1, undefined, null, ()=>{}, Symbol()])              ->  [1,null,null,null,null]
```
Object: key **omitted**. Array: value becomes **null** (length must survive).
`structuredClone` keeps `undefined`, key and all.

**Spread copies an explicit `undefined` over a default:**
```
{ ...defaults, ...{} }                     -> { retries: 3 }
{ ...defaults, ...{ retries: undefined } } -> { retries: undefined }
```
The real-world form: `{ ...defaults, retries: opts.retries }` **erases the default** whenever the
caller didn't set it. Build the override from present keys, or `??` per field.

**Array holes are the fifth state:**
```
holey=[1,,3]                dense=[1,undefined,3]
1 in holey  -> false        1 in dense -> true
holey.map(()=>9) -> [9, <1 empty item>, 9]     callback SKIPPED, hole preserved
Object.keys      -> ['0','2']  vs  ['0','1','2']
[...holey]       -> [1, undefined, 3]          iteration FILLS holes
holey.includes(undefined) -> true   holey.indexOf(undefined) -> -1
new Array(3) -> [<3 empty items>]   new Array(3).fill() -> [undefined x3]
```
- **Old methods skip holes** (`map`/`forEach`/`filter`/`reduce`); **iteration doesn't** (`for...of`,
  spread, `Array.from`). Converting a `forEach` to `for...of` can change the iteration count.
- `includes` uses SameValueZero over every index; `indexOf` skips holes. Hence the disagreement.
- `new Array(3).map(...)` does nothing; `Array.from({length:3}, ...)` works.

**`Map.get` can't tell, `Map.has` can.** A cache storing `undefined` as a real value and testing
`if (cache.get(k))` misses every time — a cache that silently does nothing.

---

## API conventions — three answers for "not found"

| returns `undefined` | returns `null` | returns `-1` |
|---|---|---|
| `find`, `at`, `Map.get`, `obj.missing` | `match`, `exec`, `getPrototypeOf`, DOM `getElementById`/`querySelector` | `findIndex`, `indexOf` |

Regex/DOM are `null` because they date from the Java-influenced original design; array search is
`undefined` because it's ES5+; indexes are `-1` from C. **Nothing enforces consistency** — which is
why a generic "is it missing" helper has to be `x == null`.

```javascript
JSON.parse('{"name": null}').name.toUpperCase()   // TypeError — types said string, JSON said null
```
`JSON.parse` returns `any`. **Validate at the boundary; typing it isn't enough.**

---

## What JS cannot do

| Can't | Why |
|---|---|
| tell "not passed" from "passed `undefined`" | only `arguments.length`, and arrows lack it |
| represent `undefined` in JSON | the format has one null |
| make `??` see a missing key vs one holding `undefined` | both are `undefined` by the time it runs — ask with `in`, before the read |
| fix `typeof null` | rejected on web-compat grounds |
| stop `?.` producing an `undefined` | it converts a throw into a value; the value is then your problem |

---

## The one sentence

> **`undefined` is the absence the language produces when nobody supplied a value; `null` is an
> absence somebody chose — and every operator here differs only in which of those two, or which of
> the eight falsy values, it treats as "not there".**

```
                        falsy (8)
        ┌───────────────────────────────────────┐
        │  false   0   -0   0n   ""   NaN       │
        │      ┌─────────────────────────┐      │
        │      │  nullish (2)            │      │
        │      │    null    undefined    │      │
        │      └─────────────────────────┘      │
        └───────────────────────────────────────┘
                 ▲                    ▲
          ||  falls back here   ??  falls back here
                                default params: undefined ONLY
```

| Question | Operator |
|---|---|
| is the value absent (null or undefined)? | `x ?? fallback` · `x == null` |
| is the value falsy? | `x \|\| fallback` |
| can I read through this? | `a?.b` |
| is the key there at all? | `"k" in obj` · `Object.hasOwn(obj, "k")` |
| was the argument supplied? | `arguments.length` — or options object + `in` |
| is it exactly undefined? | `x === undefined` · `x === void 0` |

```
   the state        reads as     `in`     ||       ??       default param
   holds a value    the value    true     keeps    keeps    keeps
   holds undefined  undefined    TRUE     falls    falls    FALLS
   holds null       null         TRUE     falls    FALLS    keeps   ← the asymmetry
   absent           undefined    false    falls    falls    FALLS
   array hole       undefined    false    falls    falls    n/a
```

---

## Rapid fire

- **`typeof null`?** `"object"`. `null instanceof Object` is `false`.
- **`typeof undefined`?** `"undefined"`.
- **Is `undefined` a keyword?** No — a non-writable global property. `null` is a literal.
- **Can `undefined` be shadowed?** Yes, as a parameter or local. Hence `void 0`.
- **`null == undefined`?** `true`. **`null === undefined`?** `false`.
- **`null == 0`?** `false`. **`null >= 0`?** `true`. Different algorithms.
- **`undefined >= 0`?** `false` — `Number(undefined)` is `NaN`.
- **How many falsy values?** Eight. **Nullish?** Two.
- **`0 || 3`?** `3`. **`0 ?? 3`?** `0`.
- **`a ?? b || c`?** `SyntaxError`. Parenthesise.
- **Does `??=` write when the value is `0`?** No — it short-circuits the assignment.
- **`a.b?.c.d` when `b` is null?** `undefined` — the whole chain short-circuits.
- **`(a.b?.c).d`?** `TypeError` — parentheses end the chain.
- **Does `?.` catch a throwing getter?** No. Only `null`/`undefined`.
- **`a?.b = 1`?** `SyntaxError`. But `delete a?.b` is legal.
- **`f(null)` with `function f(x = 1)`?** `null`. Defaults fire on `undefined` only.
- **`{ a = 1 } = { a: null }`?** `null`. Same rule.
- **Are defaults evaluated once?** No — every call, left to right, with their own TDZ.
- **What does adding a default break?** The `arguments` mapping, and a `"use strict"` body directive.
- **Tell "not passed" from "passed undefined"?** `arguments.length` only. Not in an arrow.
- **`JSON.stringify({a: undefined})`?** `{}` — key dropped.
- **`JSON.stringify([undefined])`?** `[null]`.
- **`1 in [1,,3]`?** `false`. **`[1,,3].map(()=>9)`?** `[9, <hole>, 9]`.
- **`[...[1,,3]]`?** `[1, undefined, 3]` — iteration fills holes.
- **`[1,,3].includes(undefined)` vs `.indexOf(undefined)`?** `true` vs `-1`.
- **`Map.get` on a stored `undefined`?** Indistinguishable from missing. Use `.has`.
- **`find` vs `match` on no result?** `undefined` vs `null` — era, not logic.
- **Check a key exists?** `Object.hasOwn(o, k)`. Not `Object.keys().includes()` at scale.
