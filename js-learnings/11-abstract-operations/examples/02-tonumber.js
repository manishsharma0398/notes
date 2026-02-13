/**
 * Example 2: ToNumber
 * Demonstrates how values are converted to numbers
 */

console.log("=== Example 2: ToNumber ===\n");

// SCENARIO 1: Primitive to number
console.log("--- Primitives ---");

console.log("undefined:", Number(undefined));  // NaN
console.log("null:", Number(null));           // 0 (!)
console.log("true:", Number(true));           // 1
console.log("false:", Number(false));         // 0

/**
 * TONUMBER RULES:
 * undefined → NaN
 * null → 0 (special case!)
 * boolean → 1 or 0
 */

// SCENARIO 2: String to number
console.log("\n--- Strings ---");

console.log('"":', Number(""));               // 0 (!)
console.log('"   ":', Number("   "));         // 0 (whitespace)
console.log('"123":', Number("123"));         // 123
console.log('"12.5":', Number("12.5"));       // 12.5
console.log('"-42":', Number("-42"));         // -42
console.log('"0x10":', Number("0x10"));       // 16 (hex)
console.log('"abc":', Number("abc"));         // NaN
console.log('"12abc":', Number("12abc"));     // NaN

/**
 * STRING TO NUMBER ALGORITHM:
 * 1. Trim whitespace
 * 2. Empty → 0
 * 3. Parse as numeric literal (supports hex)
 * 4. Invalid → NaN
 */

// SCENARIO 3: Objects to number
console.log("\n--- Objects ---");

console.log("{}:", Number({}));               // NaN
console.log("[]:", Number([]));               // 0 (!)
console.log("[5]:", Number([5]));             // 5 (!)
console.log("[1,2]:", Number([1, 2]));        // NaN

/**
 * OBJECT TO NUMBER:
 * 1. ToPrimitive(obj, "number")
 * 2. ToNumber(primitive result)
 * 
 * [] → ToPrimitive → "" → ToNumber → 0
 * [5] → ToPrimitive → "5" → ToNumber → 5
 * [1,2] → ToPrimitive → "1,2" → ToNumber → NaN
 */

// SCENARIO 4: Custom valueOf
console.log("\n--- Custom valueOf ---");

const obj = {
    valueOf() {
        console.log("valueOf called");
        return 42;
    },
    toString() {
        console.log("toString called");
        return "100";
    }
};

console.log("Number(obj):", Number(obj));

/**
 * ToNumber on object:
 * 1. ToPrimitive(obj, "number") → calls valueOf → 42
 * 2. ToNumber(42) → 42
 */

// SCENARIO 5: Unary + operator
console.log("\n--- Unary + (Uses ToNumber) ---");

console.log('+"123":', +"123");               // 123
console.log('+"  456  ":', +"  456  ");       // 456
console.log('+"":', +"");                     // 0
console.log('+"abc":', +"abc");               // NaN
console.log('+true:', +true);                 // 1
console.log('+false:', +false);               // 0
console.log('+null:', +null);                 // 0
console.log('+undefined:', +undefined);       // NaN

/**
 * Unary + calls ToNumber.
 * Useful for converting strings to numbers.
 */

// SCENARIO 6: Arithmetic operators (use ToNumber)
console.log("\n--- Arithmetic Operators ---");

console.log('"5" - 3:', "5" - 3);             // 2
console.log('"5" * 2:', "5" * 2);             // 10
console.log('"10" / 2:', "10" / 2);           // 5
console.log('"abc" - 1:', "abc" - 1);         // NaN

/**
 * All arithmetic (except +) call ToNumber on both operands.
 * + is special: if either is string → concatenation
 */

console.log("\n=== ToNumber Summary ===");
console.log("✓ null → 0 (not NaN!)");
console.log("✓ undefined → NaN");
console.log("✓ Empty string → 0");
console.log("✓ Whitespace-only → 0");
console.log("✓ Objects → ToPrimitive then ToNumber");
console.log("✓ Unary + and arithmetic use ToNumber");
