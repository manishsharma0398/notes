# Chapter 12 — Terragrunt Examples

A real-world Terragrunt repo structure demonstrating DRY configuration across multiple environments and AWS accounts.

---

## Directory Structure

```text
live/
├── root.hcl                    ← Inherited by all units: generates backend.tf + provider.tf
├── prod/
│   ├── env.hcl                 ← Prod-specific: account ID, region, env name
│   ├── vpc/
│   │   └── terragrunt.hcl      ← Unit: instantiates the VPC module
│   └── app/
│       └── terragrunt.hcl      ← Unit: depends on VPC
└── dev/
    ├── env.hcl
    ├── vpc/
    │   └── terragrunt.hcl
    └── app/
        └── terragrunt.hcl
```

---

## Example 1 — Root Config (`live/root.hcl`)

Defines the backend and provider for **every unit** that includes it. No unit needs its own `backend.tf` or `provider.tf`.

```hcl
# live/root.hcl

# ------------------------------------------------------------------
# Step 1: Load env-specific variables from the nearest env.hcl file
# ------------------------------------------------------------------
locals {
  # read_terragrunt_config returns the parsed config as a struct;
  # .locals gives access to the locals block inside env.hcl
  env_vars       = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  aws_account_id = local.env_vars.locals.aws_account_id
  aws_region     = local.env_vars.locals.aws_region
  env            = local.env_vars.locals.env
}

# ------------------------------------------------------------------
# Step 2: Generate provider.tf dynamically
# "overwrite_terragrunt" = only overwrite files Terragrunt itself wrote
# ------------------------------------------------------------------
generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region              = "${local.aws_region}"
  allowed_account_ids = ["${local.aws_account_id}"]

  assume_role {
    role_arn = "arn:aws:iam::${local.aws_account_id}:role/TerraformDeployRole"
  }

  default_tags {
    tags = {
      Environment = "${local.env}"
      ManagedBy   = "Terragrunt"
    }
  }
}
EOF
}

# ------------------------------------------------------------------
# Step 3: Configure remote state
# path_relative_to_include() → "prod/vpc", "prod/app", "dev/vpc" etc.
# This guarantees a unique S3 key per unit with ZERO per-unit config.
# ------------------------------------------------------------------
remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket         = "myorg-tfstate-${local.aws_account_id}"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = local.aws_region
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

# ------------------------------------------------------------------
# Step 4: Compliance hook — runs tfsec before every plan/apply
# Child hooks with the same name override this; different-name child
# hooks are appended.
# ------------------------------------------------------------------
terraform {
  before_hook "tfsec" {
    commands = ["plan", "apply"]
    execute  = ["tfsec", "."]
  }
}
```

---

## Example 2 — Environment Variables (`live/prod/env.hcl`)

Pure data — no Terraform execution. Read by the root config via `read_terragrunt_config`.

```hcl
# live/prod/env.hcl
locals {
  env            = "prod"
  aws_account_id = "111111111111"
  aws_region     = "us-east-1"
}
```

```hcl
# live/dev/env.hcl
locals {
  env            = "dev"
  aws_account_id = "222222222222"
  aws_region     = "us-east-1"
}
```

---

## Example 3 — VPC Unit (`live/prod/vpc/terragrunt.hcl`)

Atomic deployable unit. Pulls in the root config and pins to a versioned module.

```hcl
# live/prod/vpc/terragrunt.hcl

include "root" {
  path = find_in_parent_folders("root.hcl")
  # Default merge strategy: "shallow_merge"
  # Child simple-attributes win; inputs shallowly merged.
}

terraform {
  # Terragrunt downloads this into .terragrunt-cache/<url-hash>/<content-hash>/
  source = "git::git@github.com:myorg/infra-modules.git//modules/vpc?ref=v1.2.0"
}

inputs = {
  vpc_cidr             = "10.0.0.0/16"
  public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnet_cidrs = ["10.0.10.0/24", "10.0.20.0/24"]
}
```

---

## Example 4 — App Unit with Dependency (`live/prod/app/terragrunt.hcl`)

Demonstrates the dependency output resolution path. Without `mock_outputs`, `plan` on a fresh environment fails because the VPC state is empty.

```hcl
# live/prod/app/terragrunt.hcl

include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "git::git@github.com:myorg/infra-modules.git//modules/app?ref=v2.5.1"
}

# -------------------------------------------------------------------
# dependency block mechanism:
# 1. Terragrunt calls getTerragruntOutputIfAppliedElseConfiguredDefault
# 2. It runs `terraform output -json` on ../vpc's working directory
# 3. If the VPC state is empty AND this command is in
#    mock_outputs_allowed_terraform_commands → return mock_outputs
# 4. During apply, real outputs are fetched; mocks are not used
# -------------------------------------------------------------------
dependency "vpc" {
  config_path = "../vpc"

  mock_outputs = {
    vpc_id             = "vpc-00000000000"
    private_subnet_ids = ["subnet-00000000", "subnet-11111111"]
  }
  # Restrict mock use to safe read-only commands only
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "output"]
}

inputs = {
  instance_type = "t3.large"
  min_capacity  = 3
  max_capacity  = 10

  # These values come from the VPC unit's terraform outputs at apply time
  vpc_id     = dependency.vpc.outputs.vpc_id
  subnet_ids = dependency.vpc.outputs.private_subnet_ids
}
```

---

## Example 5 — Explicit Stack (`terragrunt.stack.hcl`)

Used when you want to version and promote a group of units as an atomic set. Running `terragrunt stack generate` materialises units into `.terragrunt-stack/`.

```hcl
# stacks/microservice/terragrunt.stack.hcl

locals {
  # These can be overridden via terragrunt.values.hcl written by a parent stack
  service_name = "payments"
}

unit "iam" {
  source = "git::github.com/myorg/infra-modules.git//units/iam-role?ref=v3.0.0"
  path   = "iam"
  values = {
    service_name = local.service_name
  }
}

unit "ecs_service" {
  source = "git::github.com/myorg/infra-modules.git//units/ecs-service?ref=v3.0.0"
  path   = "ecs"
  values = {
    service_name = local.service_name
    # Cross-unit values are wired through dependency blocks inside each unit's
    # own terragrunt.hcl — not here in the stack file.
  }
}
```

After `terragrunt stack generate`, the directory structure looks like:

```text
stacks/microservice/
├── terragrunt.stack.hcl         ← you write this
└── .terragrunt-stack/           ← Terragrunt generates this (add to .gitignore)
    ├── iam/
    │   ├── main.tf              ← downloaded from source
    │   ├── terragrunt.hcl       ← from source
    │   └── terragrunt.values.hcl  ← auto-generated by Terragrunt with the values map
    └── ecs/
        ├── main.tf
        ├── terragrunt.hcl
        └── terragrunt.values.hcl
```

---

## Example 6 — Failure Scenario: `run-all apply` Fails Mid-Way

```bash
# From live/prod/
$ terragrunt run-all apply

# Output (simplified):
# [INFO]  Running apply in vpc   ✓  (succeeded)
# [INFO]  Running apply in rds   ✓  (succeeded - ran in parallel with vpc)
# [INFO]  Running apply in app   ✗  (FAILED: ECS service failed to stabilize)
# [INFO]  Skipping alarms         (depends on app, which failed)

# --- Recovery ---
# 1. Do NOT re-run run-all immediately

# 2. Inspect the partial state in the app unit
$ cd live/prod/app
$ terragrunt state list
# → shows which resources made it into state

# 3. Fix the root cause (e.g., ECS health check config)
# Edit the module or inputs as needed

# 4. Apply ONLY the failed unit
$ terragrunt apply
# → succeeds

# 5. Back to root — resume remaining units
$ cd live/prod/
$ terragrunt run-all apply
# vpc: no changes (skipped by idempotency)
# rds: no changes (skipped)
# app: no changes (just applied in step 4)
# alarms: APPLIED (was skipped before, now its dependency is healthy)
```

---

## Example 7 — Local Development with `--source` Override

When iterating on a module locally, override the remote source without changing `terragrunt.hcl`:

```bash
# Override the source for THIS run only — points to your local module checkout
terragrunt plan \
  --source /home/dev/infra-modules/modules/vpc \
  --source-update

# Force Terragrunt to re-download even if the cache hash hasn't changed
terragrunt apply --source-update
```

The `--source` flag overrides `terraform { source = "..." }` for the current Terragrunt execution only. Nothing is written to disk permanently. CI always uses the pinned `ref=` in `terragrunt.hcl`.
