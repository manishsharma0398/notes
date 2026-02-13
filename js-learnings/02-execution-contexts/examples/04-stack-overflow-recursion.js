/**
 * Example 4: Stack Overflow and Recursion
 * Demonstrates call stack limits and proper recursion
 */

console.log("=== Example 4: Stack Overflow and Recursion ===\n");

// EXAMPLE A: Proper recursion with base case
console.log("--- Proper Recursion ---");

function factorial(n) {
    // Base case - stops recursion
    if (n <= 1) {
        return 1;
    }
    // Recursive case
    return n * factorial(n - 1);
}

console.log("factorial(5):", factorial(5));
console.log("factorial(10):", factorial(10));

/**
 * Call stack for factorial(3):
 * 
 * Step 1: [Global, factorial(3)]
 *   n=3, n > 1, return 3 * factorial(2)
 * 
 * Step 2: [Global, factorial(3), factorial(2)]
 *   n=2, n > 1, return 2 * factorial(1)
 * 
 * Step 3: [Global, factorial(3), factorial(2), factorial(1)]
 *   n=1, n <= 1, return 1
 * 
 * Step 4: [Global, factorial(3), factorial(2)]
 *   return 2 * 1 = 2
 * 
 * Step 5: [Global, factorial(3)]
 *   return 3 * 2 = 6
 * 
 * Step 6: [Global]
 *   Result: 6
 * 
 * MAX STACK DEPTH: 3 contexts (plus global)
 */

// EXAMPLE B: Stack overflow (commented to prevent crash)
console.log("\n--- Stack Overflow Example (commented out) ---");

/*
function infiniteRecursion() {
    return infiniteRecursion();  // No base case!
}

infiniteRecursion();  // RangeError: Maximum call stack size exceeded
*/

console.log("Infinite recursion would crash with:");
console.log("RangeError: Maximum call stack size exceeded");

/**
 * What happens:
 * 
 * [Global, infiniteRecursion()] 
 * [Global, infiniteRecursion(), infiniteRecursion()]
 * [Global, infiniteRecursion(), infiniteRecursion(), infiniteRecursion()]
 * ...
 * (repeats ~10,000-50,000 times depending on engine)
 * ...
 * RangeError!
 * 
 * WHY IT FAILS:
 * 
 * 1. Each call creates a new execution context
 * 2. Execution contexts are stored in the call stack
 * 3. Call stack has a FIXED SIZE limit (memory constraint)
 * 4. No base case = infinite growth
 * 5. Stack runs out of space → RangeError
 */

// EXAMPLE C: Measuring stack depth
console.log("\n--- Measuring Maximum Stack Depth ---");

function measureStackDepth() {
    let depth = 0;

    function recurse() {
        depth++;
        recurse();
    }

    try {
        recurse();
    } catch (e) {
        console.log("Maximum stack depth reached:", depth);
        console.log("Error:", e.message);
    }
}

// measureStackDepth();  // Uncomment to test (takes a moment)
console.log("(Uncomment measureStackDepth() to test your stack limit)");

/**
 * Typical results:
 * - Chrome V8: ~15,000 calls
 * - Node.js: ~11,000-15,000 calls
 * - Firefox: ~50,000 calls
 * 
 * Varies by:
 * - Engine implementation
 * - Available memory
 * - Size of local variables in each context
 */

// EXAMPLE D: Tail call optimization (not widely supported)
console.log("\n--- Tail Call Optimization ---");

// Regular recursion (stack grows)
function sumRegular(n, accumulator = 0) {
    if (n <= 0) return accumulator;
    return sumRegular(n - 1, accumulator + n);  // Tail call
}

console.log("sumRegular(100):", sumRegular(100));

/**
 * TAIL CALL:
 * A function call that is the LAST operation in a function.
 * 
 * Theoretically, engines could optimize this:
 * - Instead of adding new frames to the stack
 * - Reuse the current frame
 * - Stack size stays constant
 * 
 * REALITY:
 * - ES6 spec includes tail call optimization
 * - Most engines don't implement it (only Safari/WebKit)
 * - Don't rely on it in production
 * 
 * ALTERNATIVE: Use iteration instead of recursion for large inputs
 */

// EXAMPLE E: Iterative alternative
console.log("\n--- Iterative Alternative (No Stack Growth) ---");

function sumIterative(n) {
    let result = 0;
    for (let i = 1; i <= n; i++) {
        result += i;
    }
    return result;
}

console.log("sumIterative(100):", sumIterative(100));
console.log("sumIterative(1000000):", sumIterative(1000000));

/**
 * Call stack for sumIterative:
 * 
 * [Global, sumIterative]  ← Only ONE context, no matter how large n is
 * 
 * No stack overflow risk because loop doesn't create new contexts.
 * 
 * KEY INSIGHT:
 * 
 * Recursion is elegant but has stack limits.
 * For large inputs, use iteration or trampolining.
 */

console.log("\n=== Key Takeaways ===");
console.log("✓ Always include a base case in recursion");
console.log("✓ Stack overflow = too many nested function calls");
console.log("✓ Stack depth limit varies by engine (~10k-50k)");
console.log("✓ Each recursive call adds to the stack");
console.log("✓ Iteration avoids stack growth for large inputs");
