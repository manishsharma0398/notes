# Chapter 10 — Provider-Defined Functions (v1.8)

## Mental Model

**Problem this solves:** HCL's built-in functions (`split`, `regex`, `substr`) are generic string/collection tools. They have no knowledge of cloud-specific formats — parsing an ARN, trimming an IAM role path, validating an AWS region name. Before v1.8, the only option was a chain of clunky `split`, `regex`, and `replace` calls that were fragile and hard to read.

Provider-defined functions are functions implemented inside the **provider binary** and exposed to HCL just like built-in functions — but with awareness of the provider's own data formats and schemas.

```
  Built-in functions:       provider::aws::arn_parse()
  ──────────────────        ───────────────────────────
  tonumber(), split()       Lives in provider binary
  merge(), flatten()        Knows AWS ARN format
  cidrsubnet()              Returns structured object
  Implemented in Go         Called over gRPC, same as
  inside Terraform core     resource operations
```

---

## Topic 1 — Calling Syntax

```hcl
# General form
provider::<provider_name>::<function_name>(<arguments>)

# AWS examples
locals {
  # Parse an ARN into its components
  lambda_arn_parts = provider::aws::arn_parse(aws_lambda_function.app.arn)
  # Returns: { partition, service, region, account_id, resource }

  # Strip the path prefix from an IAM role ARN path
  # e.g., "/aws-reserved/sso.amazonaws.com/" → ""
  clean_role_name = provider::aws::trim_iam_role_path(aws_iam_role.app.arn)
}

output "lambda_region" {
  value = local.lambda_arn_parts.region
}
```

The `provider::` prefix is the namespace — it makes it immediately clear the function is not a built-in and comes from a specific provider, preventing name collisions.

---

## Topic 2 — Mechanism: How the Call Actually Works

### The Provider Protocol

From the Terraform source (`providers/functions.go`), provider functions go through the same RPC channel as resource operations. `BuildFunction` wraps a `FunctionDecl` into a cty `function.Function`:

```go
// When HCL evaluates provider::aws::arn_parse("arn:..."):
// 1. Terraform gets (or reuses) the running provider plugin process
provider, err := factory()

// 2. Sends a CallFunction RPC to the provider
resp := provider.CallFunction(CallFunctionRequest{
    FunctionName: name,      // "arn_parse"
    Arguments:    args,      // [cty.StringVal("arn:aws:lambda:...")]
})

// 3. Returns the result to HCL's evaluation context
return resp.Result, nil
```

The provider must already be initialized (plugin process running) for the function to be available. This means:
- The provider is declared in `required_providers`
- `terraform init` has downloaded and started the provider binary

### Unknown Value Handling (Source: `functions.go`)

```go
// If a parameter does not declare AllowUnknownValues, Terraform short-circuits
// the function call when any argument is unknown:
if !param.AllowUnknown {
    if !arg.IsWhollyKnown() {
        return cty.UnknownVal(retType), nil
    }
}
```

This means: if you pass an unknown value (e.g., the ARN of a resource that hasn't been created yet) to a provider function, Terraform returns `unknown` for the result — it does **not** call the provider. The plan will show the output as `(known after apply)`. This is correct behaviour — the function can only be evaluated once the argument is known.

**Implication:** provider functions can be used in plans, but their results will be `(known after apply)` if their inputs are. This is the same behaviour as attribute references on unresolved resources.

---

## Topic 3 — AWS Provider Examples

```hcl
# Example 1: arn_parse — structured ARN decomposition
# Replaces: split(":", var.arn)[4]  (fragile, index-dependent)
locals {
  arn = "arn:aws:lambda:ap-south-1:123456789012:function:my-func"

  parts = provider::aws::arn_parse(local.arn)
  # parts = {
  #   partition  = "aws"
  #   service    = "lambda"
  #   region     = "ap-south-1"
  #   account_id = "123456789012"
  #   resource   = "function:my-func"
  # }
}

# Example 2: trim_iam_role_path
# AWS SSO creates roles with paths like /aws-reserved/sso.amazonaws.com/
# Some AWS services reject role ARNs with non-default paths.
# This function strips the path, returning just the role name.
locals {
  sso_role_arn  = "arn:aws:iam::123456789012:role/aws-reserved/sso.amazonaws.com/AWSReservedSSO_AdministratorAccess_abc123"
  clean_role    = provider::aws::trim_iam_role_path(local.sso_role_arn)
  # → "arn:aws:iam::123456789012:role/AWSReservedSSO_AdministratorAccess_abc123"
}

# Example 3: Using arn_parse to construct cross-region references
data "aws_lambda_function" "existing" {
  function_name = "my-shared-function"
}

locals {
  fn_parts = provider::aws::arn_parse(data.aws_lambda_function.existing.arn)
  # Build a permission ARN for a specific alias/qualifier without hardcoding account or region
  function_url = "https://${local.fn_parts.region}.lambda.aws.amazon.com/2015-03-31/functions/${data.aws_lambda_function.existing.function_name}/invocations"
}
```

---

## Topic 4 — When Provider Functions Replace Awkward Chains

**Before v1.8 — fragile index-based ARN parsing:**
```hcl
locals {
  arn        = aws_lambda_function.app.arn
  # "arn:aws:lambda:ap-south-1:123456789012:function:my-func"
  arn_parts  = split(":", local.arn)
  account_id = local.arn_parts[4]   # Works, but breaks if ARN format changes
  region     = local.arn_parts[3]
  service    = local.arn_parts[2]
}
```

**After v1.8 — structured, provider-aware parsing:**
```hcl
locals {
  arn_parts  = provider::aws::arn_parse(aws_lambda_function.app.arn)
  account_id = local.arn_parts.account_id   # Named field, robust to format changes
  region     = local.arn_parts.region
}
```

The provider-defined version:
- Uses named fields instead of positional indices
- Will error with a clear message if the ARN is malformed, instead of returning a silently wrong index
- Is versioned with the provider — breaking ARN format changes would be a provider breaking change

---

## Topic 5 — Limitations

| Limitation | Why |
|---|---|
| Provider must be initialized | Functions are served by the running provider binary via gRPC. No `terraform init` → no functions. |
| Cannot be used in `backend {}` config | The backend block is evaluated before providers are initialized. |
| Cannot be used in `variable {}` `default` | Variable defaults are evaluated before provider initialization. |
| Cannot be used in `required_providers` `version` | Same — evaluated at init time before the provider process is running. |
| Results are `unknown` if arguments are unknown | Terraform short-circuits function evaluation when inputs aren't known yet (plan time). |
| Mock providers do NOT execute provider functions | `terraform test` with `mock_provider` will not call the real function implementation. Use the real provider for tests that rely on provider functions. |

---

## Source References

- [Provider Functions docs](https://developer.hashicorp.com/terraform/plugin/framework/functions)
- [AWS provider functions](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/guides/custom-service-endpoints#provider-functions)
- Source: `internal/providers/functions.go` — `FunctionDecl`, `BuildFunction`, `CallFunction` RPC, unknown-value short-circuit
