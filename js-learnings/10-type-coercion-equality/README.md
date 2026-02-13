# Chapter 10: Type Coercion and Equality

## Mental Model

JavaScript is a **dynamically-typed language** that freely converts (coerces) between types. Understanding coercion is critical for predicting behavior and avoiding bugs.

```
TYPE COERCION = Automatic type conversion

EXPLICIT              IMPLICIT
Number("42")    →     "5" - 3
String(true)    →     1 + "2"
Boolean(0)      →     if (value)
```

**Key insight**: Coercion is NOT random. It follows specific, predictable rules defined in the ECMAScript specification through **abstract operations**.

## What Developers Think vs Reality

### Common Misconception

"Type coercion is unpredictable and should always be avoided."

### Reality

**Type coercion follows strict, well-defined rules.** Understanding these rules makes JavaScript behavior totally predictable.

```javascript
// This SEEMS weird
[] + {}  // "[object Object]"
{} + []  // 0

// But it follows clear rules:
// [] converts to "" (empty string)
// {} in expression position converts to "[object Object]"
// {} at statement start is a block, not an object
```

## The Three Core Abstract Operations

JavaScript uses internal "abstract operations" to convert between types:

### 1. ToNumber

Converts a value to a number.

**Rules:**
```javascript
ToNumber(undefined)  →  NaN
ToNumber(null)       →  0
ToNumber(true)       →  1
ToNumber(false)      →  0
ToNumber("")         →  0
ToNumber("123")      →  123
ToNumber("12.5")     →  12.5
ToNumber("abc")      →  NaN
ToNumber(" 42 ")     →  42  (whitespace trimmed)
```

**For objects**: Calls `ToPrimitive(value, "number")` first, then converts the primitive.

### 2. ToString

Converts a value to a string.

**Rules:**
```javascript
ToString(undefined)  →  "undefined"
ToString(null)       →  "null"
ToString(true)       →  "true"
ToString(false)      →  "false"
ToString(0)          →  "0"
ToString(-0)         →  "0"
ToString(NaN)        →  "NaN"
ToString(Infinity)   →  "Infinity"
ToString(123)        →  "123"
```

**For objects**: Calls `ToPrimitive(value, "string")` first, then converts the primitive.

### 3. ToBoolean

Converts a value to a boolean.

**Falsy values** (only 7):
```javascript
ToBoolean(false)      →  false
ToBoolean(0)          →  false
ToBoolean(-0)         →  false
ToBoolean(0n)         →  false  (BigInt zero)
ToBoolean("")         →  false
ToBoolean(null)       →  false
ToBoolean(undefined)  →  false
ToBoolean(NaN)        →  false
```

**Everything else is truthy**, including:
```javascript
ToBoolean([])         →  true  (!important)
ToBoolean({})         →  true
ToBoolean("0")        →  true
ToBoolean("false")    →  true
ToBoolean(new Boolean(false))  →  true
```

## ToPrimitive: The Most Complex

When objects need to be converted to primitives, JavaScript calls the internal `ToPrimitive(input, hint)` operation.

### Algorithm

```
ToPrimitive(obj, hint):
  1. If obj is primitive, return it
  2. If hint is "string":
       Try obj.toString() → if primitive, return
       Try obj.valueOf()  → if primitive, return
  3. If hint is "number" or "default":
       Try obj.valueOf()  → if primitive, return
       Try obj.toString() → if primitive, return
  4. Throw TypeError
```

### Examples

```javascript
const obj = {
    valueOf() { return 42; },
    toString() { return "hello"; }
};

Number(obj)  // 42 (hint: "number", tries valueOf first)
String(obj)  // "hello" (hint: "string", tries toString first)
obj + ""     // "42" (hint: "default", valueOf wins)
```

### Symbol.toPrimitive

Modern way to control conversion:

```javascript
const obj = {
    [Symbol.toPrimitive](hint) {
        if (hint === 'number') return 42;
        if (hint === 'string') return 'hello';
        return 'default';
    }
};

Number(obj)  // 42
String(obj)  // "hello"
obj + ""     // "default"
```

## Strict Equality (===)

**No type coercion.** Compares type AND value.

### Algorithm

```
x === y:
  1. If Type(x) ≠ Type(y), return false
  2. If Type(x) is Number:
       - If x is NaN, return false
       - If y is NaN, return false
       - If x equals y (same number), return true
       - If x is +0 and y is -0, return true
       - If x is -0 and y is +0, return true
       - Return false
  3. Return SameValueNonNumber(x, y)
```

**Key points:**
- Different types → always `false`
- `NaN === NaN` → `false` (unique!)
- `+0 === -0` → `true`
- Objects: Compare references, not contents

```javascript
5 === 5          // true
5 === "5"        // false (different types)
NaN === NaN      // false
+0 === -0        // true
{} === {}        // false (different objects)
```

## Abstract Equality (==)

**Allows type coercion** before comparison.

### Algorithm (Simplified)

```
x == y:
  1. If Type(x) === Type(y), return x === y
  2. If x is null and y is undefined (or vice versa), return true
  3. If one is Number and other is String:
       Convert String to Number, compare
  4. If one is Boolean:
       Convert Boolean to Number, compare
  5. If one is Object and other is primitive:
       Convert Object to Primitive, compare
  6. Return false
```

### Critical Examples

```javascript
// null and undefined are only == to each other
null == undefined    // true
null == 0            // false
undefined == 0       // false

// Boolean converts to number
true == 1            // true (true → 1)
false == 0           // true (false → 0)
true == "1"          // true (true → 1, "1" → 1)

// String to number
5 == "5"             // true ("5" → 5)
"" == 0              // true ("" → 0)

// Object to primitive
[] == ""             // true ([] → "", "" == "")
[] == 0              // true ([] → "", "" → 0)
["42"] == 42         // true (["42"] → "42" → 42)
```

### The Gotcha: Transitivity

`==` is NOT transitive (A == B && B == C doesn't imply A == C):

```javascript
"0" == 0     // true
0 == ""      // true
"0" == ""    // false (!!)
```

## Truthy and Falsy

In boolean contexts (if, while, &&, ||), values are coerced via `ToBoolean`.

### Falsy Values (Only 7)

```javascript
if (false)      // falsy
if (0)          // falsy
if (-0)         // falsy
if (0n)         // falsy
if ("")         // falsy
if (null)       // falsy
if (undefined)  // falsy
if (NaN)        // falsy
```

### Everything Else is Truthy

```javascript
if ([])           // TRUTHY (common gotcha!)
if ({})           // TRUTHY
if ("0")          // TRUTHY
if ("false")      // TRUTHY
if (new Boolean(false))  // TRUTHY (object!)
if (function(){}) // TRUTHY
```

### Gotcha: Truthy but != true

```javascript
[] == true   // false ([] → "" → 0, true → 1)
[] == false  // true ([] → "" → 0, false → 0)

if ([]) console.log('truthy');  // Prints!
```

**Why?**
- `if ([])` → `ToBoolean([])` → `true`
- `[] == true` → Complex coercion path → `false`

## Comparison Operators

`<`, `>`, `<=`, `>=` also involve coercion.

### Algorithm

```
x < y:
  1. Convert both to primitives (hint: "number")
  2. If both are strings, lexicographic comparison
  3. Otherwise, convert both to numbers and compare
```

### Examples

```javascript
// String comparison
"10" < "9"    // true (lexicographic: "1" < "9")
"10" < 9      // false ("10" → 10, 10 < 9 is false)

// NaN comparison
1 < NaN       // false
1 > NaN       // false
1 == NaN      // false

// Object comparison
[2] > [1]     // true ([2] → "2", [1] → "1", "2" > "1")
[10] < [9]    // true ("[10]" < "[9]" lexicographically)
```

## Common Pitfalls

### 1. Empty Array Coercion

```javascript
[] + []    // "" (both → "", "" + "" = "")
[] + {}    // "[object Object]" ([] → "", {} → "[object Object]")
{} + []    // 0 ({} is block, +[] → +("") → 0)
({} + [])  // "[object Object]" (force {} as expression)
```

### 2. String Concatenation vs Addition

```javascript
1 + 2 + "3"    // "33" (1+2=3, 3+"3"="33")
"1" + 2 + 3    // "123" ("1"+2="12", "12"+3="123")
```

### 3. Array-to-String

```javascript
[1, 2, 3].toString()  // "1,2,3"
[].toString()         // ""
[[1], [2]].toString() // "1,2"
```

### 4. Equality Gotchas

```javascript
[] == ![]  // true (!!!)
// Right side: ![] → !true → false
// Left side: [] → ""
// "" == false → 0 == 0 → true
```

### 5. null and undefined

```javascript
null == undefined   // true (special case)
null === undefined  // false (different types)
null == 0           // false (not coerced)
undefined == 0      // false (not coerced)
```

## When to Use === vs ==

### Use === (Strict)

**Default choice**: Use unless you have a specific reason for ==

- Comparing different types intentionally is a code smell
- More explicit and predictable
- Prevents accidental bugs

```javascript
value === 42
value === "hello"
value === null
```

### Use == (Abstract)

**Specific cases** where coercion is intentional:

```javascript
// Checking for null OR undefined
if (value == null) {
    // value is null or undefined
}

// Instead of:
if (value === null || value === undefined) {
    // More verbose
}
```

**Generally avoid:** Most other uses of `==` can be confusing.

## Best Practices

### 1. Prefer Explicit Coercion

```javascript
// BAD: Implicit
if (value) { }
const num = value - 0;

// GOOD: Explicit
if (Boolean(value)) { }
const num = Number(value);
```

### 2. Know Your Falsy Values

```javascript
// Check for specific value
if (value === "") { }
if (value === 0) { }

// Or be explicit about falsiness
if (!value && value !== 0) { }
```

### 3. Use === By Default

```javascript
// Default
value === expected

// Only use == for null/undefined check
value == null
```

### 4. Be Careful with Objects

```javascript
// Arrays/objects are truthy even when empty
if (arr.length) { }  // Better than if (arr)
if (Object.keys(obj).length) { }
```

## Edge Cases to Remember

```javascript
// typeof null
typeof null === "object"  // Historical bug

// NaN
NaN === NaN         // false
Number.isNaN(NaN)   // true (correct check)

// +0 vs -0
+0 === -0           // true
Object.is(+0, -0)   // false

// String numbers
"  42  " == 42      // true (whitespace trimmed)
"42px" == 42        // false (invalid number)

// Empty string
"" == 0             // true
"" === 0            // false

// Boolean
true == 1           // true
true === 1          // false
```

## Interview Insight

**When asked about type coercion:**

> "JavaScript has well-defined coercion rules through abstract operations: ToNumber, ToString, ToBoolean, and ToPrimitive. 
>
> The `===` operator never coerces—it compares type and value. The `==` operator allows coercion following specific steps: same types use ===, null/undefined are equal to each other, numbers and strings convert the string to number, booleans convert to numbers, and objects convert to primitives.
>
> I prefer `===` by default for clarity and predictability, using `==` only for intentional null/undefined checks (`value == null`).
>
> The key gotchas are: empty arrays/objects are truthy but may == false, NaN never equals itself, and transitivity doesn't hold for `==`."

## Visual Summary

```
TYPE COERCION FLOW:

ToBoolean:
  Falsy (7): false, 0, -0, 0n, "", null, undefined, NaN
  Truthy: Everything else

ToNumber:
  undefined  →  NaN
  null       →  0
  true/false →  1/0
  string     →  parse (NaN if invalid)
  object     →  ToPrimitive → ToNumber

ToString:
  primitives →  string representation
  object     →  ToPrimitive → ToString

ToPrimitive(obj, hint):
  hint "string":  toString() → valueOf()
  hint "number":  valueOf() → toString()
  Symbol.toPrimitive overrides all

EQUALITY:
  ===: No coercion, type + value must match
  ==:  Coercion allowed, follows algorithm

  x == y:
    Same type    →  x === y
    null/undef   →  true
    num/str      →  ToNumber(str)
    boolean      →  ToNumber(bool)
    object/prim  →  ToPrimitive(obj)
```

## Key Takeaways

1. **Coercion is predictable** - follows specific abstract operations
2. **ToBoolean**: 7 falsy values, everything else truthy
3. **ToNumber**: null → 0, undefined → NaN, "" → 0
4. **ToPrimitive**: valueOf/toString based on hint
5. **===**: No coercion, strict type + value equality
6. **==**: Coercion via well-defined algorithm
7. **Use === by default**, == only for null/undefined checks
8. **Empty arrays/objects are truthy** but may == false
9. **NaN never equals itself**, use `Number.isNaN()`
10. **Be explicit** with coercions for clarity
