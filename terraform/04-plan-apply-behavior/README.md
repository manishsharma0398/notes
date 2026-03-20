# Chapter 04 — Plan and Apply Behavior

## Mental Model

When Terraform computes a plan, it decides one of five actions for each resource. Understanding what triggers each action — and which ones are dangerous — is the difference between a safe deploy and a production incident.

```
┌──────────────────────────────────────────────────────────────────────┐
│                        PLAN ACTIONS                                  │
├──────────┬───────────────────────────────────────────────────────────┤
│  +       │  Create — in config, not in state                         │
│  ~       │  Update in-place — attribute changed, provider says OK    │
│  -/+     │  Replace — attribute changed, provider says ForceNew      │
│  +/-     │  Replace (create-before-destroy) — same, different order  │
│  -       │  Destroy — in state, not in config                        │
│  <=      │  Read — data source refresh, no mutation                  │
└──────────┴───────────────────────────────────────────────────────────┘
```

The critical insight:

> **You do not control** whether a change is an update or a replace. **The provider decides.** Each attribute in the provider schema has a `ForceNew` flag. If a `ForceNew` attribute changes, the provider tells Terraform: "this resource cannot be updated in-place — destroy and recreate." Terraform follows.

---

## Create, Update, and Replace

### Create (`+`)

Triggered when a resource is in config but not in state (first apply, or a new resource block).

What happens: provider calls `ApplyResourceChange` with `PriorState = null` → cloud API creates the resource → provider returns the new state with ARN/ID → Terraform writes to state.

Creates are safe. No existing resource is affected.

### Update In-Place (`~`)

Triggered when a resource exists in both config and state, an attribute changed, and that attribute is **not** marked `ForceNew`. The provider updates the resource via an API call that preserves the resource's identity.

```
Plan output:
  ~ resource "aws_lambda_function" "presign" {
      ~ timeout     = 10 → 30
      ~ memory_size = 128 → 256
        (5 unchanged attributes hidden)
    }
```

The resource ARN, ID, and all other attributes remain the same. Safe.

### Replace (`-/+`) — The Dangerous One

Triggered when a `ForceNew` attribute changes. The AWS API has no UPDATE path for this attribute: the only way to change it is destroy then create.

```
Plan output:
  -/+ resource "aws_lambda_function" "presign" {
      ~ function_name = "presign-old" → "presign-new"    (forces replacement)
      ~ arn           = "arn:...old" → (known after apply)
        runtime       = "python3.12"
    }
```

**Default replace order — destroy-then-create:**

```
1. DESTROY old resource  ← GAP: resource does not exist
2. CREATE new resource
```

During the gap, any dependent resource (API Gateway integration, IAM permission) references a deleted resource. For your Prasaarit project: renaming a Lambda function during a live request window causes 5xx errors from API Gateway for the duration of the gap.

### ForceNew Attributes You Must Know

| Resource | ForceNew Attributes | Impact if changed |
|---|---|---|
| `aws_lambda_function` | `function_name` | Lambda deleted + recreated, new ARN |
| `aws_iam_role` | `name` | Role deleted, all attached policies orphaned temporarily |
| `aws_s3_bucket` | `bucket` | Bucket destroyed — **data loss** |
| `aws_db_instance` | `identifier`, `engine`, `availability_zone` | Database destroyed — **data loss** |
| `aws_api_gateway_rest_api` | most attributes updateable | — |
| `aws_instance` (EC2) | `ami`, `subnet_id`, `availability_zone` | New instance, new private IP |

**How to check**: in the plan output, look for `(forces replacement)` after the attribute line. In provider docs, the attribute description says "Changing this forces a new resource." In provider source: `ForceNew: true` in the schema.

---

## `lifecycle` Blocks — Controlling Plan/Apply Behavior

The `lifecycle` block is a **meta-argument** — it modifies how Terraform handles a specific resource during plan and apply. It lives inside the resource block, not inside a `provider` or `terraform` block.

### `create_before_destroy` — Eliminate the Replacement Gap

```hcl
resource "aws_lambda_function" "presign" {
  function_name = "prasaarit-presign-stg"
  # ...

  lifecycle {
    create_before_destroy = true
  }
}
```

Changes the replace order:

```
Default (destroy-then-create):   create_before_destroy:
  1. DESTROY old Lambda            1. CREATE new Lambda   ← both exist together
  2. CREATE new Lambda             2. DESTROY old Lambda
```

**The naming-collision trap**: if the `ForceNew` attribute is a unique identifier (like `function_name`), both old and new resources can't have the same name simultaneously. Use random suffixes:

```hcl
resource "random_id" "suffix" {
  byte_length = 4
  keepers = {
    # Regenerate on rollout — drives a new suffix (and thus a new Lambda name)
    version = "v2"
  }
}

resource "aws_lambda_function" "presign" {
  function_name = "prasaarit-presign-stg-${random_id.suffix.hex}"
  # Old: prasaarit-presign-stg-a1b2c3d4
  # New: prasaarit-presign-stg-e5f6a7b8  ← different, can coexist
  lifecycle { create_before_destroy = true }
}
```

`create_before_destroy` propagates up the dependency graph: any resource that depends on this one also gets implicitly set to `create_before_destroy`. This can cause cascading recreations you didn't expect.

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

If anything tries to destroy this resource (removing the block from config, changing a ForceNew attribute), Terraform refuses at plan time:

```
Error: Instance cannot be destroyed
  resource "aws_db_instance" "main" has lifecycle.prevent_destroy set,
  but the plan calls for this resource to be destroyed.
```

Use on: databases, S3 buckets with data, KMS keys, anything where destruction = data loss.

**What `prevent_destroy` does NOT protect against:**
- `terraform state rm` — removes from state without touching lifecycle rules
- Deleting the resource in the AWS console
- Removing the `resource` block **and** the `prevent_destroy` in the same commit (both changes together bypass it)

### `ignore_changes` — Tolerate External Modifications

```hcl
resource "aws_autoscaling_group" "workers" {
  min_size         = 2
  desired_capacity = 2   # managed by Auto Scaling policies at runtime

  lifecycle {
    ignore_changes = [
      desired_capacity,     # Auto Scaling changes this — don't revert it
      tags,                 # AWS Config adds compliance tags — don't revert them
    ]
  }
}
```

During plan, `ignore_changes` skips listed attributes entirely. Even if cloud value !== config value, no change is planned.

**The lie `ignore_changes` creates**: your config says `desired_capacity = 2`, the cloud says `desired_capacity = 8`, and `terraform plan` says "No changes." This is intentional for Auto Scaling — but it means your config no longer reflects reality. When the resource is **replaced** for any reason, it will be created from the config (capacity = 2), not from the current cloud state (capacity = 8). `ignore_changes` doesn't carry cloud values to new resources.

**`ignore_changes = all`**: Terraform never updates this resource after creation. Only creation and deletion are managed. Almost always wrong — use it only to bridge two management systems temporarily.

### `replace_triggered_by` — Force Replacement When Dependencies Change

```hcl
resource "aws_api_gateway_deployment" "deploy" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  lifecycle {
    replace_triggered_by = [
      aws_api_gateway_integration.presign,
      aws_api_gateway_method.presign_post,
      aws_api_gateway_resource.presign_route,
    ]
  }
}
```

API Gateway deployments are immutable snapshots — you cannot update an existing deployment. Normally Terraform can't detect that a new deployment is needed when only the API's methods/integrations change (the deployment's own attributes haven't changed). `replace_triggered_by` tells Terraform: "if any of these referenced resources change, replace this deployment too."

This is essential for any immutable resource that must be recreated when its dependencies change. Also used with `create_before_destroy = true` to do a zero-downtime API deployment.

---

## Preconditions and Postconditions (v1.2+)

`lifecycle` also supports `precondition` and `postcondition` blocks — custom validation that runs during plan and apply respectively.

```hcl
resource "aws_db_instance" "main" {
  identifier     = "prasaarit-db"
  instance_class = var.db_instance_class
  # ...

  lifecycle {
    # precondition: checked at plan time (before any changes)
    precondition {
      condition     = contains(["db.t3.micro", "db.t3.small", "db.t3.medium"], var.db_instance_class)
      error_message = "db_instance_class must be t3 — other families are not approved for this account."
    }

    # postcondition: checked after the resource is created/updated
    postcondition {
      condition     = self.storage_encrypted == true
      error_message = "The RDS instance must have encryption enabled. Check the AWS account's encryption policy."
    }
  }
}
```

**`precondition`**: runs before Terraform makes any changes. Use to assert that input variables are safe combinations — things that `validation` blocks on variables can't check because they involve multiple variables or resource data.

**`postcondition`**: runs after the resource is applied. The `self` reference gives access to the resource's actual attributes from the cloud. Use to assert that the cloud resource ended up in the expected state (e.g., encryption actually got applied).

```hcl
data "aws_ami" "latest_al2" {
  # ...

  lifecycle {
    postcondition {
      condition     = self.architecture == "x86_64"
      error_message = "The selected AMI must be x86_64. Got: ${self.architecture}."
    }
  }
}
```

**Preconditions vs variable `validation` blocks**: variable validation only sees the variable's own value. Preconditions can reference any resource or data source attribute and check combinations. Use validation for simple format/range checks, preconditions for cross-resource assertions.

---

## `check` Blocks — Infrastructure Health Assertions (v1.5+)

`check` blocks are top-level (not inside a resource) assertions that run after every apply. Unlike preconditions, a failing `check` **does not fail the apply** — it emits a warning and continues.

```hcl
check "api_health" {
  # Optional: a data source to read the current state for assertion
  data "http" "healthcheck" {
    url = "https://${aws_api_gateway_stage.stg.invoke_url}/health"
  }

  assert {
    condition     = data.http.healthcheck.status_code == 200
    error_message = "API Gateway health check failed: got ${data.http.healthcheck.status_code}"
  }
}

check "lambda_not_throttled" {
  assert {
    condition     = aws_cloudwatch_metric_alarm.lambda_throttle.alarm_state_value != "ALARM"
    error_message = "Lambda throttling alarm is active — check concurrency limits."
  }
}
```

**Why `check` doesn't fail the apply**: it's intended for post-deployment assertions about the real-world state, not for enforcing config correctness. Failing a health check shouldn't undo the infrastructure changes that just succeeded.

**Precondition vs `check` block:**

| | `lifecycle.precondition` / `postcondition` | `check` block |
|---|---|---|
| Location | Inside a `resource` or `data` block | Top-level in the config |
| Scope | This resource's inputs (pre) or outputs (post) | Any attribute, any data source |
| Failure effect | **Fails the plan or apply** | Warning only — apply continues |
| Purpose | Enforce correctness of config | Assert real-world health after deploy |

---

## The `-target` Flag

`-target` restricts plan/apply to a specific resource and its dependency subgraph.

```bash
terraform plan  -target=aws_lambda_function.presign
terraform apply -target=aws_lambda_function.presign
```

Terraform builds the full graph, then prunes everything not in the target's dependency chain:

```
Full graph:          Targeted (-target=Lambda):

IAM Role             IAM Role
   ↓                    ↓
Lambda → API GW      Lambda
   ↓         ↓
Permission  Deploy   (API GW, Deployment, Stage, Permission — all pruned)
              ↓
            Stage
```

**Legitimate uses**: debugging a single failing resource, breaking a circular dependency on first apply, applying an urgent hotfix without touching unrelated resources, working around the `for_each` known-at-plan-time constraint (apply the data source first).

**Why it's dangerous as a workflow**: `-target` creates **partial state** — after a targeted apply, state doesn't reflect the full config. Resources that weren't targeted don't get refreshed. Dependencies between targeted and untargeted resources may be broken silently. Running a full plan after weeks of targeted applies can reveal dozens of unexpected changes.

> **Rule**: `-target` is a debugging tool. Always follow up with a full `terraform apply` (no `-target`) to reconcile state with config.

**Better alternatives**: split large monolithic stacks into smaller separate states (`networking/`, `compute/`, `data/`). Smaller stacks are faster to plan and seldom need `-target`.

---

## Partial Apply and Recovery

Terraform applies resources in dependency order, writing state after each successful resource. If a resource fails mid-apply:

```
Apply graph — upload service:
  1. aws_iam_role.lambda_exec          ✅ created
  2. aws_iam_role_policy.lambda_s3     ✅ created   (depends on 1)
  3. aws_api_gateway_rest_api.api      ✅ created   (independent — ran concurrently)
  4. aws_lambda_function.presign       ❌ FAILED    (wrong handler path)
  5. aws_api_gateway_resource.route    ✅ created   (depends on 3, not 4)
  6. aws_api_gateway_method.post       ✅ created   (depends on 5)
  7. aws_lambda_permission.apigw       ⏭️ skipped   (depends on 4)
  8. aws_api_gateway_integration       ⏭️ skipped   (depends on 4)
  9. aws_api_gateway_deployment        ⏭️ skipped   (depends on 8)
 10. aws_api_gateway_stage            ⏭️ skipped   (depends on 9)
```

State now contains resources 1, 2, 3, 5, 6. Resources 4, 7–10 are absent.

**Recovery**: fix the Lambda config, run `terraform plan` (shows 5 resources to create), run `terraform apply`. The second apply creates only the missing resources. Resources 1, 2, 3, 5, 6 are untouched.

**The edge case — cloud create succeeded but state write failed** (process killed, network drop):

The resource exists in AWS but not in state. Next plan: Terraform plans to create it (it's in config, not in state). Next apply: AWS returns "already exists" conflict → error.

Fix: `terraform import <address> <cloud-id>` to bring the orphaned resource into state.

**There is no rollback.** Terraform never reverts already-applied resources after a failure. You always move forward: fix the error, re-apply.

---

## `terraform destroy` — The Reverse Apply

```bash
terraform destroy
```

Builds a **destroy graph** — the reverse of the apply graph. Dependencies are destroyed before dependents:

```
Apply order:    1 → 2 → 3 → 4 → … → 10
Destroy order: 10 → 9 → 8 → 7 → … → 1
```

Terraform destroys API Gateway Stage before Deployment before Integration before Lambda before IAM Role. This prevents "still in use" errors from the cloud API.

```bash
# Targeted destroy — use carefully
terraform destroy -target=aws_lambda_function.presign
# Only destroys the Lambda (after all dependents are destroyed first).
# API GW integration in state still references a deleted Lambda — broken.
# Always clean up the full stack with a full destroy or full apply.
```

---

## Reading Plan Output — Reference

```
Symbols:
  +     create            Safe. New resource.
  -     destroy           DANGER. Confirm explicitly.
  ~     update in-place   Usually safe. Verify the attribute.
  -/+   replace           DANGER. Destroy + create. Gap = potential downtime.
  +/-   replace (CBD)     Safer. Create then destroy. Watch for name conflicts.
  <=    read              Data source refresh. No mutation.

Attribute markers:
  (known after apply)      Value computed by cloud — unavailable during plan.
  (sensitive)              Hidden from terminal output. Still plaintext in state.
  -> (forces replacement)  THIS attribute change triggers destroy + create.
```

**Before every apply — mandatory checklist:**
1. Read the full plan output — never skip
2. Every `-/+` (replace) — do you understand why, and is it expected?
3. Every `-` (destroy) — do you know what you're deleting?
4. Every `(forces replacement)` — is this a ForceNew you understand?
5. If using a saved plan file: was it computed on the same code that you're applying?

**Save the plan to prevent drift between `plan` and `apply`:**

```bash
terraform plan  -out=plan.tfplan   # saves the plan
terraform apply plan.tfplan        # applies exactly that plan, no re-plan
```

If any resource changes between `plan` and `apply` (someone else applied, drift occurred), the saved plan detects the mismatch and fails safely.

---

## Guarantees and Failure Modes

### What Terraform Guarantees

| Guarantee | Detail |
|---|---|
| **Dependency ordering** | Resources created in dependency order, destroyed in reverse |
| **State write after each resource** | After partial failure, state exactly reflects what succeeded — recovery is always possible |
| **`prevent_destroy` enforcement** | Terraform refuses to plan destruction of protected resources — caught at plan, not apply |
| **Precondition enforcement** | Failed precondition aborts the plan before any changes; failed postcondition aborts the apply |

### What Terraform Does NOT Guarantee

| Non-guarantee | Why it matters |
|---|---|
| **Plan stability across time** | The plan is valid when computed. Cloud changes between `plan` and `apply` may cause apply failure. Use saved plan files for CI/CD. |
| **Zero-downtime replace** | Default replace has a gap. `create_before_destroy` helps but requires unique naming strategy. |
| **Rollback** | There is no rollback. A failed apply leaves partial state. Fix forward. |
| **`ignore_changes` preserves cloud values on replace** | When a resource is replaced, it's created from config, not from current cloud state. Ignored attributes are lost. |
| **`check` blocks block deploys** | A failing `check` assertion is a warning, not an error. If you need to block, use a `postcondition` instead. |

---

## Source References

- [Resource Lifecycle](https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle) — `create_before_destroy`, `prevent_destroy`, `ignore_changes`, `replace_triggered_by`, preconditions, postconditions
- [Check Blocks](https://developer.hashicorp.com/terraform/language/checks) — infrastructure assertions (v1.5+)
- [terraform plan](https://developer.hashicorp.com/terraform/cli/commands/plan) — all flags including `-target`, `-refresh`, `-out`
- [ForceNew in Provider SDK](https://developer.hashicorp.com/terraform/plugin/sdkv2/schemas/schema-behaviors#forcenew) — how providers mark attributes
- [terraform-provider-aws](https://github.com/hashicorp/terraform-provider-aws) — search `ForceNew: true` in resource schemas
