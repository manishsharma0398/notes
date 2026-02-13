# Chapters 16-19: Platform Differences and Observability

## Chapter 16: GitHub Actions vs GitLab CI vs Jenkins

### Conceptual Differences

| Feature | GitHub Actions | GitLab CI | Jenkins |
|---------|---------------|-----------|---------|
| **Isolation** | Fresh VM per job | Container per job | Shared workspace |
| **Config** | YAML per workflow | Single `.gitlab-ci.yml` | Groovy/Jenkinsfile |
| **Triggers** | Webhook (GitHub) | Webhook (GitLab) | Poll SCM / webhook |
| **Secrets** | Encrypted, repo/org | Encrypted, project/group | Credentials plugin |
| **Artifacts** | Built-in, time-limited | Built-in, configurable | Plugin-based |
| **Caching** | actions/cache | cache: key/paths | Plugin-based |
| **Runners** | Hosted or self | Hosted or self | Self-hosted only |
| **Matrix** | strategy.matrix | parallel: | Multi-config |

### GitHub Actions Specifics

```yaml
on:
  pull_request:  # Simulated merge!
  workflow_dispatch:  # Manual trigger

permissions:
  contents: read  # Fine-grained

concurrency:
  group: ${{ github.ref }}  # Only one per branch
```

**Gotcha:** `pull_request` event checks out merge commit, not  branch HEAD.

### GitLab CI Specifics

```yaml
stages:
  - build
  - test

build:
  stage: build
  script:
    - make build
  artifacts:
    paths:
      - dist/
    expire_in: 1 week

test:
  stage: test
  dependencies:
    - build  # Download artifacts
```

**Gotcha:** `stages` determine order, jobs in same stage run parallel.

### Jenkins Specifics

```groovy
pipeline {
    agent any
    stages {
        stage('Build') {
            steps {
                sh 'make build'
            }
        }
    }
}
```

**Gotcha:** Shared workspace means files persist between stages (unlike GitHub/GitLab).

---

## Chapter 17: Versioning, Rollback, and Reproducibility

### Reproducible Builds

**Requirements:**
1. Pin ALL versions (OS, tools, dependencies)
2. Commit lockfiles
3. Use exact SHAs for actions
4. Archive built artifacts

**Example:**
```yaml
- uses: actions/checkout@a1b2c3d  # SHA, not tag
- run: docker pull node:18.14.0  # Exact version
- run: npm ci  # Respects lockfile
```

### Rollback Strategies

**Strategy 1: Artifact-based**
```yaml
# Deploy previous artifact
- uses: actions/download-artifact@v3
  with:
    name: app-v1.2.2  # Previous version
- run: deploy.sh
```

**Strategy 2: Git revert**
```yaml
- run: |
    git revert HEAD
    git push
    # Triggers new build
```

**Strategy 3: Blue-Green**
```yaml
# Keep old version running
- run: kubectl apply -f deploy-v1.2.3.yaml
# Test new version
- run: kubectl apply -f deploy-v1.2.4.yaml
# Switch traffic or rollback
```

---

## Chapter 18: Observability and Debugging Pipelines

### Logging Strategies

```yaml
# Verbose logging
- run: |
    set -x  # Bash debug mode
    npm test --verbose

# Grouped logs
- run: echo "::group::Installing dependencies"
- run: npm install
- run: echo "::endgroup::"
```

### Debug Mode

```yaml
# Enable for specific runs
steps:
  - run: |
      if [ "$RUNNER_DEBUG" == "1" ]; then
        set -x
      fi
```

**Enable:** Set repository secret `ACTIONS_RUNNER_DEBUG=true`

### Step Outputs

```yaml
- id: build
  run: |
    VERSION=$(cat version.txt)
    echo "version=$VERSION" >> $GITHUB_OUTPUT

- run: echo "Built version ${{ steps.build.outputs.version }}"
```

### Debugging Failed Jobs

**Checklist:**
1. Check environment (env vars, secrets)
2. Check checkout SHA (correct commit?)
3. Check cache hits/misses
4. Check artifact downloads
5. Check runner logs (runner-level issues)
6. Reproduce locally with same versions

### Tmate (SSH into runner)

```yaml
- uses: mxschmitt/action-tmate@v3
  if: failure()  # SSH on failure
```

**Security risk:** Only use on private repos!

---

## Chapter 19: Undefined and Platform-Specific Behavior

### Undefined Behavior

**Parallel cache writes:**
```yaml
matrix:
  shard: [1, 2, 3]
steps:
  - uses: actions/cache@v3
    with:
      key: cache  # All write same key
      save-always: true
# Result: Undefined (last writer wins? corrupted?)
```

**Concurrent deployments:**
```yaml
# Two workflows deploy simultaneously
# Result: Undefined (race condition)
```

### Platform-Specific

**Filesystem case sensitivity:**
```yaml
# Works on Linux
-  run: cat File.txt

# Fails on macOS (case-insensitive by default)
# File.txt vs file.txt are SAME
```

**Environment variables:**
```bash
# Linux/Mac
echo $HOME

# Windows
echo %USERPROFILE%  # PowerShell: $env:USERPROFILE
```

**Shell differences:**
```yaml
# Default shells
runs-on: ubuntu-latest  # bash
runs-on: windows-latest  # PowerShell
runs-on: macos-latest  # bash
```

**Line endings:**
```yaml
# Windows checkout
- run: cat file.txt  # CRLF line endings
# Breaks scripts expecting LF
```

**Fix:**
```yaml
- uses: actions/checkout@v3
  with:
    autocrlf: false  # Don't convert line endings
```

### Surprising Behavior

**Exit codes:**
```yaml
- run: |
    false  # Exit 1
    echo "This runs!"  # Still executes!

# Fix: Use set -e
- run: |
    set -e  # Exit on first error
    false
    echo "Never runs"
```

**Masked variables:**
```yaml
- run: |
    SECRET="${{ secrets.TOKEN }}"
    echo "Token: $SECRET"  # Masked
    echo "Token: ${SECRET:0:5}..."  # NOT masked (substring)
```

---

## Combined Notes (Ch 16-19)

**Platform Differences:**
- GitHub: VM isolation, pull_request = merge commit
- GitLab: Container isolation, stages = order
- Jenkins: Shared workspace, poll SCM

**Reproducibility:**
- Pin all versions (OS, tools, deps)
- Commit lockfiles
- SHA-pin actions

**Debugging:**
- Verbose logging (`set -x`)
- Step outputs
- Tmate for SSH (private repos only)

**Undefined:**
- Parallel cache writes
- Concurrent deployments
- Platform-specific: case sensitivity, line endings, shells

**One-Sentence:**
Platform-specific pipeline behavior spans isolation models (GitHub VMs vs GitLab containers vs Jenkins shared workspaces), reproducibility requirements (version pinning, lockfiles, SHA references), observability through logging and step outputs, and undefined behavior in concurrent operations with platform quirks like case sensitivity and line endings requiring explicit handling.
