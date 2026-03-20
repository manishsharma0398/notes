# Chapter 02 — HCL Language Fundamentals — Revision Notes

## 1. HCL is declarative data with expressions — not a programming language

- All `.tf` files in a directory are merged; file name, number, and ordering are irrelevant.
- No user-defined functions, no imperative control flow. Use `locals` to name repeated expressions, `modules` to encapsulate patterns.
- Expressions are evaluated **during graph walk**, not at parse time — that's why `(known after apply)` exists.

## 2. Variables vs Locals — know the difference

- **`variable`** = input from outside (tfvars, CLI, env). Use for values that differ per environment or per caller.
- **`local`** = computed constant derived from other values. Use for naming conventions, derived facts, common tags.
- Precedence (lowest → highest): `default` → `terraform.tfvars` → `*.auto.tfvars` → `-var-file` → `-var` → `TF_VAR_*`.
- A variable that nobody should ever change is a mistake — make it a local instead.
- `optional(type, default)` in `object()` type constraints (v1.3+) lets module callers omit fields without errors.

## 3. `count` vs `for_each` — always prefer `for_each` for non-boolean cases

- `count` uses **index-based identity** (`resource[0]`, `resource[1]`). Removing an item from the middle shifts all higher indexes → Terraform plans unexpected replacements and destroys.
- `for_each` uses **key-based identity** (`resource["name"]`). Remove a key → only that resource changes.
- **Rule**: Use `count` only for boolean on/off (`count = cond ? 1 : 0`). Use `for_each` for all list/map-driven resources.
- `for_each` requires a `set` or `map` — wrap a list with `toset()`.
- **Critical**: `for_each` keys (and `dynamic` block keys) must be **known at plan time**. If keys depend on a resource attribute that is `(known after apply)`, the plan fails.

## 4. The `for` expression transforms collections — it is not a loop

- `[for item in list : expr]` → list; `{for k, v in map : key => val}` → map; add `if cond` to filter.
- Unlike `for_each`, a `for` expression does not create resources — it computes a value used elsewhere.
- Commonly used inside `locals` to transform variable data before feeding it into `for_each` or `dynamic`.

## 5. `dynamic` blocks generate repeated nested blocks, not resources

- `dynamic "ingress"` iterates a collection and emits one `ingress {}` block per item — replaces copy-paste for security group rules, cors_rule, etc.
- The iterator is named after the block type by default (`ingress.value`); use `iterator = alias` to rename.
- **Cannot** generate top-level `resource {}` blocks — use `for_each` on the resource for that.
- Use it when 3+ identical-shaped blocks are driven by a variable. For fewer blocks, explicit is clearer.

## 6. Key built-in functions to know cold

| Category | Functions |
|---|---|
| String | `format`, `join`, `split`, `replace`, `upper`, `lower`, `trimspace`, `templatefile` |
| Collection | `length`, `lookup`, `merge`, `flatten`, `distinct`, `keys`, `values`, `contains` |
| Encoding | `jsonencode` (IAM policies), `base64encode`, `filebase64sha256` (Lambda hash) |
| Filesystem | `file`, `filebase64sha256`, `path.module`, `path.root` |
| CIDR | `cidrsubnet(prefix, newbits, netnum)`, `cidrhost`, `cidrnetmask` |
| Type/Safety | `toset`, `tolist`, `tostring`, `tonumber`, `try(expr, fallback)`, `can(expr)` |

- `jsonencode` > heredoc strings for IAM policies: type-safe, properly escaped, precise plan diffs.
- `try(expr, default)` is the safe way to access attributes that may not exist on optional object fields.

## 7. Data sources read — they never create, update, or destroy

- `data "aws_s3_bucket" "uploads" {}` reads the bucket. Terraform does NOT destroy it on `terraform destroy`.
- Data sources are refreshed at every `plan` (call the cloud API). Their values are stored in state but the resource is not owned.
- Use for resources managed in another repo, by another team, or by AWS itself (`aws_caller_identity`, `aws_region`).

## 8. `terraform_data` — built-in state-only resource (replaces `null_resource`)

- No `required_providers` entry — built into Terraform Core since v1.4.
- `input` stores any value in state; `output` exposes it for other resources to reference (creates a graph edge).
- `triggers_replace = [expressions]` causes the resource to be **replaced** when any expression changes — the mechanism for re-running `provisioner "local-exec"` conditionally (e.g., on Lambda zip hash change).
- **Not** ephemeral: its value IS written to state. Use ephemeral resources (v1.10) when you need zero state footprint.
