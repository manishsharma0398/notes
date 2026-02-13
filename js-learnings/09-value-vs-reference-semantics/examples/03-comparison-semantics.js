// Example 3: Comparison by Value vs Reference
// Demonstrates: How === works differently for primitives vs objects

console.log('=== PRIMITIVES: Compare by VALUE ===\n');

// Numbers
console.log('--- Numbers ---');
let num1 = 42;
let num2 = 42;
let num3 = num1;

console.log('num1:', num1);
console.log('num2:', num2);
console.log('num3:', num3);
console.log('num1 === num2:', num1 === num2, '(same value)');
console.log('num1 === num3:', num1 === num3);
console.log('42 === 42:', 42 === 42);

// Strings
console.log('\n--- Strings ---');
let str1 = "hello";
let str2 = "hello";
let str3 = "hel" + "lo";

console.log('str1 === str2:', str1 === str2, '(same value)');
console.log('str1 === str3:', str1 === str3, '(same value, different construction)');
console.log('"hello" === "hello":', "hello" === "hello");

// Booleans
console.log('\n--- Booleans ---');
console.log('true === true:', true === true);
console.log('false === false:', false === false);
console.log('true === false:', true === false);

// null and undefined
console.log('\n--- null and undefined ---');
console.log('null === null:', null === null);
console.log('undefined === undefined:', undefined === undefined);
console.log('null === undefined:', null === undefined, '(strict)');
console.log('null == undefined:', null == undefined, '(abstract)');

console.log('\n=== OBJECTS: Compare by REFERENCE ===\n');

// Objects with identical content
console.log('--- Identical Content, Different Objects ---');
let obj1 = { x: 5 };
let obj2 = { x: 5 };

console.log('obj1:', obj1);
console.log('obj2:', obj2);
console.log('obj1 === obj2:', obj1 === obj2, '(different objects!)');
console.log('obj1 == obj2:', obj1 == obj2, '(still false)');

// Same reference
console.log('\n--- Same Reference ---');
let obj3 = obj1;

console.log('obj3:', obj3);
console.log('obj1 === obj3:', obj1 === obj3, '(same reference)');

// Modify to show they're truly the same
obj3.x = 999;
console.log('After obj3.x = 999:');
console.log('  obj1.x:', obj1.x, '(changed)');
console.log('  obj3.x:', obj3.x);

// Arrays
console.log('\n--- Arrays ---');
let arr1 = [1, 2, 3];
let arr2 = [1, 2, 3];
let arr3 = arr1;

console.log('arr1 === arr2:', arr1 === arr2, '(same content, different arrays)');
console.log('arr1 === arr3:', arr1 === arr3, '(same reference)');

// Empty arrays/objects
console.log('\n--- Empty Structures ---');
// console.log('[] === []:', [] === [], '(always false)');
// console.log('{} === {}:', {} === {}, '(always false)');
const emptyArr1 = [];
const emptyArr2 = [];
const emptyObj1 = {};
const emptyObj2 = {};
console.log('emptyArr1 === emptyArr2:', emptyArr1 === emptyArr2, '(different objects)');
console.log('emptyObj1 === emptyObj2:', emptyObj1 === emptyObj2, '(different objects)');

// Functions
console.log('\n--- Functions ---');
function fn1() { return 1; }
function fn2() { return 1; }
let fn3 = fn1;

console.log('fn1 === fn2:', fn1 === fn2, '(different functions)');
console.log('fn1 === fn3:', fn1 === fn3, '(same reference)');

console.log('\n=== WHY This Design? ===\n');

console.log('Value comparison would be expensive for large objects:');
const huge1 = { /* imagine thousands of properties */ };
const huge2 = { /* imagine thousands of properties */ };
console.log('Comparing references is O(1) - instant');
console.log('Comparing all properties would be O(n) - slow');

console.log('\n=== CUSTOM DEEP EQUALITY ===\n');

function deepEqual(a, b) {
    // Same reference
    if (a === b) return true;

    // Different types or one is null
    if (typeof a !== typeof b || a === null || b === null) {
        return false;
    }

    // Primitives
    if (typeof a !== 'object') {
        return a === b;
    }

    // Arrays
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }

    // Objects
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (let key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!deepEqual(a[key], b[key])) return false;
    }

    return true;
}

console.log('Testing deepEqual:');

const objA = { x: 1, y: { z: 2 } };
const objB = { x: 1, y: { z: 2 } };
const objC = { x: 1, y: { z: 3 } };

console.log('objA === objB:', objA === objB, '(reference)');
console.log('deepEqual(objA, objB):', deepEqual(objA, objB), '(deep value)');
console.log('deepEqual(objA, objC):', deepEqual(objA, objC), '(different values)');

const arrA = [1, [2, 3]];
const arrB = [1, [2, 3]];
const arrC = [1, [2, 4]];

console.log('\narrA === arrB:', arrA === arrB);
console.log('deepEqual(arrA, arrB):', deepEqual(arrA, arrB));
console.log('deepEqual(arrA, arrC):', deepEqual(arrA, arrC));

console.log('\n=== COMPARING IN PRACTICE ===\n');

// Checking if array contains object
const users = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
];

const alice = { id: 1, name: 'Alice' };

console.log('Array.includes() with objects:');
console.log('users.includes(alice):', users.includes(alice), '(different reference)');
console.log('users.includes(users[0]):', users.includes(users[0]), '(same reference)');

// Finding by property instead
const found = users.find(user => user.id === alice.id);
console.log('Found by id:', found);

console.log('\n=== SET with OBJECTS ===\n');

const set = new Set();

const obj = { value: 1 };
set.add(obj);
set.add(obj);  // Same reference - not added again
console.log('set.size after adding same ref twice:', set.size);

set.add({ value: 1 });  // Different object
console.log('set.size after adding { value: 1 }:', set.size);

console.log('\n--- Set Contents ---');
set.forEach(item => console.log('  ', item));

console.log('\n=== MAP with OBJECT KEYS ===\n');

const map = new Map();

const key1 = { id: 1 };
const key2 = { id: 1 };

map.set(key1, 'value1');
map.set(key2, 'value2');

console.log('map.size:', map.size, '(different object keys)');
console.log('map.get(key1):', map.get(key1));
console.log('map.get(key2):', map.get(key2));
console.log('map.get({ id: 1 }):', map.get({ id: 1 }), '(new object, not found)');

console.log('\n=== NaN SPECIAL CASE ===\n');

console.log('NaN === NaN:', NaN === NaN, '(only value not equal to itself!)');
console.log('Number.isNaN(NaN):', Number.isNaN(NaN), '(use this instead)');
console.log('Object.is(NaN, NaN):', Object.is(NaN, NaN), '(or this)');

// Set treats NaN specially
const nanSet = new Set([NaN, NaN, NaN]);
console.log('Set with multiple NaN:', nanSet.size, '(treated as same value)');

console.log('\n=== OBJECT.IS() ===\n');

console.log('Object.is() is like === but:');
console.log('Object.is(+0, -0):', Object.is(+0, -0), '(false)');
console.log('+0 === -0:', +0 === -0, '(true)');

console.log('\nObject.is(NaN, NaN):', Object.is(NaN, NaN), '(true)');
console.log('NaN === NaN:', NaN === NaN, '(false)');

console.log('\nFor objects, same as ===:');
const testObj1 = {};
const testObj2 = {};
console.log('Object.is(testObj1, testObj2):', Object.is(testObj1, testObj2));
console.log('testObj1 === testObj2:', testObj1 === testObj2);

console.log('\n=== PRACTICAL: Caching ===\n');

const cache = new Map();

function expensiveOperation(obj) {
    // Check cache by reference
    if (cache.has(obj)) {
        console.log('  Cache hit!');
        return cache.get(obj);
    }

    console.log('  Computing...');
    const result = `Computed for ${JSON.stringify(obj)}`;
    cache.set(obj, result);
    return result;
}

const input1 = { id: 1 };
const input2 = { id: 1 };  // Same content, different object

console.log('First call with input1:');
console.log(expensiveOperation(input1));

console.log('\nSecond call with same input1:');
console.log(expensiveOperation(input1));

console.log('\nCall with input2 (same content, different ref):');
console.log(expensiveOperation(input2));

console.log('\n=== KEY TAKEAWAYS ===');
console.log('1. Primitives: === compares actual VALUES');
console.log('2. Objects: === compares REFERENCES (memory addresses)');
console.log('3. Identical content ≠ same object');
console.log('4. Need custom logic for deep equality');
console.log('5. Set/Map use === for primitives, reference for objects');
console.log('6. NaN is special: not equal to itself with ===');
console.log('7. Use Object.is() for +0/-0 and NaN edge cases');
