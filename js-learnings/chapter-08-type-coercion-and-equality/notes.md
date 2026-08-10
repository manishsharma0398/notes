# Chapter 8 — Type Coercion and Equality: Revision Notes

## The Five Conversions

| Operation | Result | Triggered by |
|---|---|---|
| `ToPrimitive(v, hint)` | primitive | `+`, `==`, `<`, template literals; runs before ToNumber/ToString on objects |
| `ToNumber(v)` | number | `-`, `*`, `/`, `%`, unary `+`, `Number()` |
| `ToString(v)` | string | `String()`, template literals, concatenation |
| `ToBoolean(v)` | boolean | `if`, `while`, `!`, `&&`, `\|\|`, ternary |
| `ToPropertyKey(v)` | string \| symbol | `obj[key]` |

**ToNumber and ToString cannot take objects** — they call ToPrimitive first. That layering explains most surprises.

---

## ToPrimitive

```
hint "number" / "default"  →  valueOf()  then  toString()
hint "string"              →  toString() then  valueOf()
Symbol.toPrimitive, if present, overrides both and receives the hint.
Neither returns a primitive → TypeError.
```

- Plain objects: `Object.prototype.valueOf` returns **the object itself** → falls through to `toString` → `"[object Object]"`
- Arrays: `toString` is `join(",")` → `[]`→`""`, `[1,2]`→`"1,2"`, `[null]`→`""`, `[[]]`→`""`
- **`Date` is the only built-in that treats hint `"default"` as `"string"`** → `date + 1` concatenates, `date - 1` subtracts

---

## ToNumber traps

```javascript
Number(null)      // 0      ← not NaN
Number(undefined) // NaN
Number("")        // 0      ← the root of the []/"" == 0 family
Number("  42 ")   // 42     ← trimmed
Number("0x1F")    // 31
Number("010")     // 10     ← no legacy octal
Number("1_000")   // NaN    ← separators are source syntax only
Number("12px")    // NaN    ← all-or-nothing
parseInt("12px")  // 12     ← prefix-based
parseInt("")      // NaN    ← disagrees with Number("") === 0
Number(Symbol())  // TypeError
```

---

## ToBoolean — exactly 8 falsy values

```
false   0   -0   0n   ""   null   undefined   NaN
```

(plus `document.all`, a browser-only wart)

Everything else is truthy: `[]`, `{}`, `"0"`, `"false"`, `new Boolean(false)`, `-1`, functions.

**ToBoolean never calls user code** — no valueOf, no toString, no Symbol hook. `if (x)` can never throw or run a getter.

---

## `==` — the 14 steps, compressed

```
1.  same type            → ===
2/3 null ↔ undefined     → true
4/5 Number ↔ String      → ToNumber(string)
6/7 BigInt ↔ String      → StringToBigInt
8/9 Boolean on either    → ToNumber(boolean)      ← converts to 0/1, NOT truthiness
10/11 Object vs primitive → ToPrimitive(object)
12. BigInt ↔ Number      → compare mathematical values
13. otherwise            → false
```

### Three consequences

1. **`null`/`undefined` are a closed club.** Nothing converts them; they equal each other and nothing else. → `x == null` is the one good `==` idiom.
2. **`== true` means `ToNumber(x) === 1`**, not "is truthy". `"2" == true` is `false`.
3. **Objects flatten then restart** — so `==` can run your `valueOf` and is *not a pure function*.

### The canonical traces

```
[] == false  →  []==0  →  ""==0  →  0==0  →  true
[] == ![]    →  ![] is false → same as above → true
```

### `==` is not transitive

```javascript
"" == 0    // true
"0" == 0   // true
"" == "0"  // false
```

### `==` vs relational — different algorithms

```javascript
null == 0   // false — steps 2/3 short-circuit before any conversion
null >= 0   // true  — >= has no null case: ToNumber(null) = 0
undefined >= 0 // false — ToNumber(undefined) = NaN, all NaN comparisons false
```

---

## `+` vs everything else

```
+ :  ToPrimitive BOTH operands (default hint), THEN
     either is a String? → concatenate
     otherwise           → numeric add (Number+BigInt → TypeError)

- * / % : numeric only, no string path
```

```javascript
1 + "2"      // "12"
"5" - 2      // 3
[] + []      // ""
[] + {}      // "[object Object]"
[1,2] + [3]  // "1,23"
1 + 2 + "3"  // "33"
"1" + 2 + 3  // "123"
```

**`{} + []` is 0 as a statement, `"[object Object]"` as an expression** — `{}` at statement position is a block, leaving `+[]`. Parsing, not coercion. Node's REPL evaluates expressions, so it disagrees with a `.js` file.

### Relational (`<` `>` `<=` `>=`)

Hint `"number"`, **except both-strings → lexicographic UTF-16**.

```javascript
"10" < "9"   // true   ← string compare
"10" < 9     // false  ← numeric
"B" < "a"    // true   ← UTF-16 order
1 < 2 < 3    // true   → true < 3 → 1 < 3
3 > 2 > 1    // false  → true > 1 → 1 > 1
```

---

## The four equality algorithms

| | `==` | `===` | `Object.is` | SameValueZero |
|---|---|---|---|---|
| coerces | yes | no | no | no |
| `NaN`/`NaN` | false | false | **true** | **true** |
| `+0`/`-0` | true | true | **false** | true |
| used by | `==` | `===`, `indexOf`, `switch` | `Object.is` | `includes`, `Map`/`Set` keys |

```javascript
[NaN].indexOf(NaN)   // -1    ← === 
[NaN].includes(NaN)  // true  ← SameValueZero (why includes was added in ES2016)
new Set([0, -0]).size    // 1
new Set([NaN, NaN]).size // 1
switch (NaN) { case NaN: /* never runs */ }
```

Practical bite: a `Map`-based cache handles `NaN` keys; an `indexOf`-based one silently never hits.

---

## BigInt and Symbol

```javascript
1n == 1     // true      — compares across types
1n === 1    // false     — different types
1n < 2      // true      — relational across types is fine
1n + 1      // TypeError — arithmetic mixing is banned
+1n         // TypeError — unary + is ToNumber, which rejects BigInt
Number(1n)  // 1         — explicit conversion works
1n + "1"    // "11"      — concatenation is allowed

String(sym)   // "Symbol(id)"  — explicit is allowed
`${sym}`      // TypeError     — implicit is not
sym + ""      // TypeError
```

Mixing BigInt/Number is banned because neither implicit direction is safe: BigInt→Number loses precision past 2^53, Number→BigInt loses the fraction.

---

## What JavaScript cannot do

| Cannot | Why |
|---|---|
| Override `===` (no `Symbol.equals`) | Identity must be constant-time, side-effect-free, infallible — engines inline it into every property lookup and cache check. `a === a` must never be false. |
| Override `ToBoolean` (no `Symbol.toBoolean`) | `if (x)` must never run user code or throw. The sole exception, `document.all`, is standardized legacy: sites used `if (document.all)` to detect IE, so it had to *look absent* while still working. |
| Make `==` skip coercion | Strict mode may only change semantics detectably or by throwing. Silently changing `==` results would break working code with no diagnostic. The answer was `===`. |

---

## Practical rules

1. `===` by default — not because `==` is chaotic, but because it needs no trace to read.
2. `x == null` for null-or-undefined. The one idiomatic `==`.
3. Convert explicitly at boundaries: `Number(input.value)` once, at the edge.
4. Never `== true` / `== false`.
5. `Number.isNaN`, not global `isNaN` (which coerces: `isNaN("hello")` is `true`).
6. `Object.is` only when `±0` or `NaN` identity matters.
7. Never make `valueOf`/`toString` non-deterministic.

---

## Interview quick-fire

- **"Difference between `==` and `===`?"** → Both compare values. `==` runs conversions (14 spec steps) first; `===` returns false on a type mismatch. Not "value vs type".
- **"Is `==` ever acceptable?"** → `x == null`, to catch null and undefined together.
- **"Why is `[] == false` true?"** → `ToNumber(false)`=0 → `ToPrimitive([])`=`""` → `ToNumber("")`=0 → `0 == 0`.
- **"Why is `[] == ![]` true?"** → `![]` is `false` (arrays are truthy), then the trace above.
- **"Is `==` transitive?"** → No. `"" == 0` and `"0" == 0` but `"" != "0"`.
- **"Why is `null >= 0` true but `null == 0` false?"** → Different algorithms. `>=` converts via ToNumber; `==` short-circuits at the null/undefined step.
- **"Why is `NaN !== NaN`?"** → IEEE-754. NaN means "an invalid computation"; two failures aren't the same value. Makes `x !== x` a portable NaN test.
- **"Why does `[NaN].includes(NaN)` work but `indexOf` not?"** → `includes` uses SameValueZero, `indexOf` uses `===`.
- **"Why can't you overload `===`?"** → Engines rely on identity being constant-time and effect-free; every inline cache would need a deopt guard.
- **"Why is `1n + 1` a TypeError when `1n == 1` is true?"** → Comparison has a safe answer (mathematical values); arithmetic doesn't — either implicit direction loses information.
- **"Why does `${sym}` throw when `String(sym)` doesn't?"** → Symbols exist to be unique keys; silent stringification is nearly always a bug. `String()` is an explicit opt-in.
- **"What's the only falsy object?"** → `document.all`, via `[[IsHTMLDDA]]` — legacy IE feature detection, standardized in Annex B.
