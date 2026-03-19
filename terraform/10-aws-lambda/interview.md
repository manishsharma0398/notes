# Chapter 10: AWS Lambda - Interview Questions

### Q1: What is the purpose of the `source_code_hash` argument in `aws_lambda_function`, and what happens if you forget to include it?
**Answer:**
The `source_code_hash` argument (usually populated by `data.archive_file.my_zip.output_base64sha256`) is the mechanism Terraform uses to detect if the actual application code inside the ZIP file has changed. 

If you just specify the `filename` (e.g., `src.zip`) but omit the `source_code_hash`, Terraform will see that "src.zip" is still attached to the function and will assume no changes occurred. It will **not** redeploy your function, even if you heavily modified the files inside the zip. The hash forces Terraform to realize the zip contents are different, triggering an API update.

### Q2: Your company wants to separate Infrastructure (managed by Terraform) from Application Code (managed by a Node.js GitHub Action). How do you prevent Terraform from aggressively rolling back the developer's new Node.js code every time you run `terraform apply`?
**Answer:**
This is a classic "State Drift" problem. You solve this using the `lifecycle` block inside the `aws_lambda_function` resource. Specifically, you define `ignore_changes = [source_code_hash, last_modified, filename]`. 

This tells Terraform: "Manage the RAM settings, standard Environment Variables, and the IAM Role of this Lambda, but ignore any discrepancies you see regarding the actual ZIP file payload." This perfectly decouples the infrastructure from the application lifecycle.

### Q3: A developer complains that their Terraform-deployed Lambda function works perfectly, but they cannot find any console output or errors in CloudWatch Logs. What Terraform configuration is likely missing?
**Answer:**
This is almost certainly an IAM permissions issue. In Terraform, Lambda functions require explicit permissions to write to CloudWatch. The required Execution Role must have an attached `aws_iam_policy` that grants `logs:CreateLogGroup`, `logs:CreateLogStream`, and `logs:PutLogEvents`. If these permissions are missing, the Lambda executes successfully, but Silently drops all logging output because the AWS API denies it permission to write to CloudWatch.

### Q4: Explain the impact of "Cold Starts" on AWS Lambda, and how you can mitigate them using Terraform.
**Answer:**
A Cold Start occurs when AWS has to provision a brand-new container to execute a Lambda function because there are no currently "warm" idle containers available. This process (allocating compute, downloading the zip, starting the runtime engine) adds significant latency to the request (sometimes several seconds).

To mitigate this in Terraform, you can configure AWS **Provisioned Concurrency**. You use the `aws_lambda_provisioned_concurrency_config` resource to instruct AWS to permanently keep a specified number of execution environments initialized and hyper-ready to accept immediate traffic, entirely eliminating the cold start penalty for that baseline volume of traffic.
