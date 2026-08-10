# Chapter 7 — Interview Questions: Primitives vs References

## Q1: "Is JavaScript pass by value or pass by reference?"

**The trap:** Most candidates say "pass by reference for objects."

**Correct answer:** JavaScript is **always pass by value**. For primitive types, the value itself is copied. For reference types, the **pointer** (memory address) is copied by value. The object in the heap is not copied — it is shared. This means:
- Mutating the object through the parameter IS visible to the caller (same heap object)
- Reassigning the parameter is NOT visible to the caller (changes only the local copy of the pointer)

```javascript
function mutate(obj) {
  obj.x = 99;    // mutates shared heap object → caller sees this
  obj = {};      // reassigns local binding → caller does NOT see this
}

const o = { x: 1 };
mutate(o);
console.log(o.x); // 99 — mutation visible
console.log(o);   // { x: 99 } — NOT {} — reassignment not visible
```

---

## Q2: Why does this code produce surprising output?

```javascript
const a = [1, 2, 3];
const b = a;
b.push(4);
console.log(a); // ?
```

**Answer:** `[1, 2, 3, 4]`

`b = a` copies the pointer, not the array. Both `a` and `b` point to the same heap array. `b.push(4)` mutates that shared array. `a` and `b` are aliases for the same object.

**Follow-up:** How would you make `b` independent?
```javascript
const b = [...a]; // shallow copy — b gets its own array
```

---

## Q3: Why does JavaScript behave this way? Why not copy objects on assignment?

**Answer:**
Copying objects on every assignment would be prohibitively expensive for large objects (imagine a 10,000-entry array being copied every time you pass it to a function). The pointer model gives you:
1. **Efficiency** — constant-time assignment regardless of object size
2. **Intentional sharing** — multiple references to the same object is useful (think: Redux store, shared config)
3. **Predictable mutation** — callers and callees can coordinate on shared state

If you want a copy, you explicitly ask for one (spread, `Object.assign`, `structuredClone`). This is explicit over implicit.

---

## Q4: What's wrong with this equality check?

```javascript
function isEqual(a, b) {
  return a === b;
}

console.log(isEqual([1, 2], [1, 2])); // true or false?
```

**Answer:** `false`

`===` on objects compares pointers (identity), not content. `[1, 2]` and `[1, 2]` are two different arrays allocated at two different heap addresses.

**How to compare arrays by content:**
```javascript
JSON.stringify([1, 2]) === JSON.stringify([1, 2]) // "quick and dirty"
// Or: iterate and compare element by element
```

---

## Q5: Does `const` make an object immutable?

**Answer:** No. `const` prevents **rebinding** — you cannot make the variable point to a different object. But you can still mutate the heap object the variable points to.

```javascript
const config = { timeout: 3000 };
config.timeout = 5000;   // ✅ mutation of the heap object — allowed
config = { timeout: 9000 }; // ❌ TypeError — rebinding not allowed
```

To make an object truly immutable: `Object.freeze(config)`. But freeze is shallow — nested objects are not frozen.

---

## Q6: Trap question — predict the output

```javascript
function update(obj, arr) {
  obj.value = 42;
  arr = [99, 100];
  obj = { value: 999 };
}

const myObj = { value: 1 };
const myArr = [1, 2, 3];

update(myObj, myArr);

console.log(myObj.value); // ?
console.log(myArr);       // ?
```

**Answer:** `42` and `[1, 2, 3]`

- `obj.value = 42` → mutates the shared heap object → `myObj.value` becomes 42
- `arr = [99, 100]` → reassigns the local `arr` binding → `myArr` is unaffected
- `obj = { value: 999 }` → reassigns the local `obj` binding → `myObj` is unaffected

---

## Q7: Why is `typeof null === "object"` instead of `"null"`?

**Answer:**
This is a bug from JavaScript 1.0 (1995). In the original C implementation of the interpreter, values were stored with a low-bit type tag. The `null` value was represented as the C null pointer `0x00`, which happened to share the `0` type tag with objects. The `typeof` check returned "object" because of this tag. The bug was reported early but was never fixed to avoid breaking existing code.

The ECMAScript specification explicitly notes this as a historical artifact. `null` is a primitive value. The correct check for null is:
```javascript
value === null    // not: typeof value === "object"
```

---

## Q8: What does this do, and why?

```javascript
let str = "hello";
str.newProp = "world";
console.log(str.newProp); // ?
```

**Answer:** `undefined`

Strings are primitives — immutable. When you access a property on a primitive, JavaScript temporarily wraps it in a `String` object (the autoboxing mechanism). You set the property on that temporary wrapper. The wrapper is immediately discarded — it's never stored. When you access `str.newProp` again, a new temporary wrapper is created with no `newProp`. Result: `undefined`.

In strict mode, `str.newProp = "world"` throws a `TypeError` because you're trying to set a property on a primitive.

---

## Q9: Shallow copy trap

```javascript
const original = { a: 1, b: { c: 2 } };
const copy = { ...original };

copy.a = 99;
copy.b.c = 99;

console.log(original.a); // ?
console.log(original.b.c); // ?
```

**Answer:** `1` and `99`

Spread creates a **shallow copy**. Top-level primitive values (`a: 1`) are copied by value — independent. But `b` is a reference type — the pointer to `{ c: 2 }` is copied. Both `original.b` and `copy.b` point to the same nested object. Mutating through `copy.b.c` is visible through `original.b.c`.
