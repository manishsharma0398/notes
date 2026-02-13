# Chapter 10: Determinism vs Flakiness

## Mental Model

**Deterministic:** Same input → Same output (always)  
**Flaky:** Same input → Different output (sometimes)

## Sources of Non-Determinism

### 1. Time
```javascript
// Test code
const cutoff = new Date('2024-01-01');
expect(processOrders(cutoff)).toBe(42);
// Fails after 2024-01-01!
```

### 2. Network
```yaml
- run: curl https://api.example.com/config > config.json
# Fails if API down, slow, or response changes
```

### 3. Race Conditions
```javascript
// Parallel async operations
Promise.all([writeFile(), readFile()]);
// Order not guaranteed
```

### 4. Randomness
```javascript
Math.random() * 100;
// Different every run
```

### 5. External Dependencies
```yaml
- run: apt-get install package
# Version may change over time
```

### 6. Filesystem Order
```bash
for file in *.txt; do process $file; done
# Order not guaranteed!
```

## Flaky Test Patterns

**Symptom:** "Passed locally, failed in CI" or "Sometimes passes"

**Root causes:**
- Timing assumptions (sleep 100ms not enough)
- Global state pollution
- Non-deterministic iteration order
- Environment differences

## Making Pipelines Deterministic

### 1. Pin All Versions
```yaml
# Bad
- run: apt-get install chromium

# Good
- run: apt-get install chromium=98.0.4758.102-1
```

### 2. Mock External Services
```yaml
# Bad
- run: npm test  # Tests call real API

# Good
- run: npm test  # Tests use mocked API responses
```

### 3. Set Fixed Seeds
```javascript
// In tests
Math.seedrandom('fixed-seed');
```

### 4. Avoid Time Dependencies
```javascript
// Bad
const now = Date.now();

// Good
const now = mockDate || Date.now();
```

### 5. Explicit Ordering
```bash
# Bad
for file in *.txt

# Good
for file in $(ls *.txt | sort)
```

## Retry Strategies

```yaml
# Flaky test? Retry
- uses: nick-invision/retry@v2
  with:
    timeout_minutes: 5
    max_attempts: 3
    command: npm test
```

**Warning:** Retries **hide** flakiness, don't fix it!

## Interview Questions

**Q:** Test passes 9/10 times. Is this acceptable?

**A:** **No.** 10% failure rate compounds:
- Pipeline with 10 steps: `0.9^10 = 35%` success rate
- 100 builds/day: 65 failures/day
- Developer trust erodes, CI becomes "noise"

**Q:** How to debug flaky test?

**A:**
1. Run test 100 times locally
2. Check for time dependencies
3. Check for race conditions
4. Check environment assumptions
5. Add logging to capture state
6. Use same seed/environment as CI

## Key Takeaways

- Flakiness = non-determinism
- Pin all versions
- Mock external services
- Avoid time, randomness, race conditions
- Retries hide problems
- 1% flakiness compounds to pipeline failure
