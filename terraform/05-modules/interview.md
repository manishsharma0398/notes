# Chapter 05 — Modules — Interview Questions

Questions progress from module mechanics → encapsulation traps → composition judgment → provider inheritance. The traps reveal whether you understand modules as contracts, not just as directories.

---

## Q1: "A colleague renames `aws_lambda_function.this` to `aws_lambda_function.fn` inside a module. What happens to all callers?"

**Trap**: Tests understanding of how internal resource names affect state across all callers.

The resource address in state for every caller is `module.<name>.aws_lambda_function.this`. Renaming to `.fn` means:

```
Plan for every caller:
  - module.presign_lambda.aws_lambda_function.this   ← DESTROY (old name gone)
  + module.presign_lambda.aws_lambda_function.fn     ← CREATE  (new name not in state)
```

Every Lambda function is destroyed and recreated: new ARN, broken API Gateway integrations, potential downtime. This is a **breaking change to internal implementation** that propagates externally through state.

**Fix**: add a `moved` block **inside the module** before renaming:

```hcl
# modules/lambda_function/main.tf
moved {
  from = aws_lambda_function.this
  to   = aws_lambda_function.fn
}
```

All callers' next `plan` shows "moved" — no destroys. Callers don't need to change any code.

**What callers see via outputs**: callers access `module.presign_lambda.arn` (an output name). If the output definition is updated to reference `aws_lambda_function.fn.arn`, callers are completely unaffected — they depend on the output name, not the internal address. This is exactly why encapsulation matters.

---

## Q2: "You declare `provider "aws" { region = "us-east-1" }` inside a child module. The root module uses `ap-south-1`. What happens?"

**Trap**: Tests the most common module mistake — provider blocks in child modules.

**You get two separate provider instances.** The root module's `aws` provider uses `ap-south-1`. The child module's `aws` provider uses `us-east-1`. Resources inside the module are created in `us-east-1`; resources in the root are in `ap-south-1`.

Consequences:
- Your Lambda lands in `us-east-1`, but your API Gateway integration is in `ap-south-1`. Cross-region invocations require explicit configuration; the integration fails silently or with a confusing error.
- `terraform plan` shows two provider initializations — a red flag.

**The fix**: never declare `provider` blocks in child modules that are meant to be reusable. Modules **automatically inherit** the caller's providers:

```hcl
# Root module configures the provider once
provider "aws" { region = "ap-south-1" }

# Module inherits it — no provider block needed inside
module "lambda" {
  source = "../modules/lambda_function"
}
```

**When a module genuinely needs a different provider** (e.g., ACM certificate in `us-east-1` for CloudFront), pass it explicitly:

```hcl
# Root module — second provider with alias
provider "aws" {
  alias  = "us_east"
  region = "us-east-1"
}

# Explicitly pass aliased provider to the module
module "cdn_cert" {
  source    = "../modules/acm_cert"
  providers = { aws = aws.us_east }
}
```

Inside `modules/acm_cert/versions.tf`, declare the requirement (no alias needed — the module calls it `aws`):

```hcl
terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.0" }
  }
}
```

---

## Q3: "When should you NOT use a module? Your team wraps every single AWS resource in its own module."

**Trap**: Tests pragmatic judgment — knowing when abstraction hurts.

Modules add indirection and cognitive overhead. They're worth it when encapsulation benefit > complexity cost. Your team's approach is an anti-pattern when:

1. **The module wraps a single resource.** A module for one `aws_s3_bucket` that takes `bucket_name` as input and returns `arn` as output provides zero abstraction. Just use the resource directly. A module earns its existence by collapsing **multiple related resources** into one declarative block.

2. **The module has as many inputs as the resource has arguments.** If `variables.tf` looks like a copy of the resource's argument reference, you're wrapping, not abstracting. The caller still needs to know every detail.

3. **It's used exactly once.** Module value comes from reuse. A single-use module is indirection with no payoff.

4. **The design is still fluid.** Modules lock in a contract (input/output names and types). Changing a required variable is a breaking change for every caller. Extract modules after the pattern stabilises, not during exploration.

**Do extract a module when**: you find yourself duplicating a group of resources (Lambda + IAM permission + API Gateway integration + route) for a second instance. The copy-paste is the signal. The module collapses those 5-6 resources into 10 lines for each new instance.

---

## Q4: "You use `for_each` on a module to create 4 Lambda functions from a map. You remove one entry. What does Terraform plan?"

**Trap**: Tests that module `for_each` follows the same identity rules as resource `for_each`.

Because `for_each` uses **key-based identity**, removing one entry only destroys that specific module instance — and everything inside it:

```hcl
module "lambda" {
  source   = "../modules/lambda_function"
  for_each = var.lambdas   # map: presign, metadata, delete, list
  # ...
}
```

State:
```
module.lambda["presign"]  → aws_lambda_function.this + all internal resources
module.lambda["metadata"] → aws_lambda_function.this + all internal resources
module.lambda["delete"]   → aws_lambda_function.this + all internal resources
module.lambda["list"]     → aws_lambda_function.this + all internal resources
```

Remove `"delete"` from the map:
- `module.lambda["presign"]` → unchanged ✅
- `module.lambda["metadata"]` → unchanged ✅
- `module.lambda["list"]` → unchanged ✅
- `module.lambda["delete"]` → **DESTROY** — every resource the module created internally

**The cascading risk**: any resource outside the module that references `module.lambda["delete"].arn` (e.g., an API Gateway integration) becomes a dangling reference. Terraform plans to update or destroy those referencing resources too. Plan carefully.

**The `for_each` keys-at-plan-time constraint applies to modules too**: if `var.lambdas` is derived from a resource output that is `(known after apply)`, the plan fails. Always derive `for_each` keys for modules from variables or locals.

---

## Q5: "You move an existing Lambda from the root module into a child module. How do you avoid destroy and recreate?"

**Trap**: Tests real-world refactoring — one of the most common operations on a growing codebase.

Without a migration strategy, Terraform sees:
- `aws_lambda_function.presign` disappeared from root → **DESTROY**
- `module.api.aws_lambda_function.presign` appeared → **CREATE**

New ARN, broken API Gateway integration, downtime.

**Solution**: `moved` block:

```hcl
# In the root module — tells Terraform the resource just changed address
moved {
  from = aws_lambda_function.presign
  to   = module.api.aws_lambda_function.presign
}
```

`terraform plan` shows: `aws_lambda_function.presign has moved to module.api.aws_lambda_function.presign` — no destroy, no create.

**Full refactoring checklist:**

1. Write the module (`variables.tf`, `main.tf`, `outputs.tf`)
2. Replace the inline resource block in root with a `module {}` block
3. Add a `moved` block for **every** resource moving addresses
4. `terraform plan` — verify zero creates/destroys, only "moved" messages
5. `terraform apply`
6. Remove `moved` blocks after all environments have applied (harmless to keep)

**Common two-hop case**: if the resource is renamed inside the module at the same time (e.g., root has `aws_lambda_function.presign`, module uses `aws_lambda_function.this`), one `moved` block handles both the namespace change and the rename:

```hcl
moved {
  from = aws_lambda_function.presign               # root address, old name
  to   = module.api.aws_lambda_function.this       # module address, new name
}
```

---

## Q6: "Your team wants to share a Terraform module across 5 services. How do you version it? What breaks when you make a change?"

**Trap**: Tests understanding of module versioning strategy and how to communicate breaking vs non-breaking changes.

**The versioning strategy**: treat the shared module like a software library. Release tagged versions in a Git repository:

```hcl
# Each service pins to a specific tag
module "lambda" {
  source = "git::https://github.com/your-org/terraform-modules.git//modules/lambda_function?ref=v2.1.0"
}
```

A tag (not a branch) makes the source deterministic. `?ref=main` means every `terraform init` can get a different version.

**What constitutes a breaking change:**

| Change | Breaking? | Why |
|---|---|---|
| Adding an **optional** variable with a default | No | Existing callers omit it — they get the default |
| Adding a **required** variable (no default) | **Yes** | All callers must add it or plan fails |
| Removing or renaming an **output** | **Yes** | All callers referencing that output get a compile error |
| Renaming an **internal resource** without `moved` | **Yes** | All callers get destroy+create in their next plan |
| Changing an output's type | **Yes** | Callers may pass it to a resource expecting a different type |
| Adding a new resource inside the module | No | Adds to callers' plans (`+`) but doesn't break anything |

**Versioning discipline:**
- Bump major version (v1 → v2) for breaking changes
- Bump minor version (v1.1 → v1.2) for new optional features
- Provide a migration guide in the release notes for major bumps
- Never force-push a tag — it silently changes what existing callers receive on their next `terraform init`
