# Chapter 13 Interview Questions: Prototype Chain

## Question 1: What is the Prototype Chain?

**Q:** Explain the prototype chain and how it works.

**Expected Answer:**
- Linked list of objects for inheritance
- Every object has `[[Prototype]]` link
- Property lookup walks the chain
- Ends at `null`

## Question 2: `[[Prototype]]` vs `.prototype`

**Q:** What's the difference?

**Expected Answer:**
- `[[Prototype]]`: Internal link on ALL objects
- `.prototype`: Property on FUNCTIONS only
- `new Fn()` sets instance's `[[Prototype]]` = `Fn.prototype`

## Question 3: Property Lookup

**Q:** How does JavaScript find properties?

**Expected Answer:**
1. Check object
2. Check `[[Prototype]]`
3. Continue up chain
4. Return `undefined` if not found

## Question 4: Shadowing

**Q:** What's the output?

```javascript
Person.prototype.age = 25;
const alice = new Person();
alice.age = 30;
console.log(alice.age);
delete alice.age;
console.log(alice.age);
```

**Answer:** 30, then 25 (shadowing, then revealed)

## Question 5: Inheritance Setup

**Q:** How to set up inheritance correctly?

**Answer:**
```javascript
Child.prototype = Object.create(Parent.prototype);
Child.prototype.constructor = Child;
```

## Question 6: instanceof

**Q:** How does `instanceof` work?

**Answer:** Checks if constructor's `.prototype` is anywhere in object's chain.

## Question 7: Performance

**Q:** Which is faster?

```javascript
// A
Object.create(proto);
// B
Object.setPrototypeOf({}, proto);
```

**Answer:** A (set at creation, not after)

## Question 8: Common Trap

**Q:** What happens?

```javascript
const dog = new Animal();
Animal.prototype = {};
dog.speak();  // ?
```

**Answer:** Works if `speak` was on old prototype (instances use old prototype)

## Question 9: hasOwnProperty

**Q:** Difference between property access and hasOwnProperty?

**Answer:**
- Property access: walks chain
- hasOwnProperty: checks only own properties

## Question 10: Why Prototypes?

**Q:** Why use prototypes instead of classical inheritance?

**Answer:**
- Memory efficient (shared methods)
- Dynamic (can change at runtime)
- Flexible (objects inherit from objects)
