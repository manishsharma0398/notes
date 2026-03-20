# Chapter 02 — Example 04: terraform_data — triggers, inputs, outputs
#
# This example requires NO cloud credentials.
# Demonstrates terraform_data as a null_resource replacement.
#
# EXERCISE:
#   1. touch dummy_payload.zip && terraform init && terraform apply
#   2. echo "changed" >> dummy_payload.zip && terraform plan
#      → observe terraform_data.zip_tracker replaces, deploy_trigger replaces
#   3. terraform apply — watch the "local-exec" fire
#   4. terraform plan again — no changes (file unchanged)

terraform {
  required_version = ">= 1.4"
}

# ─── PART A: Tracking a file hash in state ────────────────────────────────────

# This reads the file hash at plan time and stores it in state.
# When the file changes, this resource's "input" changes → it gets replaced.
resource "terraform_data" "zip_tracker" {
  # filebase64sha256 will error if the file doesn't exist.
  # Create it first: touch dummy_payload.zip
  input = fileexists("${path.module}/dummy_payload.zip") ? filebase64sha256("${path.module}/dummy_payload.zip") : "no-file"
}

output "current_zip_hash" {
  value       = terraform_data.zip_tracker.output
  description = "SHA256 hash of the Lambda zip file, stored in state"
}

# ─── PART B: Trigger a local script when the hash changes ──────────────────────

resource "terraform_data" "deploy_trigger" {
  # When zip_tracker.output changes (because zip changed),
  # this resource's triggers_replace changes → it gets REPLACED.
  # Being replaced causes the local-exec provisioner to re-run.
  triggers_replace = [terraform_data.zip_tracker.output]

  provisioner "local-exec" {
    # In real usage: send Slack notification, invalidate CloudFront, etc.
    command = "echo 'Deploy triggered! Hash: ${terraform_data.zip_tracker.output}'"
  }
}

# ─── PART C: Comparing old null_resource pattern (annotated) ──────────────────

# OLD WAY — requires hashicorp/null provider:
# terraform {
#   required_providers {
#     null = {
#       source  = "hashicorp/null"
#       version = "~> 3.0"
#     }
#   }
# }
#
# resource "null_resource" "deploy_trigger" {
#   triggers = {
#     # triggers values must ALL be strings — less flexible
#     zip_hash = filebase64sha256("dummy_payload.zip")
#   }
#   provisioner "local-exec" {
#     command = "echo 'Deployed!'"
#   }
# }
#
# NEW WAY WITH terraform_data:
# - No required_providers entry needed
# - triggers_replace accepts ANY type (not just map(string))
# - Can store values via input/output for other resources to reference

# ─── PART D: storing computed values for cross-resource use ──────────────────

resource "terraform_data" "environment_config" {
  input = {
    version    = "1.2.3"
    zip_hash   = terraform_data.zip_tracker.output
    deployed_at = "2026-03-20"
  }
}

output "environment_config" {
  value       = terraform_data.environment_config.output
  description = "Deployment metadata — other resources can reference .output.version etc."
}

# To reference the version from another resource:
#   terraform_data.environment_config.output.version
# This creates an implicit dependency edge in the graph (Chapter 01).
