# Chapter 11: Objects and Property Access - Revision Notes

## Core Concept

**Properties in JavaScript are not just key-value pairs—they have hidden attributes that control behavior.**

```
Property = Value/Accessor + Attributes
```

## Two Types of Properties

### Data Property
- `value`: The actual value
- `writable`: Can value be reassigned?
- `enumerable`: Shows in for...in/Object.keys()?
- `configurable`: Can be deleted/reconfigured?

### Accessor Property
- `get`: Function to call on read
- `set`: Function to call on write
- `enumerable`: Shows in for...in?
- `configurable`: Can be deleted/reconfigured?

## [[Get]] Algorithm

```
1. Check own property:
   - Data → return value
   - Accessor → call getter
2. Check prototype chain (recursive)
3. Not found → return undefined
```

## [[Set]] Algorithm

```
1. Own data property + writable → set value
2. Own accessor → call setter
3. Check prototype:
   - Non-writable → fail
   - Accessor → call setter
4. Not found + extensible → create new property
```

## Property Descriptors

### Defaults

**Object literal / dot notation:**
```javascript
{ x: 1}  // writable, enumerable, configurable = true
```

**Object.defineProperty:**
```javascript
Object.defineProperty(obj, 'x', { value: 1 });
// writable, enumerable, configurable = false (!!!)
```

### Key Rules

- **writable: false** → Cannot reassign (but can mutate object/array values)
- **enumerable: false** → Hidden from for...in, Object.keys, JSON.stringify
- **configurable: false** → Cannot delete/reconfigure (exception: writable true→false only)

## Property Enumeration

| Method | Own | Prototype | Enum Only | Symbols |
|--------|-----|-----------|-----------|---------|
| `for...in` | ✓ | ✓ | ✓ | ✗ |
| `Object.keys()` | ✓ | ✗ | ✓ | ✗ |
| `Object.getOwnPropertyNames()` | ✓ | ✗ | ✗ | ✗ |
| ` Object.getOwnPropertySymbols()` | ✓ | ✗ | ✗ | ✓ |
| `Reflect.ownKeys()` | ✓ | ✗ | ✗ | ✓ |

## Getters and Setters

**Accessor properties run functions instead of storing values:**

```javascript
const obj = {
    _value: 0,
    get value() { return this._value; },
    set value(v) { this._value = v; }
};
```

**Use cases:**
- Validation
- Computed properties
- Lazy initialization
- Side effects (logging)
- Read-only properties (getter only)

## Object Immutability

| Method | Add | Delete | Modify |
|--------|-----|--------|--------|
| `preventExtensions` | ✗ | ✓ | ✓ |
| `seal` | ✗ | ✗ | ✓ |
| `freeze` | ✗ | ✗ | ✗ |

**All are shallow!** Nested objects remain mutable.

### Deep Freeze

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

## Object.create()

Creates object with specified prototype:

```javascript
const proto = { x: 1 };
const obj = Object.create(proto);  // obj.__proto__ === proto
```

**Object.create(null):**
- No prototype (no inherited methods)
- Safe from prototype pollution
- Ideal for dictionaries/maps

## hasOwnProperty vs in

```javascript
'prop' in obj           // Checks own + prototype
obj.hasOwnProperty('prop')  // Checks own only

// Safe version (ES2022):
Object.hasOwn(obj, 'prop')
```

## Common Gotchas

1. **Non-writable in prototype prevents shadowing**
   ```javascript
   proto.x = 1 (writable: false) → obj.x = 2 fails!
   ```

2. **Setter in prototype runs on descendant**
   ```javascript
   proto has setter → obj.prop = val calls prototype setter
   ```

3. **configurable: false is permanent**
   - Cannot delete
   - Cannot reconfigure (except writable true→false)

4. **freeze is shallow**
   ```javascript
   Object.freeze(obj);
   obj.nested.prop = 'changed';  // Works!
   ```

5. **enumerable affects JSON**
   ```javascript
   JSON.stringify() only includes enumerable properties
   ```

## Practical Patterns

### Validation
```javascript
set age(val) {
    if (val < 0) throw new RangeError();
    this._age = val;
}
```

### Computed Properties
```javascript
get fullName() {
    return `${this.first} ${this.last}`;
}
```

### Constants
```javascript
const CONSTANTS = Object.freeze({ API_KEY: '123' });
```

### Safe Dictionary
```javascript
const map = Object.create(null);
map.toString = 'safe';  // No conflict
```

## Interview Quick Answers

**Q: What happens when you access a property?**
> JavaScript runs [[Get]]: checks own properties (data/accessor), then walks prototype chain returning first match or undefined.

**Q: Difference between freeze, seal, preventExtensions?**
> preventExtensions blocks adding; seal also blocks delete; freeze also blocks modification. All are shallow.

**Q: Why use Object.defineProperty?**
> Precise control over property attributes. Literals default attributes to true, defineProperty defaults to false.

**Q: What's the difference between writable and configurable?**
> writable controls value reassignment; configurable controls deletion and descriptor reconfiguration.

**Q: How to create truly private properties?**
> Use closures with getters/setters, or # private fields (class syntax).

## Key Takeaways

1. Properties have hidden attributes controlling behavior
2. [[Get]]/[[Set]] are algorithms, not simple lookups
3. Object literal defaults: all attributes true
4. defineProperty defaults: all attributes false
5. Getters/setters run functions instead of storing values
6. for...in includes prototype, Object.keys() doesn't
7. freeze/seal/preventExtensions are shallow
8. Object.create(null) prevents prototype pollution
9. Non-writable in prototype blocks shadowing
10. Use Object.hasOwn() for safe checks
