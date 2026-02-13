# Chapter 11: Abstract Operations (ToPrimitive, ToNumber, ToString, etc.)

---

## Mental Model

**Abstract operations are NOT functions you can call.**

They're **internal algorithms** defined in the ECMAScript specification that describe how JavaScript converts values.

**Key Insight:** Understanding these operations explains seemingly "weird" JavaScript behavior.

---

## What are Abstract Operations?

**Abstract operations** are specification-level procedures that:
- Define how type conversions work
- Explain coercion behavior
- Are NOT accessible from JavaScript code
- Guide engine implementations

**Think of them as:** The instruction manual for "how JavaScript actually works under the hood."

---

## ToPrimitive

**Purpose:** Convert an object to a primitive value.

**Signature:** `ToPrimitive(input, preferredType)`

**Algorithm:**
1. If input is already primitive → return as-is
2. If `preferredType` is "string":
   - Try `toString()` first, then `valueOf()`
3. If `preferredType` is "number" (or default):
   - Try `valueOf()` first, then `toString()`
4. If both fail → TypeError

```javascript
const obj = {
  valueOf() {
    console.log("valueOf called");
    return 10;
  },
  toString() {
    console.log("toString called");
    return "20";
  }
};

// Numeric context: valueOf first
console.log(obj + 5);
// Logs: "valueOf called"
// Output: 15

// String context: toString first
console.log(String(obj));
// Logs: "toString called"
// Output: "20"
```

---

## ToNumber

**Purpose:** Convert a value to a number.

**Rules:**

| Input Type | Result |
|-----------|--------|
| `undefined` | `NaN` |
| `null` | `0` |
| `true` | `1` |
| `false` | `0` |
| String | Parse as number (or `NaN`) |
| Object | `ToNumber(ToPrimitive(input, "number"))` |

**Examples:**

```javascript
Number(undefined);  // NaN
Number(null);       // 0
Number(true);       // 1
Number(false);      // 0
Number("");         // 0
Number("  ");       // 0
Number("123");      // 123
Number("12.5");     // 12.5
Number("0x10");     // 16 (hex)
Number("abc");      // NaN
```

**String parsing rules:**
- Trim whitespace
- Empty string → `0`
- Hex notation supported (`0x`)
- Invalid syntax → `NaN`

---

## ToString

**Purpose:** Convert a value to a string.

**Rules:**

| Input Type | Result |
|-----------|--------|
| `undefined` | `"undefined"` |
| `null` | `"null"` |
| `true` | `"true"` |
| `false` | `"false"` |
| Number | String representation |
| Object | `ToString(ToPrimitive(input, "string"))` |

**Examples:**

```javascript
String(undefined);  // "undefined"
String(null);       // "null"
String(true);       // "true"
String(123);        // "123"
String(NaN);        // "NaN"
String(Infinity);   // "Infinity"

// Arrays have special toString
String([1, 2, 3]);  // "1,2,3"
String([]);         // ""

// Objects
String({});         // "[object Object]"
```

---

## ToBoolean

**Purpose:** Convert a value to a boolean.

**Falsy values (only 7):**
1. `false`
2. `0`
3. `-0`
4. `0n` (BigInt zero)
5. `""` (empty string)
6. `null`
7. `undefined`
8. `NaN`

**Everything else is truthy!**

```javascript
Boolean(false);     // false
Boolean(0);         // false
Boolean("");        // false
Boolean(null);      // false
Boolean(undefined); // false
Boolean(NaN);       // false

// All truthy:
Boolean(true);      // true
Boolean(1);         // true
Boolean("0");       // true (non-empty string!)
Boolean("false");   // true (non-empty string!)
Boolean([]);        // true (object!)
Boolean({});        // true (object!)
Boolean(function(){}); // true (function!)
```

---

## Abstract Equality (==)

**Algorithm for `x == y`:**

1. **Same type?** Use strict equality (===)
2. **null == undefined?** → `true`
3. **Number vs String?** → Convert string to number
4. **Boolean?** → Convert to number (true→1, false→0)
5. **Object vs Primitive?** → ToPrimitive(object)
6. Otherwise → `false`

**Examples:**

```javascript
// Same type → use ===
5 == 5;         // true
"a" == "a";     // true

// null and undefined
null == undefined;  // true
null == 0;          // false (special case!)

// Number vs String → ToNumber(string)
5 == "5";       // true (5 == 5)
"10" == 10;     // true

// Boolean → ToNumber
true == 1;      // true (1 == 1)
false == 0;     // true (0 == 0)
true == "1";    // true (1 == 1)

// Object → ToPrimitive
[1] == 1;       // true ([1].toString() = "1", "1" == 1 → true)
```

---

## ToInt32 / ToUint32

**Purpose:** Convert to 32-bit integer (used for bitwise operations).

```javascript
// ToInt32 examples (signed)
1.5 | 0;         // 1 (truncates)
-1.5 | 0;        // -1
2147483648 | 0;  // -2147483648 (wraps)

// ToUint32 (unsigned)
-1 >>> 0;        // 4294967295
```

---

## OrdinaryToPrimitive

**Special case of ToPrimitive** when `Symbol.toPrimitive` is not defined.

**Algorithm:**
1. If hint is "string": try `toString()`, then `valueOf()`
2. If hint is "number": try `valueOf()`, then `toString()`
3. Throw TypeError if both fail to return primitive

---

## Symbol.toPrimitive

**Modern way** to customize object-to-primitive conversion.

```javascript
const obj = {
  [Symbol.toPrimitive](hint) {
    console.log("hint:", hint);
    if (hint === "number") return 42;
    if (hint === "string") return "hello";
    return null;
  }
};

console.log(+obj);     // hint: number → 42
console.log(`${obj}`); // hint: string → "hello"
console.log(obj + ""); // hint: default → null
```

**Hint values:**
- `"number"` - numeric context
- `"string"` - string context
- `"default"` - ambiguous (e.g., `+`, `==`)

---

## Edge Cases & Traps

### Trap 1: Empty string to number

```javascript
Number("");   // 0 (not NaN!)
+"";          // 0
```

**Why:** Spec says empty string converts to 0.

---

### Trap 2: Array to number

```javascript
Number([]);      // 0
Number([5]);     // 5
Number([1, 2]);  // NaN
```

**Why:**
1. ToPrimitive([]) → [].toString() → ""
2. ToNumber("") → 0

---

### Trap 3: Object in comparisons

```javascript
[] == [];     // false (different objects)
[] == ![];    // true (!)
```

**Why `[] == ![]`:**
1. `![]` → `false` (object is truthy, negated)
2. `[] == false`
3. ToPrimitive([]) → "" 
4. "" == false
5. ToNumber("") → 0, ToNumber(false) → 0
6. 0 == 0 → true

---

### Trap 4: null vs undefined vs 0

```javascript
null == undefined;  // true (special rule)
null == 0;          // false (special rule)
undefined == 0;     // false (special rule)

null >= 0;   // true (!)
null > 0;    // false
null == 0;   // false
```

**Why `null >= 0`:**
- `>=` uses relational comparison
- Converts null to number: ToNumber(null) → 0
- 0 >= 0 → true

**But `null == 0` is false:**
- `==` has special rule: null only equals undefined

---

### Trap 5: String concatenation vs addition

```javascript
"5" + 3;     // "53" (concatenation)
"5" - 3;     // 2 (subtraction, both to number)
```

**Why:**
- `+` is overloaded (addition OR concatenation)
- If either operand is string → concatenation
- Other operators → ToNumber both operands

---

## Practical Implications

### Use cases for understanding abstract ops:

1. **Debug coercion bugs**
   ```javascript
   if (x == true) // BAD! true becomes 1
   if (x)         // GOOD! ToBoolean(x)
   ```

2. **Understand primitive conversion**
   ```javascript
   const obj = { valueOf: () => 5 };
   console.log(obj + 10);  // 15 (valueOf used)
   ```

3. **Predict equality behavior**
   ```javascript
   "0" == false;  // true (both become 0)
   "0" === false; // false (different types)
   ```

---

## Key Takeaways

1. **Abstract operations are internal spec algorithms**, not callable functions
2. **ToPrimitive:** Object → primitive (valueOf/toString)
3. **ToNumber:** Value → number (many special cases)
4. **ToString:** Value → string
5. **ToBoolean:** Only 7 falsy values, rest are truthy
6. **`==` is complex:** Multiple conversion steps
7. **`+` is special:** String concatenation OR addition
8. **Always use `===`** unless you specifically need coercion

---

## Next Chapter Preview

**Chapter 12: Objects and Property Access** - Deep dive into property descriptors, getters/setters, and Object methods.
