# Chapter 20 Exercises
```javascript
const obj = Object.freeze({ x: 1, nested: { y: 2 } });
obj.x = 10;
obj.nested.y = 20;
console.log(obj.x, obj.nested.y);
```
**Prediction:** ___________

```javascript
const a = { inner: { val: 1 } };
const b = { ...a };
b.inner.val = 2;
console.log(a.inner.val);
```
**Prediction:** ___________
