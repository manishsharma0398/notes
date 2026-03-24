# live/prod/env.hcl
#
# Environment-level locals — read by root.hcl via read_terragrunt_config()
# Each environment owns its own account ID and IAM role for assume_role.

locals {
  account_id = "123456789012"
  aws_region = "ap-south-1"

  # The Terraform execution role — assumed by Terragrunt before calling terraform
  role_arn = "arn:aws:iam::123456789012:role/TerraformDeployRole"
}
