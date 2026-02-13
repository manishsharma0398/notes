# Chapters 9-10 Notes

## Ch 9: Performance
Bottlenecks:
- VM provisioning (~20s)
- Checkout (use `fetch-depth: 1`)
- Dependencies (cache!)
- Sequential jobs (parallelize)

## Ch 10: Determinism
Flakiness sources:
- Time (`Date.now()`)
- Network (APIs)
- Randomness (`Math.random()`)
- Race conditions
- Unpinned versions

**Fix:**
- Pin all versions
- Mock external services
- Avoid time/random dependencies
- Explicit ordering

**1% flaky → compounds to pipeline failure**

## One-Sentence (Ch 10)
Pipeline flakiness stems from non-determinism in time, network, randomness, and race conditions, compounding across steps to create unreliable builds that require version pinning, service mocking, and elimination of temporal dependencies rather than masking with retries.
