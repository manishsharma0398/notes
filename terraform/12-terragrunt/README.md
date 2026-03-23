# Chapter 12 — Terragrunt

## Mental Model

**The problem Terraform doesn't solve:** Terraform is a good DSL for describing a single root module's infrastructure. But it has no answer to *repetition across environments*. If you have three environments (dev / stg / prod) across three AWS accounts you need to:

- Copy-paste a `backend {}` block into every single root module (9 files)
- Copy-paste a `provider "aws" {}` block with `assume_role` into every root module
- Manually keep every `module "x" { source = "..." }` version pin consistent

Change the state bucket name? Edit 9 files. Rotate the assumed-role ARN? Edit 9 files. Upgrade a module version? Hope you found every reference.

**What Terragrunt is:** A thin CLI wrapper around Terraform. It does NOT replace Terraform — it calls Terraform internally. Every `terragrunt plan` eventually becomes a `terraform plan` called with standard HCL that Terraform knows nothing special about.

What Terragrunt adds is a **configuration pre-processor** layer: it reads your `terragrunt.hcl` files, generates `.tf` files, downloads remote modules, and then hands everything off to Terraform as if it were a normal root module.

```
Your terragrunt.hcl stack
        ↓  (1) Terragrunt reads includes, executes generate blocks, downloads module source
Generated .tf files (backend.tf, provider.tf) + module source in .terragrunt-cache/
        ↓  (2) inputs = {...} → TF_VAR_* env vars
terraform init → terraform plan / apply
        ↓  (3) Normal Terraform execution
```

---

## Topic 1 — How Terragrunt Modifies the Execution Model

When you run `terragrunt apply` from inside a unit directory, before Terraform runs Terragrunt performs the following steps in order:

### Step 1: Parse & Evaluate `terragrunt.hcl`

Terragrunt reads the current `terragrunt.hcl` and all `include`d parent files. It evaluates `locals {}` blocks using the iterative evaluator in `pkg/config/locals.go` — it repeatedly loops over unevaluated local expressions (up to `MaxIter = 1000`) until all inter-local references are resolved or an error is thrown.

### Step 2: Resolve `dependency` blocks

For each `dependency` block, Terragrunt calls `getTerragruntOutputIfAppliedElseConfiguredDefault` (in `pkg/config/dependency.go`). This function:

1. Runs `terragrunt output -json` on the target unit's directory.
2. The result is cached in a context-scoped `JSONOutputCacheContextKey` cache so the same target isn't queried twice in a `run-all`.
3. If the target state is empty (not yet applied), the function falls through to `shouldReturnMockOutputs`.
4. If `mock_outputs` are set **and** the current command is in `mock_outputs_allowed_terraform_commands`, mocks are returned.
5. Otherwise, it returns `TerragruntOutputTargetNoOutputs` error.

**Cyclic dependency detection** happens before output resolution via `checkForDependencyBlockCyclesUsingDFS` — a depth-first search over the `dependency.config_path` graph.

### Step 3: Execute `generate` blocks

Each `generate` block writes a file (e.g. `backend.tf`, `provider.tf`) into the Terraform working directory (the `.terragrunt-cache` subdirectory). The `if_exists` attribute controls what happens if the file already exists:

- `"overwrite_terragrunt"` — overwrite only files Terragrunt previously generated (safest for `generate` blocks)
- `"overwrite"` — always overwrite
- `"skip"` — skip if the file exists (dangerous — stale files won't be updated)
- `"error"` — fail if the file exists

### Step 4: Download the module source

If `terraform { source = "..." }` points to a remote URI, Terragrunt uses `go-getter` to download it into `.terragrunt-cache/<url-hash>/<content-hash>/`. The hash of the URL is used as the outer cache folder; the inner hash tracks content changes. Terragrunt `cd`s into this directory before running Terraform.

### Step 5: Pass `inputs` as `TF_VAR_*`

All keys in the `inputs = { ... }` block are serialised and exported as `TF_VAR_<key>` environment variables. Terraform sees them as standard input variable values.

---

## Topic 2 — Core Blocks Reference

### `locals` block

Evaluated by an iterative resolver (`pkg/config/locals.go`). Each local can reference other locals. References are resolved in multiple passes — forward references work as long as there are no cycles. Locals from included parent files are **not** merged into child locals; each file's `locals` block is private to that file (per the source comment: *"locals [These blocks are not merged by design]"*).

```hcl
locals {
  env_vars       = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  aws_account_id = local.env_vars.locals.aws_account_id      # inter-local reference works
  state_bucket   = "tfstate-${local.aws_account_id}"
}
```

### `include` block

Inherits configuration from a parent `terragrunt.hcl`. It supports three merge strategies (controlled via `merge_strategy`):

| Strategy | Behaviour | Source reference |
|---|---|---|
| `no_merge` | Parent config is parsed but not merged | `include.go:NoMerge` |
| `shallow_merge` (default) | Simple attributes: child wins. Lists: concatenated. Maps: merged shallowly. | `include.go:ShallowMerge` |
| `deep_merge` | Maps merged recursively, lists concatenated. Inputs deep-merged via `mergo.Merge` with `WithAppendSlice` and `WithOverride`. | `include.go:DeepMerge` |

`locals` blocks are **never merged** regardless of strategy — this is an explicit design decision in the source.

```hcl
include "root" {
  path           = find_in_parent_folders("root.hcl")
  merge_strategy = "deep_merge"   # optional; "shallow_merge" is default
  expose         = true           # allows referencing include.root.locals.* in this file
}
```

### `generate` block

The primary mechanism for keeping `backend.tf` and `provider.tf` DRY:

```hcl
generate "backend" {
  path      = "backend.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
terraform {
  backend "s3" {
    bucket = "my-tfstate"
    key    = "${path_relative_to_include()}/terraform.tfstate"
    region = "ap-south-1"
  }
}
EOF
}
```

**`path_relative_to_include()`** — returns the relative path from the root `terragrunt.hcl` to the current unit's folder. This is the mechanic that gives every unit a unique S3 key automatically. For a unit at `live/prod/vpc/terragrunt.hcl` the result is `prod/vpc`.

> **Alternative:** `remote_state {}` block generates a `backend.tf` via its own `generate` sub-attribute and also configures backend initialisation. `generate` blocks and `remote_state` can coexist; `remote_state` is specifically for the remote backend block while `generate` is general-purpose.

### `dependency` block

```hcl
dependency "vpc" {
  config_path = "../vpc"                            # relative to this terragrunt.hcl

  mock_outputs = {
    vpc_id             = "vpc-mock"
    private_subnet_ids = ["subnet-mock"]
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]

  # Advanced: merge mocks with partial real state (shallow or deep_merge_map_only)
  mock_outputs_merge_strategy_with_state = "no_merge"   # default
}

inputs = {
  vpc_id = dependency.vpc.outputs.vpc_id
}
```

**What breaks without `mock_outputs`:** When the dependent unit hasn't been applied yet, `getTerragruntOutput` runs `terraform output -json` on the target which returns `{}`. The code checks `isEmpty` and since `shouldReturnMockOutputs` returns false (no mocks), it returns `TerragruntOutputTargetNoOutputs`. Your plan fails with `Error reading outputs`.

**`skip_outputs = true`:** use when you just need the `config_path` to establish ordering but don't actually consume outputs.

**`enabled = false`:** disables the dependency entirely (useful with feature flags).

### `before_hook` / `after_hook`

```hcl
terraform {
  before_hook "tfsec_scan" {
    commands = ["plan", "apply"]
    execute  = ["tfsec", "."]
  }
  after_hook "notify_slack" {
    commands     = ["apply"]
    execute      = ["bash", "-c", "curl -s $SLACK_WEBHOOK -d '{\"text\":\"Apply complete\"}'"]
    run_on_error = true    # run even if the command failed
  }
}
```

Hooks are merged by name during `include` — a child hook with the same name overrides the parent's hook. New-name hooks are appended to the end.

---

## Topic 3 — Multi-Unit Orchestration with `run-all`

### What it does

`terragrunt run-all <command>` traverses the directory tree starting from the current directory, finds all `terragrunt.hcl` files, builds a dependency graph from their `dependency` blocks, and runs `<command>` in topological order.

```bash
# From live/prod/ — plan everything, respecting dependency order
terragrunt run-all plan

# Destroy in reverse dependency order
terragrunt run-all destroy
```

### Parallelism

Units with no inter-dependency in the same graph level run **in parallel** (using goroutines and an errgroup). The `--parallelism` flag controls the max concurrent workers (default: unlimited within a level).

### What happens when `run-all apply` fails mid-way

Assume units A → B → C (C depends on B depends on A):

- A applied successfully: A's state is up-to-date.
- B failed halfway: B is in partial state (same as a plain `terraform apply` failure — resources that completed are in state, failed resources may not be).
- C was never attempted: it was skipped because its dependency (B) failed.

**Recovery pattern:**
1. **Do not** immediately re-run `run-all apply` from the root — this obscures the localized error.
2. `cd` into B's directory. Fix the root cause.
3. `terragrunt apply` in B's directory alone to confirm it succeeds cleanly.
4. Return to the root and re-run `run-all apply`. Completed units (A, B) will show no-change plans and be skipped; C will be applied.

---

## Topic 4 — State Backend: `remote_state` vs `generate`

### `remote_state` block

```hcl
remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket         = "my-tfstate-${local.aws_account_id}"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = local.aws_region
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}
```

`remote_state` does two things: (1) generates `backend.tf` via its inner `generate` attribute, and (2) can auto-create the S3 bucket and DynamoDB table if they don't exist (controlled by `disable_init = false`). The `config` map is passed directly to the backend config block.

**Key insight:** `remote_state` is the canonical pattern for backend generation. Use `generate` for everything else (provider config, versions.tf, etc.).

---

## Topic 5 — Implicit Stacks vs Explicit Stacks

### Implicit stacks (directory-based, the default)

No extra configuration needed. `run-all` discovers all `terragrunt.hcl` files by traversing the directory tree and treats the resulting DAG of dependency blocks as the "stack". This is how 95%+ of Terragrunt repos are organised.

```
live/
├── terragrunt.hcl    ← root config (generate blocks, remote_state)
├── prod/
│   ├── env.hcl
│   ├── vpc/terragrunt.hcl
│   └── app/terragrunt.hcl   ← depends on vpc
└── dev/
    ├── env.hcl
    ├── vpc/terragrunt.hcl
    └── app/terragrunt.hcl
```

### Explicit stacks (`terragrunt.stack.hcl`)

Introduced to allow **versioned, reusable collections of units**. Instead of relying on directory convention, you explicitly declare which units belong together in a `terragrunt.stack.hcl` file.

From `pkg/config/stack.go`:

```go
type StackConfigFile struct {
    Locals *terragruntLocal `hcl:"locals,block"`
    Stacks []*Stack         `hcl:"stack,block"`
    Units  []*Unit          `hcl:"unit,block"`
}
```

```hcl
# terragrunt.stack.hcl
locals {
  env = "prod"
}

unit "vpc" {
  source = "github.com/myorg/infra-modules//stacks/vpc?ref=v1.0.0"
  path   = "vpc"
  values = {
    cidr = "10.0.0.0/16"
  }
}

unit "app" {
  source = "github.com/myorg/infra-modules//stacks/app?ref=v2.0.0"
  path   = "app"
  values = {
    env = local.env
  }
}
```

When you run `terragrunt stack generate`, Terragrunt:

1. Reads the `terragrunt.stack.hcl`
2. Downloads each unit's source into `.terragrunt-stack/<path>/` (the `StackDir` constant)
3. Writes a `terragrunt.values.hcl` file into each generated unit directory (the `valuesFile` constant) — this is an auto-generated HCL file that exposes the `values` map to the unit's `terragrunt.hcl`
4. Validates that each generated directory has a `terragrunt.hcl` file at its root

**When to migrate from implicit to explicit stacks:** When you need to version and promote the *same group of units* as an atomic set across environments — e.g., a "microservice stack" that bundles an ECS service, its IAM role, its ALB target group, and its CloudWatch alarms, all at a specific tested version.

---

## Topic 6 — Terragrunt Caching

`.terragrunt-cache` is created next to each `terragrunt.hcl` file. Add it to `.gitignore`.

The cache directory structure:
```
.terragrunt-cache/
└── <url-encoded-module-source-hash>/
    └── <module-content-hash>/
        ├── main.tf            ← downloaded module source
        ├── variables.tf
        ├── backend.tf         ← generated by Terragrunt
        └── provider.tf        ← generated by Terragrunt
```

**When the cache is stale:** If you change the module source URL or version (the `ref=` param), the outer hash changes and the new version is downloaded. If you change a `generate` block's content but not the source URL, the generated files are overwritten on the next run.

**`--source-update` flag:** Forces re-download of the module source even if the URL and content hash haven't changed. Use this when developing a local module and you've made changes that Terragrunt hasn't detected:

```bash
terragrunt apply --source-update --source /path/to/local/module
```

**`--source` flag:** Overrides the `terraform.source` for the current run. Essential for local development:

```bash
terragrunt plan --source ../../modules/vpc
```

---

## What Terraform Guarantees vs What Terragrunt Adds

| Concern | Terraform alone | With Terragrunt |
|---|---|---|
| DRY backend config | ❌ Copy-paste per root module | ✅ `remote_state` or `generate` in root config |
| DRY provider config | ❌ Copy-paste per root module | ✅ `generate` provider block |
| Cross-module outputs | ❌ Manual `terraform_remote_state` data source | ✅ `dependency` blocks with output caching |
| Multi-unit ordering | ❌ Manual scripts | ✅ `run-all` with DFS graph |
| Unique state key per unit | ❌ Must configure per-module | ✅ `path_relative_to_include()` |
| Versioned stack promotion | ❌ No concept | ✅ `terragrunt.stack.hcl` explicit stacks |

---

## What Terraform Guarantees vs What Terragrunt Does NOT Guarantee

- **Atomicity of `run-all apply`:** Terragrunt does NOT wrap multiple units in an atomic transaction. If unit 5 of 10 fails, units 1–4 are applied and units 6–10 are skipped. You are responsible for recovery.
- **`inputs` variable validation:** Terragrunt passes inputs as `TF_VAR_*`. Terraform validates them against `variable {}` blocks when it runs. If a variable is not declared in the module, Terraform silently ignores it (or errors, depending on version). Terragrunt does not validate inputs before passing them.
- **Provider initialisation:** Terragrunt generates `backend.tf` and `provider.tf` but runs `terraform init` to actually install providers. If the generated provider config is invalid, the failure surfaces during `terraform init`, not at the Terragrunt config-parse stage.

---

## When NOT to Use Terragrunt

- **Your team is new to Terraform:** Learn Terraform's mental model (providers, state, graph) first. Terragrunt wraps errors in another abstraction layer, masking the root cause. A missing `depends_on` inside a module looks very different through a Terragrunt `run-all` failure.
- **Single account / simple setup:** If you have one environment and one account, the `.terragrunt-cache` semantics, the `find_in_parent_folders` indirection, and the extra learning curve add more friction than value.
- **Terraform Cloud / TFE remote execution:** TFC controls the execution environment and manages the working directory. Terragrunt's dynamic file generation and CLI wrapping conflicts with TFC's remote runs model — you lose plan-in-UI approval gates, policy checks, and audit logging.
- **OpenTofu-only teams:** OpenTofu has its own ecosystem (stacks in alpha as of 2025). Check if native OpenTofu features cover your use case before adding Terragrunt.
