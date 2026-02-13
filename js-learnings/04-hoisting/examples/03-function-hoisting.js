/**
 * Example 3: Function Hoisting
 * Demonstrates the difference between function declarations and expressions
 */

console.log("=== Example 3: Function Hoisting ===\n");

// SCENARIO 1: Function Declaration (fully hoisted)
console.log("--- Function Declaration ---");

greet("World");  // Works! "Hello, World"

function greet(name) {
    console.log(`Hello, ${name}`);
}

greet("JavaScript");  // Also works

/**
 * COMPILATION PHASE:
 * 
 * Scope registry:
 * {
 *   greet: <full function object>  ← Entire function hoisted
 * }
 * 
 * The function declaration is FULLY hoisted:
 * - Name: greet
 * - Body: the entire function
 * 
 * You can call it BEFORE its declaration in the code.
 */

// SCENARIO 2: Function Expression with var
console.log("\n--- Function Expression (var) ---");

try {
    sayHello();  // TypeError: sayHello is not a function
} catch (e) {
    console.log("Error:", e.message);
}

var sayHello = function () {
    console.log("Hello from expression");
};

sayHello();  // Now it works

/**
 * COMPILATION PHASE:
 * 
 * Scope registry:
 * {
 *   sayHello: undefined  ← Variable hoisted, NOT the function
 * }
 * 
 * EXECUTION:
 * 
 * Line 36: sayHello()
 * - sayHello is undefined
 * - undefined() → TypeError
 * 
 * Line 41: sayHello = function() {...}
 * - Now sayHello is the function
 * 
 * Line 45: sayHello()
 * - Works!
 * 
 * Only the VARIABLE NAME is hoisted (as undefined).
 * The FUNCTION itself is NOT hoisted.
 */

// SCENARIO 3: Function Expression with const
console.log("\n--- Function Expression (const) ---");

try {
    greetUser();  // ReferenceError: Cannot access before initialization
} catch (e) {
    console.log("Error:", e.message);
}

const greetUser = function () {
    console.log("Greetings, user!");
};

greetUser();  // Works

/**
 * COMPILATION:
 * {
 *   greetUser: <uninitialized>  ← TDZ
 * }
 * 
 * Like any const, it's in TDZ until the declaration line.
 */

// SCENARIO 4: Arrow Function
console.log("\n--- Arrow Function ---");

try {
    arrowGreet();  // ReferenceError
} catch (e) {
    console.log("Error:", e.message);
}

const arrowGreet = () => {
    console.log("Arrow function hello");
};

arrowGreet();  // Works

/**
 * Arrow functions behave EXACTLY like const expressions.
 * Variable name is hoisted (in TDZ).
 * Function is NOT hoisted.
 */

// SCENARIO 5: Named Function Expression
console.log("\n--- Named Function Expression ---");

const myFunc = function namedFunc() {
    console.log("I'm a named function expression");
    console.log("My name is:", namedFunc.name);
    // 'namedFunc' is ONLY available inside the function
};

myFunc();  // Works

try {
    namedFunc();  // ReferenceError: namedFunc is not defined
} catch (e) {
    console.log("Error:", e.message);
}

/**
 * KEY INSIGHT:
 * 
 * The name 'namedFunc' is ONLY available INSIDE the function.
 * Outside, only 'myFunc' exists.
 * 
 * This is useful for recursion:
 */

const factorial = function fact(n) {
    if (n <= 1) return 1;
    return n * fact(n - 1);  // Can call itself using 'fact'
};

console.log("factorial(5):", factorial(5));  // 120

// SCENARIO 6: Function Declaration Override
console.log("\n--- Function vs var with Same Name ---");

console.log("typeof foo:", typeof foo);  // "function"

var foo = "I'm a variable";

function foo() {
    return "I'm a function";
}

console.log("typeof foo after var:", typeof foo);  // "string"

/**
 * COMPILATION:
 * 
 * 1. See var foo → Register foo: undefined
 * 2. See function foo → Register foo: <function>
 * 
 * Function declarations OVERRIDE var declarations during compilation.
 * 
 * After compilation:
 * {
 *   foo: <function>  ← Function wins
 * }
 * 
 * EXECUTION:
 * 
 * Line 145: typeof foo → "function" (compilation result)
 * Line 147: foo = "I'm a variable" → Reassign to string
 * Line 153: typeof foo → "string" (execution reassignment)
 */

// SCENARIO 7: Multiple Function Declarations (Last Wins)
console.log("\n--- Multiple Function Declarations ---");

function multi() {
    return "first";
}

function multi() {
    return "second";
}

function multi() {
    return "third";
}

console.log("multi():", multi());  // "third"

/**
 * All three declarations are hoisted.
 * The LAST one wins (overwrites the previous ones).
 * 
 * This is valid (no error) but confusing.
 * Avoid redeclaring functions!
 */

console.log("\n=== Function Hoisting Summary ===");
console.log("✓ Function declarations: fully hoisted (name + body)");
console.log("✓ Function expressions: variable hoisted, function not");
console.log("✓ var expression: hoisted as undefined");
console.log("✓ const/let expression: hoisted in TDZ");
console.log("✓ Arrow functions: same as const/let expressions");
console.log("✓ Function declarations override var in compilation");
