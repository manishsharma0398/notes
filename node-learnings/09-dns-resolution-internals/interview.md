# DNS Resolution Internals: Senior Interview Questions

## Question 1: dns.lookup() vs dns.resolve4()

**Interviewer**: "What's the difference between `dns.lookup()` and `dns.resolve4()`? When would you use each?"

### What They're Testing
- Understanding of DNS resolution paths
- Knowledge of thread pool usage
- Ability to choose the right API

### Correct Answer

**dns.lookup()**:
- Uses OS resolver (getaddrinfo)
- Uses thread pool (blocks worker thread)
- Respects /etc/hosts, nsswitch.conf
- Returns single IP address
- Blocking at OS level

**dns.resolve4()**:
- Uses direct DNS (c-ares library)
- Does NOT use thread pool (async DNS)
- Bypasses OS config
- Returns all IP addresses
- Non-blocking

**When to use dns.lookup()**:
- Need OS-level resolution
- Single IP address sufficient
- Low concurrency

**When to use dns.resolve4()**:
- High concurrency
- Need all IP addresses
- Want to avoid thread pool
- Don't need OS-level resolution

### Common Mistakes
- ❌ "They do the same thing" (false—different code paths)
- ❌ "Both use thread pool" (false—only lookup does)
- ❌ "resolve4 is always better" (false—depends on use case)

### Follow-up Questions
- "Why does dns.lookup() use the thread pool?"
- "What happens if you use dns.lookup() in high-concurrency code?"
- "How does DNS resolution affect file I/O performance?"

---

## Question 2: DNS and Thread Pool Starvation

**Interviewer**: "How can DNS lookups cause thread pool starvation? How would you fix it?"

### What They're Testing
- Understanding of thread pool sharing
- Knowledge of performance issues
- Ability to diagnose and fix problems

### Correct Answer

**How it happens**:
- `dns.lookup()` uses thread pool
- Thread pool is shared with file I/O and crypto
- Many concurrent DNS lookups saturate pool
- File I/O operations queue up, become slow

**Symptoms**:
- File operations become slow
- DNS and file I/O compete for threads
- Operations queue up

**Fix**:
- Use `dns.resolve4()` instead (doesn't use thread pool)
- Limit concurrent DNS lookups
- Increase thread pool size (if needed)

### Common Mistakes
- ❌ "DNS doesn't affect file I/O" (false—shared thread pool)
- ❌ "More DNS lookups are always better" (false—can starve pool)
- ❌ "Thread pool size doesn't matter" (false—it's a bottleneck)

### Follow-up Questions
- "How would you diagnose thread pool starvation from DNS?"
- "What's the trade-off of using dns.resolve4()?"
- "How does thread pool size affect DNS performance?"

---

## Key Takeaways for Interviews

1. **Two DNS paths**: OS resolver vs direct DNS
2. **Thread pool usage**: Only dns.lookup() uses thread pool
3. **Performance**: dns.resolve*() is faster for high concurrency
4. **Thread pool starvation**: dns.lookup() can block file I/O
5. **Choose wisely**: Use dns.resolve*() for high concurrency
