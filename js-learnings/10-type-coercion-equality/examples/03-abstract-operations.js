// Example 3: ToNumber, ToString, ToBoolean
// Demonstrates: The three core abstract operations

console.log('=== ToNumber ===\n');

console.log('--- Primitives ---');
console.log('Number(undefined):', Number(undefined), '(NaN)');
console.log('Number(null):', Number(null), '(0 - important!)');
console.log('Number(true):', Number(true));
console.log('Number(false):', Number(false));

console.log('\n--- Strings ---');
console.log('Number(""):', Number(""), '(0 - empty string)');
console.log('Number(" "):', Number(" "), '(0 - whitespace)');
console.log('Number("42"):', Number("42"));
console.log('Number("3.14"):', Number("3.14"));
console.log('Number(" 42 "):', Number(" 42 "), '(whitespace trimmed)');
console.log('Number("42px"):', Number("42px"), '(NaN - invalid)');
console.log('Number("0x10"):', Number("0x10"), '(16 - hex supported)');
console.log('Number("0b101"):', Number("0b101"), '(5 - binary supported)');
console.log('Number("Infinity"):', Number("Infinity"));
console.log('Number("-Infinity"):', Number("-Infinity"));

console.log('\n--- Arrays ---');
console.log('Number([]):', Number([]), '([] → "" → 0)');
console.log('Number([42]):', Number([42]), '([42] → "42" → 42)');
console.log('Number([1, 2]):', Number([1, 2]), '([1,2] → "1,2" → NaN)');
console.log('Number([""]):', Number([""]), '([""] → "" → 0)');

console.log('\n--- Objects ---');
const objWithValueOf = {
    valueOf() { return 42; },
    toString() { return "100"; }
};

console.log('Number(objWithValueOf):', Number(objWithValueOf), '(calls valueOf)');

const objWithoutValueOf = {
    toString() { return "42"; }
};

console.log('Number(objWithoutValueOf):', Number(objWithoutValueOf), '(calls toString)');

console.log('\n--- Special Values ---');
console.log('Number(NaN):', Number(NaN));
console.log('Number(Infinity):', Number(Infinity));
console.log('Number(-Infinity):', Number(-Infinity));

console.log('\n=== ToString ===\n');

console.log('--- Primitives ---');
console.log('String(undefined):', String(undefined));
console.log('String(null):', String(null));
console.log('String(true):', String(true));
console.log('String(false):', String(false));

console.log('\n--- Numbers ---');
console.log('String(0):', String(0));
console.log('String(-0):', String(-0), '(loses sign)');
console.log('String(42):', String(42));
console.log('String(3.14):', String(3.14));
console.log('String(NaN):', String(NaN));
console.log('String(Infinity):', String(Infinity));
console.log('String(-Infinity):', String(-Infinity));

console.log('\n--- Arrays ---');
console.log('String([]):', String([]), '(empty string)');
console.log('String([1, 2, 3]):', String([1, 2, 3]), '(joins with comma)');
console.log('String([[1], [2]]):', String([[1], [2]]));
console.log('String([null, undefined]):', String([null, undefined]), '(become empty)');

console.log('\n--- Objects ---');
console.log('String({}):', String({}), '([object Object])');
console.log('String({ x: 1 }):', String({ x: 1 }));

const customToString = {
    valueOf() { return 42; },
    toString() { return "custom"; }
};

console.log('String(customToString):', String(customToString), '(calls toString)');

console.log('\n--- Date ---');
const date = new Date('2024-01-01');
console.log('String(date):', String(date), '(readable string)');
console.log('Number(date):', Number(date), '(milliseconds since epoch)');

console.log('\n=== ToBoolean ===\n');

console.log('--- FALSY Values (Only 7!) ---');
console.log('Boolean(false):', Boolean(false));
console.log('Boolean(0):', Boolean(0));
console.log('Boolean(-0):', Boolean(-0));
console.log('Boolean(0n):', Boolean(0n), '(BigInt zero)');
console.log('Boolean(""):', Boolean(""), '(empty string)');
console.log('Boolean(null):', Boolean(null));
console.log('Boolean(undefined):', Boolean(undefined));
console.log('Boolean(NaN):', Boolean(NaN));

console.log('\n--- TRUTHY Values (Everything Else!) ---');
console.log('Boolean(true):', Boolean(true));
console.log('Boolean(1):', Boolean(1));
console.log('Boolean(-1):', Boolean(-1));
console.log('Boolean("0"):', Boolean("0"), '(non-empty string!)');
console.log('Boolean("false"):', Boolean("false"), '(non-empty string!)');
console.log('Boolean(" "):', Boolean(" "), '(whitespace is truthy!)');
console.log('Boolean([]):', Boolean([]), '(empty array is truthy!)');
console.log('Boolean({}):', Boolean({}), '(empty object is truthy!)');
console.log('Boolean(function(){}):', Boolean(function () { }), '(function is truthy)');
console.log('Boolean(new Boolean(false)):', Boolean(new Boolean(false)), '(object is truthy!)');

console.log('\n=== CONVERSION IN CONTEXT ===\n');

console.log('--- Unary Operators ---');
console.log('+true:', +true, '(ToNumber)');
console.log('+false:', +false);
console.log('+"":', +"");
console.log('+"42":', +"42");
console.log('-"5":', -"5", '(ToNumber then negate)');
console.log('!"hello":', !"hello", '(ToBoolean then NOT)');
console.log('!!"hello":', !!"hello", '(ToBoolean)');

console.log('\n--- Arithmetic Context ---');
console.log('"5" - 3:', "5" - 3, '(both ToNumber)');
console.log('"5" * "2":', "5" * "2");
console.log('"10" / "2":', "10" / "2");
console.log('null + 5:', null + 5, '(null → 0)');
console.log('true * 3:', true * 3, '(true → 1)');

console.log('\n--- String Context (+) ---');
console.log('42 + "":', 42 + "", '(number ToString)');
console.log('true + "!":', true + "!", '(boolean ToString)');
console.log('null + "value":', null + "value", '(null ToString)');

console.log('\n--- Boolean Context ---');
console.log('Truthy in if:');
if ("hello") console.log('  "hello" → true');
if (0) console.log('  should not print');
else console.log('  0 → false');

console.log('\nWith logical operators:');
console.log('"hello" && "world":', "hello" && "world", '(no coercion, returns value)');
console.log('0 || "default":', 0 || "default");

console.log('\n=== COMPARISON TABLE ===\n');

const testValues = [undefined, null, true, false, 0, 1, "", "0", "1", [], [0], {}];

console.log('Value\t\t\tToNumber\tToString\t\tToBoolean');
console.log('─'.repeat(70));

testValues.forEach(val => {
    const valStr = JSON.stringify(val) || String(val);
    const num = Number(val);
    const str = String(val);
    const bool = Boolean(val);

    console.log(`${valStr}\t\t${num}\t\t${str}\t\t\t${bool}`);
});

console.log('\n=== EDGE CASES ===\n');

console.log('--- Whitespace ---');
console.log('Number(" "):', Number(" "), '(whitespace → 0)');
console.log('Number("\\t\\n"):', Number("\t\n"), '(tabs/newlines → 0)');
console.log('Boolean(" "):', Boolean(" "), '(whitespace is truthy)');

console.log('\n--- Special Characters in Strings ---');
console.log('Number("1e3"):', Number("1e3"), '(scientific notation)');
console.log('Number("0xFF"):', Number("0xFF"), '(hex)');
console.log('Number("0o10"):', Number("0o10"), '(octal)');
console.log('Number("0b1010"):', Number("0b1010"), '(binary)');

console.log('\n--- Array Edge Cases ---');
console.log('Number([null]):', Number([null]), '([null] → "" → 0)');
console.log('Number([undefined]):', Number([undefined]), '([undefined] → "" → 0)');
console.log('String([null, undefined]):', String([null, undefined]), '(become empty in join)');

console.log('\n--- Object Edge Cases ---');
const noConversion = {
    valueOf() { return {}; },
    toString() { return {}; }
};

try {
    Number(noConversion);
} catch (e) {
    console.log('Number(obj with no primitive):', 'TypeError');
}

console.log('\n=== PRACTICAL PATTERNS ===\n');

console.log('--- Safe Number Conversion ---');
function toNumber(value) {
    const num = Number(value);
    return Number.isNaN(num) ? 0 : num;
}

console.log('toNumber("42 "):', toNumber("42"));
console.log('toNumber("abc"):', toNumber("abc"), '(defaults to 0)');

console.log('\n--- Safe Boolean Check ---');
function toBoolean(value) {
    return Boolean(value);
    // Or: return !!value;
}

console.log('toBoolean([]):', toBoolean([]));
console.log('toBoolean(0):', toBoolean(0));

console.log('\n=== KEY TAKEAWAYS ===');
console.log('ToNumber:');
console.log('  null → 0, undefined → NaN, true → 1, false → 0');
console.log('  "" → 0, non-numeric string → NaN');
console.log('  Objects use valueOf() → toString()');
console.log('\nToString:');
console.log('  Primitives → string representation');
console.log('  Arrays → join with comma');
console.log('  Objects → "[object Object]" (or custom toString)');
console.log('\nToBoolean:');
console.log('  Only 7 falsy values');
console.log('  Everything else (including [], {}) is truthy!');
