# Chapter 4: Isolation Models (VMs, Containers, Shared Runners)

## Mental Model

**Isolation = Blast radius control**

Stronger isolation = Safer but slower  
Weaker isolation = Faster but riskier

## Isolation Levels

### Level 1: Separate VMs (Strongest)
**Example:** GitHub Actions hosted runners

```yaml
runs-on: ubuntu-latest
```

**Isolation:**
- Completely separate VM per job
- Different kernel
- No shared filesystem
- No shared network
- No shared memory

**Pros:** Maximum security  
**Cons:** Slow startup (~20s), expensive

### Level 2: Containers (Medium)
**Example:** GitLab CI, Docker-based

```yaml
image: node:18
script:
  - npm test
```

**Isolation:**
- Shared kernel
- Separate filesystem (via layers)
- Separate network namespace
- cgroup resource limits

**Pros:** Fast startup (~2s), cheaper  
**Cons:** Kernel exploits affect all containers

**Gotcha:** Container escape possible with privileged mode!

```yaml
# DANGEROUS
services:
  - docker:dind  # Docker-in-Docker
variables:
  DOCKER_TLS_CERTDIR: ""
```

### Level 3: Shared Workspace (Weakest)
**Example:** Jenkins traditional

```groovy
stage('Build') {
    sh 'make build'
}
stage('Test') {
    sh 'npm test'  // Same workspace!
}
```

**Isolation:** Same process, same filesystem

**Pros:** Instant, shared state  
**Cons:** Jobs interfere, security risk

## Security Boundaries

**Question:** Can job A read job B's secrets?

| Platform | Isolation | Can Read? |
|----------|-----------|-----------|
| GitHub Actions (hosted) | Separate VMs | ❌ No |
| GitLab CI (container) | Separate containers | ❌ No |
| Jenkins (shared) | Same workspace | ⚠️ **Possibly yes!** |
| Self-hosted (any) | Depends on config | ⚠️ **Risk exists** |

## Resource Limits

**Containers:**
```yaml
# GitLab CI
variables:
  KUBERNETES_MEMORY_LIMIT: 2Gi
  KUBERNETES_CPU_LIMIT: 1
```

**VMs:**
- Fixed hardware (GitHub: 2 cores, 7GB RAM)
- No customization on hosted

## Noisy Neighbor Problem

**Shared runners:**
```
Timeline:
10:00 - Your job starts (2 cores available)
10:05 - Competitor's job starts (shares same host)
10:05 - Your job slows down (CPU contention)
```

**Mitigation:**
- Use dedicated runner pools
- Queue-based fairness
- Resource quotas

## Docker-in-Docker Risks

```yaml
# Needs privileged mode
services:
  - docker:dind

# This gives full host access!
script:
  - docker run --privileged malicious-image
  # Can now access host kernel, other containers, secrets
```

**Safer alternative:** Kaniko, buildah (rootless)

## Interview Questions

**Q1:** Job writes sensitive data to `/tmp/secrets.txt`. Next job on same runner reads it. Platform?

**A:** Self-hosted runner with persistent disk, OR Jenkins shared workspace. Hosted runners (GitHub Actions) create fresh VMs so this can't happen.

**Q2:** Why is `docker:dind` dangerous in CI?

**A:** Requires privileged mode, which grants:
- Full host access
- Ability to escape container
- Access to other containers
- Potential secret leakage

**Q3:** Container-based CI slower after adding many dependencies. Why?

**A:** 
- Larger Docker image layers
- Layer caching might be invalidated
- Network download time
- Registry throttling

**Fix:** Multi-stage builds, dependency caching, private registry.

## Key Takeaways

- VMs: Strongest isolation, slowest
- Containers: Medium isolation, fast
- Shared workspace: Weakest, instant
- Self-hosted has persistent state risk
- `docker:dind` requires privileged mode (dangerous)
- Noisy neighbors on shared infrastructure
