// Comparison: When do setTimeout/setInterval execute vs setImmediate?

console.log("=== TIMING COMPARISON: setTimeout vs setImmediate ===\n");

// ============================================
// TEST 1: Both scheduled from main execution
// ============================================
console.log("TEST 1: Both scheduled from main execution");
console.log("-------------------------------------------");

console.log("1. Main execution");

setTimeout(() => {
  console.log("2. setTimeout (Timers phase - Phase 1)");
}, 0);

setImmediate(() => {
  console.log("3. setImmediate (Check phase - Phase 5)");
});

console.log("4. Main execution end\n");

setTimeout(() => {
  console.log("5. After first batch\n");
  runTest2();
}, 10);

// ============================================
// TEST 2: Scheduled from within Timers phase
// ============================================
function runTest2() {
  console.log("TEST 2: Scheduled from within setTimeout (Timers phase)");
  console.log("--------------------------------------------------------");

  setTimeout(() => {
    console.log("6. In Timers phase");

    // Schedule from WITHIN Timers phase
    setTimeout(() => {
      console.log("8. Another setTimeout (NEXT iteration's Timers)");
      console.log("   ↑ Goes to NEXT iteration because we're IN Timers\n");
      runTest3();
    }, 0);

    setImmediate(() => {
      console.log("7. setImmediate (SAME iteration's Check)");
      console.log(
        "   ↑ Runs in SAME iteration because Check comes after Timers",
      );
    });
  }, 0);
}

// ============================================
// TEST 3: Scheduled from within Check phase
// ============================================
function runTest3() {
  console.log("TEST 3: Scheduled from within setImmediate (Check phase)");
  console.log("---------------------------------------------------------");

  setImmediate(() => {
    console.log("9. In Check phase");

    // Schedule from WITHIN Check phase
    setTimeout(() => {
      console.log("10. setTimeout (NEXT iteration's Timers)");
      console.log(
        "    ↑ Runs in NEXT iteration (Check already passed Timers)\n",
      );
      runTest4();
    }, 0);

    setImmediate(() => {
      console.log("11. Another setImmediate (NEXT iteration's Check)");
      console.log("    ↑ Goes to NEXT iteration because we're IN Check");
    });
  });
}

// ============================================
// TEST 4: Non-deterministic behavior
// ============================================
function runTest4() {
  console.log(
    "TEST 4: setTimeout vs setImmediate from main (NON-DETERMINISTIC!)",
  );
  console.log(
    "------------------------------------------------------------------",
  );
  console.log("Note: This can vary between runs due to timing!\n");

  // Run multiple times to show non-determinism
  let results = [];

  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      results.push("setTimeout");
      if (results.length === 6) showResults(results);
    }, 0);

    setImmediate(() => {
      results.push("setImmediate");
      if (results.length === 6) showResults(results);
    });
  }
}

function showResults(results) {
  console.log("Results from 3 pairs:", results.join(", "));
  console.log("Note: Order between setTimeout and setImmediate may vary!\n");

  setTimeout(() => {
    showSummary();
  }, 10);
}

function showSummary() {
  console.log("=== SUMMARY ===\n");

  console.log("Phase Execution Order:");
  console.log("  1. Timers     ← setTimeout/setInterval here");
  console.log("  2. Pending");
  console.log("  3. Idle");
  console.log("  4. Poll");
  console.log("  5. Check      ← setImmediate here");
  console.log("  6. Close\n");

  console.log("Timing Rules:\n");

  console.log("setTimeout/setInterval:");
  console.log("  • Run in Timers phase (Phase 1)");
  console.log("  • Go to NEXT 'Timers phase'");
  console.log("  • Must wait for timer to EXPIRE");
  console.log("  • Has minimum delay (OS-dependent)\n");

  console.log("setImmediate:");
  console.log("  • Run in Check phase (Phase 5)");
  console.log("  • Go to NEXT 'Check phase'");
  console.log("  • No expiration check needed");
  console.log("  • No artificial delay\n");

  console.log("Key Similarity:");
  console.log("  Both follow 'next phase' logic:");
  console.log("  - If phase not reached: current iteration");
  console.log("  - If in/past phase: next iteration\n");

  console.log("Key Difference:");
  console.log("  setTimeout: Must wait for timer expiration + phase timing");
  console.log(
    "  setImmediate: Just waits for Check phase (no expiration check)\n",
  );

  console.log("From main execution (non-deterministic):");
  console.log("  • Event loop might reach Timers before timer expires");
  console.log("  • Or might reach Check first");
  console.log("  • This is why setTimeout(0) vs setImmediate order varies\n");

  console.log("From I/O callback (deterministic):");
  console.log("  • Already in Poll phase (Phase 4)");
  console.log(
    "  • Check (Phase 5) comes before Timers (Phase 1 of next iteration)",
  );
  console.log("  • setImmediate ALWAYS runs first");

  process.exit(0);
}
