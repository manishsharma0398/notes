# Chapter 05 — Modules

## Mental Model

A module is a **directory of `.tf` files** that acts as a reusable unit. That's it. There is no special file format, no compilation step, no module registry required. If you have a directory with `.tf` files, you already have a module.

The critical insight that trips people up:

> **Your root config is already a module** — the "root module." Every other module you call is a "child module." There is **no structural difference** between the root module and a child module. The only difference is who calls whom.

Think of modules like **functions** in a programming language:

```
Programming Language                  Terraform
─────────────────────                 ─────────
function definition                   module directory (variables.tf, main.tf, outputs.tf)
function parameters                   input variables
function return values                output values
function call                         module block
function body                         resource blocks inside the module
```

But with one critical difference: **modules have no side-channel communication**. A child module cannot read the parent's variables, cannot access the parent's resources, and cannot modify the parent's state. All communication flows through **inputs** (variables) and **outputs** (output values) — enforced by Terraform, not by convention.

---

## Module Structure

A module is any directory containing `.tf` files. By convention:

```
modules/
└── lambda_api/                  # ← this directory IS the module
    ├── main.tf                  # Resource definitions
    ├── variables.tf             # Input variables (module "parameters")
    ├── outputs.tf               # Output values (module "return values")
    └── README.md                # Documentation (optional but expected)
```

There is **no required filename**. Terraform reads all `.tf` files in the directory and merges them. The convention of `main.tf`, `variables.tf`, `outputs.tf` is for human readability — Terraform doesn't care.

### Minimal Module Example — For Your Prasaarit Project

```
modules/
└── lambda_function/
    ├── variables.tf
    ├── main.tf
    └── outputs.tf
```

```hcl
# ─── modules/lambda_function/variables.tf ─────────────────────

variable "function_name" {
  description = "Name of the Lambda function"
  type        = string
}

variable "handler" {
  description = "Handler function entrypoint"
  type        = string
  default     = "handler.lambda_handler"
}

variable "runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "python3.12"
}

variable "timeout" {
  description = "Timeout in seconds"
  type        = number
  default     = 10
}

variable "memory_size" {
  description = "Memory in MB"
  type        = number
  default     = 128
}

variable "environment_variables" {
  description = "Environment variables for the Lambda"
  type        = map(string)
  default     = {}
}

variable "lambda_role_arn" {
  description = "ARN of the IAM role for the Lambda"
  type        = string
}

variable "source_path" {
  description = "Path to the Lambda deployment zip"
  type        = string
}

variable "tags" {
  description = "Tags to apply to the Lambda"
  type        = map(string)
  default     = {}
}
```

```hcl
# ─── modules/lambda_function/main.tf ──────────────────────────

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
# ─── modules/lambda_function/outputs.tf ───────────────────────

output "function_name" {
  description = "Name of the created Lambda function"
  value       = aws_lambda_function.this.function_name
}

output "arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.this.arn
}

output "invoke_arn" {
  description = "Invoke ARN (used by API Gateway integration)"
  value       = aws_lambda_function.this.invoke_arn
}
```

### Calling the Module

```hcl
# ─── root module: infra/main.tf ───────────────────────────────

module "presign_lambda" {
  source = "../modules/lambda_function"    # ← path to the module directory

  function_name         = "${local.prefix}-presign"
  lambda_role_arn       = aws_iam_role.lambda_exec.arn
  source_path           = "${path.root}/../lambda_payload.zip"
  tags                  = local.common_tags

  environment_variables = {
    BUCKET_NAME    = var.s3_upload_bucket
    ALLOWED_ORIGIN = join(",", var.allowed_origins)
  }
}

# Access module outputs:
output "presign_lambda_arn" {
  value = module.presign_lambda.arn
}
```

---

## How Modules Work Internally

When Terraform encounters a `module` block, here's what happens:

### During `terraform init`

1. Terraform reads the `source` attribute.
2. If the source is a remote URL (registry, Git, S3), it downloads the module into `.terraform/modules/`.
3. If the source is a local path (`../modules/lambda_function`), no download — just a reference.
4. Module metadata is recorded in `.terraform/modules/modules.json`.

### During `terraform plan`

1. The configuration loader processes the module's `.tf` files, creating a nested `configs.Config`.
2. The graph builder creates **a sub-graph** for the module's resources.
3. Module variables become the inputs. They're evaluated in the **parent's** context.
4. Module resources get **namespaced addresses**: `module.presign_lambda.aws_lambda_function.this`
5. The graph walk enters the module (via `EnterPath` — Chapter 01), creating a separate `EvalContext` for the module's namespace.

### In the Dependency Graph

```
Root Module                          Child Module (lambda_function)
───────────                          ─────────────────────────────
aws_iam_role.lambda_exec ──────┐
                               ▼
                    module.presign_lambda
                               │
                               ├── aws_lambda_function.this
                               │
                    ◄──────────┘
                               │
aws_api_gateway_integration    │
    uses: module.presign_lambda.invoke_arn
```

Module boundaries in the graph are **transparent for dependency tracking**. If the root references `module.presign_lambda.invoke_arn`, Terraform knows the integration depends on the Lambda inside the module.

### In State

Module resources are stored with their full namespaced address:

```json
{
  "resources": [
    {
      "module": "module.presign_lambda",
      "type": "aws_lambda_function",
      "name": "this",
      "instances": [{ "attributes": { "arn": "...", ... } }]
    }
  ]
}
```

---

## Module Inputs and Outputs — The Contract

### Inputs (Variables)

A module's variables are its **public API**. The caller MUST provide all required variables (those without defaults).

```hcl
# Inside the module: variables.tf
variable "function_name" {
  type = string
  # No default → REQUIRED. Caller must provide.
}

variable "timeout" {
  type    = number
  default = 10
  # Has default → OPTIONAL. Caller can override.
}
```

```hcl
# In the caller:
module "presign_lambda" {
  source        = "../modules/lambda_function"
  function_name = "prasaarit-presign-stg"     # required — must provide
  # timeout not specified → uses default (10)
}
```

**Key rule**: A module **cannot** access `var.stage` from its parent. All inputs must be explicitly passed:

```hcl
# WRONG — module can't reach into parent's namespace
# (This is a feature, not a bug — it enforces encapsulation)

module "presign_lambda" {
  source = "../modules/lambda_function"
  # Inside this module, `var.stage` refers to the MODULE's own variable,
  # not the root module's variable. If the module doesn't declare
  # a "stage" variable, this is an error.
}
```

### Outputs

Outputs are how a module **exposes values to its caller**. Only outputs are visible — internal resources and locals are completely hidden.

```hcl
# Inside the module: outputs.tf
output "arn" {
  value = aws_lambda_function.this.arn
}

# In the caller:
resource "aws_api_gateway_integration" "presign" {
  uri = module.presign_lambda.invoke_arn   # ← accessing a module output
}

# You CANNOT do this:
# uri = module.presign_lambda.aws_lambda_function.this.invoke_arn
# ↑ ERROR: module resources are not directly accessible
```

**This is encapsulation.** The module can change its internal resource names, split one resource into two, or restructure completely — as long as the outputs stay the same, the caller doesn't break.

---

## Module Sources

The `source` argument tells Terraform where to find the module code.

### Local Paths

```hcl
module "lambda" {
  source = "../modules/lambda_function"    # relative to the calling .tf file
}

module "lambda" {
  source = "./modules/lambda_function"     # relative to current directory
}
```

- No download needed. Changes are picked up immediately.
- **Best for**: Modules within the same repo.

### Terraform Registry

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.0"    # ← always pin the version!
}
```

- Downloaded during `terraform init` into `.terraform/modules/`.
- Registry: [registry.terraform.io](https://registry.terraform.io)
- **Best for**: Community-maintained modules (VPC, EKS, etc.).

### Git Repository

```hcl
module "lambda" {
  source = "git::https://github.com/your-org/terraform-modules.git//modules/lambda?ref=v1.2.0"
  #        ──────────── repo URL ──────────────────────────────────── ──── path ── ── tag ──
}

module "lambda" {
  source = "git::git@github.com:your-org/terraform-modules.git//modules/lambda?ref=v1.2.0"
  # SSH variant — uses your SSH key for auth
}
```

- Downloaded during `init`. The `ref=` pin is critical (tag, branch, or commit SHA).
- `//` separates the repo URL from the path within the repo.
- **Best for**: Private modules shared across repos within your organization.

### S3 Bucket

```hcl
module "lambda" {
  source = "s3::https://s3-ap-south-1.amazonaws.com/prasaarit-terraform-modules/lambda/v1.0.0.zip"
}
```

- **Best for**: Air-gapped or strictly controlled environments.

### Version Pinning Is Non-Negotiable

```hcl
# GOOD — pinned to exact version
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.0"
}

# ACCEPTABLE — pinned to minor version range
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.1"     # allows 5.1.x but not 5.2.0
}

# DANGEROUS — no version pin
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  # No version → gets latest. Next init may download a breaking change.
}

# DANGEROUS — branch reference in Git
module "lambda" {
  source = "git::https://github.com/org/modules.git//lambda?ref=main"
  # "main" changes constantly. Your infra is non-deterministic.
}
```

---

## Module Composition Patterns

### Pattern 1: Flat Modules (Your Prasaarit Project Now)

```
prasaarit-upload-service/
├── infra/                   # root module
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── iam.tf
│   ├── lambda.tf
│   └── api_gateway.tf
└── src/
    └── ...
```

No child modules. All resources in the root module. **This is fine for small projects** and where you're starting. Don't over-engineer with modules on day one.

### Pattern 2: Feature Modules (Next Step)

```
prasaarit-upload-service/
├── infra/                           # root module
│   ├── main.tf                      # provider, backend
│   ├── variables.tf
│   └── outputs.tf
├── modules/
│   ├── lambda_function/             # reusable Lambda module
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── api_route/                   # reusable API route module
│       ├── main.tf                  # resource + method + integration
│       ├── variables.tf
│       └── outputs.tf
└── src/
```

The root module calls child modules:

```hcl
# infra/main.tf

module "presign_lambda" {
  source        = "../modules/lambda_function"
  function_name = "${local.prefix}-presign"
  lambda_role_arn = aws_iam_role.lambda_exec.arn
  source_path   = "../lambda_payload.zip"
  environment_variables = { BUCKET_NAME = var.s3_upload_bucket }
}

module "presign_route" {
  source          = "../modules/api_route"
  rest_api_id     = aws_api_gateway_rest_api.api.id
  parent_id       = aws_api_gateway_rest_api.api.root_resource_id
  path_part       = "generate-presigned-url"
  http_method     = "POST"
  lambda_invoke_arn = module.presign_lambda.invoke_arn
}

# Adding a NEW route becomes trivial:
module "metadata_lambda" {
  source        = "../modules/lambda_function"
  function_name = "${local.prefix}-metadata"
  lambda_role_arn = aws_iam_role.lambda_exec.arn
  source_path   = "../metadata_payload.zip"
  environment_variables = { BUCKET_NAME = var.s3_upload_bucket }
}

module "metadata_route" {
  source          = "../modules/api_route"
  rest_api_id     = aws_api_gateway_rest_api.api.id
  parent_id       = aws_api_gateway_rest_api.api.root_resource_id
  path_part       = "video-metadata"
  http_method     = "GET"
  lambda_invoke_arn = module.metadata_lambda.invoke_arn
}
```

**Why this is powerful**: Adding a new Lambda + API route is ~15 lines of config. The module handles all the boilerplate (Lambda permission, API Gateway integration, CORS OPTIONS method).

### Pattern 3: Shared Module Repository (Team Scale)

```
# Separate repo: github.com/your-org/terraform-modules
terraform-modules/
├── modules/
│   ├── lambda_function/
│   ├── api_route/
│   ├── iam_role/
│   └── ...
└── README.md

# Your service repo references it by Git tag:
module "presign_lambda" {
  source = "git::https://github.com/your-org/terraform-modules.git//modules/lambda_function?ref=v2.0.0"
  # ...
}
```

**When to move to this pattern**: When multiple services/repos need the same module. Before that, local modules are simpler and faster to iterate on.

**The contract**: Modules must *never* rely on hardcoded paths, current directories, or side-effects. Everything they need must come through inputs.

### Terragrunt: Making Shared Modules Deployable Directly

In standard Terraform (as shown above), to deploy a shared module like `lambda_function`, you have to create a "Root Module" (like `stg/main.tf` or `prod/main.tf`) that calls it using a `module {}` block.

**Terragrunt eliminates the need for the Root Module wrapper.** Instead of writing a root `main.tf` that calls your module, you deploy the module directly using `terragrunt.hcl`:

```hcl
# iac/dev/terragrunt.hcl

include "root" {
  path = find_in_parent_folders()
}

# The Magic: Terragrunt pulls the raw module as the root source!
terraform {
  source = "..//resources/lambda_function"
}

# These are automatically passed as variables to the module
inputs = {
  function_name = "virgo-bff-content-dev"
  memory_size   = 256
}
```

When you run `terragrunt apply`, Terragrunt downloads your `..//resources/lambda_function` module, treats it as the *primary root module*, dynamically injects your `inputs` as `TF_VAR_function_name`, generates the remote state backend, and deploys it.

This is why Terragrunt directory trees contain zero `.tf` files — just `.hcl` files pointing to shared code.

---

## Internal Mechanics: `for_each` and Dependency Graphs
Modules support `for_each` and `count` (Terraform 0.13+), enabling you to create multiple instances of a module:

```hcl
variable "lambdas" {
  type = map(object({
    handler     = string
    timeout     = number
    env_vars    = map(string)
    source_path = string
  }))
  default = {
    presign = {
      handler     = "handler.lambda_handler"
      timeout     = 10
      env_vars    = { BUCKET_NAME = "prasaarit-uploads-stg" }
      source_path = "../presign_payload.zip"
    }
    metadata = {
      handler     = "handler.lambda_handler"
      timeout     = 5
      env_vars    = { BUCKET_NAME = "prasaarit-uploads-stg" }
      source_path = "../metadata_payload.zip"
    }
  }
}

module "lambda" {
  source   = "../modules/lambda_function"
  for_each = var.lambdas

  function_name         = "${local.prefix}-${each.key}"
  handler               = each.value.handler
  timeout               = each.value.timeout
  lambda_role_arn       = aws_iam_role.lambda_exec.arn
  source_path           = each.value.source_path
  environment_variables = each.value.env_vars
  tags                  = local.common_tags
}

# Creates:
#   module.lambda["presign"].aws_lambda_function.this
#   module.lambda["metadata"].aws_lambda_function.this

# Access outputs:
output "lambda_arns" {
  value = { for k, v in module.lambda : k => v.arn }
}
```

**Same `for_each` rules apply** (Chapter 02): keys must be known at plan time, use key-based identity (not index).

---

## When NOT to Use Modules

Modules are **not always better**. Here's when to avoid them:

| Scenario | Why modules hurt |
|----------|-----------------|
| **You have < 5 resources** | Modules add indirection. For a small stack, inline resources are simpler. |
| **The module wraps a single resource** | A module for one `aws_s3_bucket`? Just use the resource directly. Modules shine when they encapsulate **multiple related resources**. |
| **You're still figuring out the design** | Modules lock in a contract (inputs/outputs). If you're experimenting, wait until the pattern stabilizes before extracting a module. |
| **The module has 30+ input variables** | If the module exposes every possible attribute as a variable, it's not abstracting anything — it's just adding a layer of indirection. |

**Rule of thumb**: Start flat (Pattern 1). Extract modules when you find yourself **duplicating a group of resources** (Pattern 2). Move to a shared repo when multiple services need the same module (Pattern 3).

---

## Common Module Mistakes

### Mistake 1: Hardcoding Provider Config in a Module

```hcl
# WRONG — module should NOT configure its own provider
# modules/lambda_function/main.tf
provider "aws" {
  region = "ap-south-1"    # ← hardcoded provider config
}

resource "aws_lambda_function" "this" { ... }
```

Modules **inherit** the provider from the calling module. If the root module configures `provider "aws" { region = "ap-south-1" }`, all child modules use that provider automatically.

Hardcoding a provider in a child module creates a **second provider instance** — leading to duplicate resources in different regions or accounts.

### Mistake 2: Reaching Into Module Internals

```hcl
# WRONG — accessing internal resource directly
uri = module.presign_lambda.aws_lambda_function.this.invoke_arn

# RIGHT — use the module's output
uri = module.presign_lambda.invoke_arn
```

If the module author renames the internal resource, the first approach breaks. The second uses the module's public contract (outputs).

### Mistake 3: Not Declaring Provider Requirements

```hcl
# modules/lambda_function/versions.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"    # module declares what it needs
    }
  }
}
```

Without this, the module silently inherits whatever provider version the root has — which could be incompatible.

---

## Source References

- [Modules](https://developer.hashicorp.com/terraform/language/modules) — official docs
- [Module Sources](https://developer.hashicorp.com/terraform/language/modules/sources) — all source types
- [Module Composition](https://developer.hashicorp.com/terraform/language/modules/develop/composition) — patterns
- [Standard Module Structure](https://developer.hashicorp.com/terraform/language/modules/develop/structure) — conventions
- [Terraform Registry Modules](https://registry.terraform.io/browse/modules) — community modules
