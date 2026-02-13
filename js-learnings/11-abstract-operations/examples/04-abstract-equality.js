/**
 * Example 4: Abstract Equality (==) Algorithm
 * Demonstrates how == comparison works with type coercion
 */

console.log("=== Example 4: Abstract Equality (==) ===\n");

// SCENARIO 1: Same type → use strict equality
console.log("--- Same Type ---");

console.log("5 == 5:", 5 == 5);                 // true
console.log('"a" == "a":', "a" == "a");         // true
console.log("true == true:", true == true);     // true
console.log("{} == {}:", {} == {});             // false (different objects)

/**
 * When types are same, == behaves like ===
 */

// SCENARIO 2: null and undefined (special case)
console.log("\n--- null and undefined ---");

console.log("null == undefined:", null == undefined);  // true (!)
console.log("null == null:", null == null);           // true
console.log("undefined == undefined:", undefined == undefined); // true

// But NOT equal to anything else:
console.log("null == 0:", null == 0);                 // false
console.log("null == false:", null == false);         // false
console.log("undefined == 0:", undefined == 0);       // false
console.log("undefined == false:", undefined == false); // false

/**
 * SPECIAL RULE:
 * null == undefined → true
 * null and undefined only equal each other (and themselves)
 */

// SCENARIO 3: Number vs String
console.log("\n--- Number vs String ---");

console.log('5 == "5":', 5 == "5");               // true
console.log('10 == "10":', 10 == "10");           // true
console.log('0 == "":', 0 == "");                 // true (!)
console.log('0 == "0":', 0 == "0");               // true

/**
 * When comparing number and string:
 * ToNumber(string) then compare
 * 
 * "5" → 5, then 5 == 5 → true
 * "" → 0, then 0 == 0 → true
 */

// SCENARIO 4: Boolean coercion
console.log("\n--- Boolean Coercion ---");

console.log("true == 1:", true == 1);             // true
console.log("false == 0:", false == 0);           // true
console.log("true == 2:", true == 2);             // false
console.log('"1" == true:', "1" == true);         // true
console.log('"2" == true:', "2" == true);         // false (!)

/**
 * When boolean is involved:
 * ToNumber(boolean) then compare
 * 
 * true → 1
 * false → 0
 * 
 * "1" == true:
 * 1. true → 1
 * 2. "1" == 1
 * 3. "1" → 1
 * 4. 1 == 1 → true
 */

// SCENARIO 5: Object to primitive
console.log("\n--- Object to Primitive ---");

console.log('[1] == 1:', [1] == 1);              // true
console.log('[1,2] == "1,2":', [1, 2] == "1,2"); // true
console.log('[""] == 0:', [""] == 0);            // true
console.log('[] == 0:', [] == 0);                // true (!)

/**
 * When object vs primitive:
 * ToPrimitive(object) then compare
 * 
 * [1] == 1:
 * 1. ToPrimitive([1]) → "1"
 * 2. "1" == 1
 * 3. ToNumber("1") → 1
 * 4. 1 == 1 → true
 * 
 * [] == 0:
 * 1. ToPrimitive([]) → ""
 * 2. "" == 0
 * 3. ToNumber("") → 0
 * 4. 0 == 0 → true
 */

// SCENARIO 6: The famous trap
console.log("\n--- Famous Trap: [] == ![] ---");

console.log("[] == ![]:", [] == ![]);             // true (!)

/**
 * STEPS:
 * 1. ![] → false ([] is truthy)
 * 2. [] == false
 * 3. ToPrimitive([]) → ""
 * 4. "" == false
 * 5. ToNumber(false) → 0
 * 6. "" == 0
 * 7. ToNumber("") → 0
 * 8. 0 == 0 → true
 */

// SCENARIO 7: Common mistakes
console.log("\n--- Common Mistakes ---");

console.log('"0" == false:', "0" == false);       // true (!)
console.log('"false" == false:', "false" == false); // false
console.log('"" == false:', "" == false);         // true
console.log('"" == 0:', "" == 0);                 // true

/**
 * "0" == false:
 * 1. ToNumber(false) → 0
 * 2. "0" == 0
 * 3. ToNumber("0") → 0
 * 4. 0 == 0 → true
 * 
 * "false" == false:
 * 1. ToNumber(false) → 0
 * 2. "false" == 0
 * 3. ToNumber("false") → NaN
 * 4. NaN == 0 → false
 */

// SCENARIO 8: Why === is safer
console.log("\n--- Comparing == vs === ---");

console.log('5 == "5":', 5 == "5");               // true
console.log('5 === "5":', 5 === "5");             // false

console.log('0 == "":', 0 == "");                 // true
console.log('0 === "":', 0 === "");               // false

console.log('null == undefined:', null == undefined); // true
console.log('null === undefined:', null === undefined); // false

/**
 * === checks type FIRST
 * If types differ → immediately false
 * No coercion happens
 * 
 * Use === unless you specifically need coercion
 */

console.log("\n=== Abstract Equality Summary ===");
console.log("✓ Same type → use ===");
console.log("✓ null == undefined → true (special)");
console.log("✓ Number vs String → ToNumber(string)");
console.log("✓ Boolean → ToNumber (true→1, false→0)");
console.log("✓ Object → ToPrimitive then compare");
console.log("✓ Prefer === to avoid surprises");
