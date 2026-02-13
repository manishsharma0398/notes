# Chapter 11: Prediction Exercise - Objects and Property Access

Predict the output before running.

---

## Exercise 1: Property Access

```javascript
const obj = {
  name: "Alice",
  age: 30
};

console.log(obj.name);
console.log(obj["age"]);
console.log(obj.missing);
```

**Prediction:**
- Line 6: ___________
- Line 7: ___________
- Line 8: ___________

---

## Exercise 2: Computed Properties

```javascript
const key = "value";
const obj = {
  [key]: 42,
  ["computed" + "Key"]: "dynamic"
};

console.log(obj.value);
console.log(obj.computedKey);
console.log(obj[key]);
```

**Prediction:**
- Line 7: ___________
- Line 8: ___________
- Line 9: ___________

---

## Exercise 3: Property Descriptors

```javascript
const obj = {};

Object.defineProperty(obj, 'readOnly', {
  value: 42,
  writable: false
});

obj.readOnly = 100;
console.log(obj.readOnly);
```

**Prediction:** ___________

---

## Exercise 4: Enumerable

```javascript
const obj = { a: 1 };

Object.defineProperty(obj, 'hidden', {
  value: 2,
  enumerable: false
});

console.log(Object.keys(obj));
console.log(obj.hidden);
```

**Prediction:**
- Line 8: ___________
- Line 9: ___________

---

## Exercise 5: Getters and Setters

```javascript
const obj = {
  _value: 10,
  get value() {
    return this._value;
  },
  set value(v) {
    this._value = v * 2;
  }
};

console.log(obj.value);
obj.value = 5;
console.log(obj.value);
```

**Prediction:**
- Line 11: ___________
- Line 13: ___________

---

## Exercise 6: Object.freeze

```javascript
const obj = Object.freeze({ x: 1 });

obj.x = 2;
obj.y = 3;

console.log(obj.x);
console.log(obj.y);
```

**Prediction:**
- Line 6: ___________
- Line 7: ___________

---

## After Your Predictions...

1. Run each exercise
2. Understand property descriptors
3. Learn about writable, enumerable, configurable
4. Explore getters/setters mechanics
