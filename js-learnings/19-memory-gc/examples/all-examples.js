// Chapter 19: Memory/GC
// Leak example
let leaked;
function createLeak() {
    const big = new Array(1000);
    return () => console.log(big.length);  // Closure keeps big
}
leaked = createLeak();

// WeakMap (doesn't prevent GC)
const wm = new WeakMap();
let obj = {};
wm.set(obj, "value");
obj = null;  // Can be GC'd
