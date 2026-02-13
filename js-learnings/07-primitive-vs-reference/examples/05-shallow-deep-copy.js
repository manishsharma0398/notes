// Example 5: Shallow vs Deep Copy
// Demonstrates: Different levels of copying for objects and arrays

console.log('=== Shallow Copy: Objects ===');

let original = {
    x: 1,
    y: 2,
    nested: { z: 3 }
};

// Shallow copy using spread operator
let shallowCopy = { ...original };

console.log('Original:', original);
console.log('Shallow copy:', shallowCopy);
console.log('Are they same object?', original === shallowCopy);  // false

// Modify top-level property
shallowCopy.x = 10;
console.log('\nAfter modifying shallowCopy.x:');
console.log('  original.x:', original.x);       // 1 (unchanged)
console.log('  shallowCopy.x:', shallowCopy.x); // 10

// Modify nested property - affects both!
shallowCopy.nested.z = 30;
console.log('\nAfter modifying shallowCopy.nested.z:');
console.log('  original.nested.z:', original.nested.z);       // 30 (changed!)
console.log('  shallowCopy.nested.z:', shallowCopy.nested.z); // 30

// Why? The nested object is still shared
console.log('\nAre nested objects the same?',
    original.nested === shallowCopy.nested);  // true (same reference!)

console.log('\n=== Shallow Copy: Arrays ===');

let arr1 = [1, 2, [3, 4]];
let arr2 = [...arr1];  // or arr1.slice()

arr2[0] = 10;
console.log('After arr2[0] = 10:');
console.log('  arr1:', arr1);  // [1, 2, [3, 4]] (unchanged)
console.log('  arr2:', arr2);  // [10, 2, [3, 4]]

arr2[2][0] = 30;
console.log('\nAfter arr2[2][0] = 30:');
console.log('  arr1:', arr1);  // [1, 2, [30, 4]] (changed!)
console.log('  arr2:', arr2);  // [10, 2, [30, 4]]

console.log('\n=== Deep Copy: structuredClone (Modern) ===');

let original2 = {
    x: 1,
    nested: {
        y: 2,
        deeplyNested: { z: 3 }
    }
};

let deepCopy = structuredClone(original2);

console.log('Original:', original2);
console.log('Deep copy:', deepCopy);

deepCopy.nested.deeplyNested.z = 300;
console.log('\nAfter modifying deepCopy.nested.deeplyNested.z:');
console.log('  original2:', original2);  // z: 3 (unchanged!)
console.log('  deepCopy:', deepCopy);    // z: 300

console.log('\n=== Deep Copy: JSON Method ===');

let obj = {
    name: 'Alice',
    details: {
        age: 30,
        address: { city: 'NYC' }
    }
};

let jsonCopy = JSON.parse(JSON.stringify(obj));

jsonCopy.details.address.city = 'LA';
console.log('After modifying JSON copy:');
console.log('  original city:', obj.details.address.city);         // 'NYC' (unchanged)
console.log('  jsonCopy city:', jsonCopy.details.address.city);    // 'LA'

console.log('\n=== JSON Method Limitations ===');

let complexObj = {
    date: new Date(),
    func: function () { return 'hello'; },
    undef: undefined,
    sym: Symbol('test'),
    nan: NaN,
    inf: Infinity
};

console.log('Original complex object:');
console.log(complexObj);

let jsonCopy2 = JSON.parse(JSON.stringify(complexObj));
console.log('\nAfter JSON copy:');
console.log(jsonCopy2);
// Lost: function, undefined, symbol
// Changed: Date becomes string

console.log('\n=== Manual Deep Clone ===');

function deepClone(obj) {
    // Handle primitives and null
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item));
    }

    // Handle objects
    const clone = {};
    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            clone[key] = deepClone(obj[key]);
        }
    }
    return clone;
}

let original3 = {
    x: 1,
    arr: [1, 2, { nested: true }],
    obj: { y: 2 }
};

let manualClone = deepClone(original3);
manualClone.arr[2].nested = false;

console.log('Original:', original3.arr[2].nested);      // true (unchanged)
console.log('Manual clone:', manualClone.arr[2].nested); // false
