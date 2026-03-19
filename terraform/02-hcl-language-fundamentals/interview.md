# Chapter 02 — HCL Language Fundamentals — Interview Questions

---

## Q1: "You have a list of 3 API routes. You use `count` to create a resource per route. Then you remove the first route. What happens?"

### The Trap
Tests understanding of `count` vs `for_each` identity.

### What a Senior Engineer Says

With `count`, resources are identified by **index**:

```hcl
variable "routes" { default = ["/upload", "/metadata", "/delete"] }

resource "aws_api_gateway_resource" "route" {
  count    = length(var.routes)
  path_part = var.routes[count.index]
}
# Creates: route[0]="/upload", route[1]="/metadata", route[2]="/delete"
```

If I remove `"/upload"` from the list:

```hcl
variable "routes" { default = ["/metadata", "/delete"] }
```

Terraform sees:
- `route[0]` was `"/upload"`, now should be `"/metadata"` → **update** (or replace if ForceNew)
- `route[1]` was `"/metadata"`, now should be `"/delete"` → **update**
- `route[2]` existed, now gone → **destroy**

I wanted to remove only `/upload`, but Terraform will replace `/metadata`, change `/delete`, and destroy what was `/delete`. This is a cascading re-index problem.

**The fix**: Use `for_each = toset(var.routes)`. With `for_each`, resources are identified by key (`route["/upload"]`). Removing `/upload` only destroys that one resource.

**Rule**: `count` is safe only for boolean on/off (`count = condition ? 1 : 0`). For lists, always use `for_each`.

---

## Q2: "You write `for_each = toset(some_list)` but the list contains values that are `(known after apply)`. What happens?"

### The Trap
Tests understanding of a critical `for_each` limitation.

### What a Senior Engineer Says

**It fails during `terraform plan` with an error:**

```
Error: Invalid for_each argument
The "for_each" value depends on resource attributes that cannot be determined
until apply, so Terraform cannot predict how many instances will be created.
```

`for_each` keys must be **known at plan time** because Terraform needs them to build the resource graph — it needs to know exactly which vertices exist before walking the graph.

Example that breaks:

```hcl
resource "aws_api_gateway_rest_api" "api" { ... }

resource "aws_api_gateway_resource" "route" {
  for_each  = toset(aws_api_gateway_rest_api.api.endpoint_configuration[*].types)
  # ↑ endpoint types aren't known until the API is created
}
```

**Workaround**: Restructure so the `for_each` keys come from static sources (variables, locals) rather than computed resource attributes. Or split into two `apply` runs using `-target`.

---

## Q3: "What is the difference between `variable`, `local`, and a hardcoded value? When is each correct and when does each create operational risk?"

### The Trap
Tests whether you can reason about config maintainability, not just syntax.

### What a Senior Engineer Says

**Variable** — value comes from outside, differs per environment:
```hcl
variable "stage" { type = string }
```
- **Correct for**: stage, region, bucket names, feature flags
- **Risk**: Too many variables → config surface area explodes. Each variable is a knob someone can misconfigure. A variable for `lambda_runtime = "python3.12"` invites someone to change it to an invalid value.

**Local** — derived value, computed from other values:
```hcl
locals { prefix = "${var.project_name}-${var.stage}" }
```
- **Correct for**: naming conventions, common tags, computed ARNs, conditional logic
- **Risk**: Deeply nested locals that reference each other create readability problems. Hard to trace `local.foo` → `local.bar` → `local.baz` → actual value.

**Hardcoded value** — literal inline:
```hcl
runtime = "python3.12"
```
- **Correct for**: values that are truly fixed and obvious
- **Risk**: Duplicated across resources. If you hardcode `"python3.12"` in 5 Lambda resources and need to change it, you update 5 places.

**The principle**: Use variables for external inputs, locals for internal derivations, and hardcoded values only if they appear exactly once and are self-documenting.

---

## Q4: "Your colleague writes an IAM policy as an inline string with `heredoc`. You rewrite it using `jsonencode`. They say both produce the same result. Are they right?"

### The Trap
Tests understanding of `jsonencode` safety vs raw strings.

### What a Senior Engineer Says

They are **functionally similar** but **operationally different**:

```hcl
# Colleague's version — heredoc string
policy = <<-EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "s3:PutObject",
    "Resource": "arn:aws:s3:::${var.bucket}/*"
  }]
}
EOF

# My version — jsonencode
policy = jsonencode({
  Version = "2012-10-17"
  Statement = [{
    Effect   = "Allow"
    Action   = "s3:PutObject"
    Resource = "arn:aws:s3:::${var.bucket}/*"
  }]
})
```

**Why `jsonencode` is better:**

1. **Type safety**: `jsonencode` produces valid JSON guaranteed. The heredoc version can have syntax errors (missing comma, wrong bracket) that Terraform won't catch until the AWS API rejects the policy.

2. **Interpolation safety**: In the heredoc, `${var.bucket}` is string interpolation inside a JSON string. If `var.bucket` contains special characters (quotes, backslashes), the JSON becomes invalid. `jsonencode` handles escaping automatically.

3. **Diffing**: `jsonencode` input is HCL — Terraform can show precise attribute-level diffs in `plan`. The heredoc is one big string — Terraform shows the entire string as changed even if one character differs.

4. **IDE support**: HCL inside `jsonencode` gets syntax highlighting and autocomplete. A heredoc JSON string does not.

**When heredoc is acceptable**: When reading a pre-existing JSON policy file with `file()` — e.g., `policy = file("${path.module}/policies/s3.json")`. This keeps the policy in a separate, validatable JSON file.

---

## Q5: "The ternary expression `condition ? true_val : false_val` looks simple. What behavior surprises engineers coming from other languages?"

### The Trap
Tests understanding of HCL's eager type-checking.

### What a Senior Engineer Says

Two surprises:

**1. Both sides are type-checked, even if one is never used:**

```hcl
variable "stage" { default = "stg" }
variable "prod_secret" {}  # required, no default

output "secret" {
  value = var.stage == "prod" ? var.prod_secret : "not-applicable"
}
```

Even when `stage = "stg"`, Terraform **errors** because `var.prod_secret` has no value. Both branches must be valid expressions regardless of which branch is selected.

**2. Both sides must return the same type:**

```hcl
output "result" {
  value = var.enabled ? aws_lambda_function.fn[0].arn : null
}
```

This works because `null` is compatible with any type. But:

```hcl
output "result" {
  value = var.enabled ? 42 : "none"
}
# ERROR: Inconsistent conditional result types — number vs string.
```

You must ensure both branches return the same type.

**Workaround for the first issue**: Use `try()` or guard with `count`:

```hcl
# Option 1: Use try with a fallback
output "secret" {
  value = var.stage == "prod" ? try(var.prod_secret, "") : "not-applicable"
}

# Option 2: Make the variable optional with a default
variable "prod_secret" {
  type    = string
  default = ""
}
```
