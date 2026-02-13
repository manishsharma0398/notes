// Example 2: [[Get]] and [[Set]] Algorithms
// Demonstrates: How property access actually works internally

console.log('=== [[Get]] ALGORITHM ===\n');

console.log('--- Simple Property Access ---');
const obj1 = {
    x: 42,
    get y() {
        console.log('  Getter called for y');
        return this.x * 2;
    }
};

console.log('obj1.x:');
const val1 = obj1.x;
console.log('  Returned:', val1);

console.log('\nobj1.y:');
const val2 = obj1.y;
console.log('  Returned:', val2);

console.log('\nobj1.z (non-existent):');
const val3 = obj1.z;
console.log('  Returned:', val3);

console.log('\n--- [[Get]] with Prototype Chain ---');
const proto = {
    fromProto: 'inherited value'
};

const obj2 = Object.create(proto);
obj2.own = 'own value';

console.log('obj2.own:', obj2.own, '(own property)');
console.log('obj2.fromProto:', obj2.fromProto, '(from prototype)');
console.log('obj2.notFound:', obj2.notFound, '(nowhere)');

console.log('\n=== [[Set]] ALGORITHM ===\n');

console.log('--- Setting Own Property ---');
const obj3 = { x: 1 };
console.log('Before: obj3.x =', obj3.x);
obj3.x = 2;
console.log('After: obj3.x =', obj3.x);

console.log('\n--- Setting New Property ---');
console.log('Before: obj3.y =', obj3.y);
obj3.y = 10;
console.log('After: obj3.y =', obj3.y);

console.log('\n--- Shadowing Prototype Property ---');
const proto2 = { value: 'from prototype' };
const obj4 = Object.create(proto2);

console.log('Before assignment:');
console.log('  obj4.value:', obj4.value, '(inherited)');
console.log('  obj4.hasOwnProperty("value"):', obj4.hasOwnProperty('value'));

obj4.value = 'own property';

console.log('\nAfter assignment:');
console.log('  obj4.value:', obj4.value, '(own, shadows prototype)');
console.log('  obj4.hasOwnProperty("value"):', obj4.hasOwnProperty('value'));
console.log('  proto2.value:', proto2.value, '(unchanged)');

console.log('\n--- Non-Writable in Prototype Blocks Shadowing ---');
const proto3 = {};
Object.defineProperty(proto3, 'readonly', {
    value: 'cannot shadow',
    writable: false
});

const obj5 = Object.create(proto3);

console.log('obj5.readonly:', obj5.readonly, '(from prototype)');

obj5.readonly = 'trying to shadow';

console.log('After assignment:');
console.log('  obj5.readonly:', obj5.readonly, '(unchanged!)');
console.log('  obj5.hasOwnProperty("readonly"):', obj5.hasOwnProperty('readonly'));
console.log('  Assignment silently failed!');

console.log('\n--- Setter in Prototype ---');
const proto4 = {
    _value: 0,
    set value(val) {
        console.log('  Prototype setter called with', val);
        this._value = val;
    },
    get value() {
        return this._value;
    }
};

const obj6 = Object.create(proto4);

console.log('Setting obj6.value = 42:');
obj6.value = 42;

console.log('obj6._value:', obj6._value, '(created on obj6)');
console.log('proto4._value:', proto4._value, '(unchanged)');

console.log('\n--- Preventing Extensions ---');
const obj7 = { existing: 1 };
Object.preventExtensions(obj7);

console.log('obj7.existing:', obj7.existing);
obj7.existing = 2;
console.log('Modified existing:', obj7.existing);

obj7.newProp = 3;
console.log('Tried to add new:', obj7.newProp, '(failed)');

console.log('\n=== STRICT MODE DIFFERENCES ===\n');

console.log('--- Non-Writable Property ---');
const obj8 = {};
Object.defineProperty(obj8, 'x', {
    value: 1,
    writable: false
});

// Non-strict: silently fails
obj8.x = 2;
console.log('Non-strict mode: obj8.x =', obj8.x);

// Strict: throws TypeError
try {
    (function () {
        'use strict';
        obj8.x = 3;
    })();
} catch (e) {
    console.log('Strict mode error:', e.message);
}

console.log('\n--- Non-Extensible Object ---');
const obj9 = {};
Object.preventExtensions(obj9);

// Non-strict: silently fails
obj9.newProp = 'value';
console.log('Non-strict mode: obj9.newProp =', obj9.newProp);

// Strict: throws TypeError
try {
    (function () {
        'use strict';
        const strictObj = {};
        Object.preventExtensions(strictObj);
        strictObj.another = 'value';
    })();
} catch (e) {
    console.log('Strict mode error:', e.message);
}

console.log('\n=== PRACTICAL EXAMPLES ===\n');

console.log('--- Lazy Initialization ---');
const expensive = {
    get data() {
        if (!this._data) {
            console.log('  Computing expensive data...');
            this._data = { result: 42 };
        }
        return this._data;
    }
};

console.log('First access:');
expensive.data;
console.log('\nSecond access:');
expensive.data;
console.log('  No recomputation!');

console.log('\n--- Validation on Set ---');
const validated = {
    _age: 0,
    set age(val) {
        if (val < 0 || val > 150) {
            throw new RangeError('Age must be 0-150');
        }
        this._age = val;
    },
    get age() {
        return this._age;
    }
};

validated.age = 25;
console.log('Set valid age:', validated.age);

try {
    validated.age = 200;
} catch (e) {
    console.log('Invalid age rejected:', e.message);
}

console.log('\n--- Computed Properties ---');
const rectangle = {
    width: 10,
    height: 5,
    get area() {
        return this.width * this.height;
    },
    set area(val) {
        // Set width to maintain aspect ratio
        const ratio = this.width / this.height;
        this.height = Math.sqrt(val / ratio);
        this.width = val / this.height;
    }
};

console.log('Area:', rectangle.area);
rectangle.width = 20;
console.log('After width change:', rectangle.area);

console.log('\n=== KEY TAKEAWAYS ===');
console.log('1. [[Get]] checks own properties, then prototype chain');
console.log('2. [[Set]] creates own property (shadows prototype)');
console.log('3. Non-writable in prototype prevents shadowing');
console.log('4. Setter in prototype runs on descendant access');
console.log('5. preventExtensions blocks new properties');
console.log('6. Strict mode throws errors, non-strict fails silently');
console.log('7. Getter/setter run on every access');
console.log('8. this in getter/setter refers to object accessed on');
console.log('9. Prototype chain walk stops at first match');
console.log('10. Non-existent properties return undefined');
