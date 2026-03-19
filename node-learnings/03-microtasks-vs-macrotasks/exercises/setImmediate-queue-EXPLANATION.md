# How the setImmediate Queue Works: Complete Explanation

## Your Question:

> "So no matter how many items in setImmediate queue it will only run 1st item and move to next event loop phase?"

## The Answer: **NO! It runs ALL items that were in the queue at the start of the Check phase.**

But there's an important distinction about "all items"...

---

## The Rule: setImmediate "Snapshot" Behavior

**setImmediate runs in the Check phase (Phase 5) with this behavior:**

1. ✅ At the **START** of the Check phase, Node.js takes a "snapshot" of the queue
2. ✅ It runs **ALL** callbacks that were in that snapshot
3. ⚠️ Any NEW callbacks added **DURING** execution go to the **NEXT** iteration

This is different from `process.nextTick` and Promises!

---

## Visual Demonstration

### Scenario 1: Multiple setImmediate Scheduled Together

```javascript
setImmediate(() => console.log("A"));
setImmediate(() => console.log("B"));
setImmediate(() => console.log("C"));
setImmediate(() => console.log("D"));
setImmediate(() => console.log("E"));

setTimeout(() => console.log("setTimeout"), 0);
```

**What happens:**

```
Event Loop Iteration 1:
  Timers Phase: (empty)
  Poll Phase: (empty)
  Check Phase:
    Snapshot: [A, B, C, D, E]  ← All scheduled before Check phase started
    Execute ALL:
      → A
      → B
      → C
      → D
      → E
  ↓
Event Loop Iteration 2:
  Timers Phase:
    → setTimeout  ← Runs in next iteration
```

**Output:**

```
A
B
C
D
E
setTimeout
```

**Key Point:** ALL 5 setImmediate callbacks ran in ONE Check phase!

---

### Scenario 2: Recursive setImmediate (Your Case)

```javascript
function recursive(count) {
  if (count >= 5) return;
  console.log(`Iteration ${count}`);
  setImmediate(() => recursive(count + 1)); // Schedules for NEXT iteration
}

recursive(0);

setTimeout(() => console.log("setTimeout"), 0);
```

**What happens:**

```
Event Loop Iteration 1:
  Timers Phase: (empty)
  Poll Phase: (empty)
  Check Phase:
    Snapshot: [callback-0]  ← Only ONE callback in snapshot
    Execute:
      → "Iteration 0"
      → Schedules callback-1 for NEXT iteration
  ↓
Event Loop Iteration 2:
  Timers Phase:
    → setTimeout  ← Gets a chance to run!
  Poll Phase: (empty)
  Check Phase:
    Snapshot: [callback-1]  ← Only ONE callback in snapshot
    Execute:
      → "Iteration 1"
      → Schedules callback-2 for NEXT iteration
  ↓
Event Loop Iteration 3:
  ... continues
```

**Output:**

```
Iteration 0
setTimeout        ← Ran between iterations!
Iteration 1
Iteration 2
Iteration 3
Iteration 4
```

**Key Point:** Each setImmediate runs in a SEPARATE iteration!

---

### Scenario 3: Mix (Some Add More During Execution)

```javascript
setImmediate(() => {
  console.log("[Batch 1] A");
  setImmediate(() => console.log("[Batch 2] from A")); // Added during execution
});

setImmediate(() => {
  console.log("[Batch 1] B");
  setImmediate(() => console.log("[Batch 2] from B")); // Added during execution
});

setImmediate(() => {
  console.log("[Batch 1] C");
});

setTimeout(() => console.log("setTimeout"), 0);
```

**What happens:**

```
Event Loop Iteration 1:
  Check Phase:
    Snapshot: [A, B, C]  ← Original 3 callbacks
    Execute ALL in snapshot:
      → "[Batch 1] A"
          → Schedules "from A" for NEXT iteration
      → "[Batch 1] B"
          → Schedules "from B" for NEXT iteration
      → "[Batch 1] C"
  ↓
Event Loop Iteration 2:
  Timers Phase:
    → setTimeout
  Check Phase:
    Snapshot: [from A, from B]  ← Callbacks added in previous iteration
    Execute ALL:
      → "[Batch 2] from A"
      → "[Batch 2] from B"
```

**Output:**

```
[Batch 1] A
[Batch 1] B
[Batch 1] C
setTimeout         ← Ran between batches!
[Batch 2] from A
[Batch 2] from B
```

**Key Point:** Callbacks added during execution go to NEXT iteration!

---

## The Critical Difference: Why setImmediate Doesn't Starve

### `process.nextTick` and Promises (STARVE):

```
nextTick/Microtask Queue Behavior:
  1. Execute callback 1
  2. Callback 1 adds callback 2
  3. ⚠️ Immediately process callback 2 (same queue run)
  4. Callback 2 adds callback 3
  5. ⚠️ Immediately process callback 3
  ... infinite loop! Event loop phases never run!
```

**Result:** Queue NEVER empties → Event loop phases NEVER run → STARVATION!

### `setImmediate` (SAFE):

```
setImmediate Queue Behavior:
  1. Check phase starts
  2. Snapshot current queue: [callback 1]
  3. Execute callback 1
  4. Callback 1 adds callback 2
  5. ✅ But callback 2 goes to NEXT iteration's queue
  6. Check phase ends (snapshot is complete)
  7. Event loop continues to next phase
  8. ALL phases run (including Timers)
  9. Next iteration: Check phase processes callback 2
```

**Result:** Each iteration processes finite callbacks → Event loop continues → NO STARVATION!

---

## Detailed Comparison Table

| Queue Type            | Runs How Many?      | Includes New Ones Added During Execution? | Can Starve? |
| --------------------- | ------------------- | ----------------------------------------- | ----------- |
| `process.nextTick`    | ALL (including new) | ✅ Yes - runs to true completion          | ⚠️ **YES**  |
| Promises (microtasks) | ALL (including new) | ✅ Yes - runs to true completion          | ⚠️ **YES**  |
| `setImmediate`        | ALL from snapshot   | ❌ No - new ones go to next iteration     | ✅ **NO**   |
| `setTimeout`          | ALL expired timers  | ❌ No - new ones wait for next iteration  | ✅ **NO**   |

---

## Why Your Code Doesn't Starve (Explained)

### Your Code:

```javascript
const recursivePromise = (count) => {
  if (count >= 10) process.exit(0);
  console.log("Inside recursivePromise", count);
  setImmediate(
    () => new Promise((resolve) => resolve(recursivePromise(count + 1))),
  );
};

recursivePromise(0);

setTimeout(() => {
  console.log("This will execute in between");
}, 0);
```

### Execution Timeline:

```
◆ Initial call: recursivePromise(0)
  → Logs "Inside recursivePromise 0"
  → Schedules setImmediate for iteration 1

◆ Event Loop Iteration 1:
  Timers: [setTimeout]
  Check: [setImmediate-0]
    Snapshot: [setImmediate-0]
    Execute setImmediate-0:
      → Creates new Promise
      → Executes recursivePromise(1)
      → Logs "Inside recursivePromise 1"
      → Schedules setImmediate for iteration 2

◆ Event Loop Iteration 2:
  Timers: [setTimeout]  ← Still waiting
    Execute setTimeout:
      → Logs "This will execute in between"  ✅
  Check: [setImmediate-1]
    Execute setImmediate-1:
      → Logs "Inside recursivePromise 2"
      → Schedules setImmediate for iteration 3

... continues
```

**Why setTimeout runs:**

1. Each setImmediate adds ONE callback for the NEXT iteration
2. Between iterations, ALL event loop phases run
3. Timers phase eventually processes the setTimeout
4. No starvation!

---

## Key Mental Model

Think of `setImmediate` like this:

**Process the current batch, new work goes to next batch:**

```
Iteration 1:
  Batch 1: [A, B, C]
    Execute A → adds D to next batch
    Execute B → adds E to next batch
    Execute C
  Batch 1 complete ✅

  (Event loop continues to other phases)

Iteration 2:
  Batch 2: [D, E]
    Execute D → adds F to next batch
    Execute E
  Batch 2 complete ✅

  (Event loop continues to other phases)

Iteration 3:
  Batch 3: [F]
  ...
```

**Compare to `process.nextTick` / Promises:**

```
High-Priority Queue Run:
  Queue: [A, B, C]
    Execute A → adds D immediately to queue
    Execute B → adds E immediately to queue
    Execute C
    Execute D → adds F immediately to queue
    Execute E
    Execute F → adds G immediately to queue
    ... (NEVER ENDS!)

  ❌ Event loop phases NEVER get a chance
```

---

## Summary: Answer to Your Question

**Question:** "Does setImmediate only run 1st item and move to next event loop phase?"

**Answer:**
**NO!** `setImmediate` runs **ALL items that were in the queue BEFORE the Check phase started**.

**But:**

- ✅ It runs all items in the "snapshot" (queue at phase start)
- ❌ It does NOT run items added during execution (those go to next iteration)
- ✅ This is why it doesn't starve: each iteration processes finite work

**In recursive cases** (like your code):

- You add ONE callback per iteration
- That ONE callback runs (alone or with others scheduled at same time)
- It adds ONE more for the next iteration
- Between iterations, ALL event loop phases run
- This is why `setTimeout` can execute!

---

## Run the Demo

See it in action:

```bash
node node-learnings/03-microtasks-vs-macrotasks/exercises/setImmediate-queue-behavior.js
```

You'll see:

1. Multiple setImmediate scheduled together → all run in one phase
2. Recursive setImmediate → each runs in separate iteration
3. Mix → shows the snapshot behavior clearly

This "snapshot" behavior is the KEY to why setImmediate is safe for recursion! 🎯
