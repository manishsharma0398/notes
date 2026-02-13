# Chapter 10: Prediction Exercise - Type Coercion and Equality

Predict the output before running.

---

## Exercise 1: == vs ===

```javascript
console.log(5 == "5");
console.log(5 === "5");
console.log(true == 1);
console.log(true === 1);
console.log(null == undefined);
console.log(null === undefined);
```

**Prediction:**
- Line 1: ___________
- Line 2: ___________
- Line 3: ___________
- Line 4: ___________
- Line 5: ___________
- Line 6: ___________

---

## Exercise 2: String Coercion

```javascript
console.log("5" + 3);
console.log("5" - 3);
console.log("5" * 2);
console.log("abc" - 1);
```

**Prediction:**
- Line 1: ___________
- Line 2: ___________
- Line 3: ___________
- Line 4: ___________

---

## Exercise 3: Boolean Coercion

```javascript
console.log(!!"");
console.log(!!" ");
console.log(!!0);
console.log(!!1);
console.log(!!null);
console.log(!!undefined);
console.log(!![]);
console.log(!!{});
```

**Prediction for each line:** ___ (true or false)

---

## Exercise 4: Object to Primitive

```javascript
const obj = {
  valueOf() { return 10; },
  toString() { return "20"; }
};

console.log(obj + 5);
console.log(String(obj));
console.log(Number(obj));
```

**Prediction:**
- Line 6: ___________
- Line 7: ___________
- Line 8: ___________

---

## Exercise 5: Array Coercion

```javascript
console.log([] + []);
console.log([] + {});
console.log({} + []);
console.log([1, 2] + [3, 4]);
console.log([1] == 1);
```

**Prediction:**
- Line 1: ___________
- Line 2: ___________
- Line 3: ___________
- Line 4: ___________
- Line 5: ___________

---

## Exercise 6: Tricky Comparisons

```javascript
console.log(0 == false);
console.log("" == false);
console.log("0" == false);
console.log(null == 0);
console.log(undefined == 0);
```

**Prediction:**
- Line 1: ___________
- Line 2: ___________
- Line 3: ___________
- Line 4: ___________
- Line 5: ___________

---

## After Your Predictions...

1. Run each exercise
2. Explain the coercion steps
3. Identify when ToPrimitive is called
4. Understand why === is safer
