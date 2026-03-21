# Chapter 12: AWS DynamoDB - Interview Questions

### Q1: You define an `aws_dynamodb_table` in Terraform. The developers tell you the application saves JSON objects that contain fields like `Email`, `Age`, and `Address`. Why don't you define these `attribute` blocks in the Terraform code?
**Answer:**
DynamoDB is fundamentally schema-less. AWS only requires you to rigidly define the attributes that make up the Primary Key (the Partition Key and the Sort Key), or any attributes used in Secondary Indexes. All other data is arbitrary attributes injected dynamically by the application code at runtime. If you try to define standard attributes like `Email` in Terraform when they aren't part of an index, Terraform will throw a validation error.

### Q2: Your company has a DynamoDB table managed by Terraform with `billing_mode = "PROVISIONED"`. The application goes viral, traffic spikes, and users start reporting 500 errors due to `ProvisionedThroughputExceededException`. Without changing the application code, how do you fix this in Terraform?
**Answer:**
The fastest and safest IaC fix is to change `billing_mode = "PAY_PER_REQUEST"` (On-Demand) in the Terraform code, remove the `read_capacity` and `write_capacity` blocks, and run `terraform apply`. This instantly shifts the table entirely over to AWS managed auto-scaling, eliminating the throttling errors. 

If management demands staying on PROVISIONED pricing for cost ceilings, you would need to use Terraform to attach an `aws_appautoscaling_target` and an `aws_appautoscaling_policy` to automatically adjust the WCUs/RCUs based on CloudWatch metrics, which is significantly more complex.

### Q3: You deploy a DynamoDB table in Terraform, and a year later, the engineering team wants to completely change the Partition Key from `UserId` to `EmailAddress` to support a new access pattern. How do you execute this change in Terraform?
**Answer:**
**You cannot.** DynamoDB does not allow you to modify the Primary Key of an existing table once it is created. If you change the `hash_key` in your Terraform code, Terraform will aggressively completely destroy the existing table (deleting all production data) and recreate a brand new, empty table with the new partition key. 

To solve this safely, you must either:
1. Attach a Global Secondary Index (GSI) using `EmailAddress` as the new index hash key via Terraform (which is a non-destructive, safe operation).
2. If the base table truly must change, you must write a complex migration script that reads all data from the old table, translates it, and writes it to a completely new table deployed alongside the old one in Terraform, before switching traffic over.
