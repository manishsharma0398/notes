# DNS Resolution Internals: Revision Notes

## Core Concepts

### 1. Two DNS APIs
- **dns.lookup()**: OS resolver path (getaddrinfo)
- **dns.resolve*()**: Direct DNS path (c-ares)

### 2. dns.lookup() Characteristics
- Uses thread pool (blocks worker thread)
- Respects OS config (/etc/hosts, nsswitch.conf)
- Returns single IP address
- Blocking at OS level

### 3. dns.resolve*() Characteristics
- Does NOT use thread pool (async DNS)
- Bypasses OS config
- Returns all IP addresses
- Non-blocking (c-ares library)

### 4. Performance
- **dns.lookup()**: Higher latency (thread pool overhead)
- **dns.resolve*()**: Lower latency (no thread pool)
- **Thread pool impact**: dns.lookup() competes with file I/O

## When to Use Each

### Use dns.lookup() when:
- Need OS-level resolution
- Single IP address sufficient
- Low concurrency

### Use dns.resolve*() when:
- High concurrency
- Need all IP addresses
- Want to avoid thread pool
- Don't need OS-level resolution

## Common Pitfalls

1. **Thread pool starvation**: Many dns.lookup() calls block file I/O
   - Fix: Use dns.resolve*() for high concurrency

2. **Slow DNS servers**: DNS lookups take long time
   - Fix: Use faster DNS servers, implement caching

3. **No DNS caching**: Repeated lookups are slow
   - Fix: Implement application-level DNS cache

## Key Takeaways

- **Two DNS paths**: OS resolver vs direct DNS
- **Thread pool usage**: Only dns.lookup() uses thread pool
- **Performance**: dns.resolve*() is faster
- **Thread pool starvation**: dns.lookup() can block file I/O
- **Choose wisely**: Use dns.resolve*() for high concurrency
