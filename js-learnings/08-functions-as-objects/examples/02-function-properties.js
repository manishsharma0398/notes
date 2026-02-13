// Example 2: Function Properties
// Demonstrates: name, length, prototype, and custom properties

console.log('=== Built-in Property: name ===');

function namedFunction() { }
console.log('function namedFunction:', namedFunction.name); // "namedFunction"

const variable = function () { };
console.log('const variable = function:', variable.name); // "variable" (inferred)

const obj = {
    method() { },
    arrow: () => { }
};
console.log('obj.method:', obj.method.name);   // "method"
console.log('obj.arrow:', obj.arrow.name);     // "arrow"

const anonymous = function () { };
console.log('anonymous function:', anonymous.name); // "anonymous"

// Bound functions
function original() { }
const bound = original.bind(null);
console.log('bound function:', bound.name); // "bound original"

console.log('\n=== Built-in Property: length ===');

function noParams() { }
console.log('function noParams():', noParams.length); // 0

function threeParams(a, b, c) { }
console.log('function threeParams(a, b, c):', threeParams.length); // 3

function withDefault(a, b = 5, c) { }
console.log('function withDefault(a, b = 5, c):', withDefault.length); // 1
// Only counts parameters BEFORE first default

function withRest(a, b, ...rest) { }
console.log('function withRest(a, b, ...rest):', withRest.length); // 2
// Rest parameters not counted

function allDefaults(a = 1, b = 2) { }
console.log('function allDefaults(a = 1, b = 2):', allDefaults.length); // 0

console.log('\n=== Built-in Property: prototype ===');

function RegularFunc() { }
console.log('RegularFunc.prototype:', RegularFunc.prototype);
console.log('typeof RegularFunc.prototype:', typeof RegularFunc.prototype); // "object"
console.log('RegularFunc.prototype.constructor === RegularFunc:',
    RegularFunc.prototype.constructor === RegularFunc); // true

// Arrow functions DON'T have prototype
const arrowFunc = () => { };
console.log('arrowFunc.prototype:', arrowFunc.prototype); // undefined

// Built-in functions have prototype
console.log('Array.prototype:', typeof Array.prototype); // "object"
console.log('Object.prototype:', typeof Object.prototype); // "object"

console.log('\n=== Built-in Property: __proto__ (or [[Prototype]]) ===');

function myFunc() { }

console.log('myFunc.__proto__ === Function.prototype:',
    myFunc.__proto__ === Function.prototype); // true

// Functions inherit from Function.prototype
console.log('myFunc has call:', typeof myFunc.call); // "function"
console.log('myFunc has apply:', typeof myFunc.apply); // "function"
console.log('myFunc has bind:', typeof myFunc.bind); // "function"

console.log('\n=== Custom Properties ===');

function counter() {
    counter.count++;
    return counter.count;
}
counter.count = 0;

console.log('counter():', counter()); // 1
console.log('counter():', counter()); // 2
console.log('counter():', counter()); // 3
console.log('counter.count:', counter.count); // 3

console.log('\n=== Memoization Example ===');

function fibonacci(n) {
    // Initialize cache if it doesn't exist
    if (!fibonacci.cache) {
        fibonacci.cache = { 0: 0, 1: 1 };
        console.log('  Cache initialized');
    }

    // Check cache first
    if (fibonacci.cache[n] !== undefined) {
        console.log(`  Cache hit for fib(${n})`);
        return fibonacci.cache[n];
    }

    console.log(`  Computing fib(${n})`);
    const result = fibonacci(n - 1) + fibonacci(n - 2);
    fibonacci.cache[n] = result;
    return result;
}

console.log('fibonacci(5):', fibonacci(5));
console.log('\nfibonacci(6):');
console.log(fibonacci(6)); // Notice fewer computations due to cache
console.log('\nFibonacci cache:', fibonacci.cache);

console.log('\n=== Configuration Object Pattern ===');

function ajax(url, options) {
    const defaults = ajax.defaults || {};
    const config = { ...defaults, ...options };
    console.log(`  Request to: ${url}`);
    console.log(`  Method: ${config.method}`);
    console.log(`  Headers: ${JSON.stringify(config.headers)}`);
}

// Set default configuration
ajax.defaults = {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
};

console.log('Using defaults:');
ajax('/api/users');

console.log('\nOverriding defaults:');
ajax('/api/users', { method: 'POST' });

console.log('\n=== toString() Method ===');

function add(a, b) {
    return a + b;
}

console.log('add.toString():');
console.log(add.toString());

// Native functions
console.log('\nArray.prototype.push.toString():');
console.log(Array.prototype.push.toString());

console.log('\n=== Function as Namespace ===');

function MathUtils() { }

MathUtils.PI = 3.14159;
MathUtils.add = function (a, b) { return a + b; };
MathUtils.multiply = function (a, b) { return a * b; };
MathUtils.square = function (x) { return x * x; };

console.log('MathUtils.PI:', MathUtils.PI);
console.log('MathUtils.add(3, 4):', MathUtils.add(3, 4));
console.log('MathUtils.square(5):', MathUtils.square(5));

console.log('\n=== Comparing Functions ===');

function func1() { return 1; }
function func2() { return 1; }

console.log('func1 === func2:', func1 === func2); // false (different objects)

const ref1 = func1;
const ref2 = func1;
console.log('ref1 === ref2:', ref1 === ref2); // true (same reference)

console.log('\n=== Function Properties are Mutable ===');

function test() { }
test.value = "original";

const copy = test;
copy.value = "modified";

console.log('test.value:', test.value);   // "modified"
console.log('copy.value:', copy.value);   // "modified"
console.log('test === copy:', test === copy); // true (same function object)

console.log('\n=== Property Descriptors ===');

function myFunction() { }
myFunction.customProp = 42;

const descriptor = Object.getOwnPropertyDescriptor(myFunction, 'customProp');
console.log('Property descriptor:', descriptor);
// { value: 42, writable: true, enumerable: true, configurable: true }

// Length is read-only
const lengthDescriptor = Object.getOwnPropertyDescriptor(myFunction, 'length');
console.log('Length descriptor:', lengthDescriptor);
// { value: 0, writable: false, enumerable: false, configurable: true }

console.log('\n=== Practical Example: Event Emitter ===');

function EventEmitter() {
    this.events = {};
}

EventEmitter.prototype.on = function (event, listener) {
    if (!this.events[event]) {
        this.events[event] = [];
    }
    this.events[event].push(listener);
};

EventEmitter.prototype.emit = function (event, ...args) {
    if (!this.events[event]) return;
    this.events[event].forEach(listener => listener(...args));
};

// Add metadata to the function
EventEmitter.version = '1.0.0';
EventEmitter.description = 'Simple event emitter';

const emitter = new EventEmitter();

emitter.on('greet', (name) => {
    console.log(`  Hello, ${name}!`);
});

console.log('EventEmitter metadata:');
console.log(`  Version: ${EventEmitter.version}`);
console.log(`  Description: ${EventEmitter.description}`);

console.log('\nEmitting greet event:');
emitter.emit('greet', 'Alice');
