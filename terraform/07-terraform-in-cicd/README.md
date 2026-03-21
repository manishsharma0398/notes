# Chapter 07 — Terraform in CI/CD (GitLab CI & GitHub Actions)

## Mental Model

**Problem this solves:** Terraform run on a developer's laptop is non-reproducible, non-auditable, and non-reviewable. Anyone can run `terraform apply` with local state of unknown freshness, using whatever AWS credentials they have in `~/.aws`, and there is no record of what changed or why. Teams of more than one person will corrupt each other's state.

CI/CD for Terraform solves three things:

1. **Who can deploy** — only the pipeline can run `apply`; the IAM role that does it has no long-lived secret to steal
2. **What gets deployed** — a human reviews the exact binary plan that will be applied, not a text description
3. **When it's safe to deploy** — the lock table prevents two concurrent applies from tearing the state apart

```
                 ┌───────────────────────────────────────────────────────────┐
git push         │  PIPELINE                                                 │
─────────────►  │                                                            │
                 │  [validate/fmt]──►[terraform plan -out=plan.bin]──►[gate] │
                 │                                                    │       │
                 │                              human reviews plan    │       │
                 │                              and clicks "deploy" ◄─┘       │
                 │                                                            │
                 │                    [terraform apply plan.bin]              │
                 └───────────────────────────────────────────────────────────┘
```

The **plan file** (`plan.bin`) is the contract. Everything in the pipeline centres on generating it safely, storing it safely, and consuming it exactly — not recalculating it.

---

## Topic 1 — Saved Plan Files: The Core Contract

### Mechanism

`terraform plan -out=tfplan.bin` serialises the desired diff into a binary protobuf file. This file contains:
- The exact current state snapshot Terraform refreshed against
- The exact set of resource changes (create / update / replace / destroy)
- Encoded provider schemas

When you run `terraform apply tfplan.bin`, Terraform does **not** recalculate. It executes the serialised changes verbatim. If the remote state has changed since the plan was created, the apply will detect the state version mismatch and fail with an error rather than silently applying a different plan.

```bash
# Stage 1 — Plan job
terraform plan -out=tfplan.bin          # generates the contract

# Stage 2 — Apply job (hours later, after human review)
terraform apply tfplan.bin             # executes exactly that contract
```

### What Terraform Guarantees

- `terraform apply <planfile>` applies the exact diff captured at plan time.
- If the state file version has changed since the plan was captured, the apply aborts.
- The CLI will not prompt for confirmation when given an explicit plan file.

### Failure Mode — The Stale Plan Anti-Pattern

```bash
# WRONG — extremely common pipeline mistake
job_1: terraform plan          # output goes to stdout, nothing saved
job_2: terraform apply -auto-approve  # computes a BRAND NEW plan silently
```

Between Job 1 and Job 2 (e.g., while waiting for human approval):
- A colleague might have applied a different stack that shares state outputs
- Someone might have manually changed a resource in the console
- A scheduled Lambda or Auto Scaling event might have modified tags

Job 2 will apply the **new** plan without human review. This is the most common cause of "but I approved the plan and something else happened" incidents.

### Security Warning

Binary plan files contain the **entire state** in decrypted form, including any secrets. A plan file for a stack that manages an RDS instance will contain the master password in plaintext inside the protobuf.

**GitLab CI rules:**
```yaml
artifacts:
  paths: [tfplan.bin]
  expire_in: 1 hour      # do not leave plan files around indefinitely
  access: developer      # restrict who can download artifacts
```

Never post `terraform show tfplan.bin` output as an MR comment without scrubbing. Sensitive values are masked in the CLI display but are present in the plan protobuf.

---

## Topic 2 — OIDC Credential Injection (Passwordless Authentication)

### Problem

The classical approach stores AWS Access Keys (`AKIA…`) as GitLab/GitHub CI/CD secrets. These are:
- **Long-lived** — do not expire automatically, require manual rotation
- **Broad** — one key for the whole account, not scoped to a single repo or branch
- **Leakable** — accidentally logged, committed to history, or left in a former employee's memory

### Mechanism — OIDC Token Exchange

OIDC (OpenID Connect) replaces long-lived keys with a short-lived trust handshake:

```
GitLab Runner                            AWS STS
─────────────                            ───────
      │                                     │
      │  1. GitLab issues a signed JWT      │
      │     for this specific pipeline job  │
      │                                     │
      │  2. Runner calls AssumeRoleWith     │
      │     WebIdentity, passing JWT ──────►│
      │                                     │  3. AWS verifies JWT signature
      │                                     │     against GitLab's OIDC endpoint
      │                                     │  4. AWS checks IAM role Trust Policy:
      │                                     │     Is sub == "project_path:myorg/
      │                                     │     myrepo:ref_type:branch:ref:main"?
      │◄──── 5. Temporary credentials ──────│
      │         (valid 60 min)              │
      │                                     │
terraform plan / apply (using temp creds)
```

### GitLab CI Setup

**Step 1 — AWS side (one-time bootstrap):**
```hcl
# Create the OIDC trust between AWS and GitLab
resource "aws_iam_openid_connect_provider" "gitlab" {
  url             = "https://gitlab.com"
  client_id_list  = ["https://gitlab.com"]
  thumbprint_list = ["b3dd7606d2b5a8..."]  # GitLab's TLS thumbprint
}

resource "aws_iam_role" "ci_deploy" {
  name = "terraform-ci-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.gitlab.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringLike = {
          # Only allow the main branch of a specific project
          "gitlab.com:sub" = "project_path:myorg/infra:ref_type:branch:ref:main"
        }
      }
    }]
  })
}
```

**Step 2 — `.gitlab-ci.yml`:**
```yaml
deploy-prod:
  id_tokens:
    GITLAB_OIDC_TOKEN:
      aud: https://gitlab.com    # Tells GitLab to issue a JWT for this job
  script:
    - |
      export $(aws sts assume-role-with-web-identity \
        --role-arn arn:aws:iam::123456789012:role/terraform-ci-deploy \
        --role-session-name "gitlab-ci-${CI_PIPELINE_ID}" \
        --web-identity-token "${GITLAB_OIDC_TOKEN}" \
        --duration-seconds 3600 \
        --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' \
        --output text | awk '{print "AWS_ACCESS_KEY_ID="$1" AWS_SECRET_ACCESS_KEY="$2" AWS_SESSION_TOKEN="$3}')
    - terraform apply prod.tfplan
```

### GitHub Actions Setup

```yaml
# Must declare permissions for OIDC token request
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform-ci-deploy
          aws-region: ap-south-1
          # GitHub Actions handles the token exchange automatically
      - run: terraform apply prod.tfplan
```

### What Terraform Guarantees

Nothing — Terraform does not manage credentials, it consumes `AWS_*` environment variables. The guarantee is at the IAM level: the temporary credentials have the permissions of the role you assumed and expire when the session ends.

### Failure Mode — Overly Broad Trust Policy

```hcl
# DANGEROUS — allows ANY GitLab project to assume this role
Condition = {
  StringLike = {
    "gitlab.com:sub" = "*"
  }
}
```

If your trust policy doesn't scope to a specific repository, project, and branch, any GitLab pipeline anywhere can assume your role. Always scope to the minimum: org, repo, and branch (`ref:main` not `ref:*`).

---

## Topic 3 — Plan Review Gates

### Mechanism

A plan review gate is a pipeline pause between `plan` and `apply`. The binary plan artifact is stored, a human reviews it (ideally the text output), and explicitly approves execution.

**GitLab CI — `when: manual`:**
```yaml
stages: [validate, plan, apply]

validate:
  stage: validate
  script:
    - terraform fmt -check -recursive
    - terraform validate

plan-prod:
  stage: plan
  script:
    - terraform workspace select prod
    - terraform plan -out=prod.tfplan
    - terraform show -no-color prod.tfplan | tee plan-output.txt
  artifacts:
    paths: [prod.tfplan, plan-output.txt]
    expire_in: 4 hours

apply-prod:
  stage: apply
  needs: [plan-prod]
  when: manual              # Pipeline halts here — human must click ▶
  environment:
    name: production        # Triggers GitLab Environment protection rules
  script:
    - terraform workspace select prod
    - terraform apply prod.tfplan
```

**GitHub Actions — Environments + Required Reviewers:**
```yaml
jobs:
  plan:
    runs-on: ubuntu-latest
    outputs:
      plan-file: ${{ steps.plan.outputs.plan-file }}
    steps:
      - run: terraform plan -out=prod.tfplan
      - uses: actions/upload-artifact@v4
        with:
          name: prod-tfplan
          path: prod.tfplan

  apply:
    needs: plan
    environment: production     # Requires approval from environment reviewers in GitHub settings
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: prod-tfplan
      - run: terraform apply prod.tfplan
```

### Operational Impact

Ephemeral CI environments running `terraform workspace select prod` mid-pipeline is fine **only if** the workspace was selected consistently across both jobs. Ensure you `terraform init -reconfigure` or use a backend config file to guarantee both jobs connect to the same state backend endpoint.

---

## Topic 4 — Locking and Concurrency

### Mechanism

State locking is covered deeply in Chapter 03. In CI/CD context:

```
Pipeline A (Alice's push)          Pipeline B (Bob's push, 30s later)
─────────────────────────          ──────────────────────────────────
terraform plan                     terraform plan
  → acquires DynamoDB lock           → acquires DynamoDB lock (OK, plan only reads)
terraform apply                    terraform apply
  → acquires exclusive write lock    → tries exclusive write lock
                                     → FAILS: "Error acquiring the state lock"
  → releases lock
```

Both plan phases can run in parallel. Only apply requires an exclusive lock. Pipeline B's apply fails immediately — it does not wait.

### The Two-Layer Defense

**Layer 1 — Terraform's DynamoDB/S3 lock (correctness):**
Prevents state corruption. If Pipeline B fails to acquire the lock, it errors immediately. This is the hard stop — state is safe.

**Layer 2 — CI/CD concurrency control (UX):**
Instead of failing Pipeline B, queue it until Pipeline A finishes. This avoids wasted pipeline runs and means both deployments eventually succeed.

```yaml
# GitLab
apply-prod:
  resource_group: production-tf  # GitLab queues concurrent jobs instead of running them
  script:
    - terraform apply prod.tfplan
```

```yaml
# GitHub Actions — use concurrency groups
concurrency:
  group: terraform-prod
  cancel-in-progress: false      # Don't cancel — queue instead
```

### What Terraform Guarantees

- If the lock cannot be acquired within a timeout (`-lock-timeout=0s` by default, fails immediately), the operation aborts.
- The state file is never left in a partial write state if the locking backend is functioning. (The `terraform apply` writes state atomically after all changes complete or to reflect partial progress on error.)
- `terraform force-unlock <lock-id>` is available as an escape hatch if a pipeline dies mid-apply and leaves a stale lock. **This is dangerous.** Only use it when you are certain no apply is actually running.

### Failure Mode — Stale Lock after CI Runner Crash

If a GitLab runner is killed mid-apply (OOM, pipeline timeout, spot instance termination), the DynamoDB lock record remains. The next pipeline will see `Error acquiring the state lock` indefinitely. You must:
1. Verify no apply is actually running (`terraform show` against the state and inspect AWS resources)
2. Run `terraform force-unlock <lock-id>` with the ID shown in the error

---

## What Terraform Guarantees (Chapter Summary)

| Concern | Guarantee |
|---|---|
| Binary plan file | Applies exactly the captured diff; aborts if state diverged |
| OIDC credentials | Scoped to a specific role; expire automatically (60 min) |
| State locking | Prevents concurrent writes; cannot prevent two separate plans choosing conflicting changes |
| Plan review gate | Human sees what will happen; `apply <planfile>` executes exactly that |
| Concurrency | Terraform guarantees the lock; CI/CD is responsible for queueing or graceful failure |

---

## Source References

- [Running Terraform in Automation](https://developer.hashicorp.com/terraform/tutorials/automation/automate-terraform) — HashiCorp official guide
- [GitLab CI: OIDC with AWS](https://docs.gitlab.com/ee/ci/cloud_services/aws/) — Passwordless auth setup
- [GitHub Actions: OIDC with AWS](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [S3 Backend docs: locking](https://developer.hashicorp.com/terraform/language/settings/backends/s3)
