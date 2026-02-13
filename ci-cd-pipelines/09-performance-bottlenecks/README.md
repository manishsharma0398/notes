# Chapter 9: Pipeline Performance Bottlenecks

## Common Bottlenecks

### 1. Cold Start (VM Provisioning)
**Hosted runners:** ~20-30 seconds to provision VM

**Mitigation:**
- Self-hosted runners (warm start ~1s)
- Reusable workflows
- Combine jobs when possible

### 2. Checkout Time
```
Large repos: 2-5 minutes for full clone
```

**Optimization:**
```yaml
- uses: actions/checkout@v3
  with:
    fetch-depth: 1  # Shallow clone (faster)
```

### 3. Dependency Installation
```
npm install: 2-10 minutes (uncached)
```

**Fix:** Cache dependencies (Chapter 6-7)

### 4. Sequential Dependencies
```yaml
build → test → deploy
5min    3min   2min
Total: 10 min (can't parallelize)
```

**Fix:** Parallelize where possible:
```yaml
build → [test-unit, test-e2e, lint] → deploy
```

### 5. Slow Runners
**Self-hosted** on weak hardware vs **hosted** high-performance VMs

### 6. Network Latency
- Docker image pulls
- Package downloads
- API calls

**Mitigation:** Registry mirrors, vendored dependencies

## Profiling Pipelines

**Step timing:**
```yaml
- name: Install deps
  run: |
    time npm install  # Logs duration
```

**Use workflow timing data:**
- GitHub Actions UI shows per-step duration
- Identify slowest steps

## Interview Questions

**Q:** Pipeline takes 20 minutes. 18 minutes is `npm install`. How to optimize?

**A:**
1. Cache `~/.npm` with lockfile hash
2. Use `npm ci` (faster than install)
3. Consider vendoring dependencies
4. Use faster registry (private mirror)

## Key Takeaways

- Checkout depth: Use shallow clones
- Cache: Biggest performance win
- Parallelize: Independent jobs
- Self-hosted: Faster for repeated builds
- Profile: Measure before optimizing
