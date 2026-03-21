# OIDC IAM Bootstrap — Terraform Example

This is the one-time bootstrap Terraform that creates the OIDC trust between
AWS and your CI system. It lives in a separate "bootstrap" or "platform" repo —
NOT in the application repo being deployed.

```hcl
# oidc-bootstrap/main.tf

terraform {
  required_version = ">= 1.11"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ─── Variables ───────────────────────────────────────────────────────────────

variable "gitlab_namespace" {
  description = "GitLab group or user namespace"
  type        = string
  # example: "myorg"
}

variable "gitlab_project" {
  description = "GitLab project name"
  type        = string
  # example: "infra-repo"
}

variable "deploy_role_name" {
  description = "Name for the IAM role CI pipelines will assume"
  type        = string
  default     = "terraform-ci-deploy"
}

# ─── GitLab OIDC Provider ───────────────────────────────────────────────────

data "tls_certificate" "gitlab" {
  # Fetch GitLab's current TLS certificate thumbprint automatically
  url = "https://gitlab.com"
}

resource "aws_iam_openid_connect_provider" "gitlab" {
  url = "https://gitlab.com"

  # The audience GitLab includes in its issued JWTs
  client_id_list = ["https://gitlab.com"]

  # thumbprint_list is required but AWS re-validates the cert automatically
  thumbprint_list = [data.tls_certificate.gitlab.certificates[0].sha1_fingerprint]

  tags = {
    ManagedBy = "terraform"
    Purpose   = "CI/CD OIDC trust"
  }
}

# ─── IAM Role CI Pipelines Assume ───────────────────────────────────────────

resource "aws_iam_role" "ci_deploy" {
  name        = var.deploy_role_name
  description = "Assumed by GitLab CI pipelines via OIDC; no long-lived keys"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "GitLabOIDC"
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.gitlab.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            # Audience must match what we set in client_id_list
            "gitlab.com:aud" = "https://gitlab.com"
          }
          StringLike = {
            # SCOPE THIS TO THE MINIMUM:
            # {namespace}/{project}:ref_type:{branch|tag}:ref:{ref_name}
            # Use StringLike (not StringEquals) only if you need wildcards.
            # Use StringEquals for a single, exact principal.
            "gitlab.com:sub" = "project_path:${var.gitlab_namespace}/${var.gitlab_project}:ref_type:branch:ref:main"
          }
        }
      }
    ]
  })

  tags = {
    ManagedBy = "terraform"
    Purpose   = "CI/CD deploy role"
  }
}

# ─── Permissions for the Deployer Role ──────────────────────────────────────

# In a real setup, replace AdministratorAccess with a least-privilege policy
# scoped to exactly the resources Terraform manages (S3, Lambda, IAM, etc.)
resource "aws_iam_role_policy_attachment" "ci_deploy_admin" {
  role       = aws_iam_role.ci_deploy.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
  # ⚠️ Replace with a scoped policy in production
}

# ─── Outputs ─────────────────────────────────────────────────────────────────

output "deploy_role_arn" {
  description = "ARN to set as AWS_ROLE_ARN in GitLab CI variables"
  value       = aws_iam_role.ci_deploy.arn
}

output "oidc_provider_arn" {
  description = "OIDC provider ARN (informational)"
  value       = aws_iam_openid_connect_provider.gitlab.arn
}
```

---

## GitHub Actions Variant (different OIDC endpoint)

```hcl
# For GitHub Actions, replace the GitLab OIDC provider with:

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

# Trust policy condition for GitHub Actions:
Condition = {
  StringEquals = {
    "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
  }
  StringLike = {
    # Scope to specific repo and branch
    "token.actions.githubusercontent.com:sub" = "repo:myorg/myrepo:ref:refs/heads/main"
  }
}
```

---

## Anti-Pattern: Long-Lived Keys in CI Variables

```hcl
# THIS IS WHAT YOU ARE REPLACING
# These would be stored in GitLab Settings > CI/CD > Variables
# AWS_ACCESS_KEY_ID    = "AKIAIOSFODNN7EXAMPLE"    ← never expires, stored in GitLab
# AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/..."  ← if leaked, full account access

# With OIDC, there are NO secrets stored anywhere.
# The IAM role Trust Policy IS the secret — it defines who can assume the role.
```
