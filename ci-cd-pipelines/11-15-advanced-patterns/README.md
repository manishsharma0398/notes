# Chapters 11-15: Advanced Patterns and Security

## Chapter 11: Retry Semantics and Idempotency

**Idempotent:** Running multiple times = same result

```yaml
# Idempotent
- run: kubectl apply -f deploy.yaml  # Safe to retry

# NOT idempotent
- run: echo "data" >> file.txt  # Appends every time
```

**Retry config:**
```yaml
- uses: nick-invision/retry@v2
  with:
    max_attempts: 3
    retry_on: error
    command: npm test
```

**When to retry:**
- Network failures (transient)
- Resource contention (temp unavailable)

**When NOT to retry:**
- Logic errors (will fail again)
- Security violations
- Quota exhausted

---

## Chapter 12: Branch-Based vs Trunk-Based Pipelines

### Branch-Based
```yaml
on:
  push:
    branches: [main, develop, feature/*]

jobs:
  test:
    if: github.ref != 'refs/heads/main'
  
  deploy:
    if: github.ref == 'refs/heads/main'
```

**Pros:** Isolated feature testing  
**Cons:** Integration issues, merge conflicts

### Trunk-Based
```yaml
on:
  push:
    branches: [main]  # Only main

# Feature flags in code, not branches
```

**Pros:** Continuous integration, fewer conflicts  
**Cons:** Requires discipline, feature flags

---

## Chapter 13: Promotion Pipelines (Build Once, Deploy Many)

**Anti-pattern:**
```yaml
deploy-staging:
  steps:
    - run: make build  # Build again!
    - run: deploy staging

deploy-prod:
  steps:
    - run: make build  # Different build!
    - run: deploy prod
```

**Correct:**
```yaml
build:
  steps:
    - run: make build
    - uses: actions/upload-artifact@v3
      with:
        name: app-v1.2.3
        path: dist/

deploy-staging:
  needs: build
  steps:
    - uses: actions/download-artifact@v3
    - run: deploy staging dist/

deploy-prod:
  needs: deploy-staging
  steps:
    - uses: actions/download-artifact@v3
    - run: deploy prod dist/  # Same artifact!
```

**Principle:** Build once, deploy many (immutable artifacts)

---

## Chapter 14: Security in CI/CD

### Supply Chain Attacks

**Vector 1: Malicious Actions**
```yaml
- uses: sketchy-org/action@v1  # Can steal secrets!
```

**Fix:** Pin to SHA
```yaml
- uses: sketchy-org/action@a1b2c3d4...
```

**Vector 2: Dependency Confusion**
```bash
npm install @internal/package
# Attacker publishes @internal/package on npmjs with higher version
```

**Fix:** Scoped registries in `.npmrc`

**Vector 3: Compromised Self-Hosted Runner**
```yaml
runs-on: self-hosted  # If compromised, can steal ALL secrets
```

**Fix:** Never use self-hosted for public repos

### Secrets Leakage

**Common mistakes:**
```yaml
# 1. Debug output
- run: env  # Prints ALL env vars (secrets masked but encoded bypass)

# 2. Error messages
- run: curl https://api.com -H "Auth: $SECRET"  # Shown in error

# 3. Artifacts
- run: echo "$SECRET" > config.json
- uses: actions/upload-artifact@v3  # Secret now downloadable!
```

### Least Privilege

```yaml
permissions:
  contents: read  # Only what's needed
  packages: write
  # NOT: permissions: write-all
```

---

## Chapter 15: Pipeline Failures Under Load

**Scenario:** 100 concurrent PRs

**Bottlenecks:**
1. **Runner exhaustion:** All queued (PENDING)
2. **Rate limiting:** npm registry, Docker Hub
3. **Database connections:** Integration tests fail
4. **Disk space:** Shared runner fills up

**Mitigation:**
- Runner pools (auto-scaling)
- Registry mirrors
- Test isolation (mock DBs)
- Cleanup jobs

**Cascading failures:**
```
Build fails → Cache miss → All dependent jobs fail
```

---

## Combined  Notes (Ch 11-15)

**Idempotency:** Safe to retry (kubectl apply)

**Branching:**
- Branch-based: Isolated, integration issues
- Trunk-based: Continuous, requires discipline

**Promotion:** Build once, deploy many (immutable artifacts)

**Security:**
- Pin actions to SHA
- Scoped dependency registries
- Never self-hosted for public repos
- Least privilege permissions

**Load failures:**
- Runner exhaustion
- Rate limiting
- Resource contention

**One-Sentence:**
Production pipelines require idempotent operations for safe retries, trunk-based workflows for continuous integration, build-once-deploy-many promotion patterns with immutable artifacts, defense-in-depth security including SHA-pinned actions and least-privilege permissions, and load-aware design to handle runner exhaustion and rate limiting at scale.
