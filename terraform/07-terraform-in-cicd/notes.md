# Chapter 07 — Terraform in CI/CD — Revision Notes

## 1. Never run `terraform apply -auto-approve` without a plan file

- A two-stage pipeline (`terraform plan` in Job 1, `terraform apply` in Job 2) is **unsafe** unless Job 2 consumes the exact output of Job 1.
- Without a plan file, `terraform apply` computes a new plan. If the cloud state diverged between Job 1 and Job 2, the unreviewed changes will be applied silently.
- **The fix**: `terraform plan -out=tfplan.binary` in Job 1, pass the file as an artifact, run `terraform apply tfplan.binary` in Job 2.

## 2. OIDC (OpenID Connect) replaces long-lived AWS keys

- Don't store AWS Access Keys (`AKIA...`) in GitLab CI/CD variables. They leak and need rotation.
- **OIDC pattern**: GitLab gives the pipeline runner a cryptographically signed token (JWT). The runner trades this token via `sts:AssumeRoleWithWebIdentity` for temporary AWS credentials (valid for 1 hour).
- You secure the AWS IAM role by adding a `Condition` in the Trust Policy that restricts which GitLab repository (and branch) is allowed to assume the role.

## 3. Plan review gates require pausing the pipeline

- Staging deployments can be fully automated on merge to `main`.
- Production deployments must be gated behind human review of the plan output.
- In GitLab CI, this is implemented using `when: manual` on the production apply job. The pipeline waits, the human reviews the plan artifact, and clicks "Play".

## 4. State locking prevents concurrency corruption

- If two pipelines run `terraform apply` simultaneously (e.g., Alice and Bob push to `main` at the same time), the state file will be corrupted or race conditions will occur.
- **The fix**: The S3 backend `dynamodb_table` handles locking. The first pipeline acquires the lock; the second pipeline fails immediately with `Error acquiring the state lock`.
- In GitLab CI, you can prevent the job failure entirely by using `resource_group: production-env`. GitLab will automatically queue the second pipeline to run only after the first one finishes.

## 5. Saved plan files contain plaintext secrets

- Outputting a plan to a text file (`terraform show tfplan.binary > plan.txt`) for human review means the plain text file might contain database passwords or private keys in the diff.
- **Security rule**: Ensure pipeline artifacts expire quickly (`expire_in: 1 day`) and the repository/pipeline visibility is restricted to authorized team members.
