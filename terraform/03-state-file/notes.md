# Chapter 03 — State File — Revision Notes

## 1. State = Terraform's map from resource addresses to cloud IDs

- Without state, Terraform can't know which real cloud resource corresponds to which `resource` block.
- State is a **JSON file** with a `serial` (incrementing counter), `lineage` (UUID), and a `resources` array.
- State stores **every attribute** the provider returned — including values you didn't set in config.

## 2. Terraform diffs THREE things during plan: config vs state vs cloud

- **Config** = what you want. **State** = what was last recorded. **Cloud** = what actually exists (refreshed via `ReadResource`).
- Drift = cloud reality ≠ state. Terraform detects drift during refresh and plans to revert cloud to match config.
- Between `plan` runs, Terraform is **completely blind** to drift. There is no continuous monitoring.

## 3. `terraform import` adds existing resources to state — it does NOT generate config

- Import calls `ReadResource` and writes the result into state at a given address.
- **You must write the HCL resource block yourself.** If your config doesn't match the imported state, the next `plan` will show changes.
- Modern approach: `import {}` block in config (Terraform 1.5+) — reviewable in Git, works in CI/CD.

## 4. Remote state with S3+DynamoDB solves three problems

- **Locking**: DynamoDB conditional write ensures only one `apply` runs at a time.
- **Sharing**: Multiple engineers access the same state from S3.
- **Security**: S3 encryption at rest + bucket policy restricts access.
- **Chicken-and-egg**: The state bucket itself must be created first (manually or with a bootstrap Terraform config that uses local state).

## 5. State contains secrets in plaintext — always protect it

- Lambda env vars, RDS passwords, API keys — all stored in plaintext JSON.
- `sensitive = true` only hides values from `plan` output, **NOT from the state file**.
- **Always**: encrypt S3 backend, restrict bucket access, add `*.tfstate` to `.gitignore`.
- **Better practice**: Use Secrets Manager for sensitive values. Terraform stores only the secret's ARN in state.
