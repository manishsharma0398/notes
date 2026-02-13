// Chapter 24: undefined/null
let x;
console.log(x);  // undefined

let y = null;
console.log(typeof null);  // "object" (bug!)

console.log(undefined == null);  // true
console.log(undefined === null);  // false

// Optional chaining
const obj = {};
console.log(obj?.prop?.nested);  // undefined

// Nullish coalescing
const val = null ?? "default";  // "default"
const zero = 0 ?? 10;  // 0
