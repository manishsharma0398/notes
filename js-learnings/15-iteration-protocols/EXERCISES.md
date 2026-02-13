# Chapter 15 Exercises

## Exercise 1
```javascript
function* gen() { yield 1; yield 2; }
const g = gen();
console.log(g.next());
console.log(g.next());
console.log(g.next());
```
**Predict each output:** ___________

## Exercise 2
```javascript
function* outer() { yield 1; yield* [2, 3]; yield 4; }
console.log([...outer()]);
```
**Prediction:** ___________

## Exercise 3
```javascript
const obj = { *[Symbol.iterator]() { yield 1; yield 2; } };
for (const v of obj) console.log(v);
```
**Prediction:** ___________
