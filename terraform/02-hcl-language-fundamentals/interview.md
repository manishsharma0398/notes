# Chapter 02 — HCL Language Fundamentals — Interview Questions

Questions progress from foundational gotchas to nuanced design tradeoffs. Skim the traps first — they reveal what interviewers are actually testing.

---

## Q1: "You have a list of 3 API routes. You use `count` to create a resource per route. Then you remove the first route. What happens and why?"

**Trap**: Tests understanding of index-based vs key-based identity.

With `count`, resources are addressed by **index position**:

```hcl
variable "routes" { default = ["/upload", "/metadata", "/delete"] }

resource "terraform_data" "route" {
  count = length(var.routes)
  input = var.routes[count.index]
}
# route[0] = "/upload", route[1] = "/metadata", route[2] = "/delete"
```

Remove `"/upload"`:

```hcl
variable "routes" { default = ["/metadata", "/delete"] }
```

Terraform sees:
- `route[0]`: was `"/upload"`, now `"/metadata"` → **replace**
- `route[1]`: was `"/metadata"`, now `"/delete"` → **update**
- `route[2]`: was `"/delete"`, now gone → **destroy**

I wanted to remove one resource. Terraform replaces two and destroys one.

**Fix**: `for_each = toset(var.routes)`. Resources become `route["/upload"]`, `route["/metadata"]`, `route["/delete"]`. Remove `"/upload"` → only `route["/upload"]` is destroyed. Key-based identity is stable across list changes.

**Rule**: `count` is safe only for boolean on/off (`count = cond ? 1 : 0`). Everything else uses `for_each`.

---

## Q2: "You write `for_each = toset(some_list)` where the list is derived from a resource output. What happens?"

**Trap**: Tests knowledge of the `for_each` keys-at-plan-time constraint — one of the most common plan-time errors in real codebases.

The plan fails:

```
Error: Invalid for_each argument
The "for_each" value depends on resource attributes that cannot be
determined until apply, so Terraform cannot predict how many instances
will be created. To work around this, use the -target argument to first
apply only the resources that the for_each depends on.
```

`for_each` keys must be **known at plan time** because Terraform needs to construct the dependency graph before it can walk it. If the keys are `(known after apply)`, the graph cannot be built.

```hcl
# BREAKS: API IDs are unknown until the API is created
resource "aws_api_gateway_resource" "route" {
  for_each = toset(aws_api_gateway_rest_api.api.endpoint_configuration[*].types)
}
```

**Fix**: always derive `for_each` keys from `variable`, `local`, or other statically known sources — not from computed resource attributes.

The same constraint applies to `for_each` inside `dynamic` blocks.

---

## Q3: "What is the difference between `variable`, `local`, and a hardcoded value? When does each create operational risk?"

**Trap**: Tests whether you can reason about config maintainability — not just syntax.

**Variable** — value comes from outside the config (tfvars, CLI, env var):
- Correct for: stage, region, bucket names, feature flags — anything that differs per environment or caller
- **Risk**: Too many variables → config surface area explodes. Every variable is a knob that can be misconfigured. A `variable "lambda_runtime"` invites someone to set it to `"nodejs16.x"` on a Python function.

**Local** — derived internally from variables, other locals, or resource attributes:
- Correct for: naming conventions, computed ARNs, shared tags, conditional logic (`is_prod`)
- **Risk**: Deeply chained locals become unreadable. Tracing `local.foo → local.bar → local.baz → actual value` across three files is debugging overhead.

**Hardcoded** — literal inline value:
- Correct for: values that are genuinely fixed and appear exactly once
- **Risk**: If `"python3.12"` is hardcoded in 5 Lambda resources, a runtime upgrade requires 5 edits — one missed.

**The principle**: variables for external input, locals for internal derivation, hardcoded only when it appears exactly once and is self-documenting. A variable that nobody should ever change should be a local.

---

## Q4: "Your colleague writes an IAM policy with a heredoc string. You rewrite it with `jsonencode`. They say it's the same result. Are they right?"

**Trap**: Tests understanding of `jsonencode` safety properties vs raw strings.

Functionally equivalent output. Operationally different:

```hcl
# Heredoc
policy = <<-EOF
{
  "Version": "2012-10-17",
  "Statement": [{"Effect": "Allow", "Action": "s3:PutObject",
    "Resource": "arn:aws:s3:::${var.bucket}/*"}]
}
EOF

# jsonencode
policy = jsonencode({
  Version = "2012-10-17"
  Statement = [{ Effect = "Allow", Action = "s3:PutObject",
    Resource = "arn:aws:s3:::${var.bucket}/*" }]
})
```

**Why `jsonencode` wins:**

1. **Type safety**: `jsonencode` produces valid JSON by construction. Heredoc syntax errors (missing comma, wrong bracket) won't be caught until the AWS API rejects the policy at apply time.

2. **Escaping**: If `var.bucket` contains quotes or backslashes, `jsonencode` escapes them correctly. In a heredoc, the interpolation injects the raw string into JSON — potential injection.

3. **Plan diffs**: `jsonencode` input is HCL — Terraform shows attribute-level changes. A heredoc is one big string — any change shows the entire string as modified.

4. **IDE support**: HCL inside `jsonencode` gets syntax highlighting. A JSON heredoc does not.

**When `templatefile` is acceptable**: reading a pre-existing JSON policy maintained by a security team in a `.tpl` file. The policy is not written in HCL, so `jsonencode` doesn't apply.

---

## Q5: "The ternary expression looks simple. What behavior surprises engineers coming from other languages?"

**Trap**: Tests HCL's eager type-checking model, which differs from most languages.

Two surprises:

**1. Both branches are type-checked regardless of which is selected:**

```hcl
variable "prod_secret" {}  # required, no default

output "secret" {
  value = var.stage == "prod" ? var.prod_secret : "not-applicable"
}
# When stage = "stg", Terraform still ERRORS because var.prod_secret has no value.
# Both expressions are evaluated for type-checking even though only one result is used.
```

Fix: give the variable a default, or wrap with `try()`:
```hcl
value = var.stage == "prod" ? try(var.prod_secret, "") : "not-applicable"
```

**2. Both branches must return the same type:**

```hcl
value = var.enabled ? 42 : "none"     # ERROR: number vs string
value = var.enabled ? 42 : null       # OK: null is type-compatible with any type
```

---

## Q6: "Your team uses `dynamic` blocks for every nested block in a codebase. When is this good practice and when does it become a liability?"

**Trap**: Tests whether you know when abstraction hurts more than it helps.

`dynamic` is the right tool when 3+ identical-shaped nested blocks are variable:

```hcl
dynamic "ingress" {
  for_each = var.ingress_rules
  iterator = rule
  content {
    from_port   = rule.value.port
    to_port     = rule.value.port
    protocol    = rule.value.protocol
    cidr_blocks = rule.value.cidrs
  }
}
```

**When it becomes a liability:**

1. **Readability**: A reviewer must mentally expand the `dynamic` block to understand what rules exist. Explicit blocks self-document. With 2 ingress rules, two explicit blocks are clearer than a `dynamic`.

2. **Structural divergence**: If some rules need `cidr_blocks` and others need `prefix_list_ids`, one `dynamic` block forces an object type with nullable fields on every iteration — more complex and error-prone than two explicit blocks.

3. **The plan-time keys constraint**: `for_each` inside a `dynamic` block cannot use values that are `(known after apply)`. This can force awkward restructuring.

4. **Myth it dispels**: `dynamic` does not generate `resource {}` blocks. It only generates *nested blocks* inside a resource. For multiple resource instances, use `for_each` on the `resource` itself.

**Rule**: 3+ identical-shaped blocks driven by a variable → `dynamic`. Fewer, or structurally divergent → explicit blocks.

---

## Q7: "You inherit a codebase full of `null_resource`. Should you migrate to `terraform_data`? What are the semantic differences?"

**Trap**: Tests v1.4+ awareness and the ability to articulate migration tradeoffs — including what *not* to migrate.

**The actual differences:**

| | `null_resource` | `terraform_data` |
|---|---|---|
| Provider | `hashicorp/null` in `required_providers` | Built into Terraform Core — none needed |
| Trigger mechanism | `triggers = { key = string }` — string map only | `triggers_replace = [any_expressions]` — any type |
| Value storage | None | `input` → stored in state → exposed via `output` |
| Available since | Very old | v1.4+ |

The replacement semantic is identical: when `triggers` / `triggers_replace` changes between runs, the resource is **destroyed and recreated**, causing any `provisioner` blocks to re-execute.

**Migration:**

```hcl
# Before
resource "null_resource" "trigger" {
  triggers = { hash = filebase64sha256("script.sh") }
  provisioner "local-exec" { command = "bash script.sh" }
}

# After — remove hashicorp/null from required_providers
resource "terraform_data" "trigger" {
  triggers_replace = [filebase64sha256("script.sh")]
  provisioner "local-exec" { command = "bash script.sh" }
}
```

Preserve existing state without re-creating the resource:
```bash
terraform state mv null_resource.trigger terraform_data.trigger
```

**The confusing part — `terraform_data` ≠ ephemeral resources:**
- `terraform_data`: values **are** written to state, persist between runs. Use for trigger logic and storing computed metadata.
- Ephemeral resources (v1.10): **never** written to state, re-evaluated every cycle. Use for short-lived secrets and tokens.

**Should you always migrate?** Not urgently — `null_resource` works fine. Migrate when adding new instances (prefer `terraform_data` for new code) or when you need the `input`/`output` value storage that `null_resource` lacks.
