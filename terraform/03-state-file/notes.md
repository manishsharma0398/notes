# Chapter 03 — The State File — Revision Notes

## 1. State = Terraform's map from HCL addresses to cloud resource IDs and attributes

- State is a JSON file (`terraform.tfstate`) with `serial` (write counter), `lineage` (project UUID), outputs, and a `resources` array.
- Every attribute the provider returned at apply time is stored — not just what you declared in config.
- Key fields: `serial` (optimistic concurrency), `lineage` (prevents cross-project state swaps), `attributes` (full resource snapshot).

## 2. Terraform diffs three things simultaneously during plan: config vs state vs cloud

- **Config** = what you want. **State** = what was last recorded. **Cloud** = what actually exists (fetched via provider `ReadResource`).
- Drift = cloud ≠ state. Terraform detects it during refresh and plans to **revert** cloud to match config.
- Between `plan` runs Terraform is completely blind to drift — no continuous monitoring, only point-in-time detection at plan time.
- `terraform plan -refresh-only` → shows what state WOULD become after refresh; `terraform apply -refresh-only` → accepts cloud changes into state without reverting them.
- `-refresh=false` → skips `ReadResource`, uses stale state. Faster, but hides drift. Never use in production pipelines.

## 3. `terraform import` adds to state — it does NOT generate config

- CLI: `terraform import <address> <cloud-id>` writes state but nothing else. You must write the HCL resource block manually.
- After import: run `terraform plan` and iterate config until 0 changes. Or use `terraform plan -generate-config-out=generated.tf` (v1.5) to auto-generate the HCL.
- **Better way**: `import {}` block in config (v1.5+) — in version control, goes through code review, runs in normal plan/apply flow.

## 4. Remote state with S3 backend solves four local-state problems: locking, sharing, versioning, security

- DynamoDB locking: conditional `PutItem` with `attribute_not_exists` — atomic; only one apply runs at a time.
- **S3 native locking** (`use_lockfile = true`, v1.11): conditional `PutObject` with `If-None-Match: *` replaces DynamoDB entirely. No separate table needed.
- **Chicken-and-egg bootstrap**: 1. create `bootstrap/` config with `backend "local"` to provision S3 bucket. 2. `terraform apply`. 3. Add `backend "s3"` block to `bootstrap/` config with `use_lockfile = true`. 4. `terraform init -migrate-state` to move state to the bucket, enabling native S3 locking for the bootstrap itself.
- `terraform_remote_state` data source: reads another stack's outputs from its remote state. Operational risk: if that stack removes an output, this stack's next plan breaks.

## 5. State contains secrets in plaintext — `sensitive = true` only hides terminal output

- Lambda env vars, RDS passwords, KMS key IDs — all stored in the state JSON, regardless of `sensitive = true`.
- Mitigations: S3 `encrypt = true`, bucket policy restricting access, S3 versioning enabled, `*.tfstate` in `.gitignore`.
- Best practice: don't pass secrets as Terraform-managed values at all. Use Secrets Manager and pass only the ARN. State stores the ARN, not the secret.

## 6. State manipulation: always prefer declarative over imperative

| Task                                | Imperative (CLI)               | Declarative (config)                                         |
| ----------------------------------- | ------------------------------ | ------------------------------------------------------------ |
| Rename/move a resource              | `terraform state mv old new`   | `moved { from = old  to = new }` (v1.1+)                     |
| Remove from state but don't destroy | `terraform state rm address`   | `removed { from = … lifecycle { destroy = false } }` (v1.7+) |
| Force rebuild                       | `terraform taint` (deprecated) | `terraform apply -replace=address`                           |

- `moved` and `removed` blocks are code-reviewed, CI/CD-compatible, and run through normal plan/apply flow.
- After `state rm` without removing the config block: Terraform will try to create a duplicate resource on next apply → cloud conflict error.
