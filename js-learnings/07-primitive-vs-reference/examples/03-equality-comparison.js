// Example 3: Equality Comparison
// Demonstrates: Primitives compare by value, references by reference

console.log('=== Primitives: Compare by Value ===');

let a = 5;
let b = 5;
console.log('a === b:', a === b);  // true (same value)

let str1 = "hello";
let str2 = "hello";
console.log('str1 === str2:', str1 === str2);  // true (same value)

let bool1 = true;
let bool2 = true;
console.log('bool1 === bool2:', bool1 === bool2);  // true

console.log('\n=== References: Compare by Reference ===');

let obj1 = { x: 5 };
let obj2 = { x: 5 };
console.log('obj1:', obj1);
console.log('obj2:', obj2);
console.log('obj1 === obj2:', obj1 === obj2);  // false (different objects!)

// They have identical content, but are separate objects in memory
console.log('Same content?', obj1.x === obj2.x);  // true (values are same)
console.log('Same object?', obj1 === obj2);       // false (different references)

let obj3 = obj1;  // Copy the reference
console.log('obj1 === obj3:', obj1 === obj3);  // true (same reference!)

console.log('\n=== Arrays ===');

let arr1 = [1, 2, 3];
let arr2 = [1, 2, 3];
console.log('arr1 === arr2:', arr1 === arr2);  // false (different arrays)

let arr3 = arr1;
console.log('arr1 === arr3:', arr1 === arr3);  // true (same reference)

console.log('\n=== Empty Objects/Arrays ===');

// console.log('{} === {}:', {} === {});    // false
// console.log('[] === []:', [] === []);    // false

// Each literal creates a NEW object/array

console.log('\n=== Practical Implication ===');

function findUser(user, userList) {
    for (let u of userList) {
        if (u === user) {  // Reference comparison
            return u;
        }
    }
    return null;
}

const alice = { name: 'Alice', age: 30 };
const bob = { name: 'Bob', age: 25 };
const users = [alice, bob];

console.log('Finding alice:', findUser(alice, users));  // Found (same reference)
console.log('Finding { name: "Alice", age: 30 }:',
    findUser({ name: 'Alice', age: 30 }, users));  // null (different object)
