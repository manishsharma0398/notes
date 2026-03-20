# Chapter 03 — The State File — Interview Questions

Questions progress from state mechanics → drift and recovery → design tradeoffs. The traps reveal what interviewers are actually testing: whether you understand state as a living artifact with real operational risks, not just a file that "tracks resources."

---

## Q1: "Your teammate changed the Lambda timeout directly in the AWS console. What does the state file show right now, and what happens on the next `terraform plan`?"

**Trap**: Tests understanding of the three-way diff and the point-in-time nature of state.

**State file right now**: it still shows `timeout = 10` — the value from the last apply. State is a snapshot; it does not update itself when someone changes something in the console. Terraform has no push-based notification of cloud changes.

**On the next `terraform plan`:**

1. Terraform calls provider `ReadResource` for the Lambda → cloud returns `timeout = 30`
2. Three-way comparison:
   - Config says: `timeout = 10`
   - State says: `timeout = 10`
   - Cloud says: `timeout = 30`  ← drift
3. Plan output: `~ timeout: 30 → 10` (Terraform will revert the drift)
4. On apply: Lambda is updated back to 10 seconds

If the console change was **intentional** and you want to keep it: `terraform apply -refresh-only` updates state to `timeout = 30` without making any cloud changes. Then update your config to `timeout = 30` so future plans are clean.

**Follow-up trap**: *"What if no one runs Terraform for 3 months after the console change?"*

Answer: Terraform is blind the entire time. There is no continuous drift monitoring. The drift exists silently until someone runs `plan`. Some teams schedule `plan` in CI/CD nightly to detect drift proactively.

---

## Q2: "You ran `terraform import` on an existing S3 bucket. The next `terraform plan` shows 8 changes. Why?"

**Trap**: Tests understanding that import captures state but cannot reconcile config.

`terraform import` calls provider `ReadResource` on the existing bucket and writes the full result to state. But **it generates no HCL**. My hand-written resource block is incomplete:

```hcl
# What I wrote:
resource "aws_s3_bucket" "uploads" {
  bucket = "prasaarit-uploads-stg"
}

# What state now contains (full attributes from ReadResource):
# - versioning: enabled
# - cors_rule: [{ allowed_methods = ["GET"], ... }]
# - lifecycle_rule: [{ expiration 90 days, ... }]
# - tags: { Environment = "stg", Team = "platform" }
# - server_side_encryption_configuration: [...]
# - object_ownership: "BucketOwnerPreferred"
# - force_destroy: false
```

The 8 changes are Terraform planning to bring the cloud in line with my minimal config (removing CORS rules, lifecycle rules, tags, etc. I didn't declare).

**The fix**: run `terraform plan` and iteratively add the missing attributes until the plan shows 0 changes. Or use `terraform plan -generate-config-out=generated.tf` (v1.5+) to generate the full HCL from the imported state — then review and adjust it.

**Better approach going forward**: use an `import {}` block in config (v1.5+), which runs through the normal plan/apply cycle and is code-reviewed.

---

## Q3: "Your production state file is stored locally on a developer's laptop. Two engineers run `terraform apply` simultaneously. Walk me through exactly what goes wrong."

**Trap**: Tests deep understanding of state locking and serial-based conflict detection.

With local state, there is **no locking mechanism** and no atomic write:

```
Engineer A reads terraform.tfstate  (serial: 5)
Engineer B reads terraform.tfstate  (serial: 5)  ← same file, same serial

Engineer A: creates resources 1–5 → writes state  (serial: 6)
Engineer B: creates resources 6–10 → writes state (serial: 6)
  → B's write OVERWRITES A's write
  → Resources 1–5 exist in AWS but are NOT in state
  → State now shows only resources 6–10
```

Resources 1–5 are **orphaned**: they exist in the cloud, are consuming cost, but Terraform doesn't know about them. Next plan shows nothing to do for them.

**Additional failure mode**: both try to create the same resource → one succeeds, one gets an AWS conflict error mid-apply → partial state on both sides.

**The fix**: S3 backend with DynamoDB locking (or `use_lockfile = true` from v1.11). DynamoDB uses a conditional `PutItem` with `attribute_not_exists` — an atomic operation that ensures only one apply holds the lock at any time. The `serial` field provides a secondary optimistic concurrency check: if two processes somehow both write, the one with the stale serial is rejected by the backend.

---

## Q4: "You need to refactor your Terraform config to move a resource into a child module. How do you do this without destroying and recreating the resource?"

**Trap**: Tests knowledge of `moved` blocks vs `state mv` and the operational tradeoffs.

**Naive approach** (broken): rename the address and run plan. Terraform sees the old address as deleted and the new module address as created → destroys your production resource.

**Imperative approach (`terraform state mv`):**

```bash
terraform state mv aws_lambda_function.presign module.upload_service.aws_lambda_function.presign
```

Updates the state record's address immediately. Problem: this is a manual CLI step that bypasses code review, can't run in CI/CD without special handling, and if someone forgets to do it before plan, the resource gets destroyed.

**Declarative approach (`moved` block, preferred):**

```hcl
moved {
  from = aws_lambda_function.presign
  to   = module.upload_service.aws_lambda_function.presign
}
```

Plan shows: `aws_lambda_function.presign has moved to module.upload_service.aws_lambda_function.presign — No changes`. Apply updates state automatically. This is in version control, goes through PR review, works in CI/CD. Remove the `moved` block once applied across all environments.

**Important**: also update any resources that reference the old address (e.g., `aws_lambda_function.presign.arn`) — the reference must use the new module path or plan will fail to resolve it.

---

## Q5: "You deleted your production state file. Infrastructure is still running in AWS. How do you recover?"

**Trap**: Tests understanding of state as the sole mapping — and disaster recovery options.

This is a major incident. Without state, Terraform treats the cloud as empty. Running `plan` shows everything as "will be created." Running `apply` will attempt to create duplicates and fail with cloud-level conflicts for each resource.

**Recovery options, in order of preference:**

1. **Check the local backup** — Terraform writes `terraform.tfstate.backup` on every state write. If it exists, copy it to `terraform.tfstate` and run `plan` to verify.

2. **S3 versioning** — If using the S3 backend with versioning enabled, recover the previous state version from the S3 console or CLI:
   ```bash
   aws s3api list-object-versions --bucket prasaarit-terraform-state --key upload-service/terraform.tfstate
   aws s3api get-object --bucket ... --key ... --version-id <ID> terraform.tfstate
   ```

3. **Re-import everything** — if no backup and no S3 versioning, import every resource one by one:
   ```bash
   terraform import aws_iam_role.lambda_exec prasaarit-stg-lambda-exec
   terraform import aws_lambda_function.presign prasaarit-presign-stg
   # ... every resource in the stack
   ```
   Then run `terraform plan` and iterate config until 0 changes. Painful for stacks with 50+ resources.

4. **Third-party tooling** — tools like `terraformer` can scan an AWS account and attempt to generate both state and config. Output always needs significant manual cleanup.

**Prevention that would have avoided this:**
- S3 backend with versioning always enabled
- S3 lifecycle rule retaining 30+ state versions
- `*.tfstate` in `.gitignore` (local state never committed, never accidentally deleted with a git clean)
- CloudTrail alerting on state bucket write/delete operations

---

## Q6: "You want to stop managing an RDS instance with Terraform — hand it to another team — without destroying it. What are your options and what are the risks?"

**Trap**: Tests knowledge of `terraform state rm` vs `removed` block, and the subtle destroy-vs-forget distinction.

**Option A: `terraform state rm` (imperative)**

```bash
terraform state rm aws_db_instance.main
```

Removes the RDS instance from state immediately. Terraform forgets it — the real instance still exists in AWS. **Risk**: if the `resource "aws_db_instance" "main"` block is still in config and someone runs `apply`, Terraform will try to create a new RDS instance and fail (name conflict or tag conflict depending on config).

**Workflow after `state rm`**: remove the resource block from config in the SAME commit. Commit and apply before anyone else can run plan.

**Option B: `removed` block (v1.7+, preferred)**

```hcl
removed {
  from = aws_db_instance.main

  lifecycle {
    destroy = false   # "forget" — don't destroy the real resource
  }
}
```

And remove the `resource "aws_db_instance" "main"` block. Plan shows: `aws_db_instance.main will no longer be managed`. Apply removes it from state. This is code-reviewed, runs through normal plan/apply, and explicitly documents the intent in version control.

**The `destroy = true` variant**: if you did want to destroy the resource, `destroy = true` in the `removed` block causes apply to destroy it. This is the declarative replacement for `terraform state rm` followed by `terraform apply` on a config that doesn't include the resource.

**Either way, communicate with the receiving team** before doing this: the RDS instance is now unmanaged — if they're not ready to take it into their Terraform config via `import`, it will be an orphan consuming cost with no automated management.

---

## Q7: "What is the difference between S3+DynamoDB locking and S3 native locking (`use_lockfile`)? Would you migrate an existing project to native locking?"

**Trap**: Tests knowledge of the v1.11 `use_lockfile` feature and the operational considerations for migration.

**DynamoDB locking** (classic):
- A separate DynamoDB table holds the lock record (`LockID = "path/to/state"`)
- Lock acquisition: `PutItem` with `attribute_not_exists(LockID)` — atomic
- Requires: DynamoDB table in the same region, IAM permissions for `dynamodb:PutItem`, `GetItem`, `DeleteItem`
- Overhead: additional AWS service, additional IAM policy, additional cost (minimal, but real)

**S3 native locking** (`use_lockfile = true`, v1.11):
- A `.tflock` file is written to the same S3 bucket alongside the state
- Lock acquisition: `PutObject` with `If-None-Match: *` — an HTTP conditional write that S3 guarantees atomically
- No DynamoDB needed — one fewer service dependency, simpler IAM
- Requires S3 versioning on the bucket (recommended anyway for state recovery)

**Migration consideration**: `use_lockfile` is a backend configuration change. Terraform requires `terraform init -reconfigure` to adopt it. During the migration window, if some CI jobs are on the old config and others on the new, there's a brief period without consistent locking. Coordinate the migration as a single PR that updates the backend config and runs `terraform init` in all environments atomically.

**Would I migrate?** Yes for new projects — simpler is better. For existing stable projects, the cost of DynamoDB is negligible and migration carries brief locking risk. I'd migrate during a low-traffic maintenance window and verify the lock file appears in S3 after the first apply.
