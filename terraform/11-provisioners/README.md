# Chapter 11 — Provisioners (Last Resort)

## Mental Model

**Problem this solves:** Terraform manages cloud resources via provider APIs. Sometimes the resource that Terraform creates is just the starting point — you also need to bootstrap software on it (install packages, run a configuration script, push a file). The cloud provider's API has no concept of "run this script on the instance."

Provisioners are Terraform's escape hatch: after a resource is created or destroyed, run an arbitrary script — either locally (on the machine running Terraform) or remotely (on the resource itself via SSH or WinRM).

```
  Normal Terraform flow              With a provisioner
  ──────────────────                 ──────────────────────────────
  plan → apply                       plan → apply
         ↓                                  ↓
  [AWS API: CreateInstance]          [AWS API: CreateInstance]
         ↓                                  ↓ (instance now exists)
  Resource in state ✓               [provisioner: remote-exec]
                                    $ sudo apt install nginx
                                    $ systemctl start nginx
                                           ↓
                                    Resource in state ✓ (if script succeeds)
                                    Resource TAINTED    (if script fails)
```

> **Why "last resort":** Provisioners break nearly every guarantee Terraform provides. They are not idempotent, not plannable, not part of the provider protocol, and their success is not tracked in state. The Terraform team officially recommends against them for all but the most exceptional cases.

---

## Topic 1 — `local-exec`: Scripts on the Terraform Machine

### Mechanism

`local-exec` runs a command on the machine where `terraform apply` is executing — your laptop, a GitLab runner, a GitHub Actions worker.

```hcl
resource "aws_instance" "web" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = "t3.micro"

  provisioner "local-exec" {
    command = "aws ec2 wait instance-running --instance-ids ${self.id}"
    # Runs on the Terraform machine, not on the EC2 instance
  }
}
```

### What Terraform Guarantees (from source: `provisioners/provisioner.go`)

From the `ProvisionResource` interface comment:
> *"ProvisionResource blocks until the execution is complete. If the returned diagnostics contain any errors, the resource will be left in a **tainted** state."*

- `local-exec` **blocks** the `apply` until the command exits.
- The exit code matters: non-zero exit → provisioner error → resource is tainted.
- A tainted resource is marked in state as `"status": "tainted"`. On the next `terraform plan`, Terraform shows it as "will be destroyed and recreated." The provisioner will run again on recreation.

### Failure Modes

**Failure 1 — Non-idempotent script:**
```bash
# WRONG — runs on every recreation
command = "aws s3 mb s3://my-unique-bucket-name"
# Second apply: "make bucket: BucketAlreadyOwnedByYou" → tainted again → loop
```

**Failure 2 — Environment mismatch:**
The `local-exec` command runs with the environment of the Terraform process. In a GitLab runner (Docker container), your `~/.aws/config` profile, `$HOME/.ssh/known_hosts`, or custom tools may not be present. The same HCL that works on your laptop silently fails in CI.

**Failure 3 — Partial tainting without cleanup:**
If the resource was created but the provisioner failed:
- The resource EXISTS in AWS
- The resource is TAINTED in state
- Next `terraform plan` shows a replacement (destroy + create)
- The destroy runs, the new instance is created, and the provisioner runs again

If the provisioner script put data on the instance (files, database rows, DNS records), that data is now orphaned when Terraform destroys the "tainted" instance.

### `on_failure` Attribute

```hcl
provisioner "local-exec" {
  command    = "notify-ops.sh ${self.id}"
  on_failure = continue   # Default is "fail" — taint the resource and abort
  # "continue" means: if the script fails, log it but don't taint the resource
}
```

Use `on_failure = continue` only for notification/side-effect provisioners where failure is acceptable.

---

## Topic 2 — `remote-exec` and `file`: Scripts on the Resource

### Mechanism

`remote-exec` SSHs (or WinRMs) into the newly created resource and runs commands. `file` copies a local file to the remote resource.

```hcl
resource "aws_instance" "web" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = "t3.micro"
  key_name      = aws_key_pair.deployer.key_name

  # SSH connection config
  connection {
    type        = "ssh"
    user        = "ec2-user"
    private_key = file("~/.ssh/id_rsa")
    host        = self.public_ip
  }

  # Copy a config file to the instance
  provisioner "file" {
    source      = "configs/nginx.conf"
    destination = "/tmp/nginx.conf"
  }

  # Run commands on the instance
  provisioner "remote-exec" {
    inline = [
      "sudo yum install -y nginx",
      "sudo cp /tmp/nginx.conf /etc/nginx/nginx.conf",
      "sudo systemctl enable nginx",
      "sudo systemctl start nginx",
    ]
  }
}
```

### What Terraform Guarantees

- Terraform establishes the SSH/WinRM connection before running the provisioner. If the connection fails (instance not yet accepting SSH, security group blocks port 22), the provisioner errors and the resource is tainted.
- There is no built-in retry for connection establishment across the provisioner execution. If you need to wait for SSH to be ready, you must add a `timeouts` block or use a `local-exec` with a polling loop before the `remote-exec`.
- `Stop()` (the interface method called on Ctrl+C) is **non-blocking** — Terraform signals the provisioner to stop but does not wait for in-flight scripts to terminate. The SSH session may remain running on the remote host.

### Why This Breaks in Ephemeral CI Runners

GitLab shared runners / GitHub Actions runners are ephemeral containers with:
- No persistent SSH keys (your `~/.ssh/id_rsa` doesn't exist)
- No stable IP (the runner may NAT through a shared IP your EC2 security group doesn't allow)
- No access to the private network where your EC2 instance lives (VPC with no public IP)

`remote-exec` silently assumes a stable, connected, key-authenticated path from the CI runner to the instance. This path almost never exists in a real production setup.

---

## Topic 3 — `connection` Blocks

```hcl
# Inline connection (on the resource itself)
resource "aws_instance" "web" {
  connection {
    type        = "ssh"
    host        = self.public_ip     # or self.private_ip via bastion
    user        = "ec2-user"
    private_key = file("~/.ssh/id_rsa")   # File read on the Terraform machine
    timeout     = "5m"              # Connection timeout — NOT script timeout
  }
}

# Bastion / jump host pattern
resource "aws_instance" "private" {
  connection {
    type         = "ssh"
    host         = self.private_ip
    user         = "ec2-user"
    private_key  = file("~/.ssh/id_rsa")
    bastion_host = aws_instance.bastion.public_ip
    bastion_user = "ec2-user"
  }
}
```

`bastion_host` is the only semi-useful pattern because it lets provisioners reach private-subnet instances — but it requires a running bastion with a stable public IP and SSH access from the CI runner, which is still a significant operational overhead.

---

## Topic 4 — Why Provisioners Break Idempotency

Idempotency means: running `terraform apply` twice produces the same result. Provisioners break this because:

1. **No plan phase:** Terraform cannot predict what a shell script will do. `terraform plan` shows the provisioner will run, but not what it will change.
2. **No state tracking:** The script's side effects (files written, packages installed, DNS records created) are not recorded in state. Terraform has no idea if they succeeded or drifted.
3. **Re-runs on replacement:** Any lifecycle change that causes resource recreation will re-run the provisioner. If the script isn't written to handle "this already ran," it will fail or double-apply.

```
  First apply:                     Second apply:
  resource created ✓               plan shows: no changes
  provisioner runs ✓               but: provisioner does NOT re-run
                                   (provisioners only run on creation/destruction)

  After a taint + replace:
  old resource destroyed
  new resource created
  provisioner runs AGAIN ← potential double-apply if not idempotent
```

---

## Topic 5 — Alternatives (Prefer These)

| What you want to do | Better alternative |
|---|---|
| Bootstrap EC2 instance config | `user_data` / cloud-init — runs on first boot, tracked by the instance |
| Install packages on EC2 | AWS Systems Manager Run Command — push commands without SSH |
| Configure an EC2 AMI | Packer — bake the AMI with everything; EC2 starts fully configured |
| Wait for a service to be ready | `aws_instance` `timeouts`, or a separate `check` block with a data source |
| Run a one-off migration script | A separate CI/CD job that runs after `terraform apply`, not part of Terraform |
| Copy a config file | Store it in S3, pull it via `user_data` on instance start |

**The golden rule:** if the operation needs to happen every apply, use a provider resource. If it only needs to happen once (on create), use `user_data`. Provisioners are never the cleanest answer.

---

## What Terraform Guarantees (Chapter Summary)

| Concern | Guarantee |
|---|---|
| Script execution | `ProvisionResource` blocks until complete. Non-zero exit → tainted resource |
| Stop behaviour | `Stop()` is non-blocking — Terraform does not wait for the script to finish |
| Idempotency | None. Terraform does not track script side-effects in state |
| Plan visibility | `terraform plan` shows "provisioner will run" — not what the script does |
| Connection retry | No built-in retry. Connection failure → tainted resource |

---

## Source References

- [Provisioners docs](https://developer.hashicorp.com/terraform/language/resources/provisioners/syntax)
- [Provisioners are a Last Resort](https://developer.hashicorp.com/terraform/language/resources/provisioners/syntax#provisioners-are-a-last-resort)
- Source: `internal/provisioners/provisioner.go` — `ProvisionResource` blocks until complete; resource tainted on error; `Stop()` is non-blocking
