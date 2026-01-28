/**
 * Example 64: Wall-Clock vs Monotonic Time
 * 
 * Demonstrates:
 * - Date.now() can jump (wall-clock)
 * - process.hrtime() is steady (monotonic)
 * - When to use each
 */

console.log('=== Wall-Clock vs Monotonic Time ===\n');

// Test 1: Wall-clock time (Date.now())
console.log('Test 1: Wall-clock time (Date.now())...');
const wallStart = Date.now();

// Simulate some work
setTimeout(() => {
  const wallEnd = Date.now();
  const wallDuration = wallEnd - wallStart;
  console.log(`  Start: ${wallStart} ms`);
  console.log(`  End: ${wallEnd} ms`);
  console.log(`  Duration: ${wallDuration} ms`);
  console.log();
  console.log('  Note: If system clock is adjusted (NTP), duration could be wrong');
  console.log();
  
  // Test 2: Monotonic time (process.hrtime.bigint())
  console.log('Test 2: Monotonic time (process.hrtime.bigint())...');
  const monoStart = process.hrtime.bigint();
  
  setTimeout(() => {
    const monoEnd = process.hrtime.bigint();
    const monoDuration = monoEnd - monoStart;
    const monoDurationMs = Number(monoDuration) / 1_000_000; // Convert to ms
    
    console.log(`  Start: ${monoStart} ns`);
    console.log(`  End: ${monoEnd} ns`);
    console.log(`  Duration: ${monoDurationMs.toFixed(2)} ms`);
    console.log();
    console.log('  Note: Monotonic time never goes backward');
    console.log('        Reliable for measurements even if clock adjusts');
    console.log();
    
    // Test 3: Precision comparison
    console.log('Test 3: Precision comparison...');
    console.log(`  Date.now() precision: milliseconds`);
    console.log(`  process.hrtime() precision: nanoseconds`);
    console.log(`  process.hrtime() is ${1_000_000}x more precise`);
    console.log();
    console.log('Use Date.now() for: Display, logging, timestamps');
    console.log('Use process.hrtime() for: Measurements, durations, performance');
  }, 100);
}, 100);
