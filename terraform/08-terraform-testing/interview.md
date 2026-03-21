# Chapter 08 — Terraform Testing (`terraform test`) — Interview Questions

---

## Q1: "Your `terraform test` suite passes locally but fails in CI against the mock provider. The error is `Error: Functions may not be called here`. What are the possible causes?"

### The Trap
Tests awareness of mock provider limitations — specifically that provider-defined functions require a real, initialized provider.

### What a Senior Engineer Says

The error `Functions may not be called here` in the context of mock providers most commonly means a **provider-defined function** is being called in the module under test, and the mock provider cannot serve it.

Provider-defined functions (v1.8) — like `provider::aws::arn_parse()` — are implemented in the provider binary itself. When you use `mock_provider "aws" {}`, Terraform replaces the provider with a stub. That stub can return fake resource attribute values (it knows the schema), but it **cannot execute provider-defined functions** because those functions live in the real provider binary, which is not running.

**Fix options:**
1. Use the real provider in CI with restricted IAM credentials (read-only access) just for the functions
2. Refactor the module to avoid provider-defined functions in places that need to be unit-tested (e.g., pre-compute the value with a variable or `local`)
3. Use `command = plan` with the real provider for the specific run block that exercises that code path

**Other causes of the same error in CI:**
- A function is being called inside a `variable { validation {} }` block — validations cannot call provider functions
- A function is referenced in a `backend {}` block — backend config is evaluated before providers are initialized

---

## Q2: "You have a module with 10 run blocks. Run block 5 fails an assertion. What happens to run blocks 6–10 and to the resources created by blocks 1–4?"

### The Trap
Tests understanding of test lifecycle — whether Terraform stops on first failure and whether cleanup runs regardless.

### What a Senior Engineer Says

**Execution after failure:** By default, `terraform test` marks run block 5 as failed and **continues executing run blocks 6–10**. All run blocks are attempted unless you pass `-run=<specific run name>` to filter. This is intentional — you want a full picture of which tests are failing, not just the first one.

**Cleanup:** After all run blocks complete (or fail), Terraform performs cleanup regardless of whether any assertions failed. Resources accumulated in the test state across blocks 1–5 (the ones that ran `command = apply`) are destroyed in reverse order. Block 5's failed assertion does not skip this cleanup.

**The exception — interrupted cleanup:** If `terraform test` is killed mid-cleanup (SIGKILL), resources from blocks 1–4 remain in AWS. The v1.16 experimental `skip_cleanup` attribute and `test cleanup` command exist specifically to handle this case by writing state to disk and allowing later cleanup.

**What this means operationally:**
- Later run blocks can depend on resources created by earlier blocks (they share test state)
- A failed assertion in run block 5 does NOT affect the resources created by block 4 — they still exist until cleanup
- The exit code of `terraform test` is non-zero if any assertion failed, even if all resources were cleaned up successfully

---

## Q3: "You want to test that your `network` module correctly rejects a CIDR block smaller than `/24`. How do you write this test? What exactly does `expect_failures` check?"

### The Trap
Tests ability to write negative tests (asserting that *invalid* inputs are rejected), and understanding of how `expect_failures` works vs `assert`.

### What a Senior Engineer Says

The module has a variable validation:

```hcl
# modules/network/variables.tf
variable "vpc_cidr" {
  type = string
  validation {
    condition     = tonumber(split("/", var.vpc_cidr)[1]) <= 24
    error_message = "VPC CIDR block must be /24 or larger (e.g., /16, /20, /24)."
  }
}
```

The test:

```hcl
# tests/network.tftest.hcl
mock_provider "aws" {}

run "rejects_cidr_smaller_than_24" {
  command = plan   # No real resources needed to catch a variable validation failure

  variables {
    vpc_cidr = "10.0.0.0/28"   # Invalid — /28 is smaller than /24
  }

  # Tell Terraform: this run SHOULD fail, specifically because var.vpc_cidr's
  # validation fires. The test PASSES if and only if that validation fires.
  expect_failures = [var.vpc_cidr]
}
```

**What `expect_failures` actually does:**
- It takes a list of `checkable objects` — variable references, resource references, or check block references.
- During the run, if any of those objects triggers their custom condition (validation failure, precondition/postcondition violation), that diagnostic is *caught* and treated as expected.
- If the expected failure does NOT fire (i.e., the invalid input somehow passed validation), the test fails with `Missing expected failure`.
- If the run fails for a *different* reason (e.g., a different variable validation fires), the unexpected failure still propagates and fails the test.

This inverted test pattern is the only way to assert that your input validation is correct — you must verify that invalid inputs are rejected, not just that valid inputs are accepted.

---

## Q4: "When should you use `terraform test` instead of a `check` block? When should you use a `precondition` instead of a `terraform test` assertion?"

### The Trap
Tests architectural decision-making — which correctness tool belongs at which layer.

### What a Senior Engineer Says

These tools operate at different layers and serve different purposes:

**`precondition` / `postcondition`** — lives inside a resource's `lifecycle` block. Guards the lifecycle of one specific resource. Fires at plan or apply time on every `terraform plan`/`terraform apply` run against live infrastructure. Blocks the operation if violated. Use when: you want to encode an invariant about a resource that must always be true when Terraform touches it. Example: "The deployed Lambda layer version ARN must contain the expected hash."

**`check` block** — a top-level block, evaluated every plan. Never blocks the apply — fires as a warning. Has access to a scoped data source for real-world lookups. Use when: you want to continuously monitor a live infrastructure assertion (e.g., "this S3 bucket has no public ACL") without failing deployments when the check fails. It's continuous drift detection.

**`terraform test` / `assert`** — runs in an isolated test context, not against live infrastructure (unless you use a real provider). Use when: you want to verify that a module produces the correct HCL resource graph given specific inputs, before deploying it anywhere. It's module-level unit/integration testing.

**Decision tree:**
```
Is this a guard that must pass for a resource to be safe to create/update?
  → precondition / postcondition

Is this a continuous assertion about live infrastructure that should alert but not block?
  → check block

Is this a test of a module's correctness before it's deployed?
  → terraform test
```

---

## Q5: "A colleague has a `terraform test` suite that only uses `command = apply` run blocks and a real AWS provider with admin credentials in CI. It works, but you flag it in code review. What are your concerns?"

### The Trap
Tests practical awareness of the operational and security risks of integration tests with real cloud resources.

### What a Senior Engineer Says

Several concerns, in priority order:

1. **Blast radius of admin credentials in CI:** The role or access keys running `terraform test` with admin credentials against a real account can create, modify, and destroy any resource. If those credentials leak (via pipeline logs, artifact exposure), an attacker has full account access. The test IAM role should be scoped to exactly the resources the module under test manages.

2. **Cost and cleanup risk:** Every `command = apply` run block provisions real AWS resources. If the test runner is killed mid-run (spot instance, OOM), cleanup doesn't happen. Over time, orphaned test resources accumulate. All test resources should be tagged and there should be a scheduled nuke job for the test account.

3. **Test speed and flakiness:** Real AWS applies take minutes, not seconds. A test suite that takes 20 minutes is rarely run. Tests that interact with eventually-consistent APIs (IAM, S3 bucket policies) will have intermittent timing failures.

4. **Missing unit test layer:** If *all* tests use real infrastructure, you have no fast feedback loop for module logic errors. A change to a variable validation or a local computation should fail in seconds with a mock provider, not after a 5-minute AWS provisioning cycle.

**Better structure:**
- Mock provider tests for all HCL logic, variable validations, and output correctness → run on every commit, completes in seconds
- Real provider tests (restricted IAM, isolated test account) for integration assertions → run on merge to main
- `check` blocks in the module itself for continuous drift monitoring in non-test environments
