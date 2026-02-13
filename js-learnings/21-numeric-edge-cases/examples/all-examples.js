// Chapter 21: Numeric Edge Cases
console.log(NaN === NaN);  // false
console.log(Number.isNaN(NaN));  // true

console.log(0.1 + 0.2);  // 0.30000000000000004
console.log(0.1 + 0.2 === 0.3);  // false

console.log(1 / 0);  // Infinity
console.log(-0 === 0);  // true
console.log(Object.is(-0, 0));  // false

console.log(parseInt("123abc"));  // 123
