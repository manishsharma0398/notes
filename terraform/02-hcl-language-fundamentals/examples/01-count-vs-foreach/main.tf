# Chapter 02 — Example 01: count vs for_each identity trap
#
# This example requires NO cloud credentials.
# terraform_data is built into Terraform Core — no provider block needed.
#
# EXERCISE:
#   1. terraform init && terraform apply
#   2. Note the resource addresses: terraform state list
#   3. Remove "/upload" from var.routes_count
#   4. terraform plan — observe the cascading replacements
#   5. Switch to using routes_foreach and observe only "/upload" is destroyed

# ─── PART A: count (dangerous for lists) ────────────────────────────────────

variable "routes_count" {
  description = "API routes managed with count — index-based identity"
  type        = list(string)
  default     = ["/upload", "/metadata", "/delete"]
}

# count resources are identified by INDEX: route_count[0], route_count[1], ...
# Remove the first element and ALL resources shift index.
resource "terraform_data" "route_count" {
  count = length(var.routes_count)

  input = {
    path  = var.routes_count[count.index]
    index = count.index
  }
}

output "count_addresses" {
  description = "Resource addresses when using count — they shift on removal"
  value = [
    for i, r in terraform_data.route_count :
    "${i} → ${r.output.path}"
  ]
}

# ─── PART B: for_each (safe for lists) ───────────────────────────────────────

variable "routes_foreach" {
  description = "API routes managed with for_each — key-based identity"
  type        = list(string)
  default     = ["/upload", "/metadata", "/delete"]
}

# for_each resources are identified by KEY: route_foreach["/upload"], etc.
# Remove "/upload" and ONLY that resource is destroyed.
resource "terraform_data" "route_foreach" {
  for_each = toset(var.routes_foreach)

  input = {
    path = each.value
  }
}

output "foreach_addresses" {
  description = "Resource addresses when using for_each — stable keys"
  value       = { for k, v in terraform_data.route_foreach : k => v.output.path }
}
