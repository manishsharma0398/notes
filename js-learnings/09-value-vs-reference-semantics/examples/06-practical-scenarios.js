// Example 6: Practical Scenarios and Gotchas
// Demonstrates: Real-world scenarios and common pitfalls

console.log('=== GOTCHA 1: Unexpected Mutation ===\n');

function addItem(list, item) {
    list.push(item);  // Mutates the original!
    return list;
}

const myList = [1, 2, 3];
console.log('Original list:', myList);

const newList = addItem(myList, 4);
console.log('newList:', new List);
console.log('myList:', myList, '(OOPS! Also changed)');
console.log('newList === myList:', newList === myList);

console.log('\n--- Fix: Return New Array ---');
function addItemSafe(list, item) {
    return [...list, item];  // Creates new array
}

const list2 = [1, 2, 3];
const list3 = addItemSafe(list2, 4);
console.log('list2:', list2, '(unchanged)');
console.log('list3:', list3);

console.log('\n=== GOTCHA 2: Default Parameter Mutation ===\n');

const defaultOptions = { timeout: 1000 };

function request(url, options = defaultOptions) {
    options.timestamp = Date.now();
    console.log('  Request to:', url, 'Options:', options);
}

console.log('defaultOptions before:', defaultOptions);
request('/api/users');
console.log('defaultOptions after:', defaultOptions, '(MUTATED!)');

console.log('\n--- Fix: Create New Default ---');
function requestSafe(url, options) {
    const config = { timeout: 1000, ...options };
    config.timestamp = Date.now();
    console.log('  Request to:', url, 'Config:', config);
}

const safeDefaults = { timeout: 1000 };
console.log('safeDefaults before:', safeDefaults);
requestSafe('/api/users');
console.log('safeDefaults after:', safeDefaults, '(unchanged)');

console.log('\n=== GOTCHA 3: Array.fill() with Objects ===\n');

const arr = Array(3).fill({ value: 0 });
console.log('Initial array:', arr);

arr[0].value = 999;
console.log('After arr[0].value = 999:', arr);
console.log('ALL elements changed! (same object reference)');

console.log('\n--- Fix: Create Unique Objects ---');
const arr2 = Array(3).fill(0).map(() => ({ value: 0 }));
console.log('Initial array:', arr2);

arr2[0].value = 999;
console.log('After arr2[0].value = 999:', arr2);
console.log('Only first element changed!');

console.log('\n=== GOTCHA 4: Array Sort Mutation ===\n');

const numbers = [3, 1, 4, 1, 5, 9];
console.log('Original:', numbers);

const sorted = numbers.sort();
console.log('Sorted:', sorted);
console.log('Original:', numbers, '(MUTATED!)');
console.log('sorted === numbers:', sorted === numbers);

console.log('\n--- Fix: Copy Before Sorting ---');
const numbers2 = [3, 1, 4, 1, 5, 9];
const sorted2 = [...numbers2].sort();
console.log('Original:', numbers2, '(unchanged)');
console.log('Sorted:', sorted2);

console.log('\n=== GOTCHA 5: Object.assign() Shallow ---');

const targeted = {
    name: 'Alice',
    settings: { theme: 'dark' }
};

const source = {
    settings: { language: 'en' }
};

Object.assign(targeted, source);
console.log('Target after assign:', targeted);
console.log('settings.theme was LOST! (replaced, not merged)');

console.log('\n--- Deep Merge Needed ---');
function deepMerge(target, source) {
    const result = { ...target };

    for (let key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(result[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }

    return result;
}

const target2 = {
    name: 'Alice',
    settings: { theme: 'dark' }
};

const merged = deepMerge(target2, { settings: { language: 'en' } });
console.log('Merged:', merged);
console.log('Both theme and language preserved!');

console.log('\n=== SCENARIO 1: Shopping Cart ===\n');

class ShoppingCart {
    constructor() {
        this.items = [];
    }

    // BAD: Returns internal array (can be mutated)
    getItemsUnsafe() {
        return this.items;
    }

    // GOOD: Returns copy (defensive)
    getItemsSafe() {
        return [...this.items];
    }

    addItem(item) {
        this.items.push(item);
    }
}

const cart = new ShoppingCart();
cart.addItem({ id: 1, name: 'Book' });
cart.addItem({ id: 2, name: 'Pen' });

console.log('--- Unsafe Access ---');
const items1 = cart.getItemsUnsafe();
items1.push({ id: 999, name: 'Hacked' });  // BAD!
console.log('Cart items:', cart.items, '(CORRUPTED!)');

console.log('\n--- Safe Access ---');
const cart2 = new ShoppingCart();
cart2.addItem({ id: 1, name: 'Book' });

const items2 = cart2.getItemsSafe();
items2.push({ id: 999, name: 'Attempt' });
console.log('Cart items:', cart2.items, '(SAFE!)');

console.log('\n=== SCENARIO 2: State Management ===\n');

class StateManager {
    constructor(initialState) {
        this._state = deepClone(initialState);
    }

    getState() {
        // Return frozen copy
        return Object.freeze(deepClone(this._state));
    }

    setState(updater) {
        const newState = typeof updater === 'function'
            ? updater(deepClone(this._state))
            : { ...this._state, ...updater };

        this._state = newState;
        console.log('  State updated:', this._state);
    }
}

function deepClone(obj) {
    return structuredClone(obj);
}

const stateManager = new StateManager({
    count: 0,
    user: { name: 'Alice' }
});

console.log('Initial state:', stateManager.getState());

// Try to mutate returned state (won't work - frozen)
const state = stateManager.getState();
state.count = 999;  // Fails (frozen)
console.log('After mutation attempt:', stateManager.getState());

// Proper update
stateManager.setState({ count: 1 });
stateManager.setState(state => ({ count: state.count + 1 }));

console.log('\n=== SCENARIO 3: React-like Updates ===\n');

function TodoApp() {
    let todos = [
        { id: 1, text: 'Learn JS', done: false },
        { id: 2, text: 'Build app', done: false }
    ];

    function toggleTodo(id) {
        // BAD: Mutates original
        // const todo = todos.find(t => t.id === id);
        // todo.done = !todo.done;

        // GOOD: Creates new array with updated item
        todos = todos.map(todo =>
            todo.id === id
                ? { ...todo, done: !todo.done }
                : todo
        );

        console.log('  Todos after toggle:', todos);
    }

    function addTodo(text) {
        // BAD: todos.push({ id: Date.now(), text, done: false })

        // GOOD: Create new array
        todos = [...todos, { id: Date.now(), text, done: false }];
        console.log('  Todos after add:', todos);
    }

    return { toggleTodo, addTodo, getTodos: () => todos };
}

const app = TodoApp();
console.log('Toggle todo 1:');
app.toggleTodo(1);

console.log('\nAdd new todo:');
app.addTodo('Deploy');

console.log('\n=== SCENARIO 4: Caching with Maps ===\n');

class Cache {
    constructor() {
        this.map = new Map();
    }

    set(key, value) {
        // Store deep    copy to prevent external mutations
        this.map.set(key, structuredClone(value));
    }

    get(key) {
        const value = this.map.get(key);
        // Return copy to prevent mutations
        return value ? structuredClone(value) : undefined;
    }
}

const cache = new Cache();

const data = {
    user: { name: 'Alice', age: 30 }
};

cache.set('user:1', data);

// Mutate original
data.user.age = 31;

// Cache is not affected
const cached = cache.get('user:1');
console.log('Cached data:', cached);
console.log('Original was mutated but cache is safe!');

// Mutate retrieved value
cached.user.name = 'Bob';

// Cache still has original
const cached2 = cache.get('user:1');
console.log('Cache after mutation attempt:', cached2);

console.log('\n=== SCENARIO 5: API Response Handling ===\n');

function fetchUser(id) {
    // Simulated API response
    return {
        id,
        name: 'Alice',
        prefs: { theme: 'dark', lang: 'en' }
    };
}

function processUserData() {
    const rawData = fetchUser(1);
    console.log('Raw API data:', rawData);

    // BAD: Mutate the response
    // rawData.processed = true;
    // rawData.prefs.lang = 'es';

    // GOOD: Create new object
    const processedData = {
        ...rawData,
        processed: true,
        prefs: {
            ...rawData.prefs,
            lang: 'es'
        }
    };

    console.log('Processed:', processedData);
    console.log('Original unchanged:', rawData);
}

processUserData();

console.log('\n=== SCENARIO 6: Event Handlers ===\n');

class EventTarget {
    constructor() {
        this.listeners = {};
    }

    addEventListener(event, listener) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(listener);
    }

    trigger(event, data) {
        if (!this.listeners[event]) return;

        // BAD: Pass original data (can be mutated)
        // this.listeners[event].forEach(fn => fn(data));

        // GOOD: Pass copy to each listener
        const dataCopy = structuredClone(data);
        this.listeners[event].forEach(fn => fn(dataCopy));
    }
}

const target = new EventTarget();

target.addEventListener('update', (data) => {
    console.log('  Listener 1:', data);
    data.modified = true;  // Tries to mutate
});

target.addEventListener('update', (data) => {
    console.log('  Listener 2:', data);
});

target.trigger('update', { value: 42 });
console.log('Each listener gets independent copy!');

console.log('\n=== BEST PRACTICES ===\n');

console.log('1. DEFENSIVE COPYING');
console.log('   - Copy inputs to protect originals');
console.log('   - Copy outputs to prevent external mutation');

console.log('\n2. IMMUTABLE UPDATES');
console.log('   - Use spread operator for objects/arrays');
console.log('   - Array methods: map, filter, concat (not push, pop)');

console.log('\n3. FREEZE WHEN APPROPRIATE');
console.log('   - Object.freeze() for configs/constants');
console.log('   - Prevents accidental mutations');

console.log('\n4. AVOID SHARED STATE');
console.log('   - Each component/function owns its data');
console.log('   - Pass copies, not references');

console.log('\n5. DOCUMENT MUTABILITY');
console.log('   - Comment if function mutates parameters');
console.log('   - Convention: mutating functions return undefined');

console.log('\n=== KEY TAKEAWAYS ===');
console.log('1. Always consider: will this be mutated?');
console.log('2. Default parameters can be mutated');
console.log('3. Array methods: some mutate, some don\'t');
console.log('4. Defensive copying prevents surprises');
console.log('5. Immutable patterns make bugs less likely');
console.log('6. structuredClone() for deep copies');
console.log('7. Object.freeze() for true immutability');
