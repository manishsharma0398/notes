# live/prod/app/terragrunt.hcl
#
# A complete unit definition.
# This is the ONLY file you write per unit — everything else is generated.

include "root" {
  path           = find_in_parent_folders("root.hcl")
  merge_strategy = "deep"
  # deep merge: maps in child and parent are merged recursively
  # shallow (default): child attribute overrides parent completely
}

# --- Source: versioned remote module ---
terraform {
  source = "git::git@github.com:myorg/modules.git//app?ref=v2.3.1"
  #                                           ^^
  #  double-slash separates the Git repo root from the module subdirectory
  #  ?ref=v2.3.1 pins to an immutable Git tag (not a branch!)
}

# --- Local variables for this unit ---
locals {
  env  = basename(dirname(get_terragrunt_dir()))   # "prod" from the path
  name = basename(get_terragrunt_dir())             # "app"
}

# --- Cross-unit dependency: read VPC outputs ---
dependency "vpc" {
  config_path = "../vpc"  # relative path to the vpc unit's directory

  # Without mock_outputs, `plan` fails if vpc hasn't been applied yet.
  # These mocks are placeholder values used ONLY for plan/validate.
  mock_outputs = {
    vpc_id             = "vpc-00000000000000000"
    private_subnet_ids = ["subnet-00000000000000001", "subnet-00000000000000002"]
    app_sg_id          = "sg-00000000000000000"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
  # ^^^^ Apply WILL require real outputs — mocks are only for plan
}

dependency "ecs_cluster" {
  config_path = "../ecs-cluster"
  mock_outputs = {
    cluster_arn  = "arn:aws:ecs:ap-south-1:123456789012:cluster/mock"
    cluster_name = "mock-cluster"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

# --- Inputs: passed to Terraform as TF_VAR_* environment variables ---
inputs = {
  # Environment config
  environment  = local.env
  service_name = "myorg-${local.env}-app"

  # From vpc dependency — real values after vpc is applied
  vpc_id         = dependency.vpc.outputs.vpc_id
  subnet_ids     = dependency.vpc.outputs.private_subnet_ids
  security_group = dependency.vpc.outputs.app_sg_id

  # From ecs_cluster dependency
  cluster_arn  = dependency.ecs_cluster.outputs.cluster_arn
  cluster_name = dependency.ecs_cluster.outputs.cluster_name

  # Service-specific config
  desired_count  = 3
  cpu            = 512
  memory         = 1024
  container_image = "ghcr.io/myorg/app:${get_env("IMAGE_TAG", "latest")}"
}
