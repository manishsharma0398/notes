# Chapter 02 — Example 03: dynamic blocks
#
# This example uses terraform_data to simulate repeated blocks
# (since aws_security_group needs AWS credentials, we simulate the pattern locally).
#
# EXERCISE:
#   1. terraform init && terraform plan — read the output
#   2. Add a new rule to var.ingress_rules and plan again
#   3. Remove a rule — only that rule changes in the plan
#   4. Try changing a rule's port — observe the update (not replacement)

terraform {
  required_version = ">= 1.4"
}

# ─── PART A: dynamic block simulation with terraform_data ─────────────────────

variable "ingress_rules" {
  description = "Security group ingress rules"
  type = map(object({
    port     = number
    protocol = string
    cidrs    = list(string)
  }))
  default = {
    http = {
      port     = 80
      protocol = "tcp"
      cidrs    = ["0.0.0.0/0"]
    }
    https = {
      port     = 443
      protocol = "tcp"
      cidrs    = ["0.0.0.0/0"]
    }
    admin = {
      port     = 8443
      protocol = "tcp"
      cidrs    = ["10.0.0.0/8"]
    }
  }
}

# Simulate what dynamic blocks do — use for_each on terraform_data
# to represent each ingress rule as a managed resource.
# In real code: this is a `dynamic "ingress"` block inside aws_security_group.
resource "terraform_data" "ingress_rule" {
  for_each = var.ingress_rules

  input = {
    rule_name = each.key
    port      = each.value.port
    protocol  = each.value.protocol
    cidrs     = each.value.cidrs
  }
}

output "ingress_rules_expanded" {
  description = "The ingress rules as they would appear in a security group — key-based identity"
  value = {
    for name, rule in terraform_data.ingress_rule :
    name => {
      from_port   = rule.output.port
      to_port     = rule.output.port
      protocol    = rule.output.protocol
      cidr_blocks = rule.output.cidrs
    }
  }
}

# ─── PART B: What the actual HCL would look like (comments only — requires AWS) ─

# resource "aws_security_group" "api" {
#   name   = "prasaarit-stg-api-sg"
#   vpc_id = var.vpc_id
#
#   dynamic "ingress" {
#     for_each = var.ingress_rules
#     iterator = rule                    # ← rename default iterator "ingress" → "rule"
#
#     content {
#       from_port   = rule.value.port
#       to_port     = rule.value.port
#       protocol    = rule.value.protocol
#       cidr_blocks = rule.value.cidrs
#       description = "Allow ${rule.key}"  # rule.key = "http", "https", "admin"
#     }
#   }
#
#   egress {
#     from_port   = 0
#     to_port     = 0
#     protocol    = "-1"
#     cidr_blocks = ["0.0.0.0/0"]
#   }
# }

# ─── PART C: The for_each-known-at-plan-time trap ─────────────────────────────

# THE FOLLOWING WOULD FAIL if the keys came from resource outputs:
#
# resource "terraform_data" "marker" {}
#
# resource "terraform_data" "derived_rule" {
#   # ← ERROR: keys depend on resource output, not known at plan time
#   for_each = toset(terraform_data.marker.output)  # (known after apply)
# }
#
# SOLUTION: always derive for_each keys from variables or locals — not resource outputs.
