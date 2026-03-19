# Chapter 06 — Multi-Environment and Multi-Account

## Mental Model

Every real project runs in multiple environments: dev, staging, production. The question is not _whether_ to separate them — it's **how**. Terraform offers two approaches, and choosing wrong causes real operational pain.

The core tension:

> **Code duplication vs blast radius.** Sharing code between environments is DRY. But sharing _state_ between environments means a bad `apply` in staging can corrupt production's state. The right architecture balances code reuse with state isolation.

```
             SHARED CODE                    ISOLATED STATE
           ┌───────────┐              ┌──────────────────────┐
           │  modules/  │              │  stg/terraform.tfstate│
           │  (reused)  │──────┐       │  (only staging)       │
           └───────────┘      │       └──────────────────────┘
                              │
                              │       ┌──────────────────────┐
                              └──────►│  prod/terraform.tfstate│
                                      │  (only production)    │
                                      └──────────────────────┘
```

---

## Approach 1: Terraform Workspaces (Your Prasaarit Approach)

Workspaces let you maintain **multiple state files** for the **same configuration**. This is the DRY approach — one codebase, environment differences expressed through a config map.

```bash
terraform workspace new stg
terraform workspace new prod
terraform workspace list
# * default
#   stg
#   prod

terraform workspace select stg
terraform apply              # uses stg state

terraform workspace select prod
terraform apply              # uses prod state — same config, different state
```

### How Workspaces Work Internally

Each workspace gets its own state file. With a local backend:

```
terraform.tfstate.d/
├── stg/
│   └── terraform.tfstate
└── prod/
    └── terraform.tfstate
```

With an S3 backend:

```
s3://prasaarit-terraform-state/
├── env:/stg/upload-service/terraform.tfstate
└── env:/prod/upload-service/terraform.tfstate
```

### The `env_config` Map Pattern — Clean Per-Environment Values

Instead of scattering `terraform.workspace == "prod"` ternaries throughout your config, centralize all per-environment differences into one map:

```hcl
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
}
```

Now your resources are clean — no conditionals:

```hcl
resource "aws_lambda_function" "presign" {
  function_name = "${local.prefix}-presign"
  timeout       = local.config.timeout         # ← reads from the map
  memory_size   = local.config.memory
  # ...

  environment {
    variables = {
      BUCKET_NAME    = local.config.s3_bucket
      ALLOWED_ORIGIN = join(",", local.config.allowed_origins)
    }
  }
}
```

All environment differences live in one place. The rest of the config is workspace-agnostic.

### When Workspaces Work Well

| Scenario | Why it works |
|----------|------------|
| **CI/CD enforces workspace selection** | Pipeline jobs always `terraform workspace select stg` — no human error risk |
| **Environments are nearly identical** | Same config, differences captured in `env_config` map |
| **Same account, same region** | Your Prasaarit setup — single account, single region |
| **Small-to-medium infra** | < 50 resources, manageable config size |

### Known Limitations of Workspaces

| Limitation | Mitigation |
|---------|-------------|
| **Wrong-workspace risk on local CLI** | Mitigated by CI/CD enforcement. For local runs, always check `terraform workspace show` before applying. |
| **Config divergence** | Keep it contained in the `env_config` map. If prod-only resources grow beyond a few `count` toggles, consider splitting. |
| **Shared backend credentials** | Both workspaces share backend access. For strict access isolation, multi-account with separate backends is needed. |
| **Per-environment tfvars** | Use workspace-keyed `.tfvars` files: `terraform apply -var-file="${terraform.workspace}.tfvars"` or use the `env_config` map. |

---

## Approach 2: Directory-Per-Environment (Alternative for Large Teams)

Each environment gets its **own directory** with its own backend config, variables, and state:

```
prasaarit-upload-service/
├── modules/                          # shared module code
│   └── lambda_function/
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
├── environments/
│   ├── stg/                          # staging root module
│   │   ├── main.tf                   # calls modules, stg-specific config
│   │   ├── variables.tf
│   │   ├── terraform.tfvars          # stg values
│   │   └── backend.tf                # stg state location
│   └── prod/                         # production root module
│       ├── main.tf                   # calls modules, prod-specific config
│       ├── variables.tf
│       ├── terraform.tfvars          # prod values
│       └── backend.tf                # prod state location
└── src/
```

### How It Works

Each environment is a **separate root module** that calls shared modules:

```hcl
# ─── environments/stg/backend.tf ──────────────────────────────

terraform {
  backend "s3" {
    bucket         = "prasaarit-terraform-state"
    key            = "upload-service/stg/terraform.tfstate"  # ← unique per env
    region         = "ap-south-1"
    dynamodb_table = "prasaarit-terraform-locks"
    encrypt        = true
  }
}
```

```hcl
# ─── environments/stg/main.tf ─────────────────────────────────

provider "aws" {
  region = "ap-south-1"
  # In stg, use default credentials (your personal AWS profile)
}

module "presign_lambda" {
  source = "../../modules/lambda_function"

  function_name = "prasaarit-stg-presign"
  role_arn      = aws_iam_role.lambda_exec.arn
  source_path   = "${path.root}/../../lambda_payload.zip"
  timeout       = 10       # ← stg-specific
  memory_size   = 128      # ← stg-specific

  environment_variables = {
    BUCKET_NAME = "prasaarit-uploads-stg"
  }
}
```

```hcl
# ─── environments/prod/main.tf ────────────────────────────────

provider "aws" {
  region = "ap-south-1"

  # In prod, assume a deployment role (least privilege)
  assume_role {
    role_arn = "arn:aws:iam::PROD_ACCOUNT_ID:role/TerraformDeployRole"
  }
}

module "presign_lambda" {
  source = "../../modules/lambda_function"

  function_name = "prasaarit-prod-presign"
  role_arn      = aws_iam_role.lambda_exec.arn
  source_path   = "${path.root}/../../lambda_payload.zip"
  timeout       = 30       # ← prod-specific
  memory_size   = 256      # ← prod-specific

  environment_variables = {
    BUCKET_NAME = "prasaarit-uploads-prod"
  }
}
```

### Why This Is Better

| Benefit | How |
|---------|-----|
| **Physical isolation** | You `cd environments/stg` and run `terraform apply`. You cannot accidentally apply to prod from the stg directory. |
| **Different backend configs** | Each env has its own state file, lock table, and (optionally) backend credentials. |
| **Different provider configs** | Prod can use `assume_role` to a production AWS account. Stg uses your personal creds. |
| **Per-env variables** | Each directory has its own `terraform.tfvars`. No conditionals needed. |
| **Config divergence is explicit** | Prod has a WAF? Add it to `environments/prod/main.tf`. No `count = workspace == "prod"` conditionals. |
| **CI/CD is simple** | Pipeline runs `cd environments/stg && terraform apply` for stg. Separate job for prod. Clear pipeline structure. |

### The Cost: Some Duplication

The `main.tf` in each environment will have similar structure — calling the same modules with different inputs. This is **intentional duplication**. The module code is shared; only the root module config (which is small) is duplicated.

```
environments/stg/main.tf  →  ~50 lines (module calls + stg values)
environments/prod/main.tf →  ~50 lines (module calls + prod values)
modules/lambda_function/  →  ~100 lines (shared, written once)
```

The 50 lines of duplication buy you complete state isolation and zero risk of cross-environment contamination.

---

## Approach 3: Terragrunt (The "Best of Both Worlds" Approach)

Terragrunt is a third-party wrapper around Terraform (created by Gruntwork). It takes the **Directory-per-Environment** approach but completely eliminates the 50 lines of duplication mentioned above.

Instead of writing `.tf` files in your environment folders, you write a single `terragrunt.hcl` file that points to your actual Terraform code.

### The Terragrunt Folder Structure

```
iac/
├── terragrunt.hcl              # Global settings (backend, shared inputs)
├── resources/                  # The ACTUAL Terraform code (*.tf)
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── dev/                        # Dev environment
│   └── terragrunt.hcl          # Points to ../resources, provides dev inputs
├── stg/                        # Staging environment
│   └── terragrunt.hcl          # Points to ../resources, provides stg inputs
└── prd/                        # Prod environment
    └── terragrunt.hcl          # Points to ../resources, provides prd inputs
```

### How It Works (The Magic)

1. **Global Configuration (`iac/terragrunt.hcl`)**: 
   You write a `generate "backend"` block here. Terragrunt will automatically generate the `backend.tf` for every environment, dynamically setting the S3 `key` based on the folder path (e.g., `key = "upload-service/stg/terraform.tfstate"`). You also define `inputs = { ... }` for variables shared across all environments (like the AWS account ID).

2. **Environment Configuration (`iac/dev/terragrunt.hcl`)**:
   Inside the `dev` folder, the `terragrunt.hcl` file does three things:
   - `include "root"`: Inherits all the global settings from the parent directory.
   - `terraform { source = "..//resources" }`: Tells Terragrunt where the actual `.tf` code lives.
   - `inputs = { ... }`: Defines the variables specific to this environment (e.g., `timeout = 10`, `bucket_name = "dev-bucket"`).

3. **Execution**:
   You `cd iac/dev/` and run `terragrunt plan`.
   Behind the scenes, Terragrunt:
   - Copies the `.tf` files from `iac/resources/` into a temporary hidden folder (`.terragrunt-cache/`).
   - Generates the `backend.tf` file.
   - Converts your `inputs` into a dynamically generated `terraform.tfvars` file.
   - Finally, executes `terraform plan` inside that temporary folder.

### Why Terragrunt is popular for Enterprise

| Benefit | How |
|---------|-----|
| **100% DRY** | Environment folders have exactly one file (`terragrunt.hcl`) containing only the variables. Zero duplication of `main.tf` or `backend.tf`. |
| **Physical state isolation** | Just like directory-per-env, `stg` and `prod` are separate directories. You cannot accidentally `apply` prod from the `stg` folder. |
| **Dynamic Backends** | Native Terraform doesn't let you use variables in `backend "s3"`. Terragrunt lets you dynamically generate the backend configuration. |

**Summary**: Terragrunt provides the **DRYness of Workspaces** combined with the **Safety and physical isolation of Directory-per-Environment**.

---

## Multi-Account with AWS Organizations

At scale, each environment runs in a **separate AWS account**:

```
AWS Organization
├── Management Account (root)        ← org-level config, billing
├── Shared Services Account          ← Terraform state bucket, CI/CD
├── Dev Account                      ← dev environment
├── Staging Account                  ← staging environment
└── Production Account               ← production environment
```

### Assume Role Pattern

Your CI/CD pipeline or local developer runs in one account (e.g., Shared Services) and **assumes a role** in the target account:

```hcl
# environments/prod/main.tf

provider "aws" {
  region = "ap-south-1"

  assume_role {
    role_arn     = "arn:aws:iam::PROD_ACCOUNT_ID:role/TerraformDeployRole"
    session_name = "terraform-prod-deploy"
    external_id  = "prasaarit-terraform"   # optional but recommended
  }
}
```

**How `assume_role` works internally:**

1. Terraform (running as the CI/CD user or your local IAM identity) calls `sts:AssumeRole`
2. AWS STS validates:
   - Does the calling identity have permission to assume this role?
   - Does the target role's trust policy allow this identity?
   - Is the `external_id` correct (if required)?
3. STS returns temporary credentials (access key, secret key, session token)
4. The AWS provider uses these temporary credentials for all subsequent API calls
5. Temporary credentials expire (default: 1 hour)

```
┌──────────────────┐    sts:AssumeRole    ┌──────────────────┐
│ Shared Services  │ ─────────────────►   │ Prod Account     │
│ Account          │                      │                  │
│ (CI/CD runner)   │  ◄─────────────────  │ TerraformDeploy  │
│                  │  temp credentials    │ Role             │
└──────────────────┘                      └──────────────────┘
       │
       │ uses temp creds
       ▼
  AWS API calls in prod account
  (lambda:CreateFunction, etc.)
```

### Provider Aliases for Multi-Account Resources

Sometimes one config needs to manage resources in multiple accounts:

```hcl
# Default provider — stg account
provider "aws" {
  region = "ap-south-1"
}

# Aliased provider — shared services account (for state bucket, etc.)
provider "aws" {
  alias  = "shared"
  region = "ap-south-1"

  assume_role {
    role_arn = "arn:aws:iam::SHARED_ACCOUNT_ID:role/TerraformRole"
  }
}

# Use the alias on specific resources
resource "aws_s3_bucket" "state" {
  provider = aws.shared
  bucket   = "prasaarit-terraform-state"
}

# Resources without `provider` use the default (stg account)
resource "aws_lambda_function" "presign" {
  function_name = "prasaarit-stg-presign"
  # ...
}
```

### For Your Prasaarit Project Now

You're using a single AWS account with workspaces. Multi-account `assume_role` can be layered on later by adding workspace-keyed role ARNs to your `env_config` map:

```hcl
locals {
  env_config = {
    stg = {
      # ... other values ...
      assume_role_arn = null    # use default credentials
    }
    prod = {
      # ... other values ...
      assume_role_arn = "arn:aws:iam::PROD_ACCOUNT:role/TerraformDeployRole"
    }
  }
}
```

When you grow to multi-account, add `assume_role` to the provider with a dynamic block — no structural change needed.

---

## Remote State Data Sources — Cross-Stack Dependencies

When infrastructure is split across multiple Terraform stacks (e.g., core-infra repo vs upload-service repo), one stack may need outputs from another.

```hcl
# ─── In your core-infra repo (outputs the S3 bucket) ──────────

output "upload_bucket_name" {
  value = aws_s3_bucket.uploads.bucket
}

output "upload_bucket_arn" {
  value = aws_s3_bucket.uploads.arn
}
```

```hcl
# ─── In your upload-service repo (reads those outputs) ─────────

data "terraform_remote_state" "core" {
  backend = "s3"

  config = {
    bucket = "prasaarit-terraform-state"
    key    = "core-infra/stg/terraform.tfstate"
    region = "ap-south-1"
  }
}

# Use the outputs:
resource "aws_iam_role_policy" "lambda_s3" {
  policy = jsonencode({
    Statement = [{
      Effect   = "Allow"
      Action   = "s3:PutObject"
      Resource = "${data.terraform_remote_state.core.outputs.upload_bucket_arn}/*"
    }]
  })
}
```

### What Can Go Wrong

| Problem | What happens |
|---------|-------------|
| **Team A renames an output** | Team B's plan fails: `output "upload_bucket_name" is not defined`. No compile-time check across stacks. |
| **Team A removes an output** | Same — breaks downstream consumers with a runtime error on plan. |
| **State file access** | Team B needs read access to Team A's state file in S3. This leaks all of Team A's state (including secrets). |
| **Circular dependencies** | Stack A outputs feed into Stack B, and Stack B outputs feed into Stack A. `terraform_remote_state` doesn't prevent cycles. |
| **Refresh timing** | `terraform_remote_state` reads the state as it was at the time of plan. If Team A applies between your plan and apply, you get stale data. |

### Alternative: SSM Parameter Store or Terraform Cloud Outputs

Instead of cross-referencing state files directly, publish values to a shared registry:

```hcl
# Core infra: publish to SSM
resource "aws_ssm_parameter" "upload_bucket" {
  name  = "/prasaarit/stg/upload-bucket-name"
  value = aws_s3_bucket.uploads.bucket
  type  = "String"
}

# Upload service: read from SSM
data "aws_ssm_parameter" "upload_bucket" {
  name = "/prasaarit/stg/upload-bucket-name"
}

locals {
  upload_bucket = data.aws_ssm_parameter.upload_bucket.value
}
```

**Advantages**: No direct state file access needed. Parameters are an explicit contract. Any tool (not just Terraform) can read them.

---

## Backend Config Limitations

The `backend` block has a critical limitation that surprises everyone:

### You CANNOT Use Variables or Locals in Backend Config

```hcl
# THIS DOES NOT WORK:
terraform {
  backend "s3" {
    bucket = var.state_bucket       # ← ERROR: Variables not allowed
    key    = "${var.project}/tfstate" # ← ERROR: Interpolation not allowed
    region = local.region            # ← ERROR: Locals not allowed
  }
}
```

**Why**: The backend is initialized during `terraform init`, BEFORE the config is fully evaluated. Variables and locals require expression evaluation, which happens during plan — after the backend is already configured.

**The order is:**
1. `init` → read backend block (literal values only) → connect to state
2. `plan` → load state → evaluate variables and locals → build graph

### Workarounds

**Option 1: `-backend-config` flag (most common)**

```hcl
# backend.tf — partial config
terraform {
  backend "s3" {
    encrypt = true
  }
}
```

```bash
# Pass the rest via CLI flags
terraform init \
  -backend-config="bucket=prasaarit-terraform-state" \
  -backend-config="key=upload-service/stg/terraform.tfstate" \
  -backend-config="region=ap-south-1" \
  -backend-config="dynamodb_table=prasaarit-terraform-locks"
```

**Option 2: Backend config file**

```hcl
# environments/stg/backend.hcl
bucket         = "prasaarit-terraform-state"
key            = "upload-service/stg/terraform.tfstate"
region         = "ap-south-1"
dynamodb_table = "prasaarit-terraform-locks"
```

```bash
terraform init -backend-config=backend.hcl
```

**Option 3: Hardcode per environment (simplest with directory-per-env)**

Since each environment has its own directory, just hardcode the backend:

```hcl
# environments/stg/backend.tf
terraform {
  backend "s3" {
    bucket         = "prasaarit-terraform-state"
    key            = "upload-service/stg/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "prasaarit-terraform-locks"
    encrypt        = true
  }
}
```

This is the simplest approach with directory-per-environment. The "duplication" of backend config across env directories is 6 lines — it's not worth abstracting.

---

## Putting It Together — Your Prasaarit Project (Workspace Approach)

Here's the structure using workspaces:

```
prasaarit-upload-service/
├── infra/                       # single root module (workspaces handle envs)
│   ├── main.tf                  # provider, module calls
│   ├── variables.tf             # input variables
│   ├── locals.tf                # env_config map + derived values
│   ├── backend.tf               # S3 backend (workspaces auto-separate state)
│   ├── outputs.tf
│   ├── iam.tf                   # IAM roles and policies
│   └── api_gateway.tf           # API Gateway resources
├── modules/
│   ├── lambda_function/         # reusable Lambda module
│   └── api_route/               # reusable API GW route module
├── src/
│   └── generate_presigned_url/
│       └── handler.py
└── scripts/
    └── package_lambda.sh
```

```hcl
# ─── infra/backend.tf ──────────────────────────────────────────

terraform {
  backend "s3" {
    bucket         = "prasaarit-terraform-state"
    key            = "upload-service/terraform.tfstate"  # workspace auto-prefixes
    region         = "ap-south-1"
    dynamodb_table = "prasaarit-terraform-locks"
    encrypt        = true
  }
}
# State paths created automatically:
#   env:/stg/upload-service/terraform.tfstate
#   env:/prod/upload-service/terraform.tfstate
```

```hcl
# ─── infra/locals.tf ───────────────────────────────────────────

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

**Workflow:**

```bash
# Deploying to staging:
cd infra
terraform workspace select stg
terraform plan -out=stg.tfplan
terraform apply stg.tfplan

# Deploying to production:
terraform workspace select prod
terraform plan -out=prod.tfplan
# Review carefully...
terraform apply prod.tfplan
```

**In CI/CD (GitLab CI):**

```yaml
# .gitlab-ci.yml
stages:
  - plan
  - deploy

.terraform_base:
  image: hashicorp/terraform:1.9
  before_script:
    - cd infra
    - terraform init

plan-stg:
  extends: .terraform_base
  stage: plan
  script:
    - terraform workspace select stg
    - terraform plan -out=stg.tfplan
  artifacts:
    paths: [infra/stg.tfplan]

deploy-stg:
  extends: .terraform_base
  stage: deploy
  script:
    - terraform workspace select stg
    - terraform apply stg.tfplan
  needs: [plan-stg]
  only: [main]

plan-prod:
  extends: .terraform_base
  stage: plan
  script:
    - terraform workspace select prod
    - terraform plan -out=prod.tfplan
  artifacts:
    paths: [infra/prod.tfplan]

deploy-prod:
  extends: .terraform_base
  stage: deploy
  script:
    - terraform workspace select prod
    - terraform apply prod.tfplan
  needs: [plan-prod]
  when: manual          # manual approval gate for production
  only: [main]
```

---

## What the Workspace Architecture Guarantees

| Guarantee | Details |
|-----------|---------|
| **State isolation** | Each workspace has its own state file. Impossible to corrupt prod state from stg workspace. |
| **Single source of truth** | One config. Changes are applied to stg first, then promoted to prod by switching workspace. |
| **DRY code** | No config duplication. Environment differences are centralized in `env_config` map. |
| **CI/CD-enforced safety** | Pipeline jobs always select the correct workspace. No human error on workspace selection. |

## What the Workspace Architecture Does NOT Guarantee

| Non-guarantee | Why it matters |
|--------------|----------------|
| **Access isolation** | Both workspaces share the same backend credentials. Engineer with stg access can `workspace select prod`. Use multi-account + assume_role for strict separation. |
| **Cross-stack output stability** | `terraform_remote_state` outputs are a handshake agreement. No compile-time contract enforcement. |
| **Unlimited config divergence** | If prod needs many resources stg doesn't, `count` toggles accumulate. If this grows significantly, consider splitting to directory-per-env. |
| **No automatic promotion** | There's no built-in "promote stg → prod" mechanism. CI/CD pipeline controls the promotion flow via workspace selection. |

---

## Source References

- [Workspaces](https://developer.hashicorp.com/terraform/language/state/workspaces) — official docs
- [Backend Configuration](https://developer.hashicorp.com/terraform/language/backend) — backend blocks and limitations
- [terraform_remote_state](https://developer.hashicorp.com/terraform/language/state/remote-state-data) — cross-stack data source
- [AWS Provider assume_role](https://registry.terraform.io/providers/hashicorp/aws/latest/docs#assume-role) — multi-account pattern
