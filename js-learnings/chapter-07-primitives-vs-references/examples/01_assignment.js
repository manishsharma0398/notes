// Example 1: Primitive vs Reference in assignment

"use strict";

// ─── Primitives: independent copies ───
let x = 10;
let y = x;   // y gets the VALUE 10 — independent
y = 99;
console.log(x); // 10 — unaffected
console.log(y); // 99

// ─── Reference types: shared pointer ───
const obj1 = { name: "Alice" };
const obj2 = obj1;  // obj2 gets the POINTER — same object
obj2.name = "Bob";
console.log(obj1.name); // "Bob" — same heap object
console.log(obj1 === obj2); // true — same pointer

// ─── Reassigning obj2 does NOT affect obj1 ───
let a = { val: 1 };
let b = a;
b = { val: 2 }; // b now points to a new object
console.log(a.val); // 1 — a still points to original
