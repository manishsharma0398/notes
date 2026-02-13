// Example 2: Parameter Passing Behavior
// Demonstrates: Pass-by-value for all types (but value = reference for objects)

console.log('=== PRIMITIVES: Pass-by-Value ===\n');

function modifyPrimitive(x) {
    console.log('  Inside, before:', x);
    x = 999;
    console.log('  Inside, after:', x);
    return x;
}

let num = 42;
console.log('Before call:', num);
const result = modifyPrimitive(num);
console.log('After call:', num, '(unchanged)');
console.log('Returned:', result);

console.log('\n--- Why Primitives Are Unchanged ---');
console.log('1. Parameter x gets a COPY of the value 42');
console.log('2. x = 999 modifies the LOCAL copy');
console.log('3. Original num is unaffected');

console.log('\n=== OBJECTS: Pass-by-Value-of-Reference ===\n');

function modifyObject(obj) {
    console.log('  Inside, before:', obj);
    obj.value = 999;
    console.log('  Inside, after:', obj);
}

let myObj = { value: 42 };
console.log('Before call:', myObj);
modifyObject(myObj);
console.log('After call:', myObj, '(CHANGED!)');

console.log('\n--- Why Objects Are Modified ---');
console.log('1. Parameter obj gets a COPY of the REFERENCE');
console.log('2. Both myObj and obj point to SAME object');
console.log('3. Mutation through either affects the shared object');

console.log('\n=== REASSIGNMENT Inside Function ===\n');

function reassignObject(obj) {
    console.log('  Received:', obj);
    obj.value = 100;  // Mutates shared object
    console.log('  After mutation:', obj);

    obj = { value: 999 };  // Reassigns LOCAL parameter
    console.log('  After reassignment:', obj);
}

let object = { value: 42 };
console.log('Before call:', object);
reassignObject(object);
console.log('After call:', object);

console.log('\n--- Why Reassignment Doesn\'t Affect Original ---');
console.log('1. obj.value = 100 mutates the shared object → affects original');
console.log('2. obj = { value: 999 } reassigns the LOCAL variable');
console.log('3. Original still points to the old object');
console.log('4. The new object { value: 999 } is lost when function ends');

console.log('\n=== ARRAY PARAMETER MUTATION ===\n');

function appendToArray(arr) {
    arr.push('new item');
    console.log('  Inside:', arr);
}

const myArray = [1, 2, 3];
console.log('Before:', myArray);
appendToArray(myArray);
console.log('After:', myArray, '(modified!)');

console.log('\n=== ARRAY PARAMETER REASSIGNMENT ===\n');

function replaceArray(arr) {
    arr = [999];  // Reassigns local parameter
    console.log('  Inside:', arr);
}

const originalArray = [1, 2, 3];
console.log('Before:', originalArray);
replaceArray(originalArray);
console.log('After:', originalArray, '(unchanged)');

console.log('\n=== MULTIPLE PARAMETERS ===\n');

function swap(a, b) {
    console.log('  Inside, before swap: a =', a, 'b =', b);
    let temp = a;
    a = b;
    b = temp;
    console.log('  Inside, after swap: a =', a, 'b =', b);
}

let x = 10;
let y = 20;
console.log('Before swap: x =', x, 'y =', y);
swap(x, y);
console.log('After swap: x =', x, 'y =', y, '(unchanged - no real swap!)');

console.log('\n--- Why Swap Doesn\'t Work ---');
console.log('Parameters a and b are LOCAL copies');
console.log('Swapping them doesn\'t affect x and y');
console.log('This is because JavaScript is pass-by-value');

console.log('\n=== OBJECT SWAP (Also Doesn\'t Work) ===\n');

function swapObjects(obj1, obj2) {
    let temp = obj1;
    obj1 = obj2;
    obj2 = temp;
    console.log('  Inside: obj1 =', obj1, 'obj2 =', obj2);
}

let objA = { name: 'A' };
let objB = { name: 'B' };
console.log('Before:', { objA, objB });
swapObjects(objA, objB);
console.log('After:', { objA, objB }, '(unchanged)');

console.log('\n=== BUT... Mutating Properties Works ===\n');

function swapProperties(obj1, obj2) {
    const temp = obj1.name;
    obj1.name = obj2.name;
    obj2.name = temp;
}

let person1 = { name: 'Alice' };
let person2 = { name: 'Bob' };
console.log('Before:', { person1, person2 });
swapProperties(person1, person2);
console.log('After:', { person1, person2 }, '(swapped!)');

console.log('\n=== RETURNING NEW OBJECTS ===\n');

function createModified(obj) {
    // Don't mutate - return new object
    return { ...obj, modified: true };
}

const original = { value: 42 };
console.log('Original before:', original);

const modified = createModified(original);
console.log('Original after:', original, '(unchanged)');
console.log('Modified:', modified);

console.log('\n=== DEFENSIVE COPYING ===\n');

function processData(data) {
    // Create a copy to avoid mutating original
    const copy = { ...data };
    copy.processed = true;
    copy.timestamp = Date.now();
    return copy;
}

const userData = { name: 'Alice', age: 30 };
console.log('Original:', userData);

const processed = processData(userData);
console.log('Processed:', processed);
console.log('Original unchanged?', !userData.processed);

console.log('\n=== NESTED OBJECT GOTCHA ===\n');

function modifyNested(obj) {
    obj.nested.value = 999;
}

const config = {
    setting: 'default',
    nested: { value: 42 }
};

console.log('Before:', JSON.stringify(config, null, 2));
modifyNested(config);
console.log('After:', JSON.stringify(config, null, 2));
console.log('Nested object was mutated!');

console.log('\n=== DEFAULT PARAMETERS ===\n');

const defaultConfig = { timeout: 1000 };

function configure(options = defaultConfig) {
    options.modified = true;
    console.log('  Inside:', options);
}

console.log('Default before first call:', defaultConfig);
configure();
console.log('Default after first call:', defaultConfig, '(MUTATED!)');

configure();
console.log('Default after second call:', defaultConfig, '(same mutation)');

console.log('\n--- Fix: Create New Default Each Time ---');

function configureSafe(options) {
    const config = { timeout: 1000, ...options };
    config.modified = true;
    return config;
}

const result1 = configureSafe();
const result2 = configureSafe();
console.log('result1:', result1);
console.log('result2:', result2);
console.log('Independent?', result1 !== result2);

console.log('\n=== REST PARAMETERS ===\n');

function modifyRest(...items) {
    items.push('added');
    console.log('  Inside:', items);
}

const arr = [1, 2, 3];
console.log('Before:', arr);
modifyRest(...arr);
console.log('After:', arr, '(unchanged)');
console.log('Rest parameters create NEW array');

console.log('\n=== KEY TAKEAWAYS ===');
console.log('1. JavaScript is ALWAYS pass-by-value');
console.log('2. For primitives: value = actual data');
console.log('3. For objects: value = memory address (reference)');
console.log('4. Mutation affects original, reassignment doesn\'t');
console.log('5. Can\'t modify caller\'s variables (no true pass-by-reference)');
console.log('6. Use defensive copying to protect originals');
