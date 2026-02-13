// Example 2: Immutability of Primitives
// Demonstrates: Primitives cannot be modified, only replaced

console.log('=== Strings Are Immutable ===');

let str = "hello";
console.log('Original:', str);

// Try to modify
str[0] = "H";  // Silently fails (strict mode would throw error)
console.log('After trying str[0] = "H":', str);  // "hello" (unchanged)

// String methods return NEW strings
let upper = str.toUpperCase();
console.log('After toUpperCase():');
console.log('  original:', str);    // "hello" (unchanged)
console.log('  upper:', upper);     // "HELLO" (new string)

let replaced = str.replace('h', 'j');
console.log('After replace():');
console.log('  original:', str);     // "hello" (unchanged)
console.log('  replaced:', replaced); // "jello" (new string)

console.log('\n=== Numbers Are Immutable ===');

let num = 5;
console.log('Original:', num);

// You can't modify a number value itself
// You can only reassign the variable
num = num + 1;  // Creates NEW value 6, assigns to variable
console.log('After num = num + 1:', num);  // 6

console.log('\n=== Objects Are Mutable ===');

const obj = { x: 1, y: 2 };
console.log('Original:', obj);

// You CAN modify object contents
obj.x = 10;
obj.z = 3;
console.log('After modification:', obj);  // { x: 10, y: 2, z: 3 }

// But you can't reassign const
// obj = { x: 5 };  // ERROR: Assignment to constant variable

console.log('\n=== Arrays Are Mutable ===');

const arr = [1, 2, 3];
console.log('Original:', arr);

arr.push(4);
arr[0] = 10;
console.log('After modification:', arr);  // [10, 2, 3, 4]

// But you can't reassign const
// arr = [5, 6, 7];  // ERROR: Assignment to constant variable
