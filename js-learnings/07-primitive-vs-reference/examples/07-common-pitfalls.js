// Example 7: Common Pitfalls
// Demonstrates: Real-world bugs caused by primitive/reference confusion

console.log('=== Pitfall 1: Unexpected Mutation ===');

function addToArray(arr, item) {
    arr.push(item);  // Mutates the original!
    return arr;
}

let myArray = [1, 2, 3];
console.log('Before:', myArray);

let result = addToArray(myArray, 4);
console.log('After:', myArray);     // [1, 2, 3, 4] - mutated!
console.log('Result:', result);     // [1, 2, 3, 4]
console.log('Same array?', myArray === result);  // true

// Better: Return new array
function addToArrayPure(arr, item) {
    return [...arr, item];  // Creates new array
}

let myArray2 = [1, 2, 3];
let result2 = addToArrayPure(myArray2, 4);
console.log('\nPure function:');
console.log('Original:', myArray2);  // [1, 2, 3] - unchanged
console.log('Result:', result2);     // [1, 2, 3, 4]

console.log('\n=== Pitfall 2: Default Object Parameters ===');

function processOptions(options = {}) {
    options.processed = true;  // Mutates the default!
    return options;
}

processOptions();  // Uses default {}
processOptions();  // Same default object is reused and modified!

let opts = {};
processOptions(opts);
console.log('Options:', opts);  // { processed: true }

// Fix: Create new object each time
function processOptionsSafe(options) {
    options = { ...options };  // Or: options = options || {}
    options.processed = true;
    return options;
}

console.log('\n=== Pitfall 3: Comparing Objects ===');

function hasUser(user, userList) {
    return userList.includes(user);  // Reference comparison!
}

let alice = { name: 'Alice' };
let users = [{ name: 'Alice' }, { name: 'Bob' }];

console.log('Has user?', hasUser(alice, users));  // false (different objects)

// Fix: Compare by property
function hasUserById(userId, userList) {
    return userList.some(user => user.id === userId);
}

console.log('\n=== Pitfall 4: Shallow Copy Gotcha ===');

function cloneUser(user) {
    return { ...user };  // Shallow copy
}

let originalUser = {
    name: 'Alice',
    address: { city: 'NYC', zip: '10001' }
};

let clonedUser = cloneUser(originalUser);
clonedUser.name = 'Bob';
clonedUser.address.city = 'LA';  // Modifies original!

console.log('Original user city:', originalUser.address.city);  // 'LA' (oops!)
console.log('Cloned user city:', clonedUser.address.city);      // 'LA'

// Fix: Deep copy
function cloneUserDeep(user) {
    return structuredClone(user);
}

console.log('\n=== Pitfall 5: Array Methods That Mutate ===');

let numbers = [3, 1, 4, 1, 5];
console.log('Original:', numbers);

// Mutating methods
let sorted = numbers.sort();  // MUTATES original!
console.log('After sort:');
console.log('  numbers:', numbers);  // [1, 1, 3, 4, 5] (changed!)
console.log('  sorted:', sorted);    // [1, 1, 3, 4, 5]
console.log('  Same array?', numbers === sorted);  // true

// Non-mutating alternative
let numbers2 = [3, 1, 4, 1, 5];
let sorted2 = [...numbers2].sort();  // Sort a copy
console.log('\nNon-mutating approach:');
console.log('  numbers2:', numbers2);  // [3, 1, 4, 1, 5] (unchanged)
console.log('  sorted2:', sorted2);    // [1, 1, 3, 4, 5]

console.log('\n=== Pitfall 6: const Doesn\'t Prevent Mutation ===');

const obj = { x: 1 };
obj.x = 2;  // Allowed! (modifying content)
console.log('obj.x:', obj.x);  // 2

const arr = [1, 2, 3];
arr.push(4);  // Allowed! (modifying content)
console.log('arr:', arr);  // [1, 2, 3, 4]

// This is an error:
try {
    // obj = { x: 5 };  // ERROR: Assignment to constant variable
} catch (e) {
    console.log('Cannot reassign const:', e.message);
}

// To prevent mutation, use Object.freeze()
const frozen = Object.freeze({ x: 1 });
frozen.x = 2;  // Silently fails (strict mode: error)
console.log('frozen.x:', frozen.x);  // 1 (unchanged)

// But freeze is shallow!
const shallowFrozen = Object.freeze({
    x: 1,
    nested: { y: 2 }
});
shallowFrozen.nested.y = 20;  // Allowed!
console.log('shallowFrozen.nested.y:', shallowFrozen.nested.y);  // 20

console.log('\n=== Pitfall 7: Lost References in Loops ===');

let items = [{ id: 1 }, { id: 2 }, { id: 3 }];
let found = null;

for (let item of items) {
    if (item.id === 2) {
        found = item;  // Saves reference
        break;
    }
}

found.id = 99;  // Modifies original!
console.log('Items:', items);  // [{ id: 1 }, { id: 99 }, { id: 3 }]

// If you needed a copy:
let foundCopy = { ...items.find(item => item.id === 3) };
foundCopy.id = 999;
console.log('Items after copy modification:', items);  // id:3 unchanged
