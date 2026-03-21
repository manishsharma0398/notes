# Chapter 10 — Provider-Defined Functions — Revision Notes

## 1. Provider functions are called via gRPC to the running provider binary

- Syntax: `provider::<provider_name>::<function_name>(<args>)`. The `provider::` namespace distinguishes them from built-in HCL functions.
- The provider **must be initialized** (`terraform init` run, provider binary downloaded and running). Functions are served via the same gRPC channel as `PlanResourceChange` and `ApplyResourceChange`.
- From source (`providers/functions.go`): calling a provider function is a `CallFunction` RPC to the provider process — `provider.CallFunction(CallFunctionRequest{FunctionName: name, Arguments: args})`.

## 2. Arguments that are unknown short-circuit the function — they don't error, they propagate unknown

- If any argument to a provider function is unknown (e.g., the ARN of a resource not yet created), Terraform returns `cty.UnknownVal(retType)` without calling the provider.
- This is correct: the function cannot evaluate without knowing its input, so the result is `(known after apply)`.
- This means `provider::aws::arn_parse(aws_lambda_function.app.arn)` in a plan will show `(known after apply)` for all parsed fields when the Lambda is new. After apply, subsequent plans will show real values.

## 3. AWS `arn_parse` replaces fragile positional `split(":", arn)[N]` chains

- `provider::aws::arn_parse(arn)` returns a structured object with named fields: `partition`, `service`, `region`, `account_id`, `resource`.
- Named fields are robust to any future ARN format variation. Positional index splitting breaks silently if the format has optional segments.
- `provider::aws::trim_iam_role_path(arn)` strips the path prefix from IAM role ARNs — essential for SSO-vended roles that AWS services reject if they contain the `/aws-reserved/sso.amazonaws.com/` path.

## 4. Provider functions cannot be used in backend config, variable defaults, or `required_providers` version constraints

- These blocks are evaluated **before providers are initialized** — the provider binary is not yet running when Terraform parses them.
- Only use provider functions in `resource`, `data`, `local`, `output`, and `module` blocks — i.e., anywhere that is evaluated after `terraform init` and provider startup.

## 5. Mock providers in `terraform test` do NOT execute provider-defined functions

- `mock_provider "aws" {}` stubs out resource schema responses but does not run the real provider binary. Any reference to `provider::aws::*` in the module under test will fail in a mock-provider test.
- Fix: either use the real provider for the specific `run` block that exercises provider functions, or refactor the module to avoid provider functions in paths that need unit testing.
