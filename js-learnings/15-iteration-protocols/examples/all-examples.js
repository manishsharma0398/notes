// Chapter 15: Examples for iteration protocols (4 compact examples)
// Example 1: Custom Iterator
const range = {
    [Symbol.iterator]() {
        let i = 0;
        return {
            next: () => i < 3 ? { value: i++, done: false } : { done: true }
        };
    }
};
console.log([...range]);  // [0, 1, 2]

// Example 2: Generator
function* gen() {
    yield 1;
    yield 2;
    yield 3;
}
for (const v of gen()) console.log(v);

// Example 3: Infinite Generator
function* fibonacci() {
    let [a, b] = [0, 1];
    while (true) {
        yield a;
        [a, b] = [b, a + b];
    }
}
const fib = fibonacci();
console.log(fib.next().value, fib.next().value, fib.next().value);  // 0 1 1

// Example 4: yield* Delegation
function* inner() { yield 2; yield 3; }
function* outer() { yield 1; yield* inner(); yield 4; }
console.log([...outer()]);  // [1, 2, 3, 4]
