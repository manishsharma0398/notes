# Chapter 05 — Modules — Interview Questions

---

## Q1: "You have a module that creates a Lambda function. A colleague wants to change the internal resource name from `aws_lambda_function.this` to `aws_lambda_function.main`. What happens?"

### The Trap
Tests understanding of how module internals affect state and callers.

### What a Senior Engineer Says

Two concerns: **state** and **callers**.

**State**: The resource address in state is `module.presign_lambda.aws_lambda_function.this`. Renaming to `.main` means Terraform sees:
- `module.presign_lambda.aws_lambda_function.this` → DESTROY (old name gone from config)
- `module.presign_lambda.aws_lambda_function.main` → CREATE (new name not in state)

The Lambda is destroyed and recreated. New ARN, broken integrations, potential downtime.

**Fix**: Add a `moved` block inside the module:
```hcl
moved {
  from = aws_lambda_function.this
  to   = aws_lambda_function.main
}
```

**Callers**: If callers access outputs (e.g., `module.presign_lambda.arn`), and the output definition is updated to reference `aws_lambda_function.main.arn`, callers are unaffected — they reference the output name, not the internal resource.

If callers were incorrectly reaching into internals (`module.presign_lambda.aws_lambda_function.this.arn`), they'd break. But Terraform doesn't allow this syntax — it's a compile error. This is why encapsulation matters.

---

## Q2: "Your module declares `provider 'aws' { region = 'us-east-1' }` inside it. The root module uses `ap-south-1`. What happens?"

### The Trap
Tests understanding of provider inheritance and the most common module mistake.

### What a Senior Engineer Says

**You get two provider instances.** The root module creates an `aws` provider in `ap-south-1`. The child module creates a **separate** `aws` provider in `us-east-1`.

Resources inside the module use the module's provider → they're created in `us-east-1`. Resources in the root use the root's provider → they're in `ap-south-1`.

If the module's Lambda is in `us-east-1` and the root's API Gateway integration references that Lambda, the integration might fail (cross-region invocation requires explicit configuration).

**The fix**: _Never_ declare a `provider` block inside a child module. Modules should inherit the provider from their caller:

```hcl
# Root module configures the provider
provider "aws" { region = "ap-south-1" }

# Module inherits it automatically
module "lambda" {
  source = "../modules/lambda_function"
  # No provider config needed — inherits from root
}
```

If a module truly needs a _different_ provider (multi-region), pass it explicitly:

```hcl
provider "aws" {
  alias  = "us_east"
  region = "us-east-1"
}

module "cdn_cert" {
  source = "../modules/acm_cert"
  providers = {
    aws = aws.us_east    # ← explicitly pass the aliased provider
  }
}
```

---

## Q3: "When should you NOT use a module? Your team has started wrapping every single resource in its own module."

### The Trap
Tests pragmatic judgment — not just "modules are good."

### What a Senior Engineer Says

Wrapping every resource in a module is an anti-pattern. Modules add **indirection and cognitive overhead**. They're only worth it when the encapsulation benefit exceeds the complexity cost.

**Don't use a module when:**

1. **It wraps a single resource.** A module for one `aws_s3_bucket` that exposes the bucket name as input and ARN as output adds a layer of indirection that provides zero abstraction. Just use the resource directly.

2. **It has more inputs than the resource has attributes.** If your module's `variables.tf` looks like a copy of the resource's argument reference, you're not abstracting — you're wrapping. The caller still needs to know every detail.

3. **You're still iterating on the design.** Modules lock in a contract (inputs + outputs). Changing a module's interface affects every caller. If you're still experimenting, keep resources flat and extract later.

4. **The module is used exactly once.** A module's value comes from reuse. A single-use module adds indirection without benefit.

**Do use a module when:**

1. **It encapsulates a pattern of multiple related resources.** A "Lambda API Route" module that creates the Lambda + API GW resource + method + integration + permission? That's 5 resources collapsed into one declarative block. That's valuable.

2. **You find yourself copy-pasting the same resource group.** The second time you duplicate is when you extract.

3. **Different teams need the same infrastructure pattern.** A shared module repo with versioned releases ensures consistency across teams.

---

## Q4: "You use `for_each` on a module to create 5 Lambda functions from a map. You remove one entry from the map. What happens?"

### The Trap
Tests understanding that module `for_each` follows the same identity rules as resource `for_each` (Chapter 02).

### What a Senior Engineer Says

Because `for_each` uses **key-based identity**, removing one entry only destroys that specific module instance.

```hcl
module "lambda" {
  source   = "../modules/lambda_function"
  for_each = var.lambdas     # map keyed by function name

  function_name = "${local.prefix}-${each.key}"
  # ...
}
```

State contains:
- `module.lambda["presign"]` → presign Lambda + all internal resources
- `module.lambda["metadata"]` → metadata Lambda
- `module.lambda["delete"]` → delete Lambda

If I remove `"delete"` from the map:
- `module.lambda["presign"]` → unchanged ✅
- `module.lambda["metadata"]` → unchanged ✅
- `module.lambda["delete"]` → **destroyed** (all resources inside the module instance)

Terraform destroys **everything inside** `module.lambda["delete"]` — the Lambda function, any permissions, any associated resources that the module creates internally.

**The risk**: If other resources outside the module reference `module.lambda["delete"].arn` (e.g., an API Gateway integration), those references become invalid. Terraform will show those referencing resources need to be updated or destroyed too.

---

## Q5: "You move an existing `aws_lambda_function` from the root module into a child module. How do you avoid destroy and recreate?"

### The Trap
Tests real-world refactoring workflow — critical skill for growing projects.

### What a Senior Engineer Says

Without any migration strategy, Terraform sees:
- `aws_lambda_function.presign` disappeared from root → **DESTROY**
- `module.api.aws_lambda_function.presign` appeared → **CREATE**

The Lambda is destroyed and recreated. New ARN, broken references, downtime.

**Solution**: Use a `moved` block:

```hcl
# In the root module (or wherever the resource was originally):
moved {
  from = aws_lambda_function.presign
  to   = module.api.aws_lambda_function.presign
}
```

On the next `plan`, Terraform shows: "has moved to `module.api.aws_lambda_function.presign`" — no destroy, no create, just a state address update.

**Checklist for refactoring into modules:**

1. Write the module code (variables, resources, outputs)
2. Replace the inline resources in root with a `module` block
3. Add `moved` blocks for EVERY resource that's moving
4. Run `terraform plan` — should show only "moved" and zero creates/destroys
5. Apply
6. The `moved` blocks can be removed after all environments have applied (but are harmless to keep)

**Common gotcha**: If the module renames internal resources (e.g., `aws_lambda_function.presign` inside the module becomes `aws_lambda_function.this`), you need a two-hop move:

```hcl
moved {
  from = aws_lambda_function.presign
  to   = module.api.aws_lambda_function.this    # root → module with new name
}
```
