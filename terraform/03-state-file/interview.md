# Chapter 03 — State File — Interview Questions

---

## Q1: "Your teammate made a change to the Lambda function directly in the AWS console. What does Terraform's state file currently show, and what happens on the next `terraform plan`?"

### The Trap
Tests whether you understand the three-way diff (config vs state vs cloud) and the refresh mechanism.

### What a Senior Engineer Says

**State file currently**: Still shows the old value. The state file is a snapshot from the last `apply` — it doesn't update itself when someone changes things in the console.

**On the next `terraform plan`:**

1. Terraform calls `ReadResource` (refresh) for the Lambda → gets the current cloud state with the console change.
2. Compares three things:
   - Config says `timeout = 10`
   - State says `timeout = 10`
   - Cloud says `timeout = 30` (changed in console)
3. Terraform detects drift. The plan shows: `~ timeout: 30 → 10`
4. If you apply, Terraform **reverts** the console change back to 10.

**If you WANT to keep the console change**: Run `terraform apply -refresh-only`. This updates the state to match the cloud without reverting anything. Then update your config to `timeout = 30` so future plans are clean.

**Follow-up trap**: "What if, between the console change and your next `plan`, no one runs Terraform for a month?"

Answer: Terraform is blind. The drift exists silently. There is no continuous monitoring. Terraform only detects drift when someone runs `plan` (which triggers refresh). This is why some teams run `plan` on a schedule in CI/CD to detect drift proactively.

---

## Q2: "You ran `terraform import` to bring an existing S3 bucket into state. The next `terraform plan` shows 8 changes. Why?"

### The Trap
Tests understanding that `import` captures state but does NOT generate matching config.

### What a Senior Engineer Says

`terraform import` calls `ReadResource` on the existing bucket and writes the full result into state. But it does not generate HCL config. The config I wrote by hand is likely incomplete:

```hcl
# What I wrote:
resource "aws_s3_bucket" "uploads" {
  bucket = "prasaarit-uploads-stg"
}

# What state now contains (from import/ReadResource):
# - bucket = "prasaarit-uploads-stg"
# - versioning enabled
# - CORS rules configured
# - lifecycle rules
# - tags: { Environment = "stg", Team = "platform" }
# - server_side_encryption configured
# - public access block settings
# - force_destroy = false
```

The plan shows 8 changes because Terraform is comparing my minimal config against the full cloud state. For attributes I didn't specify:
- Some will be "reset" to defaults (Terraform plans to remove CORS rules, tags, etc.)
- Some will be ignored (provider-specific behavior)

**The fix**: After import, run `terraform plan` and iteratively add missing attributes to your config until the plan shows `0 changes`. Or use `terraform plan -generate-config-out=generated.tf` (Terraform 1.5+) to auto-generate the config from the imported state.

---

## Q3: "Your state file is stored locally. Two engineers run `terraform apply` simultaneously from their laptops. What goes wrong?"

### The Trap
Tests understanding of state locking and concurrent access.

### What a Senior Engineer Says

With local state, there is **no locking mechanism**.

**Sequence of disaster:**

1. Engineer A reads `terraform.tfstate` (serial: 5)
2. Engineer B reads `terraform.tfstate` (serial: 5) — same file
3. Engineer A creates resources 1–5, writes state (serial: 6)
4. Engineer B creates resources 6–10, writes state (serial: 6)
5. Engineer B's write **overwrites** Engineer A's state — resources 1–5 are now **orphaned**: they exist in AWS but aren't tracked in state.

**Also possible**: Both try to create the same resource → one succeeds, one gets a cloud-level conflict.

**The fix**: Use S3 backend with DynamoDB locking table.

With DynamoDB locking:
- Engineer A acquires the lock (DynamoDB `PutItem` with `attribute_not_exists`)
- Engineer B tries to acquire lock → **fails immediately**: `"Error acquiring the state lock"`
- Engineer A finishes, releases lock
- Engineer B can now acquire lock and proceed

**But even with locking, the state bucket itself is a single point of failure.** If the DynamoDB table is accidentally deleted, locking stops working silently for some backends. Always have CloudTrail alerting on the state bucket and lock table.

---

## Q4: "You need to move a resource from the root module into a child module. How do you do this without destroying and recreating the resource?"

### The Trap
Tests knowledge of `terraform state mv` and `moved` blocks — critical for real-world refactoring.

### What a Senior Engineer Says

Two approaches:

**Approach 1: `terraform state mv` (imperative, old way)**

```bash
terraform state mv aws_lambda_function.presign module.upload_service.aws_lambda_function.presign
```

This updates the state's resource address. The next plan sees the resource at its new address and knows it's the same resource.

**Problem**: This is a CLI command. It doesn't go through code review, doesn't work in CI/CD pipelines without manual steps, and if you forget to do it before running plan, Terraform will plan a destroy+create.

**Approach 2: `moved` block (declarative, preferred)**

```hcl
moved {
  from = aws_lambda_function.presign
  to   = module.upload_service.aws_lambda_function.presign
}
```

Add this to your config. On the next `plan`, Terraform shows: `aws_lambda_function.presign has moved to module.upload_service.aws_lambda_function.presign`. Apply updates the state automatically. No manual CLI steps.

**The `moved` block can be removed from config later** — once it has been applied across all environments, it's no longer needed (but harmless to keep).

**Danger with both approaches**: If you move a resource that has other resources depending on it (via expression references), you must also update those references to use the new address. Otherwise Terraform can't resolve the dependency.

---

## Q5: "You accidentally deleted your state file. Your infrastructure still exists in AWS. How do you recover?"

### The Trap
Tests understanding of state as the single source of mapping between config and cloud.

### What a Senior Engineer Says

**You have a serious problem.** Without state, Terraform has no idea that your cloud resources exist. If you run `terraform plan` now, it shows everything as "will be created" — because from Terraform's perspective, nothing exists. Running `apply` would try to create duplicate resources and fail for each one with conflicts.

**Recovery plan:**

1. **Check for backups**: Terraform creates `terraform.tfstate.backup` on every state write. If the backup exists, restore it.

2. **If using S3 backend**: Enable S3 versioning on the state bucket. Recover the previous version of the state file.

3. **If no backup exists**: Import every resource one by one:

```bash
terraform import aws_iam_role.lambda_exec prasaarit-stg-lambda-exec
terraform import aws_lambda_function.presign prasaarit-presign-stg
terraform import aws_api_gateway_rest_api.api abc123def456
# ... for every single resource
```

Then run `terraform plan` and fix config until it shows no changes.

4. **For large stacks**: Use tools like `terraformer` (third-party) that can scan an AWS account and generate both state and config files from existing resources. But this is imprecise and requires manual cleanup.

**Prevention:**

- Use S3 backend with versioning enabled — **always**
- Enable DynamoDB locking to prevent concurrent corruption
- Set up lifecycle rules to keep state versions for at least 30 days
- Run CI/CD pipeline checks that verify state health periodically
