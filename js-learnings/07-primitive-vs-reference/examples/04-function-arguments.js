// Example 4: Function Arguments
// Demonstrates: Pass-by-value for primitives, pass-by-reference for objects

console.log('=== Primitives: Pass by Value ===');

function modifyPrimitive(x) {
    console.log('  Inside function, before:', x);
    x = 100;  // Modifies local copy only
    console.log('  Inside function, after:', x);
}

let num = 5;
console.log('Before function call:', num);
modifyPrimitive(num);
console.log('After function call:', num);  // 5 (unchanged)

console.log('\n=== References: Pass by Reference ===');

function modifyObject(obj) {
    console.log('  Inside function, before:', obj);
    obj.x = 100;  // Modifies the original object!
    console.log('  Inside function, after:', obj);
}

let myObj = { x: 5 };
console.log('Before function call:', myObj);
modifyObject(myObj);
console.log('After function call:', myObj);  // { x: 100 } (changed!)

console.log('\n=== The Reassignment Gotcha ===');

function reassignObject(obj) {
    console.log('  Inside function, received:', obj);
    obj = { x: 999 };  // Reassigns LOCAL variable only
    console.log('  Inside function, after reassignment:', obj);
}

let myObj2 = { x: 5 };
console.log('Before function call:', myObj2);
reassignObject(myObj2);
console.log('After function call:', myObj2);  // { x: 5 } (unchanged!)

// Why? The reference was copied to the parameter.
// Reassigning the parameter doesn't affect the original variable.

console.log('\n=== Arrays (also references) ===');

function modifyArray(arr) {
    arr.push(4);  // Modifies original array
}

function reassignArray(arr) {
    arr = [9, 9, 9];  // Only affects local parameter
}

let myArray = [1, 2, 3];
console.log('Original:', myArray);

modifyArray(myArray);
console.log('After modifyArray:', myArray);  // [1, 2, 3, 4] (changed)

reassignArray(myArray);
console.log('After reassignArray:', myArray);  // [1, 2, 3, 4] (unchanged)

console.log('\n=== Practical Example: Swap Function ===');

function swapPrimitives(a, b) {
    let temp = a;
    a = b;
    b = temp;
    console.log('  Inside swap:', a, b);
}

let x = 5, y = 10;
console.log('Before swap:', x, y);
swapPrimitives(x, y);
console.log('After swap:', x, y);  // 5, 10 (unchanged - swap didn't work!)

// To swap, you need to return values or use an object/array
function swapUsingObject(obj) {
    let temp = obj.a;
    obj.a = obj.b;
    obj.b = temp;
}

let values = { a: 5, b: 10 };
console.log('\nBefore swap (object):', values);
swapUsingObject(values);
console.log('After swap (object):', values);  // { a: 10, b: 5 } (worked!)
