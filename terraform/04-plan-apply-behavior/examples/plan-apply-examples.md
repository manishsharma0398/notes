# Chapter 04 — Plan and Apply Behavior — Examples

All examples are annotated HCL and bash — illustrating plan output, lifecycle controls, and validation patterns.

---

## Example 1 — Reading Plan Output Symbols

```
Terraform will perform the following actions:

  # + CREATE — resource not in state
  + resource "aws_iam_role" "lambda_exec" {
      + arn  = (known after apply)           # computed by AWS after create
      + name = "prasaarit-stg-lambda-exec"
    }

  # ~ UPDATE in-place — attribute changed, not ForceNew
  ~ resource "aws_lambda_function" "presign" {
      ~ timeout     = 10 → 30               # in-place update, no downtime, same ARN
      ~ memory_size = 128 → 256
        function_name = "prasaarit-presign-stg"  # unchanged
    }

  # -/+ REPLACE — ForceNew attribute changed
  -/+ resource "aws_lambda_function" "presign" {
      ~ arn           = "arn:...old" → (known after apply)
      ~ function_name = "old-name" → "new-name"   (forces replacement)  ← DANGER
        runtime       = "python3.12"
    }

  # - DESTROY — resource removed from config
  - resource "aws_api_gateway_stage" "old_stage" {
      - stage_name = "old-stg" → null
    }

Plan: 1 to add, 1 to change, 1 to destroy.
```

**Mandatory checklist before every apply:**
1. Every `+` — is this create expected? New resource block you intentionally added?
2. Every `-/+` — do you understand the ForceNew attribute? Is the replacement intentional?
3. Every `-` — do you know what you're deleting? Is data loss possible?
4. Every `(forces replacement)` label — confirms which attribute is driving the destroy+create

---

## Example 2 — Lifecycle Blocks in Practice

```hcl
# ─── PROTECT your RDS database ────────────────────────────────────────────────
resource "aws_db_instance" "main" {
  identifier = "prasaarit-db"
  # ...
  lifecycle {
    prevent_destroy = true    # Terraform REFUSES to plan destruction
  }
}

# Try renaming the identifier → terraform plan errors:
#   Error: Instance cannot be destroyed
#   "prasaarit-db" has lifecycle.prevent_destroy set

# ─── API Gateway deployments — MUST replace when routes change ─────────────────
resource "aws_api_gateway_deployment" "deploy" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  lifecycle {
    replace_triggered_by = [
      aws_api_gateway_integration.presign,
      aws_api_gateway_method.presign_post,
      aws_api_gateway_resource.presign_route,
    ]
    create_before_destroy = true   # new deployment before old is destroyed
  }
}

# ─── IGNORE attributes managed by external automation ──────────────────────────
resource "aws_autoscaling_group" "app" {
  desired_capacity = 2
  lifecycle {
    ignore_changes = [
      desired_capacity,    # ASG scaling policies change this — don't revert
      tags,                # AWS Config compliance tags — don't revert
    ]
  }
}
# WARNING: when this ASG is replaced for any reason, the new one gets
# desired_capacity = 2 (from config), NOT whatever the cloud reports (e.g. 12).
```

---

## Example 3 — Preconditions, Postconditions, and `check` Blocks

```hcl
# ─── precondition: validate at plan time ──────────────────────────────────────
resource "aws_db_instance" "main" {
  instance_class = var.db_instance_class
  # ...
  lifecycle {
    precondition {
      condition     = contains(["db.t3.micro", "db.t3.small", "db.t3.medium"], var.db_instance_class)
      error_message = "Only approved db.t3 instance classes may be used. Got: ${var.db_instance_class}."
    }
    # postcondition: assert actual cloud state after apply
    postcondition {
      condition     = self.storage_encrypted == true
      error_message = "RDS instance storage is not encrypted. Check account encryption policy."
    }
  }
}

# ─── check block: post-apply health assertion (does NOT fail the apply) ────────
check "api_health" {
  data "http" "ping" {
    url = "https://${aws_api_gateway_stage.stg.invoke_url}/health"
  }
  assert {
    condition     = data.http.ping.status_code == 200
    error_message = "API health check returned ${data.http.ping.status_code} — verify Lambda is running."
  }
}

# When the health check fails: terraform apply SUCCEEDS but shows:
#   Warning: Check block assertion failed
#     api_health: API health check returned 502
# This warns without undoing the apply.
# To make this blocking, use a postcondition inside the Lambda resource instead.
```

---

## Example 4 — Saved Plan Files

```bash
# PROBLEM: you plan at 10am, review it, apply at 11am.
# Between 10–11am, a teammate applied changes to the cloud.
# terraform apply without a saved plan computes a NEW plan inline — different from what you reviewed.

# SOLUTION: saved plan files
terraform plan  -out=deploy.tfplan    # saves the exact plan as binary

# Review the plan before applying:
terraform show deploy.tfplan           # human-readable
terraform show -json deploy.tfplan     # JSON (for automation/CI)

terraform apply deploy.tfplan          # applies EXACTLY what was reviewed — no re-plan

# In CI/CD:
# Job 1: terraform plan -out=plan.tfplan → upload to artifact store + block for approval
# Job 2 (after approval): terraform apply plan.tfplan → no re-plan, deterministic
```

---

## Example 5 — `-target` as a Debugging Tool (Not a Workflow)

```bash
# Scenario: Lambda create fails (bad handler path). IAM role and API GW are fine.

# Step 1: Fix the handler in config

# Step 2: Target just the Lambda
terraform plan  -target=aws_lambda_function.presign
terraform apply -target=aws_lambda_function.presign
# State now has the Lambda. But integration, permission, deployment are still missing.

# Step 3: ALWAYS follow with a full apply
terraform plan   # no -target — shows all remaining resources
terraform apply  # creates integration, permission, deployment, stage
# State now matches config fully.

# ANTI-PATTERN: using -target repeatedly without ever doing a full apply
# → state drifts further from config every week
# → a full plan eventually reveals dozens of unexpected changes
# → root fix: split the monolith into smaller stacks, not more -target flags
```
