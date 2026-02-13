# Chapter 13 Revision Notes: Prototype Chain

## What is the Prototype Chain?

**Linked list of objects** used for inheritance and property lookup.

Every object has `[[Prototype]]` → points to another object (or `null`).

---

## `[[Prototype]]` vs `.prototype`

| Feature | `[[Prototype]]` | `.prototype` |
|---------|----------------|--------------|
| **On** | All objects | Only functions |
| **Type** | Internal link | Regular property |
| **Purpose** | What I inherit from | What my instances will inherit from |
| **Access** | `Object.getPrototypeOf(obj)` | `fn.prototype` |

**Mnemonic:**
- `[[Prototype]]`: "What do **I** inherit from?"
- `.prototype`: "What will **my instances** inherit from?"

---

## Property Lookup

**Process:**
1. Check object itself
2. Check `[[Prototype]]`
3. Check `[[Prototype]]` of that
4. Continue until `null`
5. Return `undefined` if not found

```javascript
obj.property
// Walks: obj → obj.[[Prototype]] → ... → null
```

---

## Creating Prototype Chains

### Object Literal
```javascript
const obj = {};
// obj.[[Prototype]] = Object.prototype
```

### Constructor Function
```javascript
function Person() {}
const alice = new Person();
// alice.[[Prototype]] = Person.prototype
```

### Object.create()
```javascript
const child = Object.create(parent);
// child.[[Prototype]] = parent
```

---

## What `new` Does

1. Create empty object: `{}`
2. Set `[[Prototype]]`: `obj.[[Prototype]] = Constructor.prototype`
3. Call constructor: `Constructor.call(obj)`
4. Return object

---

## Shadowing

**Assignment creates/updates own property**, doesn't modify prototype.

```javascript
Person.prototype.age = 25;
const alice = new Person();
alice.age = 30;  // Creates own property (shadows)
delete alice.age;  // Reveals prototype property
```

---

## Inheritance Pattern

```javascript
function Parent() {}
function Child() {}

// Set up chain
Child.prototype = Object.create(Parent.prototype);
Child.prototype.constructor = Child;
```

**Steps:**
1. `Object.create(Parent.prototype)` - creates chain
2. Restore `constructor` reference
3. Add child methods **after** setting prototype

---

## Common Operations

### Check own vs inherited
```javascript
obj.hasOwnProperty('prop');  // true = own, false = inherited/absent
```

### Get prototype
```javascript
Object.getPrototypeOf(obj);  // ✅ Recommended
obj.__proto__;               // ⚠️ Deprecated
```

### Check if in chain
```javascript
Parent.prototype.isPrototypeOf(child);
child instanceof Parent;
```

---

## Best Practices

**Methods on prototype, data on instance:**

```javascript
function Counter() {
  this.count = 0;  // Data: own property
}

Counter.prototype.increment = function() {  // Method: prototype
  this.count++;
};
```

**Why:**
- Memory efficient (shared method)
- Inheritance works automatically

---

## Common Traps

### ❌ Forgot `new`
```javascript
const obj = Constructor();  // this = global/undefined
```

### ❌ Replacing prototype
```javascript
Constructor.prototype = {};  // Breaks existing instances
```

### ❌ Modifying Object.prototype
```javascript
Object.prototype.method = ...;  // Pollutes ALL objects
```

### ❌ Performance
```javascript
Object.setPrototypeOf(obj, proto);  // SLOW! Set at creation
```

---

## Edge Cases

### End of chain
```javascript
Object.getPrototypeOf(Object.prototype);  // null
```

### Null prototype
```javascript
const obj = Object.create(null);  // No inherited properties
```

### for...in includes inherited
```javascript
for (let key in obj) {
  if (obj.hasOwnProperty(key)) {  // Check for own
    // ...
  }
}
```

---

## One-Sentence Summary

**The prototype chain is JavaScript's inheritance mechanism where each object has an internal `[[Prototype]]` link forming a linked list that property lookup traverses, with constructors having a `.prototype` property that becomes the `[[Prototype]]` of instances created with `new`.**

---

## Next: Chapter 14

**`new`, Constructors, and Class Syntax Internals:** What `new` really does, constructor patterns, and how ES6 classes work.
