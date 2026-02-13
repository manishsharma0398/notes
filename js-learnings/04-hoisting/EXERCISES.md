# Chapter 4: Prediction Exercise

Predict the output before running.

---

## Exercise 1: Basic var Hoisting

```javascript
console.log(x);
var x = 10;
console.log(x);
```

**Prediction:**
- Line 1: ___________
- Line 3: ___________

---

## Exercise 2: let and TDZ

```javascript
console.log(y);
let y = 20;
```

**Prediction:** Will this work? If error, what kind?

---

## Exercise 3: Function Declaration

```javascript
greet();

function greet() {
  console.log("Hello");
}
```

**Prediction:** Will this work?

---

## Exercise 4: Function Expression

```javascript
sayHi();

const sayHi = function() {
  console.log("Hi");
};
```

**Prediction:** Will this work? If error, what kind?

---

## Exercise 5: Shadowing

```javascript
var name = "global";

function test() {
  console.log(name);
  var name = "local";
  console.log(name);
}

test();
```

**Prediction:**
- Line 4: ___________
- Line 6: ___________

---

## Exercise 6: typeof and TDZ

```javascript
console.log(typeof a);
console.log(typeof b);
let b = 10;
```

**Prediction:**
- Line 1: ___________
- Line 2: ___________

---

## Exercise 7: Block Scope TDZ

```javascript
let x = "outer";

{
  console.log(x);
  let x = "inner";
}
```

**Prediction:** Will this work?

---

## Exercise 8: Function Override

```javascript
console.log(typeof foo);

var foo = "string";

function foo() {
  return "function";
}

console.log(typeof foo);
```

**Prediction:**
- Line 1: ___________
- Line 9: ___________

---

## Exercise 9: Loop Variable

```javascript
console.log(typeof i);

for (var i = 0; i < 3; i++) {}

console.log(i);
```

**Prediction:**
- Line 1: ___________
- Line 5: ___________

---

## Exercise 10: Parameter TDZ

```javascript
function test(a = b, b = 2) {
  console.log(a, b);
}

test();
```

**Prediction:** Will this work?

---

## After Your Predictions...

1. Run each exercise
2. Compare to predictions
3. For errors, identify: compile-time or runtime?
4. Explain using compilation phase vs execution phase

---

## Key Insights

If you got these wrong:
- **var = undefined during hoisting**
- **let/const = TDZ until declaration**
- **Functions fully hoisted**
- **Expressions follow variable rules**
- **Shadowing happens during compilation**
