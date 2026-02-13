# Chapter 6: Prediction Exercise - Closures

Predict the output before running the code.

---

## Exercise 1: Basic Closure

```javascript
function outer() {
  let count = 0;
  
  return function inner() {
    count++;
    return count;
  };
}

const counter = outer();
console.log(counter());
console.log(counter());
console.log(counter());
```

**Prediction:**
- Line 11: ___________
- Line 12: ___________
- Line 13: ___________

**Why does count persist?**

---

## Exercise 2: Multiple Closures

```javascript
function makeCounter() {
  let count = 0;
  return function() {
    count++;
    return count;
  };
}

const c1 = makeCounter();
const c2 = makeCounter();

console.log(c1());
console.log(c1());
console.log(c2());
console.log(c1());
```

**Prediction:**
- Line 12: ___________
- Line 13: ___________
- Line 14: ___________
- Line 15: ___________

**Do c1 and c2 share the same count?**

---

## Exercise 3: Loop Closures

```javascript
// Version A: var
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log("var:", i), 0);
}

// Version B: let
for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log("let:", j), 0);
}
```

**Prediction:**
- Version A: ___________
- Version B: ___________

---

## Exercise 4: Closure Scope

```javascript
function outer() {
  let x = 10;
  
  function inner() {
    let y = 20;
    return x + y;
  }
  
  return inner;
}

const fn = outer();
console.log(fn());
```

**Prediction:** ___________

**What variables does inner close over?**

---

## Exercise 5: Private Variables

```javascript
function createPerson(name) {
  let age = 0;
  
  return {
    getName: () => name,
    getAge: () => age,
    birthday: () => age++
  };
}

const person = createPerson("Alice");
console.log(person.getName());
console.log(person.getAge());
person.birthday();
console.log(person.getAge());
console.log(person.age);
```

**Prediction:**
- Line 12: ___________
- Line 13: ___________
- Line 15: ___________
- Line 16: ___________

---

## Exercise 6: Shared Closure

```javascript
function setup() {
  let shared = 0;
  
  function increment() {
    shared++;
  }
  
  function get() {
    return shared;
  }
  
  return { increment, get };
}

const obj = setup();
obj.increment();
obj.increment();
console.log(obj.get());
```

**Prediction:** ___________

---

## After Your Predictions...

1. Run each exercise
2. Explain which variables are closed over
3. Draw the closure's retained scope
4. Identify memory implications
