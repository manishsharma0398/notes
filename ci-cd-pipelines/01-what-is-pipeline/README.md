# Chapter 1: What a CI/CD Pipeline Really Is (And Why Scripts Are Not The Pipeline)

---

## Mental Model

**Stop thinking:** "A pipeline is a YAML file that runs scripts"  
**Start thinking:** "A pipeline is an **execution graph** with **state transitions**, **isolation boundaries**, and **scheduling constraints**"

**Critical Insight:** The YAML config is merely a **declaration** of the graph. The actual pipeline is the **runtime system** that:
1. Parses your config into a directed acyclic graph (DAG)
2. Schedules jobs to available runners
3. Manages state transitions and dependencies
4. Handles failures, retries, and cleanup

Scripts are **payloads**. The pipeline is the **orchestration layer**.

---

## What Developers Think vs Reality

### Developers Think:
```yaml
# "This runs my tests"
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
```

### Reality:
```
1. CI system receives webhook from Git
2. Scheduler evaluates: is ubuntu-latest runner available?
3. Runner claims job, creates fresh environment
4. Runner clones repo at specific commit SHA
5. Runner executes: npm test
6. Exit code determines job success/failure
7. Environment is destroyed (VM/container terminated)
8. Logs and artifacts (if any) uploaded to CI storage
9. Status posted back to Git provider
```

**The script is step 5. Everything else is the pipeline.**

---

## The Execution Graph

A pipeline is a **DAG** (Directed Acyclic Graph) where:
- **Nodes** = Jobs
- **Edges** = Dependencies (`needs`, `depends_on`, stages)
- **Execution** = Topological sort respecting dependencies

```
Example Pipeline Graph:

    ┌─────────┐
    │  build  │
    └────┬────┘
         │
    ┌────┴────┬────────┐
    │         │        │
┌───▼───┐ ┌──▼──┐ ┌───▼────┐
│ test  │ │lint │ │security│
└───┬───┘ └──┬──┘ └───┬────┘
    │        │        │
    └────┬───┴────┬───┘
         │        │
      ┌──▼────────▼──┐
      │    deploy    │
      └──────────────┘
```

**Key Properties:**
- `build` runs first (no dependencies)
- `test`, `lint`, `security` run **in parallel** (all depend only on `build`)
- `deploy` waits for **all three** to succeed

---

## Actual Mechanism: Job Lifecycle

Every job goes through these **state transitions**:

```
WAITING → PENDING → RUNNING → SUCCESS
                             ↘ FAILURE
                             ↘ CANCELLED
```

**State details:**

1. **WAITING:** Job exists in graph but dependencies not satisfied
2. **PENDING:** Dependencies satisfied, waiting for runner
3. **RUNNING:** Claimed by runner, executing
4. **SUCCESS/FAILURE:** Terminal state based on exit code
5. **CANCELLED:** User or system stopped execution

**Critical:** Jobs can be **PENDING for hours** if no runners available. This is NOT a pipeline bug—it's resource contention.

---

## Where Jobs Run: Isolation Boundaries

**Every job runs in a fresh, isolated environment.**

Platform-specific isolation:

| Platform | Default Isolation |
|----------|------------------|
| GitHub Actions | Fresh VM (Azure) |
| GitLab CI | Docker container |
| Jenkins | Workspace (shared!) |

**Implications:**

### GitHub Actions:
```yaml
jobs:
  job1:
    runs-on: ubuntu-latest
    steps:
      - run: echo "hello" > file.txt
  
  job2:
    runs-on: ubuntu-latest
    steps:
      - run: cat file.txt  # ERROR: No such file
```

**Why?** Different VMs, no shared filesystem.

### Jenkins (different!):
```groovy
stage('Job1') {
    sh 'echo "hello" > file.txt'
}
stage('Job2') {
    sh 'cat file.txt'  // Works! Shared workspace
}
```

**Why?** Stages share workspace on same executor.

---

## What Pipelines Actually Guarantee

### ✅ Guaranteed:
1. **Job execution order** respects dependencies
2. **Exit code = 0** means job success (by convention)
3. **Fresh environment** per job (VM/container platforms)
4. **Logs captured** (stdout/stderr to CI storage)

### ❌ NOT Guaranteed:
1. **Timing:** Jobs may queue indefinitely
2. **Determinism:** Same input ≠ same output (network, time, race conditions)
3. **State persistence:** Between jobs (unless explicit artifacts)
4. **Parallel execution speed:** Depends on runner availability
5. **Secret security:** If runner is compromised

---

## Common Misconceptions

### Misconception 1: "Pipelines are deterministic"

**False.** Example failure:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: |
          apt-get update
          apt-get install -y somedependency  # May fail if mirror down
          npm test
```

**Why fails:**
- Network requests (apt mirrors unreliable)
- Race conditions in tests
- Time-dependent logic (e.g., `new Date()`)

### Misconception 2: "Jobs share state"

**False** (in most platforms):

```yaml
jobs:
  setup:
    steps:
      - run: npm install
  
  test:
    needs: setup
    steps:
      - run: npm test  # ERROR: node_modules missing
```

**Fix:** Use artifacts or caches.

### Misconception 3: "Scripts run on my machine = run in CI"

**False.** CI environment differences:
- Different OS (even if both Linux)
- Different permissions (often rootless)
- Different network (corporate proxies, firewalls)
- Different filesystem (case-sensitive vs insensitive)
- Different environment variables

---

## Real-World Failure Example

**Scenario:** "Tests pass locally, fail in CI"

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm test
```

**Local:**
```bash
$ npm test
✓ All tests pass
```

**CI:**
```
Error: ENOENT: no such file or directory, open '/tmp/test-data.json'
```

**Root cause:** Test code does:
```javascript
const data = require('/tmp/test-data.json');  // Absolute path
```

Local machine has `/tmp/test-data.json` from previous run. CI has **fresh VM** with empty `/tmp`.

**Lesson:** CI exposes hidden assumptions about state.

---

## Interview Questions

### Q1: Why does this pipeline fail?

```yaml
jobs:
  build:
    steps:
      - run: make build
      - run: echo "artifact.tar.gz" > manifest.txt
  
  deploy:
    needs: build
    steps:
      - run: cat manifest.txt  # Fails
```

**Answer:** Jobs run in isolated environments. `manifest.txt` from `build` doesn't exist in `deploy`. Must use artifacts:

```yaml
jobs:
  build:
    steps:
      - run: make build
      - run: echo "artifact.tar.gz" > manifest.txt
      - uses: actions/upload-artifact@v3
        with:
          name: manifest
          path: manifest.txt
  
  deploy:
    needs: build
    steps:
      - uses: actions/download-artifact@v3
        with:
          name: manifest
      - run: cat manifest.txt
```

### Q2: This pipeline is flaky. Why?

```yaml
jobs:
  test:
    steps:
      - run: |
          curl https://api.example.com/data > input.json
          npm test
```

**Answer:** Network request introduces non-determinism:
- API might be down
- Response might change
- Network timeout
- Rate limiting

**Fix:** Mock the API or commit test data to repo.

### Q3: Performance Question

You have 4 jobs that each take 5 minutes. How long does this take?

```yaml
jobs:
  a:
    steps:
      - run: sleep 300
  b:
    needs: a
    steps:
      - run: sleep 300
  c:
    needs: a
    steps:
      - run: sleep 300
  d:
    needs: [b, c]
    steps:
      - run: sleep 300
```

**Answer:** 15 minutes.
- `a`: 5 min (sequential)
- `b` and `c`: 5 min (parallel, both wait for `a`)
- `d`: 5 min (waits for `b` and `c`)
- Total: 5 + 5 + 5 = 15 minutes

**Not** 20 minutes (if all sequential) or 5 minutes (if all parallel).

---

## Key Takeaways

1. **Pipeline ≠ scripts.** Pipeline is the orchestration system.
2. **Jobs are nodes in a DAG** with dependency edges.
3. **Fresh isolation** per job (VM/container platforms).
4. **State doesn't persist** between jobs unless explicit (artifacts).
5. **Non-determinism is default:** Network, time, race conditions.
6. **CI exposes hidden assumptions** from local development.

---

## Revision Notes (1-Minute Summary)

**Pipeline = DAG + State Machine**
- Nodes: Jobs
- Edges: Dependencies (`needs`, stages)
- State: WAITING → PENDING → RUNNING → SUCCESS/FAILURE

**Isolation:** Fresh VM/container per job (platform-dependent)

**NOT guaranteed:** Determinism, timing, state persistence

**Common trap:** Assuming jobs share filesystem

**Debug mantra:** "What works locally assumes state that CI doesn't have"

---

## Next Chapter Preview

**Chapter 2: Triggers and Execution Context** — How pipelines know *when* to run and *what* commit to build. We'll cover webhooks, scheduled runs, manual triggers, and the critical difference between `pull_request` and `push` events.

---

**Ready to proceed to Chapter 2, or do you want exercises/clarifications on Chapter 1?**
