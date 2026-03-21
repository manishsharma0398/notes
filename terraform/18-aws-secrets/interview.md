# Chapter 13: Secrets Management - Interview Questions

### Q1: You mark a variable `db_password` as `sensitive = true`. An auditor clones your GitHub repository and runs `terraform apply`. Is your database password secure? Explain your reasoning.
**Answer:**
No, the password is not fully secure. While `sensitive = true` prevents the password from being printed to the console output (stdout) during `terraform apply` or `terraform plan`, Terraform still fundamentally tracks all deployed resources in the `.terraform.tfstate` file. The password will be written into the `tfstate` JSON file in plain, unencrypted text. If the team's remote S3 backend bucket is compromised, or if a developer's laptop with a local state file is stolen, the password is exposed.

### Q2: You need to pass an API key (like a Stripe token) to an AWS Lambda function via Terraform. Explain an architecture that prevents the key from being committed to Git.
**Answer:**
The standard practice is to decouple the *storage* of the secret from the *provisioning* of the infrastructure. 

First, manually enter the API key into AWS Systems Manager (SSM) Parameter Store as a `SecureString` via the AWS UI. Then, in the Terraform code, use a `data "aws_ssm_parameter"` block to fetch the key dynamically by its name. Finally, inject `data.aws_ssm_parameter.stripe_key.value` into the `environment { variables = {} }` block of the `aws_lambda_function`. This guarantees the plain text secret is never written into the `.tf` source code files tracked by Git.

### Q3: When spinning up a brand new relational database (`aws_db_instance`) in Terraform, how do you handle setting the master password if you are not allowed to type the password in the `terraform.tfvars` file?
**Answer:**
You use the HashiCorp `random` provider. You declare a `random_password` resource with the required length and character constraints. You then pass `random_password.db_pass.result` directly into the `password` argument of the `aws_db_instance`. The human never knows the password. If an application needs it later, you also take that `random_password` output and write it to an `aws_secretsmanager_secret_version` resource, so other microservices can retrieve the database password directly from the vault at runtime.
