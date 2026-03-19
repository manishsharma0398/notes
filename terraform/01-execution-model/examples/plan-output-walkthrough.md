# Execution Model — Example: Plan Output for Prasaarit Upload Service

## What to observe

This is an example of what `terraform plan` output looks like for a simple
Lambda + API Gateway setup. Study the output — notice:

1. **The order** — Terraform shows resources in dependency order.
2. **The `+` symbol** — means "will be created."
3. **`(known after apply)`** — values that don't exist yet (like ARNs). These are
   computed by AWS and returned via the provider's `ApplyResourceChange` RPC.
4. **The resource address** — e.g., `aws_lambda_function.presign` is
   `resource_type.resource_name`.

```
$ terraform plan -var="s3_upload_bucket=prasaarit-uploads-stg"

Terraform used the selected providers to generate the following execution plan.
Resource actions are indicated with the following symbols:
  + create

Terraform will perform the following actions:

  # aws_iam_role.lambda_exec will be created
  + resource "aws_iam_role" "lambda_exec" {
      + arn                = (known after apply)    ← AWS generates this
      + assume_role_policy = jsonencode({
          + Statement = [
              + {
                  + Action    = "sts:AssumeRole"
                  + Effect    = "Allow"
                  + Principal = {
                      + Service = "lambda.amazonaws.com"
                  }
              },
          ]
          + Version   = "2012-10-17"
      })
      + id                 = (known after apply)    ← AWS generates this
      + name               = "prasaarit-lambda-exec-stg"
    }

  # aws_lambda_function.presign will be created
  + resource "aws_lambda_function" "presign" {
      + arn               = (known after apply)
      + function_name     = "prasaarit-presign-stg"
      + handler           = "handler.lambda_handler"
      + invoke_arn        = (known after apply)     ← needed by API GW integration
      + role              = (known after apply)     ← will be filled by IAM role ARN
      + runtime           = "python3.12"
      + source_code_hash  = "abc123..."             ← hash of your zip file
      + timeout           = 10
      + memory_size       = 128
      + environment {
          + variables = {
              + "BUCKET_NAME"    = "prasaarit-uploads-stg"
              + "ALLOWED_ORIGIN" = "*"
          }
      }
    }

  # aws_api_gateway_rest_api.api will be created
  + resource "aws_api_gateway_rest_api" "api" {
      + id               = (known after apply)
      + name             = "prasaarit-api-stg"
      + root_resource_id = (known after apply)      ← the "/" resource, needed by child resources
    }

  # ... (more resources: api_gateway_resource, method, integration, deployment, stage)

Plan: 10 to add, 0 to change, 0 to destroy.

Changes to Outputs:
  + api_gateway_invoke_url = (known after apply)
  + lambda_function_name   = "prasaarit-presign-stg"
```

## Key takeaways from this plan output

1. **`role = (known after apply)`** on the Lambda — Terraform knows the Lambda depends
   on the IAM role (because you wrote `role = aws_iam_role.lambda_exec.arn`), so it
   can't show the ARN yet. The `ReferenceTransformer` created a graph edge here.

2. **`source_code_hash`** has a value — Terraform computed `filebase64sha256("lambda_payload.zip")`
   locally. On the _next_ apply, if you change your Python code and re-zip, this hash changes,
   and Terraform will plan an **update** to the Lambda function.

3. **"10 to add"** — on the very first apply, everything is a create. On subsequent runs,
   Terraform will show "0 to add, 0 to change, 0 to destroy" if nothing changed — that's
   the **idempotent** property of a declarative tool.

4. **What you do NOT see** — the actual AWS API calls (`CreateFunction`, `CreateRestApi`).
   Those happen inside the provider binary during apply. The plan only shows the _intent_.
