# Chapter 2: Triggers and Execution Context

## Mental Model

**Stop thinking:** "Pipeline runs on push"  
**Start thinking:** "Pipeline runs when **webhook** received with specific **context** (commit SHA, ref, actor, event data)"

## Trigger Types

### 1. Push Events
```yaml
on:
  push:
    branches: [main, develop]
```

**What happens:**
1. Git push to remote
2. Git provider sends webhook to CI
3. Webhook payload contains: commit SHA, branch, author, changed files
4. Pipeline clones repo **at that exact SHA**

### 2. Pull Request Events
```yaml
on:
  pull_request:
    types: [opened, synchronize]
```

**Critical difference:**
- `push`: Builds **actual branch** commit
- `pull_request`: Builds **merge commit** (simulated merge)

**Gotcha:** Tests may pass on PR but fail on merge!

### 3. Scheduled (Cron)
```yaml
on:
  schedule:
    - cron: '0 2 * * *'  # 2am daily
```

**Builds:** Latest commit on default branch  
**Use case:** Nightly builds, dependency updates

### 4. Manual (workflow_dispatch)
```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        required: true
        type: choice
        options: [staging, production]
```

### 5. API Triggered
```bash
curl -X POST \
  -H "Authorization: token $TOKEN" \
  https://api.github.com/repos/owner/repo/dispatches \
  -d '{"event_type":"deploy"}'
```

## Execution Context

Every run has **immutable context**:

```yaml
jobs:
  debug:
    steps:
      - run: |
          echo "Commit: ${{ github.sha }}"
          echo "Ref: ${{ github.ref }}"
          echo "Actor: ${{ github.actor }}"
          echo "Event: ${{ github.event_name }}"
```

**Output example:**
```
Commit: a1b2c3d4e5f6...
Ref: refs/heads/main
Actor: octocat
Event: push
```

## Common Traps

### Trap 1: pull_request vs push
```yaml
on: [push, pull_request]

jobs:
  test:
    steps:
      - uses: actions/checkout@v3
      - run: echo "Testing ${{ github.ref }}"
```

**PR trigger:** `refs/pull/123/merge` (simulated merge!)  
**Push trigger:** `refs/heads/main` (actual branch)

### Trap 2: Stale checkouts
```yaml
jobs:
  test:
    steps:
      - uses: actions/checkout@v3
      - run: sleep 3600  # Pipeline runs for 1 hour
      # New commits pushed during sleep NOT included!
```

**Why:** Checkout is at **trigger SHA**, not "latest"

## Interview Questions

**Q1:** PR tests pass but main branch tests fail after merge. Why?

**A:** PR tests ran against **simulated merge commit** (`refs/pull/*/merge`). Actual merge may have conflicts or integration issues not in simulation.

**Q2:** Cron job runs daily but tests sometimes fail with "dependency not found". Why?

**A:** Cron builds latest commit. If dependency was recently removed, cron catches it. Push-triggered builds only test that specific change.

## Key Takeaways

- Trigger = Webhook with context (SHA, ref, actor)
- `pull_request` builds **merge simulation**, not branch
- Context is **immutable** during run
- Checkout is at **trigger SHA**, not "latest"
