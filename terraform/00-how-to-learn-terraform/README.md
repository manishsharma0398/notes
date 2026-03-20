# Chapter 00: How to Learn Terraform

The most important skill you can develop as a Cloud/DevOps/Platform Engineer is not memorizing Terraform syntax — it is understanding _how to find_ what you need.

The AWS Provider alone contains over 1,200 unique resources. No senior engineer memorises them. Instead, they master three tools: **the Terraform Registry**, **the AWS Console learning loop**, and **version pinning discipline**.

---

## Mental Model

> Terraform is a thin translation layer between your intent (HCL) and cloud API calls. Before you can translate, you must understand what you are translating _to_.

The correct learning order is:

```
AWS concept (what does this thing do?)
  → Console (what knobs exist for it?)
    → Registry (how do I spell those knobs in HCL?)
      → Terraform (automate it)
```

Skipping the first two steps is why engineers get confused by Terraform: the HCL is not magic, it mirrors the AWS API surface almost exactly.

---

## 1. The Terraform Registry

**First stop for every new resource:**
👉 [registry.terraform.io/providers/hashicorp/aws/latest/docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)

Every resource page has the same three-section structure:

### Part A — Example Usage

A minimal, copy-pasteable block. Use it to understand the shape of the resource. Do not blindly copy it to production.

### Part B — Argument Reference (Inputs)

Every configuration argument the resource accepts.

| Marker       | Meaning                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------ |
| `(Required)` | Must be provided. Missing one → `terraform plan` fails immediately with an explicit error. |
| `(Optional)` | Enables extra AWS features. If you saw a checkbox in the Console, it lives here.           |

> **Trap**: Some arguments are technically optional but their absence has a security implication (e.g., `block_public_acls = false` on an S3 bucket). Always read the description, not just the marker.

### Part C — Attribute Reference (Outputs)

What the resource _exports_ after creation — the ARN, ID, DNS name, etc. These are how you wire one resource into another:

```hcl
# The attribute reference for aws_s3_bucket tells you `.arn` exists.
# That is why this is valid:
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Resource = aws_s3_bucket.my_bucket.arn
  })
}
```

---

## 1.5. Registry Left-Pane Categories

On any provider page in the Registry, the left sidebar groups docs into four categories:

| Category | HCL keyword | Creates real infra? | Tracked in state? | You own it? |
|---|---|---|---|---|
| **Resources** | `resource` | ✅ Yes | ✅ Yes | ✅ Yes |
| **Data Sources** | `data` | ❌ No | Partially (cached) | ❌ No |
| **List Resources** | `data` | ❌ No | ❌ No | ❌ No |
| **Actions** | `action` | ❌ No | ❌ No | ❌ No |

### Resources
Create, manage, and destroy real infrastructure. Terraform *owns* the object — removing the block from config tells Terraform to destroy it.

### Data Sources
Read-only queries against existing infrastructure you do not own. Removing the `data` block does not touch the real resource. Use them to fetch values from:
- Infrastructure another team created
- AWS-managed values (current account ID, available AZs, latest AMI)
- Another Terraform root module's outputs via `terraform_remote_state`

### List Resources
Data sources that return a **collection** rather than a single object. Example:
```hcl
data "aws_availability_zones" "available" {
  state = "available"
}
# Returns ["us-east-1a", "us-east-1b", "us-east-1c"]
# Use: data.aws_availability_zones.available.names[count.index]
```

### Actions (Experimental)
Imperative, one-shot operations — things that are inherently not "desired state". Example: sending a test email via SES, triggering a pipeline. Actions run on every apply, produce no state entry, and cannot be drift-detected. They are the proper replacement for the `null_resource` + `local-exec` provisioner hack.

> **Lambda `invoke_arn` trap**: In the Resource Attribute Reference for `aws_lambda_function`, there are both `arn` and `invoke_arn`. API Gateway always needs `invoke_arn` — using the plain `arn` passes validation but causes a permissions error at runtime. Always check the Attribute Reference descriptions, not just the names.

---

## 2. The AWS Console → Terraform Learning Loop

When writing Terraform for a service you have never used before:

### Step 1 — ClickOps (Console)

Manually create the resource in the AWS Console. Pay attention to:

- What fields are _required_ before you can hit "Create"
- What checkboxes and dropdowns exist (these are `(Optional)` arguments)
- What the UI warns you about (naming rules, limits, consistency delays)

### Step 2 — Translation (Registry)

Open the Registry docs for the Terraform resource. You will find the AWS Console UI almost perfectly mirrored in the Argument Reference.

> **Pattern**: Console checkbox = optional boolean argument. Console dropdown = `string` enum argument.

### Step 3 — Automation (Terraform)

Write the HCL. Now you know _what_ to build and _how to spell_ it.

### Step 4 — Cleanup

Destroy the console resource. Let `terraform apply` own it. The resource now lives in version control.

---

## 3. Version Pinning (`required_version`)

Every Terraform root module should declare which Terraform CLI version it expects:

```hcl
terraform {
  required_version = "~> 1.9"        # accept 1.9.x, reject 1.10+

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"             # accept 5.x, reject 6.x
    }
  }
}
```

**Why this matters operationally:**

- A provider upgrade can change schema defaults, rename arguments, or start marking previously-ignored attributes as `ForceNew`. Without pinning, a `terraform init -upgrade` during a CI run can suddenly produce a destructive plan.
- Terraform itself introduces new plan behaviours across minor versions (e.g., ephemeral resources in 1.10, write-only attributes in 1.11). An unpinned version string means your plan/apply semantics can silently change with a CLI update.

### The `.terraform.lock.hcl` File

`terraform init` generates this file. It records the exact provider version and hash downloaded. **Commit it.** It ensures that every engineer and every CI runner uses bit-for-bit identical provider binaries.

```bash
# After changing version constraints, update the lock file:
terraform init -upgrade
git add .terraform.lock.hcl
git commit -m "chore: bump aws provider to 5.45"
```

> **Gotcha**: If you delete `.terraform.lock.hcl` and re-init, Terraform resolves the "latest matching" version again. This can silently pull a provider with breaking schema changes.

---

## 4. Reading Plan Output

Before writing any code, you must be able to read `terraform plan` output cold:

```
# aws_s3_bucket.example will be created
+ resource "aws_s3_bucket" "example" {
  + bucket = "my-logs-bucket"
  + id     = (known after apply)
  + arn    = (known after apply)
}
```

| Symbol                | Meaning                                             |
| --------------------- | --------------------------------------------------- |
| `+`                   | Will be **created**                                 |
| `-`                   | Will be **destroyed**                               |
| `~`                   | Will be **updated in-place**                        |
| `-/+`                 | Will be **destroyed and recreated** (replacement)   |
| `<=`                  | Data source will be **read**                        |
| `(known after apply)` | Value is not available until the cloud API responds |

The `-/+` symbol is the one to scrutinise. It means a `ForceNew` attribute changed. This is how you catch accidental database replacements in code review.

---

## Checkpoints

Before moving to Chapter 01, you should be able to:

- [ ] Open a Registry page and identify Required vs Optional arguments without the exercise feeling slow
- [ ] Explain the difference between an argument and an attribute reference
- [ ] Explain why `~> 5.0` and `>= 5.0` are different version constraints
- [ ] Read a `terraform plan` diff and explain what `-/+` means for a stateful resource (like RDS)
- [ ] Find `.terraform.lock.hcl` in a repo and explain why it should be committed
