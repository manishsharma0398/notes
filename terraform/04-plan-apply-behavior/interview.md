# Chapter 04 — Plan and Apply Behavior — Interview Questions

Questions progress from plan mechanics → lifecycle controls → failure recovery → runtime assertions. The traps reveal whether you read plan output carefully, know which lifecycle tool to reach for, and understand Terraform's failure model.

---

## Q1: "You need to rename an RDS database identifier. What does Terraform plan, and how do you mitigate the risk?"

**Trap**: Tests understanding of ForceNew on stateful infrastructure, and the layered defenses available.

`identifier` on `aws_db_instance` is `ForceNew: true`. Changing it triggers a **replace**:

```
Plan:
  -/+ resource "aws_db_instance" "main" {
      ~ identifier = "prasaarit-db-old" → "prasaarit-db-new"  (forces replacement)
      ~ arn        = "arn:..." → (known after apply)
    }
```

This destroys your production database. All data is lost unless you have snapshots.

**Layered mitigations:**

1. **`prevent_destroy`** (first line of defense): Terraform refuses the plan with a clear error if the database has `lifecycle { prevent_destroy = true }`. The rename is caught before any apply runs — you can't accidentally skip it.

2. **If renaming is genuinely needed**:
   - Take a manual RDS snapshot
   - Remove `prevent_destroy` temporarily
   - Apply (destroys old, creates new from scratch — NOT from your snapshot)
   - Restore data from snapshot into the new DB

3. **Better approach**: use AWS directly for the rename — `aws rds modify-db-instance --new-db-instance-identifier`. Then `terraform state mv aws_db_instance.old aws_db_instance.new` to update the state address without destroying anything.

**The lesson**: `ForceNew` exists because the provider authors decided the AWS API's rename path isn't safe enough to expose through Terraform. Always check ForceNew attributes before making identifier-level config changes.

---

## Q2: "`terraform apply` created 6 of 10 resources then failed. You fix the error and re-run `apply`. Does it recreate resources 1–6?"

**Trap**: Tests understanding of how write-after-each-resource enables idempotent recovery.

**No.** Resources 1–6 are in state. The second `plan` refreshes them against the cloud, finds no diff, and plans them as no-op. Only resources 7–10 (absent from state) are planned as creates.

This is the direct benefit of Terraform's "write state after each successful resource" design: after any partial failure, state precisely reflects what exists — not what was attempted.

**Nuances:**

- If the fix you made also changes config that affects resources 1–6 (e.g., a shared variable), those resources will appear as updates in the second plan. That's expected and correct.

- **Edge case**: AWS API returned "created" but Terraform crashed before writing state. Resource exists in AWS but not in state. Next plan: plans to create it. Next apply: AWS says "already exists" → error. Fix: `terraform import <address> <cloud-id>`.

---

## Q3: "You add `ignore_changes = [tags]` to a Lambda function. Eighteen months later, the resource is replaced due to a runtime upgrade. The compliance tags are missing from the new Lambda. Why?"

**Trap**: Tests the subtle distinction between "suppressing drift" and "persisting cloud state across replacement."

`ignore_changes` tells Terraform to **skip the listed attributes during diff computation**. It does not store the cloud value anywhere. Here's the full timeline:

1. Month 0: Deploy Lambda with `tags = { Environment = "stg" }`. Correct.
2. Month 3: AWS Config compliance rule adds `CostCenter = "engineering"` to the Lambda. Terraform sees the drift, but `ignore_changes = [tags]` suppresses it. `terraform plan` says "No changes." Good — the tag stays.
3. Month 18: Runtime upgrade. `runtime` is ForceNew — the Lambda is replaced. Terraform creates a new Lambda from config. Config says `tags = { Environment = "stg" }` only. The new Lambda never gets `CostCenter` — `ignore_changes` doesn't copy cloud tags to new resources. Compliance audit fails.

**The root cause**: `ignore_changes` makes your config a lie — it no longer reflects reality. Any replacement or recreation creates a resource that matches the config (the lie), not the cloud (the truth).

**Correct approaches:**
- Add `CostCenter` to your Terraform `tags` config — no need to ignore it
- Use AWS provider `default_tags` block to apply org-wide tags to all resources automatically
- Reserve `ignore_changes` for attributes where cloud drift is genuinely intentional AND you accept the replacement risk (e.g., `desired_capacity` on an Auto Scaling Group)

---

## Q4: "`create_before_destroy` is set on a Lambda function. You change its `function_name`. What happens? When does `create_before_destroy` fail?"

**Trap**: Tests understanding of when CBD works vs when name collisions cause it to fail.

`function_name` is what changed, so `function_name` is the ForceNew attribute driving the replacement. With `create_before_destroy`:

1. CREATE new Lambda with the **new** name → succeeds (new unique name)
2. DESTROY old Lambda with the **old** name → succeeds

CBD works perfectly here because both function names are different — they can coexist. No collision.

**When CBD fails**: when the ForceNew attribute is NOT the unique identifier:

```hcl
resource "aws_lambda_function" "presign" {
  function_name = "prasaarit-presign-stg"   # same — the unique identifier (unchanged)
  # some_other_forcenew_attr changed

  lifecycle { create_before_destroy = true }
}
```

Step 1: CREATE new Lambda with same name → **FAILS** — `function_name` already exists.

**The fix**: use name suffixes so old and new resources always have different unique identifiers:

```hcl
resource "random_id" "suffix" {
  byte_length = 4
  keepers = { version = "v2" }
}

resource "aws_lambda_function" "presign" {
  function_name = "prasaarit-presign-stg-${random_id.suffix.hex}"
  lifecycle { create_before_destroy = true }
}
```

**Secondary trap**: `create_before_destroy` propagates up the dependency graph. Any resource that depends on this Lambda also gets implicitly set to CBD — potentially causing cascading replacements you didn't expect.

---

## Q5: "Your colleague has been using `-target` exclusively for three weeks because 'full apply is too slow.' What are the risks, and what's the real fix?"

**Trap**: Tests understanding of state divergence from targeted applies and how to address the root cause.

**The risks:**

1. **Partial state**: resources in config that were never targeted have never been applied. State only contains whatever was in scope of historical targets.

2. **Silent drift accumulation**: untargeted resources aren't refreshed during targeted plans. Console changes, policy drifts, and external modifications are never detected.

3. **Unreliable plans**: a targeted `plan` on resource A shows "no changes" even while 20 other resources in the same config need creating or updating.

4. **Dependency breakage**: if A was applied and B (which depends on A's output) was never applied, B's reference to A may be stale if A was later changed via a different target.

**The root cause**: if full apply takes too long, the problem is stack architecture — not the apply command.

Real fixes:
- **Split the stack**: `networking/`, `compute/`, `database/` as separate Terraform roots with their own state. Each runs in seconds.
- **Increase parallelism**: `terraform apply -parallelism=20` (default is 10)
- **Skip refresh when safe**: `terraform plan -refresh=false` when nothing external has changed
- **Use `-target` once as a hotfix, then reconcile immediately** with a full plan

**Recovery from three weeks of targeted applies**: run `terraform plan` with no flags. Review every proposed change. Apply everything — then establish a policy: no `-target` in the normal deploy workflow.

---

## Q6: "What is the difference between a `precondition`, a `postcondition`, and a `check` block? When would you use each?"

**Trap**: Tests knowledge of three different validation mechanisms introduced across v1.2 and v1.5, and crucially — which ones block deploys.

**`lifecycle.precondition`** (v1.2+) — runs at **plan time**, before any change:

```hcl
resource "aws_db_instance" "main" {
  lifecycle {
    precondition {
      condition     = contains(["db.t3.micro", "db.t3.small"], var.db_instance_class)
      error_message = "Only approved db.t3 instance classes are allowed."
    }
  }
}
```

**Fails the plan** → no apply happens. Can reference variables, locals, data sources — broader than variable `validation` blocks (which only see the variable's own value).

**`lifecycle.postcondition`** (v1.2+) — runs **after the resource is applied**:

```hcl
resource "aws_db_instance" "main" {
  lifecycle {
    postcondition {
      condition     = self.storage_encrypted == true
      error_message = "RDS instance must be encrypted. Check account encryption policy."
    }
  }
}
```

Uses `self` to reference the actual applied resource's attributes. **Fails the apply** if condition is false. Use to assert that the cloud responded as expected.

**`check` block** (v1.5+) — runs after apply, **does NOT fail the apply**:

```hcl
check "api_health" {
  data "http" "ping" {
    url = "https://${aws_api_gateway_stage.stg.invoke_url}/health"
  }
  assert {
    condition     = data.http.ping.status_code == 200
    error_message = "API health check returned ${data.http.ping.status_code}"
  }
}
```

Emits a **warning** on failure — deploy succeeds anyway. Use for real-world health checks where you want to observe without blocking.

**Decision matrix:**

| Need | Use |
|---|---|
| Validate config inputs before any changes | `precondition` |
| Verify cloud state matches expectations after apply | `postcondition` |
| Assert real-world health without blocking deploy | `check` block |
| Validate a single variable's format/range | `variable.validation` |

---

## Q7: "You see `(known after apply)` in a plan for an attribute that another resource depends on. What does this mean, and what can go wrong?"

**Trap**: Tests understanding of plan-time vs apply-time value resolution — when `(known after apply)` causes plan failures, not just placeholders.

`(known after apply)` means the value cannot be resolved until the cloud API creates the resource and returns it. Common examples: ARN, ID, DNS name, assigned IP. These are fine as attribute values — Terraform plans them with placeholders.

**Where it breaks things:**

1. **`for_each` keys from computed values** — keys must be known at plan time to build the graph:
   ```hcl
   # FAILS:
   resource "aws_api_gateway_resource" "route" {
     for_each = toset(aws_api_gateway_rest_api.api.endpoint_configuration[*].types)
     # Error: "for_each value depends on resource attributes that cannot be determined until apply"
   }
   ```

2. **`count` from computed values** — same constraint:
   ```hcl
   count = length(some_resource.attr)   # FAILS if attr is (known after apply)
   ```

3. **`dynamic` block `for_each` from computed values** — same constraint, in nested blocks.

**Why**: Terraform must know the full set of resource instances before it can walk the graph. If the number of instances (determined by `count`/`for_each`) is unknown at plan time, the graph can't be constructed.

**Workarounds:**
- Always derive `count` and `for_each` keys from variables or locals — statically known
- Split into two separate applies: first apply creates the dependency, second apply uses its outputs — common in module composition and bootstrap flows
- Use `-target` to apply the dependency first, then run a full plan — acceptable as a one-time bootstrap step
