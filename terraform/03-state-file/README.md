# Chapter 03 — The State File

## Mental Model

The state file is **Terraform's memory** — a JSON record of every resource Terraform manages, mapping HCL addresses to real cloud IDs and their full attribute set.

Without state, Terraform can't answer: *"Which AWS Lambda function corresponds to `aws_lambda_function.presign` in my config?"* The cloud has no concept of Terraform resource addresses. State is the bridge.

During every `terraform plan`, Terraform reasons about **three sources of truth simultaneously**:

```
┌──────────────────────┐
│    YOUR .tf CONFIG   │     ← desired state: what you declared
└──────────┬───────────┘
           │
           ▼
  ┌─────────────────┐      ┌──────────────────────┐
  │   PLAN (diff)   │◄─────│   STATE FILE         │← recorded state: last apply result
  └─────────────────┘      └──────────────────────┘
           ▲
           │
┌──────────┴───────────┐
│   CLOUD REALITY      │     ← actual state: fetched via provider ReadResource at plan time
└──────────────────────┘
```

The plan is the diff of all three. Terraform treats your config as the source of truth — drift from cloud is planned to be reverted.

---

## What the State File Contains

The state file is `terraform.tfstate`, a JSON file with this structure:

```json
{
  "version": 4,
  "terraform_version": "1.9.0",
  "serial": 7,
  "lineage": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "outputs": {
    "api_gateway_invoke_url": {
      "value": "https://xyz.execute-api.ap-south-1.amazonaws.com/stg",
      "type": "string"
    }
  },
  "resources": [
    {
      "mode": "managed",
      "type": "aws_lambda_function",
      "name": "presign",
      "provider": "provider[\"registry.terraform.io/hashicorp/aws\"]",
      "instances": [
        {
          "schema_version": 0,
          "attributes": {
            "arn": "arn:aws:lambda:ap-south-1:123456789012:function:prasaarit-presign-stg",
            "function_name": "prasaarit-presign-stg",
            "handler": "handler.lambda_handler",
            "runtime": "python3.12",
            "timeout": 10,
            "memory_size": 128,
            "role": "arn:aws:iam::123456789012:role/prasaarit-stg-lambda-exec",
            "source_code_hash": "abc123def456...",
            "environment": [{"variables": {"BUCKET_NAME": "prasaarit-uploads-stg"}}],
            "last_modified": "2026-03-19T14:30:00.000+0000"
          }
        }
      ]
    }
  ]
}
```

**Key fields:**

| Field | What it is | Why it matters |
|---|---|---|
| `serial` | Incrementing write counter | Bumped on every state write; used for optimistic concurrency detection by remote backends |
| `lineage` | UUID generated at first `init` | Prevents accidentally applying one project's state to a different backend |
| `outputs` | Output values after apply | Stored so `terraform output` works without re-running plan |
| `resources[].instances[].attributes` | **Every attribute** the provider returned | ARN, ID, runtime, settings — everything from the last `ApplyResourceChange` or `ReadResource` |

### What the State File Cannot Represent

- **Resources Terraform didn't create** — console-created resources are invisible until `import`ed
- **The full cloud surface** — provider `ReadResource` returns only attributes the schema tracks; some AWS-internal metadata is omitted
- **Cross-stack awareness** — stack A's state knows nothing about stack B; if A changes an output that B depends on via `terraform_remote_state`, B doesn't know until it re-plans
- **Real-time truth** — state is a snapshot from the last apply. Between runs, the cloud can diverge silently.

---

## State Drift

Drift is when cloud reality diverges from what the state file records. It is the #1 source of unexpected Terraform behavior.

### What Causes Drift

| Source | Example |
|---|---|
| Manual console change | Someone changed Lambda timeout from 10s → 30s in the AWS console |
| AWS auto-modification | AWS automatically upgraded RDS minor version, added default tags, modified security group rules |
| Out-of-band automation | A different Terraform stack, a script, or AWS Config remediation changed the resource |
| Eventual consistency | AWS API returned success but the change hadn't propagated; the next refresh reads a stale value |

### How Terraform Detects and Handles Drift

During `terraform plan`, Terraform calls each provider's `ReadResource` RPC — the **refresh step**. It compares:

```
State says:   timeout = 10
Cloud says:   timeout = 30   ← drift detected via ReadResource
Config says:  timeout = 10

Plan output:  ~ timeout: 30 → 10  (Terraform will revert the drift on apply)
```

Terraform treats your config as the source of truth and plans to **revert** the cloud to match. Between plan runs, Terraform is completely blind to drift — there is no continuous monitoring, only point-in-time detection.

### Silent Drift on Unmanaged Attributes

```hcl
resource "aws_lambda_function" "presign" {
  function_name = "prasaarit-presign-stg"
  runtime       = "python3.12"
  # ... but 'description' is not specified
}
```

If someone adds a description in the console, behavior depends on the provider: some will revert it to empty on the next apply, others ignore it. Always read `terraform plan` output carefully — attributes you don't manage can still appear in the diff.

---

## `terraform plan -refresh-only` and `terraform refresh`

### `terraform plan -refresh-only` — The Modern Approach

```bash
terraform plan -refresh-only     # shows what state WOULD become after refresh — no changes
terraform apply -refresh-only    # actually updates state to match cloud — no infrastructure changes
```

Use this when manual changes were intentional and you want to **accept them into state** without reverting. After the `-refresh-only` apply, update your config to match so future plans are clean.

### `terraform refresh` — Deprecated in Practice

```bash
terraform refresh    # directly updates state to match cloud. No review. No confirmation.
```

Avoid this. If someone deleted your Lambda in the console, `terraform refresh` silently removes it from state. The next `plan` shows nothing to do — even though your config says the Lambda should exist.

### `-refresh=false` During Normal Plan

```bash
terraform plan -refresh=false    # skips ReadResource calls; uses stale state
```

Faster for large stacks, but will not detect drift. Safe only when you're confident the cloud hasn't changed (e.g., CI pipeline against a freshly created environment). Never use in production apply pipelines.

---

## `terraform import` — Adopting Existing Resources

`import` tells Terraform: *"this resource already exists in the cloud — add it to my state."*

### CLI Import (Classic)

```bash
terraform import aws_s3_bucket.uploads prasaarit-uploads-stg
#                ─────────────────────  ─────────────────────
#                resource address       cloud resource identifier
```

**What import does:**
1. Calls provider `ReadResource` for the given cloud ID
2. Writes the full result into state at the given address
3. Done — no HCL is generated, no AWS changes are made

**What import does NOT do:**
- Does not write HCL — you must write the `resource` block yourself
- Does not verify your config matches reality — the next `plan` will show all the differences

### `import` Block (Terraform 1.5+) — The Better Way

```hcl
# Declare the import in config — reviewable in Git, runs as part of normal plan/apply
import {
  to = aws_s3_bucket.uploads
  id = "prasaarit-uploads-stg"
}

resource "aws_s3_bucket" "uploads" {
  bucket = "prasaarit-uploads-stg"
}
```

```bash
terraform plan    # shows the import as a planned action
terraform apply   # executes the import AND any config drift fixes
```

**Bonus**: auto-generate the HCL from the imported resource:
```bash
terraform plan -generate-config-out=generated.tf
# Writes a complete HCL block from the cloud resource's actual attributes.
# Review it carefully — it includes every attribute the provider tracks.
```

**Config-driven import is always preferred** over CLI import because it is code-reviewed, works in CI/CD without manual steps, and is idempotent.

### After Any Import: Reconcile Config

```bash
terraform plan
# Output might show:
#   ~ force_destroy: true → false
#   ~ tags: { "Environment" = "stg" } → {}
# Your config is incomplete. Iteratively add missing attributes until plan shows 0 changes.
```

---

## Remote State — S3 Backend

Local state (`terraform.tfstate` on disk) has fatal problems at team scale:

| Problem | Impact |
|---|---|
| No locking | Two concurrent applies corrupt state |
| Not shared | Team members see different state |
| No versioning | Corrupted state cannot be rolled back |
| Secrets on disk | Plaintext JSON with passwords on every developer's laptop |

### S3 Backend Configuration

```hcl
terraform {
  backend "s3" {
    bucket  = "prasaarit-terraform-state"
    key     = "upload-service/terraform.tfstate"
    region  = "ap-south-1"
    encrypt = true

    # Option A: DynamoDB locking (pre-v1.11, still widely used)
    dynamodb_table = "prasaarit-terraform-locks"

    # Option B: S3 native locking (v1.11+, replaces DynamoDB)
    # use_lockfile = true
  }
}
```

### DynamoDB Locking — How It Works

DynamoDB uses a **conditional `PutItem`** with `attribute_not_exists` — an atomic operation:

```
Engineer A: terraform apply
  → Writes lock record to DynamoDB: { LockID: "upload-service/terraform.tfstate" }
  → Reads state from S3 → applies → writes new state → deletes lock

Engineer B: terraform apply (while A is running)
  → Tries to write lock record → DynamoDB: "Item already exists"
  → Error: "Error acquiring the state lock"
  → B must wait until A finishes and releases the lock
```

The `serial` field in state provides an **optimistic concurrency check**: if two processes somehow both write, the one with the stale serial is rejected.

### S3 Native Locking — `use_lockfile` (v1.11+)

Terraform v1.11 introduced native S3-based locking via a `.tflock` file written to the same S3 bucket as the state. This **deprecates the DynamoDB table requirement**.

```hcl
terraform {
  backend "s3" {
    bucket       = "prasaarit-terraform-state"
    key          = "upload-service/terraform.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true   # ← no dynamodb_table needed
  }
}
```

How it works: a conditional `s3:PutObject` with `If-None-Match: *` acts as the atomic lock — the same atomic guarantee as DynamoDB, without the additional service. S3 versioning on the bucket should be enabled so the lock file's history is auditable.

**Migration from DynamoDB to native locking** requires `terraform init -reconfigure` after updating the backend block. The DynamoDB table can be decommissioned once all applies use the new lock.

### The Chicken-and-Egg Problem

You need an S3 bucket to store your state — but who creates the bucket?

**Option A** (most common): Create the S3 bucket and DynamoDB table manually (AWS console or CLI) once as a bootstrap step, then configure your backend to use them.

**Option B**: A tiny separate Terraform config with **local state** creates only the state bucket and lock table. Your actual project then uses those as its backend.

**Option C** (start simple): Begin with local state. When ready for teams and CI/CD, create the bucket, add the `backend "s3"` block, and run `terraform init -migrate-state`. Terraform will copy local state to S3.

For your Prasaarit project: use Option C — start local now, migrate when you add GitHub Actions CI/CD in Chapter 07.

### `terraform_remote_state` — Reading Outputs Across Stacks

When stack B depends on an output from stack A (e.g., a VPC ID created by a networking stack):

```hcl
# Stack B — reading networking outputs from stack A's state
data "terraform_remote_state" "networking" {
  backend = "s3"
  config = {
    bucket = "prasaarit-terraform-state"
    key    = "networking/terraform.tfstate"
    region = "ap-south-1"
  }
}

locals {
  vpc_id = data.terraform_remote_state.networking.outputs.vpc_id
}
```

**The operational risk**: if stack A removes or renames the `vpc_id` output, stack B's next plan fails. Outputs in shared stacks are a public API — treat them with the same stability guarantee. Consider SSM Parameter Store as a looser coupling mechanism for cross-stack values.

---

## State File Security

The state file contains **sensitive values in plaintext**, always:

```json
{
  "attributes": {
    "password": "super-secret-db-password",   ← plaintext in state
    "environment": [{
      "variables": { "API_SECRET": "sk_live_abc123" }  ← plaintext in state
    }]
  }
}
```

`sensitive = true` on a variable or output **only hides the value from plan/apply terminal output**. It does not remove it from, or encrypt it in, the state file.

### Protections

| Protection | How |
|---|---|
| Encrypt state at rest | S3 backend with `encrypt = true` (AES-256 or KMS-managed key) |
| Restrict state access | S3 bucket policy: only CI/CD role and infra engineers can read/write |
| Gitignore local state | `*.tfstate`, `*.tfstate.*`, `.terraform/` always in `.gitignore` |
| Enable S3 versioning | Recoverable on state corruption or accidental deletion |
| Avoid secrets in state | Use Secrets Manager for DB passwords, API keys. Pass the **ARN** to Lambda, not the secret value. State stores only the ARN. |

---

## State Manipulation Commands

These are break-glass tools. Misuse can orphan resources or cause unintended destroys.

### Read-Only: `list` and `show`

```bash
terraform state list
# aws_iam_role.lambda_exec
# aws_lambda_function.presign
# aws_api_gateway_rest_api.api

terraform state show aws_lambda_function.presign
# Prints all attributes as Terraform knows them.
# Useful for: "what does Terraform THINK this resource looks like right now?"
```

### `terraform state mv` — Rename or Move a Resource

When you rename a resource in config, Terraform sees "old address deleted, new address created." `state mv` tells Terraform it's the same resource.

```bash
# Before: resource "aws_lambda_function" "presign" { ... }
# After:  resource "aws_lambda_function" "generate_url" { ... }

terraform state mv aws_lambda_function.presign aws_lambda_function.generate_url
```

**Problem with this approach**: it's a manual CLI command. It bypasses code review, doesn't work in CI/CD without special handling, and if forgotten before running plan, Terraform destroys and recreates the resource.

**Preferred: `moved` block (v1.1+)**

```hcl
moved {
  from = aws_lambda_function.presign
  to   = aws_lambda_function.generate_url
}
```

Add this to your config. The next `plan` shows the move, and `apply` updates state automatically. The `moved` block is in version control, works in CI/CD, and can be removed once applied across all environments.

### `terraform state rm` — Remove from State Without Destroying

```bash
terraform state rm aws_lambda_function.presign
# Removes Lambda from state. Terraform "forgets" it.
# The Lambda still exists in AWS — just unmanaged.
# Next plan: nothing about this Lambda (Terraform doesn't know it exists).
```

**When to use**: handing a resource to another team's Terraform config without destroying it.

**Danger**: if you `state rm` and run `apply` without removing the resource block from config, Terraform will try to create a new resource — and fail with a conflict because the original still exists in AWS.

**Preferred: `removed` block (v1.7+)**

```hcl
removed {
  from = aws_lambda_function.presign

  lifecycle {
    destroy = false    # forget it (don't destroy the real resource)
    # destroy = true   # would destroy it on the next apply
  }
}
```

Like `moved`, this is declarative: it's in version control, goes through code review, and applies through the normal plan/apply flow. The `removed` block is the right way to signal that a resource is intentionally being dropped from Terraform management.

### `-replace` Flag — Force Rebuild a Specific Resource

```bash
terraform apply -replace=aws_lambda_function.presign
# Destroys and recreates the Lambda even if config hasn't changed.
# Use when a resource is in a bad AWS state and needs to be rebuilt.
```

This replaced the deprecated `terraform taint` command.

---

## Guarantees and Failure Modes

### What Terraform Guarantees About State

| Guarantee | Detail |
|---|---|
| **Write-after-each-resource** | State is updated after each successful resource apply (Chapter 01). A crash leaves state reflecting exactly what succeeded. |
| **Serial counter** | Every write increments `serial`. Remote backends use it for optimistic conflict detection between concurrent applies. |
| **Lineage check** | Terraform refuses a state file with a different `lineage` — prevents cross-project state corruption. |
| **Atomic locking** | With DynamoDB or `use_lockfile`, two simultaneous applies cannot both acquire the lock. |

### What Terraform Does NOT Guarantee About State

| Non-guarantee | Why it matters |
|---|---|
| **State ≠ reality** | State is a snapshot. Between applies, the cloud can diverge silently. There is no push-based drift notification. |
| **`sensitive = true` protects state** | It does not. The value is still plaintext in the state file. |
| **Automatic recovery** | If state is deleted or corrupted, you must re-import every resource manually. No auto-reconstruction. |
| **Cross-stack safety** | Stack A doesn't know stack B depends on its outputs. A can break B by removing an output. |

---

## Source References

- [Terraform State](https://developer.hashicorp.com/terraform/language/state) — official docs
- [S3 Backend](https://developer.hashicorp.com/terraform/language/backend/s3) — S3 backend config, `use_lockfile`
- [Import Blocks](https://developer.hashicorp.com/terraform/language/import) — config-driven import (v1.5+)
- [Moved Blocks](https://developer.hashicorp.com/terraform/language/modules/develop/refactoring) — refactoring without destroy
- [Removed Block](https://developer.hashicorp.com/terraform/language/resources/syntax#removing-resources) — declarative state rm (v1.7+)
- [State File JSON Format](https://developer.hashicorp.com/terraform/internals/json-format) — v4 schema
