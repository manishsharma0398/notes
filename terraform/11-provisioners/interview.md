# Chapter 11 — Provisioners — Interview Questions

---

## Q1: "You add a `remote-exec` provisioner to an EC2 resource and apply. The script installs nginx and succeeds. The next week, nginx is uninstalled manually on the instance. You run `terraform apply` again. What happens?"

### The Trap
Tests whether the candidate understands that provisioners only run on resource creation — not on drift detection or re-apply.

### What a Senior Engineer Says

Nothing happens to nginx. `terraform apply` will show: no changes.

Provisioners run **only** on resource creation (or destruction, if `when = destroy` is set). On subsequent applies, Terraform checks whether the resource's attributes (AMI, instance type, tags) match the desired state via the provider's `ReadResource` RPC — it does not SSH into the instance to check if nginx is still there. The provisioner's side effects are invisible to Terraform.

This is the fundamental limitation that disqualifies provisioners for configuration management. The state has `resource "aws_instance" "web" { ... }` — it records the EC2 instance attributes, not the software running on it. Terraform has no mechanism to detect or remediate the nginx drift.

**What you should use instead:**
- If the instance configuration must be continuously enforced: a proper configuration management tool (Ansible, Chef, SSM State Manager) that runs continuously and detects drift.
- If the instance just needs to start with nginx: `user_data` / cloud-init that runs nginx setup on first boot. If nginx is removed, the fix is to replace the instance (which re-runs `user_data`) — this is a valid, reproducible approach.

---

## Q2: "A provisioner script fails mid-apply. The EC2 instance was created, but the provisioner exited with code 1. What is in the Terraform state? What happens on the next `terraform plan`?"

### The Trap
Tests understanding of the tainted state, its meaning, and its consequence on the next plan.

### What a Senior Engineer Says

From the Terraform source (`provisioners/provisioner.go`):
> *"If the returned diagnostics contain any errors, the resource will be left in a tainted state."*

**In state after the failed apply:**
The EC2 instance IS in state — it was created successfully by the AWS provider's `ApplyResourceChange` call. However, it is marked with `"status": "tainted"` in the state file. Terraform marks it tainted because the resource cannot be trusted to be in a known good configuration (the provisioner bootstrapping failed).

**On the next `terraform plan`:**
```
  # aws_instance.web is tainted, so will be replaced.
  -/+ resource "aws_instance" "web" {
      ~ id = "i-0abcd1234" -> (known after apply) # forces replacement
    }
  # (forces replacement) because the resource is tainted
```

Terraform plans a destroy + create cycle. The tainted instance will be destroyed, a new one created, and the provisioner will attempt to run again.

**The danger:** if the provisioner script is not idempotent and the new instance also fails, you enter an infinite taint loop: create → provisioner fails → tainted → plan shows replace → destroy → create → fail again.

**Recovery options:**
1. Fix the script so it succeeds
2. `terraform untaint aws_instance.web` — remove the taint marker so Terraform treats the instance as healthy (you accept the misconfiguration)
3. Rethink the architecture: move the bootstrapping to `user_data` so it runs on EC2 startup rather than as a Terraform provisioner

---

## Q3: "You have a `local-exec` provisioner that runs `aws s3 sync ./dist s3://my-bucket`. Your colleague says this is a good way to keep the S3 bucket contents up to date with every `terraform apply`. What's wrong with this approach, and what should be done instead?"

### The Trap
Tests: (1) the specific trigger for provisioner execution, (2) idempotency concerns, (3) the right alternative.

### What a Senior Engineer Says

Two problems:

**Problem 1 — It only runs on resource creation, not every apply.**
`local-exec` runs once when the `aws_s3_bucket` resource is first created. On all subsequent `terraform apply` runs (assuming the bucket attributes haven't changed), the provisioner does not run. The colleague's assumption that this keeps the bucket "up to date" is wrong — after the first apply, `dist/` changes are never synced by Terraform.

To see the provisioner re-run, the bucket would need to be destroyed and recreated — which would delete all the bucket contents first.

**Problem 2 — It's not plannable or reviewable.**
`terraform plan` shows "provisioner will run" with no preview of what files will be synced, what will change in S3, or what will be deleted. If `aws s3 sync` has `--delete` enabled, files could be removed from S3 with no visibility in the plan.

**The correct approach:**
Static assets synced to S3 belong in a CI/CD pipeline stage **after** `terraform apply` — not inside Terraform:

```yaml
# In .gitlab-ci.yml, after the terraform deploy stage:
deploy-assets:
  script:
    - aws s3 sync ./dist s3://$(terraform output -raw bucket_name) --delete
  needs: [terraform-apply]
```

This runs on every relevant push, has proper CI logs, can be retried independently, and doesn't entangle infrastructure state management with application artifact deployment.

---

## Q4: "You need to run a database migration after a new RDS instance is created. Why is a Terraform `local-exec` provisioner a bad choice for this, despite the fact that it runs locally and doesn't need SSH?"

### The Trap
Tests architectural reasoning about what belongs in Terraform vs the deployment pipeline — specifically for data-layer operations.

### What a Senior Engineer Says

Even though `local-exec` doesn't require SSH (it runs on the Terraform machine), it's still wrong for DB migrations for three reasons:

**1. Provisioners run only on resource creation.** If the RDS instance already exists (the common case after the first deploy), the provisioner doesn't run. Schema migrations for ongoing development — adding a column, creating an index — will never be applied by Terraform after the initial setup.

**2. Migrations are not idempotent by definition.** Running `CREATE TABLE users (...)` twice fails. If the provisioner fails mid-migration (network blip, syntax error), the resource is tainted. Terraform will destroy the RDS instance on the next plan — which destroys all the data — and then run the migration again on the fresh instance. This is catastrophic.

**3. The migration's success is not in state.** If Terraform records the RDS instance as healthy but the migration failed, subsequent Terraform plans show no problem. The broken schema exists silently until the application breaks at runtime.

**The correct pattern:**
Migrations are a **deployment concern**, not an infrastructure concern:
```yaml
# CI/CD pipeline (after terraform apply):
migrate-db:
  script:
    - npx prisma migrate deploy   # or flyway, liquibase, alembic, etc.
  needs: [terraform-apply]
  environment: production
```

The migration tool tracks which migrations have run (in a `schema_migrations` table), run idempotently each deploy, and fail the deployment — not the infrastructure — if they error.
