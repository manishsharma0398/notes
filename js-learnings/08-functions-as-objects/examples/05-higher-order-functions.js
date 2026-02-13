// Example 5: Higher-Order Functions
// Demonstrates: Functions that operate on other functions

console.log('=== Functions that Accept Functions ===');

function repeat(n, action) {
    for (let i = 0; i < n; i++) {
        action(i);
    }
}

console.log('repeat(3, console.log):');
repeat(3, (i) => console.log(`  Iteration ${i}`));

console.log('\n=== Array Methods (Built-in Higher-Order Functions) ===');

const numbers = [1, 2, 3, 4, 5];

// map: transform each element
const doubled = numbers.map(x => x * 2);
console.log('map(x => x * 2):', doubled);

// filter: select elements
const evens = numbers.filter(x => x % 2 === 0);
console.log('filter(x => x % 2 === 0):', evens);

// reduce: accumulate
const sum = numbers.reduce((acc, x) => acc + x, 0);
console.log('reduce((acc, x) => acc + x, 0):', sum);

// forEach: side effects
console.log('forEach((x, i) => ...):');
numbers.forEach((x, i) => console.log(`  [${i}]: ${x}`));

console.log('\n=== Creating Custom map ===');

function map(array, transform) {
    const result = [];
    for (let element of array) {
        result.push(transform(element));
    }
    return result;
}

const squared = map([1, 2, 3, 4], x => x * x);
console.log('Custom map:', squared);

console.log('\n=== Creating Custom filter ===');

function filter(array, predicate) {
    const result = [];
    for (let element of array) {
        if (predicate(element)) {
            result.push(element);
        }
    }
    return result;
}

const greaterThanTwo = filter([1, 2, 3, 4, 5], x => x > 2);
console.log('Custom filter:', greaterThanTwo);

console.log('\n=== Creating Custom reduce ===');

function reduce(array, reducer, initial) {
    let accumulator = initial;
    for (let element of array) {
        accumulator = reducer(accumulator, element);
    }
    return accumulator;
}

const product = reduce([1, 2, 3, 4], (acc, x) => acc * x, 1);
console.log('Custom reduce:', product);

console.log('\n=== Function that Returns Function ===');

function createMultiplier(factor) {
    return function (number) {
        return number * factor;
    };
}

const times5 = createMultiplier(5);
const times10 = createMultiplier(10);

console.log('times5(3):', times5(3));   // 15
console.log('times10(3):', times10(3)); // 30

console.log('\n=== Function Composition ===');

function compose(f, g) {
    return function (x) {
        return f(g(x));
    };
}

const addOne = x => x + 1;
const double = x => x * 2;

const doubleThenAddOne = compose(addOne, double);
console.log('doubleThenAddOne(5):', doubleThenAddOne(5)); // (5 * 2) + 1 = 11

const addOneThenDouble = compose(double, addOne);
console.log('addOneThenDouble(5):', addOneThenDouble(5)); // (5 + 1) * 2 = 12

console.log('\n=== Pipe (Left-to-Right Composition) ===');

function pipe(...fns) {
    return function (value) {
        return fns.reduce((acc, fn) => fn(acc), value);
    };
}

const addTwo = x => x + 2;
const triple = x => x * 3;
const subtract = x => x - 1;

const pipeline = pipe(addTwo, triple, subtractOne);
console.log('pipe(addTwo, triple, subtract)(5):');
console.log('  5 + 2 = 7');
console.log('  7 * 3 = 21');
console.log('  21 - 1 = 20');
console.log('  Result:', pipeline(5));

console.log('\n=== Currying ===');

// Regular function
function add(a, b, c) {
    return a + b + c;
}

// Curried version
function curriedAdd(a) {
    return function (b) {
        return function (c) {
            return a + b + c;
        };
    };
}

console.log('add(1, 2, 3):', add(1, 2, 3));
console.log('curriedAdd(1)(2)(3):', curriedAdd(1)(2)(3));

// Partial application
const add1 = curriedAdd(1);
const add1And2 = add1(2);
console.log('Partial: add1And2(3):', add1And2(3));

console.log('\n=== Generic Curry Function ===');

function curry(fn) {
    return function curried(...args) {
        if (args.length >= fn.length) {
            return fn.apply(this, args);
        } else {
            return function (...args2) {
                return curried.apply(this, args.concat(args2));
            };
        }
    };
}

function multiply(a, b, c) {
    return a * b * c;
}

const curriedMultiply = curry(multiply);
console.log('curriedMultiply(2)(3)(4):', curriedMultiply(2)(3)(4));
console.log('curriedMultiply(2, 3)(4):', curriedMultiply(2, 3)(4));
console.log('curriedMultiply(2, 3, 4):', curriedMultiply(2, 3, 4));

console.log('\n=== Memoization ===');

function memoize(fn) {
    const cache = new Map();

    return function (...args) {
        const key = JSON.stringify(args);

        if (cache.has(key)) {
            console.log(`  Cache hit for: ${key}`);
            return cache.get(key);
        }

        console.log(`  Computing for: ${key}`);
        const result = fn.apply(this, args);
        cache.set(key, result);
        return result;
    };
}

function slowSquare(x) {
    // Simulate slow operation
    return x * x;
}

const fastSquare = memoize(slowSquare);

console.log('fastSquare(5):', fastSquare(5));
console.log('fastSquare(5) again:', fastSquare(5));
console.log('fastSquare(6):', fastSquare(6));

console.log('\n=== Throttle Function ===');

function throttle(fn, delay) {
    let lastCall = 0;

    return function (...args) {
        const now = Date.now();
        if (now - lastCall < delay) {
            console.log('  Throttled (too soon)');
            return;
        }
        lastCall = now;
        return fn.apply(this, args);
    };
}

const throttledLog = throttle((msg) => console.log(`  ${msg}`), 100);

console.log('Calling throttled function:');
throttledLog('Call 1');
throttledLog('Call 2'); // Throttled
setTimeout(() => throttledLog('Call 3'), 50);  // Throttled
setTimeout(() => throttledLog('Call 4'), 150); // Executes

console.log('\n=== Once Function ===');

function once(fn) {
    let called = false;
    let result;

    return function (...args) {
        if (!called) {
            called = true;
            result = fn.apply(this, args);
        }
        return result;
    };
}

const initialize = once(() => {
    console.log('  Initializing...');
    return 'initialized';
});

console.log('First call:', initialize());
console.log('Second call:', initialize());
console.log('Third call:', initialize());

console.log('\n=== Decorator Pattern ===');

function withLogging(fn) {
    return function (...args) {
        console.log(`  Calling ${fn.name} with:`, args);
        const result = fn.apply(this, args);
        console.log(`  ${fn.name} returned:`, result);
        return result;
    };
}

function subtract(a, b) {
    return a - b;
}

const loggedSubtract = withLogging(subtract);

console.log('Decorated function:');
const result = loggedSubtract(10, 3);
console.log('Final result:', result);

console.log('\n=== Chaining Operations ===');

function createNumberChain(value) {
    return {
        value,
        add(n) {
            return createNumberChain(this.value + n);
        },
        multiply(n) {
            return createNumberChain(this.value * n);
        },
        subtract(n) {
            return createNumberChain(this.value - n);
        },
        result() {
            return this.value;
        }
    };
}

const chainResult = createNumberChain(5)
    .add(3)
    .multiply(2)
    .subtract(4)
    .result();

console.log('Chain: 5 -> add(3) -> multiply(2) -> subtract(4):', chainResult);

console.log('\n=== Practical: Validation Pipeline ===');

function createValidator(...validators) {
    return function (value) {
        for (let validator of validators) {
            const result = validator(value);
            if (!result.valid) {
                return result;
            }
        }
        return { valid: true };
    };
}

const isNotEmpty = (value) => {
    return value.length > 0
        ? { valid: true }
        : { valid: false, error: 'Cannot be empty' };
};

const isEmail = (value) => {
    return value.includes('@')
        ? { valid: true }
        : { valid: false, error: 'Must be valid email' };
};

const emailValidator = createValidator(isNotEmpty, isEmail);

console.log('emailValidator(""):');
console.log(emailValidator(''));

console.log('emailValidator("test"):');
console.log(emailValidator('test'));

console.log('emailValidator("test@example.com"):');
console.log(emailValidator('test@example.com'));
