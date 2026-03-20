# Chapter 20 — Terragrunt — Revision Notes

1. **Terragrunt is a Terraform wrapper, not a replacement**: every `terragrunt plan` becomes `terraform plan`. Terragrunt adds a pre-processing layer: download remote module → generate `backend.tf`/`provider.tf` → `cd` into `.terragrunt-cache` → call `terraform`. The core engine is identical.

2. **A unit = one `terragrunt.hcl` file = one Terraform root module**: it is the smallest deployable entity. Its interface is the `source` URL (pinned by `?ref=`) and the `inputs = {}` block. Everything that varies between environments lives in this file only.

3. **`generate` blocks make backend and provider config DRY**: instead of copy-pasting `backend.tf` into every module, a root `terragrunt.hcl` generates it dynamically. `path_relative_to_include()` gives each unit a unique state key automatically — no manual key management.

4. **`dependency` blocks replace manual `terraform_remote_state`**: declare cross-unit output references and Terragrunt reads the remote state automatically. Always add `mock_outputs` for `plan`-only CI — without mocks, a `dependency` on an un-applied unit causes plan to fail.

5. **`run-all` orchestrates a whole environment but increases blast radius**: it discovers all `terragrunt.hcl` files, resolves `dependency` ordering, and runs in parallel. The risk: independent units may apply BEFORE a failing dependent unit is discovered. Review `run-all plan` output carefully before `run-all apply`.

6. **When NOT to use Terragrunt**: single account/single environment setups, teams new to Terraform, or when Terraform Cloud remote plans and policy enforcement are the goal. Add Terragrunt only after you understand what problem it's solving — premature adoption turns the wrapper into confusion.
