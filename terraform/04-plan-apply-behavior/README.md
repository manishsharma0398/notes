# Chapter 04 — Plan and Apply Behavior

## Mental Model

When Terraform computes a plan, it decides one of **five actions** for each resource. Understanding what triggers each action — and which ones are dangerous — is the difference between a safe deploy and a production incident.

```
┌────────────────────────────────────────────────────────────────────┐
│                     PLAN ACTIONS                                   │
├──────────────┬─────────────────────────────────────────────────────┤
│  + create    │  Resource exists in config, NOT in state            │
│  ~ update    │  Resource exists in both, attribute changed         │
│              │  (provider says: updateable in-place)               │
│  -/+ replace │  Resource exists in both, attribute changed         │
│              │  (provider says: ForceNew — must destroy + create)  │
│  - destroy   │  Resource exists in state, NOT in config            │
│  <= read     │  Data source — read from cloud, no mutation         │
└──────────────┴─────────────────────────────────────────────────────┘
```

The critical insight:

> **You do not control** whether a change is an update or a replace. **The provider decides.** Each attribute in the provider's schema has a `ForceNew` flag. If a `ForceNew` attribute changes, the provider tells Terraform "this resource cannot be updated in-place — it must be destroyed and recreated." Terraform just follows orders.

---

## Create

Triggered when a resource is in your config but not in state (first apply, or you added a new resource block).

```
Plan output:
  + resource "aws_lambda_function" "presign" {
      + arn           = (known after apply)
      + function_name = "prasaarit-presign-stg"
      + runtime       = "python3.12"
      ...
    }
```

**What happens during apply:**
1. Terraform calls provider's `ApplyResourceChange` with `PriorState = null`
2. Provider calls the AWS API (e.g., `lambda:CreateFunction`)
3. Provider returns the new state (with ARN, ID, etc.)
4. Terraform writes it to state

**No surprises here.** Creates are safe.

---

## Update In-Place

Triggered when a resource exists in both config and state, an attribute changed, and that attribute is NOT marked `ForceNew` in the provider schema.

```
Plan output:
  ~ resource "aws_lambda_function" "presign" {
      ~ timeout     = 10 → 30       # ← in-place update
      ~ memory_size = 128 → 256     # ← in-place update
        # (5 unchanged attributes hidden)
    }
```

**What happens during apply:**
1. Terraform calls `ApplyResourceChange` with both old and new state
2. Provider calls the AWS API (e.g., `lambda:UpdateFunctionConfiguration`)
3. Provider returns the updated state
4. Terraform writes it to state

**The resource is never destroyed.** The ARN, ID, and all non-changed attributes remain the same. This is safe.

---

## Replace (Destroy + Create) — The Dangerous One

Triggered when a `ForceNew` attribute changes. The provider says "I cannot update this in-place — the AWS API doesn't support it."

```
Plan output:
  -/+ resource "aws_lambda_function" "presign" {
      ~ arn           = "arn:...old..." → (known after apply)    # ← new ARN!
      ~ function_name = "presign-old" → "presign-new"           # ← ForceNew attribute
      ~ id            = "presign-old" → (known after apply)
        runtime       = "python3.12"                             # unchanged
    }
```

### Default Replace Order: Destroy-Then-Create

```
1. DESTROY the old resource → AWS API: lambda:DeleteFunction
2. CREATE the new resource → AWS API: lambda:CreateFunction
```

**The gap**: Between steps 1 and 2, the resource **does not exist**. If anything references this resource (API Gateway integration, IAM role attachment), those references break during the gap.

**For your Prasaarit project**: If you rename `function_name`, Terraform replaces the Lambda. During the gap, your API Gateway integration points to a deleted Lambda. Any requests during this window fail with 5xx errors.

### ForceNew Attributes You Must Know

These are the attributes that cause a **destroy + create** if changed. Missing this in `plan` output is the most common cause of accidental production incidents:

| Resource | ForceNew Attributes | Why |
|----------|-------------------|------|
| `aws_lambda_function` | `function_name` | AWS doesn't support renaming a Lambda |
| `aws_iam_role` | `name` | IAM roles can't be renamed |
| `aws_api_gateway_rest_api` | (none — most attributes updateable) | — |
| `aws_s3_bucket` | `bucket` | Bucket names are globally unique and immutable |
| `aws_db_instance` (RDS) | `identifier`, `engine`, `availability_zone` | Database must be rebuilt |
| `aws_instance` (EC2) | `ami`, `instance_type` (sometimes), `subnet_id` | New instance required |

### How to Check if an Attribute is ForceNew

1. **Read the plan output** — look for `-/+` (replace) vs `~` (update)
2. **Provider docs** — the attribute description says "Changing this forces a new resource"
3. **Provider source code** — search for `ForceNew: true` in the resource's schema definition

---

## `lifecycle` Blocks — Controlling Plan/Apply Behavior

The `lifecycle` block is a **meta-argument** that modifies how Terraform handles a resource during plan and apply. It goes inside a resource block.

### `create_before_destroy` — Eliminate the Gap

```hcl
resource "aws_lambda_function" "presign" {
  function_name = "prasaarit-presign-stg"
  # ...

  lifecycle {
    create_before_destroy = true
  }
}
```

**What changes:**

```
Without create_before_destroy (default):
  1. DESTROY old Lambda   ← GAP: no Lambda exists
  2. CREATE new Lambda

With create_before_destroy:
  1. CREATE new Lambda    ← both exist simultaneously
  2. DESTROY old Lambda
```

**Eliminates the downtime gap.** But there's a catch:

**Name collision**: If the `function_name` is what changed (and triggered ForceNew), both old and new Lambdas need the same name — which fails. `create_before_destroy` works best when the ForceNew attribute is something like a launch template version, not a unique identifier.

**Pattern**: Use random suffixes in resource names so old and new can coexist:

```hcl
resource "random_id" "suffix" {
  byte_length = 4

  keepers = {
    # Regenerate suffix when these change
    function_name = "prasaarit-presign-stg"
  }
}

resource "aws_lambda_function" "presign" {
  function_name = "prasaarit-presign-stg-${random_id.suffix.hex}"

  lifecycle {
    create_before_destroy = true
  }
}
```

### `prevent_destroy` — Guardrail Against Accidental Deletion

```hcl
resource "aws_db_instance" "main" {
  identifier = "prasaarit-db"
  # ...

  lifecycle {
    prevent_destroy = true
  }
}
```

If anything tries to destroy this resource (removing from config, renaming the resource, changing a ForceNew attribute), Terraform **refuses** with an error:

```
Error: Instance cannot be destroyed
  resource "aws_db_instance" "main" has lifecycle.prevent_destroy set,
  but the plan calls for this resource to be destroyed.
```

**Use this on**:
- Databases (RDS, DynamoDB tables)
- S3 buckets with important data
- Any resource where accidental destruction causes data loss

**What `prevent_destroy` does NOT prevent**:
- `terraform state rm` — removes from state without asking lifecycle
- `terraform destroy -target` — does NOT bypass it (still errors)
- Deleting the resource in the AWS console — Terraform can't prevent that
- Removing the resource block AND the `prevent_destroy` in the same commit

### `ignore_changes` — Tolerate External Modifications

```hcl
resource "aws_lambda_function" "presign" {
  function_name = "prasaarit-presign-stg"
  timeout       = 10
  # ...

  lifecycle {
    ignore_changes = [
      timeout,          # ← Don't revert if someone changes timeout in console
      environment,      # ← Don't revert env var changes made by deployment scripts
    ]
  }
}
```

During plan, Terraform **skips** the listed attributes when computing the diff. Even if the cloud value differs from the config value, Terraform won't plan a change.

**When to use:**
- Attributes set by external automation (e.g., Auto Scaling changes `desired_capacity`)
- Tags added by AWS Config, Security Hub, or organizational tag policies
- Lambda environment variables modified by a separate deployment pipeline

**Danger**: `ignore_changes` hides drift. Your config says `timeout = 10`, the cloud says `timeout = 30`, and Terraform says "no changes." This makes your config a liar — it no longer reflects reality.

**Nuclear option**: `ignore_changes = all` — ignores ALL attribute changes. Terraform only manages creation, never updates. This is almost always wrong unless you're bridging two management systems.

### `replace_triggered_by` — Force Replacement Based on External Changes

```hcl
resource "aws_api_gateway_deployment" "deploy" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  lifecycle {
    replace_triggered_by = [
      aws_api_gateway_integration.presign,   # ← if the integration changes,
      aws_api_gateway_method.presign_post,    #    force a new deployment
    ]
  }
}
```

Normally, API Gateway deployments are immutable — you create new ones, you don't update old ones. `replace_triggered_by` tells Terraform: "if any of these referenced resources change, replace this resource too."

**This is essential for API Gateway** because deployments capture a snapshot of your API configuration. If you change a method or integration but don't create a new deployment, your live API doesn't change.

---

## The `-target` Flag

`-target` restricts `plan`/`apply` to a specific resource (and its dependencies).

```bash
terraform plan -target=aws_lambda_function.presign
terraform apply -target=aws_lambda_function.presign
```

### What `-target` Does

1. Terraform builds the full dependency graph.
2. It prunes everything NOT in the target's dependency chain.
3. It plans/applies only the remaining subgraph.

```
Full graph:                          Targeted graph (-target=Lambda):

  IAM Role                            IAM Role
     │                                   │
     ▼                                   ▼
  Lambda ◄── API GW                   Lambda
     │          │
     ▼          ▼                     (API GW, deployment, stage
  Permission  Deployment               are pruned — not touched)
                │
                ▼
              Stage
```

### When `-target` is Appropriate

| Scenario | Why |
|----------|-----|
| Debugging one failing resource | Focus on just the resource that errors |
| Breaking a circular dependency during first apply | Apply resources in stages |
| Applying an urgent hotfix to one resource | Don't touch the rest of the stack |
| Working around `for_each` limitations | Apply the data source first, then the rest |

### When `-target` is Dangerous

**`-target` creates partial state.** After a targeted apply, your state may not reflect the full config:

```bash
# You add both a Lambda and API GW to your config.
# You run: terraform apply -target=aws_lambda_function.presign
# Only the Lambda is created. State has the Lambda but not the API GW.
# The next full "terraform plan" shows the API GW still needs to be created.
```

If you keep using `-target` repeatedly without ever doing a full apply, your state drifts further from your config. This is tech debt.

> **Rule**: `-target` is a debugging tool, not a workflow. Always follow up with a full `terraform apply` (no `-target`) to reconcile state with config.

---

## Partial Apply Behavior — Deep Dive

We covered this briefly in Chapter 01. Let's go deeper with your Prasaarit stack:

```
Apply graph for your upload service:

  1. aws_iam_role.lambda_exec               ─┐
  2. aws_iam_role_policy.lambda_s3           ─┤ (depends on 1)
  3. aws_api_gateway_rest_api.api            ─┤ (independent of 1-2)
  4. aws_lambda_function.presign             ─┤ (depends on 1, 2)
  5. aws_api_gateway_resource.presign_route  ─┤ (depends on 3)
  6. aws_api_gateway_method.post             ─┤ (depends on 5)
  7. aws_lambda_permission.apigw             ─┤ (depends on 3, 4)
  8. aws_api_gateway_integration.presign     ─┤ (depends on 4, 6)
  9. aws_api_gateway_deployment.deploy       ─┤ (depends on 8)
 10. aws_api_gateway_stage.stg              ─┘ (depends on 9)
```

### Scenario: Resource 4 (Lambda) Fails

```
Resources 1-2: ✅ Created (IAM role + policy)
Resource 3:    ✅ Created (API Gateway REST API — independent, ran concurrently)
Resource 4:    ❌ FAILED (Lambda creation error — maybe invalid handler path)
Resource 5:    ✅ Created (API GW resource — depends on 3, not on 4)
Resource 6:    ✅ Created (API GW method — depends on 5, not on 4)
Resource 7:    ⏭️ SKIPPED (depends on 4 which failed)
Resource 8:    ⏭️ SKIPPED (depends on 4 which failed)
Resource 9:    ⏭️ SKIPPED (depends on 8 which was skipped)
Resource 10:   ⏭️ SKIPPED (depends on 9 which was skipped)
```

**State after partial apply:**
- Resources 1, 2, 3, 5, 6 are in state ✅
- Resources 4, 7, 8, 9, 10 are NOT in state ❌

**Recovery:**
1. Fix the Lambda config (correct the handler path)
2. Run `terraform plan` — it shows 5 resources to create (4, 7, 8, 9, 10)
3. Run `terraform apply` — picks up where it left off

This is why Terraform's "write-to-state-after-each-resource" design matters. You never lose track of what was created.

### The Edge Case: Resource Created in Cloud But Not in State

Sometimes a cloud API call succeeds, but Terraform fails to write to state (network glitch, process killed). The resource exists in AWS but isn't in state.

On the next `plan`:
- Terraform wants to **create** the resource (it's in config but not in state)
- AWS API says "already exists" → **error**

**Fix**: `terraform import <address> <cloud-id>` to bring it into state.

---

## `terraform destroy` — The Reverse Apply

```bash
terraform destroy
```

`destroy` builds a **destroy graph** — the reverse of the apply graph. Resources are destroyed in reverse dependency order:

```
Destroy order (reverse of apply):
 10. aws_api_gateway_stage.stg              (destroyed first)
  9. aws_api_gateway_deployment.deploy
  8. aws_api_gateway_integration.presign
  7. aws_lambda_permission.apigw
  6. aws_api_gateway_method.post
  5. aws_api_gateway_resource.presign_route
  4. aws_lambda_function.presign
  3. aws_api_gateway_rest_api.api
  2. aws_iam_role_policy.lambda_s3
  1. aws_iam_role.lambda_exec               (destroyed last)
```

Terraform destroys dependents first, then dependencies. This ensures you don't delete an IAM role while a Lambda still references it.

**Targeted destroy:**

```bash
terraform destroy -target=aws_lambda_function.presign
# Destroys ONLY the Lambda (and nothing else).
# WARNING: API GW integration now points to a deleted Lambda.
# The state still has the integration, but it's broken.
```

---

## Reading Plan Output — Cheat Sheet

```
Symbols in plan output:

  +     create          Safe. New resource.
  -     destroy         DANGER. Resource deleted.
  ~     update          Usually safe. In-place change.
  -/+   replace         DANGER. Destroy + create. Downtime possible.
  +/-   replace          Same as above (create_before_destroy).
  <=    read            Data source refresh. No mutation.

Attribute markers:

  (known after apply)      Value computed by the cloud. Only available after apply.
  (sensitive)              Value hidden from output (still in state plaintext).
  -> (forces replacement)  THIS attribute change causes destroy + create.
```

**The most important thing you can do before every `apply`:**

1. Read the entire plan output
2. Look for `-/+` (replace) — is the replacement expected?
3. Look for `- destroy` — is the deletion expected?
4. Check `(forces replacement)` markers — do you understand why?

---

## What Terraform Guarantees About Plan/Apply

| Guarantee | Details |
|-----------|---------|
| **Plan before apply** | Apply only executes actions shown in the plan. No surprises. (Unless you `apply` without a saved plan — then a new plan is computed inline.) |
| **Dependency ordering** | Resources are created in dependency order, destroyed in reverse |
| **Immediate state write** | State is updated after each resource, enabling safe recovery from partial failures |
| **`prevent_destroy` enforcement** | Terraform refuses to plan destruction of protected resources |

## What Terraform Does NOT Guarantee

| Non-guarantee | Why it matters |
|--------------|----------------|
| **Plan stability** | The plan is valid at the moment it's computed. If the cloud changes between `plan` and `apply`, the apply may fail. Use saved plan files (`plan -out=plan.tfplan`) to lock the plan. |
| **Zero-downtime replace** | Default replace is destroy-then-create. There IS a gap. `create_before_destroy` helps but doesn't solve naming conflicts. |
| **Idempotent apply** | Applying the same plan twice can fail if the first apply already created the resources. Always use saved plan files. |
| **Complete rollback** | There is NO rollback. A failed apply leaves partial state. You move forward (fix and re-apply), never backward. |

---

## Source References

- [Resource Lifecycle](https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle) — official docs
- [Plan and Apply](https://developer.hashicorp.com/terraform/cli/commands/plan) — CLI reference
- [ForceNew in Providers](https://developer.hashicorp.com/terraform/plugin/sdkv2/schemas/schema-behaviors#forcenew) — provider schema docs
- [terraform-provider-aws schema](https://github.com/hashicorp/terraform-provider-aws) — check ForceNew attributes in source
