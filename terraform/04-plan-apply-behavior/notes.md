# Chapter 04 — Plan and Apply Behavior — Revision Notes

## 1. Five plan actions — know the symbols

| Symbol | Action | Risk Level |
|--------|--------|-----------|
| `+` | Create | Safe |
| `~` | Update in-place | Usually safe |
| `-/+` | Replace (destroy then create) | **DANGER** — downtime gap |
| `+/-` | Replace (create then destroy) | Safer — uses `create_before_destroy` |
| `-` | Destroy | **DANGER** — resource deleted |

## 2. The provider decides update vs replace — not you, not Terraform Core

- Each attribute in the provider schema has a `ForceNew` boolean.
- If a `ForceNew` attribute changes → replace (destroy + create). No way around it.
- Common traps: Lambda `function_name`, IAM role `name`, S3 `bucket`, RDS `identifier` — all `ForceNew`.
- **Always check plan output** for `-/+` and `(forces replacement)` before applying.

## 3. Four lifecycle meta-arguments

| Meta-argument | Purpose | When to use |
|--------------|---------|-------------|
| `create_before_destroy` | New resource is created before old is destroyed | Zero-downtime replacements (but watch for name collisions) |
| `prevent_destroy` | Terraform refuses to plan destruction | Databases, S3 buckets — anything where deletion = data loss |
| `ignore_changes` | Skips listed attributes during diff | Attributes managed by external automation (ASG capacity, externally-set tags) |
| `replace_triggered_by` | Forces replacement when referenced resources change | API GW deployments that must be recreated when routes change |

## 4. `-target` is a debugging tool, not a workflow

- Restricts plan/apply to one resource and its dependencies. Everything else is pruned.
- Creates **partial state** — state doesn't match full config.
- **Always follow with a full apply** (no `-target`) to reconcile.
- Use for: debugging, breaking circular deps, urgent hotfixes.

## 5. There is NO rollback — only move forward

- Failed apply leaves partial state (resources 1-3 created, resource 4 failed, 5-10 skipped).
- State accurately reflects reality — fix the error and re-apply.
- Edge case: resource created in cloud but not in state → `terraform import` to reconcile.
- Use saved plan files (`plan -out=file.tfplan`) to prevent plan drift between `plan` and `apply`.
