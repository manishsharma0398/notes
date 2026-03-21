# Chapter 10: AWS Lambda

AWS Lambda is the cornerstone of serverless computing on AWS. It allows you to run code without provisioning or managing servers. In Terraform, deploying Lambda functions is straightforward, but managing the underlying source code updates introduces unique CI/CD architectural challenges.

---

## 1. The `aws_lambda_function` Resource

The primary resource for deploying serverless compute is `aws_lambda_function`. 
To define a Lambda function, you must provide three non-negotiable elements:
1.  **The Code:** A `.zip` file of your application code, or an Amazon ECR container image URI.
2.  **The Handler:** The entry-point function or method in your code that Lambda executes (e.g., `index.handler` for Node.js or `main.lambda_handler` for Python).
3.  **The Execution Role:** An IAM Role ARN (which we built in Chapter 08) that grants the Lambda function permissions to write to CloudWatch logs, access S3, etc.

---

## 2. Managing Source Code in Terraform

The most debated topic regarding Lambda in Terraform is **how you should upload the application code.** There are two primary schools of thought:

### Approach A: The Terraform `archive_file` Method (Best for simple projects)
Terraform provides a `data "archive_file"` source that can automatically zip a local directory of code on your machine and upload it to AWS during `terraform apply`.
*   **Pros:** Extremely simple. "Everything in one place."
*   **Cons:** Coupling application code with infrastructure code means every time a developer changes a single line of JavaScript/Python, they must run a full `terraform apply`. This breaks the separation of concerns between Dev and Ops.

### Approach B: The CI/CD "Dummy Code" Method (Best for Enterprise)
The infrastructure repository creates the Lambda using a tiny "dummy" zip file (e.g., a 1KB zip containing an empty `index.js`). 
Later, a completely separate application CI/CD pipeline builds the real code, zips it, and uses the AWS CLI (`aws lambda update-function-code`) to push the real code over the dummy code.
*   **Pros:** Decouples App updates from Infrastructure updates. Developers can deploy code 50 times a day without ever running Terraform.
*   **Cons:** Introduces "Drift." When Terraform runs again, it notices the real code on AWS is different from the dummy zip file it has locally. You must explicitly tell Terraform to `ignore_changes = [source_code_hash]` to stop it from overwriting the real code.

---

## 3. Lambda Layers (`aws_lambda_layer_version`)

Lambda functions have a hard 250MB size limit for unzipped deployment packages. If you are packaging massive libraries (like NumPy, Pandas, or heavy Node.js `node_modules`), you should use **Lambda Layers**.

A Layer is a zip archive that contains libraries, a custom runtime, or other dependencies. You can attach up to 5 layers to a Lambda function. In Terraform, layers are created via `aws_lambda_layer_version`, and then referenced inside the `aws_lambda_function` using the `layers = [aws_lambda_layer_version.my_layer.arn]` argument.

---

## 4. Environment Variables

Lambda allows you to inject configuration into your code securely via environment variables. In Terraform, these are passed using the `environment` block.

```hcl
environment {
  variables = {
    DATABASE_URL  = aws_dynamodb_table.db.id
    API_KEY       = data.aws_ssm_parameter.key.value
    NODE_ENV      = "production"
  }
}
```

**Security Warning:** Do not put raw, unencrypted secrets (like passwords or API keys) directly in plain text in your Terraform HCL. Doing so commits the secret to your Git repository and your `.tfstate` file in plain text. Use AWS Secrets Manager or Parameter Store (`data "aws_ssm_parameter"`) to fetch secrets dynamically at runtime, or inject the secret ARNs as environment variables for the Lambda to fetch itself.
