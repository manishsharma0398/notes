# Chapter 13: AWS Secrets Management

Every serious application requires secrets: Database passwords, third-party API keys (like Stripe or SendGrid), or TLS certificates. Storing these securely in Infrastructure-as-Code is notoriously difficult because Terraform compiles everything into a single, unencrypted local JSON file called the `.tfstate`.

---

## 1. The cardinal rule of Terraform Secrets
**NEVER hardcode secrets in `main.tf`, `variables.tf`, or `terraform.tfvars`.**

If you write `api_key = "1234abc"`, it is immediately tracked by git and pushed to your source repository for anyone to discover.

### The `sensitive = true` Illusion
Terraform provides a flag for variables:
```hcl
variable "db_password" {
  type      = string
  sensitive = true
}
```
* **What it does:** It prevents Terraform from printing the password to the terminal `stdout` when running `terraform apply`.
* **What it DOES NOT do:** It does *not* encrypt the password. It is still written in plain, readable text into `.terraform.tfstate`. Anyone who can access the S3 backend bucket where the state is stored can instantly read all your database passwords.

---

## 2. AWS Parameter Store vs. Secrets Manager

There are two primary services in AWS for storing secrets.

### AWS Systems Manager (SSM) Parameter Store
*   **Best for:** API Keys, configuration strings, URLs, standard passwords.
*   **Cost:** "Standard" parameters are 100% free. "Advanced" are extremely cheap.
*   **Security:** Supports `SecureString` which encrypts the value using KMS.
*   **Terraform Resources:** `aws_ssm_parameter` and `data.aws_ssm_parameter`.

### AWS Secrets Manager
*   **Best for:** RDS Database credentials that require automatic rotation.
*   **Cost:** More expensive ($0.40 per secret per month).
*   **Security:** Automatically integrates with RDS/Aurora to rotate passwords on a schedule (e.g., every 30 days) entirely without human intervention.
*   **Terraform Resources:** `aws_secretsmanager_secret` and `aws_secretsmanager_secret_version`.

### Industry Standard Default:
Unless you explicitly need automatic AWS-managed database password rotation, **use SSM Parameter Store `SecureString` because it is free and performs exactly the same function.**

---

## 3. The Golden Workflow (How to safely inject secrets)

To keep your code and your `.tfstate` secure, follow this workflow:

1.  **Creation (AWS Console):** A human manually logs into the AWS UI and securely types the API key into SSM Parameter Store just one time (e.g., creating `/prasaarit/stg/stripe_key`).
2.  **Referencing (Terraform Data Source):** Your Terraform code uses a `data` block to dynamically read the secret out of AWS directly into memory during runtime.
3.  **Execution (Terraform Resource):** Terraform passes that in-memory secret to the Lambda environment variable.

*Even though the secret is still stored in the state file, it guarantees the secret is never checked into your GitHub repository.*
