# Chapter 11: Objects and Property Access - Interview Questions

## Question 1: Explain the [[Get]] and [[Set]] internal algorithms in JavaScript. How do they differ from simple property lookup?

**Answer:**

[[Get]] and [[Set]] are internal algorithms that JavaScript runs on property access, not simple key-value lookups.

**[[Get]] Algorithm:**
1. Check if the object has an own property with that name
   - If data property: return the value
   - If accessor property: call the getter function and return result
2. If not found, get the object's [[Prototype]]
3. If prototype is null, return undefined
4. Recursively run [[Get]] on the prototype

**[[Set]] Algorithm:**
1. If own data property exists:
   - If writable is false: fail (TypeError in strict mode)
   - Otherwise: update the value
2. If own accessor property exists:
   - Call the setter function
3. Check prototype chain:
   - If data property found and writable is false: fail
   - If accessor property found: call that setter
4. If not found anywhere:
   - If object is not extensible: fail
   - Create new own property on the object

**Key Differences from Simple Lookup:**
- Getters/setters execute functions, not return stored values
- Non-writable properties in prototype prevent shadowing
- Property attributes (writable, configurable) affect behavior
- Prototype chain is traversed with specific rules
- Strict mode throws errors vs silent failures

**Example:**
```javascript
const proto = {};
Object.defineProperty(proto, 'x', {
    value: 1,
    writable: false
});

const obj = Object.create(proto);
obj.x = 2;  // Fails! Can't shadow non-writable property
console.log(obj.x);  // 1
console.log(obj.hasOwnProperty('x'));  // false
```

---

## Question 2: What are property descriptors? Explain the difference between data and accessor properties, and why the default attributes differ between object literals and Object.defineProperty.

**Answer:**

**Property Descriptors** are objects that describe the metadata (attributes) of a property.

**Two Types:**

1. **Data Property** (stores a value):
   ```javascript
   {
       value: <any value>,
       writable: true/false,
       enumerable: true/false,
       configurable: true/false
   }
   ```

2. **Accessor Property** (runs functions):
   ```javascript
   {
       get: function() { ... },
       set: function(val) { ... },
       enumerable: true/false,
       configurable: true/false
   }
   ```

**Cannot be both!** A property is either data OR accessor.

**Default Attributes Difference:**

**Object literal / dot notation:**
```javascript
const obj = { x: 1 };  // OR obj.x = 1;
// Defaults: { value: 1, writable: true, enumerable: true, configurable: true }
```

**Object.defineProperty:**
```javascript
Object.defineProperty(obj, 'y', { value: 2 });
// Defaults: { value: 2, writable: FALSE, enumerable: FALSE, configurable: FALSE }
```

**Why the difference?**
- **Convenience vs Control**: Literals are for convenient property creation with full mutability
- **defineProperty** is for precise control, so it defaults to most restrictive (secure by default)
- Historical design: defineProperty was added later for fine-grained control

**Practical Impact:**
```javascript
const obj = {};

// Literal style
obj.a = 1;
delete obj.a;  // Works
obj.a = 2;     // Works

// defineProperty style
Object.defineProperty(obj, 'b', { value: 1 });
delete obj.b;  // Fails (configurable: false)
obj.b = 2;     // Fails (writable: false)
```

---

## Question 3: Explain the three property attributes: writable, enumerable, and configurable. What are their implications and edge cases?

**Answer:**

### writable

Controls whether the property's **value** can be reassigned.

```javascript
Object.defineProperty(obj, 'x', {
    value: [1, 2, 3],
    writable: false
});

obj.x = [4, 5, 6];  // Fails (strict: TypeError)
obj.x.push(4);      // WORKS! (mutating, not reassigning)
```

**Edge case**: writable only prevents reassignment, not mutation.

### enumerable

Controls whether property shows up in enumeration.

```javascript
const obj = { a: 1 };
Object.defineProperty(obj, 'b', {
    value: 2,
    enumerable: false
});

for (let key in obj) { }  // Only 'a'
Object.keys(obj);         // ['a']
JSON.stringify(obj);      // {"a":1} (b excluded!)
obj.b;                    // 2 (still accessible)
Object.getOwnPropertyNames(obj);  // ['a', 'b'] (sees all)
```

**Use case**: Hide metadata/internal properties.

### configurable

Controls whether the property can be deleted or its descriptor changed.

```javascript
Object.defineProperty(obj, 'x', {
    value: 1,
    configurable: false
});

delete obj.x;  // Fails
Object.defineProperty(obj, 'x', {
    enumerable: true  // TypeError! Cannot reconfigure
});
```

**Special Exception**: Can change writable from true to false (but not back):
```javascript
Object.defineProperty(obj, 'y', {
    value: 1,
    writable: true,
    configurable: false
});

Object.defineProperty(obj, 'y', {
    writable: false  // Allowed! One-way  transition
});

Object.defineProperty(obj, 'y', {
    writable: true  // TypeError! Cannot go back
});
```

**Why?** Allows permanent read-only without full freeze.

---

## Question 4: What's the difference between Object.freeze(), Object.seal(), and Object.preventExtensions()? Why is Object.freeze() considered "shallow"?

**Answer:**

**Three Levels of Immutability:**

### Object.preventExtensions()
- Cannot add new properties
- Can modify existing properties
- Can delete existing properties

```javascript
const obj = { x: 1 };
Object.preventExtensions(obj);
obj.y = 2;     // Fails
obj.x = 10;    // Works
delete obj.x;  // Works
```

### Object.seal()
- Cannot add new properties
- Cannot delete properties
- Can modify existing values
- Sets configurable: false on all properties

```javascript
const obj = { x: 1 };
Object.seal(obj);
obj.y = 2;     // Fails
delete obj.x;  // Fails
obj.x = 10;    // Works
```

### Object.freeze()
- Cannot add new properties
- Cannot delete properties
- Cannot modify existing values
- Sets configurable: false and writable: false

```javascript
const obj = { x: 1 };
Object.freeze(obj);
obj.y = 2;     // Fails
delete obj.x;  // Fails
obj.x = 10;    // Fails
```

**Hierarchy:**
```
frozen → sealed → preventExtensions
```

### Why "Shallow"?

**Nested objects are NOT frozen:**
```javascript
const obj = {
    x: 1,
    nested: { y: 2 }
};

Object.freeze(obj);

obj.x = 10;          // Fails
obj.nested = {};     // Fails
obj.nested.y = 999;  // WORKS! (nested not frozen)
```

**Deep Freeze Solution:**
```javascript
function deepFreeze(obj) {
    Object.freeze(obj);
    
    Object.getOwnPropertyNames(obj).forEach(prop => {
        if (obj[prop] != null && typeof obj[prop] === 'object') {
            deepFreeze(obj[prop]);
        }
    });
    
    return obj;
}
```

---

## Question 5: How does property enumeration work? Contrast for...in, Object.keys(), Object.getOwnPropertyNames(), and Reflect.ownKeys().

**Answer:**

**Different methods enumerate different subsets of properties:**

### for...in
- Own + **prototype** properties
- **Enumerable** only
- String keys (no symbols)

```javascript
for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
        // Filter to own properties
    }
}
```

### Object.keys()
- **Own** properties only
- **Enumerable** only
- String keys (no symbols)

```javascript
Object.keys(obj);  // ['a', 'b']
```

### Object.getOwnPropertyNames()
- **Own** properties only
- **All** (including non-enumerable)
- String keys (no symbols)

```javascript
Object.getOwnPropertyNames(obj);  // ['a', 'b', 'hidden']
```

### Reflect.ownKeys()
- **Own** properties only
- **All** (including non-enumerable)
- **String + symbol** keys

```javascript
Reflect.ownKeys(obj);  // ['a', 'b', 'hidden', Symbol(sym)]
```

**Comparison Table:**

| Method | Own | Prototype | Enum Only | Symbols |
|--------|-----|-----------|-----------|---------|
| `for...in` | ✓ | ✓ | ✓ | ✗ |
| `Object.keys()` | ✓ | ✗ | ✓ | ✗ |
| `Object.getOwnPropertyNames()` | ✓ | ✗ | ✗ | ✗ |
| `Reflect.ownKeys()` | ✓ | ✗ | ✗ | ✓ |

**Practical Example:**
```javascript
const proto = { protoKey: 1 };
const obj = Object.create(proto);

obj.visible = 2;
Object.defineProperty(obj, 'hidden', {
    value: 3,
    enumerable: false
});
obj[Symbol('sym')] = 4;

for (let k in obj) { }            // visible, protoKey
Object.keys(obj);                 // ['visible']
Object.getOwnPropertyNames(obj);   // ['visible', 'hidden']
Reflect.ownKeys(obj);             // ['visible', 'hidden', Symbol(sym)]
```

---

## Question 6: Explain getters and setters. When should you use them, and what are the performance implications?

**Answer:**

**Getters and setters** are accessor properties that run functions instead of storing values.

**Syntax:**
```javascript
const obj = {
    _internal: 0,
    
    get value() {
        return this._internal;
    },
    
    set value(val) {
        this._internal = val;
    }
};

obj.value = 42;  // Calls setter
console.log(obj.value);  // Calls getter
```

### Use Cases

**1. Validation:**
```javascript
set age(val) {
    if (val < 0 || val > 150) {
        throw new RangeError('Invalid age');
    }
    this._age = val;
}
```

**2. Computed Properties:**
```javascript
get fullName() {
    return `${this.firstName} ${this.lastName}`;
}
```

**3. Lazy Initialization:**
```javascript
get data() {
    if (!this._cache) {
        this._cache = expensiveComputation();
    }
    return this._cache;
}
```

**4. Side Effects (Logging, Triggers):**
```javascript
set status(val) {
    this._status = val;
    this.emit('statusChanged', val);
}
```

**5. Read-Only Properties:**
```javascript
get id() {
    return this._id;
}
// No setter - read-only
```

### Performance Implications

**Cons:**
- Getter runs **on every access** (not cached by default)
- Function call overhead vs direct property access
- Can hide expensive operations

```javascript
// Bad: expensive computation in getter
get totalPrice() {
    return this.items.reduce((sum, item) => 
        sum + item.price * item.quantity, 0
    );  // Runs every time!
}

// Better: cache when items change
```

**Pros:**
- Enables lazy evaluation (compute only when needed)
- Allows optimization (caching, memoization)
- Provides encapsulation

**Best Practice:**
- Use for validation and computed values
- Document when getter has side effects
- Consider caching for expensive computations
- Avoid getters in performance-critical loops

---

## Question 7: What is Object.create() and when would you use it? How does Object.create(null) differ from {}?

**Answer:**

**Object.create(proto)** creates a new object with `proto` as its [[Prototype]].

```javascript
const proto = {
    greet() {
        return `Hello, ${this.name}`;
    }
};

const obj = Object.create(proto);
obj.name = 'Alice';

obj.greet();  // "Hello, Alice" (from prototype)
Object.getPrototypeOf(obj) === proto;  // true
```

### With Property Descriptors

```javascript
const obj = Object.create(proto, {
    name: {
        value: 'Bob',
        writable: true,
        enumerable: true
    }
});
```

### Use Cases

1. **Delegation pattern** (share methods)
2. **Factory functions** (cleaner than constructors)
3. **Prototype chain control** (specify exact prototype)
4. **Safe dictionaries** (Object.create(null))

### Object.create(null) vs {}

**{}:**
```javascript
const obj1 = {};
obj1.__proto__;          // Object.prototype
obj1.toString();        // [object Object]
obj1.hasOwnProperty;    // function
```

**Object.create(null):**
```javascript
const obj2 = Object.create(null);
obj2.__proto__;          // undefined
obj2.toString;          // undefined
obj2.hasOwnProperty;    // undefined
```

### Why Use Object.create(null)?

**1. No Prototype Pollution:**
```javascript
const dict = Object.create(null);
dict.toString = 'value';  // Safe! No conflict with Object.prototype.toString
dict.constructor = 'value';  // Safe!
dict.__proto__ = 'value';    // Safe!
```

**2. Pure Dictionary/Map:**
```javascript
const map = Object.create(null);
map[userInput] = value;  // No worries about reserved names
```

**3. Performance (Slight):**
- No prototype chain lookup for basic operations

**When to Use:**
- Configuration objects that accept arbitrary keys
- Safe key-value storage
- Preventing prototype pollution attacks
- JSON-like data structures

---

## Question 8: Explain property shadowing. What happens when you try to shadow a non-writable property in the prototype chain?

**Answer:**

**Property Shadowing** occurs when a descendant object has an own property with the same name as a property in its prototype chain, "hiding" the prototype property.

**Normal Shadowing:**
```javascript
const proto = { x: 1 };
const obj = Object.create(proto);

console.log(obj.x);  // 1 (from prototype)

obj.x = 2;  // Creates own property

console.log(obj.x);  // 2 (own property, shadows prototype)
console.log(proto.x);  // 1 (unchanged)
obj.hasOwnProperty('x');  // true
```

### Non-Writable in Prototype BLOCKS Shadowing

**Surprising Behavior:**
```javascript
const proto = {};
Object.defineProperty(proto, 'x', {
    value: 1,
    writable: false  // Non-writable!
});

const obj = Object.create(proto);

console.log(obj.x);  // 1 (from prototype)

obj.x = 2;  // FAILS! (TypeError in strict mode)

console.log(obj.x);  // Still 1
obj.hasOwnProperty('x');  // false (no own property created!)
```

**Why Does This Happen?**

The [[Set]] algorithm checks if a data property exists anywhere in the prototype chain:
- If found and `writable: false`, the assignment fails
- No own property is created (assignment is blocked entirely)

**Rationale:** Prevents "breaking" invariants established by the prototype.

### Accessor in Prototype

If prototype has a setter, it runs (doesn't shadow):
```javascript
const proto = {
    set x(val) {
        console.log('Setter called with', val);
        this._x = val;  // Creates _x on descendant
    }
};

const obj = Object.create(proto);
obj.x = 42;  // Calls prototype's setter
// Creates obj._x = 42 (not obj.x)
```

### Workaround: Object.defineProperty

```javascript
// Force shadowing even if prototype is non-writable
Object.defineProperty(obj, 'x', {
    value: 2,
    writable: true,
    enumerable: true,
    configurable: true
});

obj.hasOwnProperty('x');  // true (forced shadow)
```

**Key Takeaway:** Assignment (`obj.x = val`) and defineProperty have different rules.

---

## Question 9: Why do frozen objects in JavaScript still allow nested object mutations? How would you implement a true deep freeze?

**Answer:**

### Why Shallow Freeze?

**Object.freeze() only affects direct properties**, not objects those properties reference.

```javascript
const obj = {
    primitive: 1,
    nested: { value: 2 },
    array: [1, 2, 3]
};

Object.freeze(obj);

// Direct properties frozen
obj.primitive = 10;    // Fails
obj.newProp = 20;      // Fails
delete obj.primitive;  // Fails

// But nested objects NOT frozen
obj.nested.value = 999;  // WORKS!
obj.array.push(4);       // WORKS!
```

**Why This Design?**

1. **Performance**: Deep freezing is expensive (recursive traversal)
2. **Shared References**: Nested objects might be intentionally shared
3. **Opt-in Complexity**: Let developers choose depth

```javascript
const shared = { data: [] };
const obj1 = { ref: shared };
const obj2 = { ref: shared };

// Deep freeze obj1 would freeze shared, affecting obj2!
```

### Implementing Deep Freeze

```javascript
function deepFreeze(obj) {
    // Freeze the object itself
    Object.freeze(obj);
    
    // Recursively freeze all properties that are objects
    Object.getOwnPropertyNames(obj).forEach(prop => {
        const val = obj[prop];
        
        if (val != null && typeof val === 'object' && !Object.isFrozen(val)) {
            deepFreeze(val);
        }
    });
    
    return obj;
}
```

**Enhanced Version (Handle Symbols, Circular References):**
```javascript
function deepFreeze(obj, frozen = new WeakSet()) {
    // Handle circular references
    if (frozen.has(obj)) return obj;
    frozen.add(obj);
    
    Object.freeze(obj);
    
    // Include symbols
    Reflect.ownKeys(obj).forEach(key => {
        const val = obj[key];
        
        if (val != null && typeof val === 'object' && !Object.isFrozen(val)) {
            deepFreeze(val, frozen);
        }
    });
    
    return obj;
}
```

**Usage:**
```javascript
const config = {
    server: {
        host: 'localhost',
        ports: [3000, 4000]
    }
};

deepFreeze(config);

config.server.host = 'example.com';  // Fails
config.server.ports.push(5000);      // Fails
```

### Alternatives

**Immutable Data Libraries:**
- Immutable.js
- Immer
- Structural sharing for performance

**Object.freeze() is Still Useful:**
- Top-level constants
- Configuration objects (shallow)
- API contracts

---

## Question 10: Explain how the "in" operator, hasOwnProperty(), and Object.hasOwn() differ. Why is Object.hasOwn() preferred in modern code?

**Answer:**

### Three Ways to Check Properties

**1. `in` Operator**

Checks **own + prototype chain**:
```javascript
const proto = { inherited: 1 };
const obj = Object.create(proto);
obj.own = 2;

'own' in obj;  // true
'inherited' in obj;  // true (checks prototype!)
'notFound' in obj;  // false
```

**2. hasOwnProperty()**

Checks **own properties only**:
```javascript
obj.hasOwnProperty('own');  // true
obj.hasOwnProperty('inherited');  // false
obj.hasOwnProperty('toString');  // false
```

**Problem with hasOwnProperty:**
```javascript
// Can be overridden!
const obj1 = { hasOwnProperty: 'hacked' };
obj1.hasOwnProperty('x');  // TypeError

// Object with no prototype fails
const obj2 = Object.create(null);
obj2.hasOwnProperty('x');  // TypeError
```

**Workaround (Pre-ES2022):**
```javascript
Object.prototype.hasOwnProperty.call( obj, 'prop');
```

**3. Object.hasOwn() (ES2022)**

Checks **own properties only**, but safer:
```javascript
Object.hasOwn(obj, 'prop');  // Always safe

// No prototype needed
const noProto = Object.create(null);
Object.hasOwn(noProto, 'x');  // Works!

// Can't be overridden
const hacked = { hasOwnProperty: 'value' };
Object.hasOwn(hacked, 'hasOwnProperty');  // true (works correctly)
```

### Comparison Table

| Method | Own | Prototype | Safe with null-prototype | Can't be overridden |
|--------|-----|-----------|--------------------------|---------------------|
| `in` | ✓ | ✓ | ✓ | ✓ |
| `hasOwnProperty()` | ✓ | ✗ | ✗ | ✗ |
| `Object.hasOwn()` | ✓ | ✗ | ✓ | ✓ |

### When to Use Each

**`in` operator:**
- Check if property exists anywhere (own or inherited)
- Feature detection

**`hasOwnProperty()`:**
- Legacy code (pre-ES2022)
- Must call via `Object.prototype.hasOwnProperty.call()`

**`Object.hasOwn()` (Preferred):**
- Check for own properties in modern code
- Safe with Object.create(null)
- Can't be shadowed

### Practical Example

```javascript
const config = Object.create(null);
config.apiKey = '123';

// in operator
'apiKey' in config;  // true
'toString' in config;  // false (no prototype)

// hasOwnProperty fails
try {
    config.hasOwnProperty('apiKey');
} catch (e) {
    console.log('Error:', e.message);
}

// Object.hasOwn works
Object.hasOwn(config, 'apiKey');  // true
```

**Why Object.hasOwn() is Preferred:**
1. **Works with Object.create(null)**
2. **Cannot be shadowed** or overridden
3. **Cleaner syntax** than `.call()` workaround
4. **Intent is clear** (static method)
5. **Future-proof** (modern standard)

---

## Interview Tips

1. **Explain algorithms**: [[Get]] and [[Set]] are not simple lookups
2. **Know descriptor defaults**: Literal vs defineProperty differ
3. **Understand shadowing**: Non-writable in prototype blocks it
4. **Remember shallow**: freeze/seal/preventExtensions don't recurse
5. **Enumerate correctly**: Know which method finds what
6. **Use Object.hasOwn()**: Safer than hasOwnProperty
7. **Object.create(null)**: For safe dictionaries
8. **Performance matters**: Getters run on every access
9. **Attributes control behavior**: writable, enumerable, configurable
10. **Strict mode**: Throws errors vs silent failures
