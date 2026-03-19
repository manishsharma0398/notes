# Chapter 06 — Multi-Environment and Multi-Account — Revision Notes

## 1. Three approaches: Workspaces, Directory-per-Env, and Terragrunt

- **Workspaces**: Same config, multiple state files. DRY — zero config duplication. Run `terraform workspace select stg`. Risk of wrong-workspace apply locally.
- **Directory-per-env**: Separate directory (`stg/`, `prod/`), each with its own `backend.tf` and `provider`. 100% state isolation, but requires copy-pasting the root module config.
- **Terragrunt**: A wrapper over Terraform that provides the best of both. You use directory-per-env (`stg/`, `prod/`), but instead of duplicating `.tf` code, you write a `terragrunt.hcl` file that dynamically generates the backend and points to shared code in a `resources/` folder.

## 2. Assume role for multi-account — temporary credentials via STS

- Provider's `assume_role` block calls `sts:AssumeRole` → gets temporary credentials (1h default).
- CI/CD runner lives in a shared services account, assumes roles into dev/stg/prod accounts.
- Each account's role has a **trust policy** (who can assume) and a **permissions policy** (what they can do).
- Provider aliases (`provider "aws" { alias = "shared" }`) allow one config to manage resources across multiple accounts.

## 3. Remote state data sources are a fragile cross-stack contract

- `data "terraform_remote_state"` reads another stack's outputs from its state file.
- **No compile-time contract**: if the upstream stack renames/removes an output, your plan fails at runtime.
- Requires read access to the other stack's state file (which contains ALL their secrets).
- **Better alternative**: Publish values to SSM Parameter Store. Explicit, tool-agnostic, no state file access needed.

## 4. Backend blocks cannot use variables — this is an `init`-time limitation

- Backend is configured during `terraform init`, BEFORE variables/locals are evaluated.
- Workarounds: `-backend-config` CLI flags, `.hcl` config files, or just hardcode per environment (simple with directory-per-env).
- `terraform init -backend-config=backend.hcl` is the cleanest for CI/CD.

## 5. Start single-account, directory-per-env — add multi-account when you need it

- Single account + directory-per-env gives you full state isolation without AWS Organizations complexity.
- When you add a second AWS account, add `assume_role` to the prod provider — no structural change.
- CI/CD maps naturally: one job per directory, no workspace-switching logic.
