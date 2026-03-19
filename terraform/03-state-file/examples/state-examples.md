# State File — Examples

## Example 1: State Drift Detection

Run these steps locally to see drift detection in action:

```hcl
# drift_demo.tf — uses null provider (no cloud needed)

resource "null_resource" "demo" {
  triggers = {
    value = "original"
  }
}

output "resource_id" {
  value = null_resource.demo.id
}
```

```bash
# Step 1: Init and apply
terraform init
terraform apply -auto-approve

# Step 2: Look at the state file
cat terraform.tfstate | python3 -m json.tool
# Notice: serial=1, the resource has an ID and triggers

# Step 3: Manually edit the state file (simulates console change)
# Change the trigger value from "original" to "changed-in-console"
# This is what drift looks like — state says one thing, config says another

# Step 4: Run plan
terraform plan
# Output: ~ triggers: { "value" = "changed-in-console" → "original" }
# Terraform wants to revert the "drift"
```

---

## Example 2: S3 Backend Configuration for Prasaarit

```hcl
# main.tf — how your upload-service backend would look

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Start with local state:
  # backend "local" {}     ← this is the default, you don't even need to write it

  # Later, when adding CI/CD, switch to S3:
  # backend "s3" {
  #   bucket         = "prasaarit-terraform-state"
  #   key            = "upload-service/terraform.tfstate"
  #   region         = "ap-south-1"
  #   dynamodb_table = "prasaarit-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.region
}
```

```bash
# When switching from local → S3 backend:
# 1. Uncomment the backend "s3" block
# 2. Run:
terraform init -migrate-state
# 3. Terraform asks: "Do you want to copy existing state to the new backend?"
# 4. Type "yes"
# 5. State is now in S3. Delete local terraform.tfstate.
```

---

## Example 3: Import Workflow

```bash
# You have an S3 bucket created in the console: "prasaarit-uploads-stg"
# You want Terraform to manage it.

# Step 1: Write the resource block (in your core-infra repo)
cat > s3.tf << 'EOF'
resource "aws_s3_bucket" "uploads" {
  bucket = "prasaarit-uploads-stg"
}
EOF

# Step 2: Import
terraform import aws_s3_bucket.uploads prasaarit-uploads-stg
# Output: aws_s3_bucket.uploads: Import prepared!
#         aws_s3_bucket.uploads: Refreshing state...
#         Import successful!

# Step 3: Check for config drift
terraform plan
# Will show changes where your config is incomplete.
# Update your config until plan shows: "No changes."

# Step 4 (modern alternative): Use import block instead of CLI
cat > imports.tf << 'EOF'
import {
  to = aws_s3_bucket.uploads
  id = "prasaarit-uploads-stg"
}
EOF

terraform plan
# Shows the import as part of the plan — reviewable before apply
```

---

## Example 4: The `moved` Block for Refactoring

```hcl
# BEFORE refactoring: Lambda is in root module
resource "aws_lambda_function" "presign" {
  function_name = "prasaarit-presign-stg"
  # ...
}

# AFTER refactoring: Lambda moves to a module
# Without moved block:
#   terraform plan → destroy + create (BAD)

# With moved block:
moved {
  from = aws_lambda_function.presign
  to   = module.api.aws_lambda_function.presign
}

module "api" {
  source = "./modules/api"
  # ...
}

# terraform plan → "aws_lambda_function.presign has moved to
#                   module.api.aws_lambda_function.presign"
# No destroy. No create. Just state address update.
```
