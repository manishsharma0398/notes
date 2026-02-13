# Chapter 11 Revision Notes: Abstract Operations

## What are Abstract Operations?

**Internal specification algorithms** that define how JavaScript converts types.

**NOT** callable functions - they're implementation instructions for engines.

---

## Key Operations

| Operation | Purpose | Common Use |
|-----------|---------|------------|
| `ToPrimitive` | Object → Primitive | `obj + 5` |
| `ToNumber` | Value → Number | `+val`, `val - 0` |
| `ToString` | Value → String | `String(val)`, `"" + val` |
| `ToBoolean` | Value → Boolean | `if (val)`, `!!val` |

---

## ToPrimitive

**Converts object to primitive.**

**Algorithm:**
1. If already primitive → return it
2. If hint is "number": try `valueOf()`, then `toString()`
3. If hint is "string": try `toString()`, then `valueOf()`
4. Both must return primitive or TypeError

**Modern:** `Symbol.toPrimitive(hint)` overrides valueOf/toString

```javascript
obj + 5  // hint: "number" → valueOf first
String(obj)  // hint: "string" → toString first
```

---

## ToNumber

| Input | Result |
|-------|--------|
| `undefined` | `NaN` |
| `null` | `0` ⚠️ |
| `true` / `false` | `1` / `0` |
| `""` (empty) | `0` ⚠️ |
| `"  "` (whitespace) | `0` |
| `"123"` | `123` |
| `"0x10"` | `16` (hex) |
| `"abc"` | `NaN` |
| Object | `ToNumber(ToPrimitive(obj, "number"))` |

**Gotchas:**
- `null → 0` (not NaN!)
- `"" → 0` (not NaN!)
- `[] → 0` (ToPrimitive → "" → 0)

---

## ToString

| Input | Result |
|-------|--------|
| `undefined` | `"undefined"` |
| `null` | `"null"` |
| `true` / `false` | `"true"` / `"false"` |
| Number | String representation |
| `[]` | `""` |
| `[1,2]` | `"1,2"` |
| `{}` | `"[object Object]"` |

---

## ToBoolean

**Only 7 falsy values:**
1. `false`
2. `0`
3. `-0`
4. `""`
5. `null`
6. `undefined`
7. `NaN`

**Everything else is truthy:**
- `"0"` ✓ (string)
- `"false"` ✓ (string)
- `[]` ✓ (object)
- `{}` ✓ (object)

---

## Abstract Equality (==)

**Algorithm for `x == y`:**

1. Same type? Use `===`
2. `null == undefined`? → `true`
3. Number vs String? → `ToNumber(string)`
4. Boolean? → `ToNumber(boolean)` (true→1, false→0)
5. Object vs Primitive? → `ToPrimitive(object)`
6. Otherwise → `false`

**Examples:**
```javascript
5 == "5"        // true (ToNumber("5") → 5)
true == 1       // true (ToNumber(true) → 1)
[] == 0         // true (ToPrimitive([]) → "" → 0)
null == 0       // false (special rule!)
```

---

## Common Traps

### Trap 1: null coercion
```javascript
null == 0       // false (special rule)
null >= 0       // true (ToNumber(null) → 0)
```

### Trap 2: Empty string/array
```javascript
"" == 0         // true
[] == 0         // true
[] == ![]       // true!
```

### Trap 3: Boolean coercion
```javascript
"0" == false    // true
"2" == true     // false (true → 1, not 2)
```

---

## + Operator Special Case

**`+` is overloaded:**
- If **either** operand is string → concatenation
- Otherwise → addition (ToNumber both)

```javascript
"5" + 3     // "53" (concatenation)
"5" - 3     // 2 (ToNumber both)
```

---

## Best Practices

1. **Always use `===`** unless you need coercion
2. **Don't compare with `true/false`:** use `if (val)` not `if (val == true)`
3. **Explicit conversion:** `Number(x)`, `String(x)`, `Boolean(x)`
4. **Understand `+`:** Prefer explicit concatenation or addition

---

## One-Sentence Summary

**Abstract operations are internal ECMAScript specification algorithms (ToPrimitive, ToNumber, ToString, ToBoolean) that define how JavaScript engines perform type conversions and comparisons, with `==` using complex multi-step coercion rules while `===` simply checks type and value equality.**

---

## Next: Chapter 12

**Objects and Property Access:** Property descriptors, getters/setters, and Object methods.
