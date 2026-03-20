# Chapter 02 — Examples Index

All examples use `terraform_data` (Terraform Core built-in) — **no AWS credentials needed**. Run each one with `terraform init && terraform apply`.

---

## 01 — count vs for_each identity trap (`01-count-vs-foreach/main.tf`)

**What it demonstrates**: The index-shift problem when using `count` with a list.

```bash
cd 01-count-vs-foreach
terraform init && terraform apply

# Then remove "/upload" from var.routes_count and re-plan:
# terraform plan → observe 3 resources changing for 1 removal

# Switch to the for_each version:
# Only route["/upload"] is destroyed. Others untouched.
```

Key question: *Why does Terraform want to replace MORE resources than I removed?*

---

## 02 — Variables, types, validation, locals (`02-variables-locals/main.tf`)

**What it demonstrates**: Variable precedence, `optional()`, validation blocks, locals as derived constants.

```bash
cd 02-variables-locals
terraform init && terraform apply

# Test validation:
terraform apply -var="stage=invalid"      # validation error
terraform apply -var="lambda_timeout=950" # validation error

# Test precedence:
TF_VAR_stage=prod terraform plan          # env var beats default
terraform apply -var="stage=prod"         # CLI beats tfvars
```

Key question: *Six knobs control variable values — which one wins?*

---

## 03 — `dynamic` blocks for nested rule generation (`03-dynamic-blocks/main.tf`)

**What it demonstrates**: Variable security group ingress rules via `dynamic`, with annotated real `aws_security_group` HCL.

```bash
cd 03-dynamic-blocks
terraform init && terraform apply

# Add a new rule to var.ingress_rules and re-plan:
# Only the new rule is added — others unchanged (key-based identity)

# Remove a rule and re-plan:
# Only that rule's terraform_data instance is destroyed
```

Key question: *When does a `dynamic` block obscure intent more than it saves code?*

---

## 04 — `terraform_data` for triggers and value storage (`04-terraform-data/main.tf`)

**What it demonstrates**: File hash tracking, `triggers_replace` re-execution, `input`/`output` value storage, comparison with `null_resource`.

```bash
cd 04-terraform-data
touch dummy_payload.zip && terraform init && terraform apply

# Change the file and re-plan:
echo "v2" >> dummy_payload.zip
terraform plan  # observe: zip_tracker replaces → post_deploy replaces → local-exec runs
terraform apply
```

Key question: *What is the difference between `terraform_data` and an ephemeral resource?*

---

## 05 — `for` expressions and built-in functions (`05-for-expressions-functions/main.tf`)

**What it demonstrates**: `for` list/map transforms, filters, CIDR math (`cidrsubnet`, `cidrhost`), `try()`, type conversions.

```bash
cd 05-for-expressions-functions
terraform init && terraform apply
# Read every output — trace how each computed value derives from the input

# Experiment:
# Add a new lambda_config entry and predict the output before applying
# Modify vpc_cidr to "192.168.0.0/16" and predict the new subnet values
```

Key question: *What is the difference between a `for` expression and `for_each` on a resource?*
