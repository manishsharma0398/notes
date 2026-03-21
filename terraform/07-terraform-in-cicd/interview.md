# Chapter 07 — Terraform in CI/CD — Interview Questions

---

## Q1: "Your GitLab pipeline has two jobs: Job A runs `terraform plan` and logs output to stdout. Job B runs `terraform apply -auto-approve`. A team member says they review the Job A log before triggering Job B manually. What's wrong with this workflow?"

### The Trap
Tests whether the candidate understands that `terraform apply -auto-approve` always computes a **new** plan — not the one from Job A.

### What a Senior Engineer Says

The reviewed plan from Job A is **never executed**. When Job B runs `terraform apply -auto-approve`, it computes a fresh plan against the current state of the world. By the time a human reviews Job A and manually triggers Job B, the state may have changed:
- A colleague may have run a different apply that modified shared resources
- A resource may have been manually changed in the console (drift)
- A scheduled process may have modified tags or attributes

The apply in Job B executes a plan the human never saw.

**The fix:**
```bash
# Job A
terraform plan -out=deployment.tfplan

# Job B — executes exactly the serialised plan; aborts if state diverged
terraform apply deployment.tfplan
```

There is an additional guarantee: if the remote state has changed since the plan was captured, `terraform apply deployment.tfplan` will refuse to proceed with a state version mismatch error. `terraform apply -auto-approve` has no such protection.

---

## Q2: "You're setting up OIDC for your GitLab pipeline to assume an AWS IAM role. A colleague suggests setting the `sub` condition to `"gitlab.com:sub": "project_path:*"` to keep it simple. What is the security impact?"

### The Trap
Tests understanding of OIDC trust policy scoping — the most common misconfiguration in this space.

### What a Senior Engineer Says

`project_path:*` means **any GitLab project on gitlab.com** can assume that role. This includes public repositories, forks, and any project created by any user on the platform. An attacker who wants access to your AWS account simply needs to create a GitLab project and trigger a pipeline that calls `sts:AssumeRoleWithWebIdentity`.

The condition must be scoped to the minimum viable principal:

```hcl
Condition = {
  StringLike = {
    # Specific org, specific repo, specific branch
    "gitlab.com:sub" = "project_path:myorg/infra-repo:ref_type:branch:ref:main"
  }
}
```

If deploy access is needed from multiple branches or repos, define separate roles per use case. Never use wildcards in the `sub` claim. For GitHub Actions the same principle applies: scope to `repo:myorg/myrepo:ref:refs/heads/main`, not `repo:*`.

---

## Q3: "Your GitLab pipeline produces a plan, a human approves it, and `terraform apply prod.tfplan` runs. Halfway through the apply, the GitLab runner is terminated (spot instance preemption). Now the state lock is held by a dead process. How do you safely recover?"

### The Trap
Tests knowledge of stale lock recovery, the risks of `force-unlock`, and how partial apply interacts with state.

### What a Senior Engineer Says

Two things happened simultaneously:
1. **Stale lock**: the DynamoDB lock (or S3 lock file, if using v1.11 S3 native locking) was never released because the process died without cleanup.
2. **Partial apply**: some resources may have been created/modified by AWS APIs before the runner died; their state may or may not have been flushed to S3 before the crash.

**Recovery steps:**

1. **Verify** no apply is actually running. Check: is there an active GitLab runner holding the job? Is there a live Terraform process anywhere? Only proceed when you are certain.

2. **Inspect the stale lock info:**
   ```bash
   # The error message shows the lock ID and the owner info
   # Error: Error acquiring the state lock
   # Lock ID: "a3f1b2c4-..."
   ```

3. **Force-unlock:**
   ```bash
   terraform force-unlock a3f1b2c4-...
   ```
   This is a destructive operation — it removes the lock record without checking whether an apply is in progress. If you run this while an apply is actually running, you allow a concurrent apply to proceed, which can corrupt state.

4. **Reconcile partial state:**
   ```bash
   terraform plan   # shows what's in state vs reality
   ```
   Resources that were created before the crash but whose state wasn't flushed will show up as "missing" in state even though they exist in AWS. Use `terraform import` or `import` block to bring them back under management. Resources that are in state but failed creation mid-apply will need to be reconciled case-by-case.

**Prevention**: Use CI concurrency controls (`resource_group` in GitLab) to prevent a second pipeline from starting before the stale lock is confirmed dead.

---

## Q4: "You store your Terraform plan text artifact in GitLab for 30 days so engineers can look back at historical plans. A security audit flags this as a critical finding. Why? `sensitive = true` is set on all secret outputs."

### The Trap
Tests understanding of the difference between `sensitive = true` display masking vs actual secret content in plan artifacts.

### What a Senior Engineer Says

`sensitive = true` in Terraform only prevents the value from being printed in the CLI's plan/apply output display. The value is **not redacted** from the plan binary (`.tfplan` protobuf), and it is **not redacted** from the text output of `terraform show <planfile>`.

If your pipeline runs:
```bash
terraform show -no-color prod.tfplan > plan.txt
```

Then `plan.txt` will contain the plaintext values of all sensitive attributes — RDS master passwords, API tokens, generated private keys — even if they are marked `sensitive`. This is because the operation that needs to display the plan for human review needs to show what will change, and what will change is the actual value.

Storing `plan.txt` as a 30-day artifact means:
- Any GitLab user with developer access can download the artifact and read the secrets
- If the project is ever made public or a token leaks, historical secrets are exposed
- This bypasses all Secrets Manager or SSM Parameter Store patterns you have set up

**Mitigations in order of preference:**
1. Set `expire_in: 1 hour` on artifacts containing plan text
2. Restrict artifact download to maintainers only
3. Use a dedicated Terraform review tool (Atlantis, Digger) that filters sensitive output before posting to MR comments
4. For the most sensitive stacks, do not store plan text at all — only store the binary `.tfplan` and require reviewers to run `terraform show` locally with proper AWS credentials to read it

---

## Q5: "Two engineers push to `main` simultaneously. Your GitLab pipeline has no `resource_group` set. Pipeline A starts applying. Pipeline B also starts applying. Walk through exactly what happens at each layer."

### The Trap
Tests understanding of the interplay between DynamoDB/S3 locking (Terraform layer) and CI concurrency (GitLab layer), and what each layer does and doesn't protect.

### What a Senior Engineer Says

**Layer 1 — Plan phase (both pipelines):**
`terraform plan` acquires a shared read lock (or no lock, depending on backend). Both plan jobs can run simultaneously. Both will compute plans against the same state. This is fine — plans are read-only.

**Layer 2 — Apply phase (the collision):**
`terraform apply` acquires an exclusive write lock.
- Pipeline A's apply starts first, acquires the DynamoDB lock.
- Pipeline B's apply starts, checks the lock, sees Pipeline A holds it.
- Pipeline B fails immediately: `Error: Error acquiring the state lock`.
- Pipeline B's apply job is marked as failed.

**What's protected:** The state file. Only Pipeline A's changes are applied; Pipeline B never modifies state.

**What's not protected:** Pipeline B is now failed and needs to be re-run. If Pipeline B's commit contained important changes, they haven't been applied. Engineers may not notice if they're not watching the pipeline.

**With `resource_group: production-tf`:**
- GitLab detects that Pipeline B's apply job wants the same resource group as Pipeline A's apply job.
- Pipeline B's apply job stays in `Pending` until Pipeline A's job completes.
- Pipeline B then runs and applies its own changes cleanly.
- Both pipelines succeed. No manual re-run needed.

The DynamoDB lock is the **correctness** guarantee. The CI resource group is the **UX** guarantee.
