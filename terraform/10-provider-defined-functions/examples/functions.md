# Chapter 10 — Provider-Defined Functions — Examples

## Example 1: ARN Parsing — Before and After

```hcl
# ── BEFORE v1.8 (fragile index-based splitting) ────────────────────────────

locals {
  lambda_arn = aws_lambda_function.app.arn
  # "arn:aws:lambda:ap-south-1:123456789012:function:my-func"

  arn_parts  = split(":", local.lambda_arn)
  # ["arn", "aws", "lambda", "ap-south-1", "123456789012", "function", "my-func"]
  #   [0]    [1]     [2]         [3]              [4]           [5]        [6]

  account_id = local.arn_parts[4]   # Works but: what if ARN format changes?
  region     = local.arn_parts[3]   # Silent breakage if segments shift
  service    = local.arn_parts[2]

  # S3 ARNs break this entirely: "arn:aws:s3:::my-bucket" has no region or account
  # local.arn_parts[3] would be "" and local.arn_parts[4] would be ""
}

# ── AFTER v1.8 (structured, provider-aware) ────────────────────────────────

locals {
  lambda_arn = aws_lambda_function.app.arn

  parts      = provider::aws::arn_parse(local.lambda_arn)
  # {
  #   partition  = "aws"
  #   service    = "lambda"
  #   region     = "ap-south-1"
  #   account_id = "123456789012"
  #   resource   = "function:my-func"
  # }

  account_id = local.parts.account_id   # Named — self-documenting, robust
  region     = local.parts.region
  service    = local.parts.service
}
```

---

## Example 2: `trim_iam_role_path` — SSO Role Workaround

```hcl
# AWS SSO creates IAM roles with paths like:
# /aws-reserved/sso.amazonaws.com/AWSReservedSSO_AdministratorAccess_abc123
#
# Some AWS services (e.g. EKS aws-auth configmap, certain trust policies)
# only accept role ARNs with no path prefix (default path "/").
# Passing the SSO role ARN directly causes mysterious permission failures.

data "aws_iam_role" "sso_admin" {
  name = "AWSReservedSSO_AdministratorAccess_abc123"
}

locals {
  # SSO role ARN (has path):
  # arn:aws:iam::123456789012:role/aws-reserved/sso.amazonaws.com/AWSReservedSSO_...
  raw_arn   = data.aws_iam_role.sso_admin.arn

  # Trimmed ARN (no path):
  # arn:aws:iam::123456789012:role/AWSReservedSSO_AdministratorAccess_abc123
  clean_arn = provider::aws::trim_iam_role_path(local.raw_arn)
}

# Use the clean ARN in an EKS aws-auth entry
resource "kubernetes_config_map_v1_data" "aws_auth" {
  metadata { name = "aws-auth"; namespace = "kube-system" }
  data = {
    mapRoles = yamlencode([{
      rolearn  = local.clean_arn   # ← Trimmed ARN — EKS accepts this
      username = "admin"
      groups   = ["system:masters"]
    }])
  }
}
```

---

## Example 3: Provider Functions in a Module — Design Pattern

```hcl
# modules/lambda-permission/main.tf
# A module that grants API Gateway permission to invoke a Lambda.
# It uses arn_parse to extract the region/account without requiring them as inputs.

variable "lambda_arn" {
  type        = string
  description = "ARN of the Lambda function to grant permission to"
}

variable "api_gateway_arn" {
  type        = string
  description = "ARN of the API Gateway that will invoke the Lambda"
}

locals {
  lambda_parts = provider::aws::arn_parse(var.lambda_arn)
  apigw_parts  = provider::aws::arn_parse(var.api_gateway_arn)
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_arn
  principal     = "apigateway.amazonaws.com"

  # Construct the source ARN from parsed components — no hardcoded account/region
  source_arn    = "${var.api_gateway_arn}/*/*"
}

output "permission_statement_id" {
  value = aws_lambda_permission.apigw.statement_id
}
```

---

## Example 4: Unknown Value Propagation in a Plan

```hcl
# New Lambda (doesn't exist yet) + provider function chain

resource "aws_lambda_function" "new_func" {
  function_name = "my-new-function"
  role          = aws_iam_role.lambda.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = "lambda.zip"
}

locals {
  parts  = provider::aws::arn_parse(aws_lambda_function.new_func.arn)
  region = local.parts.region
}

output "function_region" {
  value = local.region
}
```

```bash
# terraform plan output for the above (first apply — Lambda is new)
# Outputs:
#   + function_region = (known after apply)
#            ^^^^^^^^^^^^^^^^^^^^^^^^^^^
#   The provider function could not be called because
#   aws_lambda_function.new_func.arn is not yet known.
#   After apply, subsequent plans will show the real region.
```

---

## Limitations Quick Reference

```hcl
# ❌ Cannot use in variable defaults
variable "region" {
  default = provider::aws::arn_parse(some_arn).region  # Error: provider not initialized
}

# ❌ Cannot use in backend config
terraform {
  backend "s3" {
    bucket = provider::aws::arn_parse(some_arn).account_id  # Error: evaluated before init
  }
}

# ❌ Cannot use in required_providers version
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = provider::aws::some_fn()  # Error: no provider available yet
    }
  }
}

# ✅ Can use in locals, resource, data, output, module
locals {
  parts = provider::aws::arn_parse(aws_lambda_function.app.arn)  # Fine
}
```
