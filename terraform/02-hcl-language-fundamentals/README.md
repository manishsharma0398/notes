# Chapter 02 — HCL Language Fundamentals

## Mental Model

HCL (HashiCorp Configuration Language) is Terraform's DSL. It is **not** a general-purpose programming language. Think of it as a **structured data format with expressions** — closer to JSON-with-superpowers than to Python or JavaScript.

The key insight:

> HCL describes **what you want**, not **how to build it**. Every block declares a piece of infrastructure. Terraform's engine (Chapter 01) figures out the execution order from the dependency graph — not from the order you write your blocks.

This means:
- **No imperative control flow** — no `if/then/else` branches that prevent resources from existing. You use `count = 0` or conditional expressions.
- **No loops that iterate "do this N times"** — you declare `count` or `for_each` on a resource and Terraform expands the graph.
- **Expressions are evaluated lazily** — during graph walk, not when the file is parsed. That's why `(known after apply)` exists.

---

## HCL File Structure

Every `.tf` file is made of **blocks**. Terraform reads ALL `.tf` files in a directory and merges them — file names and ordering are irrelevant.

```hcl
# Block types you'll use constantly:

# 1. Provider block — configures the cloud provider
provider "aws" {
  region = "ap-south-1"
}

# 2. Resource block — declares a piece of infrastructure
resource "aws_lambda_function" "presign" {
  function_name = "prasaarit-presign-stg"
  runtime       = "python3.12"
  handler       = "handler.lambda_handler"
  # ...
}

# 3. Variable block — declares an input parameter
variable "stage" {
  type    = string
  default = "stg"
}

# 4. Output block — exposes a value after apply
output "api_url" {
  value = aws_api_gateway_stage.stg.invoke_url
}

# 5. Locals block — defines computed constants
locals {
  prefix = "${var.project_name}-${var.stage}"
}

# 6. Data block — reads existing infrastructure (not managed by this config)
data "aws_caller_identity" "current" {}
```

---

## Variables — Input Parameters

Variables are how values are passed **into** your Terraform config from the outside. Think of them as function parameters.

### Declaring Variables

```hcl
# variables.tf

variable "project_name" {
  description = "Project name used as prefix for all resources"
  type        = string
  default     = "prasaarit"
}

variable "stage" {
  description = "Deployment stage"
  type        = string
  default     = "stg"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "ap-south-1"
}

# No default = REQUIRED. Terraform will prompt or error if not provided.
variable "s3_upload_bucket" {
  description = "Name of the S3 bucket for video uploads (managed externally)"
  type        = string
}

variable "allowed_origins" {
  description = "CORS origins allowed to call the API"
  type        = list(string)
  default     = ["*"]
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 10

  validation {
    condition     = var.lambda_timeout >= 1 && var.lambda_timeout <= 900
    error_message = "Lambda timeout must be between 1 and 900 seconds."
  }
}
```

### How Variables Are Set (Precedence Order)

Terraform resolves variable values in this order (last wins):

```
1. default value in variable block        ← lowest priority
2. terraform.tfvars file                  ← auto-loaded if present
3. *.auto.tfvars files                    ← auto-loaded, alphabetical
4. -var-file=custom.tfvars flag           ← explicit file
5. -var="stage=prod" CLI flag             ← command line
6. TF_VAR_stage environment variable      ← env var
                                          ← highest priority
```

**For your project**, the practical pattern:

```hcl
# terraform.tfvars (auto-loaded, NOT committed to git)
s3_upload_bucket = "prasaarit-uploads-stg"
stage            = "stg"
```

```bash
# .gitignore
*.tfvars      # Never commit tfvars — they often contain secrets or env-specific values
!*.auto.tfvars # Unless you want shared defaults
```

### Referencing Variables

Variables are referenced as `var.<name>`:

```hcl
resource "aws_lambda_function" "presign" {
  function_name = "${var.project_name}-presign-${var.stage}"
  timeout       = var.lambda_timeout
  # ...
}
```

### Variable Types — The Type System

HCL has a static type system. Every variable must declare a type. This isn't optional boilerplate — it prevents bugs.

```hcl
# Primitive types
type = string      # "hello"
type = number      # 42, 3.14
type = bool        # true, false

# Collection types
type = list(string)           # ["a", "b", "c"] — ordered, duplicates allowed
type = set(string)            # ["a", "b"] — unordered, no duplicates
type = map(string)            # { key1 = "val1", key2 = "val2" }

# Structural types
type = object({               # Fixed structure with named attributes
  name    = string
  timeout = number
  tags    = map(string)
})

type = tuple([string, number, bool])  # Fixed-length, mixed types — rarely used

# The escape hatch — avoid unless necessary
type = any                    # Disables type checking. Use object() instead.
```

**When types bite you:**

```hcl
variable "port" {
  type    = number
  default = "8080"    # ← This WORKS! HCL auto-converts string "8080" to number 8080.
                      #    But "eight" would fail. This implicit conversion hides bugs.
}

variable "tags" {
  type = map(string)
  default = {
    Name = "my-lambda"
    Env  = "stg"
    Cost = 42          # ← ERROR at plan time: number 42 is not string.
                       #    map(string) means ALL values must be strings.
  }
}
```

---

## Locals — Computed Constants

Locals are the equivalent of `const` definitions. They compute values from variables, other locals, or resource attributes. They exist to **avoid duplication** and **make config readable**.

```hcl
locals {
  prefix       = "${var.project_name}-${var.stage}"
  account_id   = data.aws_caller_identity.current.account_id
  lambda_name  = "${local.prefix}-presign"

  # Complex locals are fine
  common_tags = {
    Project     = var.project_name
    Stage       = var.stage
    ManagedBy   = "terraform"
  }

  # Conditional logic in locals
  is_production = var.stage == "prod"
  log_retention = local.is_production ? 90 : 14
}
```

### Variable vs Local — When to Use Which

| Use a **variable** when | Use a **local** when |
|------------------------|---------------------|
| The value comes from **outside** the config | The value is **computed from** other values |
| Different environments need different values | You want to **name a derived value** for readability |
| You want users to override it via tfvars/CLI | The value should **never** be overridden — it's a fact |
| Example: `s3_upload_bucket`, `stage`, `region` | Example: `prefix`, `common_tags`, `lambda_name` |

**Common mistake**: Using variables for values that should be locals.

```hcl
# BAD — a "variable" that nobody should ever change
variable "lambda_runtime" {
  default = "python3.12"
}

# GOOD — fixed fact about your deployment
locals {
  lambda_runtime = "python3.12"
}
```

---

## Expressions — String Interpolation, References, and Operators

### String Interpolation

```hcl
# Template syntax — embed expressions inside strings
name = "${var.project_name}-presign-${var.stage}"

# If the entire value IS the expression, skip the quotes:
timeout = var.lambda_timeout       # ✓ correct
timeout = "${var.lambda_timeout}"  # ✗ works but redundant — Terraform warns about this
```

### References to Other Resources

This is how the dependency graph gets built (Chapter 01). When you reference another resource's attribute, Terraform creates a "happens after" edge.

```hcl
resource "aws_iam_role" "lambda_exec" {
  name = "${local.prefix}-lambda-exec"
  # ...
}

resource "aws_lambda_function" "presign" {
  role = aws_iam_role.lambda_exec.arn
  #      ────────────────────────────
  #      │ resource type: aws_iam_role
  #      │ resource name: lambda_exec
  #      │ attribute: arn
  #      └── This creates a graph edge:
  #          Lambda DEPENDS ON IAM role
}
```

The reference pattern: `<resource_type>.<resource_name>.<attribute>`

Other reference patterns:
```hcl
var.stage                                  # variable
local.prefix                               # local
data.aws_caller_identity.current.account_id # data source
module.networking.vpc_id                   # module output
```

### Operators

```hcl
# Arithmetic
memory = 128 * 2      # 256

# Comparison (returns bool)
is_prod = var.stage == "prod"

# Logical
needs_alarm = var.stage == "prod" && var.enable_alarms

# Ternary conditional — this is HCL's only "if/else"
timeout = var.stage == "prod" ? 30 : 10
```

### Important: The Ternary Evaluates BOTH Sides

```hcl
# TRAP: Both sides are evaluated even if the condition is known at plan time
value = var.stage == "prod" ? var.prod_db_password : "dummy"
# ↑ If prod_db_password has no value (and no default), this ERRORS
#   even when stage is NOT "prod". Both expressions are evaluated
#   for type-checking, even though only one result is used.
```

---

## Conditionals — count and for_each

HCL has no `if` statement. Instead, you use `count` or `for_each` to **conditionally create resources**.

### count — The Simple On/Off Switch

```hcl
# Create this resource only in production
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  count = var.stage == "prod" ? 1 : 0       # 1 = create, 0 = skip

  alarm_name = "${local.prefix}-lambda-errors"
  # ...
}

# When count = 0, this resource does not exist at all.
# When count = 1, the resource address is:
#   aws_cloudwatch_metric_alarm.lambda_errors[0]   ← note the [0] index
```

**Why `count` is dangerous for lists:**

```hcl
# DON'T DO THIS for a list of items:
variable "methods" {
  default = ["GET", "POST", "DELETE"]
}

resource "aws_api_gateway_method" "method" {
  count       = length(var.methods)
  http_method = var.methods[count.index]
}

# This creates:
#   aws_api_gateway_method.method[0] → GET
#   aws_api_gateway_method.method[1] → POST
#   aws_api_gateway_method.method[2] → DELETE

# PROBLEM: If you remove "GET" from the list:
#   var.methods = ["POST", "DELETE"]
#   [0] → POST  (was GET → Terraform plans REPLACEMENT of [0])
#   [1] → DELETE (was POST → Terraform plans UPDATE of [1])
#   [2] → gone   (was DELETE → Terraform plans DESTROY of [2])
#
# You wanted to remove GET, but Terraform replaces POST and destroys DELETE.
# This is because count uses INDEX-BASED identity.
```

### for_each — The Safe Way to Create Multiple Resources

```hcl
# CORRECT: Use for_each for lists of things
variable "methods" {
  default = ["GET", "POST", "DELETE"]
}

resource "aws_api_gateway_method" "method" {
  for_each    = toset(var.methods)        # for_each requires a set or map
  http_method = each.value                 # each.value = the current item
}

# This creates:
#   aws_api_gateway_method.method["GET"]    → GET
#   aws_api_gateway_method.method["POST"]   → POST
#   aws_api_gateway_method.method["DELETE"] → DELETE
#
# Now remove "GET" from the list:
#   ["GET"] → destroyed (correct!)
#   ["POST"] → unchanged (correct!)
#   ["DELETE"] → unchanged (correct!)
#
# for_each uses KEY-BASED identity, not index-based.
```

### for_each with a Map

```hcl
# Define multiple Lambda functions from a map
variable "lambdas" {
  default = {
    presign = {
      handler = "handler.lambda_handler"
      timeout = 10
    }
    metadata = {
      handler = "handler.lambda_handler"
      timeout = 5
    }
  }
}

resource "aws_lambda_function" "fn" {
  for_each = var.lambdas

  function_name = "${local.prefix}-${each.key}"     # each.key = "presign" or "metadata"
  handler       = each.value.handler                  # each.value = the inner object
  timeout       = each.value.timeout
  # ...
}

# Creates:
#   aws_lambda_function.fn["presign"]  → prasaarit-stg-presign
#   aws_lambda_function.fn["metadata"] → prasaarit-stg-metadata
```

---

## The `for` Expression — Transforming Collections

The `for` expression transforms one collection into another. It's like `map()` and `filter()` in JavaScript.

```hcl
# Transform a list
locals {
  methods     = ["get", "post", "delete"]
  upper_methods = [for m in local.methods : upper(m)]
  # → ["GET", "POST", "DELETE"]
}

# Transform with filter
locals {
  numbers   = [1, 2, 3, 4, 5]
  even_only = [for n in local.numbers : n if n % 2 == 0]
  # → [2, 4]
}

# Transform a list into a map
locals {
  lambda_names = ["presign", "metadata", "delete"]
  lambda_arns  = { for name in local.lambda_names : name => "${local.prefix}-${name}" }
  # → { presign = "prasaarit-stg-presign", metadata = "prasaarit-stg-metadata", ... }
}
```

**Syntax rule:** `[ ]` brackets produce a list, `{ }` braces produce a map.

```hcl
[for item in list : transform(item)]                    # → list
{for item in list : key_expr => value_expr}             # → map
[for item in list : transform(item) if condition(item)] # → filtered list
```

---

## Built-in Functions

HCL has ~100 built-in functions. You'll use about 15 regularly. Here are the ones relevant to your project:

### String Functions

```hcl
# String manipulation
upper("hello")                    # "HELLO"
lower("HELLO")                    # "hello"
replace("hello-world", "-", "_") # "hello_world"
substr("hello", 0, 3)            # "hel"
join("-", ["prasaarit", "stg"])   # "prasaarit-stg"
split(",", "a,b,c")              # ["a", "b", "c"]
trimspace("  hello  ")           # "hello"
format("%s-%s-%s", var.project, var.stage, "presign")  # "prasaarit-stg-presign"
```

### Collection Functions

```hcl
# Length
length(["a", "b", "c"])           # 3
length({ a = 1, b = 2 })          # 2

# Lookup with default
lookup({ stg = "t3.micro", prod = "t3.medium" }, var.stage, "t3.micro")
# If stage = "stg" → "t3.micro". If stage = "unknown" → "t3.micro" (default)

# Merge maps (later values override earlier)
merge(local.common_tags, { Name = "special" })

# Flatten nested lists
flatten([["a", "b"], ["c", "d"]])  # ["a", "b", "c", "d"]

# Distinct — remove duplicates
distinct(["a", "b", "a"])         # ["a", "b"]

# Keys and values from a map
keys({ a = 1, b = 2 })           # ["a", "b"]
values({ a = 1, b = 2 })         # [1, 2]

# Contains
contains(["GET", "POST"], "GET")  # true
```

### Encoding Functions

```hcl
# JSON — critical for IAM policies
jsonencode({
  Version = "2012-10-17"
  Statement = [{
    Effect   = "Allow"
    Action   = "s3:PutObject"
    Resource = "arn:aws:s3:::${var.s3_upload_bucket}/*"
  }]
})

# Base64 encoding (used by Lambda)
base64encode("hello")             # "aGVsbG8="
filebase64sha256("lambda.zip")    # hash of file content — used for source_code_hash
```

### Filesystem Functions

```hcl
# Read a file — useful for IAM policies stored as JSON files
file("${path.module}/policies/lambda-policy.json")

# Hash a file — used to detect Lambda code changes
filebase64sha256("${path.module}/../lambda_payload.zip")

# path.module = directory of the current .tf file
# path.root   = directory where terraform was invoked
```

### Important: No User-Defined Functions

**HCL does not support user-defined functions.** You cannot write:

```hcl
# THIS DOES NOT EXIST IN HCL:
function make_arn(service, resource) {
  return "arn:aws:${service}:::${resource}"
}
```

If you find yourself repeating complex expressions, use **locals** to name them, or **modules** to encapsulate reusable patterns. This is a fundamental difference from general-purpose languages.

---

## Data Sources — Reading Existing Infrastructure

Data sources **read** information from the cloud without managing it. They're for referencing things that exist outside your Terraform config.

```hcl
# Get current AWS account ID and region
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Use them
locals {
  account_id = data.aws_caller_identity.current.account_id  # "123456789012"
  region     = data.aws_region.current.name                  # "ap-south-1"
}
```

**For your Prasaarit project — reading the externally-managed S3 bucket:**

```hcl
# Option A: Just pass the bucket name as a variable (simple, what we're doing)
variable "s3_upload_bucket" {
  type = string
}

# Option B: Use a data source to look up the actual bucket and get its ARN
data "aws_s3_bucket" "uploads" {
  bucket = var.s3_upload_bucket
}

# Now you can reference its ARN for IAM policies:
resource "aws_iam_role_policy" "lambda_s3" {
  role   = aws_iam_role.lambda_exec.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "s3:PutObject"
      Resource = "${data.aws_s3_bucket.uploads.arn}/*"
      #           ↑ data source gives you the real ARN
      #             instead of manually constructing it
    }]
  })
}
```

**Data source vs resource:**

| | Resource | Data Source |
|---|---------|------------|
| **Purpose** | Creates/manages infrastructure | Reads existing infrastructure |
| **Prefix** | `resource "aws_s3_bucket"` | `data "aws_s3_bucket"` |
| **In state?** | Yes — tracked and managed | Yes — cached, but not managed |
| **On destroy?** | Terraform destroys it | Terraform does nothing — it's not ours |
| **When to use** | You own it | Someone else owns it (console, another repo, another team) |

---

## Putting It All Together — Your Prasaarit Config Skeleton

Here's how all the concepts come together for your upload service:

```hcl
# ─── variables.tf ──────────────────────────────────────────────────

variable "project_name" {
  type    = string
  default = "prasaarit"
}

variable "stage" {
  type    = string
  default = "stg"
}

variable "s3_upload_bucket" {
  description = "S3 bucket for uploads (managed in core infra repo)"
  type        = string
  # No default — you MUST provide this
}

variable "allowed_origins" {
  type    = list(string)
  default = ["*"]
}

# ─── locals ──────────────────────────────────────────────────────

locals {
  prefix      = "${var.project_name}-${var.stage}"
  lambda_name = "${local.prefix}-presign"

  common_tags = {
    Project   = var.project_name
    Stage     = var.stage
    ManagedBy = "terraform"
  }
}

# ─── data sources ────────────────────────────────────────────────

data "aws_caller_identity" "current" {}

data "aws_s3_bucket" "uploads" {
  bucket = var.s3_upload_bucket
}

# ─── resources (simplified) ─────────────────────────────────────

resource "aws_iam_role" "lambda_exec" {
  name = "${local.prefix}-lambda-exec"
  tags = local.common_tags                 # ← reusing locals

  assume_role_policy = jsonencode({        # ← jsonencode function
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_lambda_function" "presign" {
  function_name    = local.lambda_name     # ← local reference
  role             = aws_iam_role.lambda_exec.arn  # ← resource reference → graph edge
  runtime          = "python3.12"
  handler          = "handler.lambda_handler"
  filename         = "${path.module}/../lambda_payload.zip"
  source_code_hash = filebase64sha256("${path.module}/../lambda_payload.zip")
  timeout          = 10
  memory_size      = 128
  tags             = local.common_tags

  environment {
    variables = {
      BUCKET_NAME    = var.s3_upload_bucket   # ← variable reference
      ALLOWED_ORIGIN = join(",", var.allowed_origins)  # ← function
    }
  }
}

# ─── outputs ─────────────────────────────────────────────────────

output "lambda_function_name" {
  value = aws_lambda_function.presign.function_name
}

output "lambda_arn" {
  value = aws_lambda_function.presign.arn
}
```

---

## What HCL Guarantees

| Guarantee | Details |
|-----------|---------|
| **Type safety** | Variable type mismatches are caught at `plan` time, not at apply |
| **Reference tracking** | Every `resource.name.attr` reference creates a dependency edge automatically |
| **File-order independence** | You can split config across any number of `.tf` files — order doesn't matter |
| **Idempotent evaluation** | Same inputs → same plan, always |

## What HCL Does NOT Guarantee

| Non-guarantee | Why it matters |
|--------------|----------------|
| **No null safety** | Referencing an attribute that doesn't exist on a resource → runtime error during plan, not a compile error |
| **No user-defined functions** | You can't abstract repeated expressions. Use locals or modules instead. |
| **Ternary evaluates both sides** | Both branches are type-checked. If one branch references a missing variable, it errors even if that branch isn't selected. |
| **`for_each` keys must be known at plan time** | You can't use `for_each` with a key that is `(known after apply)`. This forces certain ordering in your config. |

---

## Source References

- [HCL Language Specification](https://github.com/hashicorp/hcl/blob/main/hclsyntax/spec.md) — the formal grammar
- [Terraform Variables](https://developer.hashicorp.com/terraform/language/values/variables) — official docs
- [Terraform Functions](https://developer.hashicorp.com/terraform/language/functions) — complete function reference
- [Terraform Expressions](https://developer.hashicorp.com/terraform/language/expressions) — operators, conditionals, for expressions
