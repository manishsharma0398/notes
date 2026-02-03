const fs = require("node:fs");

// Configuration
const FILE_TO_READ = __filename;
const ITERATIONS = 10;

console.log("=".repeat(70));
console.log("📊 Sync vs Async File Reading Benchmark");
console.log("=".repeat(70));
console.log(`File: ${FILE_TO_READ}`);
console.log(`Iterations: ${ITERATIONS}\n`);

// ============================================================================
// Test 1: Synchronous Reading (Blocking)
// ============================================================================

console.log("🔒 Test 1: Synchronous (Blocking) Reads");
console.log("-".repeat(70));

const syncStart = Date.now();

for (let i = 1; i <= ITERATIONS; i++) {
  const data = fs.readFileSync(FILE_TO_READ, "utf-8");
  console.log(
    `[${Date.now() - syncStart}ms] Sync read ${i} completed (${data.length} bytes)`,
  );
}

const syncEnd = Date.now();
const syncDuration = syncEnd - syncStart;

console.log(`\n✅ Synchronous total time: ${syncDuration}ms`);
console.log(
  `   Average per read: ${(syncDuration / ITERATIONS).toFixed(2)}ms\n`,
);

// ============================================================================
// Test 2: Asynchronous Reading (Non-Blocking)
// ============================================================================

console.log("🔓 Test 2: Asynchronous (Non-Blocking) Reads");
console.log("-".repeat(70));

const asyncStart = Date.now();
let completedCount = 0;

for (let i = 1; i <= ITERATIONS; i++) {
  fs.readFile(FILE_TO_READ, "utf-8", (err, data) => {
    if (err) {
      console.error(`Error reading file: ${err}`);
      return;
    }

    completedCount++;
    const elapsed = Date.now() - asyncStart;
    console.log(
      `[${elapsed}ms] Async read ${completedCount} completed (${data.length} bytes)`,
    );

    // When all reads complete
    if (completedCount === ITERATIONS) {
      const asyncDuration = Date.now() - asyncStart;
      console.log(`\n✅ Asynchronous total time: ${asyncDuration}ms`);
      console.log(
        `   Average per read: ${(asyncDuration / ITERATIONS).toFixed(2)}ms\n`,
      );

      // ========================================================================
      // Analysis
      // ========================================================================

      console.log("=".repeat(70));
      console.log("📈 Performance Analysis");
      console.log("=".repeat(70));
      console.log(`Synchronous:  ${syncDuration}ms`);
      console.log(`Asynchronous: ${asyncDuration}ms`);
      console.log(`Difference:   ${Math.abs(syncDuration - asyncDuration)}ms`);

      if (syncDuration < asyncDuration) {
        const pct = (
          ((asyncDuration - syncDuration) / asyncDuration) *
          100
        ).toFixed(1);
        console.log(`\n⚡ Sync was ${pct}% faster!`);
      } else {
        const pct = (
          ((syncDuration - asyncDuration) / syncDuration) *
          100
        ).toFixed(1);
        console.log(`\n⚡ Async was ${pct}% faster!`);
      }

      console.log("\n" + "=".repeat(70));
      console.log("💡 Key Insights");
      console.log("=".repeat(70));
      console.log(`
📋 Why Sync Can Be Faster for Small Files:
   • No thread pool overhead (executes on main thread)
   • No callback scheduling overhead
   • No event loop coordination needed
   • Simple, sequential execution
   • BUT: Blocks the event loop entirely!

📋 Why Async Is Better for Production:
   • Non-blocking: Event loop continues processing
   • Concurrent I/O: Multiple operations in parallel
   • Better for servers handling multiple requests
   • Scales better with larger files and more operations
   • Thread pool handles I/O efficiently

📋 Event Loop Behavior:
   Sync: Call stack → Block on each read → Next iteration
         Event loop CANNOT process other tasks!
   
   Async: Call stack → Queue to thread pool → Return immediately
          Event loop → Poll phase → Execute callbacks
          Other tasks can run while I/O happens!

📋 When to Use Sync (RARE):
   ✓ Startup/initialization (one-time config loading)
   ✓ CLI tools where blocking is acceptable
   ✓ Build scripts and development tools
   ✗ NEVER in web servers during request handling!
   ✗ NEVER for large files or frequent operations!

📋 Thread Pool Impact:
   • Default thread pool size: 4
   • 10 async reads: Batched in groups of 4
   • Sync reads: Don't use thread pool (block main thread)
   • UV_THREADPOOL_SIZE changes async performance, not sync
      `);
    }
  });
}
