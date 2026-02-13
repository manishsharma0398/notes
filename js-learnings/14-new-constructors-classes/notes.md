# Chapter 14 Revision Notes

## What new Does

**4 steps:**
1. Create empty object: `{}`
2. Set `[[Prototype]]`: `obj.[[Prototype]] = Constructor.prototype`
3. Call constructor: `Constructor.call(obj, ...args)`
4. Return object (unless constructor returns object)

---

## Classes vs Constructor Functions

| Feature | Class | Constructor |
|---------|-------|-------------|
| Must use `new` | Yes (throws) | No (silent fail) |
| Hoisted | No | Yes |
| Methods enumerable | No | Yes |
| Strict mode | Always | If declared |
| `super` | Yes | Manual |

---

## Class Syntax

```javascript
class MyClass {
    // Public field
    x = 1;
    
    // Private field
    #y = 2;
    
    // Constructor
    constructor() {}
    
    // Instance method
    method() {}
    
    // Static method
    static staticMethod() {}
    
    // Getter/setter
    get prop() {}
    set prop(v) {}
}
```

---

## Inheritance

**extends:**
- Sets `Child.prototype.[[Prototype]] = Parent.prototype`
- Sets `Child.[[Prototype]] = Parent` (static inheritance)

**super:**
- In constructor: Calls parent constructor
- In method: Accesses parent method
- **Must call super() before using this in derived class**

---

## Key Rules

1. **Classes require new**
2. **super() before this** in derived constructor
3. **Private fields** with `#` are truly private
4. **Arrow functions** preserve `this`
5. **Fields initialize** before constructor body

---

## Common Patterns

### Factory Method
```javascript
static fromJSON(json) {
    return new MyClass(JSON.parse(json));
}
```

### Arrow Method (preserve this)
```javascript
handleClick = () => {
    this.count++;
}
```

---

## One-Sentence Summary

**The `new` operator creates an object, sets its prototype, calls the constructor with `this` bound to the new object, and returns it; classes are syntactic sugar over this pattern with stricter rules requiring `new`, non-enumerable methods, and support for modern features like private fields and simplified inheritance via `extends` and `super`.**
