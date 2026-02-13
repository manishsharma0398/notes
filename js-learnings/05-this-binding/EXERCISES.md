# Chapter 5: Prediction Exercise

Predict the value of `this` in each scenario.

---

## Exercise 1: Default Binding

```javascript
function test() {
  console.log(this);
}

test();
```

**Prediction:** What is `this`?

---

## Exercise 2: Implicit Binding

```javascript
const obj = {
  value: 42,
  test: function() {
    console.log(this.value);
  }
};

obj.test();
```

**Prediction:** ___________

---

## Exercise 3: Lost Binding

```javascript
const obj = {
  value: 42,
  test: function() {
    console.log(this.value);
  }
};

const fn = obj.test;
fn();
```

**Prediction:** ___________

---

## Exercise 4: Explicit Binding

```javascript
function test() {
  console.log(this.value);
}

const obj1 = { value: 1 };
const obj2 = { value: 2 };

test.call(obj1);
test.apply(obj2);
```

**Prediction:**
- Line 6: ___________
- Line 7: ___________

---

## Exercise 5: Hard Binding

```javascript
function test() {
  console.log(this.value);
}

const obj1 = { value: 1 };
const obj2 = { value: 2 };

const bound = test.bind(obj1);
bound.call(obj2);
```

**Prediction:** ___________

---

## Exercise 6: new Binding

```javascript
function Test(value) {
  this.value = value;
}

const instance = new Test(42);
console.log(instance.value);
```

**Prediction:** ___________

---

## Exercise 7: Arrow Function

```javascript
const obj = {
  value: 42,
  test: () => {
    console.log(this.value);
  }
};

obj.test();
```

**Prediction:** ___________

---

## Exercise 8: Arrow in Method

```javascript
const obj = {
  value: 42,
  test: function() {
    const arrow = () => {
      console.log(this.value);
    };
    arrow();
  }
};

obj.test();
```

**Prediction:** ___________

---

## Exercise 9: Nested Functions

```javascript
const obj = {
  value: 42,
  outer: function() {
    function inner() {
      console.log(this.value);
    }
    inner();
  }
};

obj.outer();
```

**Prediction:** ___________

---

## Exercise 10: Callback

```javascript
const obj = {
  value: 42,
  test: function() {
    console.log(this.value);
  }
};

setTimeout(obj.test, 100);
```

**Prediction:** ___________

---

## After Your Predictions...

1. Run each exercise
2. Identify which binding rule applies
3. For errors, understand why
4. Try fixing with arrow functions or .bind()

---

## Key Questions

For each exercise, ask:
1. What is the **call-site**?
2. Which **binding rule** applies?
3. Is it an **arrow function**?
4. What **object** is `this` bound to?
