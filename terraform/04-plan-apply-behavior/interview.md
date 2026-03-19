# Chapter 04 — Plan and Apply Behavior — Interview Questions

---

## Q1: "You need to rename an RDS database identifier. What does Terraform plan, and how do you mitigate the risk?"

### The Trap
Tests understanding of ForceNew on critical infrastructure.

### What a Senior Engineer Says

`identifier` on `aws_db_instance` is `ForceNew: true`. Changing it causes Terraform to plan a **replace** — destroy the old database and create a new one.

```
Plan:
  -/+ resource "aws_db_instance" "main" {
      ~ identifier = "old-name" → "new-name"   (forces replacement)
      ~ arn        = "..." → (known after apply)
      ...
    }
```

**This destroys your production database.** All data is gone unless you have snapshots.

**Mitigation layers:**

1. **`prevent_destroy`** — The first line of defense. If set, Terraform refuses to plan the destruction:
   ```hcl
   lifecycle { prevent_destroy = true }
   ```
   This catches the rename in `plan` with a clear error message.

2. **Manual migration** — If you genuinely need to rename:
   - Create a snapshot manually
   - Change the identifier in config
   - Remove `prevent_destroy` temporarily
   - Apply (destroys old, creates new)
   - Restore data from snapshot
   - Or better: create new DB from snapshot, migrate traffic, destroy old

3. **AWS supports renaming via API** — but the Terraform provider marks it ForceNew because the provider authors chose safety over convenience. You could use `aws rds modify-db-instance --new-db-instance-identifier` manually, then `terraform state mv` to update the address.

---

## Q2: "Your `terraform apply` created 6 out of 10 resources, then failed on resource 7. You fix the config and re-run `apply`. Does it recreate resources 1-6?"

### The Trap
Tests understanding of idempotent state reconciliation.

### What a Senior Engineer Says

**No.** Terraform does NOT recreate resources 1–6.

After the first partial apply, resources 1–6 are in state. When you re-run `plan`:

1. Terraform refreshes all resources in state (1–6) against the cloud
2. For 1–6: config matches cloud → no changes planned
3. For 7–10: not in state → planned as creates

The second apply only creates 7–10. This is the benefit of "write to state after each resource" — Terraform always knows exactly where it left off.

**Exception**: If the fix you made to the config also affects resources 1–6 (e.g., you changed a variable used by all resources), then those 6 resources will show updates in the plan too.

---

## Q3: "You add `ignore_changes = [tags]` to a resource. Six months later, a security audit finds the resource is missing mandatory compliance tags. What happened?"

### The Trap
Tests understanding of `ignore_changes` as config drift.

### What a Senior Engineer Says

`ignore_changes` told Terraform to **never diff** the `tags` attribute. Here's the timeline:

1. Month 0: You deploy with `tags = { Environment = "stg" }`. Tags are correct.
2. Month 2: Your organization adds a mandatory `CostCenter` tag via AWS Config. AWS Config adds the tag to the resource in the cloud.
3. Month 3: Someone runs `terraform apply`. Normally, Terraform would revert the `CostCenter` tag (it's not in config). But `ignore_changes = [tags]` prevents this — Terraform ignores the drift. Tags in the cloud now include `CostCenter`. Good so far.
4. Month 5: Someone recreates the resource (changes a ForceNew attribute). Terraform creates a **new** resource from the config — which only has `Environment = "stg"`. The `CostCenter` tag is gone because it was never in the config. `ignore_changes` only suppresses drift detection — it doesn't carry cloud-side tags to new resources.

**The lesson**: `ignore_changes` creates a lie — your config no longer represents reality. When the resource is recreated for any reason, the ignored attributes revert to whatever's in config. Use it sparingly, and document WHY it exists with a comment.

**Better alternative for tags**: Add the `CostCenter` tag to your config (or use `default_tags` in the AWS provider block).

---

## Q4: "You use `create_before_destroy` on a Lambda function. You change the `function_name`. What happens?"

### The Trap
Tests understanding of the naming conflict with create-before-destroy.

### What a Senior Engineer Says

`create_before_destroy` changes the replace order to: create new → destroy old.

But `function_name` is what we changed, and Lambda function names must be unique within an account+region. So:

1. Terraform tries to CREATE the new Lambda with the new name → **this might succeed** (new unique name)
2. Terraform DESTROYS the old Lambda with the old name → success

Actually, if the name **changed**, both old and new names are different, so there's no collision. `create_before_destroy` works fine here.

**Where it fails**: When the `ForceNew` attribute is NOT the unique identifier. Example:

```hcl
resource "aws_lambda_function" "presign" {
  function_name = "prasaarit-presign-stg"    # ← same name
  runtime       = "python3.11"               # ← changed from 3.12 (hypothetically ForceNew)

  lifecycle { create_before_destroy = true }
}
```

If `runtime` were ForceNew (it isn't in practice, but hypothetically):
1. CREATE new Lambda with name "prasaarit-presign-stg" → **FAILS** — name already exists
2. DESTROY old Lambda → never reached

**The fix**: Use name suffixes (e.g., with `random_id`) so old and new resources have different unique identifiers and can coexist during the transition.

---

## Q5: "Your teammate has been using `-target` for weeks because 'the full apply takes too long.' Is this a problem?"

### The Trap
Tests understanding of state divergence from targeted applies.

### What a Senior Engineer Says

**Yes, this is a serious problem.**

`-target` creates partial state. After weeks of targeted applies:

1. **State doesn't match config.** Some resources in config have never been applied. State only contains whatever was targeted.

2. **Dependencies are broken.** If resource A was applied targeting only A, and resource B depends on A but was never applied, the state has A but not B. Adding B later works, but any resources between A and B might have stale references.

3. **Drift accumulates silently.** Resources that aren't targeted don't get refreshed. Someone could have changed them in the console — you'd never know.

4. **Plan output becomes unreliable.** A targeted plan shows "no changes" for the target, but a full plan might show 15 changes across untargeted resources.

**The root cause**: If full apply "takes too long," the real fix is:
- Split the monolithic stack into separate, smaller Terraform states (e.g., `networking/`, `compute/`, `data/`)
- Use `-parallelism=20` to increase concurrent operations
- Enable provider caching to speed up refresh
- Use `-refresh=false` when you're confident the cloud hasn't changed

**Recovery**: Run a full `terraform plan` (no `-target`) immediately. Review all proposed changes. Apply everything at once to reconcile state with config.
