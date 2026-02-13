// Example 2: Shared Variable Between Closures
// Demonstrates: Multiple closures referencing the same variable

function makeClosures() {
    let shared = 0;

    function increment() {
        shared++;
        console.log('Incremented. shared is now:', shared);
    }

    function decrement() {
        shared--;
        console.log('Decremented. shared is now:', shared);
    }

    function getValue() {
        return shared;
    }

    return { increment, decrement, getValue };
}

const obj = makeClosures();

console.log('Initial value:', obj.getValue());  // 0

obj.increment();  // Incremented. shared is now: 1
obj.increment();  // Incremented. shared is now: 2
obj.increment();  // Incremented. shared is now: 3

obj.decrement();  // Decremented. shared is now: 2

console.log('Final value:', obj.getValue());  // 2

// All three functions share the SAME 'shared' variable in memory
