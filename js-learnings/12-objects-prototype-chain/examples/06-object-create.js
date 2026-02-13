// Example 6: Object.create and Property Inheritance
// Demonstrates: Object.create, prototype-based property inheritance

console.log('=== Object.create() BASICS ===\n');

const proto = {
    greet() {
        return `Hello, I'm ${this.name}`;
    },
    type: 'Person'
};

const person = Object.create(proto);
person.name = 'Alice';

console.log('person.name:', person.name, '(own property)');
console.log('person.type:', person.type, '(inherited)');
console.log('person.greet():', person.greet());

console.log('\nPrototype chain:');
console.log('  person.__proto__ === proto:', person.__proto__ === proto);
console.log('  Object.getPrototypeOf(person) === proto:', Object.getPrototypeOf(person) === proto);

console.log('\n=== Creating with Property Descriptors ===\n');

const obj = Object.create(proto, {
    name: {
        value: 'Bob',
        writable: true,
        enumerable: true,
        configurable: true
    },
    id: {
        value: 123,
        writable: false,
        enumerable: true
    }
});

console.log('obj.name:', obj.name);
console.log('obj.id:', obj.id);
console.log('obj.type:', obj.type, '(from prototype)');

console.log('\n=== Object with No Prototype ===\n');

const dict = Object.create(null);
dict.toString = 'safe value';  // No conflict!
dict.hasOwnProperty = 'also safe';

console.log('dict:', dict);
console.log('dict.toString:', dict.toString);
console.log('typeof dict.toString:', typeof dict.toString);

console.log('\nNo prototype methods:');
console.log('  dict.__proto__:', dict.__proto__);
console.log(' Object.getPrototypeOf(dict):', Object.getPrototypeOf(dict));

console.log('\n=== Property Shadowing ===\n');

const base = {
    x: 1,
    y: 2,
    show() {
        return `x=${this.x}, y=${this.y}`;
    }
};

const derived = Object.create(base);

console.log('Before shadowing:');
console.log('  derived.x:', derived.x, '(from prototype)');
console.log('  derived.hasOwnProperty("x"):', derived.hasOwnProperty('x'));

derived.x = 10;  // Creates own property

console.log('\nAfter shadowing:');
console.log('  derived.x:', derived.x, '(own property)');
console.log('  derived.hasOwnProperty("x"):', derived.hasOwnProperty('x'));
console.log('  base.x:', base.x, '(unchanged)');

console.log('\n=== Non-Writable Prevents Shadowing ===\n');

const strictProto = {};
Object.defineProperty(strictProto, 'readonly', {
    value: 'cannot shadow',
    writable: false,
    enumerable: true,
    configurable: true
});

const strictObj = Object.create(strictProto);

console.log('strictObj.readonly:', strictObj.readonly);

strictObj.readonly = 'attempt to shadow';

console.log('After assignment:');
console.log('  strictObj.readonly:', strictObj.readonly, '(unchanged)');
console.log('  strictObj.hasOwnProperty("readonly"):', strictObj.hasOwnProperty('readonly'));
console.log('  Assignment failed silently!');

console.log('\n=== Accessor in Prototype ===\n');

const accessorProto = {
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

const accessorObj = Object.create(accessorProto);

console.log('Reading accessorObj.value:');
const val = accessorObj.value;
console.log('Result:', val);

console.log('\nSetting accessorObj.value = 42:');
accessorObj.value = 42;

console.log('\nChecking _value:');
console.log('  accessorObj._value:', accessorObj._value, '(own property created)');
console.log('  accessorProto._value:', accessorProto._value, '(unchanged)');

console.log('\n=== Multi-Level Inheritance ===\n');

const animal = {
    eat() {
        return `${this.name} is eating`;
    }
};

const mammal = Object.create(animal);
mammal.breathe = function () {
    return `${this.name} is breathing`;
};

const dog = Object.create(mammal);
dog.name = 'Rex';
dog.bark = function () {
    return 'Woof!';
};

console.log('dog.bark():', dog.bark());  // Own method
console.log('dog.breathe():', dog.breathe());  // From mammal
console.log('dog.eat():', dog.eat());  // From animal

console.log('\nPrototype chain:');
console.log('  dog → mammal → animal → Object.prototype → null');

console.log('\n=== Factory Pattern with Object.create ===\n');

function createPerson(name, age) {
    const personProto = {
        greet() {
            return `Hi, I'm ${this.name}, ${this.age} years old`;
        },

        haveBirthday() {
            this.age++;
            console.log(`  Happy birthday! Now ${this.age}`);
        }
    };

    return Object.create(personProto, {
        name: {
            value: name,
            writable: true,
            enumerable: true
        },
        age: {
            value: age,
            writable: true,
            enumerable: true
        }
    });
}

const alice = createPerson('Alice', 25);
const bob = createPerson('Bob', 30);

console.log('alice.greet():', alice.greet());
console.log('bob.greet():', bob.greet());

alice.haveBirthday();

console.log('\n=== Shared vs Own Properties ===\n');

const sharedProto = {
    shared: 'value from prototype',
    sharedArray: [1, 2, 3]
};

const obj1 = Object.create(sharedProto);
const obj2 = Object.create(sharedProto);

console.log('obj1.shared:', obj1.shared);
console.log('obj2.shared:', obj2.shared);
console.log('Same value:', obj1.shared === obj2.shared);

console.log('\nModifying inherited array:');
obj1.sharedArray.push(4);
console.log('  obj1.sharedArray:', obj1.sharedArray);
console.log('  obj2.sharedArray:', obj2.sharedArray);
console.log('  Both modified! (shared reference)');

console.log('\nShadowing creates own copy:');
obj1.shared = 'own value';
console.log('  obj1.shared:', obj1.shared);
console.log('  obj2.shared:', obj2.shared, '(unchanged)');

console.log('\n=== Prototype Pollution Defense ===\n');

const safeDict = Object.create(null);

// Safe to use any key
safeDict.constructor = 'value';
safeDict.toString = 'value';
safeDict.__proto__ = 'value';

console.log('All keys safe:', Object.keys(safeDict));

// No prototype pollution
console.log('No inherited properties:', Object.getPrototypeOf(safeDict));

console.log('\n=== Cloning with Inheritance ===\n');

function cloneWithProto(source) {
    return Object.create(
        Object.getPrototypeOf(source),
        Object.getOwnPropertyDescriptors(source)
    );
}

const original = Object.create(proto);
original.name = 'Original';
original.value = 42;

const clone = cloneWithProto(original);

console.log('clone.name:', clone.name);
console.log('clone.value:', clone.value);
console.log('clone.type:', clone.type, '(inherited from same prototype)');
console.log('Same prototype:', Object.getPrototypeOf(clone) === Object.getPrototypeOf(original));

console.log('\n=== Practical: Plugin System ===\n');

const pluginBase = {
    init() {
        console.log(`  Plugin "${this.name}" initialized`);
    },

    execute() {
        throw new Error('execute() must be implemented');
    }
};

function createPlugin(name, executeFn) {
    return Object.create(pluginBase, {
        name: {
            value: name,
            enumerable: true
        },
        execute: {
            value: executeFn,
            enumerable: true
        }
    });
}

const loggerPlugin = createPlugin('Logger', function () {
    console.log(`  [${this.name}] Logging...`);
});

const validatorPlugin = createPlugin('Validator', function (data) {
    console.log(`  [${this.name}] Validating...`);
    return data && typeof data === 'object';
});

loggerPlugin.init();
loggerPlugin.execute();

validatorPlugin.init();
console.log(`  Valid: ${validatorPlugin.execute({})}`);

console.log('\n=== KEY TAKEAWAYS ===');
console.log('1. Object.create(proto) creates object with proto as [[Prototype]]');
console.log('2. Object.create(null) has no prototype (no inherited methods)');
console.log('3. Second argument takes property descriptors');
console.log('4. Shadowing creates own property (hides prototype property)');
console.log('5. Non-writable in prototype prevents shadowing');
console.log('6. Accessor in prototype runs when accessed on descendant');
console.log('7. "this" in prototype methods refers to descendant object');
console.log('8. Useful for delegation and shared behavior');
console.log('9. Factory pattern with Object.create for cleaner code');
console.log('10. Object.create(null) prevents prototype pollution');
