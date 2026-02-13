// Example 4: Mutation Patterns
// Demonstrates: Immutability of primitives vs mutability of objects

console.log('=== PRIMITIVES: IMMUTABLE ===\n');

// Strings cannot be mutated
console.log('--- String Immutability ---');
let str = "hello";
console.log('Original:', str);

str[0] = 'H';  // Silently fails (strict mode: error)
console.log('After str[0] = "H":', str, '(unchanged)');

// String methods return NEW strings
const upper = str.toUpperCase();
console.log('str.toUpperCase():', upper);
console.log('Original str:', str, '(unchanged)');

const replaced = str.replace('h', 'H');
console.log('str.replace("h", "H"):', replaced);
console.log('Original str:', str, '(still unchanged)');

// Concatenation creates new string
const concatenation = str + ' world';
console.log('str + " world":', concatenation);
console.log('Original str:', str, '(still "hello")');

// Numbers
console.log('\n--- Number Immutability ---');
let num = 42;
console.log('Original:', num);
// Can't "mutate" a number, can only reassign
num = num + 1;
console.log('After num = num + 1:', num, '(reassignment, not mutation)');

console.log('\n=== OBJECTS: MUTABLE ===\n');

// Object mutation
console.log('--- Object Mutation ---');
const obj = { x: 1, y: 2 };
console.log('Initial:', obj);

obj.x = 100;  // Mutation
console.log('After obj.x = 100:', obj);

obj.z = 3;  // Adding property
console.log('After obj.z = 3:', obj);

delete obj.y;  // Deleting property
console.log('After delete obj.y:', obj);

// Array mutation
console.log('\n--- Array Mutation ---');
const arr = [1, 2, 3];
console.log('Initial:', arr);

arr[0] = 999;  // Mutation by index
console.log('After arr[0] = 999:', arr);

arr.push(4);  // Mutating method
console.log('After arr.push(4):', arr);

arr.pop();  // Mutating method
console.log('After arr.pop():', arr);

console.log('\n=== MUTATING vs NON-MUTATING Array Methods ===\n');

const original = [3, 1, 4, 1, 5];
console.log('Original array:', original);

console.log('\n--- Mutating Methods (change original) ---');

const pushResult = original.push(9);
console.log('push(9)         → returns:', pushResult, '| array:', original);

const popResult = original.pop();
console.log('pop()           → returns:', popResult, '| array:', original);

original.reverse();
console.log('reverse()       → array:', original);

original.sort();
console.log('sort()          → array:', original);

original.splice(2, 1, 99);
console.log('splice(2, 1, 99) → array:', original);

console.log('\n--- Non-Mutating Methods (return new array) ---');

const testArr = [3, 1, 4, 1, 5];
console.log('Test array:', testArr);

const mapped = testArr.map(x => x * 2);
console.log('map(x => x * 2)  → returns:', mapped, '| original:', testArr);

const filtered = testArr.filter(x => x > 2);
console.log('filter(x => x > 2) → returns:', filtered, '| original:', testArr);

const sliced = testArr.slice(1, 3);
console.log('slice(1, 3)      → returns:', sliced, '| original:', testArr);

const concatenated = testArr.concat([6, 7]);
console.log('concat([6, 7])   → returns:', concatenated, '| original:', testArr);

console.log('\n=== CONST with Primitives vs Objects ===\n');

console.log('--- const with Primitives ---');
const constNum = 42;
// constNum = 100;  // TypeError: Assignment to constant variable
console.log('const constNum = 42');
console.log('constNum = 100  →  ERROR (can\'t reassign)');

console.log('\n--- const with Objects ---');
const constObj = { value: 42 };
console.log('const constObj = { value: 42 }');

constObj.value = 100;  // ✓ Mutation allowed
console.log('constObj.value = 100  →  OK:', constObj);

constObj.newProp = 'added';  // ✓ Adding property allowed
console.log('constObj.newProp = "added"  →  OK:', constObj);

// constObj = {};  // ✗ TypeError
console.log('constObj = {}  →  ERROR (can\'t reassign)');

console.log('\n--- const with Arrays ---');
const constArr = [1, 2, 3];
console.log('const constArr = [1, 2, 3]');

constArr.push(4);  // ✓ Mutation allowed
console.log('constArr.push(4)  →  OK:', constArr);

constArr[0] = 999;  // ✓ Mutation allowed
console.log('constArr[0] = 999  →  OK:', constArr);

// constArr = [];  // ✗ TypeError
console.log('constArr = []  →  ERROR (can\'t reassign)');

console.log('\n=== OBJECT.FREEZE() ===\n');

const frozen = Object.freeze({ x: 1, y: 2 });
console.log('Initial frozen object:', frozen);

frozen.x = 999;  // Silently fails (strict mode: error)
console.log('After frozen.x = 999:', frozen, '(unchanged)');

frozen.z = 3;  // Silently fails
console.log('After frozen.z = 3:', frozen, '(no new property)');

delete frozen.y;  // Silently fails
console.log('After delete frozen.y:', frozen, '(not deleted)');

console.log('Object.isFrozen(frozen):', Object.isFrozen(frozen));

console.log('\n--- Shallow Freeze Issue ---');
const shallowFrozen = Object.freeze({
    value: 42,
    nested: { x: 1 }
});

// shallowFrozen.value = 100;  // Fails
shallowFrozen.nested.x = 999;  // Works! (nested not frozen)
console.log('Nested object after mutation:', shallowFrozen.nested);

console.log('\n=== DEEP FREEZE ===\n');

function deepFreeze(obj) {
    Object.freeze(obj);

    Object.values(obj).forEach(value => {
        if (value && typeof value === 'object') {
            deepFreeze(value);
        }
    });

    return obj;
}

const deepFrozen = deepFreeze({
    value: 42,
    nested: {
        x: 1,
        deepNested: { y: 2 }
    }
});

console.log('Initial:', JSON.stringify(deepFrozen, null, 2));

deepFrozen.nested.x = 999;  // Fails (nested is frozen)
deepFrozen.nested.deepNested.y = 999;  // Fails (deep nested is frozen)

console.log('After mutation attempts:', JSON.stringify(deepFrozen, null, 2));
console.log('All levels are frozen!');

console.log('\n=== OBJECT.SEAL() ===\n');

const sealed = Object.seal({ x: 1, y: 2 });
console.log('Initial sealed object:', sealed);

sealed.x = 999;  // ✓ Can modify existing properties
console.log('After sealed.x = 999:', sealed);

sealed.z = 3;  // ✗ Can't add new properties
console.log('After sealed.z = 3:', sealed, '(no new property)');

delete sealed.y;  // ✗ Can't delete properties
console.log('After delete sealed.y:', sealed, '(not deleted)');

console.log('\n=== IMMUTABLE PATTERNS ===\n');

console.log('--- Updating Objects Immutably ---');
const user = { name: 'Alice', age: 30 };
console.log('Original:', user);

// BAD: Mutation
// user.age = 31;

// GOOD: Create new object
const updatedUser = { ...user, age: 31 };
console.log('Updated:', updatedUser);
console.log('Original unchanged:', user);

console.log('\n--- Updating Arrays Immutably ---');
const list = [1, 2, 3, 4];
console.log('Original:', list);

// BAD: list.push(5)

// GOOD: Create new array
const newList = [...list, 5];
console.log('New list:', newList);
console.log('Original unchanged:', list);

// Removing item immutably
const withoutSecond = list.filter((_, i) => i !== 1);
console.log('Without index 1:', withoutSecond);

// Updating item immutably
const updated = list.map((item, i) => i === 2 ? 999 : item);
console.log('Update index 2:', updated);

console.log('\n=== NESTED UPDATES ===\n');

const state = {
    user: {
        name: 'Alice',
        address: {
            city: 'New York',
            zip: '10001'
        }
    }
};

console.log('Original state:', JSON.stringify(state, null, 2));

// Update nested immutably
const newState = {
    ...state,
    user: {
        ...state.user,
        address: {
            ...state.user.address,
            city: 'Boston'
        }
    }
};

console.log('\nNew state:', JSON.stringify(newState, null, 2));
console.log('Original unchanged:', state.user.address.city);

console.log('\n=== PRACTICAL: State Management ===\n');

class Store {
    constructor(initialState) {
        this.state = Object.freeze(initialState);
    }

    setState(updates) {
        // Create new frozen state
        this.state = Object.freeze({
            ...this.state,
            ...updates
        });
        console.log('  New state:', this.state);
    }

    getState() {
        return this.state;
    }
}

const store = new Store({ count: 0, name: 'App' });
console.log('Initial state:', store.getState());

store.setState({ count: 1 });
store.setState({ count: 2 });

// Can't mutate state directly
const currentState = store.getState();
currentState.count = 999;  // Fails silently (frozen)
console.log('After mutation attempt:', store.getState());

console.log('\n=== KEY TAKEAWAYS ===');
console.log('1. Primitives: Completely immutable, can only reassign');
console.log('2. Objects: Mutable by default');
console.log('3. const: Prevents reassignment, NOT mutation');
console.log('4. Object.freeze(): Makes object immutable (shallow)');
console.log('5. Array methods: Some mutate, some return new arrays');
console.log('6. Immutable updates: Create new objects/arrays');
console.log('7. Deep freeze: Recursively freeze nested objects');
