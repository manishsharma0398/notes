# Chapter 09 — Ephemeral Resources and Write-Only Attributes — Interview Questions

---

## Q1: "What is an ephemeral resource and why does it solve the state-file secrets problem better than `sensitive = true`?"

### The Trap
Tests whether the candidate knows the actual mechanism — that `sensitive = true` does not redact from state, and that ephemeral resources are not just "hidden" values but a completely different resource mode.

### What a Senior Engineer Says

`sensitive = true` is a **display control**, not a security control. It adds a mark to the cty value that suppresses CLI output, but the underlying value is written to the state file exactly as-is. Anyone with read access to your S3 state bucket can `cat terraform.tfstate` and see it in plaintext.

An ephemeral resource (`ephemeral "provider_type" "name" {}`, v1.10) is a different resource mode entirely. The provider protocol has a separate RPC interface for ephemeral resources: `Open`, `Renew`, and `Close`. When Terraform starts a graph walk, it calls `Open` on the provider — the provider returns a value (e.g., a Vault dynamic secret). Terraform uses that value in-memory to configure other resources. When the graph walk completes, Terraform calls `Close` — which may revoke the credential. **At no point is the value written to the state file.** There is no state key for that resource.

On the next `terraform plan` or `terraform apply`, the ephemeral resource is re-opened from scratch. There is no cached or stored value to become stale or to leak.

**Practical implication:** If your state bucket is compromised, `sensitive = true` values are exposed. Ephemeral resource values were never there to expose.

---

## Q2: "You're using an ephemeral Vault database credential to configure an RDS connection. The apply runs for 25 minutes, but the Vault dynamic secret has a 15-minute TTL. What happens? How does Terraform handle this?"

### The Trap
Tests knowledge of the `Renew` mechanism — the part of the ephemeral resource protocol most candidates don't know about.

### What a Senior Engineer Says

When the provider opens the ephemeral resource, it can return a `RenewAt` timestamp — the time at which the credential needs to be renewed to remain valid. If `RenewAt` is set, Terraform spawns a background goroutine for that ephemeral resource instance. The goroutine waits until `time.Until(RenewAt)` elapses, then calls `Renew` on the provider, which extends the lease and may return a new `RenewAt` for the next renewal cycle.

From the Terraform source (`ephemeral_resources.go`, `handleRenewal` goroutine):
- The goroutine runs in a loop until the context is cancelled (apply complete) or `Close` is called
- If `Renew` returns an error, the goroutine stops renewing and marks the instance as unhealthy (`renewDiags.HasErrors()`)
- Terraform checks `live` status via `InstanceValue` before using the ephemeral value — if renewal failed, downstream resource operations that need the credential will fail

So the answer to "25-minute apply, 15-minute TTL": Terraform automatically renews the credential at the 15-minute mark. If the renewal itself fails (Vault is unreachable, the TTL was 0 with no renewal allowed), the apply fails the resources that depend on the now-dead credential.

The `Close` call at the end of the apply (or on cleanup after failure) revokes the credential promptly — you don't end up with a live database credential floating around unnecessarily after the apply.

---

## Q3: "You want to pass a secret from Secrets Manager into an ephemeral output of a child module so the root module can use it to configure a Lambda environment variable. Walk me through the constraints at each boundary."

### The Trap
Tests understanding of ephemeral value propagation rules — which contexts accept ephemeral values and which do not.

### What a Senior Engineer Says

The chain looks like this:
```
Secrets Manager → ephemeral resource → module output → Lambda env var
```

**Step 1 — Secrets Manager fetch (child module):**
```hcl
ephemeral "aws_secretsmanager_secret_version" "api_key" {
  secret_id = "my-app-api-key"
}
```
This is fine — `ephemeral` resources are the correct way to read a secret that should not land in state.

**Step 2 — Expose via module output:**
```hcl
output "api_key" {
  value     = ephemeral.aws_secretsmanager_secret_version.api_key.secret_string
  ephemeral = true    # REQUIRED — ephemeral values cannot flow into non-ephemeral outputs
  sensitive = true    # Good practice — suppress CLI display
}
```
Without `ephemeral = true` on the output, Terraform will error at plan time: the value is ephemeral and cannot be used in a context that would persist it to state.

**Step 3 — Use in root module's Lambda resource:**
```hcl
resource "aws_lambda_function" "app" {
  environment {
    variables = {
      API_KEY = module.secrets.api_key   # ✅ Legal — resource config is not persisted
    }
  }
}
```
Lambda environment variable configs **are** written to state — but the value of `API_KEY` here is the attribute of an `aws_lambda_function` resource, which Terraform writes by reading back from the AWS API after apply. The Lambda function's environment block is NOT where the secret propagation path terminates in state; it terminates in the Lambda configuration in AWS, which Terraform reads back and stores as an attribute.

**The real constraint:** you cannot put the ephemeral value in a `local`, `output` (without `ephemeral = true`), or any expression that gets evaluated at plan time for non-ephemeral purposes. The compiler enforces this at plan time.

---

## Q4: "A colleague adds `sensitive = true` and `write-only` to a database password attribute and says the password is now 'safe'. What are they right and wrong about?"

### The Trap
Tests the three-way distinction between display masking, write-only nulling, and full ephemeral elimination.

### What a Senior Engineer Says

**What they're right about:**
- `sensitive = true` masks the value in `terraform plan` / `apply` output. Other engineers running Terraform locally won't accidentally see the password in their terminal.
- A write-only attribute strips the value to `null` before it is written to state (from source: `StripWriteOnlyAttributes` in `lang/ephemeral/strip.go`). The state file will contain `null` for that attribute, not the actual password.
- Combined, these are a significant improvement over a plain `string` attribute.

**What they're wrong about:**

1. **"The password is safe"** — "safe" depends on the threat model. The password was still transmitted to the provider process, which called the AWS API with it. The value existed in the Terraform CLI process memory during the apply. The state file doesn't store it, but the provider logs, AWS CloudTrail, and in-memory process dumps might. Write-only prevents state-file leakage, not all leakage.

2. **Perpetual drift** — because the state stores `null` and the config has a value, every `terraform plan` will show the password attribute as changing. The provider must treat this as "apply the new value if it differs from what's actually set on the DB, otherwise no-op." If the provider blindly applies the change on every plan, you'll reset the database password on every apply — which disrupts active connections.

3. **No write-only without provider support** — write-only is a provider schema declaration. If the `aws_db_instance.password` attribute is not declared `WriteOnly` in the AWS provider, marking it sensitive in HCL has no effect on state storage. As of today, the AWS provider is still adding write-only support attribute by attribute. Verify that the specific attribute actually supports it.

---

## Q5: "You generate an RDS master password with `random_password.db.result` and use it as the `aws_db_instance.password`. Six months later, you rotate the password in the AWS console. What is the state file state, and what happens on the next plan?"

### The Trap
Connects secrets management concepts back to drift — tests understanding of what's in state, what refresh reads, and how drift occurs with auto-managed secrets.

### What a Senior Engineer Says

**Current state file (before rotation):** contains `random_password.db.result = "original_password"` and `aws_db_instance.main.password = "original_password"` (or `null` if write-only is supported).

**After manual rotation in the console:** AWS has the new password. The state file still has the old one (or null).

**On the next `terraform plan`:**
- Terraform runs `refresh` against the AWS API (unless `-refresh=false` is passed).
- For most `aws_db_instance` attributes, the AWS API `DescribeDBInstances` does NOT return the master password — it is write-only at the API level too.
- Terraform's state still has `password = "original_password"`. The AWS API confirms everything else about the instance (engine, storage, etc.) but says nothing about the password.
- **Result:** `terraform plan` shows **no changes** for the password attribute, even though the actual password in AWS has changed. Terraform is unaware of the rotation.
- If you then run `terraform apply`, Terraform has no change to apply for the password — so the old state value stays, and the console rotation is silently ignored.

**The correct pattern for secret rotation:**
Do not manage live rotating secrets via Terraform at all. Use AWS Secrets Manager with automatic rotation enabled. The database application reads the secret from Secrets Manager at startup. Terraform only manages the *existence* of the secret and the rotation configuration — not the secret value itself.
