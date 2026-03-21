# ------------------------------------------------------------------------------
# GENERIC EXAMPLE: AWS API GATEWAY (HTTP API v2)
# This example demonstrates creating a modern, low-cost HTTP API Gateway
# that acts as a proxy, routing all incoming HTTP traffic to a specific 
# AWS Lambda function.
# 
# It includes the API, the Stage, the Integration, the Route, and crucially,
# the aws_lambda_permission Resource Policy.
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

variable "lambda_function_name" {
  description = "The name of the backend Lambda function"
  type        = string
  default     = "prasaarit-stg-upload-handler"
}

variable "lambda_invoke_arn" {
  description = "The specific invoke ARN required by API Gateway Integrations"
  type        = string
  default     = "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:123456789012:function:prasaarit-stg-upload-handler/invocations"
}

# ------------------------------------------------------------------------------
# STEP 1: The API Shell
# ------------------------------------------------------------------------------
resource "aws_apigatewayv2_api" "http_api" {
  name          = "${var.project}-${var.environment}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"] # Adjust in production
    allow_methods = ["POST", "GET", "OPTIONS"]
    allow_headers = ["content-type", "authorization"]
    max_age       = 300
  }
}

# ------------------------------------------------------------------------------
# STEP 2: The Stage (Deployment Lifecycle)
# We use the default stage with auto-deploy so every route change goes live instantly.
# ------------------------------------------------------------------------------
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true
}

# ------------------------------------------------------------------------------
# STEP 3: The Integration
# Tells API Gateway specifically how to talk to Lambda. 
# ------------------------------------------------------------------------------
resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id             = aws_apigatewayv2_api.http_api.id
  
  # AWS_PROXY takes the entire HTTP request and dumps it into the Lambda JSON event payload
  integration_type   = "AWS_PROXY"
  
  # Required for invoking Lambda via API Gateway HTTP APIs
  integration_method = "POST" 
  
  integration_uri    = var.lambda_invoke_arn
}

# ------------------------------------------------------------------------------
# STEP 4: The Route
# Maps user request paths to the Integration.
# ------------------------------------------------------------------------------
resource "aws_apigatewayv2_route" "upload_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  
  # Only trigger the Lambda if the user POSTs to /upload
  route_key = "POST /upload"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

# ------------------------------------------------------------------------------
# STEP 5: The Resource Policy (CRITICAL)
# Grants API Gateway explicit IAM permission to execute the Lambda function.
# Without this, all API requests will fail with an internal 500 error.
# ------------------------------------------------------------------------------
resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  
  # The target
  function_name = var.lambda_function_name
  
  # The actor
  principal     = "apigateway.amazonaws.com"

  # Least Privilege: Only THIS specific API Gateway is allowed to invoke it.
  source_arn = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# ------------------------------------------------------------------------------
# Outputs
# ------------------------------------------------------------------------------
output "api_endpoint" {
  description = "The public URL of the API Gateway"
  value       = aws_apigatewayv2_api.http_api.api_endpoint
}
