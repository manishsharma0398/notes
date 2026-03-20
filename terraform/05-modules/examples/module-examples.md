# Chapter 05 — Modules — Examples

---

## Example 1 — Complete Reusable Lambda Module

```hcl
# modules/lambda_function/versions.tf
terraform {
  required_version = ">= 1.4"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.0" }
  }
}
```

```hcl
# modules/lambda_function/variables.tf
variable "function_name" {
  type        = string
  description = "Lambda function name"
}

variable "handler" {
  type    = string
  default = "handler.lambda_handler"
}

variable "runtime" {
  type    = string
  default = "python3.12"
}

variable "timeout" {
  type    = number
  default = 10
  validation {
    condition     = var.timeout >= 1 && var.timeout <= 900
    error_message = "Lambda timeout must be 1–900 seconds."
  }
}

variable "memory_size" {
  type    = number
  default = 128
}

variable "role_arn" {
  type        = string
  description = "IAM role ARN for the Lambda execution"
}

variable "source_path" {
  type        = string
  description = "Path to the Lambda deployment zip"
}

variable "environment_variables" {
  type    = map(string)
  default = {}
}

variable "tags" {
  type    = map(string)
  default = {}
}
```

```hcl
# modules/lambda_function/main.tf
resource "aws_lambda_function" "this" {
  function_name    = var.function_name
  role             = var.role_arn
  handler          = var.handler
  runtime          = var.runtime
  timeout          = var.timeout
  memory_size      = var.memory_size
  filename         = var.source_path
  source_code_hash = filebase64sha256(var.source_path)
  tags             = var.tags

  dynamic "environment" {
    for_each = length(var.environment_variables) > 0 ? [1] : []
    content {
      variables = var.environment_variables
    }
  }
}
```

```hcl
# modules/lambda_function/outputs.tf
output "function_name" { value = aws_lambda_function.this.function_name }
output "arn"           { value = aws_lambda_function.this.arn }
output "invoke_arn"    { value = aws_lambda_function.this.invoke_arn }
```

```hcl
# infra/main.tf — root module calling the module
module "presign_lambda" {
  source = "../modules/lambda_function"

  function_name         = "${local.prefix}-presign"
  role_arn              = aws_iam_role.lambda_exec.arn
  source_path           = "${path.root}/../lambda_payload.zip"
  tags                  = local.common_tags
  environment_variables = {
    BUCKET_NAME    = var.s3_upload_bucket
    ALLOWED_ORIGIN = join(",", var.allowed_origins)
  }
}

# Access module output — NOT module internals:
resource "aws_api_gateway_integration" "presign" {
  uri = module.presign_lambda.invoke_arn  # ← output name
  # uri = module.presign_lambda.aws_lambda_function.this.invoke_arn  ← ERROR: not allowed
}
```

---

## Example 2 — Module `for_each` — Multiple Lambdas from a Map

```hcl
locals {
  lambda_configs = {
    presign  = { timeout = 10, source_path = "../presign.zip",  env = { BUCKET_NAME = var.s3_upload_bucket } }
    metadata = { timeout = 5,  source_path = "../metadata.zip", env = { BUCKET_NAME = var.s3_upload_bucket } }
  }
}

module "lambda" {
  source   = "../modules/lambda_function"
  for_each = local.lambda_configs   # keys must be known at plan time

  function_name         = "${local.prefix}-${each.key}"
  timeout               = each.value.timeout
  role_arn              = aws_iam_role.lambda_exec.arn
  source_path           = each.value.source_path
  environment_variables = each.value.env
  tags                  = local.common_tags
}

# State addresses:
#   module.lambda["presign"].aws_lambda_function.this
#   module.lambda["metadata"].aws_lambda_function.this

# Collect all ARNs:
output "lambda_arns" {
  value = { for name, mod in module.lambda : name => mod.arn }
}
```

---

## Example 3 — Multi-Region Module via `providers` Map

```hcl
# Root module: multiple provider instances
provider "aws" {
  region = "ap-south-1"   # default — all resources use this
}

provider "aws" {
  alias  = "us_east"
  region = "us-east-1"   # ACM certs for CloudFront must be in us-east-1
}

# Pass the aliased provider explicitly to the module that needs it
module "cdn_cert" {
  source    = "../modules/acm_cert"
  providers = { aws = aws.us_east }   # the module's "aws" = root's "aws.us_east"
  domain    = "*.prasaarit.com"
}

# modules/acm_cert/versions.tf — no alias inside the module
# terraform {
#   required_providers {
#     aws = { source = "hashicorp/aws", version = ">= 5.0" }
#   }
# }
# The module uses "aws" — where it lands is determined by the caller via providers = {}
```

---

## Example 4 — Refactoring Into a Module With `moved`

```hcl
# ─── BEFORE: Lambda inline in root module ─────────────────────────────────────
resource "aws_lambda_function" "presign" {
  function_name = "prasaarit-stg-presign"
  role          = aws_iam_role.lambda_exec.arn
  # ...
}

# ─── AFTER refactoring: replace inline resource with module call ───────────────
module "presign_lambda" {
  source        = "../modules/lambda_function"
  function_name = "prasaarit-stg-presign"
  role_arn      = aws_iam_role.lambda_exec.arn
  # ...
}

# The moved block tells Terraform this is the same resource — no destroy + create
moved {
  from = aws_lambda_function.presign                      # old root address
  to   = module.presign_lambda.aws_lambda_function.this   # new module address
}

# terraform plan output:
#   aws_lambda_function.presign has moved to module.presign_lambda.aws_lambda_function.this
#   No changes. Infrastructure is up-to-date.
```
