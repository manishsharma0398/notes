# Chapter 03 — The State File

## Mental Model

The state file is **Terraform's memory**. It is a JSON file that records what Terraform has created, what those resources look like, and what config created them.

Think of it this way:

> The state file is a **map** from your HCL resource addresses (`aws_lambda_function.presign`) to the real cloud resource IDs (`arn:aws:lambda:ap-south-1:123456:function:prasaarit-presign-stg`). Without this map, Terraform has no idea which real resource corresponds to which block in your config.

Here's the critical triangle that Terraform reasons about during every `plan`:

```
            ┌──────────────────────┐
            │    YOUR .tf CONFIG   │
            │    (desired state)   │
            └──────────┬───────────┘
                       │
          "what do     │        "what did I
           you want?"  │         last record?"
                       │
                       ▼
              ┌─────────────┐           ┌──────────────────┐
              │    PLAN     │◄──────────│   STATE FILE     │
              │  (the diff) │           │  (recorded state)│
              └─────────────┘           └──────────────────┘
                       ▲
          "what does   │
           the cloud   │
           actually    │
           look like?" │
                       │
            ┌──────────┴───────────┐
            │     CLOUD REALITY    │
            │  (actual state via   │
            │   provider refresh)  │
            └──────────────────────┘
```

**Three sources of truth. Terraform diffs all three.**

---

## What the State File Contains

The state is a JSON file (by default `terraform.tfstate`). Here's what's inside, with a real example from your Prasaarit project:

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
            "id": "prasaarit-presign-stg",
            "runtime": "python3.12",
            "timeout": 10,
            "memory_size": 128,
            "role": "arn:aws:iam::123456789012:role/prasaarit-stg-lambda-exec",
            "source_code_hash": "abc123def456...",
            "environment": [
              {
                "variables": {
                  "BUCKET_NAME": "prasaarit-uploads-stg",
                  "ALLOWED_ORIGIN": "*"
                }
              }
            ],
            "last_modified": "2026-03-19T14:30:00.000+0000"
          }
        }
      ]
    }
  ]
}
```

### Key Fields

| Field | What it is | Why it matters |
|-------|-----------|----------------|
| `version` | State format version (currently 4) | Terraform versions may not be able to read older/newer formats |
| `serial` | Incrementing counter | Bumped on every write. Used for optimistic locking with remote backends. |
| `lineage` | UUID generated on first `init` | Identifies this specific state. Prevents accidentally applying one project's state to another. |
| `outputs` | Output values from your config | Stored here so `terraform output` works without re-running plan |
| `resources` | Array of every managed resource | Each entry maps resource address → cloud resource attributes |
| `resources[].instances[].attributes` | **Every attribute** of the resource | ARN, ID, name, settings — everything the provider returned from the last apply |

---

## What the State File Cannot Represent

The state file has critical blind spots:

**1. It does NOT track resources Terraform didn't create.**
If you created an S3 bucket in the AWS console, Terraform has no idea it exists. The state only contains resources Terraform created via `apply` or added via `import`.

**2. It does NOT capture the full cloud state.**
The provider's `ReadResource` returns a subset of the resource's configuration. Some cloud-side attributes (AWS-internal metadata, service-linked configurations) are not represented. The state is an approximation, not a perfect mirror.

**3. It does NOT track dependencies between runs.**
If module A's output feeds into module B's input via `terraform_remote_state`, and module A changes, module B's state doesn't know until you re-run plan on module B.

**4. It goes stale the moment it's written.**
The state records what the cloud looked like at the time of the last `apply`. Between applies, anything can change in the cloud. Terraform is blind to drift until the next `plan` refresh.

---

## State Drift

State drift is when the cloud reality diverges from what the state file records. This is the #1 source of unexpected Terraform behavior.

### What Causes Drift

```
Drift Source                         │ How it happens
─────────────────────────────────────┼──────────────────────────────────────
Manual console changes               │ Someone changed Lambda timeout in the
                                     │ AWS console from 10s → 30s
                                     │
AWS auto-modifications               │ AWS automatically added default tags,
                                     │ modified security group rules, or
                                     │ upgraded RDS minor version
                                     │
Out-of-band automation               │ A different Terraform stack, a script,
                                     │ or AWS Config remediation modified the
                                     │ resource
                                     │
Eventual consistency                 │ AWS API returned success but the change
                                     │ hadn't propagated. Next refresh reads a
                                     │ stale value.
```

### How Terraform Detects Drift

During `terraform plan`, Terraform calls the provider's `ReadResource` RPC for every resource in state. This is the **refresh** step. It compares:

```
State says:    timeout = 10
Cloud says:    timeout = 30     ← drift detected!
Config says:   timeout = 10

Plan output:   ~ timeout: 30 → 10    (Terraform plans to revert the drift)
```

Terraform will plan to **revert** the cloud to match your config. It doesn't adopt the console change — it treats your `.tf` config as the source of truth.

### The Danger: Silent Drift on Attributes You Don't Manage

```hcl
resource "aws_lambda_function" "presign" {
  function_name = "prasaarit-presign-stg"
  runtime       = "python3.12"
  handler       = "handler.lambda_handler"
  # ... but you didn't specify 'description'
}
```

If someone adds a description in the console, Terraform's behavior depends on the provider:
- Some providers **ignore** attributes not in your config (Terraform won't revert the description)
- Some providers **revert** them to empty/default on the next apply

This is provider-specific behavior and a common source of surprises. Always check the `plan` output carefully.

---

## `terraform refresh` vs `terraform plan -refresh-only`

### The Old Way: `terraform refresh` (Deprecated in Practice)

```bash
terraform refresh
```

This command calls `ReadResource` for every resource and **directly updates the state file** to match cloud reality. It does NOT compare against your config. It does NOT ask for confirmation.

**Problem**: If someone deleted your Lambda in the console, `terraform refresh` silently removes it from state. Now Terraform doesn't know the Lambda should exist. The next `plan` will show **nothing to do** — even though your config says the Lambda should exist.

### The Modern Way: `terraform plan -refresh-only`

```bash
terraform plan -refresh-only
```

This shows you what the state **would** change to after refreshing against the cloud — but doesn't modify anything. You review the diff and then decide:

```bash
terraform apply -refresh-only    # If you want to adopt the cloud changes into state
```

**When to use `-refresh-only`**: After someone made legitimate manual changes in the console that you want to accept into state without reverting them.

### The Default: Refresh During Normal Plan

By default, `terraform plan` **always refreshes** (calls `ReadResource` for every resource) before computing the plan. You can skip this with:

```bash
terraform plan -refresh=false    # Uses stale state. Faster, but won't detect drift.
```

**When to skip refresh**: Large stacks with hundreds of resources where refresh takes minutes and you're confident the cloud hasn't changed. Otherwise, always refresh.

---

## `terraform import` — Adopting Existing Resources

`import` tells Terraform: "this resource already exists in the cloud — add it to my state."

### How It Works

```bash
terraform import aws_s3_bucket.uploads prasaarit-uploads-stg
#                ^^^^^^^^^^^^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^
#                resource address in .tf     real cloud identifier
```

**What `import` does:**
1. Calls the provider's `ReadResource` for the given cloud ID
2. Writes the result into the state file under the given resource address
3. That's it.

**What `import` does NOT do:**
- It does NOT generate HCL config. You must write the `resource "aws_s3_bucket" "uploads" { ... }` block yourself.
- It does NOT verify your config matches the imported state. If your config differs from reality, the next `plan` will show changes.

### The Workflow

```bash
# Step 1: Write the resource block in your .tf file (even if incomplete)
# s3.tf
resource "aws_s3_bucket" "uploads" {
  bucket = "prasaarit-uploads-stg"
}

# Step 2: Import the existing cloud resource into state
terraform import aws_s3_bucket.uploads prasaarit-uploads-stg

# Step 3: Run plan to see if your config matches reality
terraform plan
# Output might show:
#   ~ force_destroy: true → false
#   ~ tags: { "Environment" = "stg" } → {}
# This means your config is missing some attributes that exist on the real bucket.

# Step 4: Update your config to match reality (or accept the diff)
```

### Import Blocks (Terraform 1.5+)

Modern Terraform supports declarative import in config:

```hcl
import {
  to = aws_s3_bucket.uploads
  id = "prasaarit-uploads-stg"
}

resource "aws_s3_bucket" "uploads" {
  bucket = "prasaarit-uploads-stg"
}
```

```bash
terraform plan    # Shows the import as part of the plan
terraform apply   # Performs the import and any needed changes
```

This is better because:
- The import is **in code** (reviewable in Git)
- It happens during normal `plan`/`apply` flow
- You can generate the config with `terraform plan -generate-config-out=generated.tf`

### For Your Prasaarit Project

You said you'll build fresh, so you won't need `import` now. But if you later want to bring the console-created S3 bucket under Terraform in your core infra repo, `import` is how you'd do it.

---

## Remote State — S3 + DynamoDB Locking

Local state (`terraform.tfstate` on disk) has problems:
1. **No locking** — two engineers can `apply` simultaneously and corrupt state
2. **Not shared** — your teammate can't see or work with the same state
3. **No versioning** — if you corrupt the state, you can't roll back
4. **Secrets in plaintext** — state is unencrypted on your laptop

### S3 Backend Configuration

```hcl
# main.tf — backend config
terraform {
  backend "s3" {
    bucket         = "prasaarit-terraform-state"
    key            = "upload-service/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "prasaarit-terraform-locks"
    encrypt        = true
  }
}
```

### What Each Setting Does

| Setting | Purpose | What Happens Without It |
|---------|---------|------------------------|
| `bucket` | S3 bucket where state is stored | State stays local |
| `key` | Path within the bucket | Allows multiple stacks in one bucket |
| `region` | Where the S3 bucket lives | Provider region is used (may differ) |
| `dynamodb_table` | Lock table for concurrent access | **No locking!** Two applies can run simultaneously |
| `encrypt` | Server-side encryption | State is stored in plaintext in S3 |

### DynamoDB Locking — How It Works

```
Engineer A: terraform apply
  → Writes a lock record to DynamoDB: { LockID: "upload-service/terraform.tfstate" }
  → Reads state from S3
  → Builds plan, applies changes
  → Writes new state to S3
  → Deletes the lock record from DynamoDB

Engineer B: terraform apply (while A is still running)
  → Tries to write lock record to DynamoDB
  → DynamoDB: "Lock already exists!"
  → Terraform: "Error: Error acquiring the state lock"
  → B must wait until A finishes.
```

DynamoDB uses a **conditional write** (`PutItem` with `attribute_not_exists`). This is an atomic operation — two simultaneous lock attempts cannot both succeed. The `serial` field in state provides an optimistic concurrency check on the state itself.

### The Chicken-and-Egg Problem

**Problem**: You need an S3 bucket and DynamoDB table to store your state — but those resources need to be created too. Who manages them?

**Solutions:**

```
Option A: Create them manually (AWS console or CLI)
  → Most common for bootstrapping.
  → Create the S3 bucket and DynamoDB table once by hand.
  → Then configure your backend to use them.

Option B: Separate bootstrap Terraform config with local state
  → A tiny Terraform project that ONLY creates the state bucket + lock table.
  → This project uses local state (it manages itself).
  → Your actual project then uses those resources as its backend.

Option C: Start local, migrate later
  → Start with local state.
  → When ready, create the S3 bucket + DynamoDB table.
  → Add the backend config to your .tf.
  → Run `terraform init -migrate-state` to move local state to S3.
```

**For your Prasaarit project**, Option C is the right call. Start local now. When you add CI/CD with GitHub Actions (Phase 3), migrate to S3 backend.

### Migrating Local State to Remote State

1. Create the S3 bucket and DynamoDB table manually or in a separate Terraform "bootstrap" stack.
2. Add the `backend "s3" {}` block.
3. Run `terraform init`.
4. Terraform asks: *"Do you want to copy existing state to the new backend?"* Say yes.

### How Terragrunt Solves the "Chicken and Egg" State Problem

In native Terraform, you must create the S3 bucket and DynamoDB table *before* you can use the S3 backend. This creates a chicken-and-egg problem: How do you provision the infrastructure that holds your infrastructure state?

**Terragrunt** solves this natively using the `remote_state` block in your root `terragrunt.hcl`:

```hcl
remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket         = "tf-creoate-states"
    key            = "business-services/core/${path_relative_to_include()}/terraform.tfstate"
    region         = "eu-west-2"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}
```

When you run `terragrunt init`, Terragrunt automatically checks if the S3 bucket and DynamoDB table exist. **If they don't, Terragrunt uses the AWS API to create them on the spot**, and *then* configures Terraform to use them. No manual bootstrapping required.

---

## State File Security — Secrets in State

**Critical**: The state file contains **sensitive values in plaintext**.

What ends up in state:
- RDS master passwords (if set via Terraform)
- API keys passed as environment variables
- KMS key IDs
- Private keys and certificates
- Any value marked as `sensitive` in your config — it's still in state, just hidden from `plan` output

```json
// In your state file, your Lambda environment variables are visible:
"environment": [{
  "variables": {
    "BUCKET_NAME": "prasaarit-uploads-stg",
    "API_SECRET": "sk_live_abc123..."     // ← plaintext in state!
  }
}]
```

### Protections

| Protection | How |
|-----------|-----|
| **Encrypt state at rest** | S3 backend with `encrypt = true` (AES-256 or KMS) |
| **Restrict state access** | S3 bucket policy limiting who can read the state |
| **Don't commit local state** | Add `*.tfstate` and `*.tfstate.backup` to `.gitignore` |
| **Use Secrets Manager** | Don't pass secrets as Lambda env vars via Terraform. Use AWS Secrets Manager and have Lambda read secrets at runtime. Terraform only stores the secret's ARN, not the value. |
| **`sensitive = true` on variables** | Hides the value from `plan`/`apply` output. Does NOT hide it from state. |

```hcl
# .gitignore — ALWAYS include these
*.tfstate
*.tfstate.*
.terraform/
```

---

## State Manipulation Commands

These are the "break glass" tools. You rarely need them, but when you do, misusing them can orphan or destroy resources.

### `terraform state list` — See What's in State

```bash
terraform state list
# aws_iam_role.lambda_exec
# aws_iam_role_policy.lambda_s3
# aws_lambda_function.presign
# aws_api_gateway_rest_api.api
# aws_api_gateway_resource.presign_route
# ...
```

### `terraform state show` — Inspect One Resource

```bash
terraform state show aws_lambda_function.presign
# Shows all attributes of that resource as Terraform knows them.
# Useful for debugging: "what does Terraform think this Lambda looks like?"
```

### `terraform state mv` — Rename a Resource in State

When you refactor your config (rename a resource or move it to a module), Terraform sees "old name deleted, new name created." `state mv` tells Terraform "it's the same resource, just with a new address."

```bash
# You renamed the resource in your .tf file:
#   resource "aws_lambda_function" "presign" → resource "aws_lambda_function" "generate_url"

terraform state mv aws_lambda_function.presign aws_lambda_function.generate_url
# Now Terraform knows they're the same resource. No destroy+create.
```

**Modern alternative**: `moved` block (Terraform 1.1+):

```hcl
moved {
  from = aws_lambda_function.presign
  to   = aws_lambda_function.generate_url
}
```

This is better because it's **in code** (reviewable, works in CI/CD, doesn't require manual CLI).

### `terraform state rm` — Remove from State (Without Destroying)

```bash
terraform state rm aws_lambda_function.presign
# Removes the Lambda from state. Terraform "forgets" it.
# The Lambda still exists in AWS — it's just unmanaged now.
# Next plan shows nothing about this Lambda (Terraform doesn't know it exists).
```

**When to use**: You want to stop managing a resource with Terraform without destroying it. For example, handing a resource to another team's Terraform project.

**Danger**: If you `state rm` and then run `apply`, Terraform will try to create a NEW resource with the same config — and fail with a conflict because the old one already exists in the cloud.

### `terraform taint` / `terraform untaint` (Deprecated)

These marked a resource for forced replacement on the next apply. Replaced by:

```bash
terraform apply -replace=aws_lambda_function.presign
```

This tells Terraform to destroy and recreate the Lambda on the next apply, even if the config hasn't changed. Use it when you know a resource is in a bad state and needs to be rebuilt.

---

## Grounding: State Commands for Your Prasaarit Project

Here's a real scenario you might hit:

```bash
# 1. You deployed everything via Terraform. All good.
# 2. You decide to rename your Lambda resource in the .tf file:
#    Before: resource "aws_lambda_function" "presign" { ... }
#    After:  resource "aws_lambda_function" "generate_presigned_url" { ... }
# 3. You run terraform plan:
#    - aws_lambda_function.presign will be DESTROYED
#    + aws_lambda_function.generate_presigned_url will be CREATED
#    This destroys your Lambda and creates a new one! New ARN, new logs,
#    API GW integration breaks temporarily.
# 4. Fix: Add a moved block FIRST, then rename:

moved {
  from = aws_lambda_function.presign
  to   = aws_lambda_function.generate_presigned_url
}

resource "aws_lambda_function" "generate_presigned_url" { ... }

# Now terraform plan shows:
#    aws_lambda_function.presign has moved to
#    aws_lambda_function.generate_presigned_url
#    No changes. Infrastructure is up-to-date.
```

---

## What Terraform Guarantees About State

| Guarantee | Details |
|-----------|---------|
| **Write-after-each-resource** | State is updated after each successful resource operation during `apply` (Chapter 01) |
| **Serial counter** | Every state write increments `serial`. Remote backends use this for conflict detection. |
| **Lineage check** | Terraform refuses to use a state file with a different `lineage` than expected — prevents cross-project state corruption |
| **Lock acquisition before modify** | With DynamoDB locking, state cannot be modified by two processes simultaneously |

## What Terraform Does NOT Guarantee About State

| Non-guarantee | Why it matters |
|--------------|----------------|
| **State ≠ reality** | State is a snapshot. Between applies, the cloud can change without Terraform's knowledge. |
| **No secret protection** | Sensitive values are stored plaintext in state. `sensitive = true` only hides them from output, not from the file. |
| **No automatic recovery** | If state is corrupted or deleted, Terraform cannot reconstruct it automatically. You must `import` each resource manually. |
| **No cross-stack awareness** | State for stack A knows nothing about stack B. If B depends on A's outputs via `terraform_remote_state`, A doesn't know and can break B by changing outputs. |

---

## Source References

- [Terraform State](https://developer.hashicorp.com/terraform/language/state) — official docs
- [State File Format (v4)](https://developer.hashicorp.com/terraform/internals/json-format) — JSON schema
- [Backend Configuration](https://developer.hashicorp.com/terraform/language/backend) — S3 and other backends
- [Import](https://developer.hashicorp.com/terraform/language/import) — import blocks (1.5+)
- [Moved Blocks](https://developer.hashicorp.com/terraform/language/modules/develop/refactoring) — refactoring without destroy
