// Example 1: Assignment Semantics
// Demonstrates: How assignment differs for primitives vs objects

console.log('=== PRIMITIVES: Assignment Copies VALUE ===\n');

// Numbers
let num1 = 42;
let num2 = num1;  // Copies the value 42

console.log('Initial values:');
console.log('  num1:', num1);
console.log('  num2:', num2);

num2 = 100;  // Only changes num2

console.log('\nAfter num2 = 100:');
console.log('  num1:', num1, '(unchanged)');
console.log('  num2:', num2, '(changed)');
console.log('  num1 === num2:', num1 === num2);

// Strings
console.log('\n--- Strings ---');
let str1 = "hello";
let str2 = str1;  // Copies the value "hello"

console.log('Initial:', { str1, str2 });

str2 = "world";  // Only changes str2

console.log('After str2 = "world":', { str1, str2 });
console.log('Independent?', str1 !== str2);

// Booleans
console.log('\n--- Booleans ---');
let flag1 = true;
let flag2 = flag1;

flag2 = false;
console.log('flag1:', flag1, '| flag2:', flag2);

console.log('\n=== OBJECTS: Assignment Copies REFERENCE ===\n');

// Objects
console.log('--- Objects ---');
let obj1 = { value: 42 };
let obj2 = obj1;  // Copies the REFERENCE, not the object

console.log('Initial:');
console.log('  obj1:', obj1);
console.log('  obj2:', obj2);
console.log('  Same object?', obj1 === obj2);

obj2.value = 100;  // Modifies the SHARED object

console.log('\nAfter obj2.value = 100:');
console.log('  obj1.value:', obj1.value, '(also changed!)');
console.log('  obj2.value:', obj2.value);
console.log('  Still same object?', obj1 === obj2);

// Arrays
console.log('\n--- Arrays ---');
let arr1 = [1, 2, 3];
let arr2 = arr1;  // Copies the reference

console.log('Initial:');
console.log('  arr1:', arr1);
console.log('  arr2:', arr2);

arr2.push(4);  // Modifies the shared array

console.log('\nAfter arr2.push(4):');
console.log('  arr1:', arr1, '(also changed!)');
console.log('  arr2:', arr2);

arr2[0] = 999;
console.log('\nAfter arr2[0] = 999:');
console.log('  arr1:', arr1);
console.log('  arr2:', arr2);

// Functions
console.log('\n--- Functions ---');
let func1 = function () { return "hello"; };
let func2 = func1;  // Copies the reference

console.log('func1 === func2:', func1 === func2);

// Add property to function (they're objects!)
func2.customProp = "modified";
console.log('func1.customProp:', func1.customProp, '(shared!)');

console.log('\n=== REASSIGNMENT vs MUTATION ===\n');

let original = { x: 1 };
let reference = original;

console.log('Initial state:');
console.log('  original:', original);
console.log('  reference:', reference);
console.log('  Same?', original === reference);

// MUTATION: Modifies the shared object
reference.x = 999;
console.log('\nAfter reference.x = 999 (mutation):');
console.log('  original:', original, '(changed)');
console.log('  reference:', reference);
console.log('  Same?', original === reference);

// REASSIGNMENT: Breaks the link
reference = { x: 42 };
console.log('\nAfter reference = { x: 42 } (reassignment):');
console.log('  original:', original, '(unchanged from last)');
console.log('  reference:', reference);
console.log('  Same?', original === reference);

console.log('\n=== NESTED STRUCTURES ===\n');

let person1 = {
    name: "Alice",
    address: {
        city: "New York",
        zip: "10001"
    }
};

let person2 = person1;  // Share reference

console.log('Initial person1:', JSON.stringify(person1, null, 2));

// Modify nested object
person2.address.city = "Boston";
console.log('\nAfter person2.address.city = "Boston":');
console.log('  person1.address.city:', person1.address.city);
console.log('  Both share same nested object!');

// Reassign nested object
person2.address = { city: "Chicago", zip: "60601" };
console.log('\nAfter person2.address = { city: "Chicago", ... }:');
console.log('  person1.address:', person1.address, '(old object)');
console.log('  person2.address:', person2.address, '(new object)');
console.log('  Different addresses?', person1.address !== person2.address);

console.log('\n=== MULTIPLE REFERENCES ===\n');

let data = { count: 0 };
let ref1 = data;
let ref2 = data;
let ref3 = data;

console.log('All point to same object:');
console.log('  ref1 === ref2:', ref1 === ref2);
console.log('  ref2 === ref3:', ref2 === ref3);

ref1.count++;
console.log('\nAfter ref1.count++:');
console.log('  data.count:', data.count);
console.log('  ref2.count:', ref2.count);
console.log('  ref3.count:', ref3.count);
console.log('  All see the change!');

console.log('\n=== CONST with OBJECTS ===\n');

const constNum = 42;
// constNum = 100;  // TypeError: Assignment to constant variable

const constObj = { value: 42 };
constObj.value = 100;  // ✓ Allowed (mutation)
console.log('const constObj = { value: 42 }');
console.log('constObj.value = 100  →  OK (mutation)');
console.log('constObj:', constObj);

// constObj = {};  // TypeError: Assignment to constant variable
console.log('constObj = {}  →  ERROR (reassignment blocked)');

const constArr = [1, 2, 3];
constArr.push(4);  // ✓ Allowed (mutation)
console.log('\nconst constArr = [1, 2, 3]');
console.log('constArr.push(4)  →  OK (mutation)');
console.log('constArr:', constArr);

console.log('\n=== PRIMITIVE WRAPPER OBJECTS ===\n');

let str = "hello";
let strObj = new String("hello");

console.log('Primitive string:', str);
console.log('String object:', strObj);
console.log('typeof str:', typeof str);
console.log('typeof strObj:', typeof strObj);

let strRef1 = strObj;
let strRef2 = strObj;

console.log('\nstrRef1 === strRef2:', strRef1 === strRef2, '(share reference)');

// Comparing primitive to object
console.log('str == strObj:', str == strObj, '(coercion)');
console.log('str === strObj:', str === strObj, '(strict)');

console.log('\n=== KEY TAKEAWAYS ===');
console.log('1. Primitives: Assignment COPIES the value');
console.log('2. Objects: Assignment COPIES the reference');
console.log('3. Multiple variables can share ONE object');
console.log('4. Mutation affects all references to same object');
console.log('5. Reassignment breaks the link');
console.log('6. const prevents reassignment, NOT mutation');
