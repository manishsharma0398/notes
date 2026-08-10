// Example 2: Function arguments — pass by value (always)

"use strict";

// ─── Primitive argument — caller unchanged ───
function double(n) {
  n *= 2; // modifies local copy
  return n;
}

let num = 5;
double(num);
console.log(num); // 5 — unchanged

// ─── Reference argument — heap object can be mutated ───
function addItem(arr, item) {
  arr.push(item); // mutates the shared heap array
}

const items = [1, 2, 3];
addItem(items, 4);
console.log(items); // [1, 2, 3, 4] — mutation visible

// ─── Reassigning the parameter does NOT affect the caller ───
function replace(arr) {
  arr = [99, 100]; // only changes the local binding
}

const original = [1, 2, 3];
replace(original);
console.log(original); // [1, 2, 3] — unaffected

// ─── The classic gotcha: mutation AND reassignment ───
function tricky(obj) {
  obj.value = 42;    // mutates the shared object — caller sees this
  obj = { value: 0 }; // reassigns local — caller does NOT see this
}

const myObj = { value: 1 };
tricky(myObj);
console.log(myObj.value); // 42 — mutation is visible, reassignment is not
