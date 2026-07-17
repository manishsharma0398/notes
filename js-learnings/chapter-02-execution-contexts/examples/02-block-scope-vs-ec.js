// example-02-block-scope-vs-ec.js
// KEY INSIGHT: blocks do NOT create new ECs.
// They create new Environment Records within the same EC.

function testBlocks() {
  var funcScoped = "I exist for the whole function";
  let blockOuter = "outer let";

  console.log("--- entering if block ---");

  if (true) {
    // New Environment Record created. No new EC.
    let blockInner = "inner let";
    var stillFuncScoped = "var ignores the block";

    console.log(blockOuter);      // "outer let"   — outer ER visible
    console.log(blockInner);      // "inner let"   — block ER
    console.log(funcScoped);      // from Variable Environment
    console.log(stillFuncScoped); // from Variable Environment
  }

  console.log("--- exited if block ---");
  console.log(funcScoped);        // ✅ still accessible
  console.log(stillFuncScoped);   // ✅ var leaked out of block — Variable Env
  // console.log(blockInner);     // ❌ ReferenceError — block ER was discarded

  // The EC for testBlocks() was NEVER duplicated.
  // Only the LexicalEnvironment pointer changed temporarily.
}

testBlocks();

// --- For loop proof ---
// var i leaks; let i stays contained.

function loopVarLeak() {
  for (var i = 0; i < 3; i++) {
    // i is in function-level VariableEnvironment
  }
  console.log("var i after loop:", i); // 3 — leaked
}

function loopLetContained() {
  for (let j = 0; j < 3; j++) {
    // j is in a per-iteration block Environment Record
  }
  // console.log(j); // ReferenceError — j does not exist here
  console.log("let j after loop: not accessible");
}

loopVarLeak();
loopLetContained();
