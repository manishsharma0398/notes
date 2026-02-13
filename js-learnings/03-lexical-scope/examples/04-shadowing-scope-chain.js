/**
 * Example 4: Shadowing and Scope Chain
 * Demonstrates how inner scopes can shadow outer scopes
 */

console.log("=== Example 4: Shadowing and Scope Chain ===\n");

// SCENARIO 1: Simple shadowing
console.log("--- Simple Shadowing ---");

let x = "global";

function outer() {
    let x = "outer";
    console.log("In outer, x:", x);  // "outer"

    function inner() {
        let x = "inner";
        console.log("In inner, x:", x);  // "inner"
    }

    inner();
    console.log("Back in outer, x:", x);  // "outer"
}

outer();
console.log("In global, x:", x);  // "global"

/**
 * SCOPE CHAIN LOOKUP:
 * 
 * When inner() accesses x:
 * 1. Check inner()'s scope → { x: "inner" } → FOUND! Stop here.
 * 
 * The scope chain doesn't continue to outer() or global
 * because x was found in the first scope checked.
 * 
 * This is SHADOWING: inner's x "shadows" (hides) outer's x.
 * 
 * Each scope has its own x variable.
 * They don't interfere with each other.
 */

// SCENARIO 2: Partial shadowing
console.log("\n--- Partial Shadowing ---");

let a = "global a";
let b = "global b";

function test() {
    let a = "local a";  // Shadows global a
    // b is NOT shadowed

    console.log("a:", a);  // "local a" (local shadows global)
    console.log("b:", b);  // "global b" (no local b, uses global)
}

test();

/**
 * SCOPE CHAIN LOOKUP:
 * 
 * For a:
 * 1. Check test()'s scope → { a: "local a" } → FOUND!
 * 
 * For b:
 * 1. Check test()'s scope → { a: "local a" } → NOT FOUND
 * 2. Check global scope → { a: "global a", b: "global b" } → FOUND!
 * 
 * Only a is shadowed. b uses the global value.
 */

// SCENARIO 3: Shadowing with parameters
console.log("\n--- Shadowing with Parameters ---");

let value = "global value";

function process(value) {
    // Parameter 'value' shadows global 'value'
    console.log("Parameter value:", value);

    value = "modified";
    console.log("Modified parameter:", value);
}

process("argument value");
console.log("Global value unchanged:", value);

/**
 * Parameters create variables in the function scope.
 * The parameter 'value' shadows the global 'value'.
 * 
 * Modifying the parameter doesn't affect the global variable.
 */

// SCENARIO 4: TDZ + Shadowing
console.log("\n--- TDZ + Shadowing ---");

let y = "outer y";

function tdz() {
    // Uncommenting this line causes ReferenceError:
    // console.log(y);  // Cannot access 'y' before initialization

    // Even though there's an outer y, the inner y is in TDZ here
    let y = "inner y";

    console.log("After declaration, y:", y);
}

tdz();

/**
 * CRITICAL INSIGHT:
 * 
 * The inner 'let y' creates a NEW binding that shadows outer y.
 * This shadowing happens IMMEDIATELY at the start of the scope,
 * even before the declaration line.
 * 
 * So accessing y before 'let y' doesn't find outer y,
 * it finds the inner y which is in TDZ → ReferenceError.
 * 
 * Scope chain:
 * 1. Check tdz() scope → { y: <uninitialized> } → FOUND but in TDZ!
 * 
 * It never checks the outer scope because a y exists (in TDZ) locally.
 */

// SCENARIO 5: Scope chain with multiple levels
console.log("\n--- Multi-Level Scope Chain ---");

let level = "global";

function level1() {
    let level = "level1";

    function level2() {
        // No local 'level' here

        function level3() {
            let level = "level3";

            console.log("In level3, level:", level);
        }

        console.log("In level2, level:", level);  // Uses level1's level
        level3();
    }

    console.log("In level1, level:", level);
    level2();
}

level1();

/**
 * SCOPE CHAIN VISUALIZATION:
 * 
 * level3() looking for 'level':
 * 1. Check level3 scope → { level: "level3" } → FOUND!
 * 
 * level2() looking for 'level':
 * 1. Check level2 scope → { level3: <function> } → NOT FOUND
 * 2. Check level1 scope → { level: "level1", level2: <function> } → FOUND!
 * 
 * Each function finds the CLOSEST 'level' in its scope chain.
 */

// SCENARIO 6: Cannot "unshadow"
console.log("\n--- Cannot Unshadow ---");

let config = "global config";

function setup() {
    let config = "local config";

    // No direct way to access global config here
    console.log("Local config:", config);

    // These won't work in a general way:
    // - window.config only works in browser for var declarations
    // - globalThis.config won't work for let/const

    // Best practice: use different names or pass as parameters
}

setup();

/**
 * KEY TAKEAWAY:
 * 
 * Once a variable is shadowed, the outer variable is UNREACHABLE
 * from that scope (with some browser-specific exceptions).
 * 
 * Solution: Don't shadow if you need both variables.
 * Use different names.
 */

console.log("\n=== Shadowing Summary ===");
console.log("✓ Inner scope can have same-named variables as outer");
console.log("✓ Inner variables shadow (hide) outer variables");
console.log("✓ Scope chain stops at first match");
console.log("✓ Shadowing + TDZ can cause unexpected errors");
console.log("✓ Parameters can shadow outer variables");
console.log("✓ Once shadowed, outer variable is generally unreachable");
