# Chapter 02 — Example 02: Variables, validation, and locals
#
# EXERCISE:
#   1. terraform init && terraform apply — observe defaults
#   2. terraform apply -var="stage=prod" — watch locals update
#   3. terraform apply -var="lambda_timeout=950" — observe validation error
#   4. Create a terraform.tfvars file with different values — observe override
#   5. TF_VAR_stage=prod terraform plan — env var beats tfvars

terraform {
  required_version = ">= 1.4"
}

# ─── VARIABLES ────────────────────────────────────────────────────────────────

variable "project_name" {
  description = "Project name used as prefix for all resources"
  type        = string
  default     = "prasaarit"
}

variable "stage" {
  description = "Deployment stage (stg, prod)"
  type        = string
  default     = "stg"

  validation {
    condition     = contains(["stg", "prod"], var.stage)
    error_message = "stage must be one of: stg, prod"
  }
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 10

  validation {
    condition     = var.lambda_timeout >= 1 && var.lambda_timeout <= 900
    error_message = "Lambda timeout must be between 1 and 900 seconds."
  }
}

variable "allowed_origins" {
  description = "CORS origins allowed to call the API"
  type        = list(string)
  default     = ["*"]
}

variable "feature_flags" {
  description = "Optional feature toggles"
  type = object({
    enable_cors     = optional(bool, true)
    enable_tracing  = optional(bool, false)
    log_level       = optional(string, "INFO")
  })
  default = {}
}

# ─── LOCALS — derived values (never exposed as variables) ─────────────────────

locals {
  prefix       = "${var.project_name}-${var.stage}"
  lambda_name  = "${local.prefix}-presign"
  is_prod      = var.stage == "prod"

  # Computed values from feature flags using try() for optional fields
  log_level     = try(var.feature_flags.log_level, "INFO")
  enable_tracing = try(var.feature_flags.enable_tracing, false)

  # Conditional: longer log retention in prod
  log_retention_days = local.is_prod ? 90 : 14

  common_tags = {
    Project   = var.project_name
    Stage     = var.stage
    ManagedBy = "terraform"
  }
}

# ─── OUTPUTS — show computed values ────────────────────────────────────────────

output "prefix" {
  value       = local.prefix
  description = "Naming prefix for all resources"
}

output "lambda_name" {
  value       = local.lambda_name
  description = "Full Lambda function name"
}

output "config_summary" {
  value = {
    is_production      = local.is_prod
    log_retention_days = local.log_retention_days
    log_level          = local.log_level
    timeout_seconds    = var.lambda_timeout
    cors_origins       = var.allowed_origins
    tags               = local.common_tags
  }
  description = "Summary of resolved configuration values"
}

# ─── terraform_data — store computed values in state ──────────────────────────

resource "terraform_data" "config_snapshot" {
  input = {
    prefix        = local.prefix
    log_retention = local.log_retention_days
    is_prod       = local.is_prod
    tags          = local.common_tags
  }
}

output "state_snapshot" {
  value       = terraform_data.config_snapshot.output
  description = "Configuration snapshot stored in state"
}
