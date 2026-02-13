/**
 * Example 4: Common Hoisting Traps and Edge Cases
 * Demonstrates subtle hoisting bugs and unexpected behaviors
 */

console.log("=== Example 4: Hoisting Traps ===\n");

// TRAP 1: Shadowing with var in functions
console.log("--- Trap 1: var Shadowing ---");

var message = "global message";

function showMessage() {
    console.log("Message:", message);  // undefined (NOT "global message")
    var message = "local message";
    console.log("Message:", message);  // "local message"
}

showMessage();

/**
 * COMMON BUG!
 * 
 * Developers expect line 13 to log "global message"
 * But it logs undefined.
 * 
 * WHY:
 * var message is hoisted to the top of showMessage()
 * It shadows the global message
 * At line 13, local message exists but is still undefined
 * 
 * FIX: Don't reassign same-named variables, or use let/const
 */

// TRAP 2: Function declaration in blocks (non-strict)
console.log("\n--- Trap 2: Function in Block (NON-strict) ---");

console.log("typeof blockFunc:", typeof blockFunc);  // "undefined" in most engines

if (true) {
    function blockFunc() {
        return "I'm in a block";
    }
}

console.log("typeof blockFunc after if:", typeof blockFunc);  // "function"
console.log("blockFunc():", blockFunc());  // Works

/**
 * WEIRD BEHAVIOR (implementation-dependent):
 * 
 * In non-strict mode, function declarations in blocks have
 * unpredictable hoisting behavior.
 * 
 * Some engines:
 * - Hoist the NAME to function/global scope (as undefined)
 * - Assign the function when block executes
 * 
 * AVOID THIS! Use strict mode or function expressions.
 */

// TRAP 3: Function in block (STRICT mode)
console.log("\n--- Trap 3: Function in Block (strict mode) ---");

(function () {
    'use strict';

    console.log("typeof strictFunc:", typeof strictFunc);  // "undefined"

    if (true) {
        function strictFunc() {
            return "I'm in strict block";
        }
        console.log("Inside block, strictFunc():", strictFunc());  // Works
    }

    try {
        console.log("Outside block, strictFunc():", strictFunc());  // ReferenceError
    } catch (e) {
        console.log("Error:", e.message);
    }
})();

/**
 * In strict mode, function declarations in blocks are BLOCK-SCOPED.
 * Like let/const, they only exist within the block.
 * 
 * This is more predictable. Always use strict mode!
 */

// TRAP 4: Class hoisting (TDZ)
console.log("\n--- Trap 4: Class Hoisting ---");

try {
    const obj = new MyClass();  // ReferenceError
} catch (e) {
    console.log("Error:", e.message);
}

class MyClass {
    constructor() {
        this.value = 42;
    }
}

const obj = new MyClass();
console.log("obj.value:", obj.value);  // 42

/**
 * Classes are hoisted but stay in TDZ (like let/const).
 * Can't use before declaration.
 * 
 * WHY:
 * - Consistency with let/const
 * - Prevents bugs from using uninitialized classes
 */

// TRAP 5: Re-declaration differences
console.log("\n--- Trap 5: Re-declaration ---");

// var allows re-declaration
var x = 1;
var x = 2;  // OK
console.log("var x:", x);  // 2

// let/const don't allow re-declaration
try {
    // let y = 1;
    // let y = 2;  // SyntaxError (this would be caught at parse time)
} catch (e) {
    console.log("This won't run - syntax error happens at parse time");
}

/**
 * var: Allows re-declaration (both are hoisted, later value wins)
 * let/const: Re-declaration is a SYNTAX ERROR (caught at parse time)
 * 
 * let/const are stricter to prevent bugs.
 */

// TRAP 6: Hoisting doesn't cross function boundaries
console.log("\n--- Trap 6: Hoisting Scope Boundaries ---");

function outer() {
    function inner() {
        var innerVar = "inner";
    }

    inner();

    try {
        console.log(innerVar);  // ReferenceError
    } catch (e) {
        console.log("Error:", e.message);
    }
}

outer();

/**
 * Hoisting is PER SCOPE.
 * innerVar is hoisted to inner() scope, not outer() scope.
 * 
 * Each function creates its own scope boundary.
 */

// TRAP 7: Loop variable hoisting
console.log("\n--- Trap 7: Loop Variable Hoisting ---");

console.log("Before loop, i:", typeof i);  // "undefined" (var hoisted)

for (var i = 0; i < 3; i++) {
    // Loop body
}

console.log("After loop, i:", i);  // 3 (leaked out)

/**
 * var i is hoisted to function/global scope (not loop scope).
 * After the loop, i still exists with value 3.
 * 
 * With let, i would be block-scoped:
 */

for (let j = 0; j < 3; j++) {
    // Loop body
}

// console.log("After loop, j:", j);  // ReferenceError

/**
 * let j is block-scoped to the loop.
 * After the loop, j doesn't exist.
 */

// TRAP 8: Default parameter TDZ
console.log("\n--- Trap 8: Default Parameter TDZ ---");

function trapParam(a = b, b = 2) {
    console.log(a, b);
}

try {
    trapParam();  // ReferenceError
} catch (e) {
    console.log("Error:", e.message);
}

/**
 * Parameters are in TDZ until initialized.
 * a = b tries to use b before it's initialized → ReferenceError
 * 
 * FIX: Order parameters correctly or use literals:
 */

function goodParam(a = 1, b = a + 1) {
    console.log("a:", a, "b:", b);
}

goodParam();  // a: 1 b: 2

console.log("\n=== Hoisting Traps Summary ===");
console.log("✓ var shadows outer variables when hoisted");
console.log("✓ Function in blocks: avoid or use strict mode");
console.log("✓ Classes are in TDZ (can't use before declaration)");
console.log("✓ let/const don't allow re-declaration");
console.log("✓ Hoisting is per-scope (doesn't cross functions)");
console.log("✓ var in loops leaks out; let doesn't");
console.log("✓ Parameter defaults can cause TDZ errors");
