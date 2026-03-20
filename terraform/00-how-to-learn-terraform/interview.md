# Chapter 00 — Interview Questions

---

## Q1 — Registry Trap: Optional ≠ Safe to Omit

> "In the Terraform Registry docs, an argument is marked `(Optional)`. Does that mean it's safe to leave it out?"

**What the interviewer is testing:** Whether you understand that "optional" is a schema marker, not a security or correctness signal.

**Answer:**
Optional means Terraform will not reject your config if the argument is absent. It does *not* mean the default is a good default for your workload. Classic examples:

- `aws_s3_bucket.force_destroy` defaults to `false` — correct for production, dangerous in CI where you want clean teardown.
- `aws_s3_bucket_public_access_block.block_public_acls` doesn't exist unless you create the separate resource — an omitted block means the bucket may default to allowing public access depending on account settings.
- `aws_db_instance.deletion_protection` defaults to `false` — leaving it out in production means a `terraform destroy` will delete your database with no prompt.

The habit: always read the description of optional arguments, not just the marker.

---

## Q2 — Version Pinning Depth

> "Your team uses `version = ">= 5.0"` for the AWS provider. A new engineer runs `terraform init` on Monday. What version of the AWS provider do they get? Is that the same as what ran in last Friday's CI pipeline?"

**What the interviewer is testing:** Understanding of the `.terraform.lock.hcl` file and the difference between version *constraints* and version *locking*.

**Answer:**
With `>= 5.0`, the constraint allows any `5.x` or `6.x` or higher. If the lock file is committed and unchanged, `terraform init` installs the exact version recorded in the lock file — the same binary as Friday. But:
- If `.terraform.lock.hcl` was deleted, re-init resolves "latest satisfying" at that moment — potentially a different version with breaking schema changes.
- If someone runs `terraform init -upgrade` and commits the result, the lock file updates for everyone.

The correct practice: commit `.terraform.lock.hcl`, use `~>` (pessimistic constraint) to allow only patch upgrades, and treat provider upgrades as deliberate pull requests.

---

## Q3 — The `-/+` Warning

> "You're reviewing a PR. The plan output shows `-/+ aws_db_instance.primary`. The engineer says 'it's just a tagging change, it'll update in place.' Are they right?"

**What the interviewer is testing:** Reading plan output accurately vs. trusting the author's description.

**Answer:**
No. `-/+` is *never* an in-place update — it is a destroy-then-recreate cycle triggered by a `ForceNew` schema attribute. For `aws_db_instance`, `ForceNew` is set on attributes like `engine`, `engine_version` (major version), `instance_class` in some cases, and `identifier`. A tagging change alone would show `~` (in-place update), not `-/+`.

The reviewer must identify *which* attribute changed. The plan will note it with a `# forces replacement` comment. The correct action is to roll back that attribute change or explicitly use `lifecycle { create_before_destroy }` if a replacement is genuinely intended — not to approve based on the PR description.

---

## Q4 — Attribute Reference vs. Argument

> "You're writing an IAM policy and need the ARN of an S3 bucket you just declared. You type `aws_s3_bucket.my_bucket.bucket` — is that the ARN?"

**What the interviewer is testing:** Whether you know the difference between an *argument* (input you provide) and an *attribute reference* (output the resource exports).

**Answer:**
No. `bucket` is the *argument* you set — the bucket's name string. The ARN is an *attribute reference* exported by the resource after creation. You find it in the "Attribute Reference" section of the Registry docs: `aws_s3_bucket.my_bucket.arn`. The `id` attribute on an S3 bucket is the bucket name (by convention for this resource). Always check the Attribute Reference section, not the Argument Reference, when wiring resource outputs into other resources.

---

## Q5 — `required_version` vs. `required_providers`

> "What is the difference between `required_version` and `required_providers`? If you only set one, what breaks?"

**What the interviewer is testing:** Precision about the two distinct pinning layers in Terraform.

**Answer:**
- `required_version` pins the **Terraform CLI binary** version. Without it, a developer on CLI `1.10` and a CI runner on `1.7` may produce different plans — for example, ephemeral resources (1.10) referenced in config will fail on the older CLI.
- `required_providers` pins the **provider plugin** version. Without it, `terraform init` picks "latest" on first run, and the lock file governs subsequent runs. If the lock file is missing or ignored, every init can pull a different provider.

Setting only `required_version` still leaves providers floating if there is no lock file. Setting only `required_providers` still allows the CLI version to vary. For production codebases, both should be set.
