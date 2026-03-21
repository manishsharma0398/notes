# Chapter 10: AWS Lambda Cheatsheet

### 1. `archive_file` Data Source
**Purpose:** Zips a local file or directory on your machine so it can be uploaded by Terraform.
```hcl
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/src"
  output_path = "${path.module}/src.zip"
}
```

### 2. `aws_lambda_function`
**Purpose:** Deploys the actual compute resource.

**Key Arguments:**
*   `filename`: Path to the local `.zip` file.
*   `function_name`: The unique name of the Lambda.
*   `role`: The ARN of the IAM Exeuction Role.
*   `handler`: The entrypoint method (`filename.method`).
*   `runtime`: The language environment (`nodejs20.x`, `python3.11`, `go1.x`).
*   `source_code_hash`: Base64 encoded hash of the zip file. **CRITICAL:** Without this, Terraform cannot tell if your source code has changed, and will not redeploy your code.

### 3. `aws_lambda_layer_version`
**Purpose:** Deploys a shared dependency archive that multiple Lambdas can use.

### 4. `aws_cloudwatch_log_group`
**Purpose:** While Lambda automatically magically creates its own CloudWatch Log Group upon its first invocation, managing it strictly via Terraform is highly recommended to enforce log retention policies.

```hcl
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.my_function.function_name}"
  retention_in_days = 14 # Saves money instead of keeping logs forever!
}
```

---

### Standard Pattern: CI/CD "Ignore Drift" Configuration
If you are deploying code via an external CI/CD pipeline (using `aws lambda update-function-code`), you MUST configure Terraform to ignore the source code changes, otherwise Terraform will continually downgrade your Lambda to the initial dummy zip file.

```hcl
resource "aws_lambda_function" "example" {
  # ... other config ...

  lifecycle {
    ignore_changes = [
      # Ignore code updates pushed by application developers
      source_code_hash,
      filename,
      version 
    ]
  }
}
```
