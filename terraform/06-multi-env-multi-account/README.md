# Chapter 06 — Multi-Environment and Multi-Account

## Mental Model

Every real project runs in multiple environments. The question is not whether to separate them — it's **how**. Terraform offers two native approaches, a third via tooling, and an access-isolation layer via AWS Organizations. The core tension:

> **Code duplication vs blast radius.** Sharing code is DRY. But sharing state between environments means a bad apply in staging can corrupt production's state. The right architecture balances code reuse with state isolation.

```
           SHARED CODE              ISOLATED STATE
          ┌───────────┐        ┌──────────────────────┐
          │  modules/  │        │  stg/terraform.tfstate│
          │  (reused)  │───┐    │  (only staging)       │
          └───────────┘   │    └──────────────────────┘
                          │    ┌──────────────────────┐
                          └───►│  prod/terraform.tfstate│
                               │  (only production)    │
                               └──────────────────────┘
```

---

## Approach 1 — Terraform Workspaces

Workspaces maintain **multiple state files** for the **same configuration directory**. One codebase, environment differences expressed through a config map.

```bash
terraform workspace new stg
terraform workspace new prod
terraform workspace list
# * default
#   stg
#   prod

terraform workspace select stg && terraform apply   # uses stg state
terraform workspace select prod && terraform apply  # uses prod state
```

### How State Is Stored

Local backend:

```
terraform.tfstate.d/
├── stg/terraform.tfstate
└── prod/terraform.tfstate
```

S3 backend (workspace auto-prefixes the key):

```
s3://prasaarit-terraform-state/
├── env:/stg/upload-service/terraform.tfstate
└── env:/prod/upload-service/terraform.tfstate
```

Configure the backend with the base key only — Terraform adds the `env:/workspace/` prefix automatically.

### The `default` Workspace — A Hidden Risk

Terraform always starts in the `default` workspace. If someone on the team runs `terraform apply` without explicitly selecting a workspace, they hit `default` — a completely separate state from `stg` and `prod`. Resources created in `default` are orphaned from your pipeline and untracked.

**Guard against this:**

```hcl
locals {
  # Fail fast if someone applies in the wrong workspace
  _workspace_guard = (
    contains(["stg", "prod"], terraform.workspace)
    ? null
    : tobool("ERROR: Invalid workspace '${terraform.workspace}'. Use 'stg' or 'prod'.")
  )
}
```

Or in CI/CD: always call `terraform workspace select stg` before any plan/apply. Never let the pipeline run in `default`.

### The `env_config` Map Pattern — Centralize All Per-Environment Differences

Instead of scattering `terraform.workspace == "prod"` ternaries throughout your config, centralize all per-environment values into one map:

```hcl
locals {
  env_config = {
    stg = {
      timeout         = 10
      memory          = 128
      allowed_origins = ["*"]
      s3_bucket       = "prasaarit-uploads-stg"
      log_retention   = 7
    }
    prod = {
      timeout         = 30
      memory          = 256
      allowed_origins = ["https://prasaarit.com"]
      s3_bucket       = "prasaarit-uploads-prod"
      log_retention   = 90
    }
  }

  config = local.env_config[terraform.workspace]   # always the current env's values
  prefix = "${var.project_name}-${terraform.workspace}"

  common_tags = {
    Project   = var.project_name
    Stage     = terraform.workspace
    ManagedBy = "terraform"
  }
}
```

Resources are clean — no inline conditionals:

```hcl
resource "aws_lambda_function" "presign" {
  function_name = "${local.prefix}-presign"
  timeout       = local.config.timeout
  memory_size   = local.config.memory

  environment {
    variables = {
      BUCKET_NAME    = local.config.s3_bucket
      ALLOWED_ORIGIN = join(",", local.config.allowed_origins)
    }
  }
}
```

All environment differences live in one table. The rest of the config is workspace-agnostic.

### When Workspaces Work Well

| Scenario | Why |
|---|---|
| Same account, same region, similar resources | One config covers both envs with just the `env_config` map |
| CI/CD always selects the workspace | Eliminates human workspace-selection error |
| < 50 resources, low env divergence | Config stays manageable |

### Workspace Limitations

| Limitation | Impact |
|---|---|
| **Wrong-workspace risk** | One `workspace select prod` + `apply` mistake can destroy production. Mitigate: CI/CD enforces selection; never apply locally to prod. |
| **No access isolation** | Both workspaces share the same backend credentials. To truly prevent stg engineers from accessing prod, use multi-account. |
| **Config divergence** | If prod needs resources that stg doesn't (WAF, CloudWatch alarms), you accumulate `count = workspace == "prod" ? 1 : 0` conditionals. After ~10 of these, switch to directory-per-env. |

---

## Approach 2 — Directory-Per-Environment

Each environment gets its own root module directory with its own backend, provider config, and tfvars:

```
prasaarit-upload-service/
├── modules/
│   ├── lambda_function/
│   └── api_route/
└── environments/
    ├── stg/
    │   ├── backend.tf      # stg state location
    │   ├── main.tf         # module calls with stg values
    │   ├── variables.tf
    │   └── terraform.tfvars
    └── prod/
        ├── backend.tf      # prod state location
        ├── main.tf         # module calls with prod values
        ├── variables.tf
        └── terraform.tfvars
```

```hcl
# ─── environments/stg/backend.tf ─────────────────────────────────
terraform {
  backend "s3" {
    bucket         = "prasaarit-terraform-state"
    key            = "upload-service/stg/terraform.tfstate"
    region         = "ap-south-1"
    use_lockfile   = true   # native locking (v1.11+)
    encrypt        = true
  }
}
```

```hcl
# ─── environments/prod/backend.tf ────────────────────────────────
terraform {
  backend "s3" {
    bucket         = "prasaarit-terraform-state"
    key            = "upload-service/prod/terraform.tfstate"
    region         = "ap-south-1"
    use_lockfile   = true
    encrypt        = true
  }
}

# ─── environments/prod/main.tf ────────────────────────────────────
provider "aws" {
  region = "ap-south-1"
  assume_role {
    role_arn     = "arn:aws:iam::PROD_ACCOUNT_ID:role/TerraformDeployRole"
    session_name = "terraform-prod-deploy"
  }
}

module "presign_lambda" {
  source              = "../../modules/lambda_function"
  function_name       = "prasaarit-prod-presign"
  lambda_role_arn     = aws_iam_role.lambda_exec.arn
  source_path         = "${path.root}/../../lambda.zip"
  timeout             = 30
  memory_size         = 256
  environment_variables = { BUCKET_NAME = "prasaarit-uploads-prod" }
}
```

**Benefits:**
- Physical isolation: you `cd environments/stg`. You cannot accidentally apply to prod from the stg directory.
- Each directory has a separately configured provider — prod uses `assume_role`, stg uses your local creds.
- Per-env `terraform.tfvars` — no conditionals, no shared config map.
- CI/CD maps directly: one job does `cd environments/stg && terraform apply`.
- Prod can have resources stg doesn't — add them to `environments/prod/main.tf` explicitly, no `count` toggles.

**The cost**: ~50 lines of root module config per environment (module calls + values). This is intentional duplication. The module code (hundreds of lines) is still shared.

### Workspace vs Directory-Per-Env — When to Use Which

| | Workspaces | Directory-per-env |
|---|---|---|
| Code duplication | None | ~50 lines per env (root module only) |
| State isolation | Yes (separate files) | Yes (separate files + directories) |
| Access isolation | No — shared credentials | Yes — each dir can use different `assume_role` |
| Config divergence | Ternaries accumulate | Explicit, different files |
| `default` workspace risk | Yes | Not applicable |
| Best for | Single account, low env divergence, CI/CD-enforced | Team scale, multi-account, significant env divergence |

**For your Prasaarit project**: Start with workspaces (single account, nearly identical envs). Migrate to directory-per-env when you add multi-account or when prod-only resources accumulate.

---

## Multi-Account with AWS Organizations

At team scale, each environment runs in a **separate AWS account**. This is the gold standard for blast radius isolation:

```
AWS Organization
├── Management Account      ← billing, org-level controls
├── Shared Services Account ← Terraform state bucket, CI/CD runner
├── Dev Account             ← dev environment
├── Staging Account         ← staging
└── Production Account      ← production
```

### The `assume_role` Pattern

The CI/CD runner (in Shared Services) assumes a role in the target account:

```hcl
provider "aws" {
  region = "ap-south-1"

  assume_role {
    role_arn     = "arn:aws:iam::PROD_ACCOUNT_ID:role/TerraformDeployRole"
    session_name = "terraform-prod-deploy"
    external_id  = "prasaarit-terraform"   # prevents confused deputy attack
  }
}
```

**How it works internally:**

1. Terraform calls `sts:AssumeRole` as the CI/CD runner's identity
2. AWS STS validates: does the caller's identity have permission to assume this role? Does the target role's trust policy allow this caller?
3. STS returns temporary credentials (access key, secret key, session token) — valid for 1 hour by default
4. The AWS provider uses these credentials for all subsequent API calls (Lambda, IAM, API GW, etc.)

```
┌──────────────────┐   sts:AssumeRole   ┌────────────────────┐
│ Shared Services  │ ─────────────────► │ Prod Account       │
│ (CI/CD runner)   │ ◄───────────────── │ TerraformDeploy    │
│                  │   temp credentials │ Role               │
└──────────────────┘                    └────────────────────┘
         │
         │ uses temp creds for all AWS API calls
         ▼
   lambda:CreateFunction, iam:PutRolePolicy, etc.
```

**The trust policy** on `TerraformDeployRole` in the prod account restricts who can assume it:

```json
{
  "Effect": "Allow",
  "Principal": { "AWS": "arn:aws:iam::SHARED_ACCT:role/GitHubActionsRole" },
  "Action": "sts:AssumeRole",
  "Condition": {
    "StringEquals": { "sts:ExternalId": "prasaarit-terraform" }
  }
}
```

Developer laptops cannot assume this role — only the CI/CD pipeline can. This is the access isolation workspaces can't provide.

### Provider Aliases for Cross-Account Resources

When a single config needs to touch multiple accounts:

```hcl
provider "aws" { region = "ap-south-1" }          # default — stg account

provider "aws" {
  alias  = "shared"
  region = "ap-south-1"
  assume_role { role_arn = "arn:aws:iam::SHARED_ACCT:role/TerraformRole" }
}

resource "aws_s3_bucket" "state" {
  provider = aws.shared   # ← lands in shared services account
  bucket   = "prasaarit-terraform-state"
}

resource "aws_lambda_function" "presign" {
  # No provider = ... → uses default → lands in stg account
}
```

---

## Backend Block Limitation — No Variables Allowed

```hcl
# THIS DOES NOT WORK:
terraform {
  backend "s3" {
    bucket = var.state_bucket          # ERROR: variables not allowed
    key    = "${var.project}/tfstate"  # ERROR: interpolation not allowed
  }
}
```

**Why**: the backend is configured during `terraform init` — before variables are parsed, before expressions are evaluated. Terraform needs the backend to locate state, and needs state before it can evaluate expressions. Chicken-and-egg.

**The init → plan order:**
```
terraform init  → reads backend block (literals only) → connects to S3
terraform plan  → loads state → evaluates var.x, local.y → builds graph
```

### Workarounds

**Option A: `-backend-config` CLI flags** (cleanest for CI/CD scripts)

```bash
terraform init \
  -backend-config="bucket=prasaarit-terraform-state" \
  -backend-config="key=upload-service/stg/terraform.tfstate" \
  -backend-config="region=ap-south-1"
```

**Option B: Partial backend config file** (cleanest for directory-per-env)

```hcl
# environments/stg/backend.hcl
bucket       = "prasaarit-terraform-state"
key          = "upload-service/stg/terraform.tfstate"
region       = "ap-south-1"
use_lockfile = true
```

```bash
terraform init -backend-config=backend.hcl
```

**Option C: Hardcode directly in each directory** (simplest, works with directory-per-env):

The 6-line backend block is duplicated across each environment directory. This "duplication" buys you a simple, readable, diff-able backend config per environment. It is not worth abstracting.

---

## Cross-Stack Dependencies

When infrastructure is split across stacks (core-infra creates the S3 bucket; upload-service needs its ARN):

### Option A: SSM Parameter Store (Recommended)

```hcl
# Core-infra stack: publish to SSM
resource "aws_ssm_parameter" "bucket_arn" {
  name  = "/prasaarit/stg/upload-bucket-arn"
  value = aws_s3_bucket.uploads.arn
  type  = "String"
}

# Upload-service stack: read from SSM
data "aws_ssm_parameter" "bucket_arn" {
  name = "/prasaarit/stg/upload-bucket-arn"
}

locals { upload_bucket_arn = data.aws_ssm_parameter.bucket_arn.value }
```

Advantages: no state file access needed; any tool can read SSM; the parameter path is an explicit, searchable contract; secrets can use `SecureString` type.

### Option B: `terraform_remote_state` (Tightly Coupled — Use with Caution)

```hcl
data "terraform_remote_state" "core" {
  backend = "s3"
  config = {
    bucket = "prasaarit-terraform-state"
    key    = "core-infra/stg/terraform.tfstate"
    region = "ap-south-1"
  }
}

locals { upload_bucket_arn = data.terraform_remote_state.core.outputs.upload_bucket_arn }
```

Risks: requires read access to core's entire state file (exposes all secrets). If core renames or removes the output, upload-service's plan fails at runtime — no compile-time check. Treat outputs depended on by other stacks as a public API: never rename or remove them without coordinating downstream consumers.

### Option C: Variable + Manual Coordination (Simple Solo Projects)

```hcl
variable "upload_bucket_arn" { type = string }
# terraform.tfvars: upload_bucket_arn = "arn:aws:s3:::prasaarit-uploads-stg"
```

Zero coupling. Manual sync required when the upstream value changes. Fine for solo projects or early-stage teams.

---

## Your Prasaarit Project — Workspace Approach Configuration

```hcl
# ─── infra/backend.tf
terraform {
  backend "s3" {
    bucket       = "prasaarit-terraform-state"
    key          = "upload-service/terraform.tfstate"  # workspace auto-prefixes
    region       = "ap-south-1"
    use_lockfile = true
    encrypt      = true
  }
}
# Resulting paths:
#   env:/stg/upload-service/terraform.tfstate
#   env:/prod/upload-service/terraform.tfstate
```

```hcl
# ─── infra/locals.tf
locals {
  env_config = {
    stg = {
      timeout         = 10
      memory          = 128
      allowed_origins = ["*"]
      s3_bucket       = "prasaarit-uploads-stg"
    }
    prod = {
      timeout         = 30
      memory          = 256
      allowed_origins = ["https://prasaarit.com"]
      s3_bucket       = "prasaarit-uploads-prod"
    }
  }

  config = local.env_config[terraform.workspace]
  prefix = "${var.project_name}-${terraform.workspace}"
  common_tags = {
    Project   = var.project_name
    Stage     = terraform.workspace
    ManagedBy = "terraform"
  }
}
```

**Deploy workflow:**

```bash
# Staging
cd infra
terraform workspace select stg
terraform plan  -out=stg.tfplan
terraform apply stg.tfplan

# Production
terraform workspace select prod
terraform plan  -out=prod.tfplan
# Review plan carefully...
terraform apply prod.tfplan
```

---

## Guarantees and Failure Modes

### What the Workspace Approach Guarantees

| Guarantee | Detail |
|---|---|
| State isolation | Each workspace has its own state file. Impossible to corrupt prod state from the stg workspace. |
| DRY code | One config. All env differences in the `env_config` map. |
| CI/CD-enforced safety | Pipeline always selects the correct workspace. |

### What the Workspace Approach Does NOT Guarantee

| Non-guarantee | Why it matters |
|---|---|
| Access isolation | Both workspaces share backend credentials. An engineer with stg credentials can `workspace select prod`. Multi-account + assume_role is required for strict separation. |
| Config divergence safety | As prod-only resources accumulate (WAF, alarms), `count` conditionals grow. Switch to directory-per-env when this becomes unmanageable. |
| Cross-stack output stability | `terraform_remote_state` output breaks are only detected at plan time, not at commit time. |

---

## Source References

- [Workspaces](https://developer.hashicorp.com/terraform/language/state/workspaces) — official docs
- [Backend Configuration](https://developer.hashicorp.com/terraform/language/backend) — backend block and `-backend-config` flag
- [terraform_remote_state](https://developer.hashicorp.com/terraform/language/state/remote-state-data) — cross-stack data source
- [AWS Provider assume_role](https://registry.terraform.io/providers/hashicorp/aws/latest/docs#assume-role) — multi-account pattern
- [AWS Organizations](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_accounts.html) — multi-account structure
