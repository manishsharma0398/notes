# Chapter 11 — Provisioners — Examples

## Example 1: `local-exec` — Invoke a Wait Script After EC2 Creation

```hcl
resource "aws_instance" "web" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = "t3.micro"
  tags = { Name = "web-server" }

  # ACCEPTABLE use of local-exec: waiting for the instance to pass status checks
  # before Terraform considers the resource fully created.
  # This is necessary when downstream resources depend on the instance being ready.
  provisioner "local-exec" {
    command = <<-EOT
      aws ec2 wait instance-status-ok \
        --instance-ids ${self.id} \
        --region ${var.aws_region}
    EOT
    # Note: this requires the AWS CLI on the Terraform machine
    # and inherited AWS credentials — it WILL NOT work in most CI setups
    # without explicit credential configuration.
  }
}
```

---

## Example 2: `remote-exec` + `connection` — The Full Anti-Pattern

Shown here to understand what it looks like and why it fails in CI.

```hcl
resource "aws_key_pair" "deployer" {
  key_name   = "deployer-key"
  public_key = file("~/.ssh/id_rsa.pub")   # ← file on Terraform machine, unavailable in CI
}

resource "aws_instance" "web" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = "t3.micro"
  key_name               = aws_key_pair.deployer.key_name
  vpc_security_group_ids = [aws_security_group.allow_ssh.id]  # Must allow 22 from Terraform machine IP

  # The SSH connection configuration
  connection {
    type        = "ssh"
    host        = self.public_ip       # instance needs a public IP — bad for production
    user        = "ec2-user"
    private_key = file("~/.ssh/id_rsa")  # ← not present in CI
    timeout     = "5m"
  }

  # Copy config to instance
  provisioner "file" {
    source      = "configs/app.conf"
    destination = "/tmp/app.conf"
  }

  # Run setup script on instance
  provisioner "remote-exec" {
    inline = [
      "sudo yum install -y nginx",
      "sudo cp /tmp/app.conf /etc/nginx/nginx.conf",
      "sudo systemctl enable --now nginx",
    ]
  }

  # WHY THIS FAILS IN CI:
  # 1. ~/.ssh/id_rsa doesn't exist on a fresh GitLab runner container
  # 2. The runner has no predictable source IP → security group can't allow it
  # 3. The instance may be in a private subnet with no public IP
  # 4. SSH port 22 being open to CI runners is a security violation
}
```

---

## Example 3: The `user_data` Alternative (Preferred)

This replaces the `remote-exec` above without any SSH requirements.

```hcl
resource "aws_instance" "web" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = "t3.micro"
  # No key_name needed — no SSH required

  # user_data runs on instance first boot, as root, no SSH required.
  # Idempotent: if the instance is replaced, user_data runs again and
  # produces the same result.
  user_data = <<-EOT
    #!/bin/bash
    set -euo pipefail
    yum install -y nginx
    cat > /etc/nginx/nginx.conf << 'NGINX'
    events {}
    http {
      server {
        listen 80;
        location / { return 200 "OK"; }
      }
    }
    NGINX
    systemctl enable --now nginx
  EOT

  # user_data changes force replacement — this is correct behaviour.
  # Terraform will destroy the old instance and create a new one with
  # the new bootstrap script. No taint, no mystery.
  lifecycle {
    create_before_destroy = true
  }
}
```

---

## Example 4: `on_failure = continue` — Non-Critical Notifications

```hcl
resource "aws_lambda_function" "processor" {
  function_name = "batch-processor"
  role          = aws_iam_role.lambda.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = data.archive_file.lambda.output_path
}

# Post-creation notification — failure is acceptable
resource "null_resource" "notify_deploy" {
  triggers = {
    function_arn = aws_lambda_function.processor.arn
  }

  provisioner "local-exec" {
    command    = "curl -s -X POST ${var.slack_webhook_url} -d '{\"text\":\"Lambda ${aws_lambda_function.processor.function_name} deployed\"}'"
    on_failure = continue   # If Slack is down, don't taint the Lambda resource
  }
}
```

---

## Example 5: Tainted Resource — State File

```json
// terraform.tfstate — after a failed provisioner
{
  "resources": [{
    "type": "aws_instance",
    "name": "web",
    "instances": [{
      "status": "tainted",          // ← marks the resource as unreliable
      "schema_version": 1,
      "attributes": {
        "id":           "i-0abcd12345",
        "instance_type": "t3.micro",
        "public_ip":    "54.123.456.789"
      }
    }]
  }]
}
```

```bash
# terraform plan output after tainted resource:
# aws_instance.web is tainted, so will be replaced.
  -/+ resource "aws_instance" "web" {
      ~ id = "i-0abcd12345" -> (known after apply) # forces replacement
      ...
    }

# To manually remove the taint without destroying:
terraform untaint aws_instance.web
```
