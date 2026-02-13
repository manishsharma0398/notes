// Example 2: Equality Comparisons (== vs ===)
// Demonstrates: Strict vs abstract equality and their algorithms

console.log('=== STRICT EQUALITY (===) ===\n');

console.log('--- Same Type, Same Value ---');
console.log('5 === 5:', 5 === 5);
console.log('"hello" === "hello":', "hello" === "hello");
console.log('true === true:', true === true);
console.log('null === null:', null === null);
console.log('undefined === undefined:', undefined === undefined);

console.log('\n--- Same Type, Different Value ---');
console.log('5 === 6:', 5 === 6);
console.log('"hello" === "world":', "hello" === "world");
console.log('true === false:', true === false);

console.log('\n--- Different Types (Always False) ---');
console.log('5 === "5":', 5 === "5");
console.log('0 === false:', 0 === false);
console.log('1 === true:', 1 === true);
console.log('"" === 0:', "" === 0);
console.log('null === undefined:', null === undefined);

console.log('\n--- Special Cases ---');
console.log('NaN === NaN:', NaN === NaN, '(only value not equal to itself!)');
console.log('+0 === -0:', +0 === -0, '(considered equal)');
console.log('{} === {}:', {} === {}, '(different objects)');
console.log('[] === []:', [] === [], '(different arrays)');

console.log('\n--- Object Reference Comparison ---');
const obj1 = { x: 5 };
const obj2 = { x: 5 };
const obj3 = obj1;

console.log('obj1 === obj2:', obj1 === obj2, '(different objects, same content)');
console.log('obj1 === obj3:', obj1 === obj3, '(same reference)');

console.log('\n=== ABSTRACT EQUALITY (==) ===\n');

console.log('--- Same Type (Behaves Like ===) ---');
console.log('5 == 5:', 5 == 5);
console.log('"hello" == "hello":', "hello" == "hello");
console.log('{} == {}:', {} == {}, '(still different objects)');

console.log('\n--- null and undefined (Special Case) ---');
console.log('null == undefined:', null == undefined, '(ONLY equal to each other)');
console.log('null == 0:', null == 0, '(NOT coerced!)');
console.log('null == false:', null == false);
console.log('undefined == 0:', undefined == 0);
console.log('undefined == false:', undefined == false);

console.log('\n--- Number and String ---');
console.log('5 == "5":', 5 == "5", '(string converted to number)');
console.log('0 == "":', 0 == "", '("" → 0)');
console.log('0 == "0":', 0 == "0");
console.log('1 == "1":', 1 == "1");
console.log('42 == " 42 ":', 42 == " 42 ", '(whitespace trimmed)');

console.log('\n--- Boolean Conversion ---');
console.log('true == 1:', true == 1, '(true → 1)');
console.log('false == 0:', false == 0, '(false → 0)');
console.log('true == "1":', true == "1", '(true → 1, "1" → 1)');
console.log('false == "":', false == "", '(false → 0, "" → 0)');
console.log('true == 2:', true == 2, '(true → 1, 1 != 2)');

console.log('\n--- Object to Primitive ---');
console.log('[] == "":', [] == "", '([] → "")');
console.log('[] == 0:', [] == 0, '([] → "" → 0)');
console.log('[42] == 42:', [42] == 42, '([42] → "42" → 42)');
console.log('[1, 2] == "1,2":', [1, 2] == "1,2", '([1,2] → "1,2")');

const customObj = {
    valueOf() { return 42; }
};
console.log('customObj == 42:', customObj == 42, '(valueOf)');

console.log('\n=== GOTCHAS ===\n');

console.log('--- The Famous [] == ![] ---');
console.log('[] == ![]:', [] == ![], '(!!!)');
console.log('Breakdown:');
console.log('  ![] → !true → false');
console.log('  [] == false');
console.log('  [] → "" (ToPrimitive)');
console.log('  "" == false');
console.log('  0 == 0 → true');

console.log('\n--- Non-Transitive ---');
console.log('"0" == 0:', "0" == 0, '("0" → 0)');
console.log('0 == "":', 0 == "", '("" → 0)');
console.log('"0" == "":', "0" == "", '(both strings, "0" !== "")');
console.log('Transitivity broken!');

console.log('\n--- Truthy but == false ---');
console.log('[] is truthy:', !![], '(ToBoolean)');
console.log('[] == false:', [] == false, '(ToPrimitive → ToNumber)');
console.log('"0" is truthy:', !!"0");
console.log('"0" == false:', "0" == false);

console.log('\n--- String Comparison ---');
console.log('"10" == "9":', "10" == "9", '(string comparison)');
console.log('10 == "9":', 10 == "9", '("9" → 9)');

console.log('\n=== ALGORITHM WALKTHROUGH ===\n');

function explainEquality(x, y) {
    console.log(`\nComparing ${JSON.stringify(x)} == ${JSON.stringify(y)}:`);

    if (typeof x === typeof y) {
        console.log('  Same type → use ===');
        console.log('  Result:', x === y);
        return x === y;
    }

    if ((x === null && y === undefined) || (x === undefined && y === null)) {
        console.log('  null == undefined special case');
        console.log('  Result: true');
        return true;
    }

    if (typeof x === 'number' && typeof y === 'string') {
        console.log(`  Number and String → ToNumber("${y}")`);
        const yNum = Number(y);
        console.log(`  Compare ${x} === ${yNum}`);
        return x === yNum;
    }

    if (typeof x === 'string' && typeof y === 'number') {
        console.log(`  String and Number → ToNumber("${x}")`);
        const xNum = Number(x);
        console.log(`  Compare ${xNum} === ${y}`);
        return xNum === y;
    }

    if (typeof x === 'boolean') {
        console.log(`  Boolean → ToNumber(${x}) = ${Number(x)}`);
        return Number(x) == y;
    }

    if (typeof y === 'boolean') {
        console.log(`  Boolean → ToNumber(${y}) = ${Number(y)}`);
        return x == Number(y);
    }

    console.log('  Result:', x == y);
    return x == y;
}

explainEquality(5, "5");
explainEquality(true, 1);
explainEquality([], "");
explainEquality(null, undefined);

console.log('\n=== WHEN TO USE WHICH ===\n');

console.log('USE === (STRICT) - Default Choice:');
console.log('✓ More predictable');
console.log('✓ No hidden coercion');
console.log('✓ Explicit about types');
console.log('✓ Prevents accidental bugs');

console.log('\nUSE == (ABSTRACT) - Specific Cases:');
console.log('✓ Checking for null OR undefined:');
console.log('  if (value == null) { /* null or undefined */ }');
console.log('✗ Most other uses are better with ===');

console.log('\n=== PRACTICAL EXAMPLES ===\n');

function processValue(value) {
    // Good: Check for null or undefined
    if (value == null) {
        console.log('Value is null or undefined');
        return;
    }

    // Good: Explicit type check
    if (typeof value === 'string') {
        console.log('String value:', value);
    }

    // Good: Strict equality
    if (value === 0) {
        console.log('Exactly zero');
    }

    // Avoid: Implicit coercion
    // if (value == 0) { /* Could be 0, "0", "", false, etc. */ }
}

processValue(null);
processValue(undefined);
processValue("hello");
processValue(0);

console.log('\n=== NaN HANDLING ===\n');

const notANumber = NaN;

console.log('NaN === NaN:', NaN === NaN, '(false!)');
console.log('NaN == NaN:', NaN == NaN, '(false!)');
console.log('Number.isNaN(NaN):', Number.isNaN(NaN), '(use this)');
console.log('isNaN(NaN):', isNaN(NaN), '(also true, but coerces)');
console.log('isNaN("hello"):', isNaN("hello"), '(coerces to number first)');
console.log('Number.isNaN("hello"):', Number.isNaN("hello"), '(strict, better)');

console.log('\n=== OBJECT.IS() ===\n');

console.log('Object.is() is like === but:');
console.log('Object.is(NaN, NaN):', Object.is(NaN, NaN), '(true, unlike ===)');
console.log('Object.is(+0, -0):', Object.is(+0, -0), '(false, unlike ===)');
console.log('Object.is(5, 5):', Object.is(5, 5), '(same as ===)');
console.log('Object.is({}, {}):', Object.is({}, {}), '(same as ===)');

console.log('\n=== KEY TAKEAWAYS ===');
console.log('1. === never coerces (strict type + value)');
console.log('2. == coerces via well-defined algorithm');
console.log('3. null == undefined (only equal to each other)');
console.log('4. Booleans convert to numbers in ==');
console.log('5. Strings convert to numbers when compared to numbers');
console.log('6. Objects convert to primitives (ToPrimitive)');
console.log('7. Use === by default, == only for null/undefined check');
console.log('8. NaN never equals itself, use Number.isNaN()');
console.log('9. Object.is() for +0/-0 and NaN edge cases');
console.log('10. == is NOT transitive!');
