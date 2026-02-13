// Example 3: Property Enumeration Methods
// Demonstrates: Different ways to enumerate properties and their differences

console.log('=== SETUP: Creating Test Object ===\n');

const proto = {
    protoEnum: 'enumerable in prototype',
};

Object.defineProperty(proto, 'protoNonEnum', {
    value: 'non-enumerable in prototype',
    enumerable: false
});

const obj = Object.create(proto);

obj.ownEnum1 = 'enumerable own 1';
obj.ownEnum2 = 'enumerable own 2';

Object.defineProperty(obj, 'ownNonEnum', {
    value: 'non-enumerable own',
    enumerable: false
});

const sym1 = Symbol('enumerable');
const sym2 = Symbol('non-enumerable');

obj[sym1] = 'symbol value 1';

Object.defineProperty(obj, sym2, {
    value: 'symbol value 2',
    enumerable: false
});

console.log('Object structure:');
console.log('  Own enumerable:', 'ownEnum1, ownEnum2');
console.log('  Own non-enumerable:', 'ownNonEnum');
console.log('  Own symbols:', 'Symbol(enumerable), Symbol(non-enumerable)');
console.log('  Prototype enumerable:', 'protoEnum');
console.log('  Prototype non-enumerable:', 'protoNonEnum');

console.log('\n=== for...in LOOP ===\n');

console.log('Includes: own + prototype, enumerable only, no symbols');
console.log('Results:');
for (let key in obj) {
    console.log(` ${key}`);
}

console.log('\nFiltered to own properties:');
for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
        console.log(`  ${key}`);
    }
}

console.log('\n=== Object.keys() ===\n');

console.log('Includes: own enumerable only, no symbols');
const keys = Object.keys(obj);
console.log('Results:', keys);

console.log('\n=== Object.values() ===\n');

console.log('Values of own enumerable properties:');
const values = Object.values(obj);
console.log('Results:', values);

console.log('\n=== Object.entries() ===\n');

console.log('[key, value] pairs of own enumerable:');
const entries = Object.entries(obj);
console.log('Results:', entries);

console.log('\n=== Object.getOwnPropertyNames() ===\n');

console.log('Includes: all own string properties (including non-enumerable), no symbols');
const allOwn = Object.getOwnPropertyNames(obj);
console.log('Results:', allOwn);

console.log('\n=== Object.getOwnPropertySymbols() ===\n');

console.log('Includes: all own symbol properties (including non-enumerable)');
const symbols = Object.getOwnPropertySymbols(obj);
console.log('Results:', symbols);
console.log('Symbol descriptions:', symbols.map(s => s.description));

console.log('\n=== Reflect.ownKeys() ===\n');

console.log('Includes: ALL own properties (strings + symbols, enumerable + non-enumerable)');
const allKeys = Reflect.ownKeys(obj);
console.log('Results:', allKeys);

console.log('\n=== COMPARISON TABLE ===\n');

console.log('Method                          | Own | Proto | Enum Only | Symbols');
console.log('--------------------------------|-----|-------|-----------|--------');
console.log('for...in                        | ✓   | ✓     | ✓         | ✗');
console.log('Object.keys()                   | ✓   | ✗     | ✓         | ✗');
console.log('Object.values()                 | ✓   | ✗     | ✓         | ✗');
console.log('Object.entries()                | ✓   | ✗     | ✓         | ✗');
console.log('Object.getOwnPropertyNames()    | ✓   | ✗     | ✗         | ✗');
console.log('Object.getOwnPropertySymbols()  | ✓   | ✗     | ✗         | ✓');
console.log('Reflect.ownKeys()               | ✓   | ✗     | ✗         | ✓');

console.log('\n=== PRACTICAL EXAMPLES ===\n');

console.log('--- Example 1: Cloning Enumerable Properties ---');
const source = { a: 1, b: 2 };
Object.defineProperty(source, 'hidden', {
    value: 3,
    enumerable: false
});

const clone1 = {};
for (let key in source) {
    if (source.hasOwnProperty(key)) {
        clone1[key] = source[key];
    }
}

console.log('Original:', source);
console.log('Clone (for...in):', clone1);
console.log('clone1.hidden:', clone1.hidden);

console.log('\n--- Example 2: Cloning ALL Properties ---');
const clone2 = {};
Object.getOwnPropertyNames(source).forEach(key => {
    const desc = Object.getOwnPropertyDescriptor(source, key);
    Object.defineProperty(clone2, key, desc);
});

console.log('Clone (with descriptors):', clone2);
console.log('clone2.hidden:', clone2.hidden);

console.log('\n--- Example 3: Safe Property Check ---');
const dict = Object.create(null);  // No prototype
dict.toString = 'value';  // Safe, no conflict

console.log('dict.toString:', dict.toString);
console.log('Can safely use any key:', dict);

console.log('\n--- Example 4: Metadata Properties ---');
class Config {
    constructor() {
        this.setting1 = 'value1';
        this.setting2 = 'value2';

        // Metadata (non-enumerable)
        Object.defineProperty(this, 'version', {
            value: '1.0.0',
            enumerable: false
        });

        Object.defineProperty(this, 'created', {
            value: new Date(),
            enumerable: false
        });
    }

    toJSON() {
        // Only enumerable properties
        return Object.keys(this).reduce((obj, key) => {
            obj[key] = this[key];
            return obj;
        }, {});
    }
}

const config = new Config();
console.log('JSON.stringify:', JSON.stringify(config));
console.log('All properties:', Reflect.ownKeys(config));

console.log('\n--- Example 5: Property Iteration Performance ---');
const large = {};
for (let i = 0; i < 1000; i++) {
    large[`prop${i}`] = i;
}

console.time('for...in');
let count1 = 0;
for (let key in large) {
    count1++;
}
console.timeEnd('for...in');

console.time('Object.keys');
const keys2 = Object.keys(large);
console.timeEnd('Object.keys');

console.log('Both counted:', count1, 'properties');

console.log('\n=== hasOwnProperty vs in ===\n');

const obj2 = Object.create({ inherited: 'from prototype' });
obj2.own = 'own property';

console.log('"own" in obj2:', 'own' in obj2);
console.log('"inherited" in obj2:', 'inherited' in obj2);
console.log('"notFound" in obj2:', 'notFound' in obj2);

console.log('\nobj2.hasOwnProperty("own"):', obj2.hasOwnProperty('own'));
console.log('obj2.hasOwnProperty("inherited"):', obj2.hasOwnProperty('inherited'));

console.log('\n--- Safe hasOwnProperty ---');
const noProto = Object.create(null);
noProto.x = 1;

// This fails:
try {
    noProto.hasOwnProperty('x');
} catch (e) {
    console.log('Error:', e.message);
}

// Safe methods:
console.log('Object.prototype.hasOwnProperty.call(noProto, "x"):',
    Object.prototype.hasOwnProperty.call(noProto, 'x'));
console.log('Object.hasOwn(noProto, "x"):', Object.hasOwn(no Proto, 'x'));

console.log('\n=== KEY TAKEAWAYS ===');
console.log('1. for...in includes prototype chain (use hasOwnProperty to filter)');
console.log('2. Object.keys() only own enumerable properties');
console.log('3. Object.getOwnPropertyNames() includes non-enumerable');
console.log('4. Object.getOwnPropertySymbols() for symbol properties');
console.log('5. Reflect.ownKeys() gets everything (strings + symbols)');
console.log('6. enumerable affects JSON.stringify and spread operator');
console.log('7. Use Object.hasOwn() instead of hasOwnProperty()');
console.log('8. "in" operator checks prototype chain');
console.log('9. Non-enumerable for metadata/internal properties');
console.log('10. Object.create(null) has no prototype pollution');
