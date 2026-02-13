/**
 * Example 4: Function Declarations vs Expressions
 * Shows the critical difference in how they're compiled and executed
 */

console.log("=== Example 4: Function Declaration vs Expression ===\n");

// SCENARIO 1: Function Declaration
console.log("--- Function Declaration ---");
declaredFunc();  // Works!

function declaredFunc() {
    console.log("I'm a declared function");
}

/**
 * COMPILATION:
 * - 'declaredFunc' is registered in scope
 * - The entire function object is created and stored
 * 
 * Memory after compilation:
 * {
 *   declaredFunc: <function object with full body>
 * }
 * 
 * EXECUTION:
 * - Line 10: Calls declaredFunc → already exists → executes
 * - Line 12-14: Already compiled, nothing to do
 */

// SCENARIO 2: Function Expression with var
console.log("\n--- Function Expression (var) ---");
try {
    expressedFuncVar();  // TypeError: expressedFuncVar is not a function
} catch (e) {
    console.log("Error:", e.message);
}

var expressedFuncVar = function () {
    console.log("I'm an expressed function (var)");
};

expressedFuncVar();  // Now it works

/**
 * COMPILATION:
 * - 'expressedFuncVar' is registered in scope
 * - Initialized to undefined
 * 
 * Memory after compilation:
 * {
 *   expressedFuncVar: undefined
 * }
 * 
 * EXECUTION:
 * - Line 37: Tries to call expressedFuncVar()
 *   → expressedFuncVar is undefined
 *   → undefined() causes TypeError
 * - Line 42: expressedFuncVar is assigned the function object
 * 
 * Memory after line 42:
 * {
 *   expressedFuncVar: <function object>
 * }
 * 
 * - Line 46: Now expressedFuncVar is a function → executes successfully
 */

// SCENARIO 3: Function Expression with const
console.log("\n--- Function Expression (const) ---");
try {
    expressedFuncConst();  // ReferenceError: Cannot access before initialization
} catch (e) {
    console.log("Error:", e.message);
}

const expressedFuncConst = function () {
    console.log("I'm an expressed function (const)");
};

expressedFuncConst();  // Now it works

/**
 * COMPILATION:
 * - 'expressedFuncConst' is registered in scope
 * - Marked as <uninitialized> (Temporal Dead Zone)
 * 
 * Memory after compilation:
 * {
 *   expressedFuncConst: <uninitialized>
 * }
 * 
 * EXECUTION:
 * - Line 67: Tries to access expressedFuncConst
 *   → Still in TDZ → ReferenceError
 * - Line 72: expressedFuncConst exits TDZ, assigned function object
 * 
 * Memory after line 72:
 * {
 *   expressedFuncConst: <function object>
 * }
 * 
 * - Line 76: expressedFuncConst is now a function → executes successfully
 */

// SCENARIO 4: Named Function Expression
console.log("\n--- Named Function Expression ---");

const namedExpr = function myFunc() {
    console.log("I'm a named function expression");
    console.log("My name is:", myFunc.name);
};

namedExpr();  // Works
console.log("namedExpr.name:", namedExpr.name);  // "myFunc"

try {
    myFunc();  // ReferenceError: myFunc is not defined
} catch (e) {
    console.log("Error:", e.message);
}

/**
 * KEY INSIGHT:
 * - The name 'myFunc' is only available INSIDE the function
 * - Outside, only 'namedExpr' exists
 * 
 * COMPILATION:
 * Global scope:
 * {
 *   namedExpr: <uninitialized>
 * }
 * 
 * Function's internal scope:
 * {
 *   myFunc: <reference to itself>
 * }
 * 
 * WHY: Named function expressions create their own scope
 * where the name refers to the function itself (useful for recursion)
 */

// SCENARIO 5: Arrow Functions
console.log("\n--- Arrow Functions ---");

try {
    arrowFunc();  // ReferenceError
} catch (e) {
    console.log("Error:", e.message);
}

const arrowFunc = () => {
    console.log("I'm an arrow function");
};

arrowFunc();  // Works

/**
 * Arrow functions behave EXACTLY like const function expressions
 * - Registered during compilation
 * - Stay in TDZ until assignment
 * - Same hoisting behavior as const
 */

console.log("\n=== SUMMARY ===");
console.log("✓ Function declarations: fully hoisted (name + body)");
console.log("✓ Function expressions (var): hoisted name, undefined value");
console.log("✓ Function expressions (let/const): hoisted name, TDZ until assignment");
console.log("✓ Arrow functions: same as const expressions");
