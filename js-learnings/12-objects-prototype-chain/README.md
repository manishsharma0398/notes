# Chapter 11: Objects and Property Access

## Mental Model

In JavaScript, **objects are not just key-value stores**. Every property has hidden **attributes** (metadata) that control its behavior. Understanding property access mechanisms is crucial for advanced JavaScript.

```
PROPERTY = VALUE + ATTRIBUTES

Data Property:
  value, writable, enumerable, configurable

Accessor Property:
  get, set, enumerable, configurable
```

**Key insight**: When you access `obj.prop`, JavaScript doesn't just "look up" the value. It runs an internal **[[Get]]** algorithm that checks attributes, prototypes, and more.

## What Developers Think vs Reality

### Common Misconception

"Property access is simple: just get the value from the object."

### Reality

**Property access involves multiple internal algorithms:**
- [[Get]] for reading
- [[Set]] for writing  
- Property descriptor checks
- Prototype chain traversal
- Getters/setters execution

```javascript
obj.x = 5;  // Not just "store 5"!

// Actually:
// 1. Run [[Set]] algorithm
// 2. Check if 'x' exists and is writable
// 3. Check prototype chain for setters
// 4. Check if object is extensible
// 5. Create/update property with correct attributes
```

## Property Descriptors

Every property has a **descriptor** - an object describing its **attributes**.

### Two Types of Properties

**1. Data Property** (stores a value):
```javascript
{
  value: <any value>,
  writable: true/false,      // Can value be changed?
  enumerable: true/false,    // Shows in for...in?
  configurable: true/false   // Can descriptor be changed?
}
```

**2. Accessor Property** (runs functions):
```javascript
{
  get: function() { ... },
  set: function(val) { ... },
  enumerable: true/false,
  configurable: true/false
}
```

**Cannot mix**: A property is EITHER data OR accessor, never both.

### Getting Descriptors

```javascript
const obj = { x: 42 };

Object.getOwnPropertyDescriptor(obj, 'x');
// {
//   value: 42,
//   writable: true,
//   enumerable: true,
//   configurable: true
// }
```

### Default Attributes

**Created via literal or dot notation:**
```javascript
const obj = { x: 1 };
obj.y = 2;

// Both have: writable, enumerable, configurable = true
```

**Created via Object.defineProperty:**
```javascript
Object.defineProperty(obj, 'z', { value: 3 });

// Defaults: writable, enumerable, configurable = FALSE
```

## [[Get]] Algorithm

When you read `obj.prop`, JavaScript runs:

```
[[Get]](obj, "prop"):
  1. If obj has own property "prop":
       If data property → return value
       If accessor property → call getter, return result
  2. Else, get prototype = [[GetPrototypeOf]](obj)
  3. If prototype is null → return undefined
  4. Return [[Get]](prototype, "prop")  // Recursive!
```

### Examples

```javascript
const obj = {
    x: 10,
    get y() { return this.x * 2; }
};

// obj.x
// → [[Get]]: data property, return 10

// obj.y
// → [[Get]]: accessor property, call getter, return 20

// obj.z
// → [[Get]]: no own property
// → Check prototype chain
// → Not found → return undefined
```

## [[Set]] Algorithm

When you write `obj.prop = value`, JavaScript runs:

```
[[Set]](obj, "prop", value):
  1. If obj has own data property "prop":
       If NOT writable → fail (strict: TypeError)
       Set value, return
  2. If obj has own accessor property "prop":
       Call setter with value, return
  3. Check prototype chain for "prop"
  4. If found in prototype and it's:
       - Data property NOT writable → fail
       - Accessor property → call setter
  5. If not found anywhere:
       If obj is NOT extensible → fail
       Create new own property on obj
```

### Key Points

**Shadowing:**
```javascript
const proto = { x: 1 };
const obj = Object.create(proto);

obj.x = 2;  // Creates own property (shadows prototype)
console.log(obj.x);    // 2
console.log(proto.x);  // 1 (unchanged)
```

**Non-writable in prototype:**
```javascript
const proto = {};
Object.defineProperty(proto, 'x', {
    value: 1,
    writable: false
});

const obj = Object.create(proto);
obj.x = 2;  // Fails silently (strict: TypeError)
console.log(obj.x);  // 1 (no own property created!)
```

## Object.defineProperty

Precise control over property creation/modification.

### Syntax

```javascript
Object.defineProperty(obj, 'propName', descriptor);
```

### Creating Data Property

```javascript
const obj = {};

Object.defineProperty(obj, 'x', {
    value: 42,
    writable: true,
    enumerable: true,
    configurable: true
});
```

**Defaults if omitted**: `false` for writable/enumerable/configurable!

### Creating Accessor Property

```javascript
let internal = 0;

Object.defineProperty(obj, 'count', {
    get() { return internal; },
    set(val) { internal = val; },
    enumerable: true,
    configurable: true
});

obj.count = 5;
console.log(obj.count);  // 5
```

### Modifying Properties

```javascript
const obj = { x: 1 };

// Make read-only
Object.defineProperty(obj, 'x', {
    writable: false
});

obj.x = 2;  // Fails (strict: TypeError)
console.log(obj.x);  // 1
```

**Cannot change if `configurable: false`:**
```javascript
Object.defineProperty(obj, 'y', {
    value: 10,
    configurable: false
});

// This fails:
Object.defineProperty(obj, 'y', {
    writable: true  // TypeError!
});
```

## Property Attributes

### writable

Controls whether value can be reassigned.

```javascript
const obj = {};
Object.defineProperty(obj, 'x', {
    value: 42,
    writable: false
});

obj.x = 100;  // Ignored (strict: TypeError)
console.log(obj.x);  // 42

// But object properties can still mutate!
Object.defineProperty(obj, 'arr', {
    value: [1, 2, 3],
    writable: false
});

obj.arr.push(4);  // Works! (mutating value)
obj.arr = [];     // Fails! (reassigning)
```

### enumerable

Controls visibility in enumeration.

```javascript
const obj = {
    a: 1,
    b: 2
};

Object.defineProperty(obj, 'c', {
    value: 3,
    enumerable: false
});

// for...in
for (let key in obj) {
    console.log(key);  // "a", "b" (NOT "c")
}

// Object.keys
Object.keys(obj);  // ["a", "b"]

// But still accessible!
console.log(obj.c);  // 3

// And Object.getOwnPropertyNames sees it
Object.getOwnPropertyNames(obj);  // ["a", "b", "c"]
```

### configurable

Controls whether descriptor can be changed or property deleted.

```javascript
const obj = {};

Object.defineProperty(obj, 'x', {
    value: 42,
    configurable: false
});

// Cannot delete
delete obj.x;  // Ignored (strict: TypeError)
console.log(obj.x);  // 42

// Cannot reconfigure
Object.defineProperty(obj, 'x', {
    enumerable: true  // TypeError!
});

// Exception: writable can go from true → false
Object.defineProperty(obj, 'y', {
    value: 10,
    writable: true,
    configurable: false
});

Object.defineProperty(obj, 'y', {
    writable: false  // Allowed!
});

// But NOT false → true
Object.defineProperty(obj, 'y', {
    writable: true  // TypeError!
});
```

## Getters and Setters

Accessor properties run functions instead of storing values.

### Syntax

**Object literal:**
```javascript
const obj = {
    _internal: 0,
    
    get value() {
        console.log('Getting value');
        return this._internal;
    },
    
    set value(val) {
        console.log('Setting value to', val);
        this._internal = val;
    }
};

obj.value = 42;  // "Setting value to 42"
console.log(obj.value);  // "Getting value", then 42
```

**defineProperty:**
```javascript
let internal = 0;

Object.defineProperty(obj, 'count', {
    get() { return internal; },
    set(val) {
        if (typeof val !== 'number') {
            throw new TypeError('Must be number');
        }
        internal = val;
    }
});
```

### Practical Uses

**Validation:**
```javascript
const user = {
    _age: 0,
    
    set age(val) {
        if (val < 0 || val > 150) {
            throw new RangeError('Invalid age');
        }
        this._age = val;
    },
    
    get age() {
        return this._age;
    }
};

user.age = 25;  // OK
user.age = 200;  // RangeError
```

**Computed properties:**
```javascript
const rectangle = {
    width: 10,
    height: 5,
    
    get area() {
        return this.width * this.height;
    }
};

console.log(rectangle.area);  // 50
rectangle.width = 20;
console.log(rectangle.area);  // 100
```

**Lazy initialization:**
```javascript
const obj = {
    get expensiveValue() {
        if (!this._cached) {
            console.log('Computing...');
            this._cached = /* expensive operation */ 42;
        }
        return this._cached;
    }
};

obj.expensiveValue;  // "Computing...", 42
obj.expensiveValue;  // 42 (cached)
```

## Property Enumeration

Different ways to list properties have different behavior.

### for...in

Enumerates **enumerable** properties including **prototype chain**.

```javascript
const proto = { a: 1 };
const obj = Object.create(proto);
obj.b = 2;

Object.defineProperty(obj, 'c', {
    value: 3,
    enumerable: false
});

for (let key in obj) {
    console.log(key);  // "b", "a" (includes prototype!)
}

// Filter to own properties:
for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
        console.log(key);  // "b" only
    }
}
```

### Object.keys()

Returns **own enumerable** properties (no prototype).

```javascript
Object.keys(obj);  // ["b"]
```

### Object.getOwnPropertyNames()

Returns **all own** properties (including non-enumerable).

```javascript
Object.getOwnPropertyNames(obj);  // ["b", "c"]
```

### Object.getOwnPropertySymbols()

Returns own **symbol** properties.

```javascript
const sym = Symbol('secret');
obj[sym] = 'value';

Object.getOwnPropertySymbols(obj);  // [Symbol(secret)]
```

### Reflect.ownKeys()

Returns **all own keys** (strings + symbols, including non-enumerable).

```javascript
Reflect.ownKeys(obj);  // ["b", "c", Symbol(secret)]
```

### Comparison Table

| Method | Own | Prototype | Enumerable Only | Symbols |
|--------|-----|-----------|----------------|---------|
| `for...in` | ✓ | ✓ | ✓ | ✗ |
| `Object.keys()` | ✓ | ✗ | ✓ | ✗ |
| `Object.getOwnPropertyNames()` | ✓ | ✗ | ✗ | ✗ |
| `Object.getOwnPropertySymbols()` | ✓ | ✗ | ✗ | ✓ |
| `Reflect.ownKeys()` | ✓ | ✗ | ✗ | ✓ |

## Object.freeze, Object.seal, Object.preventExtensions

Control object mutability.

### Object.preventExtensions()

**Cannot add new properties.** Can still modify/delete existing.

```javascript
const obj = { x: 1 };
Object.preventExtensions(obj);

obj.y = 2;  // Ignored (strict: TypeError)
obj.x = 10;  // OK (modifying existing)
delete obj.x;  // OK (deleting)

Object.isExtensible(obj);  // false
```

### Object.seal()

**Cannot add/delete properties.** Can still modify existing values.

```javascript
const obj = { x: 1 };
Object .seal(obj);

obj.y = 2;  // Ignored (no new properties)
delete obj.x;  // Ignored (no delete)
obj.x = 10;  // OK (modifying)

Object.isSealed(obj);  // true

// Sealed = preventExtensions + configurable: false
```

### Object.freeze()

**Cannot add/delete/modify.** Completely immutable (shallow).

```javascript
const obj = { x: 1, nested: { y: 2 } };
Object.freeze(obj);

obj.x = 10;  // Ignored
obj.y = 2;  // Ignored
delete obj.x;  // Ignored

Object.isFrozen(obj);  // true

// But nested objects NOT frozen!
obj.nested.y = 999;  // Works!
console.log(obj.nested.y);  // 999
```

**Deep freeze:**
```javascript
function deepFreeze(obj) {
    Object.freeze(obj);
    
    Object.getOwnPropertyNames(obj).forEach(prop => {
        if (obj[prop] !== null && typeof obj[prop] === 'object') {
            deepFreeze(obj[prop]);
        }
    });
    
    return obj;
}
```

### Comparison

| Method | Add Props | Delete Props | Modify Values |
|--------|-----------|--------------|---------------|
| `preventExtensions` | ✗ | ✓ | ✓ |
| `seal` | ✗ | ✗ | ✓ |
| `freeze` | ✗ | ✗ | ✗ |

## hasOwnProperty vs in Operator

### hasOwnProperty()

Checks for **own** properties only (not prototype).

```javascript
const proto = { a: 1 };
const obj = Object.create(proto);
obj.b = 2;

obj.hasOwnProperty('b');  // true (own)
obj.hasOwnProperty('a');  // false (inherited)
```

**Safe version** (object might not have hasOwnProperty):
```javascript
Object.prototype.hasOwnProperty.call(obj, 'prop');
// Or modern:
Object.hasOwn(obj, 'prop');  // ES2022
```

### in Operator

Checks **own + prototype** chain.

```javascript
'b' in obj;  // true (own)
'a' in obj;  // true (inherited)
'toString' in obj;  // true (from Object.prototype)
```

### Checking for undefined

```javascript
const obj = { x: undefined };

obj.x;  // undefined (exists!)
obj.y;  // undefined (doesn't exist)

// Distinguish:
obj.hasOwnProperty('x');  // true
obj.hasOwnProperty('y');  // false

'x' in obj;  // true
'y' in obj;  // false
```

## Object.create()

Create object with specific prototype.

### Syntax

```javascript
const proto = { x: 1 };
const obj = Object.create(proto);

obj.__proto__ === proto;  // true
Object.getPrototypeOf(obj) === proto;  // true

console.log(obj.x);  // 1 (from prototype)
```

### With Property Descriptors

```javascript
const obj = Object.create(proto, {
    y: {
        value: 2,
        writable: true,
        enumerable: true,
        configurable: true
    }
});

// obj has own property 'y' and inherits 'x' from proto
```

### Creating Object with No Prototype

```javascript
const obj = Object.create(null);

obj.toString;  // undefined (no Object.prototype!)
obj.hasOwnProperty;  // undefined

// Useful for pure dictionaries
const dict = Object.create(null);
dict['toString'] = 'safe';  // No conflict with Object.prototype
```

## Common Patterns

### Private Properties (Convention)

```javascript
const obj = {
    _private: 'internal',  // Convention: underscore = private
    
    get value() {
        return this._private;
    }
};

// Not enforced, just convention
```

### Object as HashMap

```javascript
const map = Object.create(null);  // No prototype

map['key1'] = 'value1';
map['key2'] = 'value2';

// Safe from prototype pollution
```

### Property Cloning

```javascript
function cloneDescriptors(source, target) {
    Object.getOwnPropertyNames(source).forEach(key => {
        const desc = Object.getOwnPropertyDescriptor(source, key);
        Object.defineProperty(target, key, desc);
    });
}
```

## Interview Insight

**When asked about property access:**

> "Property access in JavaScript uses internal [[Get]] and [[Set]] algorithms. [[Get]] checks own properties first, then walks the prototype chain. Each property has a descriptor with attributes: for data properties (value, writable, enumerable, configurable), for accessors (get, set, enumerable, configurable).
>
> Object.defineProperty allows precise control. Properties created via literals/dot notation are writable/enumerable/configurable by default, but defineProperty defaults to false.
>
> Enumeration methods differ: for...in includes prototype, Object.keys only own enumerable, Object.getOwnPropertyNames all own properties including non-enumerable.
>
> Object.freeze/seal/preventExtensions control mutability, but freeze is shallow—nested objects remain mutable."

## Key Takeaways

1. **Property access uses [[Get]]/[[Set]] algorithms**, not simple lookups
2. **Every property has attributes** controlling its behavior
3. **Two property types**: data (value) and accessor (get/set)
4. **Object.defineProperty** for precise control (defaults: false!)
5. **writable** controls reassignment (not mutation)
6. **enumerable** controls for...in and Object.keys visibility
7. **configurable** controls deletion and reconfiguration
8. **Getters/setters** run functions, not store values
9. **Enumeration methods differ**: for...in (prototype), Object.keys (own enumerable), Reflect.ownKeys (all)
10. **Object.freeze is shallow**—nested objects not frozen
11. **hasOwnProperty** checks own properties, **in** checks prototype chain
12. **Object.create(null)** creates object with no prototype
