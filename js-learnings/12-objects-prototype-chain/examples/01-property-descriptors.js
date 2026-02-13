// Example 1: Property Descriptors and Object.defineProperty
// Demonstrates: How property attributes control behavior

console.log('=== PROPERTY DESCRIPTORS ===\n');

console.log('--- Default Descriptors (Object Literal) ---');
const obj1 = { x: 42 };

const desc1 = Object.getOwnPropertyDescriptor(obj1, 'x');
console.log('Descriptor for obj1.x:', desc1);
console.log('  value:', desc1.value);
console.log('  writable:', desc1.writable);
console.log('  enumerable:', desc1.enumerable);
console.log('  configurable:', desc1.configurable);
console.log('  All true by default for literals!');

console.log('\n--- Default Descriptors (Object.defineProperty) ---');
const obj2 = {};
Object.defineProperty(obj2, 'y', {
    value: 100
});

const desc2 = Object.getOwnPropertyDescriptor(obj2, 'y');
console.log('Descriptor for obj2.y:', desc2);
console.log('  All attributes default to FALSE with defineProperty!');

console.log('\n=== DATA PROPERTIES ===\n');

const obj3 = {};

Object.defineProperty(obj3, 'readonly', {
    value: 'cannot change',
    writable: false,
    enumerable: true,
    configurable: true
});

console.log('obj3.readonly:', obj3.readonly);
obj3.readonly = 'new value';
console.log('After assignment:', obj3.readonly, '(unchanged)');

console.log('\n--- writable: false (Strict Mode TypeError) ---');
try {
    'use strict';
    const strictObj = {};
    Object.defineProperty(strictObj, 'x', {
        value: 1,
        writable: false
    });
    strictObj.x = 2;  // TypeError in strict mode
} catch (e) {
    console.log('Error in strict mode:', e.message);
}

console.log('\n=== ACCESSOR PROPERTIES ===\n');

const obj4 = {
    _internal: 0
};

Object.defineProperty(obj4, 'value', {
    get() {
        console.log('  Getter called');
        return this._internal;
    },
    set(val) {
        console.log(`  Setter called with ${val}`);
        this._internal = val;
    },
    enumerable: true,
    configurable: true
});

console.log('Reading obj4.value:');
const x = obj4.value;

console.log('\nWriting obj4.value = 42:');
obj4.value = 42;

console.log('\nFinal value:', obj4.value);

console.log('\n=== enumerable ATTRIBUTE ===\n');

const obj5 = {
    visible: 1
};

Object.defineProperty(obj5, 'hidden', {
    value: 2,
    enumerable: false
});

console.log('for...in loop:');
for (let key in obj5) {
    console.log(' ', key);  // Only 'visible'
}

console.log('\nObject.keys():', Object.keys(obj5));  // ['visible']
console.log('obj5.hidden:', obj5.hidden, '(still accessible!)');
console.log('Object.getOwnPropertyNames():', Object.getOwnPropertyNames(obj5));

console.log('\n=== configurable ATTRIBUTE ===\n');

const obj6 = {};

Object.defineProperty(obj6, 'permanent', {
    value: 'cannot delete or reconfigure',
    writable: true,
    enumerable: true,
    configurable: false
});

console.log('Trying to delete permanent property:');
delete obj6.permanent;
console.log('  Still there:', obj6.permanent);

console.log('\nTrying to reconfigure:');
try {
    Object.defineProperty(obj6, 'permanent', {
        enumerable: false  // Try to change
    });
} catch (e) {
    console.log('  Error:', e.message);
}

console.log('\n=== SPECIAL CASE: writable true → false ===\n');

const obj7 = {};
Object.defineProperty(obj7, 'special', {
    value: 1,
    writable: true,
    configurable: false  // Cannot reconfigure
});

console.log('Can change writable from true to false:');
Object.defineProperty(obj7, 'special', {
    writable: false  // Allowed even though configurable is false!
});
console.log('  Success! Now writable:', Object.getOwnPropertyDescriptor(obj7, 'special').writable);

console.log('\nBut cannot go back (false → true):');
try {
    Object.defineProperty(obj7, 'special', {
        writable: true
    });
} catch (e) {
    console.log('  Error:', e.message);
}

console.log('\n=== MULTIPLE PROPERTIES ===\n');

const obj8 = {};

Object.defineProperties(obj8, {
    x: {
        value: 1,
        writable: true,
        enumerable: true
    },
    y: {
        value: 2,
        writable: false,
        enumerable: true
    },
    z: {
        get() { return this.x + this.y; },
        enumerable: true
    }
});

console.log('obj8:', obj8);
console.log('obj8.z (computed):', obj8.z);

console.log('\n=== COMMON PATTERNS ===\n');

console.log('--- Read-Only Properties ---');
function createCounter() {
    let count = 0;

    return Object.defineProperties({}, {
        value: {
            get() { return count; },
            enumerable: true
        },
        increment: {
            value() { count++; },
            enumerable: true
        }
    });
}

const counter = createCounter();
console.log('counter.value:', counter.value);
counter.increment();
counter.increment();
console.log('After increments:', counter.value);
counter.value = 999;  // Ignored (only getter, no setter)
console.log('Cannot set directly:', counter.value);

console.log('\n--- Validation with Setters ---');
const user = {
    _age: 0
};

Object.defineProperty(user, 'age', {
    get() {
        return this._age;
    },
    set(val) {
        if (typeof val !== 'number' || val < 0 || val > 150) {
            throw new RangeError('Invalid age');
        }
        this._age = val;
    },
    enumerable: true
});

user.age = 25;
console.log('user.age:', user.age);

try {
    user.age = 200;
} catch (e) {
    console.log('Validation error:', e.message);
}

console.log('\n=== KEY TAKEAWAYS ===');
console.log('1. Two property types: data (value) and accessor (get/set)');
console.log('2. Object literal: all attributes default to true');
console.log('3. defineProperty: all attributes default to false');
console.log('4. writable controls reassignment, not mutation');
console.log('5. enumerable controls for...in and Object.keys');
console.log('6. configurable controls deletion and reconfiguration');
console.log('7. Can change writable true→false even if !configurable');
console.log('8. Accessors run functions instead of storing values');
console.log('9. Use getOwnPropertyDescriptor to inspect');
console.log('10. Use defineProperty for precise control');
