// Question: Does setImmediate run only 1 callback or ALL callbacks in the queue?

console.log(
  "=== DEMONSTRATION: How many setImmediate callbacks run per phase? ===\n",
);

console.log("TEST 1: Multiple setImmediate scheduled at once");
console.log("------------------------------------------------");

// Schedule multiple setImmediate callbacks at the same time
setImmediate(() => console.log("  setImmediate 1"));
setImmediate(() => console.log("  setImmediate 2"));
setImmediate(() => console.log("  setImmediate 3"));
setImmediate(() => console.log("  setImmediate 4"));
setImmediate(() => console.log("  setImmediate 5"));

setTimeout(() => {
  console.log(
    "\n✅ All 5 setImmediate callbacks ran before this setTimeout!\n",
  );

  // Now test recursive case
  testRecursive();
}, 0);

function testRecursive() {
  console.log("TEST 2: Recursive setImmediate (one schedules the next)");
  console.log("-------------------------------------------------------");

  let count = 0;

  function recursive() {
    if (count >= 5) {
      console.log(
        "\n✅ Each setImmediate ran in a SEPARATE event loop iteration\n",
      );

      // Now the key test
      testMixed();
      return;
    }

    console.log(`  setImmediate iteration ${count}`);
    count++;

    // This schedules for the NEXT Check phase, not current one
    setImmediate(recursive);
  }

  recursive();

  setTimeout(() => {
    console.log("  ⏰ setTimeout ran between iterations!");
  }, 0);
}

function testMixed() {
  console.log("TEST 3: Mix of scheduled and recursive setImmediate");
  console.log("----------------------------------------------------");

  // Schedule 3 at once
  setImmediate(() => {
    console.log("  [Batch 1] setImmediate A");
    // This goes to NEXT iteration
    setImmediate(() => console.log("  [Batch 2] setImmediate from A"));
  });

  setImmediate(() => {
    console.log("  [Batch 1] setImmediate B");
    // This goes to NEXT iteration
    setImmediate(() => console.log("  [Batch 2] setImmediate from B"));
  });

  setImmediate(() => {
    console.log("  [Batch 1] setImmediate C");
  });

  setTimeout(() => {
    console.log("  ⏰ setTimeout ran after first batch");
  }, 0);

  setTimeout(() => {
    console.log("\n✅ Batch 1 ran together, Batch 2 ran in next iteration\n");
    showSummary();
  }, 5);
}

function showSummary() {
  console.log("=== SUMMARY ===\n");
  console.log("How setImmediate queue works:");
  console.log(
    "  1. ✅ Runs ALL callbacks that are in the queue at the START of Check phase",
  );
  console.log("  2. ❌ Does NOT run just the first callback");
  console.log(
    "  3. ⚠️  Callbacks added DURING Check phase go to NEXT iteration\n",
  );

  console.log("Comparison:");
  console.log(
    "  process.nextTick: Runs ALL (including newly added) → can starve",
  );
  console.log(
    "  Promises:         Runs ALL (including newly added) → can starve",
  );
  console.log(
    "  setImmediate:     Runs ALL from START of phase → cannot starve\n",
  );

  console.log("Why your recursive code doesn't starve:");
  console.log(
    "  1. Your setImmediate schedules ONE callback for next iteration",
  );
  console.log(
    "  2. That callback runs alone (or with others scheduled at same time)",
  );
  console.log("  3. It schedules ONE more for the iteration after that");
  console.log(
    "  4. Between iterations, ALL event loop phases run (including Timers)",
  );
  console.log("  5. This is why setTimeout can execute in between!\n");

  process.exit(0);
}
