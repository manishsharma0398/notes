// Example 5: Truthy/Falsy and Logical Operators
// Demonstrates: Boolean conversion and short-circuit evaluation

console.log('=== FALSY VALUES (Only 7!) ===\n');

const falsyValues = [
    { value: false, name: 'false' },
    { value: 0, name: '0' },
    { value: -0, name: '-0' },
    { value: 0n, name: '0n (BigInt zero)' },
    { value: "", name: '"" (empty string)' },
    { value: null, name: 'null' },
    { value: undefined, name: 'undefined' },
    { value: NaN, name: 'NaN' }
];

console.log('All falsy values:');
falsyValues.forEach(({ value, name }) => {
    console.log(`  ${name.padEnd(25)} → Boolean:`, Boolean(value), '| Truthy:', !!value);
});

console.log('\n=== TRUTHY VALUES (Everything Else!) ===\n');

const truthyValues = [
    { value: true, name: 'true' },
    { value: 1, name: '1' },
    { value: -1, name: '-1' },
    { value: "0", name: '"0" (string)' },
    { value: "false", name: '"false" (string)' },
    { value: " ", name: '" " (whitespace)' },
    { value: [], name: '[] (empty array)' },
    { value: {}, name: '{} (empty object)' },
    { value: function () { }, name: 'function(){}' },
    { value: new Boolean(false), name: 'new Boolean(false)' },
    { value: new Number(0), name: 'new Number(0)' },
    { value: new String(""), name: 'new String("")' }
];

console.log('Common truthy values:');
truthyValues.forEach(({ value, name }) => {
    console.log(`  ${name.padEnd(25)} → Boolean:`, Boolean(value), '| Truthy:', !!value);
});

console.log('\n=== TRUTHY BUT == FALSE ===\n');

console.log('These are truthy (if statement) but == false:');
console.log('');

const confusingValues = [[], "0", "false", new Boolean(false)];

confusingValues.forEach(val => {
    const valStr = JSON.stringify(val) || String(val);
    console.log(`${valStr}:`);
    console.log(`  Truthy (if): ${!!val}`);
    console.log(`  == false: ${val == false}`);
    console.log(`  === false: ${val === false}`);
});

console.log('\nWhy? ToBoolean for "if", but ToPrimitive→ToNumber for ==');

console.log('\n=== LOGICAL OPERATORS ===\n');

console.log('--- && (AND) Returns Value, Not Boolean ---');
console.log('"hello" && "world":', "hello" && "world", '(last truthy)');
console.log('true && "yes":', true && "yes");
console.log('false && "yes":', false && "yes", '(first falsy)');
console.log('0 && "yes":', 0 && "yes");
console.log('"" && "yes":', "" && "yes");
console.log('"a" && "b" && "c":', "a" && "b" && "c");

console.log('\n--- || (OR) Returns Value, Not Boolean ---');
console.log('"hello" || "world":', "hello" || "world", '(first truthy)');
console.log('false || "yes":', false || "yes");
console.log('0 || "default":', 0 || "default");
console.log('null || undefined || "value":', null || undefined || "value");
console.log('"" || 0 || "fallback":', "" || 0 || "fallback");

console.log('\n--- ?? (Nullish Coalescing) ---');
console.log('null ?? "default":', null ?? "default");
console.log('undefined ?? "default":', undefined ?? "default");
console.log('0 ?? "default":', 0 ?? "default", '(0 is not nullish)');
console.log('"" ?? "default":', "" ?? "default", '("" is not nullish)');
console.log('false ?? "default":', false ?? "default", '(false is not nullish)');

console.log('\n=== SHORT-CIRCUIT EVALUATION ===\n');

console.log('--- && Short-Circuits on Falsy ---');
let counter1 = 0;
const result1 = false && (counter1++, "executed");
console.log('false && (counter1++, "executed"):', result1);
console.log('counter1:', counter1, '(not incremented!)');

let counter2 = 0;
const result2 = true && (counter2++, "executed");
console.log('true && (counter2++, "executed"):', result2);
console.log('counter2:', counter2, '(incremented)');

console.log('\n--- || Short-Circuits on Truthy ---');
let counter3 = 0;
const result3 = "value" || (counter3++, "executed");
console.log('"value" || (counter3++, "executed"):', result3);
console.log('counter3:', counter3, '(not incremented!)');

let counter4 = 0;
const result4 = false || (counter4++, "executed");
console.log('false || (counter4++, "executed"):', result4);
console.log('counter4:', counter4, '(incremented)');

console.log('\n=== PRACTICAL PATTERNS ===\n');

console.log('--- Default Values ---');
function greet(name) {
    const userName = name || "Guest";
    console.log(`  Hello, ${userName}!`);
}

greet("Alice");
greet();
greet("");  // Watch out: empty string is falsy!

console.log('\n--- Safer Default with ?? ---');
function greetSafe(name) {
    const userName = name ?? "Guest";
    console.log(`  Hello, ${userName}!`);
}

greetSafe("Alice");
greetSafe();
greetSafe("");  // Empty string preserved!

console.log('\n--- Guard Clauses ---');
function processUser(user) {
    if (!user) {
        console.log('  No user provided');
        return;
    }

    if (!user.name) {
        console.log('  User has no name');
        return;
    }

    console.log(`  Processing ${user.name}`);
}

processUser(null);
processUser({});
processUser({ name: "Alice" });

console.log('\n--- Optional Method Calling ---');
const obj = {
    method: null,
    safeMethod: function () { return "result"; }
};

// obj.method && obj.method();  // Safe, won't call if falsy
const result5 = obj.safeMethod && obj.safeMethod();
console.log('obj.safeMethod && obj.safeMethod():', result5);

console.log('\n--- Feature Detection ---');
const hasLocalStorage = typeof localStorage !== 'undefined' && localStorage;
console.log('Has localStorage:', !!hasLocalStorage);

console.log('\n--- Memoization Guard ---');
const cache = {};

function expensiveOperation(key) {
    return cache[key] || (cache[key] = `computed-${key}`);
}

console.log('First call:', expensiveOperation("a"));
console.log('Second call:', expensiveOperation("a"), '(from cache)');

console.log('\n=== GOTCHAS ===\n');

console.log('--- Empty Array in Boolean Context ---');
const arr = [];

if (arr) {
    console.log('if (arr): executes ([] is truthy)');
}

if (arr.length) {
    console.log('if (arr.length): should not execute');
} else {
    console.log('if (arr.length): 0 is falsy');
}

console.log('\nBetter check:');
if (arr.length > 0) {
    console.log('Has items');
} else {
    console.log('Empty array');
}

console.log('\n--- Empty Object Check ---');
const obj2 = {};

if (obj2) {
    console.log('if (obj2): executes ({} is truthy)');
}

if (Object.keys(obj2).length) {
    console.log('Has properties');
} else {
    console.log('Empty object');
}

console.log('\n--- "0" Confusion ---');
const value = "0";

if (value) {
    console.log('if ("0"): executes (truthy)');
}

if (value == false) {
    console.log('if ("0" == false): executes! ("0" → 0)');
}

console.log('\n--- null vs undefined with || ---');
function getValue(provided) {
    return provided || "default";
}

console.log('getValue(null):', getValue(null));
console.log('getValue(undefined):', getValue(undefined));
console.log('getValue(0):', getValue(0), '(OOPS! 0 is falsy)');

function getValueSafe(provided) {
    return provided ?? "default";
}

console.log('\nWith ??:');
console.log('getValueSafe(0):', getValueSafe(0), '(preserved!)');

console.log('\n=== COMBINING OPERATORS ===\n');

console.log('--- Chaining ---');
const config = {
    user: {
        preferences: {
            theme: "dark"
        }
    }
};

const theme = config && config.user && config.user.preferences && config.user.preferences.theme;
console.log('Chained &&:', theme);

// Modern: optional chaining
const themeSafe = config?.user?.preferences?.theme;
console.log('Optional chaining:', themeSafe);

console.log('\n--- Mixed Operators ---');
console.log('false || null && "value":', false || null && "value");
console.log('Evaluation:  null && "value" → null, then false || null → null');

console.log('\n=== TERNARY WITH TRUTHY/FALSY ===\n');

function getStatus(value) {
    return value ? "Has value" : "No value";
}

console.log('getStatus("hello"):', getStatus("hello"));
console.log('getStatus(0):', getStatus(0), '(0 is falsy)');
console.log('getStatus([]):', getStatus([]), '([] is truthy)');

console.log('\n=== CONVERTING TO BOOLEAN ===\n');

console.log('--- Different Methods ---');
const value2 = "hello";

console.log('Boolean(value):', Boolean(value2));
console.log('!!value:', !!value2, '(idiomatic)');
console.log('value ? true : false:', value2 ? true : false, '(verbose)');

console.log('\n=== KEY TAKEAWAYS ===');
console.log('1. Only 7 falsy values: false, 0, -0, 0n, "", null, undefined, NaN');
console.log('2. Everything else is truthy (including [], {})');
console.log('3. && and || return values, not booleans');
console.log('4. && short-circuits on first falsy');
console.log('5. || short-circuits on first truthy');
console.log('6. ?? only checks for null/undefined');
console.log('7. Truthy ≠ == true ([] is truthy but != true)');
console.log('8. Use !! for explicit boolean conversion');
console.log('9. Check array.length, not just array');
console.log('10. Prefer ?? over || for nullable defaults');
