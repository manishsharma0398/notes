# Chapter 3: Runners and Executors

## Mental Model

**Runner = Worker machine** that claims jobs and executes them

**Executor = Isolation method** (VM, container, process)

## Hosted vs Self-Hosted

| Type | Hosted (GitHub) | Self-Hosted |
|------|----------------|-------------|
| **Management** | Platform manages | You manage |
| **Cost** | Usage-based | Infrastructure cost |
| **Security** | Ephemeral, isolated | Your responsibility |
| **Customization** | Limited | Full control |
| **Secrets** | Encrypted at rest | You control |

## Hosted Runners

**GitHub Actions:**
```yaml
runs-on: ubuntu-latest  # GitHub-managed VM
```

**Specs (GitHub):**
- 2-core CPU
- 7 GB RAM
- 14 GB SSD
- Fresh VM per job

**Lifecycle:**
1. Job queued
2. GitHub provisions fresh VM
3. Job executes
4. VM destroyed

**Pros:** Zero maintenance, always clean  
**Cons:** Limited resources, slower startup, no GPU

## Self-Hosted Runners

**Setup:**
```bash
# Register runner
./config.sh --url https://github.com/owner/repo --token TOKEN

# Run
./run.sh
```

**Workflow:**
```yaml
runs-on: self-hosted
# or
runs-on: [self-hosted, linux, gpu]
```

**Critical Differences:**

1. **Persistent state**
```yaml
# Hosted: Always clean
runs-on: ubuntu-latest
steps:
  - run: ls /tmp  # Empty

# Self-hosted: Might have leftovers!
runs-on: self-hosted
steps:
  - run: ls /tmp  # Previous job artifacts?
```

2. **Security isolation**
- Hosted: Strong (fresh VM)
- Self-hosted: **Weak** (same machine, different runs)

**Danger:** Malicious PR can:
- Read previous job artifacts
- Install persistent malware
- Steal secrets from disk

## Runner Selection

**Labels:**
```yaml
runs-on: [self-hosted, linux, x64, gpu]
```

Matches runner with **all** labels.

**Queue behavior:**
- Job waits for matching runner
- If no runners, PENDING indefinitely
- No automatic fallback

## Performance Implications

**Hosted:**
- Cold start: ~20 seconds (VM provisioning)
- Consistent performance
- Geographic distribution (slower for some regions)

**Self-hosted:**
- Warm start: ~1 second
- Variable performance (depends on hardware)
- Network locality (faster to internal resources)

## Interview Questions

**Q1:** Pipeline slow in morning, fast in afternoon. Using hosted runners. Why?

**A:** Runner contention! High demand in mornings (global, time zones). Afternoon in your zone = morning elsewhere has quieted down.

**Q2:** Security risk with self-hosted runners?

**A:** 
- Persistent state leaks between jobs
- Malicious code can persist across runs
- Secrets on disk accessible to next job
- **Never use for public repos or untrusted PRs**

**Q3:** Self-hosted runner shows "Offline". Workflow pending. What happened?

**A:** 
- Runner process crashed
- Machine restarted
- Network issue
- Runner de-registered

**Fix:** Restart runner process or re-register.

## Key Takeaways

- Hosted: Ephemeral, isolated, managed
- Self-hosted: Persistent, faster, risky
- Self-hosted **never for public repos**
- Jobs queue waiting for matching runner
- Runner labels must **all** match
