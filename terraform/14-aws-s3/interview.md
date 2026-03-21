# Chapter 09: AWS S3 - Interview Questions

### Q1: Why did Terraform split the `aws_s3_bucket` resource into multiple independent resources (like `aws_s3_bucket_versioning`, `aws_s3_bucket_policy`) in Provider v4?
**Answer:**
This architectural shift was done to align with how the AWS API works. The AWS S3 API treats the bucket, its versioning state, and its encryption rules as completely separate endpoints. 

In older versions of the Terraform provider, pulling a dozen different API endpoints into a single resource caused severe drift detection issues and race conditions. By splitting them, Terraform can manage, update, and track the state of individual bucket features much more reliably. It also makes constructing modular S3 wrappers substantially easier.

### Q2: You have an IAM Role with `s3:*` permissions on a bucket, but the bucket has an `aws_s3_bucket_policy` that explicitly denies `s3:PutObject` for everyone. Will the IAM Role be able to upload a file?
**Answer:**
No. In AWS IAM evaluation logic, **an explicit DENY always trumps any ALLOW.** Regardless of how broad the IAM Policy attached to the role is, the bucket's Resource Policy acts as an absolute block. This is why Bucket Policies are highly recommended for enforcing strict security boundaries (like enforcing SSL/TLS for all requests).

### Q3: When writing a Terraform module to create an S3 bucket, standard practice is to use `random_id` or your `aws_caller_identity` (account ID) in the bucket name. Why?
**Answer:**
S3 bucket names reside in a single, global namespace across all AWS customers worldwide. "my-project-bucket" is almost certainly already taken by someone else on the planet. If you hardcode generic bucket names in your Terraform, the `apply` will fail with a `BucketAlreadyExists` error. Adding randomized suffixes or account IDs mathematically ensures uniqueness and prevents deployment failures.

### Q4: If you attempt to run `terraform destroy` on an S3 Bucket that currently contains files, what happens? How do you force Terraform to destroy the bucket?
**Answer:**
Terraform will fail the `destroy` operation. The AWS API refuses to delete an S3 bucket if it is not completely empty. 

You can bypass this in Terraform by setting `force_destroy = true` inside the `aws_s3_bucket` block. When enabled, Terraform will aggressively empty all objects and object versions out of the bucket via the API *before* attempting to delete the bucket shell. This should be used strictly in sandbox environments and carefully monitored in production setups.
