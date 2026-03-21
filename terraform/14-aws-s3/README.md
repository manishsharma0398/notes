# Chapter 09: AWS S3

Amazon Simple Storage Service (S3) is the fundamental object storage service in AWS. It is nearly ubiquitous in modern infrastructure, used for everything from serving static websites and storing application data, to holding the Terraform state file itself.

Over time, Terraform's approach to provisioning S3 buckets has radically evolved reflecting changes in the AWS API, shifting from a monolithic design to a highly modular, decoupled architecture.

---

## 1. The Disaggregation of the `aws_s3_bucket`

In Terraform AWS Provider v3 and earlier, S3 buckets were monolithic. You defined the bucket name, encryption, versioning, and ACLs all inside a single, giant `resource "aws_s3_bucket"` block.

In **AWS Provider v4 and above**, HashiCorp split the bucket into many independent resources. This was done to reflect how the AWS API actually works under the hood (which has separate endpoints for versioning, encryption, etc.) and to prevent massive drifts and conflicts.

To build a standard, secure bucket today, you need *multiple* resources working together:
*   `aws_s3_bucket` (The core bucket shell)
*   `aws_s3_bucket_versioning` (Enables versioning)
*   `aws_s3_bucket_server_side_encryption_configuration` (Forces encryption)
*   `aws_s3_bucket_public_access_block` (Blocks accidental public exposure)

---

## 2. Bucket Policies vs. IAM Policies

In Chapter 08, we learned about **IAM Policies**, which are attached to an Identity (like a Role) and say "This role can write to this specific bucket."

S3 also supports **Resource Policies** (specifically, `aws_s3_bucket_policy`). A bucket policy is attached directly to the bucket itself and says "These identities are allowed to write to me."

**Which one should you use?**
*   **Intra-Account Access:** If the Lambda and the S3 bucket are in the *same* AWS account, you usually only need an IAM Policy on the Lambda role.
*   **Cross-Account Access:** If the Lambda is in Account A, and the bucket is in Account B, you *must* use a Bucket Policy in Account B that explicitly trusts Account A. 
*   **Global Restrictions:** Bucket policies are incredibly useful for enforcing global invariants, such as: *"Deny all uploads to this bucket unless they have AES256 encryption headers."*

---

## 3. The Death of ACLs (Access Control Lists)

Historically, you could use S3 ACLs (like `acl = "private"` or `acl = "public-read"`) to control access to individual objects. 

**AWS now explicitly recommends against using ACLs.** 
Modern S3 bucket design heavily favors **IAM and Bucket Policies** instead. 

When creating an S3 bucket in Terraform today, you should explicitly invoke the `aws_s3_bucket_ownership_controls` resource to set `BucketOwnerEnforced`. This disables all ACLs on the bucket and forces all access control evaluation to go through IAM and Bucket Policies exclusively.

---

## 4. Securing S3 by Default (Block Public Access)

Because S3 configuration errors are one of the leading causes of massive data leaks globally, AWS introduced the "Block Public Access" feature at both the Account and Bucket level. 

In Terraform, it is an industry-standard best practice to always attach an `aws_s3_bucket_public_access_block` to every single bucket you create unless it is explicitly designed to serve a public website.

```hcl
resource "aws_s3_bucket_public_access_block" "example" {
  bucket = aws_s3_bucket.example.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```
