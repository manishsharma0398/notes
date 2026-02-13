# Chapter 10 Interview Questions: Type Coercion and Equality

## Question 1: Explain Type Coercion and Abstract Operations

**Q:** What is type coercion in JavaScript? Explain the three main abstract operations (ToNumber, ToString, ToBoolean) with examples.

**A:**

**Type coercion** is the automatic conversion of values from one data type to another. JavaScript uses internal "abstract operations" defined in the ECMAScript specification to perform these conversions.

### The Three Main Abstract Operations

**1. ToNumber** - Converts values to numbers

Rules:
```javascript
ToNumber(undefined)  // NaN
ToNumber(null)       // 0 (IMPORTANT!)
ToNumber(true)       // 1
ToNumber(false)      // 0
ToNumber("")         // 0
ToNumber(" ")        // 0 (whitespace trimmed)
ToNumber("42")       // 42
ToNumber("abc")      // NaN
```

For objects, calls `ToPrimitive(value, "number")` first, then converts the resulting primitive.

```javascript
ToNumber([])      // 0 ([] → "" → 0)
ToNumber([5])     // 5 ([5] → "5" → 5)
ToNumber([1, 2])  // NaN ([1,2] → "1,2" → NaN)
```

**2. ToString** - Converts values to strings

Rules:
```javascript
ToString(undefined)  // "undefined"
ToString(null)       // "null"
ToString(true)       // "true"
ToString(42)         // "42"
ToString(NaN)        // "NaN"
```

For objects, calls `ToPrimitive(value, "string")` first.

```javascript
ToString([])      // ""
ToString([1, 2])  // "1,2"
ToString({})      // "[object Object]"
```

** 3. ToBoolean** - Converts values to booleans

**Falsy values (only 7):**
- `false`, `0`, `-0`, `0n`
- `""` (empty string)
- `null`, `undefined`, `NaN`

**Everything else is truthy**, including:
```javascript
ToBoolean([])                    // true (!)
ToBoolean({})                    // true
ToBoolean("0")                   // true
ToBoolean(new Boolean(false))    // true (object!)
```

### Why This Matters

Understanding these operations explains seemingly weird behavior:

```javascript
"" + 1      // "1" (ToNumber skipped, string concat)
"" - 1      // -1 (both ToNumber: 0 - 1)
if ([]) {}  // executes (ToBoolean([]) → true)
[] == false // true ([] → "" → 0, false → 0)
```

---

## Question 2: Explain === vs == in Detail

**Q:** What's the difference between `===` and `==`? Walk through the algorithm for each and provide examples where they differ.

**A:**

### === (Strict Equality)

**Never coerces.** Compares type AND value.

**Algorithm:**
1. If types are different → return `false`
2. If type is Number:
   - If either is `NaN` → return `false`
   - If values are equal → return `true`
   - If one is `+0` and other is `-0` → return `true`
3. For other types, check if values are equal (objects: same reference)

**Examples:**
```javascript
5 === 5          // true (same type, same value)
5 === "5"        // false (different types)
NaN === NaN      // false (NaN special case)
+0 === -0        // true
[] === []        // false (different objects)
null === undefined  // false (different types)
```

### == (Abstract Equality)

**Allows coercion** before comparison.

**Algorithm** (simplified):
1. If same type → return `x === y`
2. If one is `null` and other is `undefined` → return `true`
3. If one is Number and other is String → convert String to Number, compare
4. If one is Boolean → convert to Number, compare
5. If one is Object and other is primitive → convert Object to primitive, compare
6. Otherwise → return `false`

**Examples:**
```javascript
// Same type: like ===
5 == 5           // true
"a" == "a"       // true

// null/undefined special case
null == undefined    // true (ONLY equal to each other!)
null == 0            // false (not coerced)

// Number/String → ToNumber(String)
5 == "5"         // true ("5" → 5)
0 == ""          // true ("" → 0)

// Boolean → ToNumber
true == 1        // true (true → 1)
false == 0       // true (false → 0)
true == "1"      // true (true → 1, "1" → 1)

// Object → ToPrimitive
[] == ""         // true ([] → "")
[] == 0          // true ([] → "" → 0)
```

### The Gotcha: Non-Transitivity

`==` is NOT transitive:
```javascript
"0" == 0   // true ("0" → 0)
0 == ""    // true ("" → 0)
"0" == ""  // false (both strings, no coercion!)
```

### When to Use Which

**Use `===` by default:**
- Explicit about types
- No hidden behavior
- Prevents bugs

**Use `==` only for:**
```javascript
// Checking for null OR undefined
if(value == null) {  // null or undefined
    // ...
}

// Instead of:
if (value === null || value === undefined) { }
```

**Key principle**: Different types being equal is usually a code smell. Be explicit.

---

## Question 3: Why is [] == ![] true?

**Q:** Explain step-by-step why `[] == ![]` evaluates to `true`. What does this reveal about JavaScript's coercion rules?

**A:**

This is one of JavaScript's most confusing coercions, but it follows logical steps:

### Step-by-Step Breakdown

```javascript
[] == ![]
```

**Step 1: Evaluate the right side first** (`![]`)
- `[]` is an empty array
- In boolean context, `ToBoolean([])` → `true` (all objects are truthy!)
- `!true` → `false`
- Now we have: `[] == false`

**Step 2: Apply == algorithm**
- Left side: `[]` (object)
- Right side: `false` (boolean)
- Boolean converts to number: `false` → `0`
- Now we have: `[] == 0`

**Step 3: Object to primitive**
- Left side: `[]` (object)
- Right side: `0` (number)
- Object converts to primitive: `ToPrimitive([], "number")`
- `[].valueOf()` → `[]` (not primitive, try toString)
- `[].toString()` → `""` (empty string)
- Now we have: `"" == 0`

**Step 4: String to number**
- Left side: `""` (string)
- Right side: `0` (number)
- String converts to number: `ToNumber("")` → `0`
- Now we have: `0 == 0`

**Step 5: Same type, same value**
- `0 === 0` → `true`

### What This Reveals

1. **ToBoolean vs ToPrimitive are different**
   - `ToBoolean([])` → `true` (for `if` statements)
   - `ToPrimitive([])` → `""` (for `==` comparisons)

2. **Context matters**
   - `if ([])` executes (truthy)
   - `[] == true` is `false`
   - `[] == false` is `true`

3. **Coercion is predictable but non-intuitive**
   - Each step follows clear rules
   - The combination creates surprising results

### Practical Takeaway

```javascript
// Confusing: truthy but == false
if ([]) {
    console.log('Executes!');  // Runs
}
console.log([] == false);  // true

// Better: explicit checks
if (arr.length > 0) { }
```

**Lesson**: Use `===` and explicit conversions to avoid these gotchas.

---

## Question 4: Explain ToPrimitive and Symbol.toPrimitive

**Q:** How does JavaScript convert objects to primitives? Explain the ToPrimitive algorithm and how Symbol.toPrimitive works.

**A:**

### ToPrimitive Algorithm

When JavaScript needs to convert an object to a primitive, it calls the internal `ToPrimitive(input, hint)` operation.

**Algorithm:**
```
ToPrimitive(input, hint):
  1. If input is already primitive, return it
  2. If input has Symbol.toPrimitive method:
       result = input[Symbol.toPrimitive](hint)
       if result is primitive, return result
       else throw TypeError
  3. If hint is "string":
       Try toString() → if primitive, return
       Try valueOf()  → if primitive, return
  4. If hint is "number" or "default":
       Try valueOf()  → if primitive, return
       Try toString() → if primitive, return
  5. Throw TypeError (no primitive returned)
```

### When Each Hint is Used

**hint: "string"**
- `String(obj)`
- Template literals: `` `${obj}` ``
- String concatenation: `"text" + obj` (if left is string)

**hint: "number"**
- `Number(obj)`
- Arithmetic: `+obj`, `-obj`, `obj - x`, `obj * x`, etc.
- Comparison: `obj < x`, `obj > x`

**hint: "default"**
- `obj + x` (if neither is string)
- `obj == x`
- Most operators

### Default valueOf/toString Behavior

```javascript
const obj = {
    valueOf() {
        return 42;
    },
    toString() {
        return "hello";
    }
};

// hint: "number" → valueOf first
Number(obj)  // 42
+obj         // 42
obj - 1      // 41

// hint: "string" → toString first
String(obj)  // "hello"
`${obj}`     // "hello"

// hint: "default" → valueOf first (usually)
obj + ""     // "42" (valueOf returns 42)
obj == 42    // true
```

### Symbol.toPrimitive Override

Modern way to control all conversions:

```javascript
const price = {
    cents: 1250,
    
    [Symbol.toPrimitive](hint) {
        if (hint === 'number') {
            return this.cents;
        }
        if (hint === 'string') {
            return `$${(this.cents / 100).toFixed(2)}`;
        }
        // hint === 'default'
        return this.cents;
    }
};

Number(price)    // 1250 (hint: number)
String(price)    // "$12.50" (hint: string)
price + 100      // 1350 (hint: default)
price > 1000     // true (hint: number)
```

### Arrays and Dates

**Arrays:**
```javascript
[1, 2, 3].valueOf()   // [1, 2, 3] (returns self, not primitive)
[1, 2, 3].toString()  // "1,2,3" (joins with comma)

Number([5])   // 5 ([] → "5" → 5)
```

**Dates (special):**
```javascript
const date = new Date();

date.valueOf()   // timestamp (number)
date.toString()  // date string

// hint: "default" uses toString (unlike most objects!)
date + ""        // date string
```

### Common Pitfalls

```javascript
// No primitive returned
const bad = {
    valueOf() { return {}; },    // Not primitive!
    toString() { return {}; }    // Not primitive!
};

Number(bad);  // TypeError
```

**Key Takeaway**: `Symbol.toPrimitive` gives full control, otherwise `valueOf`/`toString` are called based on hint.

---

## Question 5: Truthy vs Falsy - Edge Cases

**Q:** List all falsy values in JavaScript. Explain why `[]` is truthy but `[] == false` is true. How does this relate to `ToBoolean` vs `ToPrimitive`?

**A:**

### All Falsy Values (Only 7!)

```javascript
false
0
-0
0n          // BigInt zero
""          // empty string
null
undefined
NaN
```

**Everything else is truthy**, including:
```javascript
[]                   // empty array
{}                   // empty object
"0"                  // non-empty string
"false"              // non-empty string
new Boolean(false)   // object
function(){}         // function
```

### The Paradox: [] is Truthy but [] = = false is True

This seems contradictory but uses different operations:

**In `if` statement:**
```javascript
if ([]) {
    // Executes! (ToBoolean)
}
```
- Uses `ToBoolean([])`
- Objects are ALWAYS truthy
- `ToBoolean([])` → `true`

**In `==` comparison:**
```javascript
[] == false  // true
```
- Uses `ToPrimitive` and `ToNumber`
- Step 1: `false` → `0` (ToNumber)
- Step 2: `[]` → `""` (ToPrimitive)
- Step 3: `""` → `0` (ToNumber)
- Step 4: `0 == 0` → `true`

### ToBoolean vs ToPrimitive

**ToBoolean** (for boolean contexts):
```
if (value)
while (value)
value ? x : y
!value
!!value
```
- Simple: 7 falsy, rest truthy
- No conversion chain

**ToPrimitive** (for comparisons/operations):
```
value == x
value + x
value < x
```
- Complex: calls valueOf/toString
- Can produce different primitives

### More Examples

```javascript
// All truthy:
if ([])    { } // executes
if ({})    { } // executes
if ("0")   { } // executes
if (new Boolean(false)) { } // executes

// But in ==:
[] == false       // true ([] → "" → 0)
{} == false       // false ({} → "[object Object]" → NaN)
"0" == false      // true ("0" → 0)
new Boolean(false) == false  // true (valueOf → false)
```

### Practical Implications

**Gotcha: empty array check**
```javascript
const arr = [];

// BAD: always truthy
if (arr) {
    console.log('Has items');  // Executes even when empty!
}

// GOOD: check length
if (arr.length > 0) {
    console.log('Has items');
}
```

**Gotcha: empty object check**
```javascript
const obj = {};

// BAD
if (obj) { }  // Always executes

// GOOD
if (Object.keys(obj).length > 0) { }
```

### Key Takeaway

**For boolean context** (`if`, `while`):
- Use `ToBoolean`
- Only 7 falsy values
- Objects always truthy

**For comparisons** (`==`, `+`, `<`):
- Use `ToPrimitive` → `ToNumber`/`ToString`
- Objects convert to primitives
- Result depends on conversion

**Best practice**: Don't rely on truthiness for arrays/objects. Check explicitly.

---

## Question 6: null vs undefined in Coercion

**Q:** How do `null` and `undefined` behave in type coercion? Why are they only `==` to each other? Show their behavior in ToNumber, ToString, and comparisons.

**A:**

### Basic Difference

- **`undefined`**: Variable declared but not assigned, missing function parameter, missing object property
- **`null`**: Explicit "no value", intentional absence

### In == (Abstract Equality)

**Special rule**: `null` and `undefined` are only `==` to each other, nothing else.

```javascript
null == undefined    // true (special case!)
null == null         // true
undefined == undefined  // true

// NOT equal to anything else
null == 0            // false
null == false        // false
null == ""           // false
null == []           // false

undefined == 0       // false
undefined == false   // false
undefined == ""      // false
```

**Why?** The spec explicitly defines this behavior to treat them as "no value" equivalents.

### In === (Strict Equality)

Different types, so never equal:
```javascript
null === undefined   // false
null === null        // true
undefined === undefined  // true
```

### ToNumber

```javascript
Number(null)         // 0 (!)
Number(undefined)    // NaN

null + 5             // 5 (0 + 5)
undefined + 5        // NaN
null * 2             // 0
undefined * 2        // NaN
```

**Critical**: `null` becomes `0`, but `null == 0` is `false`!

```javascript
// Arithmetic uses ToNumber
null + 1    // 1 (null → 0)

// But == has special rule
null == 0   // false (special case, not coerced)
```

### ToString

```javascript
String(null)         // "null"
String(undefined)    // "undefined"

"Value: " + null     // "Value: null"
`Result: ${undefined}`  // "Result: undefined"
```

### ToBoolean

Both are falsy:
```javascript
Boolean(null)        // false
Boolean(undefined)   // false

if (null) { }        // doesn't execute
if (undefined) { }   // doesn't execute

!!null               // false
!!undefined          // false
```

### Comparison Operators

```javascript
null < 0    // false (ToNumber: 0 < 0)
null > 0    // false (ToNumber: 0 > 0)
null == 0   // false (special rule!)
null >= 0   // true (ToNumber: 0 >= 0) (!!)

undefined < 0   // false (ToNumber: NaN < 0)
undefined > 0   // false
undefined == 0  // false
undefined >= 0  // false (NaN never compares)
```

**Gotcha**: `null >= 0` is `true` but `null == 0` is `false`!

Why? `>=` uses `ToNumber`, but `==` has special rule.

### Practical Patterns

**Checking for null OR undefined:**
```javascript
// Good: short and clear
if (value == null) {
    // value is null or undefined
}

// Equivalent but verbose
if (value === null || value === undefined) {
    // ...
}

// Modern: nullish coalescing
const result = value ?? "default";  // Only for null/undefined
```

**Checking for definite value:**
```javascript
// BAD: 0, "", false also fail
if (value) { }

// GOOD: explicit
if (value !== null && value !== undefined) { }
if (value != null) { }  // shorter
```

### typeof  Check

```javascript
typeof null         // "object" (historical bug!)
typeof undefined    // "undefined"

// Safe check for undefined
if (typeof value === 'undefined') { }

// But for null
if (value === null) { }
```

### Summary Table

| Operation | `null` | `undefined` |
|-----------|--------|-------------|
| `ToNumber` | `0` | `NaN` |
| `ToString` | `"null"` | `"undefined"` |
| `ToBoolean` | `false` | `false` |
| `== other` | only `undefined` | only `null` |
| `=== other` | only `null` | only `undefined` |
| `typeof` | `"object"` | `"undefined"` |

**Key Takeaways:**
1. `null == undefined` is `true` (special rule)
2. Neither coerces in `==` except to each other
3. `null` → `0` in arithmetic, `undefined` → `NaN`
4. Both are falsy
5. Use `== null` to check for both

---

## Question 7: The + Operator's Dual Nature

**Q:** Why does the `+` operator behave differently from `-`, `*`, `/`? Explain how JavaScript decides between string concatenation and numeric addition.

**A:**

The `+` operator is **overloaded** - it does both string concatenation AND numeric addition, while other operators only do numeric operations.

### The Rule

**If either operand is a string, do string concatenation. Otherwise, numeric addition.**

### Algorithm

```
x + y:
  1. Convert both to primitives (ToPrimitive with hint "default")
  2. If either primitive is a string:
       Convert both to strings (ToString)
       Concatenate
  3. Else:
       Convert both to numbers (ToNumber)
       Add
```

### String Concatenation Path

If **ANY** operand is a string:
```javascript
"hello" + "world"  // "helloworld"
"5" + 3            // "53" (3 → "3")
5 + "3"            // "53" (5 → "5")
true + "!"         // "true!"
null + "value"     // "nullvalue"
undefined + "!"    // "undefined!"
```

Objects convert to string if ToPrimitive returns string:
```javascript
[] + "hello"       // "hello" ([] → "")
[1, 2] + "!"       // "1,2!"
({}) + "!"         // "[object Object]!"
```

### Numeric Addition Path

If **BOTH** operands are non-strings:
```javascript
5 + 3              // 8
true + 1           // 2 (true → 1)
false + 5          // 5 (false → 0)
null + 5           // 5 (null → 0)
undefined + 5      // NaN (undefined → NaN)
[] + []            // "" (both → "", "" + "" = "")
[]+ 5              // "5" ([] → "", "" + 5 but "" is string!)
```

Wait, `[] + 5` is `"5"`, not `5`!

Why? `[] → ""` (ToPrimitive), and `""` is a string, so string path.

### Other Operators (-, *, /, etc.)

Always convert to numbers:
```javascript
"5" - 3      // 2 (both ToNumber)
"10" / "2"   // 5
"foo" * 2    // NaN ("foo" → NaN)
true - false // 1 (1 - 0)
[] - 1       // -1 ([] → "" → 0, 0 - 1)
```

### Order Matters

Left-to-right evaluation:
```javascript
1 + 2 + "3"      // "33" (1+2=3, 3+"3"="33")
"1" + 2 + 3      // "123" ("1"+2="12", "12"+3="123")
1 + (2 + "3")    // "123" (2+"3"="23", 1+"23"="123")

// Compare:
1 + 2 - "3"      // 0 (1+2=3, 3-"3"=3-3=0)
```

### Common Gotchas

**1. Unexpected string concat:**
```javascript
const result = someNumber + input;  // If input is string, concatenates!

// Fix: explicit conversion
const result = someNumber + Number(input);
```

**2. Template literals always stringify:**
```javascript
`Result: ${1 + 2}`      // "Result: 3" (number 3 → "3")
`Result: ${1} ${2}`     // "Result: 1 2"
```

**3. Empty string trick:**
```javascript
const str = value + "";  // Converts to string
// Better: String(value)
```

**4. Array "addition":**
```javascript
[1] + [2]    // "12" (not [1,2]!)
// [1] → "1", [2] → "2", "1" + "2" = "12"
```

### Practical Patterns

**Convert to number:**
```javascript
// BAD: implicit
const num = str - 0;
const num = +str;

// GOOD: explicit
const num = Number(str);
const num = parseFloat(str);
```

**Convert to string:**
```javascript
// OK: idiomatic
const str = num + "";
const str = `${num}`;

// BETTER: explicit
const str = String(num);
const str = num.toString();
```

### Why This Design?

**Historical reason**: `+` was overloaded for convenience in early JavaScript for string building.

**Problem**: Creates ambiguity and bugs:
```javascript
function add(a, b) {
    return a + b;  // Number or string?
}

add(1, 2)    // 3
add("1", 2)  // "12" (OOPS!)
```

**Modern solution**: Template literals for strings, explicit for numbers.

###Key Takeaways:
1. `+` does string concat if ANY operand is string
2. Other operators always convert to number
3. Order matters (left-to-right)
4. Be explicit with conversions
5. Watch for accidental string concat

---

## Question 8: Solve Common Coercion Puzzles

**Q:** Explain the result of each:
1. `[] + {}`
2. `{} + []`
3. `[] == ![]`
4. `"0" Array: == 0 && 0 == "" but "0" != ""`
5. `typeof null`

**A:**

### 1. `[] + {}`

**Result:** `"[object Object]"`

**Explanation:**
- Both operands: objects
- `ToPrimitive([], "default")`:
  - `[].valueOf()` → `[]` (not primitive)
  - `[].toString()` → `""`
- `ToPrimitive({}, "default")`:
  - `{}.valueOf()` → `{}` (not primitive)
  - `{}.toString()` → `"[object Object]"`
- Now: `"" + "[object Object]"`
- Result: `"[object Object]"`

### 2. `{} + []`

**Result:** Depends on context!

**In statement position** (at start of line):
```javascript
{} + []  // 0
```
- `{}` is interpreted as empty code block (not object!)
- Equivalent to: `{}; +[]`
- `+[]` → `+""` → `0`

**In expression position:**
```javascript
({} + [])  // "[object Object]"
const x = {} + [];  // "[object Object]"
```
- Parentheses force `{}` to be an object expression
- Same as `[] + {}` → `"[object Object]"`

### 3. `[] == ![]`

**Result:**` true`

**Explanation:**
- Evaluate `![]` first:
  - `ToBoolean([])` → `true` (objects are truthy)
  - `!true` → `false`
- Now: `[] == false`
- `ToNumber(false)` → `0`
- `Top rimitive([])` → `""`
- `ToNumber("")` → `0`
- `0 == 0` → `true`

### 4. `"0" == 0 && 0 == ""` but `"0" != ""`

**Results:**
- `"0" == 0` → `true`
- `0 == ""` → `true`
- `"0" == ""` → `false`

**This breaks transitivity!**

**Explanation:**

`"0" == 0`:
- String vs Number
- `ToNumber("0")` → `0`
- `0 == 0` → `true`

`0 == ""`:
- Number vs String
- `ToNumber("")` → `0`
- `0 == 0` → `true`

`"0" == ""`:
- Both are strings!
- Same type → use `===`
- `"0" === ""` → `false` (different strings)

**Key insight**: `==` coerces different types, but not same types.

### 5. `typeof null`

**Result:** `"object"`

**Explanation:**

This is a **bug** in JavaScript that can't be fixed due to backward compatibility.

**History:**
- In JavaScript's first implementation, values were tagged with type information
- Objects: type tag `000`
- `null`: all zeros (`0x00`)
- `typeof` checked the type tag
- `null`'s tag matched object's tag

**Impact:**
```javascript
typeof null === "object"  // true (bug!)

// Can't use typeof to detect no null:
if (typeof value === "object") {
    // Could be null!
}

// Fix: explicit null check
if (value !== null && typeof value === "object") {
    // Definitely an object
}

// Or:
if (value && typeof value === "object") {
    // Truthy and object (null is falsy)
}
```

### Bonus Puzzles

**`typeof NaN`:**
```javascript
typeof NaN  // "number" (it IS a number, just "not a number" value)
```

**`typeof function(){}`:**
```javascript
typeof function(){}  // "function" (not "object"!)
```

**`NaN === NaN`:**
```javascript
NaN === NaN  // false (only value not equal to itself)
```

**`+0 === -0`:**
```javascript
+0 === -0  // true (but Object.is(+0, -0) → false)
```

### Key Takeaways:
1. `{} + []` vs `[] + {}`: context matters (block vs expression)
2. `[] == ![]`: multiple coercion steps
3. `==` is not transitive
4. `typeof null` is a bug
5. Know the coercion rules to solve any puzzle

---

## Question 9: Comparison Operator Coercion

**Q:** How do `<`, `>`, `<=`, `>=` handle type coercion? Explain why `"10" < "9"` is `true` but `10 < "9"` is `false`.

**A:**

### The Algorithm

Comparison operators use **ToPrimitive**, then:
- **Both strings** → Lexicographic (alphabetical) comparison
- **Otherwise** → Convert both to numbers

```
x < y:
  1. Convert both to primitives (hint: "number")
  2. If BOTH are strings:
       Lexicographic comparison
  3. Else:
       Convert both to numbers (ToNumber)
       Numeric comparison
```

### String vs Numeric Comparison

**`"10" < "9"`** → `true` (Lexicographic)
- Both are strings
- Compare character by character
- `"1"` < `"9"` in Unicode
- Result: `true`

**`10 < "9"`** → `false` (Numeric)
- Different types (number and string)
- Not both strings → convert to numbers
- `ToNumber(10)` → `10`
- `ToNumber("9")` → `9`
- `10 < 9` → `false`

### More Examples

**Lexicographic (both strings):**
```javascript
"2" < "10"      // false ("2" > "1" lexicographically)
"abc" < "abd"   // true ("c" < "d")
"apple" < "banana"  // true
"10" < "9"      // true ("1" < "9")
```

**Numeric (at least one non-string):**
```javascript
2 < 10          // true
"2" < 10        // true ("2" → 2)
10 < "9"        // false ("9" → 9)
"10" < 9        // false ("10" → 10)
```

### Arrays and Objects

Arrays/objects convert to primitives first:
```javascript
[2] > [1]       // true 
// [2] → "2", [1] → "1", both strings → lexicographic
// "2" > "1" → true

[10] < [9]      // true (!)
// [10] → "10", [9] → "9", both strings → lexicographic
// "10" < "9" → true

[10] < 9        // false
// [10] → "10" → 10, compare  10 < 9 → false

[] < 1          // true
// [] → "" → 0, compare 0 < 1 → true
```

### NaN in Comparisons

NaN comparisons always return `false`:
```javascript
NaN < 5      // false
NaN > 5      // false
NaN == 5     // false
NaN <= 5     // false
NaN >= 5     // false
NaN === NaN  // false

// Even comparing to itself!
NaN < NaN    // false
NaN > NaN    // false
```

### Gotcha: <= and >= Are NOT Opposites of >, <

```javascript
// For most values:
5 < 10   // true
5 >= 10  // false (opposite, as expected)

// But with NaN:
NaN < 5   // false
NaN >= 5  // false (NOT opposite!)

// And:
null >= 0  // true (ToNumber: 0 >= 0)
null > 0   // false (ToNumber: 0 > 0)
null == 0  // false (special rule!)
```

### Mixed Types Table

| Expression | Result | Reason |
|------------|--------|--------|
| `"10" < "9"` | `true` | Lexicographic |
| `10 < "9"` | `false` | Numeric (10 < 9) |
| `"10" < 9` | `false` | Numeric (10 < 9) |
| `"2" < "10"` | `false` | Lexicographic ("2" > "1") |
| `2 < "10"` | `true` | Numeric (2 < 10) |
| `[10] < [9]` | `true` | Lexicographic ("10" < "9") |
| `[10] < 9` | `false` | Numeric (10 < 9) |

### Practical Implications

**Sorting Arrays:**
```javascript
const numbers = [10, 2, 5, 1, 9];

// BAD: lexicographic sort
numbers.sort();  // [1, 10, 2, 5, 9] (!)

// GOOD: explicit numeric
numbers.sort((a, b) => a - b);  // [1, 2, 5, 9, 10]
```

**Comparing dates:**
```javascript
const date1 = new Date('2024-01-15');
const date2 = new Date('2024-01-20');

date1 < date2  // true (valueOf → timestamps)
```

**Comparing booleans:**
```javascript
true > false   // true (1 > 0)
false < true   // true (0 < 1)
```

### Best Practices

1. **Avoid comparing different types**
```javascript
// BAD
if (stringValue < numberValue) { }

// GOOD
if (Number(stringValue) < numberValue) { }
```

2. **Be explicit with strings**
```javascript
// For alphabetical:
str1.localeCompare(str2) < 0

// For numeric strings:
Number(str1) < Number(str2)
```

3. **Use NaN checks**
```javascript
if (Number.isNaN(value1) || Number.isNaN(value2)) {
    // Handle NaN case
}
```

**Key Takeaways:**
1. Both strings → lexicographic
2. Otherwise → convert to numbers
3. Watch for arrays (convert to strings first!)
4. NaN comparisons always `false`
5. Use explicit conversions for clarity

---

## Question 10: Best Practices for Coercion

**Q:** What are the best practices for handling type coercion in production code? When should you embrace coercion vs avoid it?

**A:**

### General Principle

**Be explicit about type conversions.** Implicit coercion should be the exception, not the rule.

### 1. Use === by Default

```javascript
// BAD: implicit coercion
if (value == "5") { }

// GOOD: explicit about types
if (value === 5) { }
if (String(value) === "5") { }
```

**Exception:** Checking for `null`/`undefined`:
```javascript
// GOOD: concise and clear
if (value == null) {  // null OR undefined
    // ...
}

// Equivalent but verbose:
if (value === null || value === undefined) { }
```

### 2. Explicit Conversions

```javascript
// BAD: implicit
const num = +"42";
const num = value - 0;
const str = value + "";
const bool = !!value;

// GOOD: explicit
const num = Number("42");
const num = parseInt(value, 10);
const str = String(value);
const bool = Boolean(value);
```

**Exception:** `!!value` is idiomatic and clear:
```javascript
const isValid = !!value;  // OK
if (!!array.length) { }   // OK but 'if (array.length)' is better
```

### 3. Array and Object Checks

```javascript
// BAD: truthy check
if (array) {
    // Empty array passes!
}

// GOOD: explicit length
if (array && array.length > 0) { }
if (Object.keys(obj).length > 0) { }
```

### 4. Default Values

```javascript
// BAD: || fails for 0,"", false
function greet(name) {
    return name || "Guest";  // "" becomes "Guest"!
}

// GOOD: ?? only for null/undefined
function greet(name) {
    return name ?? "Guest";  // "" preserved
}

// Or explicit:
function greet(name) {
    return (name !== undefined && name !== null) ? name : "Guest";
}
```

### 5. Number Parsing

```javascript
// BAD: Number() can be surprising
Number("  ")      // 0
Number("")        // 0
Number("42px")    // NaN

// GOOD: explicit intent
parseInt("42", 10)    // 42 (always specify radix!)
parseInt("42px", 10)  // 42 (stops at non-digit)
parseFloat("3.14px")  // 3.14

// Or with validation:
function toNumber(value) {
    const num = Number(value);
    return Number.isNaN(num) ? 0 : num;
}
```

### 6. String Concatenation

```javascript
// BAD: + can be ambiguous
const result = value1 + value2;  // Number or string?

// GOOD: explicit
const result = String(value1) + String(value2);
const result = `${value1}${value2}`;  // Template literals

// For numbers:
const sum = Number(value1) + Number(value2);
```

### 7. Boolean Contexts

```javascript
// OK: falsy check
if (value) { }
if (!value) { }

// BETTER: explicit for specific values
if (value !== 0) { }
if (value !== "") { }
if (value !== null && value !== undefined) { }
if (value != null) { }  // null or undefined
```

### 8. Comparison Operators

```javascript
// BAD: cross-type comparison
if (stringValue < numberValue) { }

// GOOD: same types
if (Number(stringValue) < numberValue) { }

// For strings:
if (str1.localeCompare(str2) < 0) { }
```

### When to Embrace Coercion

**1. `value == null`** - Standard idiom
```javascript
if (value == null) {  // Widely accepted
    // Handle null/undefined
}
```

**2. `!!value`** - Common boolean conversion
```javascript
const hasValue = !!something;  // Idiomatic
return !!user.isActive;
```

**3. Template literals** - Clear intent
```javascript
const message = `User ${userId} logged in`;  // Clear
```

**4. Truthy/falsy** guards - When appropriate
```javascript
const name = user && user.name;  // OK
const firstItem = array && array[0];  // OK

// Modern: optional chaining
const name = user?.name;  // Better
```

### When to Avoid Coercion

**1. `==` for non-null checks** - Almost always
```javascript
// AVOID
if (value == 0) { }      // Could be "", [], false
if (value == false) { }  // Could be 0, "", []

// USE
if (value === 0) { }
if (value === false) { }
```

**2. Arithmetic coercion tricks**
```javascript
// AVOID
const num = value - 0;
const num = value * 1;
const str = value + "";

// USE
const num = Number(value);
const str = String(value);
```

**3. Mixed-type comparisons**
```javascript
// AVOID
if (stringValue > numberValue) { }

// USE
if (Number(stringValue) > numberValue) { }
```

### Linting Rules

Use ESLint:
```javascript
// .eslintrc
{
    "rules": {
        "eqeqeq": ["error", "always"],  // Require ===
        "no-implicit-coercion": "warn"  // Flag implicit coercion
    }
}
```

### TypeScript Benefits

TypeScript prevents many coercion bugs:
```typescript
function add(a: number, b: number): number {
    return a + b;  // Type-safe
}

add(1, "2");  // Error! Can't pass string
```

### Code Review Checklist

- [ ] Using `===` instead of `==` (except `== null`)
- [ ] Explicit conversions: `Number()`, `String()`, `Boolean()`
- [  ] Array/object checks use `.length` or `Object.keys()`
- [ ] Default values use `??` or explicit checks
- [ ] `parseInt` with radix specified
- [ ] Boolean contexts are intentionally truthy/falsy
- [ ] No mixed-type comparisons without conversion

### Key Takeaways:
1. **Default to explicit**: `Number()`, `String()`, `Boolean()`
2. **Use `===`** except for `== null` check
3. **Use `??`** for nullable defaults
4. **Check `.length`** for arrays, not truthiness
5. **Template literals** for string building
6. **`parseInt(value, 10)`** always with radix
7. **`!!value`** is acceptable for boolean conversion
8. **Lint and type check** to catch coercion bugs
9. **Comment intentional coercion** for code readers
10. **When in doubt, be explicit**

---

These 10 questions cover the deep mechanics and practical applications of type coercion and equality in JavaScript, suitable for senior-level interviews.
