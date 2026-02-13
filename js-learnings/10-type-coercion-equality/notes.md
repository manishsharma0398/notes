# Chapter 10 Revision Notes: Type Coercion and Equality

## Core Concept

**Type coercion** = Automatic type conversion following well-defined rules via abstract operations.

```
Explicit: Number(), String(), Boolean()
Implicit: Operators, comparisons, boolean contexts
```

## The Three Core Abstract Operations

### 1. ToNumber

```javascript
undefined  →  NaN
null       →  0  (important!)
true       →  1
false      →  0
""         →  0
"123"      →  123
"abc"      →  NaN
Objects    →  ToPrimitive(hint: "number") → ToNumber
```

### 2. ToString

```javascript
undefined  →  "undefined"
null       →  "null"
true       →  "true"
42         →  "42"
NaN        →  "NaN"
[]         →  "" (empty)
[1, 2]     →  "1,2"
{}         →  "[object Object]"
Objects    →  ToPrimitive(hint: "string") → ToString
```

### 3. ToBoolean

**Falsy (only 7):**
- `false`, `0`, `-0`, `0n`
- `""` (empty string)
- `null`, `undefined`, `NaN`

**Everything else is truthy:**
- `[]`, `{}` (!)
- `"0"`, `"false"` (non-empty strings)
- `new Boolean(false)` (objects!)

## ToPrimitive

Converts objects to primitives.

```
ToPrimitive(obj, hint):
  hint "string"  → toString() → valueOf()
  hint "number"  → valueOf() → toString()
  Symbol.toPrimitive overrides all
```

**Examples:**
```javascript
obj.valueOf()  →  called for Number(), arithmetic
obj.toString() →  called for String(), template literals

// Override all
obj[Symbol.toPrimitive](hint) → custom logic
```

## Equality Operators

### === (Strict Equality)

**NO coercion**. Type AND value must match.

```javascript
5 === 5        // true
5 === "5"      // false (different types)
NaN === NaN    // false (unique!)
+0 === -0      // true
{} === {}      // false (different objects)
```

**Algorithm:**
1. If different types → `false`
2. If same type → compare values
3. Objects: compare references

### == (Abstract Equality)

**Allows coercion** via well-defined algorithm.

** Algorithm:**
1. Same type → use `===`
2. `null == undefined` → `true` (special case)
3. Number vs String → `ToNumber(string)`
4. Boolean → `ToNumber(boolean)`
5. Object vs Primitive → `ToPrimitive(object)`

**Examples:**
```javascript
5 == "5"           // true ("5" → 5)
true == 1          // true (true → 1)
false == 0         // true (false → 0)
null == undefined  // true (only equal to each other!)
[] == ""           // true ([] → "")
[] == 0            // true ([] → "" → 0)
```

**Critical: NOT transitive**
```javascript
"0" == 0   // true
0 == ""    // true
"0" == ""  // FALSE!
```

## Logical Operators

**Return values, not booleans!**

```javascript
// && returns first falsy or last value
"a" && "b"  // "b"
0 && "b"    // 0

// || returns first truthy or last value
"a" || "b"  // "a"
0 || "b"    // "b"

// ?? only for null/undefined
0 ?? "default"     // 0 (not nullish)
null ?? "default"  // "default"
```

## Common Gotchas

### 1. [] and {} are Truthy
```javascript
if ([]) { }  // executes ([] is truthy!)
[] == false  // true (ToPrimitive → ToNumber)
```

### 2. The Famous [] == ! []
```javascript
[] == ![]  // true
// ![] → false
// [] == false → true
```

### 3. Non-Transitivity
```javascript
"0" == 0  && 0 == ""  // both true
"0" == ""              // FALSE!
```

### 4. null and undefined
```javascript
null == undefined  // true (only each other!)
null == 0          // false (not coerced)
null + 5           // 5 (null → 0 in arithmetic)
```

### 5. NaN
```javascript
NaN === NaN        // false (unique!)
Number.isNaN(NaN)  // true (use this)
typeof NaN         // "number"
```

### 6. + vs Other Operators
```javascript
"5" + 3   // "53" (string concat)
"5" - 3   // 2 (ToNumber both)
"5" * 2   // 10
```

## When to Use === vs ==

**Use === (Default):**
- More predictable
- Explicit about types
- Prevents bugs

**Use == (Specific Cases):**
```javascript
// Only for null/undefined check
if (value == null) {  // null OR undefined
    // ...
}

// Instead of:
if (value === null || value === undefined) { }
```

## Comparison Operators

`<`, `>`, `<=`, `>=` use `ToPrimitive` then:
- Both strings → lexicographic
- Else → `ToNumber` both

```javascript
"10" < "9"   // true (lexicographic)
10 < "9"     // false ("9" → 9, numeric)
[10] < [9]   // true ("[10]" < "[9]", lexicographic!)
```

## Special Values

### NaN
```javascript
NaN === NaN       // false
Number.isNaN(x)   // strict check
isNaN(x)          // coerces first (avoid)
```

### +0 vs -0
```javascript
+0 === -0         // true
Object.is(+0, -0) // false
```

### typeof null
```javascript
typeof null  // "object" (historical bug!)
```

## Practical Patterns

**Explicit coercion (preferred):**
```javascript
Number(value)
String(value)
Boolean(value)  // or !!value
```

**Avoid:**
```javascript
value - 0    // implicit ToNumber
value + ""   // implicit ToString
!!value      // OK for ToBoolean
```

**Default values:**
```javascript
// BAD: falsy values will use default
const name = provided || "Guest";  // 0, "" fail

// GOOD: only null/undefined use default
const name = provided ?? "Guest";
```

**Array/object checks:**
```javascript
// BAD
if (arr) { }  // [] is truthy!

// GOOD
if (arr.length > 0) { }
if (Object.keys(obj).length > 0) { }
```

## Quick Reference Table

| Value | ToNumber | ToString | ToBoolean |
|-------|----------|----------|-----------|
| `undefined` | `NaN` | `"undefined"` | `false` |
| `null` | `0` | `"null"` | `false` |
| `true` | `1` | `"true"` | `true` |
| `false` | `0` | `"false"` | `false` |
| `0` | `0` | `"0"` | `false` |
| `""` | `0` | `""` | `false` |
| `"42"` | `42` | `"42"` | `true` |
| `[]` | `0` | `""` | `true` |
| `[5]` | `5` | `"5"` | `true` |
| `{}` | `NaN` | `"[object Object]"` | `true` |

## Interview Quick Answers

**Q: == vs ===?**
**A:** `===` never coerces (strict type+value). `==` allows coercion via algorithm. Use `===` by default, `==` only for `value == null`.

**Q: What's falsy?**
**A:** Only 7: `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN`. Everything else truthy.

**Q: Why [] == ![]?**
**A:** `![]` → `false`. Then `[] == false` → `[] → ""`, `false → 0` → `"" → 0` → `0 == 0` → `true`.

**Q: null vs undefined?**
**A:** `null == undefined` (only equal to each other). Not coerced to 0 or false with `==`.

## Key Takeaways

1. **Coercion is predictable** - follows abstract operations
2. **ToBoolean**: 7 falsy, rest truthy (including [], {})
3. **ToNumber**: null → 0, undefined → NaN, "" → 0
4. **ToPrimitive**: valueOf/toString based on hint
5. **===**: No coercion, strict equality
6. **==**: Coercion via well-defined algorithm
7. **Use === by default**, == only for null check
8. **NaN never equals itself**, use `Number.isNaN()`
9. **== is NOT transitive**
10. **Be explicit** - Number(), String(), Boolean()
