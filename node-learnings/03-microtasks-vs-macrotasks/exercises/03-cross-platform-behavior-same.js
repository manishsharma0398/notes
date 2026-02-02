// Exercise 3: Cross-Platform Behavior - SAME IN BOTH

// Version that behaves the SAME in both Node.js and Browser
// By avoiding Node.js-specific APIs

console.log("Start");

setTimeout(() => console.log("setTimeout"), 0);

Promise.resolve().then(() => console.log("Promise"));

// Use only standard ECMAScript features
queueMicrotask(() => console.log("queueMicrotask"));

console.log("End");

/* 
OUTPUT IN BOTH NODE.JS AND BROWSER:
Start
End
Promise
queueMicrotask
setTimeout

WHY IT'S THE SAME:
1. We only use ECMAScript standard APIs
2. No process.nextTick (Node.js-specific)
3. No setImmediate (Node.js-specific)
4. Promise and queueMicrotask are part of ECMAScript spec
5. Both environments process microtasks before macrotasks

KEY TAKEAWAY:
To write cross-platform code, stick to standard JavaScript:
✅ Promise.then
✅ queueMicrotask
✅ setTimeout
❌ process.nextTick (Node.js only)
❌ setImmediate (Node.js only)
*/
