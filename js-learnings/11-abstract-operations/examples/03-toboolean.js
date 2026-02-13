/**
 * Example 3: ToBoolean and Falsy Values
 * Demonstrates the 7 falsy values and ToBoolean conversion
 */

console.log("=== Example 3: ToBoolean ===\n");

// SCENARIO 1: The 7 falsy values
console.log("--- The 7 Falsy Values ---");

console.log("false:", Boolean(false));           // false
console.log("0:", Boolean(0));                   // false
console.log("-0:", Boolean(-0));                 // false
console.log('"":', Boolean(""));                 // false
console.log("null:", Boolean(null));             // false
console.log("undefined:", Boolean(undefined));   // false
console.log("NaN:", Boolean(NaN));               // false

/**
 * ONLY 7 FALSY VALUES:
 * 1. false
 * 2. 0
 * 3. -0
 * 4. "" (empty string)
 * 5. null
 * 6. undefined
 * 7. NaN
 * 
 * BigInt zero (0n) is also falsy in modern JS.
 */

// SCENARIO 2: Common "gotchas" (truthy!)
console.log("\n--- Truthy Values (Common Mistakes) ---");

console.log('"0":', Boolean("0"));               // true (!)
console.log('"false":', Boolean("false"));       // true (!)
console.log('" ":', Boolean(" "));               // true (whitespace)
console.log("[]:", Boolean([]));                 // true (!)
console.log("{}:", Boolean({}));                 // true (!)
console.log("function(){}:", Boolean(function () { })); // true

/**
 * EVERYTHING ELSE IS TRUTHY!
 * 
 * Common mistakes:
 * "0" is truthy (non-empty string)
 * "false" is truthy (non-empty string)
 * [] is truthy (object)
 * {} is truthy (object)
 */

// SCENARIO 3: Implicit conversion in conditionals
console.log("\n--- Conditionals Use ToBoolean ---");

if ("") {
    console.log("Empty string is truthy");
} else {
    console.log("Empty string is falsy");  // This runs
}

if ("0") {
    console.log('"0" is truthy');  // This runs
} else {
    console.log('"0" is falsy');
}

if ([]) {
    console.log("Empty array is truthy");  // This runs
} else {
    console.log("Empty array is falsy");
}

/**
 * if (condition) calls ToBoolean(condition)
 * 
 * Same for:
 * - while (condition)
 * - for (; condition; )
 * - condition ? a : b
 * - a && b, a || b
 */

// SCENARIO 4: Double negation (!!)
console.log("\n--- Double Negation (!!) ---");

console.log('!!"hello":', !!"hello");       // true
console.log('!!"":', !!"");                 // false
console.log('!!1:', !!1);                   // true
console.log('!!0:', !!0);                   // false
console.log('!![]:', !![]);                 // true
console.log('!!null:', !!null);             // false

/**
 * !! is a common pattern to convert to boolean:
 * 1. First ! converts to boolean and negates
 * 2. Second ! negates again
 * 
 * Same as Boolean(value) but shorter.
 */

// SCENARIO 5: Logical operators
console.log("\n--- Logical Operators (Use ToBoolean) ---");

console.log('"hello" && "world":', "hello" && "world");  // "world"
console.log('"" && "world":', "" && "world");            // ""
console.log('"hello" || "world":', "hello" || "world");  // "hello"
console.log('"" || "world":', "" || "world");            // "world"

/**
 * && and || don't return boolean, they return one of the operands:
 * 
 * a && b:
 * - If ToBoolean(a) is false → return a
 * - Otherwise → return b
 * 
 * a || b:
 * - If ToBoolean(a) is true → return a
 * - Otherwise → return b
 */

// SCENARIO 6: Checking for "empty" (be careful!)
console.log("\n--- Checking for Empty ---");

function checkArray(arr) {
    if (arr.length) {
        console.log("Array has items");
    } else {
        console.log("Array is empty");
    }
}

checkArray([1, 2]);  // "Array has items"
checkArray([]);      // "Array is empty"

/**
 * arr.length for empty array is 0 → falsy
 * This pattern works because 0 is falsy.
 * 
 * But be careful with objects:
 */

const obj = {};
if (obj) {  // obj is truthy (object)
    console.log("Object exists (but may be empty)");
}

// To check if object is empty:
if (Object.keys(obj).length) {
    console.log("Object has properties");
} else {
    console.log("Object is empty");  // This runs
}

console.log("\n=== ToBoolean Summary ===");
console.log("✓ Only 7 falsy values");
console.log("✓ Everything else is truthy");
console.log("✓ '0', 'false', [], {} are all truthy!");
console.log("✓ if, while, &&, || use ToBoolean");
console.log("✓ !! converts to boolean");
