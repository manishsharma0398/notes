const fs = require("node:fs");
const path = require("node:path");

// Create a large file for testing (10MB)
const LARGE_FILE = path.join(__dirname, "test-large-file.txt");
const FILE_SIZE_MB = 10;

console.log("📝 Creating large test file...");
const largeData = "x".repeat(FILE_SIZE_MB * 1024 * 1024); // 10MB of 'x'
fs.writeFileSync(LARGE_FILE, largeData);
console.log(`✅ Created ${FILE_SIZE_MB}MB test file\n`);

// Configuration
const ITERATIONS = 10;

console.log("=".repeat(70));
console.log("📊 Sync vs Async: LARGE FILE Benchmark");
console.log("=".repeat(70));
console.log(`File size: ${FILE_SIZE_MB}MB`);
console.log(`Iterations: ${ITERATIONS}\n`);

// ============================================================================
// Test 1: Synchronous Reading (Blocking)
// ============================================================================

console.log("🔒 Test 1: Synchronous (Blocking) Reads");
console.log("-".repeat(70));

const syncStart = Date.now();

for (let i = 1; i <= ITERATIONS; i++) {
  const data = fs.readFileSync(LARGE_FILE, "utf-8");
  console.log(`[${Date.now() - syncStart}ms] Sync read ${i} completed`);
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
  fs.readFile(LARGE_FILE, "utf-8", (err, data) => {
    if (err) {
      console.error(`Error reading file: ${err}`);
      return;
    }

    completedCount++;
    const elapsed = Date.now() - asyncStart;
    console.log(`[${elapsed}ms] Async read ${completedCount} completed`);

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
      console.log("💡 Key Insights for Large Files");
      console.log("=".repeat(70));
      console.log(`
📋 Why Async Wins with Large Files:
   • Thread pool processes 4 reads concurrently (default size)
   • While one read blocks on I/O, others proceed
   • Total time ≈ (Total reads ÷ Thread pool size) × Single read time
   • Parallelism overcomes overhead!

📋 Why Sync Is Slower:
   • Reads happen sequentially, one after another
   • Each read blocks until complete
   • Total time = ITERATIONS × Single read time
   • No parallelism, pure blocking!

📋 Event Loop Impact:
   Sync:  Event loop blocked for ${syncDuration}ms straight!
          No other operations possible during this time.
   
   Async: Event loop free throughout
          Could handle HTTP requests, timers, etc.
          Non-blocking even though total time similar!

📋 Thread Pool Batching (Async):
   • 10 reads with 4 threads = ~3 batches
   • Batch 1: Reads 1-4  (parallel)
   • Batch 2: Reads 5-8  (parallel)
   • Batch 3: Reads 9-10 (parallel)
   • Each batch overlaps I/O operations!
      `);

      // Cleanup
      console.log("\n🧹 Cleaning up test file...");
      fs.unlinkSync(LARGE_FILE);
      console.log("✅ Test file deleted\n");
    }
  });
}
