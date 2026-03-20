# Chapter 03 — State File — Examples

All examples use `terraform_data` (no cloud credentials needed) or illustrate concepts with annotated HCL and bash.

---

## Example 1 — Drift Detection in Action

Simulate drift by directly editing state and watching Terraform detect it:

```hcl
# drift_demo.tf
terraform {
  required_version = ">= 1.4"
}

resource "terraform_data" "demo" {
  input = {
    label = "original"
    env   = "stg"
  }
}

output "current_label" {
  value = terraform_data.demo.output.label
}
```

```bash
terraform init && terraform apply -auto-approve
# State now has: input.label = "original"

# Simulate a "console change" — directly edit terraform.tfstate
# Change "original" → "changed-in-console" in the attributes block

terraform plan
# Output: ~ input: { label = "changed-in-console" } → { label = "original", env = "stg" }
# Terraform detects the drift and plans to revert it.

# To ACCEPT the drift instead of reverting it:
terraform apply -refresh-only
# State is updated to match the "cloud" value. No resource changes.
```

---

## Example 2 — S3 Backend Configuration

```hcl
# backend.tf — local state (default, no config needed)
terraform {
  required_version = ">= 1.11"
  # Default: local state in terraform.tfstate
}

# ─── Upgrade to S3 backend with native locking (v1.11+) ─────────────────────
# Uncomment when adding CI/CD (Chapter 07):
#
# terraform {
#   backend "s3" {
#     bucket       = "prasaarit-terraform-state"
#     key          = "upload-service/terraform.tfstate"
#     region       = "ap-south-1"
#     encrypt      = true
#
#     # Option A: S3 native locking (v1.11+, no DynamoDB needed)
#     use_lockfile = true
#
#     # Option B: DynamoDB locking (pre-v1.11 or if use_lockfile not yet available)
#     # dynamodb_table = "prasaarit-terraform-locks"
#   }
# }
```

```bash
# Migrate from local → S3 backend:
# 1. Uncomment the backend "s3" block above
# 2. Run:
terraform init -migrate-state
# "Do you want to copy existing state to the new backend?" → yes
# State is now in S3. Remove terraform.tfstate locally.
```

---

## Example 3 — Import Workflow (CLI vs Config Block)

```bash
# ─── CLI import (classic) ───────────────────────────────────────────────────

# Step 1: Write the resource block first
cat > s3.tf << 'EOF'
resource "aws_s3_bucket" "uploads" {
  bucket = "prasaarit-uploads-stg"
}
EOF

# Step 2: Import the existing cloud resource into state
terraform import aws_s3_bucket.uploads prasaarit-uploads-stg

# Step 3: Check config vs imported state
terraform plan
# Likely shows 5-10 changes where your config is incomplete.
# Iterate: add missing attributes until plan shows 0 changes.

# Step 4: Auto-generate config from imported state (v1.5+)
terraform plan -generate-config-out=generated.tf
# Review generated.tf carefully — it includes every attribute.
```

```hcl
# ─── Config-driven import (v1.5+, preferred) ─────────────────────────────────
# Reviewable in Git, runs through normal plan/apply, works in CI/CD

import {
  to = aws_s3_bucket.uploads
  id = "prasaarit-uploads-stg"
}

resource "aws_s3_bucket" "uploads" {
  bucket = "prasaarit-uploads-stg"
}
```

```bash
terraform plan    # shows the import as a planned action
terraform apply   # imports the resource and applies any config drift
```

---

## Example 4 — The `moved` Block (Refactoring Without Destroy)

```hcl
# BEFORE: Lambda is in the root module
resource "aws_lambda_function" "presign" {
  function_name = "prasaarit-presign-stg"
  # ...
}

# You want to move it into a child module.
# WITHOUT a moved block: terraform plan shows destroy + create (bad).

# WITH a moved block: terraform plan shows the address change, no destroy.
moved {
  from = aws_lambda_function.presign
  to   = module.api.aws_lambda_function.presign
}

module "api" {
  source = "./modules/api"
  # ...
}

# terraform plan output:
#   aws_lambda_function.presign has moved to module.api.aws_lambda_function.presign
#   No changes. Infrastructure is up-to-date.
```

---

## Example 5 — The `removed` Block (Stop Managing Without Destroying)

```hcl
# You want to hand the RDS instance to another team's Terraform config.
# Don't destroy it — just stop managing it.

# Step 1: Add the removed block AND delete the resource "aws_db_instance" "main" block
removed {
  from = aws_db_instance.main

  lifecycle {
    destroy = false    # "forget" — the real resource stays in AWS
    # destroy = true   # would destroy the resource on next apply
  }
}

# Step 2: terraform plan
#   aws_db_instance.main will no longer be managed by Terraform
#   (its real-world infrastructure will be unaffected)

# Step 3: terraform apply
#   Removes aws_db_instance.main from state.
#   The RDS instance continues running in AWS.
```

The receiving team can then `terraform import` + write their config to take ownership.
