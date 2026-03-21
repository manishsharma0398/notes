# Chapter 09 — Ephemeral Resources and Write-Only Attributes — Revision Notes

## 1. `sensitive = true` masks display only — the value is still plaintext in state

- `sensitive = true` adds a cty "mark" that suppresses the value in `terraform plan` / `apply` output and propagates transiently through expressions.
- The actual value is **written to the state file as plaintext**. Open `terraform.tfstate` and you will see it. Anyone with S3 read access to your state bucket can read it.
- **Rule:** `sensitive = true` is not a security control; it's a UX control. Do not rely on it to protect secrets that should not be stored.

## 2. Ephemeral resources (v1.10) live only during the graph walk — never persisted to state

- `ephemeral "vault_database_secret" "creds" {}` is opened at the start of every `plan` and every `apply` (the provider's `Open` call), used in-memory, and closed (`Close` call) when done.
- If the provider returns a `RenewAt` timestamp, Terraform spawns a goroutine to renew the lease before it expires during a long apply.
- The values are **never written to state** — not `null`, not encrypted, simply absent. There is nothing to leak if your state bucket is compromised.

## 3. Ephemeral values (`ephemeral = true`) cannot be used in state-persistent contexts

- A `variable` or `output` marked `ephemeral = true` carries the same restriction: its value cannot flow into attributes that will be written to state.
- `ephemeralasnull(val)` extracts a `null` value from an ephemeral input safely — allowing conditional logic (`!= null`) without using the sensitive data itself.
- **Compile-time checked:** Terraform will error at plan time if an ephemeral value is used in a non-ephemeral-safe context (e.g., a non-ephemeral output), not silently allow it.

## 4. Write-only attributes (v1.11) are nulled in state by the Terraform engine — not encrypted

- A provider attribute schema can declare `WriteOnly: true`. During apply, the value is sent to the provider's API call, but `StripWriteOnlyAttributes` replaces it with `cty.NullVal` before state is written (from source: `lang/ephemeral/strip.go`).
- **Consequence:** On every subsequent plan, Terraform sees `null` in state vs a non-null config value — it will always show a diff for that attribute, even if the actual cloud value hasn't changed. The provider must handle this gracefully.
- **Requires provider support.** Not every provider attribute supports `WriteOnly`. Check the AWS provider docs per resource.

## 5. The three-tool decision guide for secrets

- **Short-lived / dynamic credentials** (Vault token, Secrets Manager rotation token): use an `ephemeral` resource — no state footprint.
- **Provider-managed static password** (RDS master password, IAM access key the provider creates): use a write-only attribute if the provider supports it.
- **Pre-existing secret** (a secret already in Secrets Manager): use a `data` source — Terraform stores metadata in state (secret ID), not the secret value itself.
- **Never:** generate a secret with `random_password` and write it to an output without a write-only or ephemeral path. It will be in your state file forever.
