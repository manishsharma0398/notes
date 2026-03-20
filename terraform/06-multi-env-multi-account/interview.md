# Chapter 06 — Multi-Environment and Multi-Account — Interview Questions

Questions progress from approach tradeoffs → workspace mechanics → backend internals → multi-account security → cross-stack design. The traps reveal whether you have real operational experience choosing and operating multi-env architectures.

---

## Q1: "Why would you choose directory-per-environment over workspaces? Isn't DRY better?"

**Trap**: Tests whether you can weigh DRY against operational safety — and whether you know both approaches' real failure modes.

DRY is valuable, but workspaces sacrifice **blast radius isolation** in three ways:

1. **Wrong-workspace risk**: `terraform workspace select prod && terraform destroy` is one command mistake away. `cd environments/prod && terraform destroy` requires a physical directory navigation — harder to accidentally combine with a destructive command. Physical structure slows you down at exactly the right moment.

2. **Conditional config rot**: Real environments diverge. Prod needs WAF, CloudWatch alarms, larger instances, and different IAM policies. With workspaces, each divergence becomes `count = terraform.workspace == "prod" ? 1 : 0`. After 10 such conditionals, the config is unreadable, untestable, and every `plan` output is cluttered with "0 to add" noise.

3. **No access isolation**: Both workspaces share the same backend credentials. `terraform workspace select prod` doesn't require prod permissions — just the bucket credentials. Directory-per-env can wire each directory to a different `assume_role` ARN targeting a different AWS account. Developer laptops can never touch prod.

The ~50 lines of duplication per environment (root module calls + values) is cheap insurance. The module code (hundreds of lines) is still shared.

**The practical decision**: use workspaces while you're single-account and environments are nearly identical. Switch to directory-per-env when environments diverge significantly or you need multi-account access control.

---

## Q2: "What is the `default` workspace in Terraform, and why is it operationally dangerous?"

**Trap**: Tests knowledge of a workspace gotcha that trips up even experienced engineers.

Every Terraform installation starts in the `default` workspace. If anyone on the team runs `terraform plan` or `terraform apply` without explicitly selecting a workspace, they interact with `default` — a completely separate state from `stg` and `prod`.

**What goes wrong:**
- Resources applied in `default` are untracked by your pipeline. They exist in AWS but your CI/CD never manages them.
- If someone `apply`s in `default` accidentally, Terraform creates duplicate resources (since `default` state doesn't know about `stg` state). These orphaned resources consume cost and remain unmanaged.
- A `terraform destroy` in `default` shows "nothing to destroy" (it's empty) — giving false confidence while the real stg/prod resources are untouched.

**Guards:**

```hcl
# Guard 1: fail fast in locals
locals {
  _workspace_guard = (
    contains(["stg", "prod"], terraform.workspace)
    ? null
    : tobool("ERROR: Invalid workspace '${terraform.workspace}'. Use 'stg' or 'prod'.")
  )
}
```

```bash
# Guard 2: CI/CD always selects explicitly
terraform workspace select stg
terraform plan -out=stg.tfplan
# Never allow a job to run without workspace selection
```

The `env_config` map also acts as an implicit guard — `local.env_config[terraform.workspace]` will throw a key error if the workspace isn't in the map, failing fast before any changes occur.

---

## Q3: "You write `backend 's3' { bucket = var.state_bucket }` and get an error. Why? How do you work around it?"

**Trap**: Tests understanding of Terraform's initialization order — one of the most frequently hit surprises.

The `backend` block **cannot use variables, locals, or any expressions**. Only literal string values. The error is: `Variables may not be used here`.

**Why**: Terraform's evaluation order is:

```
terraform init  → reads backend block (literals only) → connects to S3 → loads state
terraform plan  → loads state → evaluates var.x, local.y, data sources → builds graph
```

The backend must be resolved during `init` because Terraform needs the state location before it can evaluate anything. Variables and locals require expression evaluation, which happens during `plan` — after the backend is already connected. It's a fundamental chicken-and-egg: you need state to evaluate, but you need to evaluate to know where state is.

**Workarounds:**

**A) CLI flags** — cleanest for CI/CD scripts where the environment is known at runtime:
```bash
terraform init \
  -backend-config="bucket=prasaarit-terraform-state" \
  -backend-config="key=upload-service/stg/terraform.tfstate" \
  -backend-config="region=ap-south-1"
```

**B) Backend config file** — keeps credentials out of the main `.tf` files:
```bash
# environments/stg/backend.hcl
bucket       = "prasaarit-terraform-state"
key          = "upload-service/stg/terraform.tfstate"
region       = "ap-south-1"
use_lockfile = true
```
```bash
terraform init -backend-config=environments/stg/backend.hcl
```

**C) Hardcode per directory** — with directory-per-env, each environment has its own `backend.tf` with hardcoded values. The 6-line duplication is readable, diff-able, and not worth abstracting.

---

## Q4: "Your CI/CD deploys to both staging and production. How do you secure the production deployment?"

**Trap**: Tests understanding of assume-role, least-privilege, and access isolation across environments.

**Staging:**
- CI/CD runner uses an IAM role (or OIDC federation) with staging-scoped permissions.
- Deploys automatically after PR merge. No manual gate.
- State readable by the dev team for fast debugging.

**Production:**
- CI/CD runner's base role has **no direct access** to production resources.
- The pipeline assumes a deployment role in the production account via `sts:AssumeRole`:

```hcl
provider "aws" {
  assume_role {
    role_arn     = "arn:aws:iam::PROD_ACCOUNT_ID:role/UploadServiceDeployRole"
    session_name = "terraform-prod-deploy"
    external_id  = "prasaarit-terraform"   # prevents confused deputy attack
  }
}
```

- The role's trust policy restricts who can assume it:

```json
{
  "Effect": "Allow",
  "Principal": { "AWS": "arn:aws:iam::SHARED_ACCT:role/GitHubActionsRole" },
  "Action": "sts:AssumeRole",
  "Condition": { "StringEquals": { "sts:ExternalId": "prasaarit-terraform" } }
}
```

- `external_id` prevents confused deputy: a third party cannot trick the CI/CD runner into assuming the role on their behalf.
- A **manual approval gate** sits between `plan` and `apply` (GitHub Environment protection rules, or an explicit `when: manual` in GitLab CI).
- The plan output is published as a PR comment so reviewers see exactly what will change before approving.
- Developer laptops can never assume the prod role — only the CI/CD pipeline's IAM identity is in the trust policy.

---

## Q5: "Team A changes an output name in their Terraform stack. Team B reads it via `terraform_remote_state`. How does the failure manifest? How do you prevent it?"

**Trap**: Tests understanding of cross-stack contract fragility — `terraform_remote_state` has no compile-time enforcement.

**How it fails:**

Team A renames `output "upload_bucket_name"` to `output "bucket_name"` and applies. Team B runs `terraform plan` later:

```
Error: Unsupported attribute
  data.terraform_remote_state.core.outputs.upload_bucket_name
  This object does not have an attribute named "upload_bucket_name".
```

It's a **runtime error discovered at plan time** — not a compile error, not a code review warning. Team B's pipeline breaks silently until someone runs a plan, which could be days after Team A's change went live.

**Prevention strategies:**

1. **Output stability policy**: treat state outputs depended on by other stacks as a public API. Adding new outputs is safe. Renaming or removing is a breaking change. Add the new name, keep the old name with a deprecation comment, coordinate the migration.

2. **SSM Parameter Store instead of `terraform_remote_state`**: publish cross-stack values as SSM parameters. The parameter path (`/prasaarit/stg/upload-bucket-arn`) becomes the contract — searchable across repos, no state file access required, any tool can consume it.

3. **Cross-stack CI validation**: Team A's CI pipeline runs `terraform plan` for downstream consumers as part of the PR. If the rename breaks Team B's plan, CI catches it before merge.

4. **`terraform_remote_state` read access exposes all secrets**: the downstream stack needs read access to the upstream state file, which contains every sensitive attribute (DB passwords, API keys) in plaintext. SSM avoids this entirely.

---

## Q6: "You start with workspaces. Prod now has 15 `count = workspace == 'prod' ? 1 : 0` conditionals for WAF rules, alarms, and different instance sizes. When do you migrate to directory-per-env, and how?"

**Trap**: Tests pragmatic judgment on when to make the migration and how to do it safely.

**When**: the tipping point is usually around 5–10 prod-only resources. At that point, every `terraform plan` for staging shows "0 to add, 0 to change, 0 to destroy" for 15 resources cluttering the output. The config is harder to read and test. A new engineer can't tell which resources actually exist in which environment without tracing all the conditionals.

**How to migrate safely:**

1. **Create the directory structure**: `environments/stg/` and `environments/prod/` with `backend.tf`, `variables.tf`, `terraform.tfvars`.

2. **Wire up the backend**: use the existing workspace state paths as the initial keys, then migrate. For prod: `key = "upload-service/prod/terraform.tfstate"`.

3. **State migration per environment**:
   ```bash
   # Staging
   cd environments/stg
   terraform init   # new backend config
   # Terraform asks: copy state from old backend? → Yes
   terraform plan   # should show 0 changes if done correctly
   ```

4. **Decommission the workspace state**: after both environments are verified in their directories, the old workspace state files can be archived.

5. **Update CI/CD**: replace `terraform workspace select stg` with `cd environments/stg`. One job per directory. Cleaner, more explicit.

**Do not try to do both environments simultaneously.** Migrate stg first, verify, then prod. The state migration is reversible — if stg migration fails, you still have the workspace state intact.
