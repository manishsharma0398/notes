// Example 1: Functions as First-Class Citizens
// Demonstrates: Functions can be assigned, passed, returned, and stored

console.log('=== 1. Functions Assigned to Variables ===');

const greet = function (name) {
    return `Hello, ${name}!`;
};

console.log('greet("Alice"):', greet("Alice"));
console.log('typeof greet:', typeof greet); // "function"
console.log('greet instanceof Object:', greet instanceof Object); // true

console.log('\n=== 2. Functions Passed as Arguments ===');

function executeCallback(callback, value) {
    console.log('  Executing callback...');
    return callback(value);
}

function double(x) {
    return x * 2;
}

console.log('executeCallback(double, 5):', executeCallback(double, 5));

// Anonymous function as argument
const result = executeCallback(function (x) {
    return x + 10;
}, 5);
console.log('executeCallback(anonymous, 5):', result);

// Arrow function as argument
console.log('executeCallback(arrow, 5):', executeCallback(x => x * x, 5));

console.log('\n=== 3. Functions Returned from Functions ===');

function createMultiplier(factor) {
    return function (number) {
        return number * factor;
    };
}

const triple = createMultiplier(3);
const quadruple = createMultiplier(4);

console.log('triple(5):', triple(5));       // 15
console.log('quadruple(5):', quadruple(5)); // 20

// Each returned function is independent
console.log('triple === quadruple:', triple === quadruple); // false

console.log('\n=== 4. Functions Stored in Data Structures ===');

const mathOperations = {
    add: function (a, b) { return a + b; },
    subtract: function (a, b) { return a - b; },
    multiply: function (a, b) { return a * b; },
    divide: function (a, b) { return a / b; }
};

console.log('mathOperations.add(5, 3):', mathOperations.add(5, 3));
console.log('mathOperations.multiply(4, 7):', mathOperations.multiply(4, 7));

// Functions in arrays
const filters = [
    x => x > 10,
    x => x % 2 === 0,
    x => x < 100
];

const numbers = [5, 15, 20, 150, 30];
console.log('\nFiltering [5, 15, 20, 150, 30]:');
console.log('  > 10:', numbers.filter(filters[0]));
console.log('  even:', numbers.filter(filters[1]));
console.log('  < 100:', numbers.filter(filters[2]));

console.log('\n=== 5. Functions are Objects ===');

function myFunction() {
    return "I'm a function!";
}

// Add properties to function (because it's an object!)
myFunction.customProperty = "I'm attached to the function";
myFunction.counter = 0;
myFunction.incrementCounter = function () {
    this.counter++;
};

console.log('myFunction():', myFunction());
console.log('myFunction.customProperty:', myFunction.customProperty);
console.log('myFunction.counter:', myFunction.counter);

myFunction.incrementCounter();
myFunction.incrementCounter();
console.log('After incrementing:', myFunction.counter);

console.log('\n=== 6. Higher-Order Functions ===');

// Function that takes a function and returns a function
function withLogging(fn) {
    return function (...args) {
        console.log(`  Called with args: [${args}]`);
        const result = fn(...args);
        console.log(`  Result: ${result}`);
        return result;
    };
}

function add(a, b) {
    return a + b;
}

const loggedAdd = withLogging(add);
console.log('\nloggedAdd(3, 7):');
const sum = loggedAdd(3, 7);
console.log('Returned:', sum);

console.log('\n=== 7. Function Composition ===');

function compose(...fns) {
    return function (value) {
        return fns.reduceRight((acc, fn) => fn(acc), value);
    };
}

const addOne = x => x + 1;
const double = x => x * 2;
const square = x => x * x;

const composed = compose(square, double, addOne);
console.log('compose(square, double, addOne)(3):');
console.log('  3 + 1 = 4');
console.log('  4 * 2 = 8');
console.log('  8 * 8 = 64');
console.log('  Result:', composed(3));

console.log('\n=== 8. Partial Application ===');

function multiply(a, b, c) {
    return a * b * c;
}

function partial(fn, ...fixedArgs) {
    return function (...remainingArgs) {
        return fn(...fixedArgs, ...remainingArgs);
    };
}

const multiplyByTwo = partial(multiply, 2);
console.log('multiplyByTwo(3, 4):', multiplyByTwo(3, 4)); // 2 * 3 * 4 = 24

const multiplyByTwoAndThree = partial(multiply, 2, 3);
console.log('multiplyByTwoAndThree(4):', multiplyByTwoAndThree(4)); // 2 * 3 * 4 = 24

console.log('\n=== 9. Callback Patterns ===');

function asyncSimulation(value, callback) {
    console.log(`  Processing ${value}...`);
    // Simulate async operation
    setTimeout(() => callback(value * 2), 0);
}

console.log('Async callback example:');
asyncSimulation(5, function (result) {
    console.log(`  Callback received: ${result}`);
});

console.log('\n=== 10. IIFE (Immediately Invoked Function Expression) ===');

const result1 = (function (name) {
    return `Hello from IIFE, ${name}!`;
})("World");

console.log('IIFE result:', result1);

// Creating private scope
const counter = (function () {
    let count = 0; // Private variable

    return {
        increment() {
            count++;
            return count;
        },
        decrement() {
            count--;
            return count;
        },
        getCount() {
            return count;
        }
    };
})();

console.log('\nCounter module (IIFE pattern):');
console.log('  increment():', counter.increment()); // 1
console.log('  increment():', counter.increment()); // 2
console.log('  decrement():', counter.decrement()); // 1
console.log('  getCount():', counter.getCount());   // 1
// console.log('  count:', counter.count);          // undefined (private!)
