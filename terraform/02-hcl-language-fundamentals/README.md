# Chapter 02 — HCL Language Fundamentals

## Mental Model

HCL (HashiCorp Configuration Language) is Terraform's DSL. It is **not** a general-purpose programming language — think of it as a **structured data format with expressions**: closer to JSON-with-computation than to Python or JavaScript.

The key insight:

> HCL describes **what you want**, not **how to build it**. Every block declares a piece of desired state. Terraform's engine (Chapter 01) determines the execution order from the dependency graph — never from the order you write your blocks.

Three constraints flow from this:

- **No imperative control flow** — there is no `if/else` that prevents a resource from existing. You use `count = 0` or conditional `for_each` to make resources optional.
- **No user-defined functions** — you cannot abstract repeated expressions into named functions. Use `locals` for naming, `modules` for encapsulation.
- **Expressions are evaluated during graph walk, not at parse time** — that's why `(known after apply)` exists. An attribute that depends on another resource's output cannot be resolved until that resource is created.

---

## HCL File Structure

Terraform reads **all** `.tf` files in the current directory and merges them. File names, numbers, and ordering are irrelevant. You can split your config across as many files as you want.

```hcl
# Block types you'll use constantly:

# 1. terraform — backend config, required providers, version constraints
terraform {
  required_version = ">= 1.9"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

# 2. provider — configures the cloud provider
provider "aws" {
  region = "ap-south-1"
}

# 3. variable — declares an input parameter (from tfvars, CLI, env)
variable "stage" {
  type    = string
  default = "stg"
}

# 4. locals — computed constants (derived from variables, other locals, resources)
locals {
  prefix = "${var.project_name}-${var.stage}"
}

# 5. data — reads existing infrastructure without managing it
data "aws_caller_identity" "current" {}

# 6. resource — declares a piece of infrastructure to create/manage
resource "aws_lambda_function" "presign" {
  function_name = "${local.prefix}-presign"
  # ...
}

# 7. output — exposes a value after apply (used by other stacks or humans)
output "api_url" {
  value = aws_api_gateway_stage.stg.invoke_url
}
```

---

## Variables — Input Parameters

Variables are how values flow **into** your config from the outside. Think of them as function parameters that differ per environment.

### Declaring Variables

```hcl
# variables.tf

variable "project_name" {
  description = "Project name, used as prefix for all resources"
  type        = string
  default     = "prasaarit"
}

variable "stage" {
  description = "Deployment stage"
  type        = string
  default     = "stg"

  validation {
    condition     = contains(["stg", "prod"], var.stage)
    error_message = "stage must be 'stg' or 'prod'."
  }
}

# No default = REQUIRED. Terraform will error at plan time if not provided.
variable "s3_upload_bucket" {
  description = "S3 bucket name for uploads (managed by the core infra repo)"
  type        = string
}

variable "lambda_timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 10

  validation {
    condition     = var.lambda_timeout >= 1 && var.lambda_timeout <= 900
    error_message = "Lambda timeout must be between 1 and 900 seconds."
  }
}

variable "allowed_origins" {
  description = "CORS origins allowed to call the API"
  type        = list(string)
  default     = ["*"]
}
```

### Variable Precedence (Last Wins)

```
1. default value in variable block        ← lowest priority
2. terraform.tfvars file                  ← auto-loaded if present
3. *.auto.tfvars files                    ← auto-loaded, alphabetical order
4. -var-file=custom.tfvars flag           ← explicit file on CLI
5. -var="stage=prod" CLI flag             ← inline CLI
6. TF_VAR_stage environment variable      ← highest priority
```

The practical pattern for your project:

```hcl
# terraform.tfvars — auto-loaded, NOT committed to git
s3_upload_bucket = "prasaarit-uploads-stg"
stage            = "stg"
```

```bash
# .gitignore
*.tfvars        # never commit — they often contain env-specific values or secrets
```

### The Type System

Every variable should declare a type. This is not optional boilerplate — it catches misconfigurations at `terraform plan`, not at `terraform apply` when AWS rejects the request.

```hcl
# Primitive types
type = string      # "hello"
type = number      # 42, 3.14
type = bool        # true, false

# Collection types
type = list(string)    # ["a", "b", "c"] — ordered, duplicates allowed, indexed by number
type = set(string)     # {"a", "b"} — unordered, no duplicates
type = map(string)     # { key1 = "val1", key2 = "val2" } — indexed by string key

# Structural types — specify the exact shape of a complex value
type = object({
  handler = string
  timeout = number
  tags    = map(string)
})

type = tuple([string, number, bool])  # fixed-length, mixed types — rarely needed

# The escape hatch — avoid unless you're writing a module that must accept any type
type = any    # disables type checking entirely; callers get no validation

# optional() fields in objects — available since v1.3
type = object({
  timeout    = number
  memory     = optional(number, 128)    # default used if caller omits the key
  log_level  = optional(string, "INFO")
})
```

**Common type pitfalls:**

```hcl
variable "port" {
  type    = number
  default = "8080"    # WORKS — HCL auto-converts "8080" → 8080.
                      # But "eight" would fail. Implicit conversion hides intent.
}

variable "tags" {
  type = map(string)
  default = {
    Name = "my-lambda"
    Env  = "stg"
    Cost = 42          # ERROR at plan: 42 is number, map(string) requires string values.
  }
}
```

---

## Locals — Computed Constants

Locals are `const` definitions for your config: they compute values from variables, other locals, or even resource attributes. They exist to avoid duplication and to give readable names to derived values.

```hcl
locals {
  prefix      = "${var.project_name}-${var.stage}"
  lambda_name = "${local.prefix}-presign"
  is_prod     = var.stage == "prod"

  # Computed from other locals — fine to chain
  log_retention_days = local.is_prod ? 90 : 14

  # Computed from a data source attribute
  account_id = data.aws_caller_identity.current.account_id

  # Shared tags — defined once, referenced everywhere
  common_tags = {
    Project   = var.project_name
    Stage     = var.stage
    ManagedBy = "terraform"
  }
}
```

### Variable vs Local — The Decision Rule

| Use a **variable** when... | Use a **local** when... |
|---|---|
| The value comes from **outside** the config (caller provides it) | The value is **derived** from other values inside the config |
| Different environments or teams will provide different values | The value should **never** be overridden — it's an internal fact |
| You want operator control: tfvars, CLI, env vars | You want to **name a derived expression** for readability |
| Example: `s3_upload_bucket`, `stage`, `region` | Example: `prefix`, `common_tags`, `lambda_name`, `is_prod` |

**The most common mistake**: exposing as a variable something that should never change:

```hcl
# BAD — invites misconfiguration, adds surface area
variable "lambda_runtime" {
  default = "python3.12"
}

# GOOD — it's a fact about your deployment, not a knob
locals {
  lambda_runtime = "python3.12"
}
```

---

## Expressions — References, Interpolation, and Operators

### String Interpolation

```hcl
# Embed any expression inside a string with ${}
name = "${var.project_name}-presign-${var.stage}"

# When the ENTIRE value is an expression, skip the quotes — don't wrap in strings
timeout = var.lambda_timeout         # ✓ correct
timeout = "${var.lambda_timeout}"    # ✗ works but Terraform warns: unnecessary interpolation
```

### References — How the Dependency Graph Gets Built

Every reference to another resource's attribute creates an implicit edge in the dependency graph. This is how Terraform knows execution order without you writing `depends_on`.

```hcl
resource "aws_iam_role" "lambda_exec" {
  name = "${local.prefix}-lambda-exec"
  # ...
}

resource "aws_lambda_function" "presign" {
  role = aws_iam_role.lambda_exec.arn
  #      ══════════════════════════════
  #      type: aws_iam_role
  #      name: lambda_exec
  #      attr: arn
  #      └→ creates a graph edge: Lambda WAITS for IAM role (see Chapter 01)
}
```

Reference patterns:

```hcl
var.stage                                    # input variable
local.prefix                                 # local value
aws_iam_role.lambda_exec.arn                 # resource attribute
data.aws_caller_identity.current.account_id  # data source attribute
module.networking.vpc_id                     # output from a child module
```

### Operators and Ternary Conditional

```hcl
# Arithmetic
memory = 128 * 2           # 256

# Comparison → bool
is_prod = var.stage == "prod"

# Logical
needs_alarm = var.stage == "prod" && var.enable_alarms

# Ternary — HCL's only branching construct
timeout = var.stage == "prod" ? 30 : 10
```

**Critical trap — the ternary type-checks BOTH branches:**

```hcl
# Even when stage = "stg", this ERRORS if prod_db_password has no value.
# Both branch expressions are evaluated for type-checking regardless of which
# branch is actually selected.
value = var.stage == "prod" ? var.prod_db_password : "dummy"

# Fix: give the variable a default, or use try()
value = var.stage == "prod" ? try(var.prod_db_password, "") : "dummy"
```

Both branches must also return the **same type**:

```hcl
value = var.enabled ? 42 : "none"      # ERROR: number vs string
value = var.enabled ? 42 : null        # OK: null is compatible with any type
```

---

## count and for_each — Creating Multiple Resources

HCL has no `if` statement. Conditional and repeated resource creation is done via `count` and `for_each`.

### count — Boolean On/Off Switch

```hcl
# Create only in production
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  count = var.stage == "prod" ? 1 : 0   # 1 = create, 0 = skip

  alarm_name = "${local.prefix}-lambda-errors"
  # ...
}

# When count = 1, the resource address includes the index:
#   aws_cloudwatch_metric_alarm.lambda_errors[0]
```

**Why `count` is dangerous for lists:**

```hcl
variable "methods" {
  default = ["/upload", "/metadata", "/delete"]
}

resource "aws_api_gateway_resource" "route" {
  count     = length(var.methods)
  path_part = var.methods[count.index]
}
# Creates:
#   route[0] = "/upload"
#   route[1] = "/metadata"
#   route[2] = "/delete"
#
# Now remove "/upload" → var.methods = ["/metadata", "/delete"]
#   route[0] was "/upload", should be "/metadata" → REPLACE (destroy + recreate)
#   route[1] was "/metadata", should be "/delete" → UPDATE
#   route[2] was "/delete", now gone → DESTROY
#
# You wanted to remove one route. Terraform replaces two and destroys one.
# This is the index-shift problem — count uses position, not identity.
```

### for_each — Identity by Key

```hcl
resource "aws_api_gateway_resource" "route" {
  for_each  = toset(var.methods)    # for_each requires a set or map
  path_part = each.value            # each.value = current item, each.key = same for sets
}
# Creates:
#   route["/upload"]   → /upload
#   route["/metadata"] → /metadata
#   route["/delete"]   → /delete
#
# Remove "/upload" → only route["/upload"] is destroyed.
# "/metadata" and "/delete" are untouched. Key-based identity.
```

**for_each with a map** — when each instance needs different configuration:

```hcl
variable "lambdas" {
  default = {
    presign  = { handler = "handler.presign_handler",  timeout = 10 }
    metadata = { handler = "handler.metadata_handler", timeout = 5  }
  }
}

resource "aws_lambda_function" "fn" {
  for_each = var.lambdas

  function_name = "${local.prefix}-${each.key}"   # each.key = "presign" or "metadata"
  handler       = each.value.handler               # each.value = the inner object
  timeout       = each.value.timeout
  # ...
}
# Creates:
#   aws_lambda_function.fn["presign"]  → prasaarit-stg-presign
#   aws_lambda_function.fn["metadata"] → prasaarit-stg-metadata
```

**The `for_each` keys-must-be-known-at-plan-time constraint:**

```hcl
# This FAILS during terraform plan:
resource "aws_api_gateway_resource" "route" {
  for_each  = toset(aws_api_gateway_rest_api.api.endpoint_configuration[*].types)
  #                 ↑ This attribute is (known after apply) — graph cannot be built
}
# Error: The "for_each" value depends on resource attributes that cannot be
# determined until apply, so Terraform cannot predict how many instances will be created.

# Fix: always derive for_each keys from variables or locals, not resource outputs.
```

**Rule**: Use `count` only for boolean on/off (`count = cond ? 1 : 0`). Use `for_each` for everything else.

---

## The `for` Expression — Transforming Collections

The `for` expression transforms one collection into another. It's HCL's equivalent of `map()` and `filter()` in JavaScript.

```hcl
locals {
  methods       = ["get", "post", "delete"]
  lambda_names  = ["presign", "metadata", "delete"]

  # List → list transform
  upper_methods = [for m in local.methods : upper(m)]
  # → ["GET", "POST", "DELETE"]

  # List → list with filter
  long_methods = [for m in local.methods : m if length(m) > 4]
  # → ["delete"]

  # List → map
  lambda_full_names = { for name in local.lambda_names : name => "${local.prefix}-${name}" }
  # → { presign = "prasaarit-stg-presign", metadata = "prasaarit-stg-metadata", ... }

  # Map → map (iterate both key and value)
  lambda_configs = {
    presign  = { timeout = 10, memory = 128 }
    metadata = { timeout = 5,  memory = 128 }
    delete   = { timeout = 15, memory = 256 }
  }

  # Filter map: only high-memory functions
  heavy_lambdas = {
    for name, cfg in local.lambda_configs :
    name => cfg
    if cfg.memory > 128
  }
  # → { delete = { timeout = 15, memory = 256 } }
}
```

**Syntax reference:**

```hcl
[for item in collection : transform(item)]              # → list
[for item in collection : transform(item) if cond]      # → filtered list
{for k, v in map : new_key => new_val}                  # → map
{for k, v in map : new_key => new_val if cond}          # → filtered map
```

`[ ]` produces a list; `{ }` produces a map. The `if` clause is a filter, not a branch.

---

## `dynamic` Blocks — Programmatic Nested Blocks

Some resources have **repeatable nested blocks** — `ingress` rules in `aws_security_group`, `cors_rule` in `aws_s3_bucket`. When you need a variable number, hardcoding each is impractical. `dynamic` blocks let you generate them programmatically.

> A `dynamic` block is a `for_each` loop that emits **nested blocks**, not resources. It only works inside `resource`, `data`, or `provider` blocks.

### Syntax

```hcl
dynamic "<block_type>" {
  for_each = <set or map>
  iterator = <optional rename>   # defaults to the block_type name

  content {
    # Access the current item via: <block_type>.value (or <iterator>.value)
    # Access the current key via:  <block_type>.key
  }
}
```

### Example — Variable Security Group Rules

```hcl
# Without dynamic: you'd hardcode one ingress {} per port. Unmaintainable for 10+ rules.
# With dynamic: the caller passes a map, the block expands automatically.

variable "ingress_rules" {
  type = map(object({
    port     = number
    protocol = string
    cidrs    = list(string)
  }))
  default = {
    http  = { port = 80,   protocol = "tcp", cidrs = ["0.0.0.0/0"] }
    https = { port = 443,  protocol = "tcp", cidrs = ["0.0.0.0/0"] }
    admin = { port = 8443, protocol = "tcp", cidrs = ["10.0.0.0/8"] }
  }
}

resource "aws_security_group" "api" {
  name   = "${local.prefix}-api-sg"
  vpc_id = var.vpc_id

  dynamic "ingress" {
    for_each = var.ingress_rules
    iterator = rule               # rename from "ingress" → "rule" for readability

    content {
      from_port   = rule.value.port
      to_port     = rule.value.port
      protocol    = rule.value.protocol
      cidr_blocks = rule.value.cidrs
      description = "Allow ${rule.key}"
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

### When `dynamic` Blocks Obscure Intent

`dynamic` is powerful, but it costs readability:

- A reader must mentally expand the block to understand what rules exist. Explicit blocks self-document the security posture.
- When `terraform plan` shows a change to an ingress rule, it shows the key — but if the rule objects are complex, tracing which rule changed is harder.
- If some rules need `prefix_list_ids` while others need `cidr_blocks`, cramming them into one `dynamic` block creates objects full of nullable fields.

**Rule**: Use `dynamic` when 3+ identical-shaped nested blocks are driven by a variable. For 2 or fewer, write explicit blocks — less abstraction, same result, easier to read.

**Critical**: `for_each` inside a `dynamic` block has the same constraint as on a resource — keys must be **known at plan time**. If the collection comes from a computed resource attribute, the plan fails.

**What `dynamic` cannot do**: generate top-level `resource {}` or `module {}` blocks. For that, use `for_each` on the resource/module itself.

---

## Built-in Functions

HCL has ~100 built-in functions. You cannot define your own — use `locals` to name repeated expressions and `modules` to encapsulate patterns. Here are the ones you'll use constantly:

### String Functions

```hcl
upper("hello")                             # "HELLO"
lower("HELLO")                             # "hello"
replace("hello-world", "-", "_")           # "hello_world"
substr("hello", 0, 3)                      # "hel"
join("-", ["prasaarit", "stg", "presign"]) # "prasaarit-stg-presign"
split(",", "a,b,c")                        # ["a", "b", "c"]
trimspace("  hello  ")                     # "hello"
format("%s-%s-%s", var.project, var.stage, "presign")  # "prasaarit-stg-presign"

# templatefile — render a file template with variable substitution
# Use for pre-existing JSON policy templates a security team maintains separately
templatefile("${path.module}/templates/policy.json.tpl", {
  bucket_arn = aws_s3_bucket.uploads.arn
  account_id = data.aws_caller_identity.current.account_id
})
```

### Collection Functions

```hcl
length(["a", "b", "c"])                        # 3
length({ a = 1, b = 2 })                       # 2

# Lookup a map key with a default (safe alternative to direct key access)
lookup({ stg = "t3.micro", prod = "t3.large" }, var.stage, "t3.micro")

merge(local.common_tags, { Name = "special" })   # later map values override earlier

flatten([["a", "b"], ["c", "d"]])                # ["a", "b", "c", "d"]
distinct(["a", "b", "a"])                        # ["a", "b"]

keys({ a = 1, b = 2 })                           # ["a", "b"]
values({ a = 1, b = 2 })                         # [1, 2]
contains(["GET", "POST"], "GET")                 # true
```

### Encoding Functions

```hcl
# jsonencode — the right way to write IAM policies in HCL
# Type-safe, properly escaped, plan diffs show attribute-level changes
jsonencode({
  Version = "2012-10-17"
  Statement = [{
    Effect   = "Allow"
    Action   = ["s3:PutObject"]
    Resource = "arn:aws:s3:::${var.s3_upload_bucket}/*"
  }]
})

# base64encode / filebase64
base64encode("hello")                       # "aGVsbG8="
filebase64sha256("lambda_payload.zip")      # SHA256 hash — used for source_code_hash
```

> **`jsonencode` vs `templatefile` for IAM policies**: Use `jsonencode` when constructing policies directly in HCL (type-safe, IDE-supported, plan diffs are precise). Use `templatefile` only for pre-existing JSON templates maintained by another team.

### Filesystem Functions

```hcl
file("${path.module}/policies/lambda.json")          # read file contents as string
filebase64sha256("${path.module}/../lambda.zip")     # hash for detecting code changes

# path references
path.module    # absolute path to the directory of the current .tf file
path.root      # absolute path to the directory where terraform was invoked
path.cwd       # current working directory
```

### CIDR Math Functions

Essential for VPC networking:

```hcl
# cidrsubnet(prefix, newbits, netnum)
#   prefix  = parent CIDR block   ("10.0.0.0/16")
#   newbits = bits to add to mask  (8 turns /16 into /24)
#   netnum  = which subnet number  (0 = first, 1 = second, ...)

locals {
  vpc_cidr = "10.0.0.0/16"

  public_subnets = [
    cidrsubnet(local.vpc_cidr, 8, 0),    # → "10.0.0.0/24"
    cidrsubnet(local.vpc_cidr, 8, 1),    # → "10.0.1.0/24"
    cidrsubnet(local.vpc_cidr, 8, 2),    # → "10.0.2.0/24"
  ]

  private_subnets = [
    cidrsubnet(local.vpc_cidr, 8, 10),   # → "10.0.10.0/24"
    cidrsubnet(local.vpc_cidr, 8, 11),   # → "10.0.11.0/24"
    cidrsubnet(local.vpc_cidr, 8, 12),   # → "10.0.12.0/24"
  ]
}

cidrhost("10.0.1.0/24", 4)    # → "10.0.1.4" — specific host in a subnet
cidrhost("10.0.1.0/24", -2)   # → "10.0.1.254" — negative = count from end
```

### Type Conversion and Safety Functions

```hcl
# Explicit conversion — prefer explicit over implicit
tostring(42)                 # "42"
tonumber("42")               # 42
tobool("true")               # true
toset(["b", "a", "b"])       # {"a", "b"} — removes duplicates, unordered
tolist(toset(["b","a"]))     # ["a", "b"] — sorted when converting set → list

# try() — evaluate an expression; return fallback on any error
# Essential for accessing attributes that may not exist
try(var.config.optional_field, "default")

# can() — returns true if expression succeeds, false otherwise
can(var.config.optional_field)  # true = exists and valid, false = would error
```

`try()` is especially useful with `optional()` object fields in modules:

```hcl
variable "lambda_config" {
  type = object({
    timeout = number
    memory  = optional(number, 128)     # optional with default, since v1.3
  })
}

# Older pattern before optional() existed:
locals {
  memory = try(var.lambda_config.memory, 128)
}
```

---

## Data Sources — Reading Existing Infrastructure

Data sources **read** from the cloud without managing anything. Use them for infrastructure owned by another team, another Terraform config, or AWS itself.

```hcl
# AWS-provided data — no arguments needed
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id  # "123456789012"
  region     = data.aws_region.current.name                  # "ap-south-1"
}
```

**For your Prasaarit project — using the externally-managed S3 bucket:**

```hcl
# The bucket is managed in a different repo (core infra). Don't recreate it here.
# Use a data source to get its actual ARN for the IAM policy.
data "aws_s3_bucket" "uploads" {
  bucket = var.s3_upload_bucket
}

resource "aws_iam_role_policy" "lambda_s3" {
  role   = aws_iam_role.lambda_exec.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject"]
      Resource = "${data.aws_s3_bucket.uploads.arn}/*"
      #           ↑ real ARN from the data source, no manual construction
    }]
  })
}
```

**Resource vs Data Source:**

| | `resource` | `data` |
|---|---|---|
| Purpose | Create and manage | Read-only lookup |
| Declaration | `resource "aws_s3_bucket" "b"` | `data "aws_s3_bucket" "b"` |
| Tracked in state? | Yes — Terraform owns it | Yes — cached, but not owned |
| On `terraform destroy` | Destroyed | Untouched |
| When to use | You own it | Another team/config owns it |

Data sources are **refreshed at every `plan`** — they call the cloud API to get current values. They do NOT create, update, or delete anything.

---

## `terraform_data` — State Storage Without a Cloud Resource

### The Problem

Sometimes you need to:
1. Store a computed value in state so other resources can reference it
2. Trigger a replacement (re-run a provisioner) when an external value changes
3. Run local logic on apply without a real cloud resource

Historically, `null_resource` from the `hashicorp/null` provider handled this. Since v1.4, `terraform_data` is the built-in replacement — no external provider needed.

### Basic Usage

```hcl
# Store an arbitrary value in state
resource "terraform_data" "deployment_marker" {
  input = {
    version  = "1.2.3"
    stage    = var.stage
  }
}

# Read it back from state
output "deployment_marker" {
  value = terraform_data.deployment_marker.output   # same structure as input
}
```

### Triggering Re-Execution When a File Changes

```hcl
# Track the Lambda zip hash in state
resource "terraform_data" "lambda_hash" {
  input = filebase64sha256("${path.module}/../lambda_payload.zip")
}

# Re-run this whenever the zip changes
resource "terraform_data" "post_deploy" {
  triggers_replace = [terraform_data.lambda_hash.output]

  provisioner "local-exec" {
    command = "echo 'Lambda zip changed — hash: ${terraform_data.lambda_hash.output}'"
  }
}
```

When `lambda_payload.zip` changes:
1. `terraform_data.lambda_hash` computes a new hash → its `input` changed → resource is **replaced** → new `output`
2. `terraform_data.post_deploy` sees `triggers_replace` changed → it is **replaced** → `local-exec` runs

### `terraform_data` vs `null_resource`

| | `null_resource` | `terraform_data` |
|---|---|---|
| Provider required? | Yes — `hashicorp/null` in `required_providers` | No — built into Terraform Core |
| Available since | Very old | v1.4+ |
| Triggers | `triggers = { key = string }` — string map only | `triggers_replace = [any_expressions]` |
| Value storage | Cannot store value in state | `input` → state → `output` |
| Migration | Remove `hashicorp/null` from required_providers; `terraform state mv` to preserve existing resource |

```hcl
# OLD:
resource "null_resource" "trigger" {
  triggers = { hash = filebase64sha256("script.sh") }
  provisioner "local-exec" { command = "bash script.sh" }
}

# NEW:
resource "terraform_data" "trigger" {
  triggers_replace = [filebase64sha256("script.sh")]
  provisioner "local-exec" { command = "bash script.sh" }
}
```

> **Not the same as ephemeral resources** (v1.10): `terraform_data` values **are** written to state and persist between runs. Ephemeral resources are re-evaluated every plan/apply and never written to state. Use ephemeral resources for short-lived secrets. Use `terraform_data` for trigger logic and value storage.

---

## Guarantees and Failure Modes

### What HCL Guarantees

| Guarantee | Detail |
|---|---|
| **Type safety at plan time** | Type mismatches in variables and locals are caught during `terraform plan`, not `apply` |
| **Reference tracking** | Every `resource.name.attr` creates a dependency edge automatically |
| **File-order independence** | Config can be split across any number of `.tf` files; order never matters |
| **Idempotent evaluation** | Same inputs always produce the same plan |

### What HCL Does NOT Guarantee

| Non-guarantee | Why it matters |
|---|---|
| **No null safety** | Referencing a non-existent attribute is a runtime error during plan, not a parse error. Use `try()` defensively. |
| **Ternary evaluates both branches** | Both sides are type-checked. A missing variable on the unselected branch still errors. |
| **`for_each` keys must be known** | You cannot use computed resource outputs as `for_each` keys — the plan fails. Always derive keys from variables or locals. |
| **No user-defined functions** | Repeated expressions must be named with `locals` or encapsulated in `modules`. |
| **`dynamic` block keys must be known** | Same constraint as `for_each` on a resource — applies to nested block generation too. |

---

## Source References

- [HCL Language Specification](https://github.com/hashicorp/hcl/blob/main/hclsyntax/spec.md) — the formal grammar
- [Terraform Input Variables](https://developer.hashicorp.com/terraform/language/values/variables) — variables, validation, types
- [Terraform Expressions](https://developer.hashicorp.com/terraform/language/expressions) — references, operators, for expressions
- [Terraform Functions](https://developer.hashicorp.com/terraform/language/functions) — complete built-in function reference
- [dynamic Blocks](https://developer.hashicorp.com/terraform/language/expressions/dynamic-blocks) — official docs
- [terraform_data resource](https://developer.hashicorp.com/terraform/language/resources/terraform-data) — built-in resource reference
