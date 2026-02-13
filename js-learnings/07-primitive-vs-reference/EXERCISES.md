# Chapter 7: Prediction Exercise - Primitive vs Reference Types

Predict the output before running.

---

## Exercise 1: Primitive Assignment

```javascript
let a = 10;
let b = a;
b = 20;

console.log(a);
console.log(b);
```

**Prediction:**
- Line 5: ___________
- Line 6: ___________

---

## Exercise 2: Reference Assignment

```javascript
let obj1 = { value: 10 };
let obj2 = obj1;
obj2.value = 20;

console.log(obj1.value);
console.log(obj2.value);
```

**Prediction:**
- Line 5: ___________
- Line 6: ___________

---

## Exercise 3: Array Mutation

```javascript
let arr1 = [1, 2, 3];
let arr2 = arr1;
arr2.push(4);

console.log(arr1.length);
console.log(arr2.length);
```

**Prediction:**
- Line 5: ___________
- Line 6: ___________

---

## Exercise 4: Function Parameters

```javascript
function changePrimitive(x) {
  x = 100;
}

function changeObject(obj) {
  obj.value = 100;
}

let num = 10;
let object = { value: 10 };

changePrimitive(num);
changeObject(object);

console.log(num);
console.log(object.value);
```

**Prediction:**
- Line 15: ___________
- Line 16: ___________

---

## Exercise 5: Reassignment vs Mutation

```javascript
let obj = { x: 1 };
let ref = obj;

obj.x = 2;  // Mutation
console.log(ref.x);

obj = { x: 3 };  // Reassignment
console.log(ref.x);
```

**Prediction:**
- Line 5: ___________
- Line 8: ___________

---

## Exercise 6: Nested Objects

```javascript
let outer = { inner: { value: 10 } };
let copy = outer;

copy.inner.value = 20;
console.log(outer.inner.value);
```

**Prediction:** ___________

---

## After Your Predictions...

1. Run each exercise
2. Identify: primitive or reference?
3. Explain: copy or reference?
4. Understand value vs reference semantics
