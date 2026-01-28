# Time and Clocks: Senior Interview Questions

## Question 1: Timer Precision

**Interviewer**: "How precise are `setTimeout` and `setInterval`? Can you rely on exact timing?"

### What They're Testing
- Understanding of timer limitations
- Knowledge of event loop delays
- Ability to reason about timing guarantees

### Correct Answer

**Timer precision**:
- **Minimum delay**: ~1ms (browser/Node.js limitation)
- **Actual delay**: Can be longer due to event loop delays
- **Not guaranteed**: Timers are approximate, not precise

**Why timers drift**:
- Event loop blocking
- High CPU load
- Many pending operations
- Timer phase execution order

**Can't rely on exact timing**:
- Don't use timers for precise scheduling
- Use for approximate delays, not exact timing
- Drift accumulates over time with setInterval

### Common Mistakes
- ❌ "setTimeout is precise" (false—approximate)
- ❌ "1000ms means exactly 1000ms" (false—can be longer)
- ❌ "Timers are reliable for scheduling" (false—approximate only)

### Follow-up Questions
- "How would you implement a precise timer?"
- "What causes timer drift?"
- "How does event loop blocking affect timers?"

---

## Question 2: Wall-Clock vs Monotonic Time

**Interviewer**: "What's the difference between `Date.now()` and `process.hrtime()`? When would you use each?"

### What They're Testing
- Understanding of different time sources
- Knowledge of clock types
- Ability to choose the right API

### Correct Answer

**Date.now() (wall-clock time)**:
- System clock, can be adjusted
- Can jump forward/backward
- Affected by NTP, timezone changes
- Low precision (milliseconds)
- Use for: Display, logging, timestamps

**process.hrtime() (monotonic time)**:
- Steady clock, never goes backward
- Not affected by system clock changes
- High precision (nanoseconds)
- Use for: Measurements, durations, performance

**When to use each**:
- **Date.now()**: When you need wall-clock time (display, logging)
- **process.hrtime()**: When you need reliable measurements

### Common Mistakes
- ❌ "They're the same" (false—different clocks)
- ❌ "Date.now() is fine for measurements" (false—can be wrong)
- ❌ "process.hrtime() is always better" (false—depends on use case)

### Follow-up Questions
- "What happens if you use Date.now() for duration measurements?"
- "Why does monotonic time exist?"
- "How does NTP affect time measurements?"

---

## Key Takeaways for Interviews

1. **Timers are approximate**: Not precise, can drift
2. **Wall-clock can jump**: Affected by NTP, timezone
3. **Monotonic is steady**: Never goes backward
4. **Use right clock**: Wall-clock for display, monotonic for measurements
5. **High-resolution time**: process.hrtime() for nanosecond precision
