# Chapter 14 Interview Questions

## Q1: What does new do?

**Expected Answer:**
4 steps:
1. Create empty object
2. Set `[[Prototype]]` to `Constructor.prototype`
3. Call constructor with `this = new object`
4. Return object (unless constructor returns object)

## Q2: Class vs Constructor

**Q:** Key differences between class and constructor function?

**Answer:**
- Classes require `new` (throw without it)
- Classes not hoisted
- Class methods non-enumerable
- Classes always strict mode

## Q3: Constructor Return

**Q:** What happens?

```javascript
function Test() {
    this.x = 1;
    return { y: 2 };
}
const obj = new Test();
```

**Answer:** `{ y: 2 }` (object return overrides)

## Q4: super Rules

**Q:** When must you call super()?

**Answer:**
- In derived class constructor
- BEFORE using `this`
- Exactly once

## Q5: Private Fields

**Q:** How do private fields work?

```javascript
class Test {
    #x = 1;
}
```

**Answer:**
- Truly private (not accessible outside)
- Prefixed with `#`
- On instance, not prototype

## Q6: Static Members

**Q:** Where do static members live?

**Answer:**
- On constructor function itself
- NOT on prototype
- NOT on instances
- Inherited by subclasses

## Q7: this in Methods

**Q:** Fix this code:

```javascript
class Counter {
    count = 0;
    increment() { this.count++; }
}
const c = new Counter();
const fn = c.increment;
fn();  // Error
```

**Answer:** Use arrow function:
```javascript
increment = () => { this.count++; }
```

## Q8: Field Initialization

**Q:** When do fields initialize?

**Answer:** BEFORE constructor body runs

## Q9: extends Mechanics

**Q:** What does extends do?

**Answer:**
- `Child.prototype.[[Prototype]] = Parent.prototype`
- `Child.[[Prototype]] = Parent`

## Q10: Class Requirement

**Q:** Why can't you call a class without new?

**Answer:** Classes enforce OOP patterns and prevent accidental global pollution
