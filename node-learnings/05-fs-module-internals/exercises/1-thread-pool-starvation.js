const fs = require("node:fs");
const crypto = require("node:crypto");

const start = Date.now();
const getElapsed = () => `${Date.now() - start}ms`.padEnd(7);

const threadPoolSize = process.env.UV_THREADPOOL_SIZE || 4;
console.log(`Starting 20 CPU-intensive operations`);
console.log(
  `Thread pool size: ${threadPoolSize} (${process.env.UV_THREADPOOL_SIZE ? "custom" : "default"})`,
);
console.log(
  `Expected batching: Groups of ~${threadPoolSize} operations completing together\n`,
);

let completedCount = 0;
let lastCompletionTime = null;
const BATCH_THRESHOLD_MS = 10; // Operations completing within 10ms are considered same batch

for (let i = 1; i <= 20; i++) {
  // Use crypto.pbkdf2 which uses the thread pool and is CPU-intensive
  crypto.pbkdf2("secret", "salt", 100000, 64, "sha512", (err, derivedKey) => {
    completedCount++;
    const elapsed = Date.now() - start;

    // Detect batch boundaries
    if (
      lastCompletionTime === null ||
      elapsed - lastCompletionTime > BATCH_THRESHOLD_MS
    ) {
      if (lastCompletionTime !== null) {
        console.log(`${"".padEnd(60, "─")} Batch boundary`);
      }
      console.log(`\n📦 BATCH ${Math.ceil(completedCount / 4)}:`);
    }

    lastCompletionTime = elapsed;
    console.log(
      `  [${getElapsed()}] ✓ Operation ${i.toString().padStart(2)} completed (${completedCount}/20)`,
    );

    if (completedCount === 20) {
      console.log(`\n${"".padEnd(60, "═")}`);
      console.log(`\n✅ All 20 operations completed in ${elapsed}ms`);
      console.log(`\n💡 Key Observations:`);
      console.log(
        `   • Operations completed in ~5 batches (20 ops ÷ 4 threads)`,
      );
      console.log(`   • Each batch processes 4 operations simultaneously`);
      console.log(
        `   • Thread pool starvation: Later operations wait for threads`,
      );
      console.log(`   • This demonstrates the default UV_THREADPOOL_SIZE of 4`);
      console.log(`\n🔧 To increase thread pool size:`);
      console.log(`   Set UV_THREADPOOL_SIZE=8 before running Node.js`);
      console.log(
        `   Example: UV_THREADPOOL_SIZE=8 node ${__filename.split("\\").pop()}`,
      );
    }
  });
}

console.log(
  `All operations queued at ${getElapsed()}, waiting for thread pool...\n`,
);
