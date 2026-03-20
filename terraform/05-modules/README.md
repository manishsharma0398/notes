# Chapter 05 — Modules

## Mental Model

A module is a **directory of `.tf` files** that acts as a reusable unit. There is no special file format, no compilation step, no registry required. If you have a directory with `.tf` files, you already have a module.

> **Your root config is already a module** — the "root module." Every directory you call via a `module` block is a "child module." There is no structural difference between them. The only difference is who calls whom.

Think of modules as functions:

```
Function concept          Terraform equivalent
─────────────────         ──────────────────────────────────────────
function definition       module directory (variables.tf, main.tf, outputs.tf)
function parameters       input variables (variables.tf)
function return values    output values (outputs.tf)
function call             module {} block
function body             resource blocks inside the module
```

**Critical difference from functions**: modules have **no side-channel communication**. A child module cannot read the parent's variables, locals, or resource attributes. All communication is explicit: inputs flow in through variables, outputs flow out through output blocks. This is enforced by Terraform, not by convention.

---

## Module Structure and Conventions

A module is any directory containing `.tf` files. The conventional layout:

```
modules/
└── lambda_function/          ← this directory IS the module
    ├── versions.tf            # required_providers, terraform version constraint
    ├── variables.tf           # input parameters
    ├── main.tf                # resource definitions
    ├── outputs.tf             # return values
    └── README.md              # public API documentation (expected for shared modules)
```

Terraform reads **all** `.tf` files in the directory and merges them. Filenames are convention only — Terraform doesn't enforce them. `versions.tf` is worth calling out specifically: modules should declare their `required_providers` and minimum Terraform version so callers know what's needed.

### Minimal Working Module

```hcl
# ─── modules/lambda_function/versions.tf ───────────────────────────────────────
terraform {
  required_version = ">= 1.4"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"    # module declares minimum — caller provides the actual version
    }
  }
}
```

```hcl
# ─── modules/lambda_function/variables.tf ──────────────────────────────────────
variable "function_name" {
  description = "Name of the Lambda function"
  type        = string
  # No default → REQUIRED. Caller must provide.
}

variable "handler" {
  description = "Handler function entrypoint"
  type        = string
  default     = "handler.lambda_handler"
}

variable "runtime" {
  description = "Lambda runtime identifier"
  type        = string
  default     = "python3.12"
}

variable "timeout" {
  description = "Max execution time in seconds"
  type        = number
  default     = 10
  validation {
    condition     = var.timeout >= 1 && var.timeout <= 900
    error_message = "Lambda timeout must be between 1 and 900 seconds."
  }
}

variable "memory_size" {
  description = "Memory allocation in MB"
  type        = number
  default     = 128
}

variable "environment_variables" {
  description = "Runtime environment variables"
  type        = map(string)
  default     = {}
}

variable "lambda_role_arn" {
  description = "ARN of the IAM execution role"
  type        = string
}

variable "source_path" {
  description = "Path to the deployment zip file"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources created by this module"
  type        = map(string)
  default     = {}
}
```

```hcl
# ─── modules/lambda_function/main.tf ───────────────────────────────────────────
resource "aws_lambda_function" "this" {
  function_name    = var.function_name
  role             = var.lambda_role_arn
  handler          = var.handler
  runtime          = var.runtime
  timeout          = var.timeout
  memory_size      = var.memory_size
  filename         = var.source_path
  source_code_hash = filebase64sha256(var.source_path)
  tags             = var.tags

  environment {
    variables = var.environment_variables
  }
}
```

```hcl
# ─── modules/lambda_function/outputs.tf ────────────────────────────────────────
output "function_name" {
  description = "Name of the created Lambda function"
  value       = aws_lambda_function.this.function_name
}

output "arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.this.arn
}

output "invoke_arn" {
  description = "Invoke ARN — used by API Gateway integrations"
  value       = aws_lambda_function.this.invoke_arn
}

# Mark outputs as sensitive when they contain secrets
# output "secret_env" {
#   value     = aws_lambda_function.this.environment[0].variables["API_SECRET"]
#   sensitive = true   # hidden from plan/apply output; still in state plaintext
# }
```

### Calling the Module

```hcl
# ─── root module: infra/main.tf ────────────────────────────────────────────────
module "presign_lambda" {
  source = "../modules/lambda_function"   # path to module directory

  function_name   = "${local.prefix}-presign"
  lambda_role_arn = aws_iam_role.lambda_exec.arn
  source_path     = "${path.root}/../lambda_payload.zip"
  tags            = local.common_tags

  environment_variables = {
    BUCKET_NAME    = var.s3_upload_bucket
    ALLOWED_ORIGIN = join(",", var.allowed_origins)
  }
}

# Access module outputs with module.<name>.<output_name>:
output "presign_lambda_arn" {
  value = module.presign_lambda.arn
}

# You CANNOT access module internals directly:
# module.presign_lambda.aws_lambda_function.this.arn  ← ERROR: not allowed
# Use the module's declared output instead. This is enforced by Terraform.
```

---

## How Modules Work Internally

### During `terraform init`

1. Reads `source` attribute of each `module` block
2. Remote sources (registry, Git, S3) → downloaded into `.terraform/modules/`
3. Local paths → no download, direct reference
4. Module metadata written to `.terraform/modules/modules.json`

Must re-run `terraform init` whenever you add, remove, or change the `source` of a `module` block.

### During Plan — Namespaced Graph

Module resources get **namespaced addresses**:

```
Root module address:   aws_iam_role.lambda_exec
Child module address:  module.presign_lambda.aws_lambda_function.this
```

The dependency graph crosses module boundaries transparently. If the root references `module.presign_lambda.invoke_arn`, Terraform tracks the full dependency chain through the module to the underlying `aws_lambda_function.this` resource.

### In State

```json
{
  "resources": [
    {
      "module": "module.presign_lambda",
      "type": "aws_lambda_function",
      "name": "this",
      "instances": [{ "attributes": { "arn": "...", "function_name": "..." } }]
    }
  ]
}
```

This full address is what `terraform state mv`, `moved` blocks, and `terraform state show` operate on.

---

## Module Inputs and Outputs — The Public Contract

### Inputs (Variables)

A module's variables are its **public API**. Once other teams or services call your module, changing a required variable (adding one, removing one, changing its type) is a breaking change.

```hcl
# All required variables must be provided. All optional variables have defaults.
module "presign_lambda" {
  source          = "../modules/lambda_function"
  function_name   = "prasaarit-presign-stg"   # required — no default
  lambda_role_arn = aws_iam_role.lambda_exec.arn  # required
  source_path     = "../lambda.zip"            # required
  # timeout, memory_size, handler use defaults — caller can omit them
}
```

### Outputs — The Only Visible Surface

Only values declared as `output` blocks are visible to the caller. Internal resources, local values, and intermediate variables are completely hidden. This is enforced — trying to access `module.x.aws_resource.name.attr` is a compile error.

```hcl
# CORRECT — use the module's output
uri = module.presign_lambda.invoke_arn

# ERROR — cannot reach into module internals
uri = module.presign_lambda.aws_lambda_function.this.invoke_arn
```

**Why this matters for refactoring**: if the module renames `aws_lambda_function.this` → `aws_lambda_function.fn` internally, callers are completely unaffected — as long as the output names and types stay the same.

### `sensitive` Outputs

```hcl
# In the module's outputs.tf:
output "db_password" {
  value     = aws_db_instance.main.password
  sensitive = true   # value hidden in plan/apply terminal output
  # BUT: still stored as plaintext in state and in the calling module's state
}

# In the calling module, the output is usable but treated as sensitive:
resource "some_resource" "this" {
  password = module.database.db_password   # works; Terraform marks it sensitive in plan
}
```

---

## Module Sources

The `source` argument tells Terraform where to find the module. `terraform init` must be re-run when it changes.

### Local Path

```hcl
module "lambda" {
  source = "../modules/lambda_function"    # relative to calling .tf file location
}
```

No download, no version control. Changes take effect immediately on the next `init`. Best for modules within the same repo.

### Terraform Registry

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.0"    # ← always pin exact version
}
```

Downloaded during `init` from [registry.terraform.io](https://registry.terraform.io). The `version` constraint follows the same semver syntax as provider versions (`~> 5.1` = patch updates only). Best for community modules.

### Git Repository

```hcl
# HTTPS (for CI/CD with tokens):
module "lambda" {
  source = "git::https://github.com/your-org/terraform-modules.git//modules/lambda_function?ref=v1.2.0"
  #         ────── prefix ──── ─────────────── repo URL ──────────── ───── path within repo ─── ─ tag ─
}

# SSH (for developer machines):
module "lambda" {
  source = "git::git@github.com:your-org/terraform-modules.git//modules/lambda_function?ref=v1.2.0"
}
```

`//` separates the repository root from the subdirectory path. `?ref=` requires a tag, branch, or commit SHA. Best for private org-wide modules.

### Version Pinning Is Non-Negotiable

```hcl
# ✓ GOOD — exact version
module "vpc" { source = "terraform-aws-modules/vpc/aws"; version = "5.1.0" }

# ✓ ACCEPTABLE — patch updates only
module "vpc" { source = "terraform-aws-modules/vpc/aws"; version = "~> 5.1" }

# ✗ DANGEROUS — no pin: next init may download breaking changes
module "vpc" { source = "terraform-aws-modules/vpc/aws" }

# ✗ DANGEROUS — branch ref: non-deterministic, changes constantly
module "lambda" { source = "git::https://github.com/org/modules.git//lambda?ref=main" }
```

---

## Provider Inheritance and the `providers` Map

### Default: Provider Inheritance

Child modules **automatically inherit** the parent module's providers. You do not need to configure providers in child modules:

```hcl
# root module — configures the provider once
provider "aws" { region = "ap-south-1" }

# child module — inherits the root's aws provider automatically
module "lambda" {
  source = "../modules/lambda_function"
  # No provider config needed
}
```

**Never declare a `provider` block inside a child module** meant to be reusable. It creates a second provider instance, causing resources to land in the wrong region or account — a very hard bug to debug.

### Passing Aliased Providers for Multi-Region/Multi-Account

When a module needs a different region or AWS account than the root:

```hcl
# root module — two provider instances
provider "aws" {
  region = "ap-south-1"    # default, used by most resources
}

provider "aws" {
  alias  = "us_east"
  region = "us-east-1"     # ACM certificates for CloudFront must be in us-east-1
}

# Pass the non-default provider to the module that needs it
module "cdn_cert" {
  source = "../modules/acm_cert"
  providers = {
    aws = aws.us_east    # module's "aws" = root's "aws.us_east"
  }
  domain = "*.prasaarit.com"
}

# The module's resources use the aliased provider — all in us-east-1
```

Inside `modules/acm_cert/versions.tf`, declare the provider requirement:

```hcl
terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.0" }
  }
}
```

The module doesn't know or care which region it's in — the caller controls that through providers.

---

## `for_each` and `count` on Modules

Modules support `for_each` and `count` (since v0.13), enabling multiple instances:

```hcl
variable "lambdas" {
  type = map(object({
    handler     = string
    timeout     = number
    source_path = string
  }))
  default = {
    presign  = { handler = "handler.presign",  timeout = 10, source_path = "../presign.zip" }
    metadata = { handler = "handler.metadata", timeout = 5,  source_path = "../metadata.zip" }
  }
}

module "lambda" {
  source   = "../modules/lambda_function"
  for_each = var.lambdas    # same for_each rules as resources apply

  function_name         = "${local.prefix}-${each.key}"
  handler               = each.value.handler
  timeout               = each.value.timeout
  lambda_role_arn       = aws_iam_role.lambda_exec.arn
  source_path           = each.value.source_path
  tags                  = local.common_tags
}

# Creates:
#   module.lambda["presign"].aws_lambda_function.this
#   module.lambda["metadata"].aws_lambda_function.this

# Collect all ARNs with a for expression:
output "lambda_arns" {
  value = { for k, mod in module.lambda : k => mod.arn }
}
```

All `for_each` rules apply: keys must be known at plan time, key-based identity, removing a key destroys that entire module instance (all resources inside).

---

## Composition Patterns — Start Flat, Extract When Needed

### Pattern 1: Flat (All Resources in Root)

```
infra/
├── main.tf          # provider, backend
├── variables.tf
├── outputs.tf
├── iam.tf           # IAM role + policy
├── lambda.tf        # Lambda functions
└── api_gateway.tf   # API GW resources
```

No child modules. All resources directly in root. **Right for small projects and early design**. Don't over-engineer on day one.

### Pattern 2: Local Feature Modules

```
prasaarit-upload-service/
├── infra/                       # root module
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
└── modules/
    ├── lambda_function/         # Lambda + config (reusable)
    └── api_route/               # API GW resource + method + integration (reusable)
```

Extract when you find yourself copy-pasting a group of resources to create a second similar instance. The copy-paste is the signal.

Adding a new Lambda + route becomes ~15 lines:

```hcl
module "metadata_lambda" {
  source              = "../modules/lambda_function"
  function_name       = "${local.prefix}-metadata"
  lambda_role_arn     = aws_iam_role.lambda_exec.arn
  source_path         = "../metadata.zip"
  environment_variables = { BUCKET_NAME = var.s3_upload_bucket }
}

module "metadata_route" {
  source            = "../modules/api_route"
  rest_api_id       = aws_api_gateway_rest_api.api.id
  path_part         = "video-metadata"
  http_method       = "GET"
  lambda_invoke_arn = module.metadata_lambda.invoke_arn
}
```

### Pattern 3: Shared Module Repository (Team Scale)

```
github.com/your-org/terraform-modules/
└── modules/
    ├── lambda_function/
    ├── api_route/
    └── iam_role/

# Each service repo references by Git tag:
module "presign_lambda" {
  source = "git::https://github.com/your-org/terraform-modules.git//modules/lambda_function?ref=v2.0.0"
}
```

Move to this pattern when multiple repos need the same module. Versioning becomes critical — treat module releases like library releases (semver, changelogs, migration guides).

---

## When NOT to Use Modules

| Scenario | Why modules hurt |
|---|---|
| Wraps a single resource | Zero abstraction. One `aws_s3_bucket` → just use the resource directly |
| More inputs than the resource has arguments | Not abstracting — wrapping with indirection |
| Used exactly once | Module value comes from reuse. Single-use = indirection with no payoff |
| Design still fluid | Modules lock in a contract. Extract after the pattern stabilizes |

**Rule**: start flat. Extract when you copy-paste a resource group a second time. Move to shared repo when two repos need the same module.

---

## Common Mistakes

### 1. Provider block inside a child module

Creates a second provider instance in a different region. Very hard to debug. Solution: never declare `provider` blocks in child modules unless it's a root module.

### 2. Reaching into module internals

```hcl
# ERROR — compile-time error
uri = module.presign_lambda.aws_lambda_function.this.invoke_arn

# CORRECT — use the declared output
uri = module.presign_lambda.invoke_arn
```

### 3. No `required_providers` in `versions.tf`

Without it, the module silently inherits whatever version the caller uses — which may be incompatible. Always declare minimum required versions.

### 4. Renaming internal resources without a `moved` block

Renaming `aws_lambda_function.this` → `aws_lambda_function.fn` inside the module triggers destroy + create for every caller. Add a `moved` block inside the module before renaming.

### 5. Unpinned module versions

```hcl
module "vpc" { source = "terraform-aws-modules/vpc/aws" }  # No version → gets latest
```

Non-deterministic. Next `terraform init` in CI may fetch a breaking release.

---

## Source References

- [Modules](https://developer.hashicorp.com/terraform/language/modules) — official overview
- [Module Sources](https://developer.hashicorp.com/terraform/language/modules/sources) — local, registry, Git, S3
- [Module Composition](https://developer.hashicorp.com/terraform/language/modules/develop/composition) — patterns and best practices
- [Standard Module Structure](https://developer.hashicorp.com/terraform/language/modules/develop/structure) — conventions
- [Provider Configuration for Modules](https://developer.hashicorp.com/terraform/language/modules/develop/providers) — inheritance and `providers` map
- [Terraform Registry](https://registry.terraform.io/browse/modules) — community modules
