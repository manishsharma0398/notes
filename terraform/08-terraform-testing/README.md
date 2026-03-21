# Chapter 08 — Terraform Testing (`terraform test`)

## Mental Model

**Problem this solves:** Terraform's lifecycle blocks (`precondition`, `postcondition`, `check`) validate infrastructure *at runtime* during plan/apply. But they cannot answer the question: *"If I change this module's interface, does it still produce the correct resources across all its usage patterns?"* Without a test framework, the only way to verify a module is to apply it against a real cloud account, observe whether it breaks, and destroy it. This is slow, expensive, and not repeatable in CI without real AWS credentials.

`terraform test` (GA in v1.6) is the answer: a test runner built into the CLI that can provision real infrastructure per test, make assertions against it, and destroy it after — or skip provisioning entirely using mock providers (v1.7) for pure unit testing.

```
                     ┌─────────────────────────────────────┐
                     │  terraform test                      │
                     │                                      │
  .tftest.hcl ──────►│  run block 1 ──► apply ──► assert   │
                     │       │                              │
                     │       └──► destroy (cleanup)         │
                     │                                      │
                     │  run block 2 ──► plan  ──► assert   │
                     │       │                              │
                     │       └──► destroy (cleanup)         │
                     └─────────────────────────────────────┘
```

The test file IS infrastructure-as-code. It plans/applies real resources or mocks them, asserts on outputs and resource attributes, and tears everything down. When the test runner finishes (or is interrupted), it always attempts cleanup — a finalizer model.

---

## Topic 1 — `.tftest.hcl` File Structure and `run` Blocks

### Mechanism

Test files live in the module directory (or a `tests/` subdirectory) with the `.tftest.hcl` extension. They are loaded and run by `terraform test`.

```hcl
# tests/s3_bucket.tftest.hcl

# Variables passed to the root module under test
variables {
  bucket_name = "my-test-bucket-${run.setup.output.random_suffix}"
  environment = "test"
}

# Optional: a provider block to configure the provider for the test
provider "aws" {
  region = "us-east-1"
}

# run block 1 — provisions infrastructure and asserts on it
run "bucket_is_created_with_private_acl" {
  command = apply    # default; provisions real resources

  assert {
    condition     = aws_s3_bucket.this.bucket == var.bucket_name
    error_message = "Bucket name does not match input variable"
  }

  assert {
    condition     = aws_s3_bucket_acl.this.acl == "private"
    error_message = "Expected private ACL, got ${aws_s3_bucket_acl.this.acl}"
  }
}

# run block 2 — plan-only check (no infrastructure provisioned)
run "plan_shows_no_changes_on_reapply" {
  command = plan

  assert {
    condition     = length(planned_values.root_module.resources) > 0
    error_message = "Expected resources to be declared"
  }
}
```

### Key Syntax Points

| Attribute | Description |
|---|---|
| `command = apply` | Default. Provisions resources; cleanup happens after the file finishes. |
| `command = plan` | Plan-only. No cloud resources created. Assertions run against plan values. |
| `variables {}` | Override module input variables for this specific run or the whole file. |
| `assert {}` | One or more assertion blocks; all must pass for the run to succeed. |
| `expect_failures` | Declare that a specific condition or check block is *expected* to fail — inverts the assertion. |
| `module {}` | Override which module to test (allows testing a submodule directly). |

### What Terraform Guarantees

- Each `run` block that uses `command = apply` maintains its own state. Resources created in run 1 are visible to run 2 (they accumulate in the same test state).
- After all `run` blocks complete (or if `terraform test` is interrupted with Ctrl+C), Terraform **destroys all resources it created**, in reverse order, using the accumulated state.
- If cleanup itself fails (e.g., AWS API error during destroy), Terraform reports it as a warning and continues cleaning up other resources.

### Failure Mode — Test State Leakage

If the test runner process is killed (SIGKILL, OOM, spot instance termination) rather than gracefully interrupted, cleanup may not run. The resources remain in AWS, accruing cost. This is the same stale-lock problem from CI/CD, but now with orphaned real AWS resources.

Mitigation:
- Tag all test resources with `Environment = "test"` and a TTL tag
- Use a cost-monitoring alert for the test account
- Use mock providers (see Topic 2) for unit tests — no real resources, no cleanup debt

---

## Topic 2 — Mock Providers (`mock_provider`)

### Mechanism — v1.7

Mock providers replace a real provider with a **stub** that returns values satisfying the provider's schema, without making any API calls. This enables true unit testing: the module's HCL logic is tested in isolation.

```hcl
# tests/unit/lambda.tftest.hcl

mock_provider "aws" {
  # All aws_* resources will return auto-generated values that satisfy
  # the provider schema, unless overridden below.

  # Override specific resources with deterministic values
  override_resource {
    target = aws_iam_role.lambda_exec
    values = {
      arn  = "arn:aws:iam::123456789012:role/mock-lambda-role"
      name = "mock-lambda-role"
    }
  }

  # Override data sources too
  override_data {
    target = data.aws_caller_identity.current
    values = {
      account_id = "123456789012"
      arn        = "arn:aws:iam::123456789012:user/test"
      user_id    = "AIDAIOSFODNN7EXAMPLE"
    }
  }

  # Override an entire module's outputs
  override_module {
    target  = module.vpc
    outputs = {
      vpc_id            = "vpc-12345"
      private_subnet_ids = ["subnet-a", "subnet-b"]
    }
  }
}

run "lambda_iam_policy_is_correct" {
  command = plan   # No real AWS calls — mock provider handles everything

  assert {
    condition     = aws_lambda_function.this.function_name == "my-func-test"
    error_message = "Function name doesn't match"
  }

  assert {
    condition     = aws_iam_role_policy_attachment.lambda.policy_arn == "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
    error_message = "Wrong managed policy attached"
  }
}
```

### Override Priority (from source: `mocking/overrides.go`)

When multiple override sources exist, the resolution order is:
1. **Run-block overrides** (highest priority) — `override_resource` inside a `run` block
2. **File-level overrides** — `override_resource` at the `mock_provider` or file level
3. **Mock provider defaults** — auto-generated values from the provider schema

This means a run block can override a file-level mock for a single test without affecting others.

### What Mock Providers Cannot Do

- They cannot validate that the real AWS API accepts the configuration. A mock test passing does not mean the real AWS API call will succeed.
- They cannot simulate eventual consistency, IAM propagation delays, or API rate limiting.
- Provider-defined functions (e.g., `provider::aws::arn_parse()`) require the real provider to be initialized — they do not work with mock providers.

Mock providers are for **logic tests** (does my HCL produce the right resource configurations?), not **integration tests** (does AWS accept and execute those configurations?).

---

## Topic 3 — Assertions

### `assert` Block Mechanics

```hcl
run "my_test" {
  assert {
    condition     = length(aws_security_group.this.ingress) == 1
    error_message = "Expected exactly 1 ingress rule, got ${length(aws_security_group.this.ingress)}"
  }
}
```

- `condition` must evaluate to `true` for the assertion to pass. Any expression valid in HCL is valid here, including function calls and attribute traversals.
- `error_message` is displayed when the assertion fails. It supports interpolation — include the actual value in the message for useful diagnostics.
- Multiple `assert` blocks per `run` block: all are evaluated; the run fails if any fails.

### `expect_failures` — Testing That Invalid Configs Fail

```hcl
# Test that our variable validation rejects invalid input
run "rejects_invalid_environment_name" {
  variables {
    environment = "PRODUCTION"    # We expect our validation to reject uppercase
  }

  # Declare that this is expected to fail — passing means the test passes
  expect_failures = [var.environment]
}
```

---

## Topic 4 — JUnit XML Output (v1.11 GA)

### Mechanism

```bash
terraform test -junit-xml=results.xml
```

Produces a JUnit-compatible XML file. GitLab CI and GitHub Actions both natively parse JUnit XML to render test results in the pipeline UI, showing pass/fail per run block without reading log output.

```yaml
# GitLab CI integration
test:
  script:
    - terraform test -junit-xml=results.xml
  artifacts:
    reports:
      junit: results.xml   # GitLab renders this in the pipeline test report tab
    when: always           # Capture even on failure
```

---

## Topic 5 — When to Use What

| Tool | Scope | Cloud calls? | Blocks apply? |
|---|---|---|---|
| `precondition` / `postcondition` | Single resource lifecycle | Yes (live apply) | Yes — plan/apply fails |
| `check` block | Continuous assertion on live infra | Yes (every plan) | No — warning only |
| `terraform test` + real provider | Integration test | Yes — real AWS | After all runs complete (cleanup) |
| `terraform test` + `mock_provider` | Unit test (HCL logic) | No | Not applicable |

**Decision rule:**
- Does the test require a real API response? → real provider test
- Are you testing module logic, variable validation, or output correctness? → mock provider
- Do you need to assert on live running infrastructure continuously? → `check` block
- Do you need to guard a resource against invalid inputs at plan time? → `precondition`

---

## Source References

- [terraform test command docs](https://developer.hashicorp.com/terraform/cli/commands/test)
- [Writing tests guide](https://developer.hashicorp.com/terraform/language/tests)
- [Mock providers](https://developer.hashicorp.com/terraform/language/tests/mocking)
- Source: `internal/moduletest/` and `internal/moduletest/mocking/` in the Terraform repo
