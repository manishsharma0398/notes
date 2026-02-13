// Example 1: Implicit vs Explicit Coercion
// Demonstrates: The difference between implicit and explicit type conversion

console.log('=== EXPLICIT COERCION ===\n');

console.log('--- Number() ---');
console.log('Number("42"):', Number("42"));
console.log('Number("3.14"):', Number("3.14"));
console.log('Number(""):', Number(""));
console.log('Number(" 42 "):', Number(" 42 "), '(whitespace trimmed)');
console.log('Number("abc"):', Number("abc"));
console.log('Number(true):', Number(true));
console.log('Number(false):', Number(false));
console.log('Number(null):', Number(null));
console.log('Number(undefined):', Number(undefined));

console.log('\n--- String() ---');
console.log('String(42):', String(42));
console.log('String(true):', String(true));
console.log('String(null):', String(null));
console.log('String(undefined):', String(undefined));
console.log('String(NaN):', String(NaN));
console.log('String([1, 2, 3]):', String([1, 2, 3]));
console.log('String({}):', String({}));

console.log('\n--- Boolean() ---');
console.log('Boolean(1):', Boolean(1));
console.log('Boolean(0):', Boolean(0));
console.log('Boolean(""):', Boolean(""));
console.log('Boolean("hello"):', Boolean("hello"));
console.log('Boolean(null):', Boolean(null));
console.log('Boolean(undefined):', Boolean(undefined));
console.log('Boolean([]):', Boolean([]), '(empty array is truthy!)');
console.log('Boolean({}):', Boolean({}), '(empty object is truthy!)');

console.log('\n=== IMPLICIT COERCION ===\n');

console.log('--- Arithmetic Operators ---');
console.log('"5" - 3:', "5" - 3, '(string to number)');
console.log('"5" + 3:', "5" + 3, '(number to string for +)');
console.log('"5" * 2:', "5" * 2);
console.log('"10" / 2:', "10" / 2);
console.log('true + 1:', true + 1, '(true → 1)');
console.log('false + 1:', false + 1, '(false → 0)');
console.log('null + 1:', null + 1, '(null → 0)');
console.log('undefined + 1:', undefined + 1, '(undefined → NaN)');

console.log('\n--- String Concatenation ---');
console.log('1 + 2 + "3":', 1 + 2 + "3", '(left to right: 3 + "3")');
console.log('"1" + 2 + 3:', "1" + 2 + 3, '("1" + 2 = "12" + 3)');
console.log('"The answer is " + 42:', "The answer is " + 42);

console.log('\n--- Unary + Operator ---');
console.log('+"42":', +"42", '(converts to number)');
console.log('+"3.14":', +"3.14");
console.log('+"":', +"");
console.log('+"abc":', +"abc");
console.log('+true:', +true);
console.log('+false:', +false);
console.log('+null:', +null);
console.log('+undefined:', +undefined);
console.log('+[]:', +[], '([] → "" → 0)');
console.log('+[42]:', +[42], '([42] → "42" → 42)');
console.log('+[1, 2]:', +[1, 2], '([1,2] → "1,2" → NaN)');

console.log('\n--- Logical Context (if, while, &&, ||) ---');

if ("hello") {
    console.log('if ("hello"): executes (truthy)');
}

if ("") {
    console.log('if (""): should not execute');
} else {
    console.log('if (""): falsy, else executes');
}

if ([]) {
    console.log('if ([]): executes (empty array is truthy!)');
}

if ({}) {
    console.log('if ({}): executes (empty object is truthy!)');
}

console.log('\n--- Logical Operators ---');
console.log('"hello" && "world":', "hello" && "world", '(returns last truthy)');
console.log('0 && "hello":', 0 && "hello", '(returns first falsy)');
console.log('"" || "default":', "" || "default", '(returns first truthy)');
console.log('null || undefined || "value":', null || undefined || "value");

console.log('\n--- Double NOT for Boolean Conversion ---');
console.log('!!"hello":', !!"hello", '(truthy → true)');
console.log('!!0:', !!0, '(falsy → false)');
console.log('!![]:', !![], '(truthy → true)');
console.log('!![].length:', !![].length, '(0 → false)');

console.log('\n=== COMPARING EXPLICIT VS IMPLICIT ===\n');

const value = "42";

console.log('Explicit Number(value):', Number(value));
console.log('Implicit value - 0:', value - 0);
console.log('Implicit +value:', +value);
console.log('Implicit value * 1:', value * 1);

console.log('\nAll produce same result, but explicit is clearer!');

console.log('\n--- String Conversion ---');
const num = 42;

console.log('Explicit String(num):', String(num));
console.log('Implicit num + "":', num + "");
console.log('Implicit `${num}`:', `${num}`);

console.log('\n=== TEMPLATE LITERALS ===\n');

console.log('Template uses ToString:');
console.log(`null: ${null}`);
console.log(`undefined: ${undefined}`);
console.log(`true: ${true}`);
console.log(`42: ${42}`);
console.log(`[1, 2, 3]: ${[1, 2, 3]}`);

console.log('\n=== GOTCHAS ===\n');

console.log('--- Unexpected String Concatenation ---');
console.log('1 + 2 + 3:', 1 + 2 + 3, '(all numbers)');
console.log('1 + 2 + "3":', 1 + 2 + "3", '(becomes string at "3")');
console.log('"1" + 2 + 3:', "1" + 2 + 3, '(string from start)');

console.log('\n--- parseFloat vs Number ---');
console.log('Number("42px"):', Number("42px"), '(NaN)');
console.log('parseInt("42px"):', parseInt("42px"), '(42, stops at non-digit)');
console.log('parseFloat("3.14px"):', parseFloat("3.14px"), '(3.14)');

console.log('\n--- Object Coercion ---');
const obj = {
    toString() { return "object"; },
    valueOf() { return 42; }
};

console.log('String(obj):', String(obj), '(calls toString)');
console.log('Number(obj):', Number(obj), '(calls valueOf)');
console.log('obj + "":', obj + "", '(hint:default, valueOf)');
console.log('obj - 0:', obj - 0, '(calls valueOf)');

console.log('\n--- Array to Number ---');
console.log('+[]:', +[]);
console.log('+[42]:', +[42]);
console.log('+[1, 2]:', +[1, 2]);
console.log('+ "Why?', '[] → "" → 0; [42] → "42" → 42; [1,2] → "1,2" → NaN');

console.log('\n=== BEST PRACTICES ===');
console.log('1. Use explicit coercion (Number, String, Boolean)');
console.log('2. Avoid implicit coercion in complex expressions');
console.log('3. !! is acceptable shorthand for Boolean()');
console.log('4. (+) for number conversion is idiomatic but less clear');
console.log('5. Template literals for string concatenation');

console.log('\n=== KEY TAKEAWAYS ===');
console.log('1. Explicit: Number(), String(), Boolean()');
console.log('2. Implicit: Operators trigger coercion');
console.log('3. + is string concat if ANY operand is string');
console.log('4. -, *, / always convert to numbers');
console.log('5. Logical context uses ToBoolean');
console.log('6. Objects use ToPrimitive (valueOf/toString)');
console.log('7. Explicit coercion is clearer and more maintainable');
