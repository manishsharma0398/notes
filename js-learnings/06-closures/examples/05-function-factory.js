// Example 5: Function Factory Pattern
// Demonstrates: Creating specialized functions using closures

function createMultiplier(multiplier) {
    return function (number) {
        return number * multiplier;
    };
}

const double = createMultiplier(2);
const triple = createMultiplier(3);
const times10 = createMultiplier(10);

console.log('double(5):', double(5));      // 10
console.log('triple(5):', triple(5));      // 15
console.log('times10(5):', times10(5));    // 50

// Each returned function has its own 'multiplier' value

console.log('\n=== More Complex Factory ===');

function createGreeter(greeting, punctuation = '!') {
    return function (name) {
        return `${greeting}, ${name}${punctuation}`;
    };
}

const sayHello = createGreeter('Hello');
const sayHola = createGreeter('Hola', '!!!');
const askHow = createGreeter('How are you', '?');

console.log(sayHello('Alice'));   // Hello, Alice!
console.log(sayHola('Carlos'));   // Hola, Carlos!!!
console.log(askHow('Bob'));       // How are you, Bob?

console.log('\n=== Validator Factory ===');

function createValidator(min, max) {
    return function (value) {
        if (value < min) {
            return `Value ${value} is below minimum ${min}`;
        }
        if (value > max) {
            return `Value ${value} exceeds maximum ${max}`;
        }
        return 'Valid';
    };
}

const ageValidator = createValidator(0, 120);
const percentValidator = createValidator(0, 100);

console.log(ageValidator(25));     // Valid
console.log(ageValidator(150));    // Value 150 exceeds maximum 120
console.log(percentValidator(50)); // Valid
console.log(percentValidator(101)); // Value 101 exceeds maximum 100
