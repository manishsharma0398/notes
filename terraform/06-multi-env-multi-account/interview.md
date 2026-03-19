# Chapter 06 — Multi-Environment and Multi-Account — Interview Questions

---

## Q1: "Why do you recommend directory-per-environment over workspaces? Isn't DRY better?"

### The Trap
Tests whether you can weigh DRY against operational safety.

### What a Senior Engineer Says

Workspaces optimize for DRY — one config, multiple states. But they sacrifice **blast radius isolation**:

1. **Wrong-workspace risk**: `terraform workspace select prod && terraform destroy` is one typo away. With directory-per-env, you'd need to `cd prod/` — a physical action that's harder to accidentally combine with a destructive command.

2. **Conditional config rot**: Real environments diverge. Prod needs CloudWatch alarms, WAF rules, larger instances, different IAM policies. With workspaces, every divergence becomes `count = terraform.workspace == "prod" ? 1 : 0`. After 20 such conditionals, the config is unreadable and untestable.

3. **No access separation**: Both workspaces use the same backend credentials. `terraform workspace select prod` doesn't require prod permissions — just workspace knowledge. With directory-per-env, each directory can use different backend credentials and provider `assume_role` configs.

4. **CI/CD clarity**: A pipeline job that runs `cd environments/stg && terraform apply` is self-documenting. A job that runs `terraform workspace select stg && terraform apply` requires understanding workspace mechanics.

The ~50 lines of duplication per environment is cheap insurance against production incidents. The module code (hundreds of lines) is still shared — only the thin root module config is duplicated.

---

## Q2: "Your upload-service's Terraform needs the S3 bucket ARN from the core-infra Terraform. How do you share it?"

### The Trap
Tests knowledge of cross-stack communication patterns and their trade-offs.

### What a Senior Engineer Says

Three options, in order of preference:

**Option 1: SSM Parameter Store (recommended)**

Core-infra publishes the bucket ARN to SSM:
```hcl
resource "aws_ssm_parameter" "bucket_arn" {
  name  = "/prasaarit/stg/upload-bucket-arn"
  value = aws_s3_bucket.uploads.arn
}
```

Upload-service reads it:
```hcl
data "aws_ssm_parameter" "bucket_arn" {
  name = "/prasaarit/stg/upload-bucket-arn"
}
```

Advantages: No state file access needed. Any tool (Terraform, scripts, Lambda) can read SSM. Explicit contract.

**Option 2: `terraform_remote_state`**
```hcl
data "terraform_remote_state" "core" {
  backend = "s3"
  config = { bucket = "...", key = "core/stg/tfstate" }
}
```

Disadvantages: Requires read access to core's state file (exposes ALL secrets). Output renames break consumers silently. Tight coupling between stacks.

**Option 3: Variable + manual coordination**
```hcl
variable "upload_bucket_arn" { type = string }
# terraform.tfvars: upload_bucket_arn = "arn:aws:s3:::prasaarit-uploads-stg"
```

Advantages: Zero coupling. Disadvantages: Manual sync — if core-infra changes the bucket, someone must remember to update the variable.

**For Prasaarit now**: Option 3 is fine (you're a solo developer). Move to Option 1 when you have multiple stacks or team members.

---

## Q3: "You write `backend 's3' { bucket = var.state_bucket }` and get an error. Why?"

### The Trap
Tests understanding of Terraform's initialization order.

### What a Senior Engineer Says

Backend blocks **cannot use variables, locals, or any expressions**. Only literal string values.

**Why**: The backend is configured during `terraform init` — before the config is fully parsed, before variables are resolved, before any expression evaluation happens. Terraform needs the backend information to **locate the state file**, and it needs the state to evaluate expressions. It's a chicken-and-egg: you need state before you can evaluate, but you need to evaluate to know where state is.

**The init → plan ordering:**
1. `terraform init` reads the backend block → connects to S3 → downloads state
2. `terraform plan` reads state → evaluates variables/locals/expressions → builds graph

Step 1 cannot wait for step 2, so backend values must be literal.

**Workarounds:**
- `-backend-config="bucket=my-bucket"` CLI flag (used in CI/CD scripts)
- `-backend-config=stg.backend.hcl` config file
- Hardcoding in each environment directory (simplest with directory-per-env)

---

## Q4: "Your CI/CD pipeline deploys to both staging and production. What's the security model for each?"

### The Trap
Tests understanding of assume-role, least-privilege, and environment isolation in CI/CD.

### What a Senior Engineer Says

**Staging:**
- CI/CD runner uses an IAM role with broad permissions (or OIDC federation with a stg-scoped role).
- Deploys automatically after PR merge. No manual approval gate.
- State is readable by the dev team (faster debugging).

**Production:**
- CI/CD runner's base role has NO direct access to prod resources.
- The pipeline **assumes a deployment role** in the production account via `sts:AssumeRole`.
- The deployment role has scoped permissions (only the specific resources this service manages).
- A **manual approval gate** is required between `plan` and `apply` (GitHub Environment protection rules).
- The plan output is published as a PR comment for review.
- State access is restricted (only the CI/CD service role can read/write).

```hcl
# environments/prod/main.tf
provider "aws" {
  assume_role {
    role_arn = "arn:aws:iam::PROD_ACCT:role/UploadServiceDeployRole"
  }
}
```

The deploy role's trust policy limits WHO can assume it:
```json
{
  "Effect": "Allow",
  "Principal": { "AWS": "arn:aws:iam::CICD_ACCT:role/GitHubActionsRole" },
  "Action": "sts:AssumeRole",
  "Condition": {
    "StringEquals": { "sts:ExternalId": "prasaarit-terraform" }
  }
}
```

Developer laptops **cannot** assume the prod deployment role. Only the CI/CD pipeline can.

---

## Q5: "Team A changes an output name in their Terraform module. Team B's Terraform references that output via `terraform_remote_state`. How does the failure manifest, and how do you prevent it?"

### The Trap
Tests understanding of the remote state contract fragility.

### What a Senior Engineer Says

**How it fails:**

Team A renames `output "upload_bucket_name"` to `output "bucket_name"`. Team B runs `terraform plan`:

```
Error: Unsupported attribute
  data.terraform_remote_state.core.outputs.upload_bucket_name
  This object does not have an attribute named "upload_bucket_name".
```

It's a **runtime error during plan** — not a compile-time error. There's no static analysis that catches this across separate Terraform stacks. Team B discovers the break only when they run `plan`, which could be days or weeks after Team A's change was applied.

**Prevention strategies:**

1. **Output stability policy**: Treat outputs like a public API. Renaming/removing an output is a breaking change. Add new outputs, deprecate old ones, remove only after consumers migrate.

2. **SSM Parameter Store**: Publish values to SSM instead of relying on state outputs. The parameter name (`/prasaarit/stg/upload-bucket-name`) becomes the contract — which is easier to search for and track across repos.

3. **CI/CD cross-validation**: Run `terraform plan` for downstream stacks as part of upstream stack's CI pipeline. If Team A's PR breaks Team B's plan, the CI pipeline catches it before merge.

4. **Documentation**: Document which outputs are consumed by which downstream stacks. A `CONSUMERS.md` in each module listing who depends on which outputs.

---

## Q6: "Why might a team choose Terragrunt over native Terraform Workspaces or Directory-per-Environment?"

### The Trap
Tests understanding of the severe limitations in native Terraform's DRYness, specifically around backend configuration.

### What a Senior Engineer Says

Native Terraform forces a trade-off: 
- With **Workspaces**, you get DRY code, but lose physical state isolation (one bad command applies to prod).
- With **Directory-per-Env**, you get physical isolation, but you must copy-paste the `backend.tf` and `main.tf` root module into every environment folder. 

Native Terraform does not allow variables inside the `backend "s3" {}` block. You cannot do `bucket = var.env_bucket`.

**Terragrunt solves this by acting as a pre-processor.** It allows you to use the Directory-per-Env structure (giving you perfect physical isolation) but eliminates the duplication. A single `terragrunt.hcl` file dynamically generates the `backend.tf` based on the folder path, and uses an `include` block to inherit global settings. It gives you 100% DRY code *with* 100% physically separated environments.

---

## Q7: "How does Terragrunt's `.terragrunt-cache` work, and why can it cause issues in CI/CD pipelines?"

### The Trap
Tests practical operational experience with Terragrunt under the hood.

### What a Senior Engineer Says

When you run `terragrunt apply`, Terragrunt doesn't run Terraform in your current directory. It reads your `terragrunt.hcl` `source` variable, downloads that module into a hidden `.terragrunt-cache/` directory, copies over your generated backend and inputs, and runs `terraform apply` *inside that cache folder*.

**In CI/CD, this causes two major issues:**
1. **Plan/Apply Disconnect**: If Job A runs `terragrunt plan -out=tfplan`, the plan is saved *inside* the `.terragrunt-cache` directory. If Job B runs `apply`, it will likely create a *new* `.terragrunt-cache` directory due to how pipelines provision runners, and it won't find the plan file. You must explicitly output the plan file to an absolute path outside the cache (e.g., `-out=$CI_PROJECT_DIR/tfplan`).
2. **Disk Space**: If you are using `terragrunt run --all`, Terragrunt creates a separate cache folder and downloads the AWS provider (~400MB) for *every single module*. A repository with 10 modules will consume 4GB of disk space just for provider binaries, vastly slowing down pipeline execution unless you configure a shared `plugin_cache_dir`.

---

## Q8: "You have a VPC module and a Database module. The Database needs the VPC ID. In native Terraform, you use `module.vpc.id`. How do you handle this in a Terragrunt repository where VPC and Database are separate root directories?"

### The Trap
Tests understanding of how Terragrunt handles dependencies between completely isolated root modules using `dependency` blocks.

### What a Senior Engineer Says

Because Terragrunt treats the VPC and the Database as entirely separate root modules (each with their own state file), you cannot use native Terraform intra-module references.

Instead, in the Database's `terragrunt.hcl`, you use a **`dependency` block**:

```hcl
dependency "vpc" {
  config_path = "../vpc"
}

inputs = {
  vpc_id = dependency.vpc.outputs.vpc_id
}
```

When Terragrunt runs, it parses this block, navigates to the `../vpc` directory, runs `terraform output` (or reads its remote state), extracts the `vpc_id`, and passes it as an input to the Database module. It also uses this information to build an execution graph so `terragrunt run --all apply` knows to deploy the VPC before the Database.
