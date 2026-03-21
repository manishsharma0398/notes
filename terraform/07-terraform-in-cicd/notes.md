# Chapter 07 — Terraform in CI/CD — Revision Notes

## 1. Always pass a saved binary plan between pipeline stages

- `terraform plan -out=tfplan.bin` serialises the diff as a binary protobuf. `terraform apply tfplan.bin` executes exactly that diff — it does not recalculate.
- `terraform apply -auto-approve` (without a plan file) always recalculates a fresh plan. What you reviewed is not what gets applied.
- If the state has changed between plan and apply, `terraform apply tfplan.bin` detects the version mismatch and **aborts** rather than applying silently.

## 2. OIDC replaces long-lived AWS access keys in CI

- Store no `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in GitLab/GitHub CI variables.
- GitLab/GitHub issues a signed JWT per pipeline job. The runner exchanges it via `sts:AssumeRoleWithWebIdentity` for temporary credentials (60 min TTL).
- The IAM role Trust Policy must scope the `sub` condition to a specific repo and branch (`ref:main`), not a wildcard — otherwise any pipeline in the world can assume the role.

## 3. A plan review gate pairs `when: manual` (GitLab) or an Environment (GitHub) with the binary plan artifact

- The pipeline pauses. The reviewer reads the plan text artifact. Only after explicit approval does `terraform apply tfplan.bin` execute the exact captured plan.
- The plan text artifact must expire quickly (`expire_in: 1 hour`) and be restricted to authorised users — it may contain plaintext secrets despite `sensitive = true` masking the CLI display.

## 4. State locking provides the hard stop; CI concurrency groups provide the graceful queue

- Two concurrent applies competing for the same DynamoDB lock: the second one fails immediately with `Error acquiring the state lock`. State is safe.
- GitLab `resource_group: production-tf` / GitHub `concurrency: group: terraform-prod` queues the second pipeline rather than failing it, so both eventually succeed.
- A CI runner killed mid-apply leaves a stale lock. Recover with `terraform force-unlock <lock-id>` — but only after confirming no apply is actually running.

## 5. `terraform init` must run in every CI job that touches state; never cache `.terraform/` between differing configurations

- Each CI job runs in a fresh container. `terraform init` downloads the provider, reinitialises the backend connection, and creates the lock file.
- Caching the `.terraform/` directory between jobs is an optimisation but carries risk: a stale provider binary cache may mask version drift. Always pin `required_providers` versions and let `init` verify the lock file.
