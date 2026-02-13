// Example 4: Functions as Constructors
// Demonstrates: Using functions with `new` keyword

console.log('=== Basic Constructor Function ===');

function Person(name, age) {
    this.name = name;
    this.age = age;
}

const alice = new Person("Alice", 30);
const bob = new Person("Bob", 25);

console.log('alice:', alice);
console.log('bob:', bob);
console.log('alice instanceof Person:', alice instanceof Person);

console.log('\n=== What `new` Does ===');

function MyConstructor(value) {
    console.log('  1. this is a new empty object:', typeof this);
    console.log('  2. this.__proto__ === MyConstructor.prototype:',
        this.__proto__ === MyConstructor.prototype);

    this.value = value;
    console.log('  3. Added property to this');

    // 4. Implicitly returns this (unless we explicitly return an object)
}

console.log('Creating new instance:');
const instance = new MyConstructor(42);
console.log('Result:', instance);

console.log('\n=== Adding Methods via prototype ===');

function Dog(name) {
    this.name = name;
}

// Methods on prototype (shared across instances)
Dog.prototype.bark = function () {
    return `${this.name} says Woof!`;
};

Dog.prototype.wagTail = function () {
    return `${this.name} wags tail`;
};

const dog1 = new Dog("Buddy");
const dog2 = new Dog("Max");

console.log('dog1.bark():', dog1.bark());
console.log('dog2.bark():', dog2.bark());

// Method is shared
console.log('dog1.bark === dog2.bark:', dog1.bark === dog2.bark); // true

console.log('\n=== Constructor vs Regular Call ===');

function Vehicle(type) {
    this.type = type;
}

// With new: creates object
const car = new Vehicle("car");
console.log('new Vehicle("car"):', car);

// Without new: this is undefined (strict mode) or global (non-strict)
console.log('\nWithout new:');
try {
    const result = Vehicle("truck");
    console.log('Vehicle("truck"):', result); // undefined
} catch (e) {
    console.log('Error:', e.message);
}

console.log('\n=== Explicit Return from Constructor ===');

function ReturnsObject() {
    this.value = 42;

    // Explicit object return overrides default behavior
    return { custom: "value" };
}

const obj1 = new ReturnsObject();
console.log('Constructor returning object:', obj1);
console.log('Has value property?:', 'value' in obj1); // false

function ReturnsPrimitive() {
    this.value = 42;

    // Primitive returns are ignored
    return "ignored";
}

const obj2 = new ReturnsPrimitive();
console.log('Constructor returning primitive:', obj2);
console.log('Has value property?:', 'value' in obj2); // true

console.log('\n=== Arrow Functions Cannot Be Constructors ===');

const ArrowFunc = (name) => {
    this.name = name;
};

console.log('Attempting to use arrow function as constructor:');
try {
    const instance = new ArrowFunc("test");
} catch (e) {
    console.log('Error:', e.message);
}

console.log('Arrow function has prototype?:', ArrowFunc.prototype); // undefined

console.log('\n=== Constructor Property ===');

function Cat(name) {
    this.name = name;
}

const cat = new Cat("Whiskers");

console.log('cat.constructor === Cat:', cat.constructor === Cat); // true
console.log('cat.constructor.name:', cat.constructor.name); // "Cat"

// Can create new instances from constructor property
const anotherCat = new cat.constructor("Mittens");
console.log('anotherCat:', anotherCat);

console.log('\n=== Inheritance with Constructors ===');

function Animal(name) {
    this.name = name;
}

Animal.prototype.eat = function () {
    return `${this.name} is eating`;
};

function Bird(name, canFly) {
    Animal.call(this, name); // Call parent constructor
    this.canFly = canFly;
}

// Set up prototype chain
Bird.prototype = Object.create(Animal.prototype);
Bird.prototype.constructor = Bird;

Bird.prototype.fly = function () {
    if (this.canFly) {
        return `${this.name} is flying`;
    }
    return `${this.name} cannot fly`;
};

const eagle = new Bird("Eagle", true);
const penguin = new Bird("Penguin", false);

console.log('eagle.eat():', eagle.eat());
console.log('eagle.fly():', eagle.fly());
console.log('penguin.fly():', penguin.fly());

console.log('eagle instanceof Bird:', eagle instanceof Bird);
console.log('eagle instanceof Animal:', eagle instanceof Animal);

console.log('\n=== Factory Pattern vs Constructor ===');

// Constructor pattern
function ConstructorPerson(name) {
    this.name = name;
}

const p1 = new ConstructorPerson("Alice");
console.log('Constructor pattern:', p1);

// Factory pattern (no new needed)
function createPerson(name) {
    return {
        name: name,
        greet() {
            return `Hi, I'm ${this.name}`;
        }
    };
}

const p2 = createPerson("Bob");
console.log('Factory pattern:', p2);
console.log('p2.greet():', p2.greet());

console.log('\n=== new.target ===');

function MyClass() {
    console.log('  new.target:', new.target);

    if (!new.target) {
        console.log('  Called as function, not constructor');
        return new MyClass(); // Auto-fix
    }

    console.log('  Called with new');
    this.created = true;
}

console.log('With new:');
const inst1 = new MyClass();

console.log('\nWithout new:');
const inst2 = MyClass();

console.log('Both created:', inst1.created, inst2.created);

console.log('\n=== Singleton Pattern ===');

function Singleton() {
    if (Singleton.instance) {
        return Singleton.instance;
    }

    this.timestamp = Date.now();
    Singleton.instance = this;
}

const s1 = new Singleton();
setTimeout(() => {
    const s2 = new Singleton();

    console.log('s1 === s2:', s1 === s2); // true
    console.log('s1.timestamp === s2.timestamp:', s1.timestamp === s2.timestamp);
}, 10);

console.log('\n=== Static Methods (Constructor Properties) ===');

function MathUtils(value) {
    this.value = value;
}

// Static methods (on constructor itself)
MathUtils.square = function (x) {
    return x * x;
};

MathUtils.cube = function (x) {
    return x * x * x;
};

console.log('MathUtils.square(5):', MathUtils.square(5));
console.log('MathUtils.cube(3):', MathUtils.cube(3));

const util = new MathUtils(10);
console.log('Instance has square method?:', typeof util.square); // undefined
console.log('Constructor has square method?:', typeof util.constructor.square); // function

console.log('\n=== Built-in Constructors ===');

const arr = new Array(1, 2, 3);
const obj = new Object({ key: "value" });
const date = new Date();
const regex = new RegExp("pattern");

console.log('typeof arr:', typeof arr);   // "object"
console.log('Array.isArray(arr):', Array.isArray(arr)); // true
console.log('arr instanceof Array:', arr instanceof Array); // true

console.log('\n=== Checking if Function is Called as Constructor ===');

function SmartConstructor(value) {
    // Modern way
    if (new.target) {
        console.log('  Called as constructor');
        this.value = value;
    } else {
        console.log('  Called as function, returning value directly');
        return value * 2;
    }
}

console.log('new SmartConstructor(5):');
const objResult = new SmartConstructor(5);
console.log('Result:', objResult);

console.log('\nSmartConstructor(5):');
const funcResult = SmartConstructor(5);
console.log('Result:', funcResult);
