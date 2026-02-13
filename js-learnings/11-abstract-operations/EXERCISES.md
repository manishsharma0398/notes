# Chapter 11: Prediction Exercise

Predict the output before running.

---

## Exercise 1: ToNumber

```javascript
console.log(Number(null));
console.log(Number(undefined));
console.log(Number(""));
console.log(Number("  "));
console.log(Number("0x10"));
console.log(Number([]));
console.log(Number([5]));
```

**Prediction for each:** ___________

---

## Exercise 2: ToPrimitive

```javascript
const obj = {
  valueOf() { return 10; },
  toString() { return "20"; }
};

console.log(obj + 5);
console.log(String(obj));
console.log(obj - 0);
```

**Prediction:**
- Line 6: ___________
- Line 7: ___________
- Line 8: ___________

---

## Exercise 3: Falsy Check

```javascript
console.log(!!"");
console.log(!!"0");
console.log(!!0);
console.log(!![]);
console.log(!!null);
console.log(!!" ");
```

**Prediction for each:** ___________ (true or false)

---

## Exercise 4: Abstract Equality

```javascript
console.log(5 == "5");
console.log(true == 1);
console.log(false == 0);
console.log("" == 0);
console.log([] == 0);
console.log(null == 0);
console.log(null == undefined);
```

**Prediction for each:** ___________ (true or false)

---

## Exercise 5: The Trap

```javascript
console.log([] == ![]);
console.log("0" == false);
console.log("2" == true);
```

**Prediction:**
- Line 1: ___________
- Line 2: ___________
- Line 3: ___________

---

## Exercise 6: Plus Operator

```javascript
console.log("5" + 3);
console.log("5" - 3);
console.log("5" * 2);
console.log(5 + "3");
```

**Prediction:**
- Line 1: ___________
- Line 2: ___________
- Line 3: ___________
- Line 4: ___________

---

## After Your Predictions...

1. Run each exercise
2. Explain which abstract operation is used
3. Trace the conversion steps
4. Understand why the result makes sense
