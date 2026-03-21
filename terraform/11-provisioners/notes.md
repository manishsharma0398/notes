# Chapter 11 — Provisioners — Revision Notes

## 1. Provisioners run after resource creation/destruction — they are not plannable

- `terraform plan` only tells you *that* a provisioner will run — not what it will change. No preview is possible.
- Provisioners have no state tracking: side effects (packages installed, files written, DNS entries created) are invisible to Terraform after they complete.
- They only run during resource creation and destruction (or when `when = destroy` is set). They do NOT re-run on subsequent `terraform apply` unless the resource is replaced.

## 2. A failed provisioner taints the resource — the next plan will destroy and recreate it

- From source (`provisioners/provisioner.go`): `ProvisionResource` *"blocks until the execution is complete. If the returned diagnostics contain any errors, the resource will be left in a tainted state."*
- A tainted resource is shown in the next `terraform plan` as `"will be destroyed and recreated"`. The provisioner will run again on the recreated resource.
- `on_failure = continue` suppresses tainting — the resource stays usable even if the provisioner script failed. Use only for optional, side-effect-free operations (notifications, logging).

## 3. `remote-exec` requires a stable SSH/WinRM path from the Terraform machine to the resource

- This path almost never exists in production CI: ephemeral runners have no persistent keys, no stable source IP, and no access to private VPCs.
- The `connection` block supports a `bastion_host` for jump-host patterns, but this adds another operational dependency.
- Connection failure → provisioner error → resource tainted. There is no built-in retry for the connection phase.

## 4. Provisioners break idempotency — running `terraform apply` twice is not always safe

- Scripts are not written by Terraform — Terraform cannot know if they are idempotent.
- A resource replacement (taint, drift, `ForceNew` attribute change) causes the provisioner to run again on the fresh resource. If the script assumes a clean state but the environment has leftovers from the previous run, it may fail or double-apply side effects.
- `Stop()` on a running provisioner is non-blocking (source: `provisioners/provisioner.go`) — Terraform signals stop and returns immediately. In-flight SSH commands may keep running on the remote host.

## 5. Prefer alternatives — provisioners are always the wrong long-term answer

- **`user_data` / cloud-init:** runs on first boot, baked into the instance, no SSH required. Best for bootstrapping EC2 instances.
- **AWS Systems Manager Run Command:** push commands to instances post-creation without SSH, with execution logs and retry semantics.
- **Packer:** build an AMI with all software pre-installed. Terraform only manages the AMI reference — the instance starts fully configured.
- **Separate CI/CD step:** post-apply scripts (database migrations, smoke tests) belong in the pipeline, not in Terraform.
