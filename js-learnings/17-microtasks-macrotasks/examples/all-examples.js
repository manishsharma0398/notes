// Chapter 17: Microtask vs Macrotask
console.log("1");
setTimeout(() => console.log("2"), 0);  // Macro
Promise.resolve().then(() => console.log("3"));  // Micro
console.log("4");
// Output: 1, 4, 3, 2
