/**
 * Example 2: Execution Context Phases
 * Demonstrates Creation Phase vs Execution Phase
 */

console.log("=== Example 2: Execution Context Phases ===\n");

function demonstratePhases(param1, param2) {
    console.log("\n--- Inside demonstratePhases ---");

    // At this point, we're in the EXECUTION phase
    // But let's see what was available during CREATION phase

    console.log("param1:", param1);           // Available (from arguments)
    console.log("param2:", param2);           // Available (from arguments)
    console.log("varVariable:", varVariable); // undefined (hoisted, initialized)

    // These will throw ReferenceError if uncommented (TDZ):
    // console.log("letVariable:", letVariable);
    // console.log("constVariable:", constVariable);

    console.log("declaredFunc:", declaredFunc);  // Full function (hoisted)

    // These will be undefined if uncommented:
    // console.log("expressedFunc:", expressedFunc);

    // Now assign values (EXECUTION phase)
    var varVariable = "var value";
    let letVariable = "let value";
    const constVariable = "const value";

    function declaredFunc() {
        return "I'm a declared function";
    }

    var expressedFunc = function () {
        return "I'm an expressed function";
    };

    console.log("\n--- After assignments ---");
    console.log("varVariable:", varVariable);
    console.log("letVariable:", letVariable);
    console.log("constVariable:", constVariable);
    console.log("declaredFunc():", declaredFunc());
    console.log("expressedFunc():", expressedFunc());
}

demonstratePhases("arg1", "arg2");

/**
 * DETAILED PHASE BREAKDOWN:
 * 
 * ═══════════════════════════════════════════════════════════════
 * CREATION PHASE (happens BEFORE any code in the function runs)
 * ═══════════════════════════════════════════════════════════════
 * 
 * Step 1: Create Variable Environment
 * {
 *   arguments: { 0: "arg1", 1: "arg2", length: 2 },
 *   param1: "arg1",
 *   param2: "arg2",
 *   varVariable: undefined,              ← var hoisted, initialized
 *   letVariable: <uninitialized>,        ← let hoisted, NOT initialized (TDZ)
 *   constVariable: <uninitialized>,      ← const hoisted, NOT initialized (TDZ)
 *   declaredFunc: <function>,            ← function declaration fully hoisted
 *   expressedFunc: undefined             ← var, so undefined
 * }
 * 
 * Step 2: Set up Lexical Environment (reference to outer scope)
 * - Points to Global Execution Context
 * 
 * Step 3: Determine `this` binding
 * - In this case: global object (or undefined in strict mode)
 * 
 * ═══════════════════════════════════════════════════════════════
 * EXECUTION PHASE (code runs line by line)
 * ═══════════════════════════════════════════════════════════════
 * 
 * Line 10: console.log - executes
 * Line 15: console.log param1 - "arg1" (already available from creation phase)
 * Line 16: console.log param2 - "arg2" (already available from creation phase)
 * Line 17: console.log varVariable - "undefined" (hoisted but not assigned yet)
 * 
 * Line 25: varVariable = "var value" - NOW assigned
 * Variable Environment updated:
 * { ...previous, varVariable: "var value" }
 * 
 * Line 26: letVariable = "let value" - Exits TDZ, assigned
 * Variable Environment updated:
 * { ...previous, letVariable: "let value" }
 * 
 * Line 27: constVariable = "const value" - Exits TDZ, assigned
 * Variable Environment updated:
 * { ...previous, constVariable: "const value" }
 * 
 * Line 29-31: Function already exists from creation phase (no change)
 * 
 * Line 33-35: expressedFunc assigned function object
 * Variable Environment updated:
 * { ...previous, expressedFunc: <function> }
 * 
 * KEY INSIGHTS:
 * 
 * 1. Creation phase sets up the "skeleton" of the execution context
 * 2. var and function declarations are "ready to use" immediately
 * 3. let/const exist but are in TDZ until their declaration line executes
 * 4. Parameters are treated like local variables (available immediately)
 * 5. The arguments object is created during creation phase
 */

console.log("\n=== Key Difference ===");
console.log("CREATION: Memory allocated, declarations registered");
console.log("EXECUTION: Values assigned, code runs");
