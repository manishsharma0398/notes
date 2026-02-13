# Chapter 9: Prediction Exercise - Value vs Reference Semantics

Predict the output before running.

---

## Exercise 1: Pass by Value

```javascript
function modify(x) {
  x = 100;
  return x;
}

let num = 10;
let result = modify(num);

console.log(num);
console.log(result);
```

**Prediction:**
- Line 9: ___________
- Line 10: ___________

---

## Exercise 2: Pass by Reference

```javascript
function modify(obj) {
  obj.value = 100;
  return obj;
}

let object = { value: 10 };
let result = modify(object);

console.log(object.value);
console.log(result.value);
console.log(object === result);
```

**Prediction:**
- Line 9: ___________
- Line 10: ___________
- Line 11: ___________

---

## Exercise 3: Reassignment in Function

```javascript
function replace(obj) {
  obj = { value: 100 };
  return obj;
}

let original = { value: 10 };
let returned = replace(original);

console.log(original.value);
console.log(returned.value);
console.log(original === returned);
```

**Prediction:**
- Line 9: ___________
- Line 10: ___________
- Line 11: ___________

---

## Exercise 4: Array Mutation

```javascript
function addItem(arr, item) {
  arr.push(item);
  return arr;
}

let list = [1, 2];
let result = addItem(list, 3);

console.log(list);
console.log(result);
console.log(list === result);
```

**Prediction:**
- Line 9: ___________
- Line 10: ___________
- Line 11: ___________

---

## Exercise 5: Shallow Copy

```javascript
let obj1 = { a: 1, b: { c: 2 } };
let obj2 = { ...obj1 };

obj2.a = 10;
obj2.b.c = 20;

console.log(obj1.a);
console.log(obj1.b.c);
console.log(obj2.a);
console.log(obj2.b.c);
```

**Prediction:**
- Line 7: ___________
- Line 8: ___________
- Line 9: ___________
- Line 10: ___________

---

## Exercise 6: Comparison

```javascript
let a = { x: 1 };
let b = { x: 1 };
let c = a;

console.log(a === b);
console.log(a === c);
console.log(a.x === b.x);
```

**Prediction:**
- Line 5: ___________
- Line 6: ___________
- Line 7: ___________

---

## After Your Predictions...

1. Run each exercise
2. Distinguish mutation vs reassignment
3. Understand shallow vs deep operations
4. Explain reference comparison vs value comparison
