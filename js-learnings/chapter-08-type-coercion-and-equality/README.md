# Chapter 8 — Type Coercion and Equality

## The Core Mental Model

Coercion is not improvisation. The engine never "guesses what you meant."

Every implicit conversion in JavaScript is one of a **small, fixed set of abstract operations** defined in the specification. They are total functions: same input, same output, every time. When `[] == false` surprises you, it is not because the rule is fuzzy — it is because *four* of these operations ran in sequence and you only looked at the first one.

```
        You write:              The engine runs:
   ┌──────────────────┐   ┌──────────────────────────────────┐
   │   x == y         │   │  IsLooselyEqual(x, y)            │
   │   x + y          │──►│  ToPrimitive → ToString/ToNumeric │
   │   if (x)         │   │  ToBoolean(x)                     │
   │   obj[k]         │   │  ToPropertyKey(k)                 │
   └──────────────────┘   └──────────────────────────────────┘
                            deterministic, spec-defined,
                            no heuristics anywhere
```

The goal of this chapter is that you stop memorizing trivia tables and start **tracing the algorithm**. Once you can run `IsLooselyEqual` in your head, every "WAT" example becomes a two-line derivation.

---

## The Conversion Functions

There are five you need. Everything else is built from them.

| Operation | Turns anything into | Triggered by |
|---|---|---|
| `ToPrimitive(v, hint)` | a primitive | `+`, `==`, `<`, template literals, any of the below applied to an object |
| `ToNumber(v)` | a number | `-`, `*`, `/`, `%`, unary `+`, `Number(v)` |
| `ToString(v)` | a string | `String(v)`, template literals, string concatenation |
| `ToBoolean(v)` | a boolean | `if`, `while`, `!`, `&&`, `\|\|`, ternary |
| `ToPropertyKey(v)` | a string or symbol | `obj[key]` |

Note the layering: **`ToNumber` and `ToString` cannot operate on objects directly.** When handed an object they first call `ToPrimitive`. That single fact explains most of the confusing examples in this chapter.

---

## Prerequisite — Four Object Facts (a preview of Chapter 9)

The `==` algorithm itself needs nothing from the object model. But `ToPrimitive` works by *looking up methods on an object*, so four facts have to be on the table before the next section makes sense. Chapter 9 covers the full prototype chain; this is the minimum needed here.

**1. Objects don't usually own the methods you call on them.** When you write `obj.valueOf()`, the engine looks for `valueOf` as an own property of `obj`; if it isn't there, it follows an internal link to another object — the **prototype** — and looks there, and so on up a chain. Almost every plain object's chain ends at a shared built-in called `Object.prototype`.

```javascript
const o = {};
Object.hasOwn(o, "toString");  // false — o does not own it
o.toString();                  // "[object Object]" — found on Object.prototype
```

**2. `Object.prototype.valueOf` returns the object itself.** This is the single most consequential fact in this chapter. It is a deliberate no-op: a plain object has no sensible numeric form, so `valueOf` hands back what it was given.

```javascript
const o = {};
Object.prototype.valueOf.call(o) === o;  // true — not a primitive!
```

That is why `{} + ""` is `"[object Object]"` and not something numeric: `ToPrimitive` tries `valueOf`, gets an object back, and has to fall through to `toString`.

(`Fn.call(obj)` invokes a function with `obj` as its `this` — Chapter 5. Here it's a way to call the original built-in even if the object has its own `valueOf`.)

**3. Some built-ins override these methods.** `Array.prototype.toString` calls `join(",")`. `Date.prototype` supplies both a `toString` and a `Symbol.toPrimitive` that flips the default hint. Overriding means "the chain finds theirs before it reaches `Object.prototype`'s".

```javascript
[1, 2].toString();  // "1,2"   — Array's version, not Object's
({}).toString();    // "[object Object]" — no override, so Object.prototype's
```

**4. An object can have no prototype at all.** `Object.create(null)` produces one with an empty chain — no `valueOf`, no `toString`, nothing. Converting it to a primitive therefore throws, which is a clean demonstration that these methods are *inherited*, not intrinsic.

```javascript
const bare = Object.create(null);
`${bare}`;  // TypeError: Cannot convert object to primitive value
```

That's the whole prerequisite. When Chapter 9 explains *how* the chain is built and traversed, come back and re-read the next section — it will read as a special case of ordinary property lookup rather than as a rule of its own.

---

## `ToPrimitive` — The One That Does the Real Work

```
ToPrimitive(input, hint)

  input is NOT an object? ──────────────► return it unchanged
                                          (primitives pass straight through)
  input IS an object:
      │
      ├─ Does it have Symbol.toPrimitive? ──► call it with the hint,
      │                                        return the result
      │                                        (TypeError if it returns an object)
      │
      └─ No Symbol.toPrimitive? Try methods in an order set by the hint:
              hint "string"  →  toString()  then  valueOf()
              hint "number"  →  valueOf()   then  toString()
              hint "default" →  treated as "number"   ← for almost everything
                                treated as "string"   ← for Date

         Take the FIRST call that returns a primitive.
         Both returned objects? ──► TypeError: Cannot convert object to primitive value
```

Three things people miss:

1. **`valueOf` comes first for the default hint.** Plain objects inherit `Object.prototype.valueOf`, which returns *the object itself* — not a primitive. So the engine falls through to `toString`, which returns `"[object Object]"`. That is why `{} + ""` is `"[object Object]"` and not `"0"`.

2. **Arrays have no meaningful `valueOf` either.** `Array.prototype.toString` calls `join(",")`. So `[].toString()` is `""`, `[1,2].toString()` is `"1,2"`, and — critically — `join` renders `null` and `undefined` as empty strings, so `[null].toString()` is `""`.

3. **`Date` is the sole built-in that flips the default hint to `"string"`.** This is a deliberate web-compat decision: `date + ""` should give you a readable date, not a timestamp.

```javascript
const d = new Date(0);
d + 1;   // "Thu Jan 01 1970 ... 1"  ← hint "default" → string → concatenation
d - 1;   // -1                        ← "-" forces hint "number" → 0 - 1
```

---

## `ToNumber` — The Rules That Bite

```javascript
ToNumber(undefined)  // NaN
ToNumber(null)       // +0        ← NOT NaN. This asymmetry matters below.
ToNumber(true)       // 1
ToNumber(false)      // 0
ToNumber("")         // +0        ← empty string is zero, not NaN
ToNumber("  42\n")   // 42        ← whitespace is trimmed
ToNumber("0x1F")     // 31        ← hex literals are understood
ToNumber("0b101")    // 5         ← binary too
ToNumber("010")      // 10        ← NOT 8. No legacy octal here.
ToNumber("1_000")    // NaN       ← numeric separators are a *source syntax*
                     //             feature; the runtime parser rejects them
ToNumber("Infinity") // Infinity
ToNumber("12px")     // NaN       ← all-or-nothing, unlike parseInt
ToNumber(Symbol())   // TypeError ← symbols refuse to become numbers
ToNumber(10n)        // TypeError ← but Number(10n) works; see BigInt below
```

`ToNumber("")` being `0` is the root of the `"" == 0` / `[] == 0` family of surprises. An empty string is not "nothing" — it is a valid numeric literal with the value zero.

**`Number()` vs `parseInt()`** — different jobs, constantly confused:

```javascript
Number("12px");    // NaN — the whole string must be a number
parseInt("12px");  // 12  — reads a prefix, stops at the first invalid char
Number("");        // 0
parseInt("");      // NaN
parseInt("0x10");  // 16  — recognises the hex prefix
```

---

## `ToBoolean` — The Only Closed List Worth Memorizing

There are exactly **eight** falsy values:

```javascript
false
0        // and -0
0n
""
null
undefined
NaN
document.all   // browser-only wart — see "Why does this exist?" below
```

Everything else is truthy. **Everything.** Including:

```javascript
Boolean([]);                  // true — empty array is an object
Boolean({});                  // true
Boolean("0");                 // true — non-empty string
Boolean("false");             // true
Boolean(new Boolean(false));  // true — a truthy object wrapping false (Ch 7)
Boolean(() => {});            // true
Boolean(-1);                  // true — only zero is falsy, not "negative"
```

`ToBoolean` **never calls user code** — no `valueOf`, no `toString`, no `Symbol.toPrimitive`. It is a pure type test. This is a deliberate design guarantee: `if (x)` must never throw, never allocate, and never run a getter. Keep it in mind when you get to "What JavaScript cannot do."

---

## `===` — Strict Equality

`IsStrictlyEqual(x, y)`:

1. If the two operands have **different types**, return `false`. No conversion, ever.
2. Same type → compare directly. Objects compare by identity (Chapter 7); primitives by value.

Two special cases inherited from IEEE-754 floating point:

```javascript
NaN === NaN;   // false — NaN is not equal to itself, by IEEE-754 design
-0 === +0;     // true  — the two zeros compare equal despite being distinguishable
Object.is(-0, +0); // false — Object.is can tell them apart
```

`NaN !== NaN` exists because NaN means "the result of an invalid operation." Two separately-failed computations have no reason to be considered the same value, and IEEE-754 chose to make the comparison false so that `x !== x` is a portable NaN test. It predates JavaScript by a decade.

---

## `==` — The Actual Algorithm

Here is the whole thing. It is fourteen steps and it is worth reading once carefully, because after that you never have to memorize another `==` table.

```
IsLooselyEqual(x, y):

 1. Same type?                          → return IsStrictlyEqual(x, y)   ── done
 2. x is null and y is undefined?       → true
 3. x is undefined and y is null?       → true
 4. x is Number, y is String?           → retry with (x, ToNumber(y))
 5. x is String, y is Number?           → retry with (ToNumber(x), y)
 6. x is BigInt, y is String?           → retry with (x, StringToBigInt(y))
                                           (false if the string isn't a valid BigInt)
 7. x is String, y is BigInt?           → retry with (y, x) swapped
 8. x is Boolean?                       → retry with (ToNumber(x), y)
 9. y is Boolean?                       → retry with (x, ToNumber(y))
10. x is primitive, y is Object?        → retry with (x, ToPrimitive(y))
11. x is Object, y is primitive?        → retry with (ToPrimitive(x), y)
12. BigInt vs Number?                   → compare mathematical values
                                           (false if either is NaN or ±Infinity)
13. Otherwise                           → false
```

### Three consequences that cover 90% of the surprises

**(a) `null` and `undefined` are a closed club.** Steps 2 and 3 are the *only* rules that mention them, and there is no step that converts either one. So:

```javascript
null == undefined;  // true  — the entire membership of the club
null == 0;          // false — no rule applies, falls to step 13
null == false;      // false
null == "";         // false
undefined == 0;     // false
```

This makes `x == null` the one genuinely useful `==` idiom: it is true for exactly `null` and `undefined` and nothing else. It is the concise way to write `x === null || x === undefined`.

**(b) Booleans are converted first, and to numbers.** `x == true` does **not** mean "is x truthy." It means "does x, after conversion, equal 1."

```javascript
"1" == true;    // true   → ToNumber(true) = 1, ToNumber("1") = 1
"2" == true;    // false  → 2 !== 1, even though "2" is truthy
[] == false;    // true   → ToNumber(false) = 0, ToPrimitive([]) = "", ToNumber("") = 0
```

Never write `if (x == true)`. Write `if (x)`. They ask different questions.

**(c) Objects are flattened to primitives, then the algorithm restarts.** This is why `==` can invoke arbitrary user code — `valueOf` and `toString` are yours to override.

```javascript
const sneaky = { valueOf: () => 42 };
sneaky == 42;   // true

let calls = 0;
const oneshot = { valueOf: () => ++calls };
oneshot == 1;   // true
oneshot == 2;   // true   ← same object, different answer. == is not pure.
```

### Worked traces

Do these by hand until they are mechanical.

```
[] == false
  step 9:  y is Boolean       → [] == 0
  step 11: x is Object        → ToPrimitive([]) = "" → "" == 0
  step 5:  x String, y Number → ToNumber("") = 0 → 0 == 0
  step 1:  same type          → true
```

```
[] == ![]
  ![] is false (arrays are truthy) → [] == false → true   (as above)
```

```
"" == "0"
  step 1: same type → IsStrictlyEqual("", "0") → false
```

Combine that last one with `"" == 0` (true) and `"0" == 0` (true) and you have the proof that **`==` is not transitive**. That is the single strongest argument for `===` as the default.

```
null >= 0   is true, but   null == 0   is false. How?
  >= is a RELATIONAL operator, not an equality one. It has no null special case:
     ToNumber(null) = 0 → 0 >= 0 → true
  == has step 2/3, which stop before any conversion can happen → false
```

Two different algorithms. They were never required to agree.

---

## `+` — Why It Behaves Unlike Every Other Operator

Every other arithmetic operator forces numbers. `+` is overloaded, so it decides *after* looking at the operands:

```
ApplyStringOrNumericBinaryOperator(lval, "+", rval):
  1. lprim = ToPrimitive(lval)     ← no hint = "default"
     rprim = ToPrimitive(rval)
  2. Is EITHER one a String?  → ToString both, concatenate
  3. Otherwise                → ToNumeric both, add
                                (Number + BigInt → TypeError)
```

Step 1 happens for **both** operands *before* step 2 looks at the types. That ordering is the whole trick:

```javascript
[] + [];        // ""                  → "" + ""
[] + {};        // "[object Object]"   → "" + "[object Object]"
[1,2] + [3];    // "1,23"              → "1,2" + "3"   ← not [1,2,3]
1 + "2";        // "12"                → one string operand wins
1 + 2 + "3";    // "33"                → left-to-right: (1+2) then + "3"
"1" + 2 + 3;    // "123"               → ("1"+2) then + 3
1 + true;       // 2                   → no string anywhere → numeric
"5" - 2;        // 3                   → "-" is numeric-only, no string path
"5" + 2;        // "52"
```

### The `{} + []` puzzle, honestly explained

```javascript
{} + []   // 0 as a STATEMENT, "[object Object]" as an EXPRESSION
```

This is not a coercion quirk at all — it is a **parsing** one (Chapter 1). At the start of a statement, `{}` is an empty **block**, not an object literal. What remains is `+[]`, a unary plus: `ToNumber(ToPrimitive([]))` = `ToNumber("")` = `0`.

Wrap it so the parser is in expression position and the object literal comes back:

```javascript
console.log({} + []);   // "[object Object]"
console.log(({}) + []); // "[object Object]"
```

Node's REPL evaluates input as an expression, so it prints `"[object Object]"` — while the same line in a `.js` file prints `0`. If a puzzle's answer changes between the REPL and a file, the cause is parsing, not coercion.

### Relational operators (`<`, `>`, `<=`, `>=`)

They use `ToPrimitive` with hint `"number"`, but with one exception: **if both sides end up as strings, they compare lexicographically by UTF-16 code unit.**

```javascript
"10" < "9";      // true  ← string compare: "1" comes before "9"
10 < 9;          // false
"10" < 9;        // false ← one side numeric → both to numbers
[] < 1;          // true  → "" → 0
"a" < "b";       // true
"B" < "a";       // true  ← uppercase letters sort before lowercase in UTF-16
1 < 2 < 3;       // true  → (1<2) = true → true < 3 → 1 < 3 → true
3 > 2 > 1;       // false → (3>2) = true → true > 1 → 1 > 1 → false
```

`3 > 2 > 1` being `false` is the cleanest demonstration that chained comparison is not a thing in JavaScript — each `<`/`>` is binary and its boolean result gets coerced right back into a number.

---

## The Four Equality Algorithms

JavaScript has **four**, not two. Knowing which one a built-in uses explains a lot of otherwise-baffling behavior.

| | `==` | `===` | `Object.is` | SameValueZero |
|---|---|---|---|---|
| Coerces types | **yes** | no | no | no |
| `NaN` vs `NaN` | `false` | `false` | **`true`** | **`true`** |
| `+0` vs `-0` | `true` | `true` | **`false`** | `true` |
| Used by | `==` | `===`, `indexOf`, `switch` | `Object.is` | `includes`, `Map`/`Set` keys |

```javascript
[NaN].indexOf(NaN);    // -1    ← indexOf uses ===, and NaN === NaN is false
[NaN].includes(NaN);   // true  ← includes uses SameValueZero
new Set([0, -0]).size; // 1     ← SameValueZero treats the zeros as one key
new Set([NaN, NaN]).size; // 1  ← and NaN as equal to itself
Object.is(NaN, NaN);   // true
Object.is(0, -0);      // false
```

`includes` was added in ES2016 specifically because `indexOf`'s `===` made NaN unfindable. `switch` uses `===`, so `switch (NaN)` never matches a `case NaN`.

---

## BigInt and Symbol — The Two Types That Refuse

**BigInt** compares across types but will not do arithmetic across them:

```javascript
1n == 1;    // true  → step 12, mathematical values are equal
1n === 1;   // false → different types
1n < 2;     // true  → relational comparison across types is allowed
1n + 1;     // TypeError: Cannot mix BigInt and other types
+1n;        // TypeError — unary plus is defined as ToNumber, which rejects BigInt
Number(1n); // 1     — the explicit conversion is fine
1n + "1";   // "11"  — string concatenation is allowed (ToString, not ToNumber)
```

Mixing is banned in arithmetic because there is no safe answer: implicitly converting BigInt→Number loses precision above 2^53, and Number→BigInt loses the fractional part. The committee chose a loud error over a silent wrong result.

**Symbol** refuses implicit string conversion:

```javascript
const s = Symbol("id");
String(s);       // "Symbol(id)"  — the explicit path is allowed
s.toString();    // "Symbol(id)"
`${s}`;          // TypeError: Cannot convert a Symbol value to a string
s + "";          // TypeError
s == "Symbol(id)"; // false — no conversion rule matches; step 13
```

Template literals throw while `String()` works, on purpose: symbols exist to be unique, non-colliding keys, and a symbol silently stringifying into a log line or a property name is almost always a bug. `String()` is you saying "I know."

---

## What JavaScript Cannot Do — And Why

**You cannot override `===`.** There is no `Symbol.equals`. Two distinct objects are never strictly equal, and nothing you write can change that.

*Why not?* Identity comparison is the one operation engines assume is constant-time, side-effect-free, and infallible. It is inlined everywhere — property lookup caches, hidden-class checks, `Map` key dispatch. If `===` could call user code, then `a === a` could return `false`, comparison could throw, and every inline cache would need a deoptimization guard. The cost is paid on every comparison in the program to benefit a small number of value-object use cases. Languages that do allow it (Python's `__eq__`, C++'s `operator==`) also accept the performance model that comes with it.

**You cannot override `ToBoolean`.** There is no `Symbol.toBoolean`, so you cannot build a falsy object.

*Why not?* Same reason, sharper: `if (x)` is the single most common operation in any program. Making it capable of running user code or throwing would mean no control-flow construct is ever safe to reason about locally.

*Except* — there is exactly one falsy object in the world: `document.all`. It has an internal `[[IsHTMLDDA]]` slot that makes it falsy, makes `typeof document.all` return `"undefined"`, and makes `document.all == null` true. This is not a design; it is an archaeological artifact. Legacy sites used `if (document.all)` to sniff for Internet Explorer, so when other browsers implemented `document.all` for compatibility, they had to make it *look absent* to feature detection while still working when used. TC39 eventually standardized the hack in Annex B rather than let the web depend on unspecified behavior. It is the exception that proves how strong the "no user-controllable truthiness" rule is.

**You cannot make `==` skip coercion.** No flag, no pragma, not even in strict mode.

*Why not?* Strict mode may only change semantics in ways that are statically detectable or throw — silently changing what `==` returns would break working code with no diagnostic. The language's answer was `===` (1997) and, eventually, linters.

---

## Common Misconceptions

| Misconception | Reality |
|---|---|
| "`==` compares values, `===` compares types" | Both compare values. `==` runs conversions first; `===` returns `false` on a type mismatch instead of converting. |
| "`==` is unpredictable" | It is fourteen deterministic steps. It is *unmemorable*, not unpredictable. |
| "Always use `===`, never `==`" | `x == null` is the correct, idiomatic null-or-undefined check. It is the one exception, and most style guides carve it out. |
| "`+` concatenates when one side is a string" | When one side is a string **after `ToPrimitive` runs on both operands**. `[] + {}` has no string operands to begin with. |
| "`[]` is falsy because it's empty" | `[]` is truthy. It becomes `0` only under `==`, via `ToPrimitive` → `""` → `0`. Different operation, different answer. |
| "`if (x == true)` checks truthiness" | It checks whether `ToNumber(x) === 1`. `"2" == true` is `false` although `"2"` is truthy. |
| "`null == 0` should be true since `ToNumber(null)` is 0" | `==` never reaches `ToNumber` for `null` — steps 2/3 short-circuit. But `>=` does, which is why `null >= 0` is `true`. |
| "`{} + []` proves JS is broken" | It proves `{}` at statement position is a block. Parsing, not coercion. |
| "`NaN === NaN` being false is a JS bug" | It is IEEE-754, shared by C, Java, Python, and every other float implementation. |

---

## ASCII Diagram — The Whole Chapter on One Page

```
                        x == y
                          │
              ┌───────────┴────────────┐
              │  same type?            │──yes──► x === y
              └───────────┬────────────┘
                          no
                          │
              ┌───────────┴────────────┐
              │ one null, one undefined│──yes──► true
              └───────────┬────────────┘
                          no
                          │
         ┌────────────────┼─────────────────┐
         │                │                 │
    boolean side?     object side?     string vs number?
         │                │                 │
    ToNumber(bool)   ToPrimitive(obj)   ToNumber(string)
         │                │                 │
         └────────────────┼─────────────────┘
                          │
                    RESTART the algorithm
                          │
                  (eventually same type
                   or falls through to false)


   ToPrimitive(obj, hint)
        hint "number"/"default"      hint "string"
        ┌──────────────┐             ┌──────────────┐
        │  valueOf()   │             │  toString()  │
        │      ↓       │             │      ↓       │
        │  toString()  │             │  valueOf()   │
        └──────────────┘             └──────────────┘
        first primitive wins; neither → TypeError
        (Date flips "default" to "string")
```

---

## Practical Rules

1. **`===` by default.** Not because `==` is chaotic, but because `===` needs no trace to read.
2. **`x == null` for null-or-undefined.** The one idiomatic use of `==`.
3. **Convert explicitly at boundaries.** `Number(input.value)`, `String(id)` — do it once, where the untrusted value enters, not implicitly at every use site.
4. **Never `== true` / `== false`.** Use the value directly, or `=== true` if you truly require the boolean.
5. **`Number.isNaN(x)`, not `isNaN(x)`.** The global `isNaN` coerces first, so `isNaN("hello")` is `true` — it is really "is not a number after conversion."
6. **`Object.is` when `±0` or `NaN` matter.** Otherwise `===`.
7. **Never define `valueOf`/`toString` to be non-deterministic.** You will make `==` return different answers for the same pair of values, and no reader will forgive you.
