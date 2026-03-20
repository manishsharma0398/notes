# Chapter 00 — Revision Notes

1. **Registry anatomy — 3 sections per page**: Example Usage → Argument Reference (Required/Optional inputs) → Attribute Reference (outputs to wire into other resources). Use `Ctrl+F → "Attribute Reference"` to jump past the long arguments list. Trap: `invoke_arn` ≠ `arn` on Lambda — API Gateway needs `invoke_arn`.

2. **Console → Registry → Terraform**: Always understand the AWS concept in the console first. The Console UI and the Terraform Argument Reference are almost a 1:1 map: required fields = `(Required)`, checkboxes/dropdowns = `(Optional)` booleans/strings.

3. **`required_version` guards your plan's semantics**: Terraform minor releases change plan behaviour (e.g., ephemeral resources in 1.10, write-only attributes in 1.11). Without pinning, a CLI or provider upgrade triggered by `init -upgrade` can silently produce a destructive plan.

4. **`.terraform.lock.hcl` is a binary contract**: Commit it. It records the exact provider binary hash. Deleting it and re-initialising lets Terraform silently pick a newer provider version that may have breaking schema changes — even if your `required_providers` version string still satisfies the constraint.

5. **`-/+` in plan output = replacement**: The `-` destroy and `+` create happen in a single plan action triggered by a `ForceNew` attribute change. For stateful resources (RDS, ElastiCache, OpenSearch) this means data loss unless `create_before_destroy` is set. Always pause on `-/+` in code review.

6. **Registry left-pane categories — ownership matrix**: `resource` = Terraform owns it, tracked in state, destroying the block destroys the real thing. `data` = read-only query, Terraform does not own it, removing the block does nothing to real infra. `list resource` = `data` that returns a collection (e.g., available AZs). `action` = experimental imperative operation (e.g., SES send), runs every apply, never stored in state — the proper replacement for `null_resource + local-exec`.
