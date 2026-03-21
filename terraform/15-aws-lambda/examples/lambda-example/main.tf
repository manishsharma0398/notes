# ------------------------------------------------------------------------------
# GENERIC EXAMPLE: AWS LAMBDA 
# This example demonstrates creating a Lambda function using the "Dummy Zip"
# pattern. This is an enterprise best-practice that allows Terraform to provision 
# the infrastructure, while allowing an external CI/CD tool (like GitHub Actions) 
# to rapidly deploy application code updates without fighting Terraform drift.
# ------------------------------------------------------------------------------

# 1. Variables (Simulating a generic environment)
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

variable "lambda_execution_role_arn" {
  description = "The execution role created in Chapter 08"
  type        = string
  default     = "arn:aws:iam::123456789012:role/prasaarit-stg-lambda-exec-role"
}

# ------------------------------------------------------------------------------
# STEP 1: The Dummy Zip Payload
# We use the built-in archive_file data source to zip an empty directory.
# This creates a 22-byte zip file just to satisfy the AWS API constraint 
# that an initial deployment package MUST exist.
# ------------------------------------------------------------------------------
data "archive_file" "dummy_payload" {
  type        = "zip"
  # In a real repository, this points to an empty folder called "dummy"
  source_dir  = "${path.module}/dummy_src" 
  output_path = "${path.module}/dummy_payload.zip"
}

# ------------------------------------------------------------------------------
# STEP 2: The Lambda Function
# ------------------------------------------------------------------------------
resource "aws_lambda_function" "upload_handler" {
  function_name = "${var.project}-${var.environment}-upload-handler"
  
  # Pointing to the tiny dummy zip we just created
  filename      = data.archive_file.dummy_payload.output_path
  
  # The IAM execution role
  role          = var.lambda_execution_role_arn

  # The exact filename and method your application CI/CD uses (e.g., app.js -> export.handler)
  handler       = "index.handler"
  
  # The execution environment
  runtime       = "nodejs20.x"
  
  # Typical RAM allocation (in MB)
  memory_size   = 256
  
  # Typical timeout (in seconds)
  timeout       = 30

  # Injecting environment variables for the runtime application
  environment {
    variables = {
      ENVIRONMENT = var.environment
      LOG_LEVEL   = "debug"
    }
  }

  # ----------------------------------------------------------------------------
  # CRITICAL: lifecycle ignore_changes
  # This tells Terraform: "Once you create this Lambda, NEVER overwrite the
  # source code or hash again." This allows the developers to freely deploy 
  # via the AWS CLI without Terraform reverting their changes!
  # ----------------------------------------------------------------------------
  lifecycle {
    ignore_changes = [
      source_code_hash,
      filename,
      version
    ]
  }

  tags = {
    Name = "${var.project}-${var.environment}-upload-handler"
  }
}

# ------------------------------------------------------------------------------
# STEP 3: The CloudWatch Log Group
# If you don't define this, AWS implicitly creates it without a retention limit.
# Defining it explicitly in Terraform forces AWS to delete old logs automatically.
# ------------------------------------------------------------------------------
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.upload_handler.function_name}"
  retention_in_days = 14
}

# ------------------------------------------------------------------------------
# Outputs
# ------------------------------------------------------------------------------
output "lambda_arn" {
  value       = aws_lambda_function.upload_handler.arn
  description = "The ARN of the Lambda Function (used by API Gateway)"
}

output "lambda_invoke_arn" {
  value       = aws_lambda_function.upload_handler.invoke_arn
  description = "The exact execution path format required by API Gateway Integrations"
}
