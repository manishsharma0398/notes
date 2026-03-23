# Chapter 12 — Terragrunt — Revision Notes

## 1. Terragrunt is a pre-processor, not a replacement for Terraform

Terragrunt reads your `terragrunt.hcl` hierarchy, evaluates `generate` blocks to write `backend.tf`/`provider.tf`, downloads the remote module source into `.terragrunt-cache/`, then `cd`s into that directory and runs standard `terraform init/plan/apply`. Terraform never knows Terragrunt was involved — it just sees HCL files and `TF_VAR_*` environment variables.

## 2. `locals` are evaluated iteratively, never merged across includes

`pkg/config/locals.go` `EvaluateLocalsBlock` uses a loop (max 1000 iterations) that repeatedly attempts to resolve local expressions that reference other locals. Crucially, `locals` blocks are **never merged** during `include` processing — this is a deliberate design decision in the source. Each file's locals are private to that file, referenced via `include.root.locals.*` only if `expose = true`.

## 3. `dependency` output resolution runs `terraform output -json` on the target unit

`getTerragruntOutputIfAppliedElseConfiguredDefault` in `dependency.go`: if the target state is empty (not yet applied), it falls through to `shouldReturnMockOutputs`. If `mock_outputs` is set and the current command is in `mock_outputs_allowed_terraform_commands`, mocks are returned. Otherwise: `TerragruntOutputTargetNoOutputs` error. Outputs are cached per-target in a context-scoped cache — the same unit is only queried once during a `run-all`.

## 4. `include` merge strategy matters — `deep_merge` vs `shallow_merge`

Default is `shallow_merge`: child simple-attributes win, inputs are shallowly merged (child keys override parent). With `deep_merge`: inputs are recursively merged using `mergo.Merge` with `WithAppendSlice` + `WithOverride`, and list-type inputs are concatenated rather than replaced. Hooks are merged by name in both strategies — same-named child hook overrides parent's.

## 5. `run-all` is not atomic — failure leaves partial state and a skipped dependency subtree

When `terragrunt run-all apply` fails at unit B (which depends on A and is depended on by C): A is fully applied, B is in partial Terraform-apply state, C is never started. Recovery: fix and `terragrunt apply` in B's directory alone, then re-run `run-all` from the root — completed units show no-change plans and are skipped.

## 6. Explicit stacks (`terragrunt.stack.hcl`) materialise versioned unit sets into `.terragrunt-stack/`

`GenerateStackFile` in `stack.go` downloads each `unit {}` source, copies it to `.terragrunt-stack/<path>/` (the `StackDir` constant), and writes a `terragrunt.values.hcl` file (the `valuesFile` constant) with the `values` map. Use explicit stacks when you need to version-lock and promote a collection of units as an atomic set across environments.
