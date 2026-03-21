# Chapter 20 — Terragrunt — Interview Questions

---

## Q1 — Execution Model

> "You run `terragrunt apply` in `live/prod/app/`. Walk me through exactly what happens before `terraform apply` is called."

**Answer:**
1. Terragrunt reads `live/prod/app/terragrunt.hcl` and any `include`d parent files.
2. It evaluates `generate` blocks — writes `backend.tf`, `provider.tf`, etc. into the `.terragrunt-cache` working directory.
3. It downloads the remote module from the `terraform { source = "..." }` URL into `.terragrunt-cache` (skipped if already cached and URL unchanged).
4. It `cd`s into `.terragrunt-cache/<hash>/<hash>/`.
5. It runs `terraform init` to initialise providers and the backend.
6. It runs `terraform apply`, passing `inputs = { ... }` values as `TF_VAR_*` environment variables.

The Terraform process sees a standard root module — it has no knowledge that Terragrunt is involved.

---

## Q2 — `dependency` Block Failure

> "Your CI pipeline runs `terragrunt run-all plan` on a new environment. The VPC unit hasn't been applied yet. The app unit has a `dependency` block on VPC. What happens and how do you fix it?"

**Answer:**
The `dependency` block attempts to read the VPC unit's remote state to fetch its outputs. Since the VPC hasn't been applied, the state is empty (or doesn't exist). Terragrunt fails with an error like `Error reading outputs` — it cannot resolve the `dependency.vpc.outputs.vpc_id` reference.

Fix: add `mock_outputs` to the `dependency` block restricted to plan-time commands:
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
This lets `plan` succeed with placeholder values. Apply still requires real outputs.

---

## Q3 — State Key Uniqueness

> "How does Terragrunt ensure every unit gets a unique state file in S3 without manually specifying the key for each unit?"

**Answer:**
The `path_relative_to_include()` function in the root `generate "backend"` block returns the relative path of the current unit from the root `terragrunt.hcl`. For `live/prod/app/terragrunt.hcl` with root at `live/`, this returns `prod/app` — which becomes the S3 key: `prod/app/terraform.tfstate`.

Since every unit lives in a unique directory, every unit automatically gets a unique state key with zero per-unit configuration.

---

## Q4 — `run-all` Blast Radius

> "You run `terragrunt run-all apply` from `live/prod/` and unit 5 fails. What is the state of your infrastructure and how do you recover?"

**Answer:**
- Units with no dependency on unit 5 that completed before the failure: **applied, in their state files**.
- Units that depended on unit 5 (directly or transitively): **skipped — never attempted**.
- Unit 5 itself: in whatever partial state Terraform left it (same as a normal partial apply — resources that succeeded are in state, resources that failed may not be).

Recovery:
1. Fix the root cause of unit 5's failure.
2. Run `terragrunt apply` **in unit 5's directory** alone first to confirm it works.
3. Re-run `terragrunt run-all apply` from `live/prod/` — Terragrunt will skip already-applied units where the plan shows no changes and retry failed/skipped units.

---

## Q5 — Generate vs Module Variables

> "Why does Terragrunt use `generate` blocks to create `provider.tf` instead of just passing the AWS role ARN as a module input variable?"

**Answer:**
Terraform modules deliberately don't configure providers inside them (that's the consumer's responsibility, per Terraform best practices). If a module defines an `aws` provider internally, it creates conflicts when the consumer also configures a provider — you get duplicate provider errors or unexpected provider aliasing.

The correct pattern is: the consumer configures the provider, the module inherits it. But in a Terragrunt world with many units all needing different `assume_role` ARNs (one per AWS account), you'd have to write a `provider.tf` file next to every `terragrunt.hcl`. The `generate` block automates this — the root `terragrunt.hcl` generates the correct `provider.tf` (with the right role ARN from `env.hcl`) dynamically before every Terraform execution.
