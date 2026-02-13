# Chapter 13: Prediction Exercise

Predict the output or behavior.

## Exercise 1: Property Lookup

```javascript
function Animal() {}
Animal.prototype.type = "animal";

const dog = new Animal();
console.log(dog.type);
```

**Prediction:** ___________

---

## Exercise 2: Shadowing

```javascript
function Person() {}
Person.prototype.age = 25;

const alice = new Person();
alice.age = 30;

console.log(alice.age);
console.log(Person.prototype.age);
```

**Prediction:**
- Line 6: ___________
- Line 7: ___________

---

## Exercise 3: Delete Property

```javascript
function Person() {}
Person.prototype.name = "Unknown";

const bob = new Person();
bob.name = "Bob";

delete bob.name;
console.log(bob.name);
```

**Prediction:** ___________

---

## Exercise 4: Prototype Chain

```javascript
function Parent() {}
function Child() {}
Child.prototype = Object.create(Parent.prototype);

const instance = new Child();

console.log(instance instanceof Child);
console.log(instance instanceof Parent);
```

**Prediction:**
- Line 6: ___________
- Line 7: ___________

---

## Exercise 5: Shared Methods

```javascript
function Counter() {
  this.count = 0;
}

Counter.prototype.increment = function() {
  this.count++;
};

const c1 = new Counter();
const c2 = new Counter();

console.log(c1.increment === c2.increment);
```

**Prediction:** ___________

---

## Exercise 6: Prototype Replacement

```javascript
function Animal() {}
Animal.prototype.speak = function() { console.log("old"); };

const dog = new Animal();

Animal.prototype = { speak: function() { console.log("new"); } };

const cat = new Animal();

dog.speak();
cat.speak();
```

**Prediction:**
- Line 10: ___________
- Line 11: ___________

---

## After Your Predictions...

1. Run each exercise
2. Draw the prototype chain
3. Trace property lookups
4. Explain shadowing vs inheritance
