# Chapter 21 — `undefined`, `null`, and Missing

Why `null >= 0` is `true` while `null == 0` is `false`, why `||` erases a `0` you meant to keep,
why `f(null)` skips the default and `f(undefined)` doesn't, and why a config value can vanish
between two services that both "support JSON".

Chapter 20 was about bindings that exist without holding a value. This one is about *values* that
mean "there is nothing here" — and the fact that JavaScript has **two** of them, plus three more
ways for a thing to not be there, and none of them are interchangeable.

> **Read this box first.** Eight facts.
>
> 1. **There are five states, not two.** A property can hold a value, hold `undefined`, hold
>    `null`, be absent, or — in an array — be a *hole*. Only `in` and `Object.hasOwn` can tell
>    "present but `undefined`" from "absent".
> 2. **`undefined` is what the language produces; `null` is what you or an API assign.** No
>    JavaScript operation ever hands you a `null` you didn't ask for.
> 3. **`typeof null === "object"`** is a 1995 implementation bug that can never be fixed.
> 4. **`null == undefined` is `true`** and is the only loose-equality special case worth using —
>    but **`null >= 0` is `true` while `null == 0` is `false`**, because relational operators
>    coerce and `==` special-cases nullish.
> 5. **`||` tests *falsy* (eight values); `??` tests *nullish* (two).** The gap between them is
>    `0`, `""`, `false`, `NaN`, `-0` and `0n` — every one of which is a legitimate config value.
> 6. **`?.` short-circuits the whole chain, not one link** — and a parenthesis ends the chain.
> 7. **Default parameters and destructuring defaults fire on `undefined` only.** `null` is a
>    value, and it goes straight through.
> 8. **`arguments.length` is the only way to distinguish "not passed" from "passed `undefined`"** —
>    and arrow functions don't have it.

---

## How this chapter is examined

This is a *follow-up* topic more than an opener: it turns up as the second question after
coercion, after error handling, or in a code review. What is actually being scored is whether you
treat absence as a modelling decision rather than a nuisance — which shows up in one question,
**"when would you use `||` instead of `??`?"** (Part 4), and in one code smell,
`a?.b?.c?.d` (Part 5).

| Asked directly, almost every time | Read for mechanism, rarely asked alone |
|---|---|
| "`null` vs `undefined` — when do you use each?" (Part 0) | Why `typeof null` is `"object"` (Part 2) |
| "`??` vs `||`?" (Part 4) | Logical assignment skipping the write (Part 4) |
| *"When would you deliberately want `||`?"* (Part 4) | `void 0` and the shadowing history (Part 2) |
| "What does `?.` actually protect you from?" (Part 5) | `?.` skipping argument evaluation (Part 5) |
| "Why doesn't the default fire for `null`?" (Part 6) | Unmapped `arguments` (Part 6) |
| "How do you check a key exists?" (Part 1) | Array holes vs `undefined` (Part 7) |
| "`typeof null`?" (Part 2) | `structuredClone` vs `JSON` (Part 7) |
| "What happens to `undefined` in JSON?" (Part 7) | Parameter TDZ (Part 6) |

**The spoken answers, timed, are in `interview.md`. The 20-minute round is in `mock.md`.**

Every output block came from the files in `examples/`, on Node 22.13.0. Run them with
`node examples/01_four_kinds_of_absence.js`.

---

## Part 0 — Why there are two of them

The one-line history matters because it *is* the answer to "when do you use each".

JavaScript was built in ten days in 1995 under instructions to look like Java. Java has `null`,
so JavaScript got `null` — the "no object" value, with the object type tag. But JavaScript also
needed something for *"this variable exists and hasn't been given a value yet"*, which in a
statically typed language can't happen. That's `undefined`.

The distinction that survived is a distinction about **who decided**:

```
   undefined  →  the SYSTEM has nothing for you
                 nobody made a decision; the value was never supplied

   null       →  SOMEONE decided there is nothing
                 an explicit, recorded absence
```

That's the whole convention, and it's worth stating as a design rule rather than trivia:

> **`undefined` means "unset". `null` means "deliberately empty".**
> A field the user never filled in is `undefined`. A field the user cleared is `null`.

The practical value shows up in an API: `PATCH { "nickname": null }` means *delete the nickname*,
while omitting the key means *don't touch it*. If you flatten both to "missing", you cannot express
deletion. That distinction is why every serious patch format keeps them apart, and it's the answer
that scores when an interviewer asks whether the difference matters.

---

## Part 1 — Five states of absence

`examples/01_four_kinds_of_absence.js`:

```javascript
const user = {
  name: "ada",
  nickname: undefined,   // present, holds undefined
  deleted: null,         // present, holds null
};                       // `email` is absent entirely
```

```
┌────────────┬──────────────────────┬───────┬────────┬───────────────┬────────┬───────────┐
│ key        │ read                 │ in    │ hasOwn │ !== undefined │ inKeys │ inEntries │
├────────────┼──────────────────────┼───────┼────────┼───────────────┼────────┼───────────┤
│ 'name'     │ 'ada'                │ true  │ true   │ true          │ true   │ true      │
│ 'nickname' │ undefined            │ true  │ true   │ false         │ true   │ true      │
│ 'deleted'  │ null                 │ true  │ true   │ true          │ true   │ true      │
│ 'email'    │ undefined            │ false │ false  │ false         │ false  │ false     │
│ 'toString' │ [Function: toString] │ true  │ false  │ true          │ false  │ false     │
└────────────┴──────────────────────┴───────┴────────┴───────────────┴────────┴───────────┘
```

Read the `nickname` and `email` rows together: **reading the property gives you `undefined` for
both.** A read cannot tell you which one you have. Only `in` and `Object.hasOwn` can, and they
disagree on the `toString` row — `in` walks the prototype chain, `hasOwn` doesn't.

So the four checks are four different questions:

| Check | Answers |
|---|---|
| `obj.k !== undefined` | "is there a usable value here" — conflates absent with `undefined` |
| `"k" in obj` | "can this name be reached at all" — includes inherited |
| `Object.hasOwn(obj, "k")` | "did *this* object declare it" — the one you almost always want |
| `Object.keys(obj).includes("k")` | own **and enumerable** — and it allocates |

`Object.hasOwn` (ES2022) replaced `Object.prototype.hasOwnProperty.call(obj, k)`, and the reason
for the awkward old spelling is worth knowing: an object can have its own property named
`hasOwnProperty`, or no prototype at all (`Object.create(null)`), so `obj.hasOwnProperty(k)` is not
safe on data you didn't build.

### `delete` and `= undefined` are not the same thing

```
after o.a = undefined : true [ 'a' ]
after delete o.a      : false []
```

Assigning `undefined` leaves the key. This matters wherever the key itself is the signal — a
`PATCH` body, a serialised payload, an `Object.keys` loop, a schema validator that rejects unknown
keys.

### Scale caveat, measured

`examples/08_api_conventions.js` ends with a benchmark on a 50,000-key object:

```
'k' in obj                     : 37 ns/op
Object.keys(obj).includes('k')  : 19.3 ms/op   (528,000x slower)
```

Both are correct. One allocates a 50,000-element array on every call. **Fine for a ten-key options
object, wrong for a cache** — and this is exactly the kind of line to volunteer unprompted, because
the two spellings look equally innocent in review.

---

## Part 2 — Where each value comes from

`examples/02_typeof_and_identity.js`. Six ways the language hands you `undefined`:

```
no return statement   : undefined
missing property      : undefined
uninitialised let     : undefined
missing argument      : undefined
array hole read       : undefined
void operator         : undefined
```

And **zero** ways it hands you `null`. Every `null` in your program was written by you, by a
library, or by a host API that chose that convention. That asymmetry is the mechanism behind the
rule in Part 0 — it isn't a style preference, it's what the language actually does.

### `typeof null === "object"`

```
typeof undefined : undefined
typeof null      : object
null instanceof Object: false
Object.prototype.toString.call(null)     : [object Null]
Object.prototype.toString.call(undefined): [object Undefined]
```

The original implementation stored a type tag in the low bits of every value, and `000` meant
"object". `null` was the machine null pointer — all zero bits — so it read as an object. It was
proposed for a fix in ES4 and rejected on web-compatibility grounds: too much code branches on
`typeof x === "object"`.

Note the third line. `typeof null` says `"object"` and `null instanceof Object` says `false`, which
is as close as the language gets to admitting the bug. `Object.prototype.toString` gets it right,
because that's a spec-level branch rather than a tag read.

### `undefined` is an identifier; `null` is a literal

```
descriptor of globalThis.undefined: { value: undefined, writable: false, enumerable: false, configurable: false }
after `undefined = 42`, undefined is: undefined
```

`null` is a keyword the parser knows. `undefined` is a *property of the global object* that happens
to hold the undefined value — which is why it needed to be made non-writable in ES5. Before that,
`undefined = 42` at the top of a script was a real attack.

It is still shadowable in a local scope:

```javascript
function shadow(undefined) {
  return [undefined, typeof undefined, undefined === void 0];
}
shadow("surprise")  //  [ 'surprise', 'string', false ]
```

That is why minifiers emit `void 0` instead of `undefined`: `void` is an operator that evaluates its
operand and returns the genuine undefined value, and it can't be shadowed. It's also two characters
shorter. In your own code, use `undefined` — the shadowing threat has been dead since ES5, and
`void 0` reads as noise to anyone who hasn't seen this chapter.

---

## Part 3 — Equality, and the relational trap

`examples/03_equality_and_relational.js`:

```
┌──────────────────────────────┬────────┐
│ expression                   │ result │
├──────────────────────────────┼────────┤
│ 'null == undefined'          │ true   │
│ 'null === undefined'         │ false  │
│ 'null == false'              │ false  │
│ 'null == 0'                  │ false  │
│ 'undefined == 0'             │ false  │
│ 'null >= 0'                  │ true   │   ← the trap
│ 'null > 0'                   │ false  │
│ 'null <= 0'                  │ true   │
│ 'undefined >= 0'             │ false  │
│ 'Object.is(null, undefined)' │ false  │
└──────────────────────────────┴────────┘
```

Read the three `null` comparison lines together. `null >= 0` is `true`, `null > 0` is `false`, and
`null == 0` is `false`. In any consistent system, the first two would imply `null == 0`. They don't,
because **`==` and `>=` use different algorithms**:

- **`==` has a hard-coded special case**: `null` and `undefined` are loosely equal to each other
  and to *nothing else*. No coercion is attempted at all — that's why `null == 0` and
  `null == false` are both false.
- **Relational operators coerce with `ToNumber`**, and `Number(null)` is `0`. So `null >= 0`
  really is `0 >= 0`.

`undefined` behaves differently in the second case because `Number(undefined)` is `NaN`, and every
comparison against `NaN` is false (Chapter 19). So `undefined >= 0` is `false` — and so is
`undefined <= 0`.

> **What developers think happens:** `null` is loosely equal to falsy things, like `0` and `""`.
> **What actually happens:** `null` is loosely equal to exactly one thing, `undefined`. The
> comparisons that *do* coerce it are the relational ones, which are a separate algorithm.

### The one loose-equality idiom worth keeping

```javascript
const isNullish = (v) => v == null;
[null, undefined, 0, "", false, NaN, {}].map(isNullish)
// [ true, true, false, false, false, false, false ]
```

`x == null` is exactly `x === null || x === undefined`, and nothing else is caught. It predates `??`
by two decades and is still the shortest way to write the *test* rather than the *fallback*. It is
also the one place where a linter's blanket "no `==`" rule is worth an exception — most configs
ship `eqeqeq: ["error", "always", { null: "ignore" }]` for precisely this.

---

## Part 4 — `||` versus `??`

The eight falsy values, and the two nullish ones:

```
the eight falsy values : false · 0 · -0 · 0n · "" · null · undefined · NaN
of those, NULLISH      : null · undefined      <- that is the whole difference
```

`||` returns the right side when the left is **falsy**. `??` returns the right side when the left is
**nullish**. Everything else about them is identical: both short-circuit, both return one of their
operands rather than a boolean.

`examples/04_nullish_vs_falsy.js` runs a realistic options object through both:

```javascript
const opts = { retries: 0, prefix: "", verbose: false, timeout: undefined };
```

```
┌───────────┬───────┬───────┐
│ field     │ ||    │ ??    │
├───────────┼───────┼───────┤
│ 'retries' │ 3     │ 0     │   ← "no retries" became "three retries"
│ 'prefix'  │ 'app' │ ''    │
│ 'verbose' │ true  │ false │   ← opt-out silently became opt-in
│ 'timeout' │ 1000  │ 1000  │   ← the only row where they agree
└───────────┴───────┴───────┘
```

Three of the four rows are bugs, and they're the *quiet* kind: `retries: 0` is exactly what someone
sets when they're debugging a flaky call, and `||` turns it back on.

**So when do you want `||`?** When falsy genuinely means absent for that type — the classic being a
form field, where `""` and "not filled in" are the same thing. Say that out loud when asked;
"always use `??`" is the answer of someone repeating a rule.

### They cannot be mixed without parentheses

```
a ?? b || c -> SyntaxError: Unexpected token '||'
```

This is a **parse error**, not a lint rule. And the reason is that the two groupings genuinely
differ:

```
  (0 ?? 1) || 2 -> 2
  0 ?? (1 || 2) -> 0
```

The committee could have picked a precedence; it deliberately didn't, because whichever it picked
would silently do the other thing in half the code that wrote it. Refusing to guess is the feature.

### Logical assignment skips the write

`??=`, `||=` and `&&=` short-circuit the **assignment**, not just the value. If the test passes,
no write happens at all:

```javascript
const target = { _v: 0, get v() {...}, set v(x) {...} };
target.v ??= 9;    // [get v]              — read, not nullish, NO SET
target.v ||= 9;    // [get v] [set v] 9    — read, falsy, SET
```

`x = x ?? y` would call the setter every time. `x ??= y` doesn't. That matters anywhere a write has
a cost or an observable effect — a setter, a `Proxy` trap, a reactive framework's dependency
tracking, or a `defineProperty` on a frozen object where the redundant write would throw.

### What `??` does not do

```javascript
const cfg = { db: null };
cfg.db?.host ?? "localhost"   // "localhost"
cfg.db.host ?? "localhost"    // TypeError: Cannot read properties of null (reading 'host')
```

`??` is about the *value* you got. It cannot save you from the read that produced it. That's a
different operator, and it's the next part.

---

## Part 5 — Optional chaining

`examples/05_optional_chaining.js`. The single most-misunderstood fact:

```javascript
const a = { b: null };
a.b?.c.d.e     // undefined — no TypeError
```

**`?.` short-circuits the entire remaining chain**, not just the next access. Once the check fails,
everything to the right is skipped, including further `.`, `[]` and `()`. You do not need
`a.b?.c?.d?.e` — and writing it that way suggests you think each `?.` guards only its own link.

The short circuit stops at a parenthesis, though:

```
(a.b?.c).d  -> TypeError: Cannot read properties of undefined (reading 'd')
```

Parentheses end the chain, so `.d` is a fresh access on the `undefined` that came out.

### Three forms

```
api.missing?.()      : undefined     ← call, only if callable
api.list?.()         : [ 1, 2, 3 ]
api.nested?.[0]      : zero          ← computed access
api.absent?.[0]      : undefined
```

`?.()` checks the *thing being called*, which makes it the right tool for an optional callback:
`options.onDone?.()` replaces `if (options.onDone) options.onDone()`.

### It skips argument evaluation too

```javascript
let evaluated = 0;
const arg = () => { evaluated++; return 1; };
noFn.run?.(arg());
// arg() evaluated: 0   ← the whole call expression was skipped
```

The arguments are part of the short-circuited expression. That's usually what you want, and it is
occasionally a surprise if the argument had a side effect you were relying on.

### What it does *not* do

```
throwy?.x        -> getter blew up      ← only guards null/undefined, not other errors
a.b?.c + 1       = NaN                  ← it does not make the RESULT safe
a?.b = 1         -> SyntaxError: Invalid left-hand side in assignment
delete a?.zzz    -> true                ← delete is allowed
```

Four separate limits, and the second is the one that bites: `?.` stops the `TypeError` and hands you
an `undefined` that then flows into arithmetic, string concatenation, or another service. You have
converted a loud failure at the read into a quiet one somewhere else. **`?.` is for absences you
expect**, not a way to make an unknown shape safe.

### The design smell

`user?.profile?.settings?.theme?.color` is not defensive programming, it's four statements that you
don't know the shape of your data. In review, ask which of those four can actually be missing —
usually the answer is one, and the other three are noise that will hide a real structural change
when it happens. This is the code-review question this chapter exists for.

### `?.` and `??` answer different questions

```javascript
const cfg = { timeout: 0 };
cfg?.timeout ?? 30    // 0
```

`?.` asks *"can I read through this?"*. `??` asks *"is what I got absent?"*. They compose, and they
are not substitutes.

---

## Part 6 — Default parameters

`examples/06_default_parameters.js`. The rule is one sentence: **a default fires if and only if the
argument is `undefined`.**

```
greet()            : hello world!
greet(undefined)   : hello world!
greet(null)        : hello null!     ← null is a value; it goes through
greet("")          : hello !
greet(0)           : hello 0!
```

This is the same nullish-versus-falsy distinction as `??`, except narrower: `??` accepts `null`
too, defaults don't. **A default parameter is `!== undefined`, not `?? `.** That asymmetry between
two features added for the same reason is a good follow-up question and a common wrong answer.

Destructuring defaults use the identical rule, which is what makes the `= {}` idiom work:

```javascript
const show = ({ retries = 3, tag = "app" } = {}) => `${retries}/${tag}`;
```

```
show()                        : 3/app
show({ retries: 0 })          : 0/app       ← kept
show({ retries: null })       : null/app    ← kept, and probably a bug upstream
show({ retries: undefined })  : 3/app       ← default fires
```

### Defaults are expressions, evaluated per call, left to right

```
counter(), counter(), counter()   ->  1 2 3      ← a new value each call, not one shared default
ordered()                          ->  [ 1, 2, 3 ]
ordered(10)                        ->  [ 10, 11, 12 ]   ← later params can see earlier ones
```

That's the fix for the Python "mutable default argument" trap, which JavaScript simply doesn't have:
`function f(list = [])` allocates a fresh array on every call.

Parameters live in their own scope with their own TDZ, so left-to-right is enforced:

```
(a = b, b = 2) -> ReferenceError: Cannot access 'b' before initialization
```

### A default makes the parameter list "non-simple", and that changes two other things

```
without a default, arguments is mapped : changed
with a default,    arguments is NOT    : original
```

In sloppy mode, `arguments` is normally a *live view* of the parameters — writing `arguments[0]`
changes `x`. Adding any default (or a rest or a destructuring pattern) turns that off, and
`arguments` becomes a plain snapshot. Legacy code that relies on the mapping breaks silently the
moment someone adds a default.

The same "non-simple" rule forbids a `"use strict"` directive in the body:

```
SyntaxError: Illegal 'use strict' directive in function with non-simple parameter list
```

Because the default expressions would have to be parsed before the directive was known. Not a
problem in a module, where strict is already on (Chapter 20).

### The one thing you cannot do

```
probe()          : { value: undefined, argsLength: 0 }
probe(undefined) : { value: undefined, argsLength: 1 }
```

**There is no way to distinguish "not passed" from "passed `undefined`" from the parameter itself.**
`arguments.length` is the only discriminator — and arrow functions don't have `arguments`, so inside
one it genuinely cannot be done. If the distinction matters to your API, take an options object and
use `in`, which is Part 1's answer arriving again.

---

## Part 7 — What survives a boundary

`examples/07_across_boundaries.js`.

### JSON drops `undefined`, and the two containers disagree about how

```
object : {"a":1,"c":null}
array  : [1,null,null,null,null]
```

In an object, a key whose value is `undefined` — or a function, or a symbol — **is omitted
entirely**. In an array it becomes `null`, because an array can't have a hole in its serialised
form without changing the length.

So `undefined` is not representable in JSON at all. `null` is. That is a real constraint on API
design: if your protocol needs to say "unset" and "explicitly empty" as different things, JSON gives
you exactly one of them plus key-presence, which is why `PATCH` semantics are built on whether the
key is there.

`structuredClone` keeps `undefined` intact, key and all — a useful thing to know when you're
choosing between them for a deep copy (Chapter 18).

### Spread copies an explicit `undefined` over your default

```
absent key        : { retries: 3, tag: 'app' }
explicit undefined: { retries: undefined, tag: 'app' }
```

This is the single most common form of the bug in real config code:

```javascript
// looks harmless, erases every default the caller didn't set
const config = { ...defaults, retries: opts.retries, tag: opts.tag };
```

Spread copies *own enumerable keys*, and `retries: opts.retries` creates the key regardless of what
it holds. Building the override object with only the keys that are actually present — or applying
`??` per field — is the fix.

### Array holes are a fifth state

```
holey            : [ 1, <1 empty item>, 3 ]  1 in holey: false
dense            : [ 1, undefined, 3 ]       1 in dense: true
holey.map(x=>9)  : [ 9, <1 empty item>, 9 ]  ← callback skipped, hole preserved
Object.keys      : [ '0', '2' ] vs [ '0', '1', '2' ]
[...holey]       : [ 1, undefined, 3 ]       ← iteration FILLS holes
holey.includes(undefined): true   holey.indexOf(undefined): -1
new Array(3)     : [ <3 empty items> ]   .fill(): [ undefined, undefined, undefined ]
```

A hole reads as `undefined` and *is not* `undefined`. Three details worth carrying:

- **The older array methods skip holes** (`map`, `forEach`, `filter`, `reduce`); the newer
  iteration protocol does not (`for...of`, spread, `Array.from`). So converting a loop from
  `forEach` to `for...of` can change how many times the body runs.
- **`includes` and `indexOf` disagree** on the same array, because `includes` uses SameValueZero
  over every index while `indexOf` skips holes.
- **`new Array(n)` produces holes**, which is why `new Array(3).map((_, i) => i)` gives you three
  empty items and `Array.from({length: 3}, (_, i) => i)` gives you `[0,1,2]`.

### `Map.get` cannot tell you, `Map.has` can

```
m.get('stored') : undefined   m.get('absent') : undefined
m.has('stored') : true        m.has('absent') : false
```

Exactly the Part 1 problem in a different container. A cache that stores `undefined` as a legitimate
value and checks with `if (cache.get(k))` will miss every time — which is a cache that silently
does nothing, the most expensive kind.

---

## Part 8 — Which absence you get is a convention, not a rule

`examples/08_api_conventions.js`:

```
┌──────────────────────────────────────────────┬─────────────┬─────────────┐
│ call                                         │ result      │ type        │
├──────────────────────────────────────────────┼─────────────┼─────────────┤
│ '[1,2,3].find(x => x > 9)'                   │ 'undefined' │ 'undefined' │
│ '[1,2,3].at(9)'                              │ 'undefined' │ 'undefined' │
│ "'abc'.match(/z/)"                           │ 'null'      │ 'null'      │
│ "/z/.exec('abc')"                            │ 'null'      │ 'null'      │
│ "new Map().get('k')"                         │ 'undefined' │ 'undefined' │
│ 'Object.getPrototypeOf(Object.create(null))' │ 'null'      │ 'null'      │
│ '({}).missing'                               │ 'undefined' │ 'undefined' │
│ '[1,2,3].findIndex(x => x > 9)'              │ '-1'        │ 'number'    │
│ "'abc'.indexOf('z')"                         │ '-1'        │ 'number'    │
└──────────────────────────────────────────────┴─────────────┴─────────────┘
```

Three conventions for "not found", in the standard library, chosen by era. The regex methods return
`null` because they date from the Java-influenced original design where "no object" was `null`. The
array search methods return `undefined` because they're ES5 and later. The index methods return `-1`
because they're modelled on C. The DOM adds a fourth pattern — `getElementById` returns `null`,
`querySelector` returns `null`, but `getElementsByTagName` returns an empty collection.

The practical consequence: **any helper that means "is this missing" has to accept both**, which is
`x == null` and why that idiom survives.

And the failure this produces in typed code:

```javascript
const parsed = JSON.parse('{"name": null}');
parsed.name.toUpperCase()          // TypeError: Cannot read properties of null
parsed.name?.toUpperCase()         // undefined
(parsed.name ?? "").toUpperCase()  // ""
```

`JSON.parse` returns `any`. A `null` in a field your types declare as `string` passes every
compile-time check and fails at the first method call — which is why validation at the boundary,
not typing at the boundary, is the thing that actually works.

---

## Part 9 — What JavaScript cannot do here

- **Distinguish "not passed" from "passed `undefined`" inside a function**, except via
  `arguments.length` — which arrow functions don't have. Use an options object and `in`.
- **Represent `undefined` in JSON.** Not a serialiser limitation you can configure around; the
  format has one null.
- **Make `??` see a missing key differently from a key holding `undefined`.** Both are `undefined`
  by the time the operator runs. Key presence is a question you have to ask with `in`, before the
  read.
- **Fix `typeof null`.** Rejected on web-compat grounds; too much deployed code branches on it.
- **Stop `?.` from producing an `undefined`.** It converts a throw into a value, and the value is
  then your problem.

---

## The one sentence

> **`undefined` is the absence the language produces when nobody supplied a value; `null` is an
> absence somebody chose — and every operator here differs only in which of those two, or which of
> the eight falsy values, it treats as "not there".**

```
                        falsy (8)
        ┌───────────────────────────────────────┐
        │  false   0   -0   0n   ""   NaN       │
        │                                       │
        │      ┌─────────────────────────┐      │
        │      │  nullish (2)            │      │
        │      │    null    undefined    │      │
        │      └─────────────────────────┘      │
        └───────────────────────────────────────┘
                 ▲                    ▲
          ||  falls back here   ??  falls back here
                                default params: undefined ONLY
```

| Question | The operator |
|---|---|
| is the value absent (null or undefined)? | `x ?? fallback` · `x == null` |
| is the value falsy? | `x \|\| fallback` |
| can I read through this? | `a?.b` |
| is the key there at all? | `"k" in obj` · `Object.hasOwn(obj, "k")` |
| was the argument supplied? | `arguments.length` — or an options object + `in` |
| is it exactly undefined? | `x === undefined` · `x === void 0` |

```
   the state        reads as     `in`     ||       ??       default param
   ───────────      ─────────    ─────    ─────    ─────    ─────────────
   holds a value    the value    true     keeps    keeps    keeps
   holds undefined  undefined    TRUE     falls    falls    FALLS
   holds null       null         TRUE     falls    FALLS    keeps   ← the asymmetry
   absent           undefined    false    falls    falls    FALLS
   array hole       undefined    false    falls    falls    n/a

   Only `in` separates "holds undefined" from "absent" — every operator
   treats them identically. And nothing in this table separates "absent"
   from "array hole"; only `Array.isArray` plus the method you used does.
```

---

## Next

Chapter 22 — strict mode: what it changes, why it exists, and why every module is already in it.

**Exercises first.** `exercises/chapter_exercise.md`, then `exercises/cumulative_exercise.md`.
