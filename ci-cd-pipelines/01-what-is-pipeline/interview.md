# Chapter 1 Interview Questions

## Q1: Pipeline DAG Understanding

**Question:** Draw the execution graph and calculate total runtime:

```yaml
jobs:
  A: runs for 10 min
  B: needs A, runs for 5 min
  C: needs A, runs for 8 min  
  D: needs [B, C], runs for 3 min
```

**Answer:**
```
    A (10min)
   / \
  B   C (parallel: max 8min)
   \ /
    D (3min)
Total: 10 + 8 + 3 = 21 minutes
```

## Q2: State Isolation Trap

**Question:** Why does this fail?

```yaml
jobs:
  setup:
    steps:
      - run: npm install
  test:
    needs: setup
    steps:
      - run: npm test
```

**Answer:** Jobs run in isolated environments. `node_modules` from `setup` doesn't exist in `test` job. Need to:
- Use caching, OR
- Upload/download as artifact, OR
- Run `npm install` in both jobs

## Q3: Flakiness Root Cause

**Question:** This pipeline is flaky. Identify all sources of non-determinism:

```yaml
jobs:
  test:
    steps:
      - run: |
          apt-get update
          apt-get install -y chromium
          export TEST_TIME=$(date +%s)
          curl https://api.service.com/config > config.json
          npm test
```

**Answer:**
1. **`apt-get update`:** Mirror availability/network
2. **`apt-get install chromium`:** Package version may change
3. **`date +%s`:** Time-dependent test behavior
4. **`curl` API call:** Network failure, rate limiting, response changes
5. **`npm test`:** Could have race conditions internally

**Fixes:**
- Pin package versions
- Mock API calls
- Avoid time-dependent logic
- Use vendored dependencies

## Q4: GitHub Actions vs Jenkins

**Question:** This works in Jenkins but fails in GitHub Actions. Why?

```yaml
# Works in Jenkins
stage('Build') {
    sh 'make build'
    sh 'ls -la dist/'  # Files exist
}
stage('Test') {
    sh 'ls -la dist/'  # Files still exist
}

# Fails in GitHub Actions
jobs:
  build:
    steps:
      - run: make build
      - run: ls -la dist/  # Files exist
  test:
    needs: build
    steps:
      - run: ls -la dist/  # ERROR: No dist/
```

**Answer:** Jenkins stages share workspace on same executor. GitHub Actions jobs run in separate VMs with no shared filesystem.

## Q5: Security Question

**Question:** What's the security risk here?

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: |
          echo "Running tests..."
          npm install
          npm test
```

**Answer:** 
- **Supply chain risk:** `npm install` fetches arbitrary code from internet
- **Compromise vector:** Malicious dependency could exfiltrate secrets
- **Mitigation:** Lock dependencies with `package-lock.json`, audit regularly, use private registry

## Q6: Performance Analysis

**Question:** You have 10 independent tests, each taking 2 minutes. How do you optimize this pipeline?

**Current (sequential):**
```yaml
jobs:
  test:
    steps:
      - run: run_all_tests  # 20 minutes
```

**Answer:** Parallelize into matrix:
```yaml
jobs:
  test:
    strategy:
      matrix:
        test: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    steps:
      - run: run_test_${{ matrix.test }}
# Total: 2 minutes (if 10 runners available)
```

**Caveat:** Performance depends on runner availability!

## Q7: State Assumption

**Question:** Tests pass locally but fail in CI with "File not found: /home/user/.config/app.json". Why?

**Answer:** Local test assumes state from previous runs or local configuration. CI has:
- Fresh environment
- No user home directory files
- Different user (`runner` vs your username)

**Fix:** Make test self-contained or commit required config to repo.

## Q8: Dependency Graph

**Question:** What's wrong with this dependency graph?

```yaml
jobs:
  A:
    needs: B
  B:
    needs: C
  C:
    needs: A
```

**Answer:** **Circular dependency** — this is not a DAG. Pipeline will fail to start. Most CI systems detect this at parse time.
