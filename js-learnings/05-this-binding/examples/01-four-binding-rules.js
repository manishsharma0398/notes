/**
 * Example 1: The Four Binding Rules
 * Demonstrates each binding rule in action
 */

console.log("=== Example 1: The Four Binding Rules ===\n");

// Setup object for examples
const person = {
    name: "Alice",
    age: 30
};

// RULE 1: Default Binding
console.log("--- Rule 1: Default Binding ---");

function defaultBinding() {
    console.log("this:", this);
    console.log("this.name:", this.name);
}

defaultBinding();

/**
 * Non-strict mode: this = global object (window/global)
 * Strict mode: this = undefined
 * 
 * No context object → default binding applies.
 */

// RULE 2: Implicit Binding
console.log("\n--- Rule 2: Implicit Binding ---");

const obj = {
    name: "Bob",
    greet: function () {
        console.log("Hello, I'm", this.name);
    }
};

obj.greet();  // Implicit binding: this = obj

/**
 * Call-site: obj.greet()
 * The function is called through obj reference.
 * this = the object before the dot (obj)
 */

// Implicit binding LOST
console.log("\n--- Losing Implicit Binding ---");

const greetFn = obj.greet;
greetFn();  // Default binding: this = global/undefined

/**
 * Call-site: greetFn()
 * No context object → default binding.
 * this = global (or undefined in strict mode)
 * 
 * This is the same function, but different call-site!
 */

// RULE 3: Explicit Binding
console.log("\n--- Rule 3: Explicit Binding ---");

function introduce(greeting, punctuation) {
    console.log(`${greeting}, I'm ${this.name}${punctuation}`);
}

// .call(thisArg, ...args)
introduce.call(person, "Hello", "!");  // this = person

// .apply(thisArg, argsArray)
introduce.apply(person, ["Hi", "."]);  // this = person

// .bind(thisArg) — returns new function
const boundIntroduce = introduce.bind(person);
boundIntroduce("Hey", "~");  // this = person (always)

/**
 * .call() and .apply(): Invoke immediately with specified this
 * .bind(): Returns new function with this locked
 * 
 * Explicit binding OVERRIDES implicit binding.
 */

// RULE 4: new Binding
console.log("\n--- Rule 4: new Binding ---");

function Person(name, age) {
    this.name = name;
    this.age = age;
    console.log("Inside constructor, this:", this);
}

const charlie = new Person("Charlie", 25);
console.log("charlie:", charlie);

/**
 * What 'new' does:
 * 
 * 1. Create a new empty object: {}
 * 2. Link it to Person.prototype
 * 3. Bind this to the new object
 * 4. Execute Person function
 * 5. Return the new object (unless function returns object)
 * 
 * this = the newly created object
 */

// Binding Priority
console.log("\n--- Binding Priority Test ---");

function test() {
    console.log("this.value:", this.value);
}

const obj1 = { value: 1, test: test };
const obj2 = { value: 2 };

// Implicit binding
console.log("Implicit:");
obj1.test();  // 1

// Explicit overrides implicit
console.log("\nExplicit overrides implicit:");
obj1.test.call(obj2);  // 2

// bind creates hard binding
console.log("\nHard binding:");
const hardBound = test.bind(obj1);
hardBound.call(obj2);  // 1 (bind wins over call)

// new overrides bind
console.log("\nnew overrides bind:");
const BoundTest = test.bind(obj1);
const instance = new BoundTest();  // this = new object (no value property)

/**
 * PRIORITY ORDER:
 * 
 * 1. new           (highest)
 * 2. call/apply/bind
 * 3. Implicit
 * 4. Default       (lowest)
 * 
 * Each higher rule overrides lower rules.
 */

console.log("\n=== Summary ===");
console.log("✓ Default: standalone call → global/undefined");
console.log("✓ Implicit: obj.method() → obj");
console.log("✓ Explicit: .call/.apply/.bind → specified object");
console.log("✓ new: creates object → new object");
console.log("✓ Priority: new > explicit > implicit > default");
