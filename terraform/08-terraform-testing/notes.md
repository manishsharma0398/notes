# Chapter 08 — Terraform Testing (`terraform test`) — Revision Notes

## 1. `terraform test` provisions real infrastructure per run block and destroys it after

- Tests live in `.tftest.hcl` files. Each `run` block either plans (`command = plan`) or applies (`command = apply`) the module under test.
- All resources created across all `run` blocks accumulate in a test-scoped state. After all runs complete (or on interrupt), Terraform destroys them in reverse order.
- **Failure mode:** if the test process is SIGKILL'd (OOM, spot instance preemption), cleanup is skipped. Orphaned resources remain in AWS, accruing cost. tag all test resources with `Environment = "test"` and a TTL tag.

## 2. Mock providers (v1.7) enable unit testing without AWS credentials

- `mock_provider "aws" {}` replaces the real provider with a schema-aware stub. All resources return auto-generated values that satisfy the provider schema — no API calls.
- Use `override_resource`, `override_data`, and `override_module` to supply deterministic values for assertions.
- **Override priority (from source):** run-block overrides > file-level overrides > mock provider defaults.
- **What mocks cannot do:** validate real AWS API acceptance, simulate eventual consistency, or run provider-defined functions (e.g., `provider::aws::arn_parse()`).

## 3. `assert` blocks evaluate HCL expressions; `expect_failures` inverts the test

- `condition` can be any valid HCL expression. `error_message` supports interpolation — always include the actual value.
- Multiple `assert` blocks per `run`: all are evaluated; the run fails if any assert fails.
- `expect_failures = [var.environment]` declares that a specific custom condition is expected to fail — the test *passes* if and only if that condition fires. Used to test that invalid inputs are correctly rejected.

## 4. JUnit XML (`-junit-xml`) integrates test results into CI dashboards

- `terraform test -junit-xml=results.xml` emits a JUnit-compatible XML file.
- GitLab CI renders this in the **Test Reports** tab (`artifacts.reports.junit: results.xml`). GitHub Actions renders it in the **Summary** tab with a test results action.
- Capture the artifact `when: always` so failures are reported even when the test command exits non-zero.

## 5. Choose the right correctness tool for the right layer

- **`precondition`/`postcondition`:** guards on a single resource at plan/apply time; blocks the operation if violated.
- **`check` block:** continuous, non-blocking assertion on live infrastructure; fires every plan as a warning.
- **`terraform test` + real provider:** integration test proving the AWS API accepts the configuration.
- **`terraform test` + `mock_provider`:** unit test proving the HCL logic produces the right resource graph.
