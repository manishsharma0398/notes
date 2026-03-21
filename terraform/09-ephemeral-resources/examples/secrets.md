# Chapter 09 — Examples

## Example 1: Ephemeral Resource — Vault Dynamic Secret

```hcl
# Using Vault to issue a dynamic PostgreSQL credential that never lands in state.
# The credential is opened at apply-start, used for DB provisioning, and revoked at apply-end.

terraform {
  required_providers {
    vault = { source = "hashicorp/vault", version = "~> 4.0" }
    aws   = { source = "hashicorp/aws",   version = "~> 5.0" }
  }
}

# The Vault dynamic secret — opened on every plan/apply, never written to state
ephemeral "vault_database_secret" "app_db" {
  mount = "database"    # The Vault mount point
  name  = "app-role"    # The Vault role name
  # Vault will return username, password, and a lease_duration (RenewAt)
  # Terraform will renew before lease_duration expires if the apply takes longer
}

# Use the ephemeral credential to bootstrap an RDS user (as a Terraform resource)
resource "aws_db_instance" "main" {
  identifier     = "prod-app-db"
  engine         = "postgres"
  engine_version = "16.3"
  instance_class = "db.t4g.medium"
  storage_type   = "gp3"
  allocated_storage = 20

  db_name  = "appdb"
  username = ephemeral.vault_database_secret.app_db.username
  password = ephemeral.vault_database_secret.app_db.password
  # ↑ Used during apply, never written to state.
  # ↑ The RDS instance's password in AWS will be set but Terraform won't track the value.
}
```

---

## Example 2: Ephemeral Resource — AWS Secrets Manager Secret Version

```hcl
# Read a pre-existing secret from Secrets Manager ephemerally
# The secret value is used to configure a resource but never added to state

ephemeral "aws_secretsmanager_secret_version" "stripe_key" {
  secret_id = "prod/stripe/api-key"
  # Reads the current AWSCURRENT version on every apply
}

resource "aws_ssm_parameter" "app_config" {
  name  = "/app/prod/stripe-configured"
  type  = "String"
  value = "true"
  # We can't store stripe_key.secret_string here (that would write it to state)
  # Instead we use it: ↓
}

resource "aws_lambda_function" "payment_service" {
  function_name = "payment-service-prod"
  role          = aws_iam_role.lambda.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = data.archive_file.lambda.output_path

  environment {
    variables = {
      # Lambda environment vars ARE written to state (as Lambda config attributes)
      # To fully protect this, use Lambda env var encryption or Secrets Manager SDK calls
      STRIPE_API_KEY = ephemeral.aws_secretsmanager_secret_version.stripe_key.secret_string
    }
  }
}
```

---

## Example 3: Ephemeral Variable + Output (Module Boundary)

```hcl
# Child module: modules/app/variables.tf
variable "api_secret" {
  type        = string
  description = "API secret injected at apply time — ephemeral, not stored in state"
  ephemeral   = true   # Callers must provide an ephemeral value; prevents accidental state writes
  sensitive   = true
}

# Child module: modules/app/outputs.tf
output "configured" {
  value       = true   # Communicate success without leaking the secret
  description = "True when module has been configured with the API secret"
  # Do NOT output the secret itself. If you must, mark it ephemeral:
  # ephemeral = true
}

# Root module usage
ephemeral "aws_secretsmanager_secret_version" "api_secret" {
  secret_id = "my-api-secret"
}

module "app" {
  source     = "./modules/app"
  api_secret = ephemeral.aws_secretsmanager_secret_version.api_secret.secret_string
  # ↑ The ephemeral flow: secret_version → module variable → resource config
  #   Never written to state at any link in the chain
}
```

---

## Example 4: Write-Only Attribute (AWS Provider)

```hcl
# As of AWS provider v5.x, some resources have write-only attribute support.
# The password is used during apply but stored as null in state.
# Always check the specific provider version's docs for write-only support.

resource "aws_db_instance" "main" {
  identifier     = "prod-db"
  engine         = "mysql"
  instance_class = "db.t4g.small"
  username       = "admin"

  # If supported as write-only by the provider:
  # - Sent to AWS during apply (sets the actual password)
  # - Stored as null in state (via StripWriteOnlyAttributes in Terraform core)
  # - Shows as a diff on every plan (null in state vs non-null in config)
  password_wo         = var.db_password           # write-only variant
  password_wo_version = var.db_password_version   # bump this to trigger an actual update
}

variable "db_password" {
  type      = string
  sensitive = true
  ephemeral = true   # Prevent the password itself from being in the plan binary
}

variable "db_password_version" {
  type    = number
  default = 1
  # Increment this when you want Terraform to actually push the new password to RDS.
  # The write-only attribute itself always appears to change; this version number
  # disambiguates "intentional rotation" from "routine re-apply noise".
}
```

---

## State File Comparison

```json
// BEFORE (sensitive = true only — value in state):
{
  "resources": [{
    "type": "random_password",
    "name": "db",
    "instances": [{
      "attributes": {
        "result": "s3cretP@ssw0rd!"    ← PLAINTEXT in state
      }
    }]
  }]
}

// AFTER (write-only attribute — value nulled in state):
{
  "resources": [{
    "type": "aws_db_instance",
    "name": "main",
    "instances": [{
      "attributes": {
        "password_wo": null             ← null, not the password
      }
    }]
  }]
}

// EPHEMERAL resource — not in state at all:
{
  "resources": []   ← ephemeral resources have no state entry whatsoever
}
```
