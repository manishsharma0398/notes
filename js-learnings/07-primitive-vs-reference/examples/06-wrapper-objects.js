// Example 6: Primitive Wrapper Objects (Auto-boxing)
// Demonstrates: How primitives temporarily wrap into objects

console.log('=== Auto-boxing: Primitives Have Methods ===');

let str = "hello";
console.log('Type of str:', typeof str);  // "string" (primitive)

// Call a method - auto-boxing happens
let upper = str.toUpperCase();
console.log('str.toUpperCase():', upper);

// What actually happens:
// 1. new String("hello") - wrapper created
// 2. .toUpperCase() called on wrapper
// 3. Wrapper discarded, result returned

console.log('\nPrimitive vs Wrapper Object:');
let strPrimitive = "hello";
let strObject = new String("hello");

console.log('typeof strPrimitive:', typeof strPrimitive);  // "string"
console.log('typeof strObject:', typeof strObject);        // "object"

console.log('strPrimitive === strObject:', strPrimitive === strObject);  // false
console.log('strPrimitive == strObject:', strPrimitive == strObject);    // true (coercion)

console.log('\n=== Number Wrapper ===');

let num = 42;
console.log('typeof num:', typeof num);  // "number"

let numObj = new Number(42);
console.log('typeof numObj:', typeof numObj);  // "object"

console.log('num === numObj:', num === numObj);  // false
console.log('num == numObj:', num == numObj);    // true

// Number methods
console.log('num.toFixed(2):', num.toFixed(2));  // "42.00" (auto-boxing)

console.log('\n=== Boolean Wrapper ===');

let bool = true;
let boolObj = new Boolean(true);

console.log('typeof bool:', typeof bool);        // "boolean"
console.log('typeof boolObj:', typeof boolObj);  // "object"

// Warning: Wrapper objects are always truthy!
console.log('\nWrapper Objects Are Always Truthy:');
let falseBool = new Boolean(false);
if (falseBool) {
    console.log('This executes! (wrapper is truthy even with false value)');
}

console.log('\n=== Properties on Primitives (Silently Fail) ===');

let primitive = "hello";
primitive.customProp = "test";  // Auto-boxes, adds property, discards wrapper

console.log('primitive.customProp:', primitive.customProp);  // undefined
// Why? Each access creates a NEW wrapper, so the property is lost

console.log('\n=== Why Not Use Wrapper Constructors ===');

// DON'T DO THIS:
let badString = new String("hello");
let badNumber = new Number(42);

// Problems:
// 1. They're objects, not primitives
console.log('typeof badString:', typeof badString);  // "object" (confusing!)

// 2. Comparison issues
console.log('"hello" === new String("hello"):', "hello" === new String("hello"));  // false

// 3. Truthy/falsy issues
console.log('Boolean(0):', Boolean(0));  // false
console.log('Boolean(new Number(0)):', Boolean(new Number(0)));  // true (object!)

console.log('\n=== Correct Usage: Conversion Functions ===');

// Use wrapper functions WITHOUT 'new' for type conversion
console.log('String(42):', String(42));        // "42" (primitive string)
console.log('Number("42"):', Number("42"));    // 42 (primitive number)
console.log('Boolean(1):', Boolean(1));        // true (primitive boolean)

console.log('typeof String(42):', typeof String(42));    // "string"
console.log('typeof Number("42"):', typeof Number("42"));// "number"
console.log('typeof Boolean(1):', typeof Boolean(1));    // "boolean"
