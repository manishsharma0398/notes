# Chapter 09: AWS S3 Cheatsheet

### 1. `aws_s3_bucket`
**Purpose:** Creates the raw shell of the bucket.
**Rule:** Bucket names must be globally unique across all of AWS, not just your account.

### 2. `aws_s3_bucket_versioning`
**Purpose:** Protects against accidental overwrites or deletions. 
**Best Practice:** Always enable this for critical data or for Terraform state storage buckets.

### 3. `aws_s3_bucket_server_side_encryption_configuration`
**Purpose:** Encrypts data at rest via AES256 (Amazon S3-managed keys) or aws:kms (AWS Key Management Service).

### 4. `aws_s3_bucket_public_access_block`
**Purpose:** Creates a hard firewall preventing the bucket from being made public via ACLs or bad bucket policies.
**Best Practice:** Always deploy this alongside every new bucket.

### 5. `aws_s3_bucket_policy`
**Purpose:** Attaches an IAM Policy JSON document directly to the bucket.
**Key Connection:** Use `data "aws_iam_policy_document"` to write the JSON and pass it to this resource.

---

### Standard Pattern: The "Secure Bucket" Boilerplate

```hcl
# 1. The Bucket
resource "aws_s3_bucket" "this" {
  bucket = "my-globally-unique-bucket-name"
}

# 2. Block Public Access
resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 3. Enable Versioning
resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id
  versioning_configuration {
    status = "Enabled"
  }
}

# 4. Enforce Default Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
```
