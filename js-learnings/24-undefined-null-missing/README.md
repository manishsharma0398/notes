# Chapter 24: Undefined, Null, and Missing Properties

## undefined

**Primitives value** meaning "no value assigned".

**Created by:**

```javascript
let x;  // undefined
function test() {}  // Returns undefined
const obj = {};
obj.missing;  // undefined
```

**typeof:**

```javascript
typeof undefined;  // "undefined"
typeof undeclaredVariable;  // "undefined" (doesn't throw!)
```

## null

**Primitive value** meaning "intentional absence of value".

```javascript
let x = null;  // Explicitly no value

typeof null;  // "object" (historical bug!)
```

## undefined vs null

| Feature | undefined | null |
|---------|-----------|------|
| Meaning | Not assigned | Intentionally empty |
| Type | "undefined" | "object" (bug) |
| Default | Yes | No |
| Equality | `== null` | `== undefined` |

```javascript
undefined == null;  // true
undefined === null;  // false
```

## Missing Properties

```javascript
const obj = { a: 1 };
obj.b;  // undefined

obj.hasOwnProperty('b');  // false
'b' in obj;  // false
```

## Checking for Existence

```javascript
// Bad: checks falsiness
if (value) { }  // Also false for 0, "", false

// Better: explicit
if (value !== undefined) { }
if (value !== null) { }

// Check both:
if (value != null) { }  // Checks both undefined and null

// Check property exists
if ('prop' in obj) { }
if (obj.hasOwnProperty('prop')) { }
```

## Optional Chaining

```javascript
const user = { address: { city: "NYC" } };

// Old
const zip = user && user.address && user.address.zip;

// New
const zip = user?.address?.zip;  // undefined if any is null/undefined
```

## Nullish Coalescing

```javascript
// || returns first truthy (treats 0, "" as falsy)
const value = x || "default";

// ?? returns first non-nullish (only null/undefined)
const value = x ?? "default";
```

**Difference:**

```javascript
const x = 0;
x || 10;   // 10 (0 is falsy)
x ?? 10;   // 0 (0 is not nullish)
```

## void Operator

```javascript
void expression;  // Always returns undefined

void 0;  // undefined (common idiom)
```

## Key Concepts

1. **undefined:** Not assigned
2. **null:** Intentionally empty
3. **typeof null:** "object" (bug)
4. **==:** undefined == null
5. **Optional chaining:** `obj?.prop`
6. **Nullish coalescing:** `??`

## One-Sentence Summary

JavaScript distinguishes between undefined (unassigned value) and null (intentional emptiness) though they coerce equal with ==, with modern syntax like optional chaining (?.) and nullish coalescing (??) providing safer ways to handle potentially missing values than traditional boolean coercion.
