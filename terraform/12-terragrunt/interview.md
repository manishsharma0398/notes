# Chapter 12 — Terragrunt — Interview Questions

---

## Q1: "Walk me through exactly what happens when you run `terragrunt apply` inside a unit directory. Be precise — what does Terragrunt do before `terraform apply` is called?"

### The Trap
Candidates often say "it runs Terraform". The interviewer wants the **pre-processing pipeline**: config parsing, include resolution, dependency output fetching, file generation, source download, and how inputs become env vars.

### What a Senior Engineer Says

1. **Parse & include resolution:** Terragrunt reads the current `terragrunt.hcl` and any `include`d parent files. `locals {}` are evaluated using an iterative resolver (`EvaluateLocalsBlock` in `locals.go`) that loops over expressions — up to `MaxIter = 1000` — resolving inter-local references in multiple passes.

2. **Dependency output resolution:** For each `dependency` block, `getTerragruntOutputIfAppliedElseConfiguredDefault` is called. It runs `terraform output -json` on the target unit's working directory. Results are cached in a context-scoped cache — the same target is never queried twice during a `run-all`. If the target state is empty and `mock_outputs` is set and the current command is in `mock_outputs_allowed_terraform_commands`, mocks are returned. If no mocks are configured, it returns `TerragruntOutputTargetNoOutputs`.

3. **`generate` block execution:** Terragrunt writes each generated file (`backend.tf`, `provider.tf`, etc.) into the module working directory in `.terragrunt-cache`. `if_exists = "overwrite_terragrunt"` is the safe option — it only replaces files Terragrunt itself previously generated.

4. **Source download:** `go-getter` downloads the remote module source into `.terragrunt-cache/<url-hash>/<content-hash>/`. Terragrunt `cd`s into this directory.

5. **`terraform init`:** Run in the `.terragrunt-cache` working directory.

6. **`terraform apply`:** `inputs = { ... }` keys are passed as `TF_VAR_*` environment variables. Terraform receives a normal root module with no knowledge of Terragrunt.

---

## Q2: "Your CI pipeline runs `terragrunt run-all plan` on a brand-new environment. The `app` unit has a `dependency` block on `vpc`, but `vpc` hasn't been applied yet. What happens and how do you fix it?"

### The Trap
Tests understanding of when dependency output resolution occurs (before Terraform runs) and the exact error path in the source code.

### What a Senior Engineer Says

Before Terraform runs, Terragrunt calls `getTerragruntOutputIfAppliedElseConfiguredDefault` on the `vpc` unit. Since the VPC hasn't been applied, `terraform output -json` returns `{}`. The code checks `isEmpty` — `true`. It then calls `shouldReturnMockOutputs`. If no `mock_outputs` are configured, this returns `false` and Terragrunt throws `TerragruntOutputTargetNoOutputs`. The `app` unit fails to plan.

**Fix — add `mock_outputs` restricted to plan-time commands:**

```hcl
dependency "vpc" {
  config_path = "../vpc"

  mock_outputs = {
    vpc_id             = "vpc-mock"
    private_subnet_ids = ["subnet-mock"]
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}
```

With this config, `shouldReturnMockOutputs` returns `true` during `plan` and `validate`. During `apply`, the list check fails and real outputs are required, preventing you from accidentally applying with stale data.

---

## Q3: "How does `path_relative_to_include()` ensure every unit gets a unique S3 state key without any per-unit configuration? What would break if you removed it and hardcoded a fixed key?"

### The Trap
Tests understanding of the `generate` / `remote_state` backend generation mechanic and why a fixed key creates a shared-state disaster.

### What a Senior Engineer Says

`path_relative_to_include()` evaluates to the relative path from the root `terragrunt.hcl` to the current unit's `terragrunt.hcl`. For `live/prod/vpc/terragrunt.hcl`, it returns `prod/vpc`.

In the root config's `remote_state` (or `generate` block):

```hcl
key = "${path_relative_to_include()}/terraform.tfstate"
```

The generated `backend.tf` in `.terragrunt-cache` for the VPC unit will contain:
```hcl
backend "s3" {
  key = "prod/vpc/terraform.tfstate"
}
```

For the app unit it becomes `prod/app/terraform.tfstate`. Because every unit lives in a unique directory, every unit gets a unique key automatically — **zero per-unit backend configuration**.

If you hardcoded a fixed key, e.g. `key = "terraform.tfstate"`, every unit would read and write the **same S3 state file**. The second `terragrunt apply` would overwrite the first unit's state with the second unit's resource set. The VPC resources would disappear from state on the first `app` apply. This is a catastrophic misconfiguration that would cause mass `terraform destroy` on the next apply of the first unit.

---

## Q4: "`terragrunt run-all apply` from `live/prod/` fails on unit 7 of 12. What is the exact state of your infrastructure? Walk me through a safe recovery procedure."

### The Trap
Tests blast-radius understanding and disciplined incident recovery vs panic re-running `run-all` which can obscure the error or cause further damage.

### What a Senior Engineer Says

**Infrastructure state:**

- **Units 1–6 (no dependency on 7, completed before failure):** Applied successfully, state files are fully updated.
- **Unit 7 itself:** In whatever partial state Terraform left it. Resources whose API calls completed before the failure are in state. Resources whose API calls didn't complete may be in an unknown state (not in state, but possibly partially created in AWS). This is the same partial-apply problem as native Terraform.
- **Units 8–12 that depend on 7 (directly or transitively):** Were never attempted by Terragrunt — they were skipped when the errgroup received unit 7's error. Their state files are untouched.
- **Units 8–12 with NO dependency on 7:** These may have already applied successfully in parallel with unit 7 if the parallelism limit allowed it.

**Recovery:**

1. **Do not** immediately re-run `run-all apply` from the root. This loses the localised error signal.
2. Inspect unit 7's Terraform state: `terragrunt state list` from unit 7's directory.
3. Diagnose and fix the root cause (IAM eventual consistency lag, quota limit, module bug, etc.).
4. `terragrunt apply` in unit 7's directory alone. Verify it succeeds cleanly.
5. Return to `live/prod/` and `terragrunt run-all apply`. Units 1–7 will show no-change plans (Terraform idempotency); units 8–12 will be applied.

---

## Q5: "You have a root `terragrunt.hcl` that defines a `before_hook` that runs `tfsec`. A child unit defines its own `before_hook` with the same name but pointing to a different scanner. Which one runs? What if they have different names?"

### The Trap
Tests understanding of hook merge semantics from `include.go`, specifically `mergeHooks`.

### What a Senior Engineer Says

From `include.go:mergeHooks`: hooks are merged by **name**. If a child hook has the same name as a parent hook, the child hook **overrides** the parent's hook entirely — the parent hook is replaced. If the child hook has a different name from all parent hooks, it is **appended** to the end of the parent's hooks list.

So:
- **Same name:** Only the child's hook runs. The parent's `tfsec` hook is discarded.
- **Different names:** Both hooks run — parent's first, then child's (appended to the end).

This is how you allow child units to override compliance tooling for specific cases (e.g., a legacy unit that can't pass one particular check) without removing the parent-level hook for all other units.

---

## Q6: "What is the difference between an implicit Terragrunt stack and an explicit `terragrunt.stack.hcl` stack? When would you migrate from one to the other?"

### The Trap
Tests awareness of the newer explicit stacks feature and the operational scenarios that justify it.

### What a Senior Engineer Says

**Implicit stack:** Just a directory tree. `run-all` discovers `terragrunt.hcl` files by traversal and builds the dependency graph from their `dependency` blocks. The "stack" is implicit in the directory structure. Every team starts here.

**Explicit stack (`terragrunt.stack.hcl`):** Declares `unit {}` and `stack {}` blocks that reference remote sources at specific versions. Running `terragrunt stack generate` materialises the units into a `.terragrunt-stack/` directory (the `StackDir` constant in `stack.go`) and writes a `terragrunt.values.hcl` values file into each unit directory. The stack config itself is versioned and promotable.

**When to migrate:**
- You have a multi-service "platform stack" (ECS service + IAM role + ALB + CloudWatch) that needs to be versioned and promoted as a single tested artifact across dev → stg → prod.
- You want to decouple the directory layout (which environment-specific units live) from the module implementation version (what version of the reusable modules they use).
- You want a single `ref=` pin point that advances through environments atomically.

**When to stay implicit:**
- Simple single-account setups.
- Teams still learning Terragrunt's basic semantics.
- The operational overhead of `stack generate` + the `.terragrunt-stack` materialisation step doesn't provide enough lift over a well-managed directory tree with locked module versions.
