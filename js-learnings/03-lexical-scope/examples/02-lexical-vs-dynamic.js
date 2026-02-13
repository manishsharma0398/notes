/**
 * Example 2: Lexical vs Dynamic Scope
 * Demonstrates that JavaScript uses lexical scope, not dynamic scope
 */

console.log("=== Example 2: Lexical vs Dynamic Scope ===\n");

let x = "global x";

function showX() {
    console.log(x);  // Uses lexical scope: looks where showX is DEFINED
}

function caller1() {
    let x = "caller1's x";
    console.log("Calling showX from caller1:");
    showX();  // Logs "global x", NOT "caller1's x"
}

function caller2() {
    let x = "caller2's x";
    console.log("\nCalling showX from caller2:");
    showX();  // Logs "global x", NOT "caller2's x"
}

caller1();
caller2();

/**
 * EXPLANATION:
 * 
 * LEXICAL SCOPE (JavaScript uses this):
 * - Scope determined by WHERE function is DEFINED in source code
 * - showX() is defined at global level
 * - showX() can only access global scope (where it's written)
 * - Doesn't matter WHERE you call it
 * 
 * DYNAMIC SCOPE (JavaScript does NOT use this):
 * - Scope determined by WHERE function is CALLED
 * - showX() would access caller's scope
 * - Would log "caller1's x" when called from caller1
 * - JavaScript doesn't work this way!
 * 
 * WHY LEXICAL SCOPE?
 * 
 * 1. PREDICTABLE: Function behavior doesn't change based on caller
 * 2. OPTIMIZABLE: Engine knows scope chain at compile time
 * 3. SAFER: Functions can't accidentally access caller's variables
 * 4. ENCAPSULATION: Functions are self-contained
 */

console.log("\n=== Demonstrating Closure (Result of Lexical Scope) ===");

function outerFunction() {
    let outerVar = "I'm from outer";

    function innerFunction() {
        console.log(outerVar);  // Lexically bound to outerFunction
    }

    return innerFunction;
}

// Get the inner function
const savedFunction = outerFunction();

// Call it in a completely different context
function differentContext() {
    let outerVar = "I'm from differentContext";

    console.log("\nCalling savedFunction from differentContext:");
    savedFunction();  // Still logs "I'm from outer", NOT "I'm from differentContext"
}

differentContext();

/**
 * This proves lexical scope:
 * 
 * 1. innerFunction is WRITTEN inside outerFunction
 * 2. It captures outerFunction's scope at DEFINITION time
 * 3. When called from differentContext, it IGNORES that scope
 * 4. It uses its ORIGINAL lexical scope (outerFunction)
 * 
 * If JavaScript had dynamic scope:
 * - savedFunction would use differentContext's `outerVar`
 * - Would log "I'm from differentContext"
 * - But it doesn't - it uses its lexical scope
 * 
 * This is the foundation of closures.
 */

console.log("\n=== Practical Example: Callbacks ===");

function setupButton(buttonName) {
    let clickCount = 0;

    // Return a click handler
    return function handleClick() {
        clickCount++;
        console.log(`${buttonName} clicked ${clickCount} times`);
    };
}

const button1Handler = setupButton("Button 1");
const button2Handler = setupButton("Button 2");

console.log("\nSimulating button clicks:");
button1Handler();  // Button 1 clicked 1 times
button1Handler();  // Button 1 clicked 2 times
button2Handler();  // Button 2 clicked 1 times
button1Handler();  // Button 1 clicked 3 times

/**
 * Each handler REMEMBERS its own buttonName and clickCount
 * because they're lexically bound to their respective setupButton() calls.
 * 
 * This is only possible with lexical scope.
 * Dynamic scope would make this impossible to implement correctly.
 */
