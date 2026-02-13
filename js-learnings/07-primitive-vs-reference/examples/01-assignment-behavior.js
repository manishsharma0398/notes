// Example 1: Primitive vs Reference Assignment
// Demonstrates: How assignment behaves differently for primitives and references

console.log('=== PRIMITIVES (Copy by Value) ===');

let num1 = 5;
let num2 = num1;  // Copies the VALUE

console.log('Initial:');
console.log('num1:', num1);  // 5
console.log('num2:', num2);  // 5

num2 = 10;  // Only num2 changes

console.log('\nAfter modifying num2:');
console.log('num1:', num1);  // 5 (unchanged)
console.log('num2:', num2);  // 10

// Same with strings
let str1 = "hello";
let str2 = str1;  // Copies the string

str2 = "world";

console.log('\nStrings:');
console.log('str1:', str1);  // "hello" (unchanged)
console.log('str2:', str2);  // "world"

console.log('\n=== REFERENCES (Copy by Reference) ===');

let obj1 = { x: 5 };
let obj2 = obj1;  // Copies the REFERENCE (memory address)

console.log('Initial:');
console.log('obj1:', obj1);  // { x: 5 }
console.log('obj2:', obj2);  // { x: 5 }

obj2.x = 10;  // Modifies the SAME object

console.log('\nAfter modifying obj2.x:');
console.log('obj1:', obj1);  // { x: 10 } (changed!)
console.log('obj2:', obj2);  // { x: 10 }

console.log('\nAre they the same object?');
console.log('obj1 === obj2:', obj1 === obj2);  // true

// Same with arrays
let arr1 = [1, 2, 3];
let arr2 = arr1;  // Copies the reference

arr2.push(4);

console.log('\nArrays:');
console.log('arr1:', arr1);  // [1, 2, 3, 4] (changed!)
console.log('arr2:', arr2);  // [1, 2, 3, 4]
console.log('arr1 === arr2:', arr1 === arr2);  // true
