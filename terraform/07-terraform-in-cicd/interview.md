# Chapter 07 — Terraform in CI/CD — Interview Questions

---

## Q1: "Your team has a GitLab pipeline. Job A runs `terraform plan`. Job B runs `terraform apply -auto-approve`. You review the plan from Job A, it looks good, so you trigger Job B. Why is this a severe anti-pattern?"

### The Trap
Tests understanding of the difference between a calculated plan and an executed plan.

### What a Senior Engineer Says

Job B computes a **new** plan.

Between the time Job A finishes and someone clicks "Deploy" on Job B (which could be hours or days), the state of the cloud or the state file itself could have changed. Someone might have modified a resource manually in the console, or another pipeline might have deployed something else.

When Job B runs `terraform apply -auto-approve`, it calculates its own plan against the current reality, and automatically applies it without human review. The plan you reviewed in Job A is obsolete and ignored.

**The Fix:**
Job A must output a binary plan file: `terraform plan -out=deploy.plan`
Job B must consume exactly that file: `terraform apply deploy.plan`
If the state has changed since the plan was created, `apply deploy.plan` will fail safely with a deterministic error, rather than applying unreviewed changes.

---

## Q2: "How do you securely authenticate your GitLab Runner to AWS without storing Access Keys as CI/CD variables?"

### The Trap
Tests knowledge of modern passwordless authentication (OIDC).

### What a Senior Engineer Says

I use **OIDC (OpenID Connect) with AWS STS**.

1. In AWS, the GitLab OIDC provider is configured as a trusted identity provider.
2. An IAM Role (`GitlabDeployRole`) is created with a Trust Policy. The policy allows `sts:AssumeRoleWithWebIdentity` only if the federated principal matches GitLab, and the `sub` (subject) claim matches my specific project repository and branch.
3. In the GitLab `.gitlab-ci.yml`, the job requests an `id_token` from the GitLab JWT issuer.
4. The pipeline uses the AWS CLI to call `aws sts assume-role-with-web-identity`, passing the JWT.
5. AWS verifies the JWT signature directly with GitLab, checks the trust policy, and returns temporary access keys (valid for 1 hour).
6. Terraform uses these temporary keys.

No long-lived secrets are ever generated or stored in GitLab. If the repo is deleted or moved, access is gone. If the temporary keys leak from the pipeline logs, they expire in 60 minutes.

---

## Q3: "Two developers push to the `main` branch 10 seconds apart. Both trigger the production deployment pipeline. Pipeline A and Pipeline B hit the `terraform apply` step simultaneously. What happens, and what should happen?"

### The Trap
Tests understanding of state locking and CI/CD concurrency controls.

### What a Senior Engineer Says

**What happens at the Terraform tier (The hard stop)**:
Assuming we configured a DynamoDB lock table for our S3 backend, Pipeline A will acquire the lock in DynamoDB. When Pipeline B attempts to run `apply` (or `plan`), it sees the lock is held by another process. Pipeline B immediately prints an error and **fails the pipeline job**. The state is protected from corruption.

**What should happen at the GitLab tier (The graceful queue)**:
While the DynamoDB lock prevents corruption, failing Pipeline B is a bad developer experience. Pipeline B should wait in a queue until Pipeline A finishes.
In GitLab CI, we implement this using a `resource_group: prod-deploy` on the apply job. GitLab recognizes the concurrency constraint and automatically serializes the jobs. Pipeline B's apply job stays in a "Pending" state until Pipeline A succeeds. Both pipelines ultimately succeed in order.

---

## Q4: "You output your plan file to a text format so reviewers can read it in the GitLab Merge Request. Six months later, a security audit flags this as a critical vulnerability. Why?"

### The Trap
Tests awareness of secrets handling in Terraform plans and CI artifacts.

### What a Senior Engineer Says

Terraform plan outputs show the diff of the configuration against the state. This diff often contains **plaintext secrets** — newly generated RDS database passwords, private encryption keys, API tokens, etc. — even if they are marked as `sensitive` in the Terraform outputs. (Marking as `sensitive` only masks them in the CLI output, not the underlying data structure).

If you run `terraform show -no-color deploy.plan > plan.txt` and save `plan.txt` as a GitLab pipeline artifact permanently, you have just stored plaintext infrastructure secrets in your CI/CD storage indefinitely.

**Mitigation:**
1. Ensure pipeline artifacts containing plan text have a strict TTL (`expire_in: 1 hour` or `1 day`).
2. Limit pipeline visibility so the public/unauthorized developers cannot browse artifacts.
3. Consider using dedicated review tools (like Terraform Cloud, Atlantis, or specialized CI/CD plugins) that parse the plan and suppress sensitive attributes before posting comments to the Merge Request.

---

## Q5: "You use GitLab CI to deploy staging automatically on merge, but production requires a manual click. If staging and production use the same Terraform codebase (Workspaces approach), how do you structure this pipeline cleanly?"

### The Trap
Tests practical CI/CD design for Terraform workspace workflows.

### What a Senior Engineer Says

The pipeline needs sequential jobs that pass plan files between stages, passing the workspace context via CLI commands.

```yaml
# Simplified structure
stages:
  - plan-stg
  - apply-stg
  - plan-prod
  - apply-prod

# Staging is fully automated
stg-plan:
  stage: plan-stg
  script:
    - terraform workspace select stg
    - terraform plan -out=stg.plan
  artifacts: { paths: [stg.plan] }

stg-apply:
  stage: apply-stg
  script:
    - terraform workspace select stg
    - terraform apply stg.plan

# Production plan is automatic AFTER staging succeeds
prod-plan:
  stage: plan-prod
  needs: [stg-apply]
  script:
    - terraform workspace select prod
    - terraform plan -out=prod.plan
  artifacts: { paths: [prod.plan] }

# Production apply WAITS for human interaction
prod-apply:
  stage: apply-prod
  needs: [prod-plan]
  when: manual           # The crucial gate
  environment: production
  script:
    - terraform workspace select prod
    - terraform apply prod.plan
```

All jobs run off the same commit. The progression guarantees that `prod` is only evaluated after `stg` is physically deployed, and `prod` is only deployed when a human approves the exact binary plan generated back at the `prod-plan` stage.
