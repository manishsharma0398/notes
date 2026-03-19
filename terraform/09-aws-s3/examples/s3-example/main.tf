# ------------------------------------------------------------------------------
# GENERIC EXAMPLE: AWS S3 SECURE BUCKET
# This example demonstrates creating an S3 bucket using the modern 
# Terraform AWS Provider v4+ disaggregated architecture.
# 
# It includes the shell bucket, public access blocking, versioning, 
# default encryption, and dynamic naming to prevent naming collisions.
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

# 2. Data Sources (Finding out who we are)
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ------------------------------------------------------------------------------
# STEP 1: Create the Bucket Shell.
# Notice we append the AWS Account ID mathematically to ensure global uniqueness.
# ------------------------------------------------------------------------------
resource "aws_s3_bucket" "uploads" {
  bucket = "${var.project}-${var.environment}-uploads-${data.aws_caller_identity.current.account_id}"

  # force_destroy = true # Uncomment carefully! Allows terraform destroy even if files exist.

  tags = {
    Name = "${var.project}-${var.environment}-uploads"
  }
}

# ------------------------------------------------------------------------------
# STEP 2: Enforce "Block Public Access" at the bucket level.
# This prevents accidental ACL or Bucket Policy misconfigurations from 
# leaking data to the public internet.
# ------------------------------------------------------------------------------
resource "aws_s3_bucket_public_access_block" "uploads_firewall" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ------------------------------------------------------------------------------
# STEP 3: Enable Bucket Versioning.
# Highly recommended to protect against accidental object overwrites/deletions.
# ------------------------------------------------------------------------------
resource "aws_s3_bucket_versioning" "uploads_versioning" {
  bucket = aws_s3_bucket.uploads.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

# ------------------------------------------------------------------------------
# STEP 4: Enforce Default Encryption at Rest.
# Using standard AES256 (Amazon S3-managed keys). 
# Can optionally be KMS (aws:kms) for stricter key rotation policies.
# ------------------------------------------------------------------------------
resource "aws_s3_bucket_server_side_encryption_configuration" "uploads_encryption" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ------------------------------------------------------------------------------
# Output the Bucket ARN so IAM roles (like our Chapter 08 Lambda Role) can use it.
# ------------------------------------------------------------------------------
output "s3_bucket_arn" {
  value       = aws_s3_bucket.uploads.arn
  description = "The ARN of the newly created S3 bucket"
}

output "s3_bucket_id" {
  value       = aws_s3_bucket.uploads.id
  description = "The literal name of the S3 bucket"
}
