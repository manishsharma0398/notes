# Plan and Apply Behavior — Examples

## Example 1: Reading Plan Output Symbols

```
# Annotated plan output — study each symbol:

Terraform will perform the following actions:

  # CREATE — resource not in state
  + resource "aws_iam_role" "lambda_exec" {
      + arn  = (known after apply)         # ← computed by AWS
      + name = "prasaarit-stg-lambda-exec"
    }

  # UPDATE in-place — attribute changed, not ForceNew
  ~ resource "aws_lambda_function" "presign" {
      ~ timeout     = 10 → 30             # ← in-place update, no downtime
      ~ memory_size = 128 → 256           # ← in-place update
        function_name = "prasaarit-presign-stg"  # ← unchanged (shown for context)
    }

  # REPLACE — ForceNew attribute changed
  -/+ resource "aws_lambda_function" "presign" {
      ~ arn           = "arn:...old" → (known after apply)
      ~ function_name = "old-name" → "new-name"   # forces replacement  ← DANGER
      ~ id            = "old-name" → (known after apply)
        runtime       = "python3.12"               # unchanged
    }

  # DESTROY — resource removed from config
  - resource "aws_api_gateway_stage" "old_stage" {
      - stage_name = "old-stg" → null
    }

Plan: 1 to add, 1 to change, 1 to destroy.
```

**Your checklist before typing "yes":**
1. ✅ Is the `+` (create) expected? → Yes, new role
2. ⚠️ Is the `-/+` (replace) expected? → Check WHY. Is `function_name` change intentional?
3. ⚠️ Is the `-` (destroy) expected? → Are you removing `old_stage` on purpose?

---

## Example 2: Lifecycle Blocks in Practice

```hcl
# === PROTECT YOUR DATABASE ===
resource "aws_db_instance" "main" {
  identifier = "prasaarit-db"
  # ...

  lifecycle {
    prevent_destroy = true    # Terraform REFUSES to plan destruction
  }
}

# Try changing `identifier` with prevent_destroy:
# terraform plan →
#   Error: Instance cannot be destroyed
#   "prasaarit-db" has lifecycle.prevent_destroy set


# === API GATEWAY DEPLOYMENT ===
# Deployments must be recreated when routes change
resource "aws_api_gateway_deployment" "deploy" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  lifecycle {
    # Without this, changing a method/integration does NOT create a new deployment
    # Your API stays on the old config!
    replace_triggered_by = [
      aws_api_gateway_integration.presign,
      aws_api_gateway_method.presign_post,
    ]
  }
}


# === IGNORE EXTERNAL CHANGES ===
resource "aws_autoscaling_group" "app" {
  desired_capacity = 2

  lifecycle {
    # ASG scaling policies change desired_capacity dynamically.
    # Don't revert it to 2 on every apply!
    ignore_changes = [desired_capacity]
  }
}
```

---

## Example 3: Saved Plan Files

```bash
# PROBLEM: You run "plan" at 10am, review it, then "apply" at 11am.
# Between 10am-11am, a teammate changed something in the cloud.
# "terraform apply" computes a NEW plan inline — it's different from what you reviewed!

# SOLUTION: Saved plan files
terraform plan -out=deploy.tfplan     # Saves the exact plan
# Review the plan...
terraform apply deploy.tfplan          # Applies EXACTLY what you reviewed

# The saved plan is a binary file, not readable.
# Use "terraform show" to read it:
terraform show deploy.tfplan           # Human-readable plan
terraform show -json deploy.tfplan     # JSON for automation
```

---

## Example 4: The `-target` Workflow

```bash
# Scenario: Your Lambda creation fails because of a bad handler path.
# But the IAM role and API Gateway are fine.
# You only want to re-apply the Lambda.

# Step 1: Fix the handler path in your .tf file

# Step 2: Target just the Lambda
terraform plan -target=aws_lambda_function.presign
# Shows: 1 to add (just the Lambda)

terraform apply -target=aws_lambda_function.presign
# Creates only the Lambda. Dependencies (IAM role) already exist in state.

# Step 3: ALWAYS follow with a full apply
terraform plan      # No -target. Shows remaining resources (integration, permission, etc.)
terraform apply     # Creates the rest. Now state matches config fully.
```
