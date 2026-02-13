// Example 4: Object.freeze, seal, and preventExtensions
// Demonstrates: Different levels of immutability

console.log('=== Object.preventExtensions() ===\n');

const obj1 = { x: 1, y: 2 };
Object.preventExtensions(obj1);

console.log('Can modify existing:', obj1.x = 10, '→', obj1.x);
console.log('Can delete existing:', delete obj1.y, '→ y:', obj1.y);
console.log('Cannot add new:', obj1.z = 3, '→ z:', obj1.z);
console.log('isExtensible:', Object.isExtensible(obj1));

console.log('\n=== Object.seal() ===\n');

const obj2 = { x: 1, y: 2 };
Object.seal(obj2);

console.log('Can modify existing:', obj2.x = 10, '→', obj2.x);
console.log('Cannot delete:', delete obj2.y, '→ y:', obj2.y);
console.log('Cannot add new:', obj2.z = 3, '→ z:', obj2.z);
console.log('isSealed:', Object.isSealed(obj2));
console.log('isExtensible:', Object.isExtensible(obj2));

console.log('\nProperty descriptors after seal:');
const desc = Object.getOwnPropertyDescriptor(obj2, 'x');
console.log('  writable:', desc.writable);
console.log('  configurable:', desc.configurable);

console.log('\n=== Object.freeze() ===\n');

const obj3 = { x: 1, y: 2, nested: { z: 3 } };
Object.freeze(obj3);

console.log('Cannot modify:', obj3.x = 10, '→', obj3.x);
console.log('Cannot delete:', delete obj3.y, '→ y:', obj3.y);
console.log('Cannot add:', obj3.w = 4, '→ w:', obj3.w);
console.log('isFrozen:', Object.isFrozen(obj3));

console.log('\nBut nested objects NOT frozen:');
obj3.nested.z = 999;
console.log('  nested.z:', obj3.nested.z);

console.log('\n=== Deep Freeze ===\n');

function deepFreeze(obj) {
    Object.freeze(obj);

    Object.getOwnPropertyNames(obj).forEach(prop => {
        if (obj[prop] !== null && typeof obj[prop] === 'object') {
            deepFreeze(obj[prop]);
        }
    });

    return obj;
}

const obj4 = {
    a: 1,
    b: {
        c: 2,
        d: {
            e: 3
        }
    }
};

deepFreeze(obj4);

obj4.a = 10;
obj4.b.c = 20;
obj4.b.d.e = 30;

console.log('After deep freeze:', JSON.stringify(obj4, null, 2));
console.log('All levels frozen!');

console.log('\n=== Comparison Table ===\n');

console.log('Operation         | preventExtensions | seal | freeze');
console.log('------------------|-------------------|------|-------');
console.log('Add properties    | ✗                 | ✗    | ✗');
console.log('Delete properties | ✓                 | ✗    | ✗');
console.log('Modify values     | ✓                 | ✓    | ✗');
console.log('Reconfigure       | ✓                 | ✗    | ✗');

console.log('\n=== Strict Mode Differences ===\n');

console.log('Non-strict: operations fail silently');
console.log('Strict: operations throw TypeError');

try {
    (function () {
        'use strict';
        const frozen = Object.freeze({ x: 1 });
        frozen.x = 2;
    })();
} catch (e) {
    console.log('Strict mode error:', e.message);
}

console.log('\n=== Practical Patterns ===\n');

console.log('--- Constants Object ---');
const CONSTANTS = Object.freeze({
    API_KEY: '12345',
    MAX_RETRIES: 3,
    TIMEOUT: 5000
});

console.log('CONSTANTS:', CONSTANTS);
CONSTANTS.API_KEY = 'hacked';
console.log('After attack:', CONSTANTS.API_KEY, '(protected)');

console.log('\n--- Configuration Object ---');
const config = Object.freeze({
    development: {
        host: 'localhost',
        port: 3000
    },
    production: {
        host: 'example.com',
        port: 80
    }
});

// Top level frozen, but nested not
config.development.port = 9999;
console.log('Nested modified:', config.development.port);

console.log('\n--- Immutable Data Structures ---');
function createImmutablePoint(x, y) {
    return Object.freeze({ x, y });
}

const point1 = createImmutablePoint(10, 20);
const point2 = Object.freeze({
    ...point1,
    x: 30  // Create new with modified x
});

console.log('point1:', point1);
console.log('point2:', point2);
console.log('Different objects:', point1 !== point2);

console.log('\n=== Checking Immutability ===\n');

const obj5 = { a: 1 };

console.log('Before any operation:');
console.log('  isExtensible:', Object.isExtensible(obj5));
console.log('  isSealed:', Object.isSealed(obj5));
console.log('  isFrozen:', Object.isFrozen(obj5));

Object.preventExtensions(obj5);
console.log('\nAfter preventExtensions:');
console.log('  isExtensible:', Object.isExtensible(obj5));
console.log('  isSealed:', Object.isSealed(obj5));
console.log('  isFrozen:', Object.isFrozen(obj5));

const obj6 = { b: 2 };
Object.seal(obj6);
console.log('\nAfter seal:');
console.log('  isExtensible:', Object.isExtensible(obj6));
console.log('  isSealed:', Object.isSealed(obj6));
console.log('  isFrozen:', Object.isFrozen(obj6));

const obj7 = { c: 3 };
Object.freeze(obj7);
console.log('\nAfter freeze:');
console.log('  isExtensible:', Object.isExtensible(obj7)); console.log('  isSealed:', Object.isSealed(obj7));
console.log('  isFrozen:', Object.isFrozen(obj7));

console.log('\n=== Performance Considerations ===\n');

const large = {};
for (let i = 0; i < 10000; i++) {
    large[`prop${i}`] = i;
}

console.time('freeze');
Object.freeze(large);
console.timeEnd('freeze');

console.log('Freezing large objects has overhead');
console.log('Use selectively for critical data');

console.log('\n=== KEY TAKEAWAYS ===');
console.log('1. preventExtensions: cannot add properties');
console.log('2. seal: cannot add/delete properties');
console.log('3. freeze: cannot add/delete/modify');
console.log('4. All are shallow (nested objects not affected)');
console.log('5. Use deepFreeze for complete immutability');
console.log('6. Strict mode throws errors, non-strict silent');
console.log('7. frozen → sealed → preventExtensions (implications)');
console.log('8. Good for constants and configuration');
console.log('9. Check with isExtensible/isSealed/isFrozen');
console.log('10. Performance cost for large objects');
