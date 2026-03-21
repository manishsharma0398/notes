# ------------------------------------------------------------------------------
# GENERIC EXAMPLE: AWS IAM
# This example demonstrates creating an Execution Role for an AWS Lambda function 
# that is allowed to write to a specific S3 bucket and DynamoDB table.
# 
# Notice the use of `data "aws_iam_policy_document"` for robust JSON generation.
# ------------------------------------------------------------------------------

# 1. Define variables (Simulating an environment like `prasaarit`)
variable "project" {
  description = "The project name"
  type        = string
  default     = "prasaarit"
}

variable "environment" {
  description = "The deployment environment"
  type        = string
  default     = "stg"
}

variable "dest_bucket_arn" {
  description = "The ARN of the existing S3 bucket, simulating passing outputs between modules."
  type        = string
  default     = "arn:aws:s3:::prasaarit-uploads-stg"
}

# ------------------------------------------------------------------------------
# STEP 1: Define WHO can assume the role (The Trust Policy)
# ------------------------------------------------------------------------------

data "aws_iam_policy_document" "lambda_trust" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# ------------------------------------------------------------------------------
# STEP 2: Create the IAM Role (The Identity)
# ------------------------------------------------------------------------------

resource "aws_iam_role" "lambda_executor" {
  name               = "${var.project}-${var.environment}-lambda-exec-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_trust.json

  tags = {
    Name = "${var.project}-${var.environment}-lambda-exec"
  }
}

# ------------------------------------------------------------------------------
# STEP 3: Define WHAT the role can do (The Permission Policy)
# ------------------------------------------------------------------------------

data "aws_iam_policy_document" "lambda_permissions" {
  # Rule 1: Allow basic CloudWatch Logs writing (Required for all Lambdas)
  statement {
    sid       = "CloudWatchLogs"
    effect    = "Allow"
    actions   = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["arn:aws:logs:*:*:*"] 
  }

  # Rule 2: Allow S3 Create/Delete (Least Privilege to our specific target bucket)
  statement {
    sid       = "S3UploadAccess"
    effect    = "Allow"
    actions   = [
      "s3:PutObject",
      "s3:DeleteObject"
    ]
    # We dynamically reference the bucket ARN to enforce Least Privilege
    resources = ["${var.dest_bucket_arn}/*"]
  }
}

# ------------------------------------------------------------------------------
# STEP 4: Create the IAM Policy resource in AWS
# ------------------------------------------------------------------------------

resource "aws_iam_policy" "lambda_permissions" {
  name        = "${var.project}-${var.environment}-lambda-permissions"
  description = "Execution permissions for the Prasaarit upload handler"
  policy      = data.aws_iam_policy_document.lambda_permissions.json
}

# ------------------------------------------------------------------------------
# STEP 5: ATTACHMENT (Bind the Identity to its Permissions)
# ------------------------------------------------------------------------------

resource "aws_iam_role_policy_attachment" "lambda_glue" {
  role       = aws_iam_role.lambda_executor.name
  policy_arn = aws_iam_policy.lambda_permissions.arn
}

# ------------------------------------------------------------------------------
# Output the resulting ARN so other modules (like the compute module) can use it.
# ------------------------------------------------------------------------------
output "lambda_execution_role_arn" {
  value       = aws_iam_role.lambda_executor.arn
  description = "The ARN of the IAM role to attach to the Lambda function"
}
