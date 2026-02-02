// Do I/O and Close callbacks follow the same "next phase" timing?

const fs = require("fs");
const net = require("net");

console.log("=== I/O AND CLOSE CALLBACKS: Phase Timing ===\n");

console.log("Key Difference:");
console.log("  setTimeout/setImmediate: YOU schedule them explicitly");
console.log(
  "  I/O/Close callbacks:     SYSTEM schedules them when events happen\n",
);

// ============================================
// Part 1: Understanding I/O Callback Timing
// ============================================
console.log("PART 1: I/O Callbacks (Poll Phase - Phase 4)");
console.log("----------------------------------------------\n");

console.log("1. Starting I/O operation (file read)");

fs.readFile(__filename, (err, data) => {
  console.log("3. I/O callback executed in Poll phase");
  console.log("   Note: You didn't 'schedule' this - the OS triggered it");
  console.log("   when the file read completed\n");

  // From within I/O callback, what happens?
  console.log("4. Scheduling from WITHIN I/O callback:");

  setTimeout(() => {
    console.log("6. setTimeout (next iteration's Timers)");
  }, 0);

  setImmediate(() => {
    console.log("5. setImmediate (current iteration's Check)");
    console.log("   Check comes right after Poll!\n");

    demonstrateCloseCallbacks();
  });
});

console.log("2. File read initiated (continuing synchronous execution)\n");

// ============================================
// Part 2: Understanding Close Callback Timing
// ============================================
function demonstrateCloseCallbacks() {
  console.log("PART 2: Close Callbacks (Close Phase - Phase 6)");
  console.log("------------------------------------------------\n");

  console.log("7. Creating a server and closing it");

  const server = net.createServer();

  server.on("close", () => {
    console.log("9. Close callback executed in Close phase");
    console.log("   Note: This was triggered by server.close()");
    console.log("   System scheduled it when close completed\n");

    demonstratePhaseOrder();
  });

  server.listen(0, () => {
    console.log("8. Server started, now closing it");
    server.close(); // This triggers the close callback
  });
}

// ============================================
// Part 3: Complete Phase Order Demo
// ============================================
function demonstratePhaseOrder() {
  console.log("PART 3: All Phases Together");
  console.log("----------------------------\n");

  console.log("10. Scheduling various callbacks:");

  // User-scheduled callbacks
  setTimeout(() => {
    console.log("  → Timers phase: setTimeout");
  }, 0);

  setImmediate(() => {
    console.log("  → Check phase: setImmediate");
  });

  // System-triggered callbacks
  fs.readFile(__filename, () => {
    console.log("  → Poll phase: I/O callback (file read)");
  });

  const server2 = net.createServer();
  server2.on("close", () => {
    console.log("  → Close phase: close callback\n");
    showSummary();
  });

  server2.listen(0, () => {
    server2.close();
  });

  console.log("11. All scheduled, waiting for event loop...\n");
}

function showSummary() {
  console.log("=== SUMMARY ===\n");

  console.log("Event Loop Phase Order:");
  console.log("┌─────────────────────────────────────────────┐");
  console.log("│  1. Timers     ← YOU schedule: setTimeout   │");
  console.log("│  2. Pending    ← SYSTEM: deferred I/O       │");
  console.log("│  3. Idle       ← SYSTEM: internal           │");
  console.log("│  4. Poll       ← SYSTEM: I/O events         │");
  console.log("│  5. Check      ← YOU schedule: setImmediate │");
  console.log("│  6. Close      ← SYSTEM: close events       │");
  console.log("└─────────────────────────────────────────────┘\n");

  console.log("Two Categories of Callbacks:\n");

  console.log("USER-SCHEDULED (you control when they're added):");
  console.log("  • setTimeout/setInterval → Timers phase");
  console.log("  • setImmediate → Check phase");
  console.log("  • You explicitly call these functions");
  console.log("  • Follow 'next phase' timing you've learned\n");

  console.log("SYSTEM-TRIGGERED (OS/Node controls when they're added):");
  console.log("  • I/O callbacks → Poll phase");
  console.log("  • Close callbacks → Close phase");
  console.log("  • Triggered by external events (file ready, socket closed)");
  console.log("  • You provide the callback, system schedules it\n");

  console.log("The 'Next Phase' Concept Applies to ALL:");
  console.log("  • Once callback is added to a phase's queue");
  console.log("  • It runs when event loop processes that phase");
  console.log("  • Same snapshot behavior (new ones → next iteration)\n");

  console.log("Key Difference:");
  console.log("  • setTimeout/setImmediate: You decide WHEN to schedule");
  console.log(
    "  • I/O/Close: System decides WHEN to schedule (based on events)",
  );
  console.log("  • But once scheduled, all follow same phase rules!");

  process.exit(0);
}
