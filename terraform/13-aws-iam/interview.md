# Chapter 08: AWS IAM - Interview Questions

### Q1: In Terraform, what is the difference between an `aws_iam_role` and an `aws_iam_policy`, and how do you bind them together?
**Answer:** 
An `aws_iam_role` defines the identity itself and includes the "Trust Policy" (`assume_role_policy`), which dictates exactly *who* or *what* is allowed to assume the role (e.g., an AWS Lambda service, or a CI/CD OIDC provider). 

An `aws_iam_policy` defines the "Permissions Boundary"—the explicit list of AWS APIs (like `s3:GetObject`) the role is allowed to call on specific resources. 

To bind them together, Terraform uses a third resource: the `aws_iam_role_policy_attachment`, which takes the name of the role and the ARN of the policy.

### Q2: Why is it highly recommended to use the `aws_iam_policy_document` data source instead of writing raw JSON paths inside your Terraform code?
**Answer:** 
Using `aws_iam_policy_document` provides HCL syntax validation during `terraform plan`. If you misspell a block or forget a comma in raw JSON, Terraform won't catch it until `apply`, resulting in a failure against the AWS API. Furthermore, the data source allows you to dynamically inject Terraform variables and resource attributes (like `aws_s3_bucket.my_bucket.arn`) gracefully without complex string interpolation, keeping the code cleaner and less error-prone.

### Q3: You are using Terraform to deploy an IAM Role and an EC2 instance that assumes that role. When you run `terraform apply`, it sometimes fails saying "InvalidParameterValue: IAM Role [Name] cannot be assumed by EC2." If you rerun `apply`, it works. What is causing this, and how do you fix it?
**Answer:**
This is caused by **AWS eventual consistency delay**. When Terraform creates the IAM Role, the AWS IAM API returns "Success." Terraform immediately moves to create the EC2 instance. However, IAM metadata can take 10-30 seconds to propagate across all AWS regions. The EC2 API checks if the role exists, finds it hasn't propagated to that specific region yet, and throws an error.

To fix this, you can use the Terraform `time_sleep` resource, making the EC2 instance depend on a 30-second delay that itself depends on the IAM role creation. Alternatively, the standard AWS Provider often has built-in retries for these specific eventual consistency errors, but complex nested dependencies still occasionally require explicit delays.

### Q4: Explain the "Circular Dependency" problem when building AWS Serverless architectures in Terraform (e.g., a Lambda function accessing a DynamoDB table, which triggers another stream).
**Answer:**
A circular dependency occurs in Terraform's graph when Resource A requires data from Resource B to be created, but Resource B requires data from Resource A. 

A classic IAM/Serverless example: 
1. The IAM `aws_iam_policy` needs the ARN of the `aws_lambda_function` to lock down permissions.
2. The `aws_lambda_function` requires the Execution Role ARN (`aws_iam_role`) before it can be created.
3. The Role needs the policy attached to function. 

To break this cycle, standard IaC practice is to rely on predictable ARN construction. Instead of waiting for the Lambda to output its ARN, you construct the ARN dynamically in your local variables using the Account ID and Region data sources (e.g., `arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:${var.function_name}`). You feed this predicted ARN into the IAM policy, allowing the policy and role to be created *first*, which then allows the Lambda to be built.
