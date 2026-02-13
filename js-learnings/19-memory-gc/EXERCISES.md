# Chapter 19 Exercises
**Q1:** Will obj be garbage collected?
```javascript
let obj = { x: 1 };
let ref = obj;
obj = null;
```
**Answer:** ___________

**Q2:** Memory leak?
```javascript
setInterval(() => {
    const big = new Array(1000);
}, 100);
```
**Answer:** ___________
