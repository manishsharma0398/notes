# Example: `-refresh=false` — When Safe vs When Dangerous

## The setup

You have a Lambda + API Gateway stack. Imagine someone on your team changed the
Lambda timeout in the AWS console from 10s → 30s (without touching Terraform).

---

## Without `-refresh=false` (default behaviour)

```bash
$ terraform plan
```

```
# Terraform calls ReadResource for every resource in state
# It sees: cloud says timeout=30, your config says timeout=10

~ aws_lambda_function.presign
  ~ timeout = 30 -> 10   # ← drift detected, Terraform will revert console change
```

Terraform correctly detects the drift and plans to fix it.

---

## With `-refresh=false` (drift is hidden)

```bash
$ terraform plan -refresh=false
```

```
No changes. Your infrastructure matches the configuration.
```

**This is wrong.** Terraform skipped `ReadResource` entirely. It compared your
config against the **old state file** (which still says `timeout=10`). Since
the config also says `timeout=10`, Terraform concludes nothing changed.

The drift is invisible. If you `apply` with `-refresh=false`, the console
change stays. On the next normal `plan` without the flag, it reappears.

---

## Safe usage

```bash
# During local development — you just ran plan 30 seconds ago,
# nothing could have changed in the cloud.
terraform plan -refresh=false

# Then when you're ready for the real thing:
terraform plan  # or terraform plan -refresh=true (explicit, same as default)
```

---

## The `-refresh-only` mode (different from `-refresh=false`)

```bash
terraform apply -refresh-only
```

This is the **recommended way to reconcile drift** when you want to accept
manual changes into your state without changing any infrastructure:

1. Terraform calls ReadResource for all resources (full refresh)
2. Terraform shows you what changed in the cloud
3. On approval, it **updates the state file only** — no API calls to mutate
   the cloud
4. Your config is now "out of sync" with state — the next normal plan will
   show the config change needed to bring it back, or you update your config
   to reflect the accepted drift

This is the safe, explicit path for drift management. `-refresh=false` is just
a speed shortcut.
