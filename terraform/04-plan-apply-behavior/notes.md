# Chapter 04 — Plan and Apply Behavior — Revision Notes

## 1. Five plan actions — know the symbols and their risk

| Symbol | Action | Risk |
|---|---|---|
| `+` | Create | Safe |
| `~` | Update in-place | Usually safe |
| `-/+` | Replace (destroy-then-create) | **DANGER** — gap = potential downtime |
| `+/-` | Replace (create-before-destroy) | Safer — watch for name collisions |
| `-` | Destroy | **DANGER** — data loss possible |

Before every apply: read the full plan. Look for `-/+`, `-`, and `(forces replacement)`.

## 2. The provider decides update vs replace — not you

- Each provider attribute has a `ForceNew` boolean. If it changes → destroy + create, no exceptions.
- Common traps: Lambda `function_name`, IAM role `name`, S3 `bucket`, RDS `identifier` — all ForceNew.
- How to check: look for `(forces replacement)` in plan output; or provider docs: "Changing this forces a new resource."

## 3. Six lifecycle meta-arguments

| Meta-argument | Purpose | Key trap |
|---|---|---|
| `create_before_destroy` | New resource created before old is destroyed | Naming conflict if ForceNew attr is the unique ID — use random suffixes |
| `prevent_destroy` | Terraform refuses to plan destruction | Bypassed by removing the block **and** resource in same commit |
| `ignore_changes` | Skip listed attributes in plan diff | Cloud values are NOT carried to replacement — resource recreated from config |
| `replace_triggered_by` | Force replace when referenced resources change | Essential for immutable resources (API GW deployments) |
| `precondition` | Assert inputs at plan time — fails plan if false | Can reference data sources; broader than variable `validation` |
| `postcondition` | Assert actual cloud state after apply — fails apply if false | Uses `self` to access the applied resource's real attributes |

`create_before_destroy` propagates up the dependency graph — any resource that depends on a CBD resource also gets implicitly set to CBD. Watch for cascading recreations.

## 4. `check` blocks — post-apply health assertions (v1.5+)

- Top-level block (not inside a resource). Contains an optional `data` source + one or more `assert` blocks.
- **Does NOT fail the apply** — emits a warning only. Use when you want to observe health without blocking the deployment.
- **Precondition/postcondition fail the plan/apply.** `check` blocks just warn. Choose based on whether failure should be blocking.

## 5. `-target` is a debugging tool — not a workflow

- Restricts plan/apply to one resource and its dependency subgraph. All else is pruned.
- Creates partial state — untargeted resources are neither refreshed nor applied.
- After any targeted apply, always run a full `terraform apply` (no `-target`) to reconcile.
- Better long-term solution: split monolithic stacks into smaller separate states.

## 6. There is no rollback — fix forward

- Failed apply leaves partial state — state accurately reflects exactly what succeeded.
- Recovery: fix the error, re-run `plan`, `apply` picks up from where it left off.
- Edge case: cloud API succeeded but state write failed → orphaned resource → `terraform import` to reconcile.
- Always save plans for CI/CD: `terraform plan -out=plan.tfplan` + `terraform apply plan.tfplan`. Prevents the plan from being silently recomputed between `plan` and `apply`.
