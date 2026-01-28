# Buffers and Memory Layout: Revision Notes

## Core Concepts

### 1. Buffer Memory Location
- **Buffers live outside V8 heap**: Actual bytes stored in C++ allocated memory
- **Buffer object is small**: ~80 bytes on heap (just a pointer + metadata)
- **Monitor external memory**: Use `process.memoryUsage().external` to track Buffer memory

### 2. Buffer Pooling
- **Small Buffers (≤8 KB)**: Use pre-allocated pool (fast, reused)
- **Large Buffers (>8 KB)**: Use direct `malloc()` (slower, not pooled)
- **Pool reduces overhead**: Avoids frequent OS allocation calls

### 3. String Conversion Overhead
- **toString() is expensive**: Allocates new UTF-16 string + encoding
- **Memory doubles**: UTF-16 uses 2 bytes per ASCII character
- **GC pressure**: String allocations trigger garbage collection

### 4. Buffer.slice() Behavior
- **Creates a view**: Shares memory with original (no copy)
- **Modifying slice affects original**: Both point to same memory
- **Memory efficient**: No duplication, but be careful with mutations

## Memory Layout

```
Buffer.alloc(1024):
┌─────────────────┐
│ Buffer object   │  ~80 bytes (V8 heap)
│ - ptr: 0x7f... │ ────┐
└─────────────────┘     │
                        │ pointer
                        ▼
┌─────────────────────────────────────┐
│ Raw bytes [0x00, ...]               │  1024 bytes (C++ memory)
└─────────────────────────────────────┘
```

## Performance Rules

### Fast Operations
- Direct byte access: `buffer[i]`
- Typed reads: `buffer.readUInt32BE(0)`
- Typed writes: `buffer.writeUInt32BE(value, 0)`
- Slicing: `buffer.slice(0, 10)` (creates view)

### Slow Operations
- String conversion: `buffer.toString()`
- String creation: `Buffer.from(string)`
- JSON conversion: `buffer.toJSON()`

## Common Pitfalls

1. **Memory leak**: Buffers held in closures/arrays never freed
   - Symptom: `external` memory grows, `heapUsed` stable
   - Fix: Clear references or use WeakMap

2. **String conversion in loops**: Creates many allocations
   - Symptom: High GC pressure, memory spikes
   - Fix: Process Buffers directly

3. **Large Buffer allocation**: Bypasses pool, can be slow
   - Symptom: Process stalls during allocation
   - Fix: Stream large data instead

4. **slice() mutations**: Modifying slice affects original
   - Symptom: Unexpected data changes
   - Fix: Copy if needed: `Buffer.from(buffer.slice())`

## Memory Monitoring

```javascript
const mem = process.memoryUsage();
// heapUsed: V8 heap (objects, strings, closures)
// external: Buffers, native addons
// rss: Total resident set size
```

## Key Takeaways

- Buffers are **pointers** to C++ memory, not JavaScript objects
- Small Buffers use **pool** (fast), large Buffers use **direct allocation** (slow)
- String conversion **doubles memory** and triggers GC
- `slice()` **shares memory** (be careful with mutations)
- Monitor **external memory** to detect Buffer leaks
- Process Buffers **directly** to avoid conversion overhead
