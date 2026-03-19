# HCL Language Fundamentals — Examples

## Example 1: count vs for_each — The Identity Trap

Save these as separate `.tf` files to experiment with.

### Using count (dangerous for lists):

```hcl
# count_example.tf
variable "routes" {
  type    = list(string)
  default = ["/upload", "/metadata", "/delete"]
}

resource "null_resource" "route" {
  count = length(var.routes)

  triggers = {
    path = var.routes[count.index]
  }
}

output "route_ids" {
  value = null_resource.route[*].id
}

# Run: terraform plan
# Then remove "/upload" from the list and run plan again.
# Watch how ALL resources shift.
```

### Using for_each (safe):

```hcl
# foreach_example.tf
variable "routes" {
  type    = list(string)
  default = ["/upload", "/metadata", "/delete"]
}

resource "null_resource" "route" {
  for_each = toset(var.routes)

  triggers = {
    path = each.value
  }
}

output "route_ids" {
  value = { for k, v in null_resource.route : k => v.id }
}

# Run: terraform plan
# Then remove "/upload" from the list and run plan again.
# Only the "/upload" resource is destroyed. Others are untouched.
```

> **Try this yourself**: You need `terraform init` first (uses the built-in `null` provider).
> `null_resource` creates nothing in the cloud — it's perfect for testing HCL patterns locally.

---

## Example 2: Variable Precedence

```hcl
# main.tf
variable "stage" {
  type    = string
  default = "dev"       # precedence level 1
}

output "stage" {
  value = var.stage
}
```

```hcl
# terraform.tfvars (auto-loaded)
stage = "stg"           # precedence level 2 — overrides default
```

```bash
# CLI flag — precedence level 5 — overrides everything above
terraform plan -var="stage=prod"

# Environment variable — precedence level 6 — highest
export TF_VAR_stage="emergency"
terraform plan
```

---

## Example 3: jsonencode for IAM Policies

```hcl
# This is the pattern you'll use for every IAM policy in your Prasaarit project.

locals {
  bucket_name = "prasaarit-uploads-stg"
}

# GOOD: Using jsonencode — type-safe, proper escaping
resource "aws_iam_role_policy" "lambda_s3_access" {
  name = "lambda-s3-access"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowS3PutObject"
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "arn:aws:s3:::${local.bucket_name}/*"
      },
      {
        Sid      = "AllowCloudWatchLogs"
        Effect   = "Allow"
        Action   = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}
```

---

## Example 4: for Expressions

```hcl
# Transform a list of Lambda configs into resources
locals {
  lambda_configs = {
    presign = {
      handler     = "handler.lambda_handler"
      timeout     = 10
      memory      = 128
      description = "Generates S3 presigned URLs"
    }
    metadata = {
      handler     = "handler.lambda_handler"
      timeout     = 5
      memory      = 128
      description = "Returns video metadata"
    }
  }

  # for expression: extract just the names
  lambda_names = [for name, config in local.lambda_configs : name]
  # → ["presign", "metadata"]

  # for expression: build a map of name → full function name
  lambda_full_names = {
    for name, config in local.lambda_configs :
    name => "prasaarit-stg-${name}"
  }
  # → { presign = "prasaarit-stg-presign", metadata = "prasaarit-stg-metadata" }

  # for expression with filter
  long_timeout_lambdas = {
    for name, config in local.lambda_configs :
    name => config
    if config.timeout > 5
  }
  # → { presign = { handler = "...", timeout = 10, ... } }
}
```
