// Example 5: Getters and Setters
// Demonstrates: Accessor properties for validation, computed values, and side effects

console.log('=== BASIC GETTERS AND SETTERS ===\n');

const obj1 = {
    _value: 0,

    get value() {
        console.log('  Getter called');
        return this._value;
    },

    set value(val) {
        console.log(`  Setter called with ${val}`);
        this._value = val;
    }
};

console.log('Reading value:');
const x = obj1.value;
console.log('Result:', x);

console.log('\nWriting value = 42:');
obj1.value = 42;

console.log('\n=== VALIDATION ===\n');

const user = {
    _age: 0,
    _email: '',

    get age() {
        return this._age;
    },

    set age(val) {
        if (typeof val !== 'number') {
            throw new TypeError('Age must be a number');
        }
        if (val < 0 || val > 150) {
            throw new RangeError('Age must be 0-150');
        }
        this._age = val;
    },

    get email() {
        return this._email;
    },

    set email(val) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            throw new Error('Invalid email format');
        }
        this._email = val;
    }
};

user.age = 25;
user.email = 'user@example.com';
console.log('Valid data:', { age: user.age, email: user.email });

try {
    user.age = 200;
} catch (e) {
    console.log('Age validation error:', e.message);
}

try {
    user.email = 'invalid';
} catch (e) {
    console.log('Email validation error:', e.message);
}

console.log('\n=== COMPUTED PROPERTIES ===\n');

const rectangle = {
    width: 10,
    height: 5,

    get area() {
        return this.width * this.height;
    },

    get perimeter() {
        return 2 * (this.width + this.height);
    },

    set area(val) {
        // Maintain aspect ratio
        const ratio = this.width / this.height;
        this.height = Math.sqrt(val / ratio);
        this.width = val / this.height;
    }
};

console.log('Dimensions:', rectangle.width, 'x', rectangle.height);
console.log('Area:', rectangle.area);
console.log('Perimeter:', rectangle.perimeter);

rectangle.width = 20;
console.log('\nAfter width = 20:');
console.log('Area:', rectangle.area);

rectangle.area = 100;
console.log('\nAfter area = 100:');
console.log('Dimensions:', rectangle.width.toFixed(2), 'x', rectangle.height.toFixed(2));

console.log('\n=== LAZY INITIALIZATION ===\n');

const expensive = {
    _cachedData: null,

    get data() {
        if (this._cachedData === null) {
            console.log('  Computing expensive data...');
            // Simulate expensive operation
            this._cachedData = { result: 42, timestamp: Date.now() };
        } else {
            console.log('  Returning cached data');
        }
        return this._cachedData;
    }
};

console.log('First access:');
expensive.data;

console.log('\nSecond access:');
expensive.data;

console.log('\n=== SIDE EFFECTS ===\n');

const logger = {
    _count: 0,
    _history: [],

    get value() {
        return this._count;
    },

    set value(val) {
        const old = this._count;
        this._count = val;

        // Side effect: logging
        this._history.push({
            old,
            new: val,
            timestamp: new Date()
        });

        console.log(`  Value changed: ${old} → ${val}`);
    }
};

logger.value = 10;
logger.value = 20;
logger.value = 30;

console.log('\nHistory:', logger._history.map(h => `${h.old}→${h.new}`));

console.log('\n=== DERIVED STATE ===\n');

const fullName = {
    firstName: '',
    lastName: '',

    get fullName() {
        return `${this.firstName} ${this.lastName}`.trim();
    },

    set fullName(val) {
        const parts = val.split(' ');
        this.firstName = parts[0] || '';
        this.lastName = parts.slice(1).join(' ');
    }
};

fullName.firstName = 'John';
fullName.lastName = 'Doe';
console.log('Full name:', fullName.fullName);

fullName.fullName = 'Jane Smith';
console.log('After setting fullName:');
console.log('  firstName:', fullName.firstName);
console.log('  lastName:', fullName.lastName);

console.log('\n=== READ-ONLY PROPERTIES ===\n');

const readonly = {
    _id: Math.random().toString(36),

    get id() {
        return this._id;
    }
    // No setter - read-only!
};

console.log(' ID:', readonly.id);
readonly.id = 'new-id';  // Silently ignored
console.log('After assignment:', readonly.id, '(unchanged)');

console.log('\n=== PRIVATE DATA PATTERN ===\n');

function createCounter() {
    let count = 0;  // Private variable

    return {
        get value() {
            return count;
        },

        increment() {
            count++;
        },

        decrement() {
            count--;
        },

        reset() {
            count = 0;
        }
    };
}

const counter = createCounter();
console.log('Count:', counter.value);
counter.increment();
counter.increment();
console.log('After increments:', counter.value);
counter.value = 999;  // Cannot set
console.log('After attempted set:', counter.value);

console.log('\n=== USING Object.defineProperty ===\n');

const obj2 = { _temp: 0 };

Object.defineProperty(obj2, 'temperature', {
    get() {
        return this._temp;
    },
    set(val) {
        if (val < -273.15) {  // Absolute zero
            throw new RangeError('Below absolute zero!');
        }
        this._temp = val;
    },
    enumerable: true,
    configurable: true
});

obj2.temperature = 25;
console.log('Temperature:', obj2.temperature);

try {
    obj2.temperature = -300;
} catch (e) {
    console.log('Error:', e.message);
}

console.log('\n=== GETTER/SETTER WITH INHERITANCE ===\n');

const base = {
    _value: 0,

    get value() {
        console.log('  Base getter');
        return this._value;
    },

    set value(val) {
        console.log('  Base setter');
        this._value = val;
    }
};

const derived = Object.create(base);
derived._value = 10;

console.log('derived.value:');
const y = derived.value;
console.log('Result:', y);

console.log('\nSetting derived.value = 20:');
derived.value = 20;
console.log('Creates own _value:', derived.hasOwnProperty('_value'));

console.log('\n=== PRACTICAL: Property Builder ===\n');

function addValidatedProperty(obj, propName, validator) {
    const privateName = `_${propName}`;
    obj[privateName] = undefined;

    Object.defineProperty(obj, propName, {
        get() {
            return this[privateName];
        },
        set(val) {
            if (!validator(val)) {
                throw new Error(`Invalid value for ${propName}`);
            }
            this[privateName] = val;
        },
        enumerable: true
    });
}

const product = {};
addValidatedProperty(product, 'price', val => val >= 0);
addValidatedProperty(product, 'quantity', val => Number.isInteger(val) && val >= 0);

product.price = 19.99;
product.quantity = 10;
console.log('Product:', product);

try {
    product.price = -5;
} catch (e) {
    console.log('Validation error:', e.message);
}

console.log('\n=== KEY TAKEAWAYS ===');
console.log('1. Getter = read access, Setter = write access');
console.log('2. Use for validation, computed values, side effects');
console.log('3. Getters run on every access (not cached by default)');
console.log('4. "this" refers to object property is accessed on');
console.log('5. No setter = read-only property');
console.log('6. Closure-based getters for true privacy');
console.log('7. Inherited getters/setters run on descendants');
console.log('8. Can define with literal syntax or defineProperty');
console.log('9. Useful for lazy initialization and caching');
console.log('10. Enable reactive/observable patterns');
