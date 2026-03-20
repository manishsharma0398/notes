# Chapter 05 — Modules — Revision Notes

## 1. A module is just a directory of .tf files — the root is already one

- No special syntax, no build step, no registry required. A directory with `.tf` files = a module.
- Root config = root module. Directories called via `module {}` = child modules. No structural difference.
- Convention: `versions.tf` (required_providers + version constraint), `variables.tf`, `main.tf`, `outputs.tf`. Terraform doesn't enforce filenames — these are for humans.
- Always declare `required_providers` in `versions.tf` — without it, the module silently accepts whatever version the caller has, which may be incompatible.

## 2. Modules enforce encapsulation — all communication is explicit

- A child module **cannot** access parent variables, locals, or resources.
- Inputs: passed as arguments in the `module {}` block → received as `var.x` inside.
- Outputs: only `output` blocks are visible to callers. Internal resources are hidden.
- `module.x.aws_resource.name.attr` → **compile error**. Use `module.x.output_name` instead.
- This means: the module author can rename/restructure internal resources without breaking callers — as long as output names and types stay the same.
- `sensitive = true` on an output hides the value in plan/apply terminal output. It's still stored in state as plaintext.

## 3. Module sources — always pin versions

| Source | When to use |
|---|---|
| Local path (`../modules/x`) | Same repo; fast iteration; no download needed |
| Terraform Registry (`terraform-aws-modules/vpc/aws`) | Community modules; `version =` required |
| Git (`git::https://...//path?ref=v1.0.0`) | Private org modules across repos |
| S3 | Air-gapped / strictly controlled environments |

- **Always pin**: `version = "5.1.0"` (registry) or `?ref=v1.0.0` (Git tag — not a branch).
- Unpinned registry or `?ref=main` = non-deterministic. Next `terraform init` can break your infra.
- Re-run `terraform init` after any change to a module's `source`.

## 4. Provider inheritance and the `providers` map

- Child modules **automatically inherit** the parent's providers — no `provider` block needed inside.
- **Never** declare a `provider` block in a child module (unless it's the root). It creates a second provider instance → resources land in the wrong region or account.
- For multi-region/account: use provider `alias` in root, pass via `providers = { aws = aws.alias }` in the `module {}` block.

## 5. Three composition patterns — start flat, extract when duplicating

| Pattern | When |
|---|---|
| **Flat** — all resources in root | < 10 resources, still designing |
| **Local feature modules** (`modules/` dir) | Copy-pasting a resource group for a second instance is the signal to extract |
| **Shared module repo** (Git source, versioned) | Two+ repos/services need the same module |

- Modules with 30+ input variables aren't abstracting — they're wrapping. That's a code smell.
- Modules that wrap a single resource provide zero abstraction — use the resource directly.
- Start flat. Extract after the pattern stabilises.

## 6. Modules in the graph and state are namespaced — refactoring needs `moved` blocks

- Resource addresses: `module.<name>.<type>.<resource>` (e.g., `module.presign_lambda.aws_lambda_function.this`)
- State stores the full namespaced address. `terraform state show module.presign_lambda.aws_lambda_function.this` works.
- Moving a resource into a module, or renaming inside a module, requires `moved` blocks to prevent destroy+create.
- `for_each` on a module: same rules as resource `for_each` — key-based identity, keys must be known at plan time.
