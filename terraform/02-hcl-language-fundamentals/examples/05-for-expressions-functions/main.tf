# Chapter 02 — Example 05: for expressions and built-in functions
#
# This example requires NO cloud credentials.
# Explore collection transformations, CIDR math, and type conversions.
#
# EXERCISE:
#   1. terraform init && terraform apply
#   2. Read every output — trace how each value was computed from the input
#   3. Modify var.lambda_configs and predict the output before running plan
#   4. Add a filter to for_each_map to exclude timeouts <= 5

terraform {
  required_version = ">= 1.4"
}

# ─── INPUT ────────────────────────────────────────────────────────────────────

variable "project_name" {
  type    = string
  default = "prasaarit"
}

variable "stage" {
  type    = string
  default = "stg"
}

variable "lambda_configs" {
  description = "Lambda function configurations"
  type = map(object({
    handler     = string
    timeout     = number
    memory      = number
  }))
  default = {
    presign = {
      handler = "handler.presign_handler"
      timeout = 10
      memory  = 128
    }
    metadata = {
      handler = "handler.metadata_handler"
      timeout = 5
      memory  = 128
    }
    delete = {
      handler = "handler.delete_handler"
      timeout = 15
      memory  = 256
    }
  }
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

# ─── for EXPRESSIONS — list and map transformations ──────────────────────────

locals {
  prefix = "${var.project_name}-${var.stage}"

  # Extract just the names
  lambda_names = [for name, _ in var.lambda_configs : name]
  # → ["presign", "metadata", "delete"]

  # Build a map of name → full function name
  lambda_full_names = {
    for name, _ in var.lambda_configs :
    name => "${local.prefix}-${name}"
  }
  # → { presign = "prasaarit-stg-presign", metadata = "...", delete = "..." }

  # Filter: only high-memory lambdas
  high_memory_lambdas = {
    for name, cfg in var.lambda_configs :
    name => cfg
    if cfg.memory > 128
  }
  # → { delete = { handler = "...", timeout = 15, memory = 256 } }

  # Transform: list of all timeouts
  all_timeouts = [for _, cfg in var.lambda_configs : cfg.timeout]
  # → [10, 5, 15] (order not guaranteed for maps)

  # String transformations
  upper_names = [for name in local.lambda_names : upper(name)]
  # → ["PRESIGN", "METADATA", "DELETE"]

  formatted_names = [
    for name in local.lambda_names :
    format("%s-%s-%s", var.project_name, var.stage, name)
  ]
  # → ["prasaarit-stg-presign", "prasaarit-stg-metadata", "prasaarit-stg-delete"]

  # Collection functions
  all_handlers = [for _, cfg in var.lambda_configs : cfg.handler]
  joined       = join(", ", local.all_handlers)
  total_memory = sum([for _, cfg in var.lambda_configs : cfg.memory])

  # CIDR math — carving subnets from a VPC CIDR
  public_subnets = [
    cidrsubnet(var.vpc_cidr, 8, 0),   # 10.0.0.0/24
    cidrsubnet(var.vpc_cidr, 8, 1),   # 10.0.1.0/24
    cidrsubnet(var.vpc_cidr, 8, 2),   # 10.0.2.0/24
  ]

  private_subnets = [
    cidrsubnet(var.vpc_cidr, 8, 10),  # 10.0.10.0/24
    cidrsubnet(var.vpc_cidr, 8, 11),  # 10.0.11.0/24
    cidrsubnet(var.vpc_cidr, 8, 12),  # 10.0.12.0/24
  ]

  # Type conversions
  timeout_strings = [for t in local.all_timeouts : tostring(t)]
  # → ["10", "5", "15"]

  deduped_memories = toset([for _, cfg in var.lambda_configs : cfg.memory])
  # → {128, 256}

  # try() — safely access an optional attribute
  sample_log_level = try(var.lambda_configs["presign"].log_level, "INFO")
  # → "INFO" (presign has no log_level, so try returns the fallback)
}

# ─── OUTPUTS ────────────────────────────────────────────────────────────────

output "lambda_names" {
  value = local.lambda_names
}

output "lambda_full_names" {
  value = local.lambda_full_names
}

output "high_memory_lambdas" {
  value       = local.high_memory_lambdas
  description = "Only lambdas with memory > 128MB"
}

output "string_functions" {
  value = {
    upper_names     = local.upper_names
    formatted_names = local.formatted_names
    joined_handlers = local.joined
  }
}

output "collection_functions" {
  value = {
    all_timeouts   = local.all_timeouts
    total_memory   = local.total_memory
    deduped_memories = tolist(local.deduped_memories)
    timeout_strings = local.timeout_strings
  }
}

output "cidr_math" {
  value = {
    vpc_cidr        = var.vpc_cidr
    public_subnets  = local.public_subnets
    private_subnets = local.private_subnets
    # The first host in the first public subnet:
    first_host = cidrhost(local.public_subnets[0], 1)  # → "10.0.0.1"
  }
}

output "try_demonstration" {
  value       = local.sample_log_level
  description = "try() returns 'INFO' because presign has no log_level attribute"
}

# ─── STORE in terraform_data ──────────────────────────────────────────────────

resource "terraform_data" "config" {
  input = {
    lambda_full_names = local.lambda_full_names
    public_subnets    = local.public_subnets
    private_subnets   = local.private_subnets
    total_memory_mb   = local.total_memory
  }
}
