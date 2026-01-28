# Time and Clocks: Revision Notes

## Core Concepts

### 1. Multiple Clocks
- **Wall-clock time** (Date.now()): System clock, can be adjusted
- **Monotonic time** (process.hrtime()): Steady clock, never goes backward

### 2. Wall-Clock Time
- Can jump forward/backward
- Affected by NTP, timezone changes
- Low precision (milliseconds)
- Use for: Display, logging, timestamps

### 3. Monotonic Time
- Never goes backward
- Not affected by system clock changes
- High precision (nanoseconds)
- Use for: Measurements, durations, performance

### 4. Timer System
- Internally uses monotonic time
- Callbacks receive wall-clock time
- Can drift due to event loop delays
- Minimum delay ~1ms, but not precise

## Common Pitfalls

1. **Timer drift**: Timers fire later than expected
   - Fix: Don't rely on exact timing

2. **Negative durations**: Using Date.now() for measurements
   - Fix: Use process.hrtime() for measurements

3. **Clock skew**: Different servers have different times
   - Fix: Use NTP or logical clocks

## Key Takeaways

- **Multiple clocks**: Wall-clock vs monotonic
- **Wall-clock can jump**: Affected by NTP, timezone
- **Monotonic is steady**: Never goes backward
- **Timers are approximate**: Not precise, can drift
- **Use right clock**: Wall-clock for display, monotonic for measurements
- **High-resolution time**: process.hrtime() for nanosecond precision
