# Modules — Examples

## Example 1: Complete Reusable Lambda Module

This is the module you'd use for your Prasaarit project — it creates a Lambda with its permission for API Gateway invocation.

### Module Files

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
}

variable "memory_size" {
  type    = number
  default = 128
}

variable "role_arn" {
  type        = string
  description = "IAM role ARN for the Lambda"
}

variable "source_path" {
  type        = string
  description = "Path to the Lambda zip file"
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

output "function_name" {
  value = aws_lambda_function.this.function_name
}

output "arn" {
  value = aws_lambda_function.this.arn
}

output "invoke_arn" {
  value = aws_lambda_function.this.invoke_arn
}

output "qualified_arn" {
  value = aws_lambda_function.this.qualified_arn
}
```

### Calling the Module

```hcl
# infra/main.tf — root module

module "presign_lambda" {
  source = "../modules/lambda_function"

  function_name = "${local.prefix}-presign"
  role_arn      = aws_iam_role.lambda_exec.arn
  source_path   = "${path.root}/../lambda_payload.zip"
  tags          = local.common_tags

  environment_variables = {
    BUCKET_NAME    = var.s3_upload_bucket
    ALLOWED_ORIGIN = join(",", var.allowed_origins)
  }
}

# Use the output to wire up API Gateway
resource "aws_api_gateway_integration" "presign" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.presign.id
  http_method             = aws_api_gateway_method.presign_post.http_method
  type                    = "AWS_PROXY"
  integration_http_method = "POST"
  uri                     = module.presign_lambda.invoke_arn
  #                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  #                         Module output — not internal resource
}
```

---

## Example 2: Module `for_each` — Multiple Lambdas From a Map

```hcl
# infra/lambdas.tf

locals {
  lambda_configs = {
    presign = {
      handler = "handler.lambda_handler"
      timeout = 10
      env_vars = {
        BUCKET_NAME    = var.s3_upload_bucket
        ALLOWED_ORIGIN = "*"
      }
      source_path = "${path.root}/../presign_payload.zip"
    }
    metadata = {
      handler = "handler.lambda_handler"
      timeout = 5
      env_vars = {
        BUCKET_NAME = var.s3_upload_bucket
      }
      source_path = "${path.root}/../metadata_payload.zip"
    }
  }
}

module "lambda" {
  source   = "../modules/lambda_function"
  for_each = local.lambda_configs

  function_name         = "${local.prefix}-${each.key}"
  handler               = each.value.handler
  timeout               = each.value.timeout
  role_arn              = aws_iam_role.lambda_exec.arn
  source_path           = each.value.source_path
  environment_variables = each.value.env_vars
  tags                  = local.common_tags
}

# State addresses:
#   module.lambda["presign"].aws_lambda_function.this
#   module.lambda["metadata"].aws_lambda_function.this

# Output all ARNs as a map:
output "lambda_arns" {
  value = { for name, mod in module.lambda : name => mod.arn }
  # → { presign = "arn:...", metadata = "arn:..." }
}
```

---

## Example 3: Refactoring Into a Module With `moved`

```hcl
# BEFORE: Lambda defined inline in root module
resource "aws_lambda_function" "presign" {
  function_name = "prasaarit-stg-presign"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "handler.lambda_handler"
  runtime       = "python3.12"
  # ...
}

# STEP 1: Create the module (modules/lambda_function/...)
# STEP 2: Replace inline resource with module call
module "presign_lambda" {
  source        = "../modules/lambda_function"
  function_name = "prasaarit-stg-presign"
  role_arn      = aws_iam_role.lambda_exec.arn
  # ...
}

# STEP 3: Add moved block (the resource inside the module is named "this")
moved {
  from = aws_lambda_function.presign
  to   = module.presign_lambda.aws_lambda_function.this
}

# STEP 4: terraform plan → shows "has moved", no destroy/create
# STEP 5: terraform apply → state address updated
# STEP 6: (optional) remove the moved block after all environments have applied
```
