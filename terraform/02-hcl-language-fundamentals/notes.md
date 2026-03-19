# Chapter 02 — HCL Language Fundamentals — Revision Notes

## 1. HCL is declarative data with expressions — not a programming language

- No imperative control flow. No user-defined functions.
- File order and filenames are irrelevant — Terraform merges all `.tf` files in a directory.
- Expressions are evaluated **during graph walk**, not when parsed. That's why `(known after apply)` exists.

## 2. Variables vs Locals — know when to use each

- **Variable** = input from outside (tfvars, CLI, env var). Use for values that differ between environments.
- **Local** = computed constant derived from other values. Use for naming conventions, common tags, derived facts.
- **Never** make a variable for something that should never change (use a local instead).
- Precedence (lowest → highest): `default` → `terraform.tfvars` → `*.auto.tfvars` → `-var-file` → `-var` → `TF_VAR_*`.

## 3. `count` vs `for_each` — always prefer `for_each` for lists

- `count` uses **index-based identity** (`resource[0]`, `resource[1]`). Removing an item from the middle shifts all indexes → Terraform plans unexpected replacements/destroys.
- `for_each` uses **key-based identity** (`resource["name"]`). Removing a key only affects that one resource.
- **Rule**: Use `count` only for boolean on/off (`count = condition ? 1 : 0`). Use `for_each` for everything else.
- `for_each` requires a `set` or `map` — wrap lists with `toset()`.

## 4. Functions you'll use constantly

| Category | Functions |
|----------|-----------|
| String | `format`, `join`, `split`, `replace`, `upper`, `lower`, `trimspace` |
| Collection | `length`, `lookup`, `merge`, `flatten`, `keys`, `values`, `contains` |
| Encoding | `jsonencode` (IAM policies!), `base64encode`, `filebase64sha256` |
| Filesystem | `file` (read file), `filebase64sha256` (Lambda code hash), `path.module`, `path.root` |
| Type conversion | `toset`, `tolist`, `tomap`, `tonumber`, `tostring` |

## 5. Data sources read existing infrastructure — they don't manage it

- `data "aws_s3_bucket" "uploads" {}` reads the bucket — Terraform will NOT destroy it on `terraform destroy`.
- Use data sources for resources managed in another repo/team (like your S3 bucket in the core infra repo).
- Data sources are refreshed during `plan` — they call the cloud API to get current values.
- Data source values ARE stored in state (cached), but the resource itself is not managed.
