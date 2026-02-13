// Chapter 16: Async Examples
// Callback
setTimeout(() => console.log("Async"), 0);
console.log("Sync");  // Logs first

// Promise
Promise.resolve("done").then(console.log);

// async/await
async function example() {
    const result = await Promise.resolve(42);
    console.log(result);  // 42
}
example();
