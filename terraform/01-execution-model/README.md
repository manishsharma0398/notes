# Chapter 01 — Terraform's Execution Model

## Mental Model

Terraform is **not a scripting tool**. It does not "run" your `.tf` files top-to-bottom like a shell script. It is a **declarative state reconciliation engine** with a **graph-based execution model**.

Think of it this way:

> You describe **what you want** (HCL config). Terraform figures out **what exists** (state + cloud), computes **what to change** (plan), and then **makes it so** (apply) — in an order dictated by a dependency graph, not by the order you wrote your config.

Here's the fundamental loop:

```
┌──────────────────────────────────────────────────────────────────┐
│                    YOUR .tf CONFIG FILES                         │
│              (desired state — what you want)                     │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   terraform plan    │──── reads state file
              │                     │──── calls provider RPCs to refresh
              │   compares:         │          actual cloud state
              │   desired vs actual │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │     PLAN OUTPUT     │
              │  (the diff — what   │
              │  will be created,   │
              │  updated, deleted)  │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   terraform apply   │──── walks the dependency graph
              │                     │──── calls provider RPCs to mutate
              │   executes changes  │          cloud resources
              │   writes to state   │──── updates state after EACH resource
              └─────────────────────┘
```

---

## The Three Phases: init → plan → apply

### Phase 1: `terraform init`

`terraform init` is the **setup phase**. It does three things, and understanding each is important because failures here are among the most common.

**What actually happens:**

1. **Reads your config** — scans all `.tf` files to determine required providers and modules.
2. **Downloads provider plugins** — fetches the provider binary (e.g., `hashicorp/aws` v5.x) from the Terraform Registry. These are standalone Go binaries, stored in `.terraform/providers/`.
3. **Initializes the backend** — sets up wherever state will be stored (local file by default, or S3, etc.). Creates the state file if it doesn't exist.
4. **Downloads modules** — if you reference any remote modules (`source = "..."` in a `module` block), they're downloaded into `.terraform/modules/`.

```
.terraform/
├── providers/
│   └── registry.terraform.io/
│       └── hashicorp/
│           └── aws/
│               └── 5.82.0/
│                   └── linux_amd64/
│                       └── terraform-provider-aws_v5.82.0   ← actual binary
├── modules/
│   └── ...                                                   ← downloaded modules
└── terraform.tfstate                                         ← backend state tracking
```

**Key detail**: The provider binary is a **separate executable**. Terraform Core does not contain AWS SDK code. The `hashicorp/aws` provider is a separate Go program (~400MB binary) that contains the AWS SDK and knows how to translate Terraform resource configs into AWS API calls.

**What `init` does NOT do:**

- It does NOT contact AWS (or any cloud). No API calls are made to your cloud provider.
- It does NOT validate that your config is correct against the cloud. That happens during `plan`.
- It does NOT create or modify any infrastructure.

**Failure modes:**

- Network failure downloading providers → fix: use `terraform init -plugin-dir` for air-gapped environments
- Version constraint conflict → provider version required by config doesn't match lock file (`.terraform.lock.hcl`)
- Backend initialization failure → e.g., S3 bucket for state doesn't exist yet (chicken-and-egg problem)

### Phase 2: `terraform plan`

This is where the real engine starts. When you run `terraform plan`, here is what Terraform Core does internally:

#### Step 1: Load Configuration

Terraform reads all `.tf` files in the current directory. The `configload.Loader` parses HCL into an AST and produces a `configs.Config` object. Some expressions (like `aws_lambda_function.my_func.arn`) **cannot be evaluated yet** — they remain as raw `hcl.Expression` objects to be resolved during graph walk.

#### Step 2: Load State

The state manager reads the current state (from `terraform.tfstate` or remote backend). The state contains the last known attributes of every resource Terraform manages. For example, after a previous apply, your state knows your Lambda's ARN, last modified time, runtime version, etc.

#### Step 3: Build the Dependency Graph

This is the core of Terraform's execution model. The `terraform.Context.Plan()` method calls a **graph builder** that constructs a Directed Acyclic Graph (DAG).

The graph is built through a series of **transforms** — functions that add vertices and edges to the graph:

| Transform              | What it does                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `ConfigTransformer`    | Creates one vertex for each `resource` block in your `.tf` config                              |
| `StateTransformer`     | Creates one vertex for each resource instance in the state file (for detecting drift/deletion) |
| `ReferenceTransformer` | Analyzes expressions to find references between resources and creates "happens after" edges    |
| `ProviderTransformer`  | Associates each resource with its provider and creates edges so providers initialize first     |

**Example for your Prasaarit project:**

```hcl
# This config would produce the following graph:

resource "aws_iam_role" "lambda_role" { ... }

resource "aws_lambda_function" "presign" {
  role = aws_iam_role.lambda_role.arn       # ← reference creates an edge
  ...
}

resource "aws_api_gateway_rest_api" "api" { ... }

resource "aws_api_gateway_integration" "presign" {
  rest_api_id = aws_api_gateway_rest_api.api.id      # ← edge
  uri         = aws_lambda_function.presign.invoke_arn # ← edge
}
```

```
Graph (edges = "must happen after"):

  aws_iam_role.lambda_role
           │
           ▼
  aws_lambda_function.presign ◄──── aws_api_gateway_rest_api.api
           │                                     │
           ▼                                     ▼
  aws_api_gateway_integration.presign ◄──────────┘
```

The `ReferenceTransformer` detected that `aws_lambda_function.presign` refers to `aws_iam_role.lambda_role.arn`, so it added an edge saying "the Lambda must be planned after the IAM role." **You didn't write `depends_on` — Terraform inferred this from your expressions.**

#### Step 4: Walk the Graph (Plan Phase)

Terraform walks the DAG using `dag.AcyclicGraph.Walk`. For each vertex, it calls the provider via gRPC to perform the plan:

For **each resource vertex during plan**, this happens:

1. **Refresh** — Call the provider's `ReadResource` RPC: "go check the cloud — does this resource exist? what does it look like now?"
2. **Diff** — Call the provider's `PlanResourceChange` RPC: "here's the current state and here's the desired config — what will change?"
3. **Record** — Save the computed diff (create / update / replace / delete) into the plan.

The walk respects the DAG edges: it will **not** plan `aws_lambda_function.presign` until `aws_iam_role.lambda_role` has been planned first, because it needs the IAM role's computed attributes.

**Concurrency**: Terraform walks the graph with **up to 10 concurrent goroutines** (the `-parallelism` flag, default: 10). If two vertices have no dependency between them, they can be planned simultaneously. In the graph above, `aws_iam_role.lambda_role` and `aws_api_gateway_rest_api.api` have no edges between them — they'd be planned concurrently.

#### The Refresh Step and `-refresh=false`

By default, every `terraform plan` calls `ReadResource` on **every resource in state** before computing the diff. This is the **refresh step** — it reconciles your state file against the actual cloud.

```
Default plan flow:
  1. Load config
  2. Read state
  3. Call ReadResource for EVERY resource in state → reconcile drift
  4. Compute diff (desired vs refreshed actual)
  5. Output plan
```

This is correct and safe, but it can be **slow** on large configurations (hundreds of resources × API roundtrip each).

The `-refresh=false` flag skips step 3:

```bash
terraform plan -refresh=false
```

**When it is safe:**

- You have just run `plan` moments ago and know nothing has changed in the cloud.
- You are running plan in CI against a newly created environment where no manual changes are possible.
- You are diagnosing a config change and want to isolate the plan from drift noise.

**When it is dangerous:**

- Your environment could have drift (manual console changes, AWS auto-modifications).
- You are debugging unexpected behaviour — skipping refresh hides the actual cloud state.

> **Operational rule**: Never use `-refresh=false` in production apply pipelines. It is a speed optimisation for local development iteration only.

#### `depends_on` — Explicit vs Implicit Dependencies

The `ReferenceTransformer` infers edges from **expression references** automatically. This covers ~95% of real-world dependencies:

```hcl
resource "aws_lambda_function" "fn" {
  role = aws_iam_role.lambda_exec.arn  # ← implicit edge: lambda waits for role
}
```

But there is a class of dependency that expression references **cannot capture**:

> **Hidden side-effect dependencies** — resource A causes a cloud-side change that resource B depends on, but B does not reference any attribute of A in HCL.

The classic example is IAM eventual consistency:

```hcl
resource "aws_iam_role_policy_attachment" "attach" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "fn" {
  role = aws_iam_role.lambda_exec.arn
  # The Lambda references the ROLE, not the policy attachment.
  # The ReferenceTransformer has NO edge from lambda → policy_attachment.
  # Terraform may create the Lambda BEFORE the policy is attached.
  # AWS's IAM control plane has eventual consistency — the policy may not
  # be visible to the Lambda execution environment for several seconds.
}
```

Fix with `depends_on`:

```hcl
resource "aws_lambda_function" "fn" {
  role = aws_iam_role.lambda_exec.arn

  depends_on = [
    aws_iam_role_policy_attachment.attach  # explicit edge added to the graph
  ]
}
```

**What `depends_on` actually does**: it calls `dag.Connect()` to add an edge between two vertices in the dependency graph. The Lambda vertex will not be walked until the policy attachment vertex has completed.

**The cost of `depends_on` on modules**: When `depends_on` is placed on a `module` block, Terraform cannot make any assumptions about which resources inside the module are actually needed. It forces the **entire module** to complete before any dependent resources start — even resources inside the module that have no real dependency. This is a common source of unexpectedly slow applies.

> **Using Terragrunt?** Terragrunt wraps this same init → plan → apply flow — it downloads remote modules, generates `backend.tf`/`provider.tf` files, and can orchestrate multiple root modules with `run-all`. How it modifies Terraform's execution model is covered in **Chapter 20 — Terragrunt** after you understand state, modules, and multi-environment patterns.

---

### Phase 3: `terraform apply`

Apply takes a plan (either from a saved plan file or computed inline) and executes it.

> **`terraform plan -out=plan.tfplan`**: saves the plan to a binary file. Passing this file to `terraform apply plan.tfplan` guarantees Terraform executes *exactly* that plan — no re-refresh, no re-diff. This is the correct pattern for CI/CD: plan in one job, human review, apply in the next job from the saved file. Without `-out`, `apply` re-runs plan internally (with a fresh refresh) — the plan the human reviewed and the plan that actually applies may differ if the cloud changed between the two steps.

The apply phase **builds its own graph** — different from the plan graph. The apply graph is built from the changes described in the plan, not from the config directly.

For **each resource vertex during apply**:

1. **Execute** — Call the provider's `ApplyResourceChange` RPC: "make this change happen in the cloud."
2. **Write to state immediately** — After each resource is successfully created/updated/deleted, Terraform writes the result to the state file **right away**. Not at the end. After each individual resource.

This "write after each resource" behavior is critical:

```
Apply sequence:
  1. Create aws_iam_role.lambda_role     → SUCCESS → written to state ✓
  2. Create aws_lambda_function.presign  → FAIL    → NOT written to state ✗
                                                     (may partially exist in cloud)
  3. Create aws_api_gateway_rest_api.api → may have already completed concurrently
                                           (no dependency on Lambda) → in state ✓
```

> **What this means**: If apply fails halfway, **your state file reflects exactly which resources were created and which were not**. Terraform will never "forget" a resource it created. The next `plan` will see the partial state and compute a plan that finishes the remaining work.

**Failure mode — partial apply:**

- Resources that succeeded are in state.
- Resources that failed are NOT in state (because the provider returned an error before Terraform could record the result).
- Resources **dependent on the failed one** were never attempted.
- Resources **independent of the failed one** may have already completed (because of concurrent graph walk).

---

## The Provider Protocol: How Terraform Talks to Providers

This is the most misunderstood part of Terraform. Terraform Core does **not** contain any cloud-specific code. It has no idea what an S3 bucket or Lambda function is. All cloud knowledge lives in the **provider plugin**.

### Architecture

```
┌────────────────────────────┐          ┌─────────────────────────────┐
│      TERRAFORM CORE        │          │     PROVIDER PLUGIN         │
│                            │          │   (separate binary)         │
│  Reads HCL config          │          │                             │
│  Manages state             │   gRPC   │  terraform-provider-aws     │
│  Builds dependency graph   │◄────────►│                             │
│  Walks graph               │  (over   │  Contains AWS SDK           │
│  Coordinates execution     │  local   │  Knows AWS resource schemas │
│                            │  socket) │  Makes actual AWS API calls │
└────────────────────────────┘          └─────────────────────────────┘
     Process A                               Process B
```

**Key facts:**

- The provider is a **separate OS process**, not a library linked into Terraform.
- Communication happens via **gRPC over a local Unix socket** (or named pipe on Windows).
- The protocol is defined using **Protocol Buffers** (protobuf).
- Current protocol version: **v6** (recommended), **v5** (legacy, still widely used).

### The RPC Methods

When Terraform needs to interact with a cloud resource, it calls one of these gRPC methods on the provider:

| RPC Method               | When Called             | What It Does                                                                                                                                            |
| ------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GetProviderSchema`      | During `init`/`plan`    | Returns the schema of all resources and data sources this provider supports. This is how Terraform knows what attributes `aws_lambda_function` accepts. |
| `ConfigureProvider`      | Start of `plan`/`apply` | Sends provider config (region, credentials) to the provider. In your case: `region = "ap-south-1"` and AWS credentials.                                 |
| `ValidateResourceConfig` | During `plan`           | Checks if your resource config is valid according to the provider's schema.                                                                             |
| `ReadResource`           | During `plan` (refresh) | Calls the cloud API to get the current state of a resource. For Lambda, this calls `GetFunction` AWS API.                                               |
| `PlanResourceChange`     | During `plan`           | Computes the diff between current state and desired config. Returns what will change and whether it requires replacement.                               |
| `ApplyResourceChange`    | During `apply`          | Makes the actual change. Calls `CreateFunction`, `UpdateFunctionConfiguration`, `DeleteFunction`, etc.                                                  |

### What the Provider Binary Actually Does

When Terraform calls `ApplyResourceChange` for `aws_lambda_function.presign`:

1. Terraform sends the desired config and current state over gRPC.
2. The `terraform-provider-aws` binary deserializes the gRPC message.
3. It calls the AWS Lambda API (`CreateFunction` or `UpdateFunctionConfiguration`) using the AWS SDK for Go.
4. It waits for the API response.
5. It serializes the resulting resource state back into a gRPC response.
6. Terraform receives the response and writes it to state.

**The provider decides what requires create vs update vs replacement.** Each attribute in the provider's schema is marked as either:

- **Updateable in-place**: change this attribute → provider calls Update API
- **ForceNew**: change this attribute → provider destroys and recreates the resource

This is why changing a Lambda function's `function_name` forces a replacement (destroy + create), but changing its `timeout` is an in-place update. The provider schema defines this, not Terraform Core.

---

## Grounding: Your Prasaarit Project

Here's exactly what would happen when you `terraform apply` your upload service infra:

```
$ terraform init
  → Downloads terraform-provider-aws binary (~400MB)
  → Creates .terraform/ directory
  → Initializes local state file

$ terraform plan -var="s3_upload_bucket=my-bucket"
  → Loads all .tf files from infra/
  → Opens state file (empty on first run)
  → Starts provider plugin: spawns terraform-provider-aws as a child process
  → Calls ConfigureProvider gRPC: sends region=ap-south-1 + your AWS creds
  → Builds DAG from config references
  → Walks DAG, calling PlanResourceChange for each resource:
      - IAM role: will be CREATED (not in state)
      - IAM policy attachment: will be CREATED (depends on role)
      - Lambda function: will be CREATED (depends on role)
      - Lambda permission: will be CREATED (depends on Lambda + API GW)
      - API GW REST API: will be CREATED
      - API GW resource: will be CREATED (depends on API)
      - API GW method: will be CREATED (depends on resource)
      - API GW integration: will be CREATED (depends on method + Lambda)
      - API GW deployment: will be CREATED (depends on integration)
      - API GW stage: will be CREATED (depends on deployment)
  → Outputs plan: "10 to add, 0 to change, 0 to destroy"

$ terraform apply
  → Walks apply graph (built from the plan, not from config):
      1. Create IAM role         → AWS API: iam:CreateRole       → state updated
      2. Attach policy to role   → AWS API: iam:AttachRolePolicy  → state updated
      3. Create REST API         → AWS API: apigateway:CreateRestApi → state updated
         (concurrent with IAM — no dependency between them)
      4. Create Lambda function  → AWS API: lambda:CreateFunction → state updated
         (waited for IAM role to complete first)
      5. Create API GW resource  → waited for REST API
      6. Create API GW method    → waited for resource
      7. Create Lambda perm      → waited for Lambda + API GW
      8. Create API GW integration → waited for method + Lambda
      9. Create deployment       → waited for integration
     10. Create stage            → waited for deployment
  → All 10 resources created. State file now contains their IDs, ARNs, etc.
  → Outputs: api_gateway_invoke_url = "https://xyz.execute-api.ap-south-1.amazonaws.com/stg"
```

---

## What Terraform Guarantees

| Guarantee               | Details                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Ordering**            | Resources are created/updated in dependency order. If A depends on B, B is fully created before A starts.          |
| **State consistency**   | State is written after each successful resource operation. A crash mid-apply leaves a state that reflects reality. |
| **Idempotency of plan** | Running `plan` twice with no changes in config or cloud → same plan output.                                        |
| **Provider isolation**  | Terraform Core never touches the cloud directly. All cloud operations go through the provider's gRPC interface.    |

## What Terraform Does NOT Guarantee

| Non-guarantee                       | Why it matters                                                                                                                                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Atomicity**                       | Apply is NOT atomic. If resource 5 out of 10 fails, resources 1-4 exist in the cloud. There is no "rollback."                                                                                            |
| **Resource readiness**              | Terraform says "created" when the provider's API returns success. This does NOT mean the resource is ready to serve traffic. Lambda may need seconds to become invocable after `CreateFunction` returns. |
| **Concurrent safety** | Two engineers running `apply` simultaneously on the same state = disaster. There is no built-in lock with local state. S3 backend with DynamoDB locking solves this — or with Terraform v1.11+, S3 native locking (`use_lockfile = true`) which deprecates the DynamoDB table entirely. See Chapter 03. |
| **Drift detection without refresh** | If someone changes a resource in the console, Terraform doesn't know until it runs `plan` (which calls `ReadResource` to refresh). Between plans, Terraform is blind to drift.                           |

---

## Source References

- [Terraform Core Architecture (official)](https://github.com/hashicorp/terraform/blob/main/docs/architecture.md) — the canonical internal architecture document
- [Plugin Protocol](https://developer.hashicorp.com/terraform/plugin/how-terraform-works) — how Terraform Core talks to providers via gRPC
- [Provider Protocol v6 spec](https://developer.hashicorp.com/terraform/plugin/terraform-plugin-protocol) — the protobuf definitions
- [terraform-provider-aws source](https://github.com/hashicorp/terraform-provider-aws) — the actual AWS provider code
