# Example: `depends_on` — Explicit vs Implicit Dependencies

# ─────────────────────────────────────────────────────────────────────────────
# SCENARIO: Lambda + IAM Role + IAM Policy Attachment
# The IAM eventual consistency problem
# ─────────────────────────────────────────────────────────────────────────────

# 1. The IAM Role
resource "aws_iam_role" "lambda_exec" {
  name = "lambda-exec-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# 2. Attach the AWS-managed policy to the role
resource "aws_iam_role_policy_attachment" "basic_exec" {
  role       = aws_iam_role.lambda_exec.name    # ← implicit edge: attachment waits for role
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ─────────────────────────────────────────────────────────────────────────────
# PROBLEM: The Lambda below only references the ROLE, not the ATTACHMENT.
# The ReferenceTransformer creates:
#   lambda → role     (because `role = aws_iam_role.lambda_exec.arn`)
# But NOT:
#   lambda → attachment  (because lambda doesn't reference `aws_iam_role_policy_attachment.*`)
#
# Terraform may create the Lambda CONCURRENTLY with the policy attachment.
# AWS IAM is eventually consistent — the policy may not register for ~5-10s.
# Your first Lambda invocation can fail with "AccessDenied" even though
# `terraform apply` completed successfully.
# ─────────────────────────────────────────────────────────────────────────────

# BAD — missing explicit dependency on the policy attachment
resource "aws_lambda_function" "fn_bad" {
  function_name = "my-function"
  role          = aws_iam_role.lambda_exec.arn    # implicit edge to role only
  handler       = "index.handler"
  runtime       = "python3.12"
  filename      = "function.zip"
}

# GOOD — explicit depends_on forces the graph to wait for attachment before Lambda
resource "aws_lambda_function" "fn_good" {
  function_name = "my-function"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "index.handler"
  runtime       = "python3.12"
  filename      = "function.zip"

  # This tells Terraform's graph builder: add an edge
  #   aws_lambda_function.fn_good → aws_iam_role_policy_attachment.basic_exec
  # The Lambda vertex will NOT be walked until the policy attachment vertex
  # has successfully completed.
  depends_on = [
    aws_iam_role_policy_attachment.basic_exec
  ]
}

# ─────────────────────────────────────────────────────────────────────────────
# COST OF depends_on ON A MODULE BLOCK (avoid if possible)
# ─────────────────────────────────────────────────────────────────────────────

# When depends_on is on a resource, it adds ONE precise edge.
# When depends_on is on a MODULE, Terraform adds edges from EVERY resource
# inside the module to the dependency — even ones that don't need it.
# This kills parallelism for the whole module.

module "networking" {
  source = "./modules/networking"
}

module "compute" {
  source = "./modules/compute"

  # BAD: forces ALL compute resources to wait for ALL networking resources.
  # Even a CloudWatch alarm in compute that has nothing to do with VPC setup
  # will now wait for NAT gateway creation to complete.
  depends_on = [module.networking]
}

# BETTER: identify the specific resource that actually needs the dependency
# and place depends_on at the resource level within the compute module.
# Or: pass the VPC ID as an input variable (which creates an implicit edge).
