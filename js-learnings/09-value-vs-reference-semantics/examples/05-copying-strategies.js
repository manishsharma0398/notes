// Example 5: Copying Strategies (Shallow vs Deep)
// Demonstrates: Different ways to copy and their implications

console.log('=== PRIMITIVES: Always Deep Copy ===\n');

let num1 = 42;
let num2 = num1;  // Always creates independent copy

num2 = 100;
console.log('num1:', num1, '| num2:', num2, '(independent)');

console.log('\n=== SHALLOW COPY: Objects ===\n');

const original = {
    name: 'Alice',
    age: 30,
    nested: { city: 'New York' }
};

console.log('Original:', JSON.stringify(original, null, 2));

console.log('\n--- Method 1: Object Spread {...} ---');
const copy1 = { ...original };

copy1.name = 'Bob';  // Doesn't affect original
copy1.nested.city = 'Boston';  // AFFECTS original!

console.log('copy1:', JSON.stringify(copy1, null, 2));
console.log('original:', JSON.stringify(original, null, 2));
console.log('original.nested changed!');

console.log('\n--- Method 2: Object.assign() ---');
const original2 = {
    name: 'Charlie',
    nested: { value: 1 }
};

const copy2 = Object.assign({}, original2);

copy2.name = 'David';  // Independent
copy2.nested.value = 999;  // Shared!

console.log('copy2:', copy2);
console.log('original2:', original2);

console.log('\n=== SHALLOW COPY: Arrays ===\n');

const arr1 = [1, 2, [3, 4]];
console.log('Original array:', arr1);

console.log('\n--- Method 1: Array Spread [...] ---');
const arrCopy1 = [...arr1];

arrCopy1[0] = 999;  // Independent
arrCopy1[2][0] = 999;  // Shared!

console.log('arrCopy1:', arrCopy1);
console.log('arr1:', arr1, '(nested array changed!)');

console.log('\n--- Method 2: slice() ---');
const arr2 = [1, 2, [3, 4]];
const arrCopy2 = arr2.slice();

arrCopy2[1] = 888;  // Independent
arrCopy2[2][1] = 888;  // Shared!

console.log('arrCopy2:', arrCopy2);
console.log('arr2:', arr2);

console.log('\n--- Method 3: Array.from() ---');
const arr3 = [1, 2, { x: 3 }];
const arrCopy3 = Array.from(arr3);

arrCopy3[0] = 777;  // Independent
arrCopy3[2].x = 777;  // Shared!

console.log('arrCopy3:', arrCopy3);
console.log('arr3:', arr3);

console.log('\n=== WHY Shallow Copy Has This Behavior ===\n');

console.log('Shallow copy memory diagram:');
console.log(`
original:   { name: "Alice", nested: [0xFF00] }
                                         │
copy:       { name: "Alice", nested: [0xFF00] }
                                         │
                                         └──→ { city: "New York" }

- Top-level properties (name) are copied
- Nested objects: only the REFERENCE is copied
- Both point to the SAME nested object
`);

console.log('\n=== DEEP COPY Methods ===\n');

const original3 = {
    name: 'Alice',
    age: 30,
    address: {
        city: 'New York',
        zip: '10001'
    },
    hobbies: ['reading', 'coding']
};

console.log('Original:', JSON.stringify(original3, null, 2));

console.log('\n--- Method 1: structuredClone() [ES2022, RECOMMENDED] ---');
const deepCopy1 = structuredClone(original3);

deepCopy1.name = 'Bob';
deepCopy1.address.city = 'Boston';
deepCopy1.hobbies.push('gaming');

console.log('\ndeepCopy1:', JSON.stringify(deepCopy1, null, 2));
console.log('original3:', JSON.stringify(original3, null, 2));
console.log('Original completely unchanged!');

console.log('\n--- Method 2: JSON.parse(JSON.stringify()) [LIMITATIONS] ---');
const original4 = {
    name: 'Charlie',
    date: new Date(),
    nested: { value: 42 }
};

const deepCopy2 = JSON.parse(JSON.stringify(original4));

deepCopy2.nested.value = 999;

console.log('deepCopy2:', deepCopy2);
console.log('original4:', original4);
console.log('Nested object independent!');

console.log('\n--- JSON Method Limitations ---');
const problematic = {
    func: function () { },
    undef: undefined,
    date: new Date(),
    regex: /test/,
    circular: null
};
// problematic.circular = problematic;  // Would cause error

const jsonCopy = JSON.parse(JSON.stringify(problematic));
console.log('Original:', problematic);
console.log('JSON copy:', jsonCopy);
console.log('LOST: function, undefined, Date becomes string, regex becomes {}');

console.log('\n--- Method 3: Custom Deep Clone ---');

function deepClone(obj, seen = new WeakMap()) {
    // Handle primitives and null
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    // Handle circular references
    if (seen.has(obj)) {
        return seen.get(obj);
    }

    // Handle Date
    if (obj instanceof Date) {
        return new Date(obj);
    }

    // Handle RegExp
    if (obj instanceof RegExp) {
        return new RegExp(obj);
    }

    // Handle Array
    if (Array.isArray(obj)) {
        const arrCopy = [];
        seen.set(obj, arrCopy);
        obj.forEach((item, index) => {
            arrCopy[index] = deepClone(item, seen);
        });
        return arrCopy;
    }

    // Handle Object
    const objCopy = {};
    seen.set(obj, objCopy);
    Object.keys(obj).forEach(key => {
        objCopy[key] = deepClone(obj[key], seen);
    });

    return objCopy;
}

const complex = {
    name: 'Test',
    date: new Date('2024-01-01'),
    regex: /test/gi,
    nested: {
        array: [1, 2, { deep: 'value' }]
    }
};

const cloned = deepClone(complex);
cloned.nested.array[2].deep = 'modified';

console.log('Original complex:', complex);
console.log('Cloned:', cloned);
console.log('Date preserved?', cloned.date instanceof Date);
console.log('RegExp preserved?', cloned.regex instanceof RegExp);

console.log('\n=== CIRCULAR REFERENCES ===\n');

const circular = { name: 'Circular' };
circular.self = circular;

console.log('Circular object created');

// JSON method fails
try {
    JSON.parse(JSON.stringify(circular));
} catch (e) {
    console.log('JSON.stringify ERROR:', e.message);
}

// structuredClone handles it
const circularCopy = structuredClone(circular);
console.log('structuredClone: Success!');
console.log('circularCopy.self === circularCopy:', circularCopy.self === circularCopy);

// Custom deepClone handles it
const circularCopy2 = deepClone(circular);
console.log('deepClone: Success!');
console.log('circularCopy2.self === circularCopy2:', circularCopy2.self === circularCopy2);

console.log('\n=== PERFORMANCE COMPARISON ===\n');

const largeObj = {
    data: Array(1000).fill(0).map((_, i) => ({
        id: i,
        nested: { value: i * 2 }
    }))
};

console.log('Copying object with 1000 nested items...\n');

console.time('Shallow copy (spread)');
const shallow = { ...largeObj };
console.timeEnd('Shallow copy (spread)');

console.time('structuredClone');
const deep1 = structuredClone(largeObj);
console.timeEnd('structuredClone');

console.time('JSON method');
const deep2 = JSON.parse(JSON.stringify(largeObj));
console.timeEnd('JSON method');

console.log('\nNote: Times vary, but generally:');
console.log('Shallow copy: Fastest (only copies references)');
console.log('structuredClone: Fast, handles most cases');
console.log('JSON method: Slower, has limitations');
console.log('Custom deep clone: Slowest, most flexible');

console.log('\n=== WHEN TO USE EACH ===\n');

console.log('SHALLOW COPY ({...obj}, [...arr]):');
console.log('✓ Fast and simple');
console.log('✓ No nested objects');
console.log('✓ Only need top-level independence');
console.log('✗ Nested objects still shared');

console.log('\nDEEP COPY (structuredClone):');
console.log('✓ Complete independence');
console.log('✓ Handles most types (Date, RegExp, etc.)');
console.log('✓ Handles circular references');
console.log('✗ Doesn\'t copy functions');
console.log('✗ Not supported in older browsers');

console.log('\nJSON METHOD:');
console.log('✓ Works in all environments');
console.log('✓ Deep copy for plain objects');
console.log('✗ Loses functions, undefined, symbols');
console.log('✗ Dates become strings');
console.log('✗ No circular references');

console.log('\n=== PRACTICAL EXAMPLES ===\n');

console.log('--- Example 1: Config Object ---');
const defaultConfig = {
    timeout: 5000,
    retries: 3,
    endpoint: 'https://api.example.com'
};

// Shallow copy is fine (no nested objects)
const userConfig = { ...defaultConfig, timeout: 10000 };
console.log('User config:', userConfig);

console.log('\n--- Example 2: Complex State ---');
const appState = {
    user: { name: 'Alice', prefs: { theme: 'dark' } },
    data: [1, 2, 3]
};

// Need deep copy
const newState = structuredClone(appState);
newState.user.prefs.theme = 'light';
newState.data.push(4);

console.log('Original state:', JSON.stringify(appState));
console.log('New state:', JSON.stringify(newState));

console.log('\n--- Example 3: Defensive Copying ---');
function processUser(user) {
    // Protect original from mutations
    const userCopy = structuredClone(user);
    userCopy.processed = true;
    userCopy.timestamp = Date.now();
    return userCopy;
}

const originalUser = { id: 1, name: 'Bob' };
const processed = processUser(originalUser);

console.log('Original user:', originalUser);
console.log('Processed:', processed);

console.log('\n=== KEY TAKEAWAYS ===');
console.log('1. Shallow copy: {...obj} or [...arr]');
console.log('   - Fast, simple');
console.log('   - Nested objects SHARED');
console.log('');
console.log('2. Deep copy: structuredClone() [RECOMMENDED]');
console.log('   - Complete independence');
console.log('   - Handles most types and circular refs');
console.log('');
console.log('3. JSON method: JSON.parse(JSON.stringify())');
console.log('   - Has limitations (functions, dates, etc.)');
console.log('   - Use only for plain objects');
console.log('');
console.log('4. Choose based on:');
console.log('   - Data structure complexity');
console.log('   - Performance needs');
console.log('   - Browser support requirements');
