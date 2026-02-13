// Example 6: Gotchas and Edge Cases
// Demonstrates: Weird and counterintuitive coercion behavior

console.log('=== THE INFAMOUS [] + {} and {} + [] ===\n');

console.log('[] + {}:', [] + {});
console.log('Breakdown:');
console.log('  [] → "" (ToPrimitive)');
console.log('  {} → "[object Object]" (ToPrimitive)');
console.log('  "" + "[object Object]" = "[object Object]"');

console.log('\n{} + []: (depends on context!)');
// In statement position, {} is a block, not an object
console.log('  As statement: {} is block, +[] = 0');
const result1 = {} + [];
console.log('  As expression:', result1);

console.log('\n({}) + []: (force {} as expression)');
console.log('  Result:', ({}) + []);

console.log('\n=== [] == ![] ===\n');

console.log('[] == ![]:', [] == ![]);
console.log('Step by step:');
console.log('  1. Evaluate ![]');
console.log('     ![] → !true → false');
console.log('  2. Now: [] == false');
console.log('  3. false → 0 (ToNumber)');
console.log('  4. [] → "" (ToPrimitive)');
console.log('  5. "" → 0 (ToNumber)');
console.log('  6. 0 == 0 → true');

console.log('\n=== NON-TRANSITIVE EQUALITY ===\n');

console.log('"0" == 0:', "0" == 0, '("0" → 0)');
console.log('0 == "":', 0 == "", '("" → 0)');
console.log('"0" == "":', "0" == "", '(both strings, "0" !== "")');
console.log('\nA == B && B == C but A != C !');

console.log('\n=== WEIRD STRING COERCIONS ===\n');

console.log('--- String Concatenation Precedence ---');
console.log('1 + 2 + "3":', 1 + 2 + "3", '(left to right: 3 + "3")');
console.log('"1" + 2 + 3:', "1" + 2 + 3, '("12" + 3)');
console.log('1 + "2" + 3:', 1 + "2" + 3, '("12" + 3)');
console.log('1 + (2 + "3"):', 1 + (2 + "3"), '(1 + "23")');

console.log('\n--- Minus Doesn\'t Concatenate ---');
console.log('"5" - 3:', "5" - 3, '(both to number)');
console.log('"10" - "5":', "10" - "5");
console.log('"5" - "a":', "5" - "a", '("a" → NaN)');

console.log('\n=== ARRAY EDGE CASES ===\n');

console.log('--- Array to Number ---');
console.log('+[]:', +[], '([] → "" → 0)');
console.log('+[5]:', +[5], '([5] → "5" → 5)');
console.log('+[1, 2]:', +[1, 2], '([1,2] → "1,2" → NaN)');
console.log('+[null]:', +[null], '([null] → "" → 0)');
console.log('+[undefined]:', +[undefined], '([undefined] → "" → 0)');

console.log('\n--- Array Arithmetic ---');
console.log('[] + []:', [] + [], '("" + "" = "")');
console.log('[] - []:', [] - [], '(0 - 0 = 0)');
console.log('[1] + [2]:', [1] + [2], '("1" + "2" = "12")');
console.log('[1] - [2]:', [1] - [2], '(1 - 2 = -1)');

console.log('\n--- Nested Arrays ---');
console.log('[[[[1]]]] + 1:', [[[[1]]]] + 1, '("1" + 1 = "11")');
console.log('[[[[1]]]] - 1:', [[[[1]]]] - 1, '(1 - 1 = 0)');

console.log('\n=== NULL AND UNDEFINED QUIRKS ===\n');

console.log('--- Only Equal to Each Other with == ---');
console.log('null == undefined:', null == undefined);
console.log('null == 0:', null == 0, '(not coerced!)');
console.log('undefined == 0:', undefined == 0, '(not coerced!)');
console.log('null == false:', null == false);
console.log('undefined == false:', undefined == false);

console.log('\n--- Arithmetic ---');
console.log('null + 5:', null + 5, '(null → 0)');
console.log('undefined + 5:', undefined + 5, '(undefined → NaN)');
console.log('null * 2:', null * 2);
console.log('undefined * 2:', undefined * 2);

console.log('\n=== NaN WEIRDNESS ===\n');

console.log('--- NaN is not equal to anything ---');
console.log('NaN == NaN:', NaN == NaN);
console.log('NaN === NaN:', NaN === NaN);
console.log('NaN != NaN:', NaN != NaN, '(only value != itself!)');

console.log('\n--- typeof NaN ---');
console.log('typeof NaN:', typeof NaN, '(it\'s a number!)');

console.log('\n--- Operations with NaN ---');
console.log('NaN + 5:', NaN + 5);
console.log('NaN * 2:', NaN * 2);
console.log('NaN / NaN:', NaN / NaN);

console.log('\n--- Detecting NaN ---');
console.log('isNaN(NaN):', isNaN(NaN), '(but coerces!)');
console.log('isNaN("hello"):', isNaN("hello"), '("hello" → NaN)');
console.log('Number.isNaN(NaN):', Number.isNaN(NaN), '(strict, better)');
console.log('Number.isNaN("hello"):', Number.isNaN("hello"), '(no coercion)');

console.log('\n=== BOOLEAN COERCION SURPRISES ===\n');

console.log('--- Wrapper Objects ---');
const falseObj = new Boolean(false);
console.log('new Boolean(false):', falseObj);
console.log('Boolean(falseObj):', Boolean(falseObj), '(object is truthy!)');
console.log('falseObj == true:', falseObj == true, '(valueOf → false)');
console.log('if (falseObj):', 'executes! (object is truthy)');

console.log('\n--- Truthy Zeros ---');
console.log('Boolean(0):', Boolean(0), '(falsy)');
console.log('Boolean("0"):', Boolean("0"), '(truthy!)');
console.log('Boolean(new Number(0)):', Boolean(new Number(0)), '(truthy!)');

console.log('\n=== COMPARISON OPERATORS ===\n');

console.log('--- Lexicographic vs Numeric ---');
console.log('"10" < "9":', "10" < "9", '(lexicographic)');
console.log('10 < "9":', 10 < "9", '("9" → 9, numeric)');
console.log('"10" < 9:', "10" < 9, '("10" → 10, numeric)');

console.log('\n--- Array Comparison ---');
console.log('[2] > [1]:', [2] > [1], '("2" > "1", lexicographic)');
console.log('[10] < [9]:', [10] < [9], '("10" < "9", lexicographic!)');
console.log('[10] < 9:', [10] < 9, '("10" → 10, numeric)');

console.log('\n--- NaN in Comparisons ---');
console.log('NaN < 5:', NaN < 5);
console.log('NaN > 5:', NaN > 5);
console.log('NaN == 5:', NaN == 5);
console.log('NaN <= NaN:', NaN <= NaN);

console.log('\n=== PLUS VS MINUS ===\n');

console.log('--- Plus favors strings ---');
console.log('"5" + 3:', "5" + 3, '(string concatenation)');
console.log('3 + "5":', 3 + "5");
console.log('"" + 5:', "" + 5);

console.log('\n--- Minus always converts to number ---');
console.log('"5" - 3:', "5" - 3, '(numeric subtraction)');
console.log('3 - "5":', 3 - "5");
console.log('"" - 5:', "" - 5, '("" → 0)');

console.log('\n=== TYPEOF QUIRKS ===\n');

console.log('typeof null:', typeof null, '(historical bug!)');
console.log('typeof undefined:', typeof undefined);
console.log('typeof NaN:', typeof NaN, '(number!)');
console.log('typeof []:', typeof [], '(object!)');
console.log('typeof {}:', typeof {});
console.log('typeof function(){}:', typeof function () { });

console.log('\n=== OBJECT.IS() DIFFERENCES ===\n');

console.log('--- NaN ---');
console.log('NaN === NaN:', NaN === NaN);
console.log('Object.is(NaN, NaN):', Object.is(NaN, NaN));

console.log('\n--- +0 vs -0 ---');
console.log('+0 === -0:', +0 === -0);
console.log('Object.is(+0, -0):', Object.is(+0, -0));

console.log('\n--- Everything Else ---');
console.log('Object.is(5, 5):', Object.is(5, 5));
console.log('Object.is("a", "a"):', Object.is("a", "a"));
console.log('Object.is({}, {}):', Object.is({}, {}));

console.log('\n=== IMPLICIT CONVERSIONS IN UNEXPECTED PLACES ===\n');

console.log('--- Object Property Access ---');
const obj = { 1: "one", "1": "string one" };
console.log('obj[1]:', obj[1]);
console.log('obj["1"]:', obj["1"], '(same property!)');

console.log('\n--- Array Indices ---');
const arr = [];
arr["0"] = "zero";
console.log('arr[0]:', arr[0], '(string "0" → number 0)');

console.log('\n--- Template Literals ---');
console.log(`null: ${null}`);
console.log(`undefined: ${undefined}`);
console.log(`[1, 2]: ${[1, 2]}`);
console.log(`{}: ${{}}`);

console.log('\n=== PRACTICAL GOTCHAS ===\n');

console.log('--- Checking for Empty ---');
const empty1 = [];
const empty2 = "";
const empty3 = 0;

console.log('[] is truthy:', !!empty1, '(check .length instead)');
console.log('"" is falsy:', !!empty2);
console.log('0 is falsy:', !!empty3, '(may want to check !== 0)');

console.log('\n--- Default Values Pitfall ---');
function setValue(value) {
    return value || "default";
}

console.log('setValue(0):', setValue(0), '(OOPS!)');
console.log('setValue(false):', setValue(false), '(OOPS!)');
console.log('setValue(""):', setValue(""), '(OOPS!)');

console.log('\nBetter with ??:');
function setValueSafe(value) {
    return value ?? "default";
}

console.log('setValueSafe(0):', setValueSafe(0));
console.log('setValueSafe(false):', setValueSafe(false));
console.log('setValueSafe(""):', setValueSafe(""));

console.log('\n--- parseInt Gotcha ---');
console.log('parseInt("08"):', parseInt("08"));
console.log('parseInt("0x10"):', parseInt("0x10"), '(hex!)');
console.log('parseInt("10", 2):', parseInt("10", 2), '(always specify radix)');

console.log('\n=== DEFENSIVE PRACTICES ===\n');

console.log('1. Use === by default');
console.log('2. Explicit coercion: Number(), String(), Boolean()');
console.log('3. Check array.length, not just array');
console.log('4. Use Number.isNaN(), not isNaN()');
console.log('5. Use ?? for nullable defaults, not ||');
console.log('6. Know the 7 falsy values');
console.log('7. Remember: objects are always truthy');
console.log('8. parseInt with explicit radix');
console.log('9. typeof null === "object" (bug)');
console.log('10. Watch for string concatenation with +');

console.log('\n=== MOST CONFUSING COMPARISONS ===\n');

const confusing = [
    ['[] == ![]', [] == ![]],
    ['[] == false', [] == false],
    ['if ([]) vs [] == true', `truthy vs ${[] == true}`],
    ['"0" == 0 && 0 == ""', "0" == 0 && 0 == ""],
    ['but "0" == ""', "0" == ""],
    ['null == undefined', null == undefined],
    ['but null === undefined', null === undefined],
    ['typeof null', typeof null],
    ['NaN === NaN', NaN === NaN],
    ['+0 === -0', +0 === -0],
];

confusing.forEach(([expr, result]) => {
    console.log(`${expr.padEnd(30)} → ${result}`);
});

console.log('\n=== KEY TAKEAWAYS ===');
console.log('1. Coercion has consistent rules, but results can be surprising');
console.log('2. [] and {} are always truthy but may == false');
console.log('3. == is not transitive');
console.log('4. null and undefined only == each other');
console.log('5. NaN never equals anything (including itself)');
console.log('6. typeof null → "object" (bug)');
console.log('7. String comparison is lexicographic unless both are numbers');
console.log('8. + prefers strings, -, *, / prefer numbers');
console.log('9. Use explicit conversions to avoid surprises');
console.log('10. When in doubt, use === and be explicit');
