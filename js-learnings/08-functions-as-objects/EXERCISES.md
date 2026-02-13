# Chapter 8: Prediction Exercise - Functions as Objects

Predict the output or behavior.

---

## Exercise 1: Function Properties

```javascript
function myFunc() {
  return "Hello";
}

myFunc.customProp = "custom";
console.log(myFunc.customProp);
console.log(myFunc.name);
console.log(myFunc.length);
```

**Prediction:**
- Line 6: ___________
- Line 7: ___________
- Line 8: ___________

---

## Exercise 2: Call vs Apply

```javascript
function greet(greeting, punctuation) {
  return `${greeting}, I'm ${this.name}${punctuation}`;
}

const person = { name: "Alice" };

console.log(greet.call(person, "Hello", "!"));
console.log(greet.apply(person, ["Hi", "."]));
```

**Prediction:**
- Line 7: ___________
- Line 8: ___________

---

## Exercise 3: Bind

```javascript
function test() {
  console.log(this.value);
}

const obj1 = { value: 1 };
const obj2 = { value: 2 };

const bound = test.bind(obj1);
bound();
bound.call(obj2);
```

**Prediction:**
- Line 9: ___________
- Line 10: ___________

---

## Exercise 4: Constructor

```javascript
function Person(name) {
  this.name = name;
}

const alice = new Person("Alice");
console.log(alice.name);
console.log(alice.constructor === Person);
```

**Prediction:**
- Line 6: ___________
- Line 7: ___________

---

## Exercise 5: Higher-Order Function

```javascript
function repeat(n, fn) {
  for (let i = 0; i < n; i++) {
    fn(i);
  }
}

repeat(3, (i) => console.log(i));
```

**Prediction:** What gets logged?

---

## Exercise 6: Function as Return Value

```javascript
function multiplier(factor) {
  return function(num) {
    return num * factor;
  };
}

const double = multiplier(2);
console.log(double(5));
console.log(double(10));
```

**Prediction:**
- Line 8: ___________
- Line 9: ___________

---

## After Your Predictions...

1. Run each exercise
2. Understand functions as first-class objects
3. Explain call/apply/bind differences
4. Identify higher-order function patterns
