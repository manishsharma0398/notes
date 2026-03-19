# Chapter 01 — Execution Model — Interview Questions

---

## Q1: "You ran `terraform apply` and it partially failed. Resource 4 out of 8 returned an error. What is the current state of your infrastructure and your state file?"

### The Trap
The interviewer wants to see if you think apply is atomic (it isn't) or if you think the state file is "all or nothing."

### What a Senior Engineer Says

- Resources 1–3 were **successfully created** and are **recorded in the state file**. They exist in the cloud.
- Resource 4 failed. Whether it's in state depends on _when_ it failed:
  - If the provider's `ApplyResourceChange` returned an error → the resource is **not** in state. It **may or may not** exist in the cloud (the API call might have partially succeeded).
  - If the provider succeeded but Terraform couldn't write to state (e.g., backend IO error) → the resource exists in the cloud but is **not** in state — this is a resource leak.
- Resources 5–8: if they **depend** on resource 4, they were **never attempted** (the graph walk stops processing dependents of a failed vertex). If they're **independent** of resource 4 and were running concurrently (parallelism ≤ 10), they **may have already completed**.
- **There is no rollback.** Terraform does not undo resources 1–3. The next `terraform plan` will show the remaining work to reach the desired state.

### Follow-up: "How do you recover?"
- Run `terraform plan` again — it will refresh against the cloud and compute what remains.
- If resource 4 partially exists in the cloud but not in state → use `terraform import` to bring it into state, or manually delete it in the cloud.

---

## Q2: "Terraform says your Lambda function was created successfully. Is it ready to serve traffic?"

### The Trap
This tests whether you understand that Terraform's "success" ≠ the resource being ready.

### What a Senior Engineer Says

**No. Not necessarily.**

Terraform calls the AWS provider's `ApplyResourceChange` RPC, which calls `lambda:CreateFunction`. AWS returns a `2xx`response and the function's ARN, state, etc. Terraform records this in state and reports success.

But Lambda has an internal lifecycle:
- `CreateFunction` returns while the function is in `Pending` state.
- The execution environment, network interfaces (for VPC Lambda), and code download may still be in progress.
- Immediate invocations may fail with `ResourceNotReadyException` or experience cold starts.

Terraform does not wait for "ready." It waits for the cloud API to return success. These are different things. The AWS provider for some resources implements `waiters` (e.g., waiting for an RDS instance to be `available`), but for Lambda function creation, the provider typically returns as soon as `CreateFunction` succeeds — it does not wait for the function to transition to `Active`.

**Why this matters for your API GW + Lambda:**
If you create the Lambda and the API GW deployment in the same apply, Terraform may create the deployment successfully, but the very first request through API GW could hit a Lambda that isn't fully initialized yet.

---

## Q3: "Why does changing the `function_name` of an `aws_lambda_function` force a destroy-and-recreate, while changing `timeout` is an in-place update? Where is this decision made?"

### The Trap
Tests understanding of the provider protocol and `ForceNew` schema attribute.

### What a Senior Engineer Says

This decision is **not made by Terraform Core** — it's made by the **provider plugin**.

Every resource attribute in the provider's schema has a `ForceNew` boolean. When `ForceNew` is true for an attribute, changing that attribute's value causes Terraform to plan a **replacement** (destroy old + create new) instead of an in-place update.

In the `terraform-provider-aws` source code:
- `function_name` is marked `ForceNew: true` — because the AWS API does not allow renaming a Lambda function. You must create a new function with the new name.
- `timeout` is NOT marked `ForceNew` — because the AWS API supports `UpdateFunctionConfiguration` to change timeout in-place.

Terraform Core asks the provider "here's the old state and new config — what changes?" via `PlanResourceChange`. The provider checks its schema, sees `function_name` changed and `ForceNew: true`, and returns a plan that says "this resource must be replaced."

**When `ForceNew` burns you in production:**
Changing an RDS `identifier` is `ForceNew`. Terraform will plan to **destroy your database and recreate it**. If you don't read the plan output carefully before approving, you delete your production database. This is why `lifecycle { prevent_destroy = true }` exists.

---

## Q4: "Your teammate made a change to the Lambda function directly in the AWS console. What happens on the next `terraform plan`?"

### The Trap
Tests understanding of state drift and the refresh mechanism.

### What a Senior Engineer Says

During `terraform plan`, Terraform calls the provider's `ReadResource` RPC for every resource in state. This calls the AWS API (`lambda:GetFunction`) to get the **current actual state** of the resource.

The plan then compares three things:
1. **Desired state** — what your `.tf` config says
2. **State file** — what Terraform last recorded
3. **Cloud state** — what `ReadResource` just returned from AWS

If your teammate changed the Lambda's timeout from 10s→30s in the console:
- Your config says `timeout = 10`
- State says `timeout = 10`
- Cloud says `timeout = 30`

Terraform will show a plan to **change timeout from 30 back to 10** — reverting your teammate's console change. Terraform treats its config as the source of truth.

**The danger**: If your teammate changed something that is `ForceNew` (e.g., they couldn't directly, but hypothetically), Terraform could plan a **resource replacement**, destroying and recreating it.

**Between `plan` runs, Terraform is completely blind to drift.** If someone breaks your Lambda via console at 2 AM and you don't run `plan` until the next morning, Terraform has no idea.

---

## Q5: "Two engineers run `terraform apply` simultaneously on the same stack with local state. What happens?"

### The Trap
Tests understanding of state locking and concurrent access.

### What a Senior Engineer Says

With **local state** (a `terraform.tfstate` file on disk), there is **no locking**. Both processes:

1. Read the same state file at the start.
2. Build plans based on the same starting state.
3. Begin applying changes concurrently.

**What goes wrong:**

- Both try to create the same resource → one succeeds, one gets a cloud-level conflict error (e.g., "Lambda function with this name already exists").
- Both write to the state file → the last one to finish **overwrites** the other's state entries. Resources created by the first apply that finished may be "forgotten" by state — creating resource leaks (they exist in AWS but aren't tracked).
- There's no rollback for either.

**The fix: remote state with locking.** An S3 backend with DynamoDB locking table ensures that only one `apply` can run at a time. The second engineer's `terraform apply` will fail immediately with "Error acquiring state lock."

This is why you set up remote state **before** adding CI/CD pipelines.
