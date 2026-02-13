# Chapter 7: Primitive vs Reference Types - Interview Questions

## Question 1: Core Understanding

**Explain the difference between primitive and reference types in JavaScript. List all primitive types.**

<details>
<summary>Answer</summary>

**Primitives** are immutable values stored directly in the variable's memory location. When you assign or pass a primitive, the **value itself** is copied.

**References** are mutable objects stored in heap memory. Variables hold a **memory address** (pointer) to the actual data. When you assign or pass a reference, the **address** is copied, not the object itself.

**The seven primitive types:**
1. `number` (including `NaN`, `Infinity`)
2. `string`
3. `boolean`
4. `undefined`
5. `null`
6. `symbol` (ES6)
7. `bigint` (ES2020)

**Everything else is a reference type**: objects, arrays, functions, dates, regex, Map, Set, etc.

**Key distinction**: Primitives are compared and copied by value; references are compared and copied by address.

</details>

---

## Question 2: Assignment Behavior

**Predict the output and explain why.**

```javascript
let a = 10;
let b = a;
b = 20;
console.log(a);

let obj1 = { x: 10 };
let obj2 = obj1;
obj2.x = 20;
console.log(obj1.x);
```

<details>
<summary>Answer</summary>

**Output:**
```
10
20
```

**Explanation:**

**First part (primitives):**
1. `let a = 10` - `a` stores the value 10
2. `let b = a` - **Copies the value** 10 to `b`
3. `a` and `b` are completely independent
4. `b = 20` - Only `b` changes
5. `console.log(a)` - Still 10

**Second part (references):**
1. `let obj1 = { x: 10 }` - Creates object, `obj1` stores memory address
2. `let obj2 = obj1` - **Copies the address**, not the object
3. Both `obj1` and `obj2` point to the **same object** in memory
4. `obj2.x = 20` - Modifies the object through `obj2`
5. `obj1.x` - Accessing the same object shows 20

**Memory diagram:**
```
Primitives:          References:
a: [10]              obj1: [0xFF00] ──┐
b: [20]              obj2: [0xFF00] ──┼──→ { x: 20 }
```

</details>

---

## Question 3: Function Arguments

**What will this log and why? How does JavaScript pass arguments?**

```javascript
function modify(num, obj) {
  num = 100;
  obj.x = 100;
  obj = { x: 999 };
}

let n = 5;
let o = { x: 5 };
modify(n, o);

console.log(n);
console.log(o.x);
```

<details>
<summary>Answer</summary>

**Output:**
```
5
100
```

**Explanation:**

JavaScript is **pass-by-value** for both primitives and references. However, for references, the value being passed is the **memory address**.

**For `num` (primitive):**
1. The value `5` is copied to parameter `num`
2. `num = 100` modifies the local copy
3. Original variable `n` is unaffected

**For `obj` (reference):**
1. The memory address is copied to parameter `obj`
2. Both the original `o` and parameter `obj` point to the same object
3. `obj.x = 100` modifies the shared object → affects `o.x`
4. `obj = { x: 999 }` **reassigns the local parameter** to a new object
5. This doesn't affect the original variable `o`

**Critical insight**: Reassigning a parameter only changes the local variable, not the original. But modifying through the reference affects the original object.

</details>

---

## Question 4: Equality Comparison

**Explain why each comparison produces its result.**

```javascript
console.log(5 === 5);
console.log("hello" === "hello");
console.log({x: 5} === {x: 5});
console.log([] === []);

let arr = [1, 2, 3];
console.log(arr === arr);
```

<details>
<summary>Answer</summary>

**Output:**
```
true
true
false
false
true
```

**Explanation:**

**Primitives compare by value:**
- `5 === 5` - Same value → `true`
- `"hello" === "hello"` - Same value → `true`

**References compare by reference (memory address):**
- `{x: 5} === {x: 5}` - Two **different objects** in memory → `false`
  - Even with identical content, they're separate objects
- `[] === []` - Two separate arrays → `false`

**Same reference:**
- `arr === arr` - Same variable, same reference → `true`

**Key insight**: For references, `===` checks if both variables point to the **same object in memory**, not whether objects have the same content.

To compare object contents, you need to:
- Manually compare properties
- Use `JSON.stringify()` (with limitations)
- Use a deep equality function (like from lodash)

</details>

---

## Question 5: Immutability

**Is the behavior the same for both? Why or why not?**

```javascript
let str = "hello";
str[0] = "H";
console.log(str);

let arr = [1, 2, 3];
arr[0] = 10;
console.log(arr);
```

<details>
<summary>Answer</summary>

**Output:**
```
hello
[10, 2, 3]
```

**Explanation:**

**Strings are primitives and IMMUTABLE:**
- `str[0] = "H"` - Attempt to modify fails silently (in strict mode, throws error)
- Primitives cannot be modified in place
- All string operations return **new strings**
- `str` remains `"hello"`

**Arrays are references and MUTABLE:**
- `arr[0] = 10` - Successfully modifies the array
- Arrays are objects and can be mutated
- `arr` becomes `[10, 2, 3]`

**Important distinction:**
- For primitives, you can only **replace** the value, not modify it
- For references, you can **mutate** the content

**This also applies to:**
```javascript
let str = "hello";
let upper = str.toUpperCase();  // Returns NEW string
console.log(str);     // "hello" (unchanged)
console.log(upper);   // "HELLO" (new string)
```

</details>

---

## Question 6: Shallow vs Deep Copy

**Predict the output and explain the difference.**

```javascript
let original = {
  x: 1,
  nested: { y: 2 }
};

let shallow = { ...original };
shallow.x = 10;
shallow.nested.y = 20;

console.log(original.x);
console.log(original.nested.y);
```

<details>
<summary>Answer</summary>

**Output:**
```
1
20
```

**Explanation:**

**Shallow copy** copies only the **top-level properties**. Nested objects are still referenced, not copied.

**Step-by-step:**

1. `{ ...original }` creates a **new object**
2. Top-level primitive `x` is **copied by value**
3. Nested object reference is **copied by reference**

**Memory diagram:**
```
original.x: [1]           shallow.x: [10]
original.nested: [0xFF00] ──┐
                             ├──→ { y: 20 }
shallow.nested:  [0xFF00] ──┘
```

4. `shallow.x = 10` - Modifies shallow's own property (doesn't affect original)
5. `shallow.nested.y = 20` - Modifies the **shared** nested object (affects both!)

**Solutions for deep copy:**

```javascript
// Modern (ES2022+)
let deep = structuredClone(original);

// Older methods
let deep = JSON.parse(JSON.stringify(original));  // Limitations!

// Manual recursive copy
function deepClone(obj) { /* ... */ }
```

**JSON method limitations**: Loses functions, `undefined`, symbols, dates become strings, etc.

</details>

---

## Question 7: const and Mutability

**Will this code work? Explain each case.**

```javascript
const num = 5;
num = 10;  // A

const obj = { x: 5 };
obj.x = 10;  // B
obj = { x: 10 };  // C
```

<details>
<summary>Answer</summary>

**A: ERROR** - Cannot reassign const variable
**B: WORKS** - Can mutate object contents
**C: ERROR** - Cannot reassign const variable

**Explanation:**

`const` prevents **reassignment** of the variable, not **mutation** of the value.

**For primitives:**
- `num = 10` attempts to reassign → ERROR
- Can't change a const primitive

**For references:**
- `obj.x = 10` modifies the object's content → ALLOWED
  - You're not reassigning `obj`, just mutating what it points to
- `obj = { x: 10 }` attempts to reassign `obj` to a new object → ERROR
  - This would change the reference stored in `obj`

**To prevent mutation:**

```javascript
const frozen = Object.freeze({ x: 5 });
frozen.x = 10;  // Silently fails (strict mode: error)
console.log(frozen.x);  // 5
```

**But `Object.freeze()` is shallow:**

```javascript
const obj = Object.freeze({
  x: 1,
  nested: { y: 2 }
});
obj.nested.y = 20;  // WORKS! (nested not frozen)
```

</details>

---

## Question 8: typeof and Type Checking

**What will each log? Explain any surprising results.**

```javascript
console.log(typeof 42);
console.log(typeof "hello");
console.log(typeof true);
console.log(typeof undefined);
console.log(typeof null);
console.log(typeof Symbol());
console.log(typeof {});
console.log(typeof []);
console.log(typeof function(){});
```

<details>
<summary>Answer</summary>

**Output:**
```
"number"
"string"
"boolean"
"undefined"
"object"    ← SURPRISE!
"symbol"
"object"
"object"    ← SURPRISE!
"function"
```

**Surprises explained:**

1. **`typeof null === "object"`** - Historical bug!
   - In JavaScript's first implementation, values were tagged by type
   - Objects had tag `000`, null was represented as all zeros
   - Engine misinterpreted null as object
   - Bug is now part of the spec (can't fix without breaking the web)

2. **`typeof [] === "object"`** - Arrays are objects!
   - Use `Array.isArray([])` for accurate check

**Proper type checking:**

```javascript
// Primitives
typeof value === "number"
typeof value === "string"
typeof value === "boolean"
typeof value === "undefined"
value === null  // Don't use typeof for null!
typeof value === "symbol"
typeof value === "bigint"

// References
typeof value === "object" && value !== null  // True object
Array.isArray(value)  // Array check
typeof value === "function"
value instanceof Date  // Date check
```

</details>

---

## Question 9: Wrapper Objects

**What's happening here? Why doesn't the property persist?**

```javascript
let str = "hello";
str.customProp = "test";
console.log(str.customProp);

console.log(typeof str);
console.log(typeof new String("hello"));
console.log("hello" === new String("hello"));
```

<details>
<summary>Answer</summary>

**Output:**
```
undefined
"string"
"object"
false
```

**Explanation:**

**Auto-boxing (primitive wrapper objects):**

When you access properties or methods on a primitive, JavaScript:
1. Creates a temporary wrapper object (`String`, `Number`, `Boolean`)
2. Accesses the property/method on that object
3. **Immediately discards** the wrapper

**What happens with `str.customProp = "test"`:**

```javascript
// Internally:
new String("hello").customProp = "test";  // Created
// Wrapper is immediately garbage collected
```

When you access `str.customProp`:
```javascript
new String("hello").customProp  // NEW wrapper, no property
// Returns undefined
```

Each access creates a **new wrapper**, so properties don't persist.

**Wrapper objects vs primitives:**

```javascript
let primitive = "hello";      // Primitive string
let object = new String("hello");  // String object

typeof primitive  // "string"
typeof object     // "object"

primitive === object  // false (different types!)
primitive == object   // true (coercion)
```

**Best practice**: NEVER use wrapper constructors (`new String`, `new Number`, `new Boolean`)
- Use them as conversion functions WITHOUT `new`: `String(42)`, `Number("42")`

</details>

---

## Question 10: Common Mutation Pitfall

**Why does the original array change? How would you fix it?**

```javascript
function sortNumbers(numbers) {
  numbers.sort((a, b) => a - b);
  return numbers;
}

let myNumbers = [3, 1, 4, 1, 5];
let sorted = sortNumbers(myNumbers);

console.log(myNumbers);
console.log(sorted);
console.log(myNumbers === sorted);
```

<details>
<summary>Answer</summary>

**Output:**
```
[1, 1, 3, 4, 5]
[1, 1, 3, 4, 5]
true
```

**Problem:**

`Array.prototype.sort()` **mutates** the original array and returns a reference to the same array.

**Why it happens:**
1. `numbers` parameter receives a reference to `myNumbers`
2. `numbers.sort()` modifies the array in place
3. Both `myNumbers` and `sorted` point to the same (now sorted) array

**Solutions:**

**Option 1: Sort a copy**
```javascript
function sortNumbers(numbers) {
  return [...numbers].sort((a, b) => a - b);
  // or: numbers.slice().sort((a, b) => a - b)
}
```

**Option 2: Make intent clear**
```javascript
function sortNumbers(numbers) {
  numbers.sort((a, b) => a - b);  // Mutates
  return numbers;  // Document that this mutates
}

// Caller creates copy if needed
let sorted = sortNumbers([...myNumbers]);
```

**Other mutating array methods:**
- `push`, `pop`, `shift`, `unshift`
- `splice`, `reverse`, `sort`
- `fill`, `copyWithin`

**Non-mutating alternatives:**
- `concat` instead of `push`
- `slice` instead of `splice`
- `toSorted` (ES2023) instead of `sort`

</details>

---

## Bonus Question: Memory and Performance

**Which approach is more memory efficient and why?**

```javascript
// Approach A
function processData(items) {
  let result = [];
  for (let item of items) {
    result.push(transform(item));
  }
  return result;
}

// Approach B
function processData(items) {
  return items.map(transform);
}
```

<details>
<summary>Answer</summary>

**Both approaches are similar in memory efficiency**, but there are nuances:

**Memory perspective:**

1. Both create a **new array** for the result
2. Both create **new references** to transformed items (assuming `transform` returns objects)
3. Neither mutates the original `items` array

**Performance differences:**

**Approach A (imperative loop):**
- Slightly more control over memory allocation
- Can `break` early if needed
- More verbose

**Approach B (functional):**
- More concise and readable
- Creates an intermediate function context for each iteration
- Cannot short-circuit

**Real memory concern - chaining methods:**

```javascript
// Creates intermediate arrays
data
  .map(x => x * 2)      // New array
  .filter(x => x > 10)  // Another new array
  .sort((a, b) => a - b);  // Mutates the filtered array

// More efficient: single pass
data.reduce((acc, x) => {
  let doubled = x * 2;
  if (doubled > 10) acc.push(doubled);
  return acc;
}, []).sort((a, b) => a - b);
```

**Best practice:**
- For readability: use `map`, `filter`, etc.
- For performance-critical code with large datasets: use single-pass loops
- Modern engines optimize functional methods well

**When it really matters:**
- Very large arrays (millions of items)
- Memory-constrained environments
- Hot code paths

</details>

