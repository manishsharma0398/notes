# Chapter 12: AWS DynamoDB

Amazon DynamoDB is a fully managed, serverless, key-value NoSQL database designed to run high-performance applications at any scale. Paired with AWS Lambda and API Gateway, it forms the classic AWS Serverless Triumvirate.

In Terraform, provisioning DynamoDB tables is straightforward, but defining the schema and capacity model requires careful architectural planning before you run `terraform apply`.

---

## 1. Defining the Schema Design

Unlike relational databases (PostgreSQL/MySQL) where you define every column in Terraform, DynamoDB is schema-less. **You only define the Primary Key attributes in Terraform.**

A Primary Key in DynamoDB can be:
1.  **Partition Key (Hash Key) only:** A single attribute that uniquely identifies an item (e.g., `UserId`).
2.  **Composite Key (Partition Key + Sort Key):** Two attributes combined. The Partition Key groups data, and the Sort Key (Range Key) orders it within that group (e.g., `UserId` + `UploadTimestamp`).

In Terraform, you define these keys in the `attribute` blocks, and declare which one is which in the `hash_key` and `range_key` arguments.

---

## 2. Capacity Modes: Provisioned vs. On-Demand

DynamoDB forces you to choose how you pay for read and write throughput via the `billing_mode` argument. This is the most important financial decision in your IaC.

### Provisioned (The Default)
*   **How it works:** You explicitly dictate how many Read Capacity Units (RCUs) and Write Capacity Units (WCUs) the table supports per second.
*   **Terraform specific:** You must provide the `read_capacity` and `write_capacity` arguments. 
*   **Pros/Cons:** Cheaper for highly predictable workloads. If you guess incorrectly and traffic spikes, AWS will throttle (reject) requests, crashing your application.

### Pay-Per-Request (On-Demand)
*   **How it works:** AWS completely manages the scaling. You pay exactly per read/write request, and AWS instantly scales the table to accommodate any traffic spike.
*   **Terraform specific:** Set `billing_mode = "PAY_PER_REQUEST"`. You omit the `read_capacity` and `write_capacity` arguments entirely.
*   **Pros/Cons:** Slightly more expensive per-read, but mathematically cheaper for unpredictable, spiky, or new workloads because you never pay for idle capacity. **This is the industry standard for modern serverless architectures.**

---

## 3. Global Secondary Indexes (GSIs)

If you need to query the database by an attribute that is *not* your Primary Key (e.g., your primary key is `UserId`, but you want to find all uploads by `Status = 'Completed'`), you must attach a Global Secondary Index (GSI).

GSIs are essentially separate tables that DynamoDB keeps in sync for you. In Terraform, they are declared using the `global_secondary_index` block inside the `aws_dynamodb_table` resource, where you define the new proxy Hash Key and Range Key.
