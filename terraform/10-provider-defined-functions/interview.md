# Chapter 10 — Provider-Defined Functions — Interview Questions

---

## Q1: "You reference `provider::aws::arn_parse(aws_lambda_function.app.arn)` in a local. It's a new resource — not yet created. What does `terraform plan` show for the dependent locals? Does this error?"

### The Trap
Tests whether the candidate knows that provider functions propagate unknown rather than error when given unknown inputs.

### What a Senior Engineer Says

It does not error. From the Terraform source (`providers/functions.go`), when a provider function receives an argument that is not `WhollyKnown`, it short-circuits and returns `cty.UnknownVal(retType)` without making the RPC call to the provider:

```go
if !param.AllowUnknown {
    if !arg.IsWhollyKnown() {
        return cty.UnknownVal(retType), nil
    }
}
```

The plan will show the result of `arn_parse` — and every local that depends on it — as `(known after apply)`. This is correct and expected. The function is essentially a pass-through for unknowns: the result can't be computed before the input exists.

**Operational implication:** If your module uses a provider function to extract a `region` or `account_id` from a new resource's ARN, and then uses that region to construct another resource configuration, that configuration will also be `(known after apply)`. This is a common source of confusion when engineers see `(known after apply)` on a resource that they thought had a fully static configuration — drilling into it reveals a provider function chain with an unresolved dependency.

---

## Q2: "You want to use `provider::aws::arn_parse()` in a module's `variable {}` default to set a sensible default region. Why won't this work?"

### The Trap
Tests knowledge of the initialization order — when providers are available versus when various HCL blocks are evaluated.

### What a Senior Engineer Says

Variable defaults are evaluated during the **configuration loading phase** — before `terraform init` resolves providers and before any provider binary is running. At that point, there is no provider plugin process to call for the function.

The evaluation order is:
1. Parse all `required_providers` blocks → download provider binaries during `init`
2. Evaluate `variable {}` defaults (no providers available yet)
3. Start provider plugin processes
4. Evaluate `resource {}`, `data {}`, `local {}`, `output {}` blocks (providers available)

Provider functions are only accessible in step 4. Attempting to use them in step 2 (variable defaults) or in `backend {}` blocks (step 0 — evaluated even before init) will fail with:

```
Error: There is no function named "provider::aws::arn_parse".
```

**Fix:** Accept the region as an explicit variable input (no default that requires a provider function), or use a data source to look up the current region after providers are initialized:

```hcl
data "aws_region" "current" {}   # Works — data sources are evaluated in step 4

variable "region" {
  type    = string
  default = null   # Caller provides it; no provider function in default
}

locals {
  region = coalesce(var.region, data.aws_region.current.name)
}
```

---

## Q3: "Your `terraform test` suite uses `mock_provider "aws" {}` for speed. A module under test has `provider::aws::arn_parse()` in a local. The test fails with a function call error. How do you fix it without switching to a real provider for the entire test file?"

### The Trap
Tests knowledge of mock provider limitations and the available escape hatches.

### What a Senior Engineer Says

Mock providers stub resource schema responses — they cannot execute the real provider binary's function implementations. When HCL tries to evaluate `provider::aws::arn_parse()` against a mock provider, the stub does not have a `CallFunction` implementation that returns a real parsed result.

**Fix option 1 — Refactor the module to not use the provider function in unit-testable paths:**
```hcl
# Instead of:
locals {
  arn_parts = provider::aws::arn_parse(aws_lambda_function.app.arn)
  region    = local.arn_parts.region
}

# Accept region as an explicit variable (set to a mock value in the test):
variable "region" {
  type    = string
  default = "ap-south-1"
}
```
This is the cleanest solution — it makes the module more portable and easier to test.

**Fix option 2 — Use `command = plan` with a real provider just for the affected run block:**
```hcl
# mock for everything else in the file...
mock_provider "aws" {}

run "logic_that_needs_provider_function" {
  # Override this specific run to use the real provider
  providers = {
    aws = aws.real
  }
  command = plan
  # This run gets real provider function support
}
```
This is a more surgical fix when refactoring the module isn't feasible.

**Fix option 3 — Use `override_resource` to mock the output of the resource that supplies the ARN:**
```hcl
mock_provider "aws" {
  override_resource {
    target = aws_lambda_function.app
    values = {
      arn = "arn:aws:lambda:ap-south-1:123456789012:function:mock-func"
    }
  }
}
```
If the mock returns a real-looking (but fake) ARN, the provider function can parse it against the real AWS provider. But this only works if you switch the `run` block to use the real provider — the mock provider still can't execute `arn_parse`.

The cleanest architectural fix is option 1: keep provider functions out of module internals that need unit testing.

---

## Q4: "Compare `provider::aws::arn_parse()` to `split(":", arn)`. What are the practical differences? When would you use each?"

### The Trap
Tests whether the candidate can articulate the real trade-offs — not just "provider functions are newer and better."

### What a Senior Engineer Says

**`split(":", arn)` approach:**
```hcl
locals {
  arn_parts  = split(":", "arn:aws:lambda:ap-south-1:123456789012:function:my-func")
  # ["arn", "aws", "lambda", "ap-south-1", "123456789012", "function", "my-func"]
  account_id = local.arn_parts[4]
  region     = local.arn_parts[3]
}
```
- ✅ Works everywhere: variable defaults, module versions, backend config
- ✅ Works with mock providers in tests (it's a built-in function)
- ✅ No provider dependency
- ❌ Positional indices are fragile — `arn_parts[4]` breaks silently if ARN format changes
- ❌ Resource ARNs have varying formats — `arn:aws:s3:::bucket-name` has no region or account (empty segments), making index-based access unreliable without guards

**`provider::aws::arn_parse()` approach:**
- ✅ Named fields: `arn_parts.account_id` is self-documenting and refactor-safe
- ✅ Handles edge cases (S3 ARNs, partition variations) correctly per AWS definition
- ✅ Fails fast with a clear error on malformed ARNs
- ❌ Requires provider initialization (cannot use in backend config, variable defaults)
- ❌ Returns unknown if argument is unknown (propagates through dependent locals)
- ❌ Does not work with mock providers in tests

**When to use each:**
- Use `split` for simple cases where you need exactly one segment and you know the ARN format is stable and simple (e.g., extracting the region from an ARN your own code generates)
- Use `provider::aws::arn_parse()` when parsing ARNs from external data sources, data blocks, or any source where the format might vary — and when the parsing happens in a resource/local/output context where the provider is available
