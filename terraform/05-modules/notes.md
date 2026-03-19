# Chapter 05 — Modules — Revision Notes

## 1. A module is just a directory of .tf files — nothing more

- The root directory is the "root module." Modules you call are "child modules."
- No special syntax, no compilation, no build step. A directory with `.tf` files = a module.
- Convention: `main.tf`, `variables.tf`, `outputs.tf`. Terraform doesn't enforce filenames.
- Modules are like functions: inputs (variables), body (resources), outputs (return values).

## 2. Modules enforce encapsulation — no side-channel communication

- A child module **cannot** access parent variables, resources, or locals.
- All communication flows through **inputs** (variables in) and **outputs** (values out).
- Callers **cannot** reach into module internals: `module.x.aws_resource.y.attr` is an error. Use `module.x.output_name`.
- This is a feature: the module author can refactor internals without breaking callers.

## 3. Module sources — always pin versions

| Source | When to use |
|--------|-------------|
| Local path (`../modules/x`) | Same repo, fast iteration |
| Terraform Registry (`terraform-aws-modules/vpc/aws`) | Community modules, well-maintained |
| Git (`git::https://...?ref=v1.0.0`) | Private org modules across repos |
| S3 | Air-gapped environments |

- **Always pin**: `version = "5.1.0"` (registry) or `?ref=v1.0.0` (Git tag).
- Unpinned = non-deterministic. Next `init` could download a breaking change.

## 4. Three composition patterns — start flat, extract when duplicating

| Pattern | When |
|---------|------|
| **Flat** (all resources in root) | Small project, < 10 resources, still designing |
| **Feature modules** (local `modules/` dir) | Duplicating resource groups within one repo |
| **Shared module repo** (Git source) | Multiple services/repos need the same module |

- Don't pre-optimize. Start flat. Extract modules when you copy-paste resource groups.
- Modules with 30+ variables aren't abstracting — they're wrapping. That's a code smell.

## 5. Modules in the graph and state are namespaced

- Resource addresses become: `module.<name>.<type>.<resource>`
  - Example: `module.presign_lambda.aws_lambda_function.this`
- State stores module resources with their full namespaced address.
- Dependencies cross module boundaries transparently — Terraform tracks references into module outputs.
- Refactoring (moving resources into/out of modules) requires `moved` blocks to avoid destroy+create.
