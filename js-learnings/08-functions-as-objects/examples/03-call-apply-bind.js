// Example 3: call, apply, and bind
// Demonstrates: Explicit this binding and argument handling

console.log('=== Function.prototype.call() ===');

function greet(greeting, punctuation) {
    return `${greeting}, ${this.name}${punctuation}`;
}

const person1 = { name: "Alice" };
const person2 = { name: "Bob" };

console.log('greet.call(person1, "Hello", "!"):',
    greet.call(person1, "Hello", "!"));

console.log('greet.call(person2, "Hi", "."):',
    greet.call(person2, "Hi", "."));

// Without call (this is undefined in strict mode, global in non-strict)
console.log('\nWithout explicit binding:');
try {
    console.log('greet("Hey", "?"):', greet("Hey", "?"));
} catch (e) {
    console.log('Error:', e.message);
}

console.log('\n=== Function.prototype.apply() ===');

function sum(a, b, c) {
    console.log(`  this.multiplier: ${this.multiplier}`);
    return (a + b + c) * this.multiplier;
}

const context = { multiplier: 2 };

const args = [1, 2, 3];
console.log('sum.apply(context, [1, 2, 3]):', sum.apply(context, args));

// Difference: call takes arguments separately, apply takes array
console.log('\nComparing call vs apply:');
console.log('  call(context, 1, 2, 3):', sum.call(context, 1, 2, 3));
console.log('  apply(context, [1, 2, 3]):', sum.apply(context, [1, 2, 3]));

console.log('\n=== Practical: Finding Max with apply ===');

const numbers = [5, 2, 9, 1, 7];

// Math.max doesn't take an array, but apply can spread it
const max = Math.max.apply(null, numbers);
console.log('Max of [5, 2, 9, 1, 7]:', max);

// Modern alternative: spread operator
console.log('Using spread:', Math.max(...numbers));

console.log('\n=== Function.prototype.bind() ===');

const user = {
    name: "Charlie",
    greet() {
        return `Hello, I'm ${this.name}`;
    }
};

// Extract method (loses this)
const extracted = user.greet;
console.log('Extracted method:');
try {
    console.log('  extracted():', extracted());
} catch (e) {
    console.log('  Error:', e.message);
}

// Bind creates new function with fixed this
const bound = user.greet.bind(user);
console.log('\nBound method:');
console.log('  bound():', bound());

// Bound function is a NEW function
console.log('\nbound === user.greet:', bound === user.greet); // false
console.log('bound === user.greet.bind(user):',
    bound === user.greet.bind(user)); // false (each bind creates new)

console.log('\n=== Partial Application with bind ===');

function multiply(a, b, c) {
    return a * b * c;
}

// Pre-fill first argument
const double = multiply.bind(null, 2);
console.log('double(3, 4):', double(3, 4)); // 2 * 3 * 4 = 24

// Pre-fill first two arguments
const doubleThenTriple = multiply.bind(null, 2, 3);
console.log('doubleThenTriple(4):', doubleThenTriple(4)); // 2 * 3 * 4 = 24

console.log('\n=== Event Handler Pattern ===');

const button = {
    clicks: 0,
    handleClick() {
        this.clicks++;
        console.log(`  Clicked ${this.clicks} times`);
    },

    attachListener() {
        // In real code, this would be: element.addEventListener('click', ...)
        // Simulating with setTimeout

        // Wrong: loses this
        // setTimeout(this.handleClick, 100);

        // Correct: bind this
        setTimeout(this.handleClick.bind(this), 100);
    }
};

console.log('Simulating button click:');
button.attachListener();

// Wait for setTimeout
setTimeout(() => {
    console.log('Final clicks:', button.clicks);
}, 200);

console.log('\n=== Method Borrowing ===');

const arrayLike = {
    0: 'a',
    1: 'b',
    2: 'c',
    length: 3
};

// Borrow array methods
const result = Array.prototype.slice.call(arrayLike);
console.log('Array.prototype.slice.call(arrayLike):', result);

const joined = Array.prototype.join.call(arrayLike, '-');
console.log('Array.prototype.join.call(arrayLike, "-"):', joined);

// With apply
const args2 = {
    0: 'arg1',
    1: 'arg2',
    length: 2
};
const argsArray = Array.prototype.slice.apply(args2);
console.log('Converting arguments object:', argsArray);

console.log('\n=== Arrow Functions and bind ===');

const obj = {
    name: "David",
    regularMethod: function () {
        return this.name;
    },
    arrowMethod: () => {
        return this.name; // this is NOT obj!
    }
};

console.log('Regular method:', obj.regularMethod());
console.log('Arrow method:', obj.arrowMethod()); // undefined

// bind doesn't work on arrow functions
const boundArrow = obj.arrowMethod.bind(obj);
console.log('Bound arrow (still broken):', boundArrow());

console.log('\n=== Chaining Calls ===');

function log(prefix) {
    console.log(`  ${prefix}: ${this.value}`);
    return this; // Enable chaining
}

const data = { value: 42 };

log.call(data, "First")
    .value++;
log.call(data, "Second");

console.log('\n=== call/apply Performance ===');

function directCall() {
    return "direct";
}

function viaCall() {
    return directCall.call(null);
}

function viaApply() {
    return directCall.apply(null);
}

console.log('All produce same result:');
console.log('  directCall():', directCall());
console.log('  viaCall():', viaCall());
console.log('  viaApply():', viaApply());
console.log('Note: Direct calls are fastest (call/apply have overhead)');

console.log('\n=== Practical: Debounce Function ===');

function debounce(fn, delay) {
    let timeoutId;

    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            fn.apply(this, args); // Preserve this and arguments
        }, delay);
    };
}

const logger = {
    prefix: 'LOG',
    log(message) {
        console.log(`  ${this.prefix}: ${message}`);
    }
};

const debouncedLog = debounce(logger.log, 100);

// Calling with correct this
console.log('Debounced calls:');
debouncedLog.call(logger, 'Message 1');
debouncedLog.call(logger, 'Message 2');
debouncedLog.call(logger, 'Message 3');

// Only last call executes after delay
setTimeout(() => {
    console.log('After debounce delay...');
}, 150);

console.log('\n=== bind with new ===');

function Constructor(value) {
    this.value = value;
}

const BoundConstructor = Constructor.bind(null, 42);

// bind doesn't prevent use as constructor
const instance = new BoundConstructor();
console.log('new BoundConstructor():', instance.value); // 42

console.log('\n=== Multiple Binds ===');

function showThis() {
    return this.value;
}

const obj1 = { value: 1 };
const obj2 = { value: 2 };
const obj3 = { value: 3 };

const bound1 = showThis.bind(obj1);
console.log('bound1():', bound1()); // 1

// Second bind has no effect!
const bound2 = bound1.bind(obj2);
console.log('bound2():', bound2()); // Still 1!

// Once bound, this is locked
const bound3 = bound2.bind(obj3);
console.log('bound3():', bound3()); // Still 1!

console.log('\n=== Summary ===');
console.log('call:   Invokes immediately, args as individual parameters');
console.log('apply:  Invokes immediately, args as array');
console.log('bind:   Returns new function with fixed this, can pre-fill args');
