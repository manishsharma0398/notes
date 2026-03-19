# Chapter 08: AWS Provider and IAM

This chapter covers the foundational layer of any AWS deployment in Terraform: **Identity and Access Management (IAM)** and the AWS Provider itself. Before you can provision buckets, databases, or compute resources, you must understand how Terraform authenticates with AWS and how to grant your infrastructure the precise permissions it needs to operate.

---

## 1. The AWS Provider

The `hashicorp/aws` provider is the plugin Terraform uses to translate your HCL `.tf` code into AWS API calls.

### Provider Configuration & Authentication

To deploy resources, Terraform needs AWS credentials. While you *can* hardcode them in the provider block, this is a severe security risk. 

**Best Practices for Authentication:**
1.  **Local Development:** Use the AWS CLI (`aws configure`) or AWS SSO (`aws sso login`) to write credentials to `~/.aws/credentials`. Terraform will automatically find and use them.
2.  **Environment Variables:** Export `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
3.  **CI/CD Pipelines (The Gold Standard):** Use OpenID Connect (OIDC) to assume an IAM Role securely without any long-lived static credentials (as covered in Chapter 07).

### Default Tags

A critical feature of the AWS Provider is `default_tags`. Instead of manually adding `{ Environment = "prd", Project = "my-app" }` to every single resource, you can define them once at the provider level.

```hcl
provider "aws" {
  region = "us-east-1"
  
  default_tags {
    tags = {
      Environment = "Production"
      ManagedBy   = "Terraform"
    }
  }
}
```

---

## 2. Infrastructure IAM: Roles vs. Users

When building infrastructure, you should almost entirely avoid **IAM Users**. Users are long-term credentials meant for human beings.

Infrastructure should rely exclusively on **IAM Roles**.
*   **What is a Role?** A role is an identity with permission policies that determine what the identity can and cannot do. However, a role does not have standard long-term credentials (password or access keys). Instead, it is *assumed* temporarily.
*   **Who assumes roles?** EC2 instances, Lambda functions, CI/CD pipelines, and even cross-account human users.

---

## 3. The Two Halves of an IAM Role in Terraform

Understanding IAM in Terraform requires mastering the distinction between the two core components of a Role: **Trust Policies** and **Permission Policies**.

### Part 1: The Trust Policy (Assume Role Policy)

The Trust Policy answers the question: **"Who or what is allowed to assume this role?"**

In Terraform, you build this using an `aws_iam_policy_document` data source and attach it to the `aws_iam_role` resource via the `assume_role_policy` argument.

```hcl
# 1. Define WHO can assume the role (The Trust Policy)
data "aws_iam_policy_document" "lambda_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# 2. Create the Role, attaching the Trust Policy
resource "aws_iam_role" "my_role" {
  name               = "example-execution-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_trust.json
}
```

### Part 2: The Permission Policy

The Permission Policy answers the question: **"Once the role is assumed, what AWS APIs is it allowed to call?"**

You define the permissions using another `aws_iam_policy_document`, create an `aws_iam_policy` resource, and then bind it to the role using `aws_iam_role_policy_attachment`.

```hcl
# 3. Define WHAT the role can do (The Permission Policy)
data "aws_iam_policy_document" "s3_access" {
  statement {
    actions   = ["s3:PutObject"]
    resources = ["arn:aws:s3:::my-bucket-name/*"] # Least privilege!
  }
}

# 4. Create the Policy resource
resource "aws_iam_policy" "my_policy" {
  name   = "example-s3-write-policy"
  policy = data.aws_iam_policy_document.s3_access.json
}

# 5. Bind the Policy and the Role together
resource "aws_iam_role_policy_attachment" "attach" {
  role       = aws_iam_role.my_role.name
  policy_arn = aws_iam_policy.my_policy.arn
}
```

---

## 4. The Principle of Least Privilege in IaC

Terraform makes it extremely easy to grant broad permissions (e.g., `"s3:*"` on `"*"` resources). **Do not do this.**

Infrastructure-as-Code is the perfect place to enforce Least Privilege because you can dynamically reference the exact ARNs (Amazon Resource Names) of the infrastructure you are building.

**Wrong (Broad Access):**
```hcl
  statement {
    actions   = ["s3:*"]
    resources = ["*"]
  }
```

**Right (Least Privilege via Terraform References):**
```hcl
  statement {
    actions   = ["s3:PutObject", "s3:GetObject"]
    # Terraform dynamically resolves the ARN of the bucket it just created!
    resources = ["${aws_s3_bucket.my_data_bucket.arn}/*"] 
  }
```

By referencing the specific `aws_s3_bucket` resource, Terraform builds a dependency graph. It guarantees the bucket is created *before* the IAM policy is finalised, ensuring tight, secure, deployment pipelines.
