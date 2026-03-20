# Chapter 06 — Multi-Environment and Multi-Account — Revision Notes

## 1. Three approaches — different tradeoffs on DRY vs isolation

| Approach | State isolation | Access isolation | Code duplication | Best for |
|---|---|---|---|---|
| **Workspaces** | Yes (separate state files) | No — shared credentials | None | Single account, low env divergence, CI/CD controlled |
| **Directory-per-env** | Yes | Yes — per-dir provider/credentials | ~50 lines root module per env | Multi-account, significant env divergence, team scale |
| **Terragrunt** | Yes | Yes | ~0 lines (generates backend/vars) | Enterprise, many envs/accounts → covered in ch20 |

## 2. Workspace mechanics and the `default` workspace risk

- Each workspace has its own state file. S3 key is `env:/workspace/base-key`.
- `terraform.workspace` = the current workspace name — use in `env_config` map lookups, `prefix`, and `common_tags`.
- **`default` workspace risk**: if anyone runs `apply` without selecting a workspace, they hit `default` — a separate state, untracked by your pipeline. Always guard: `contains(["stg", "prod"], terraform.workspace)` in a `locals` block or enforce workspace selection in CI/CD.
- `env_config` map pattern: centralize ALL per-env values into one `locals` map. Index it with `terraform.workspace`. Resources have no inline conditionals.

## 3. Multi-account: assume_role pattern

- Provider `assume_role` block calls `sts:AssumeRole` → receives temporary credentials (default: 1h TTL).
- **Trust policy** on the target role limits WHO can assume it (e.g., only the CI/CD runner's IAM role).
- `external_id` in `assume_role` prevents confused deputy attack — third parties cannot trick your CI into assuming the role.
- Developer laptops cannot assume the prod deployment role — only the CI/CD pipeline can. This is the access isolation workspaces can't provide.
- Provider aliases + `providers` map: one config can touch multiple accounts using aliased providers.

## 4. Backend blocks cannot use variables — init-time constraint

- Backend is configured during `terraform init`, before variables/locals are evaluated.
- Workarounds: `-backend-config` CLI flags, `-backend-config=file.hcl`, or just hardcode per directory (simplest with directory-per-env).
- The 6-line backend block repeated across environment directories is cheap and readable — not worth abstracting.

## 5. Cross-stack dependencies — prefer SSM over `terraform_remote_state`

- `terraform_remote_state`: reads another stack's outputs from its S3 state file. Requires read access to the entire state (exposes all secrets). Output renames break consumers at plan time with no compile-time check.
- **SSM Parameter Store** (preferred): upstream stack publishes a parameter (`/project/env/name`), downstream reads it via `data "aws_ssm_parameter"`. Explicit contract, no state file access, any tool can read it.
- Variable + manual tfvars: zero coupling, fine for solo projects.

## 6. Workspace vs directory-per-env — choice factors

- **Use workspaces when**: single AWS account, environments are nearly identical, CI/CD strictly controls workspace selection.
- **Switch to directory-per-env when**: environments diverge significantly (prod-only WAF, alarms), you need multi-account isolation, or prod-only `count` conditionals accumulate beyond ~5.
