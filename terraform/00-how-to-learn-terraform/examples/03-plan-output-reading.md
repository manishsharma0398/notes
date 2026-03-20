# Example 03 — Reading Plan Output

This document annotates a realistic `terraform plan` output so you can read any
plan fluently. The scenario: a configuration change to an existing deployment.

---

## The Plan Output

```
Terraform will perform the following actions:

  # aws_s3_bucket.logs will be updated in-place
  ~ resource "aws_s3_bucket" "logs" {
        id            = "my-app-access-logs-prod"
      ~ tags          = {
          + "CostCenter" = "platform"
            # (1 unchanged element hidden)
        }
    }

  # aws_db_instance.primary must be replaced
  -/+ resource "aws_db_instance" "primary" {
      ~ allocated_storage    = 100 -> 200
      ~ identifier           = "myapp-prod-db" -> (known after apply)
      + identifier_prefix    = "myapp-prod-db-" # forces replacement
        instance_class       = "db.t3.micro"
        # (14 unchanged attributes hidden)
    }

  # aws_cloudwatch_log_group.app will be created
  + resource "aws_cloudwatch_log_group" "app" {
      + arn               = (known after apply)
      + id                = (known after apply)
      + name              = "/app/prod/api"
      + retention_in_days = 30
    }

  # aws_iam_role.old_role will be destroyed
  - resource "aws_iam_role" "old_role" {
      - arn  = "arn:aws:iam::123456789012:role/OldRole" -> null
      - name = "OldRole" -> null
    }

  # module.networking.aws_vpc.main will be read during apply
  <= data "aws_vpc" "current" {
      + id   = (known after apply)
      + cidr = (known after apply)
    }

Plan: 1 to add, 1 to change, 1 to destroy, 1 to replace.
```

---

## Symbol Reference

| Symbol | Action | What it means for stateful resources |
|--------|--------|--------------------------------------|
| `+`    | Create | New resource, no existing state |
| `-`    | Destroy | Resource removed from config or all `ForceNew` attrs changed |
| `~`    | Update in-place | Mutable attribute change, resource continues running |
| `-/+`  | **Replace** | One or more `ForceNew` attributes changed — destroy first, then create |
| `<=`   | Read (data source) | Terraform will call the cloud API to read this value at apply time |

---

## Reading the Replace (`-/+`) Carefully

```
# aws_db_instance.primary must be replaced
-/+ resource "aws_db_instance" "primary" {
    ...
    + identifier_prefix = "myapp-prod-db-"  # forces replacement
```

The `# forces replacement` comment is Terraform telling you exactly *which*
attribute triggered the replacement. Here, adding `identifier_prefix` on an
existing RDS instance is a `ForceNew` operation — the instance must be
destroyed and recreated.

**This destroys your database** unless you have:
1. `lifecycle { create_before_destroy = true }` to reverse the order, OR
2. A snapshot + restore strategy, OR
3. An intentional blue/green cutover.

Never approve a `-/+` on a stateful resource without understanding *why* the
replacement is happening and what the data loss story is.

---

## `(known after apply)` vs. Unknown Values

```
+ arn = (known after apply)
~ identifier = "myapp-prod-db" -> (known after apply)
```

- `(known after apply)` means Terraform does not know this value yet. It will
  be revealed when the cloud API responds during `terraform apply`.
- A new resource's `id` and `arn` are always `(known after apply)`.
- A replaced resource's `identifier` becomes unknown because the new resource
  hasn't been created yet.

**Interview trap**: If resource B depends on an attribute of resource A that is
`(known after apply)`, resource B may also show `(known after apply)` for its
own computed attributes. This is called **unknown propagation** — it's normal,
not a bug.

---

## The `# (N unchanged attributes hidden)` Line

Terraform hides attributes whose values are not changing to keep the plan
readable. If you want to see the full resource state:

```bash
terraform plan -out=plan.tfplan
terraform show plan.tfplan
```

This shows every attribute, including unchanged ones.
