// Do ALL phase callbacks follow the same "snapshot" behavior?
// If I schedule from WITHIN a callback, does it go to next iteration?

const fs = require("fs");
const net = require("net");

console.log("=== SNAPSHOT BEHAVIOR: All Phases Comparison ===\n");

console.log("Question: If I schedule a callback from WITHIN a phase callback,");
console.log("does it go to the NEXT iteration?\n");

// ============================================
// TEST 1: setImmediate (Check Phase)
// ============================================
console.log("TEST 1: setImmediate scheduling another setImmediate");
console.log("-----------------------------------------------------");

setImmediate(() => {
  console.log("1. Check phase - Callback A");

  setImmediate(() => {
    console.log("3. Check phase - Callback B (NEXT iteration)");
    console.log("   ✅ Goes to NEXT iteration (snapshot behavior)\n");
  });

  console.log("2. Still in Callback A");
});

setTimeout(() => {
  console.log("2.5 Timer ran between the two setImmediate callbacks\n");
  testTimers();
}, 5);

// ============================================
// TEST 2: setTimeout (Timers Phase)
// ============================================
function testTimers() {
  console.log("TEST 2: setTimeout scheduling another setTimeout");
  console.log("-------------------------------------------------");

  setTimeout(() => {
    console.log("4. Timers phase - Callback A");

    setTimeout(() => {
      console.log("6. Timers phase - Callback B (NEXT iteration)");
      console.log("   ✅ Goes to NEXT iteration (snapshot behavior)\n");
    }, 0);

    console.log("5. Still in Callback A");
  }, 0);

  setTimeout(() => {
    testIOCallbacks();
  }, 10);
}

// ============================================
// TEST 3: I/O (Poll Phase)
// ============================================
function testIOCallbacks() {
  console.log("TEST 3: I/O callback scheduling another I/O");
  console.log("--------------------------------------------");

  // Create a small file to read
  fs.writeFileSync("test1.txt", "data1");
  fs.writeFileSync("test2.txt", "data2");

  fs.readFile("test1.txt", () => {
    console.log("7. Poll phase - I/O Callback A (reading test1.txt)");

    // Schedule another I/O from WITHIN this I/O callback
    fs.readFile("test2.txt", () => {
      console.log("9. Poll phase - I/O Callback B (reading test2.txt)");
      console.log("   ⚠️ Could be SAME or NEXT iteration!");
      console.log("   (depends on if test2.txt is already ready)\n");

      // Clean up
      fs.unlinkSync("test1.txt");
      fs.unlinkSync("test2.txt");

      testCloseCallbacks();
    });

    console.log("8. Still in Callback A");
  });
}

// ============================================
// TEST 4: Close Callbacks (Close Phase)
// ============================================
function testCloseCallbacks() {
  console.log("TEST 4: Close callback scheduling another close");
  console.log("-----------------------------------------------");

  const server1 = net.createServer();
  const server2 = net.createServer();

  server1.on("close", () => {
    console.log("10. Close phase - Callback A (server1 closed)");

    // Trigger another close from WITHIN this close callback
    server2.close();

    console.log("11. Still in Callback A");
  });

  server2.on("close", () => {
    console.log("13. Close phase - Callback B (server2 closed)");
    console.log("    ⚠️ Could be SAME or NEXT iteration!");
    console.log("    (depends on close timing)\n");

    showComparison();
  });

  server1.listen(0, () => {
    server2.listen(0, () => {
      console.log("12. Triggering server1 close");
      server1.close();
    });
  });
}

// ============================================
// Comprehensive Comparison
// ============================================
function showComparison() {
  console.log("=== DETAILED COMPARISON ===\n");

  console.log("USER-SCHEDULED Phases (YOU decide when callback is added):");
  console.log("----------------------------------------------------------\n");

  console.log("1. TIMERS (setTimeout):");
  console.log("   Snapshot behavior: ✅ YES");
  console.log("   setTimeout(() => {");
  console.log("     setTimeout(() => {...}, 0); // ← NEXT iteration");
  console.log("   }, 0);");
  console.log("   Why: Already IN Timers phase, new timer → next iteration\n");

  console.log("2. CHECK (setImmediate):");
  console.log("   Snapshot behavior: ✅ YES");
  console.log("   setImmediate(() => {");
  console.log("     setImmediate(() => {...}); // ← NEXT iteration");
  console.log("   });");
  console.log(
    "   Why: Already IN Check phase, new immediate → next iteration\n",
  );

  console.log(
    "SYSTEM-TRIGGERED Phases (SYSTEM decides when callback is added):",
  );
  console.log(
    "----------------------------------------------------------------\n",
  );

  console.log("3. POLL (I/O callbacks):");
  console.log("   Snapshot behavior: ⚠️ DEPENDS");
  console.log("   fs.readFile('file1', () => {");
  console.log("     fs.readFile('file2', () => {...}); // ← DEPENDS!");
  console.log("   });");
  console.log("   Why:");
  console.log("   - If file2 is already ready: SAME iteration (in snapshot)");
  console.log("   - If file2 not ready: NEXT iteration (when it completes)");
  console.log(
    "   - System adds callback when I/O COMPLETES, not when you call it\n",
  );

  console.log("4. CLOSE (close callbacks):");
  console.log("   Snapshot behavior: ⚠️ DEPENDS");
  console.log("   server1.on('close', () => {");
  console.log("     server2.close(); // Triggers close callback");
  console.log("   });");
  console.log("   Why:");
  console.log("   - If close completes synchronously: SAME iteration");
  console.log("   - If close is async: NEXT iteration");
  console.log("   - System adds callback when CLOSE COMPLETES\n");

  console.log("=== KEY INSIGHT ===\n");

  console.log("Deterministic Snapshot (Predictable):");
  console.log("  • setTimeout: ✅ New timer → NEXT iteration (always)");
  console.log("  • setImmediate: ✅ New immediate → NEXT iteration (always)");
  console.log("  • Why: You control WHEN they're added to queue\n");

  console.log("Event-Driven (Depends on External Factors):");
  console.log("  • I/O: ⚠️ Depends on when I/O completes");
  console.log("  • Close: ⚠️ Depends on when close completes");
  console.log("  • Why: System controls WHEN they're added to queue\n");

  console.log("All phases DO use snapshot behavior, but:");
  console.log("  • User-scheduled: Snapshot timing is predictable");
  console.log("  • System-triggered: Snapshot timing depends on events");

  process.exit(0);
}
