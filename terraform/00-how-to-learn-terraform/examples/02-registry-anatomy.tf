# Example 02 — Registry Anatomy: Arguments vs Attribute References

# ─────────────────────────────────────────────────────────────────────────────
# aws_s3_bucket: a resource with clear Required/Optional + Attribute Reference
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_s3_bucket" "logs" {
  # ARGUMENT: Required.
  # If you omit `bucket`, terraform plan fails with:
  #   Error: Missing required argument
  bucket = "my-app-access-logs-prod"

  # ARGUMENT: Optional — but read carefully.
  # Default: {} (no tags). Not a security issue, but a hygiene issue.
  tags = {
    Environment = "prod"
    ManagedBy   = "terraform"
  }

  # force_destroy is an OPTIONAL argument. Default: false.
  # That is correct for production — you don't want `terraform destroy`
  # to delete a bucket with objects in it.
  # Set to true ONLY in ephemeral environments (CI teardown, testing).
  force_destroy = false
}

# After creation, aws_s3_bucket exports ATTRIBUTE REFERENCES:
#   aws_s3_bucket.logs.id          → the bucket name (same as `bucket` arg)
#   aws_s3_bucket.logs.arn         → full ARN, e.g. arn:aws:s3:::my-app-access-logs-prod
#   aws_s3_bucket.logs.bucket_domain_name → e.g. my-app-access-logs-prod.s3.amazonaws.com
#   aws_s3_bucket.logs.region      → AWS region the bucket was created in
#
# These come from the "Attribute Reference" section of the Registry page.
# You cannot know these upfront — they are (known after apply) at plan time.


# ─────────────────────────────────────────────────────────────────────────────
# Using attribute references to wire resources together
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_iam_policy" "read_logs" {
  name = "LogsReadPolicy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:ListBucket"]
      # .arn is an ATTRIBUTE REFERENCE — not an argument you set.
      # Terraform knows this value only after aws_s3_bucket.logs is created.
      # This implicit dependency means Terraform will always create the bucket
      # BEFORE this policy, without you needing to write `depends_on`.
      Resource = [
        aws_s3_bucket.logs.arn,
        "${aws_s3_bucket.logs.arn}/*",
      ]
    }]
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# Common trap: confusing argument vs. attribute reference
# ─────────────────────────────────────────────────────────────────────────────

# WRONG: `bucket` is the argument name (what you set IN the resource).
# It happens to equal the bucket name string, but it is NOT the ARN.
#   Resource = aws_s3_bucket.logs.bucket   ← this gives you "my-app-access-logs-prod"
#                                             NOT the ARN!

# CORRECT: Use the attribute reference from the Attribute Reference section.
#   Resource = aws_s3_bucket.logs.arn      ← "arn:aws:s3:::my-app-access-logs-prod"
