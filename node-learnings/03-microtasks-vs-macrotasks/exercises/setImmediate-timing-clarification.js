// Clarification: When do setImmediate callbacks execute?

console.log("=== WHEN DOES setImmediate EXECUTE? ===\n");

// ============================================
// SCENARIO 1: Scheduled BEFORE event loop starts
// ============================================
console.log("SCENARIO 1: Scheduled in main execution (before event loop)");
console.log("-----------------------------------------------------------");

console.log("1. Main execution started");

setImmediate(() => {
  console.log("3. setImmediate executed in FIRST iteration's Check phase");
});

console.log("2. Main execution ended");

setTimeout(() => {
  console.log("\n4. setTimeout in Timers phase (same iteration or next)\n");

  // ============================================
  // SCENARIO 2: Scheduled DURING Check phase
  // ============================================
  runScenario2();
}, 0);

function runScenario2() {
  console.log("SCENARIO 2: Scheduled DURING Check phase");
  console.log("-----------------------------------------");

  setImmediate(() => {
    console.log("5. Check phase - Batch 1");

    // This is scheduled DURING Check phase execution
    setImmediate(() => {
      console.log("7. Check phase - Batch 2 (NEXT iteration)");
      console.log("   ↑ This goes to NEXT iteration because");
      console.log("   ↑ it was scheduled DURING Check phase\n");

      runScenario3();
    });

    console.log("6. Still in Batch 1");
  });
}

function runScenario3() {
  console.log("SCENARIO 3: Multiple scheduled at same time");
  console.log("--------------------------------------------");

  // All scheduled at the same time (before Check phase)
  setImmediate(() => console.log("8. All these"));
  setImmediate(() => console.log("9. run in"));
  setImmediate(() => console.log("10. the SAME"));
  setImmediate(() => console.log("11. Check phase"));

  setTimeout(() => {
    console.log("\n12. setTimeout after all 4 setImmediate\n");
    showSummary();
  }, 0);
}

function showSummary() {
  console.log("=== KEY INSIGHT ===\n");

  console.log("setImmediate runs in the NEXT CHECK PHASE, which means:\n");

  console.log("Case 1: Scheduled BEFORE Check phase");
  console.log("  → Runs in CURRENT iteration's Check phase");
  console.log("  → Example: Main execution → Check phase (same iteration)\n");

  console.log("Case 2: Scheduled DURING Check phase");
  console.log("  → Runs in NEXT iteration's Check phase");
  console.log("  → Example: Inside setImmediate → Next Check phase\n");

  console.log("Case 3: Scheduled AFTER Check phase (e.g., in Timers)");
  console.log(
    "  → Runs in CURRENT iteration's Check phase (if not passed yet)",
  );
  console.log("  → OR NEXT iteration's Check phase (if already passed)\n");

  console.log("=== PHASE ORDER REMINDER ===\n");
  console.log("One Event Loop Iteration:");
  console.log("  1. Timers");
  console.log("  2. Pending I/O");
  console.log("  3. Idle/Prepare");
  console.log("  4. Poll");
  console.log("  5. Check      ← setImmediate runs here");
  console.log("  6. Close");
  console.log("  → (back to step 1 for next iteration)\n");

  console.log("So 'next Check phase' could be:");
  console.log("  - In current iteration (if we haven't reached Check yet)");
  console.log(
    "  - In next iteration (if Check already happened or we're in it)",
  );

  process.exit(0);
}
