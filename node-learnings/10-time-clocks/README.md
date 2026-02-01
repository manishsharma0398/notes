# Time and Clocks: Timers, Drift, and Clock Types

## Mental Model: Multiple Time Sources with Different Characteristics

Think of time in Node.js as having **multiple clocks** with different properties:

```
┌─────────────────────────────────────────┐
│  Wall-Clock Time (Date.now())           │
│  - System clock (can be adjusted)       │
│  - Can jump forward/backward            │
│  - Affected by NTP, timezone changes   │
│  - Use for: Display, logging            │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Monotonic Time (process.hrtime())      │
│  - Steady clock (never goes backward)   │
│  - Not affected by system clock changes │
│  - High precision (nanoseconds)         │
│  - Use for: Measurements, durations     │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Timer System (setTimeout/setInterval)   │
│  - Based on monotonic time internally   │
│  - But exposed as wall-clock time        │
│  - Can drift due to event loop delays    │
│  - Use for: Scheduling, delays          │
└─────────────────────────────────────────┘
```

**Key Insight**: **Wall-clock time can jump** (NTP adjustments, timezone changes). **Monotonic time is steady** (never goes backward). Use the right clock for the right purpose.

---

## What Actually Happens: Time Internals

### Why Multiple Clocks Exist

**Problem**: System clock (wall-clock time) can be adjusted:

- NTP (Network Time Protocol) corrections
- Timezone changes
- Manual clock adjustments
- Daylight saving time

**Problem with wall-clock time**: If you measure duration using `Date.now()`, and the clock jumps backward, you get negative durations or incorrect measurements.

**Solution**: **Monotonic clocks** that never go backward, used for measurements and durations.

**Critical Detail**: Node.js timers (`setTimeout`, `setInterval`) use **monotonic time internally** but expose **wall-clock time** in callbacks. This can cause confusion.

### Wall-Clock Time: Date.now()

**What it is**: System clock time, can be adjusted.

**Characteristics**:

- Can jump forward or backward
- Affected by NTP, timezone changes
- Low precision (milliseconds)
- Use for: Display, logging, timestamps

**Example**:

```javascript
const start = Date.now();
// ... some time passes, NTP adjusts clock backward ...
const end = Date.now();
const duration = end - start; // Could be negative!
```

**Problem**: Clock adjustments can cause negative durations or incorrect measurements.

### Monotonic Time: process.hrtime() / process.hrtime.bigint()

**What it is**: Steady clock that never goes backward.

**Characteristics**:

- Never goes backward (monotonic)
- Not affected by system clock changes
- High precision (nanoseconds)
- Use for: Measurements, durations, performance

**Example**:

```javascript
const start = process.hrtime.bigint();
// ... some time passes, NTP adjusts clock ...
const end = process.hrtime.bigint();
const duration = end - start; // Always positive, accurate
```

**Advantage**: Reliable for measurements, even if system clock changes.

### Timer System: setTimeout/setInterval

**How it works**:

- Internally uses **monotonic time** (libuv)
- But callbacks receive **wall-clock time** (Date.now())
- Can drift due to event loop delays

**Execution flow**:

```
setTimeout(callback, 1000)
  → libuv timer (monotonic time)
    → [Event loop delays...]
      → Timer expires (monotonic time)
        → Callback queued
          → Callback executes
            → Date.now() in callback (wall-clock time)
```

**Drift**: Timer may fire later than expected due to:

- Event loop blocking
- High CPU load
- Many pending operations

**Critical detail**: Timer precision is **not guaranteed**. Minimum delay is ~1ms, but actual delay can be longer.

---

## Common Misconceptions

### Misconception 1: "setTimeout is precise"

**What developers think**: `setTimeout(fn, 1000)` executes exactly after 1000ms.

**What actually happens**: Timer has **minimum delay** (~1ms) and can be **delayed by event loop**. Actual delay can be longer than requested.

**Production impact**: Timers are approximate, not precise. Don't rely on exact timing.

### Misconception 2: "Date.now() is reliable for measurements"

**What developers think**: `Date.now()` can be used to measure durations.

**What actually happens**: System clock can be adjusted (NTP, timezone), causing negative durations or incorrect measurements.

**Fix**: Use `process.hrtime()` for measurements.

### Misconception 3: "All time APIs use the same clock"

**What developers think**: All time functions use the same time source.

**What actually happens**: Different APIs use different clocks:

- `Date.now()`: Wall-clock time
- `process.hrtime()`: Monotonic time
- `setTimeout`: Monotonic internally, wall-clock in callbacks

---

## What Cannot Be Done (and Why)

### 1. Cannot Guarantee Exact Timer Precision

**Why**: Event loop can delay timer execution. Minimum delay is ~1ms, but actual delay depends on event loop load.

**Workaround**: Use `setImmediate()` for "as soon as possible" execution, but still not guaranteed immediate.

### 2. Cannot Make Wall-Clock Time Monotonic

**Why**: System clock is managed by OS, can be adjusted by NTP, timezone changes, etc.

**Workaround**: Use `process.hrtime()` for measurements that need monotonic behavior.

### 3. Cannot Get Sub-Millisecond Precision with Date

**Why**: `Date.now()` returns milliseconds. JavaScript numbers are limited to millisecond precision.

**Workaround**: Use `process.hrtime()` for nanosecond precision.

---

## Production Failure Modes

### Failure Mode 1: Timer Drift

**Symptom**: Timers fire later than expected, accumulate delay over time.

**Root cause**: Event loop delays, high CPU load, many pending operations.

**Example**:

```javascript
// BAD: Assumes precise timing
setInterval(() => {
  doWork(); // Takes 10ms
}, 100); // Expects 100ms, but actual is 110ms+
// Drift accumulates over time
```

**Fix**: Don't rely on exact timing. Use monotonic time for measurements.

### Failure Mode 2: Negative Durations

**Symptom**: Duration calculations return negative values.

**Root cause**: Using `Date.now()` for measurements, system clock adjusted backward (NTP).

**Example**:

```javascript
// BAD: Can get negative duration
const start = Date.now();
// ... NTP adjusts clock backward ...
const end = Date.now();
const duration = end - start; // Negative!
```

**Fix**: Use `process.hrtime()` for measurements.

### Failure Mode 3: Clock Skew in Distributed Systems

**Symptom**: Timestamps from different servers don't align.

**Root cause**: System clocks on different servers are not synchronized.

**Fix**: Use NTP for clock synchronization, or use logical clocks (vector clocks, Lamport timestamps).

---

## Performance Implications

### Timer Precision

**Minimum delay**: ~1ms (browser/Node.js limitation)

**Actual delay**: Can be longer due to:

- Event loop blocking
- High CPU load
- Many pending timers

**Rule of thumb**: Timers are approximate, not precise. Don't rely on exact timing.

### High-Resolution Time

**process.hrtime()**: Nanosecond precision, monotonic

**Use for**:

- Performance measurements
- Duration calculations
- Benchmarking

**Overhead**: Very low (just reads CPU counter)

---

## Key Takeaways

1. **Multiple clocks**: Wall-clock (Date.now()) vs monotonic (process.hrtime())

2. **Wall-clock can jump**: Affected by NTP, timezone changes

3. **Monotonic is steady**: Never goes backward, use for measurements

4. **Timers are approximate**: Not precise, can drift due to event loop

5. **Use right clock**: Wall-clock for display, monotonic for measurements

6. **Timer precision**: Minimum ~1ms, but actual delay can be longer

7. **High-resolution time**: process.hrtime() for nanosecond precision

---

## Next Steps

In the examples, we'll explore:

- Timer drift demonstration
- Wall-clock vs monotonic time
- High-resolution time measurements
- Real-world timing patterns

---

## Practice Exercises

### Exercise 1: Timer Drift Detection and Measurement

Create a script that demonstrates timer drift:

- Use `setInterval()` with 100ms delay
- Inside the callback, use `process.hrtime()` to measure actual elapsed time
- Track the drift accumulation over 100 iterations
- Add blocking code (e.g., busy loop for 10ms) to exacerbate drift
- Compare actual vs expected timing
- Explain why `setInterval` drifts and how to compensate
- Implement a drift-correcting timer using `setTimeout`

**Interview question this tests**: "Why does `setInterval` drift over time and how would you fix it?"

### Exercise 2: Date.now() vs performance.now() Accuracy

Create benchmarks comparing different time APIs:

- Measure a short operation (1ms) using `Date.now()`
- Measure the same operation using `performance.now()`
- Measure using `process.hrtime.bigint()`
- Simulate NTP clock adjustment (manually change system time mid-test)
- Observe which measurements become incorrect
- Explain why monotonic time is essential for performance measurements
- Discuss precision differences (ms vs ns)

**Interview question this tests**: "Why should you use `process.hrtime()` instead of `Date.now()` for performance measurements?"

### Exercise 3: Clock Skew in Distributed Systems

Create a script simulating distributed system timing issues:

- Create two "servers" (separate processes) with slightly different system times
- Exchange timestamps between them
- Demonstrate ordering problems when using wall-clock time
- Implement a hybrid logical clock (HLC) or vector clock solution
- Show how monotonic time helps within a single process
- Explain why NTP synchronization is critical
- Discuss trade-offs of different time synchronization strategies

**Interview question this tests**: "How do you handle time synchronization in a distributed Node.js system?"
