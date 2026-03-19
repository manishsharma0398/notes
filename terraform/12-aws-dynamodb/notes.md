# Chapter 12: AWS DynamoDB Cheatsheet

### 1. `aws_dynamodb_table`
**Purpose:** Deploys the NoSQL database table.

**Key Arguments:**
*   `name`: The global name of the table.
*   `billing_mode`: Set to `"PAY_PER_REQUEST"` (On-Demand) or `"PROVISIONED"`.
*   `hash_key`: The partition key attribute name.
*   `range_key`: (Optional) The sort key attribute name.
*   `attribute {}`: Defines the *types* for your keys.
    *   `name`: Must match the `hash_key` or `range_key` exactly.
    *   `type`: "S" (String), "N" (Number), or "B" (Binary). You do *not* define non-key attributes here!

### 2. `aws_dynamodb_table_item`
**Purpose:** Seeds data directly into the table via Terraform. 
**Best Practice:** Rarely used for application data. Mostly used for bootstrapping configuration tables with static control values during `terraform apply`.

---

### Standard Pattern: Serverless On-Demand Table

```hcl
resource "aws_dynamodb_table" "metadata" {
  name         = "my-app-metadata"
  # Use On-Demand to avoid capacity planning and throttling
  billing_mode = "PAY_PER_REQUEST"

  # The Primary Key Definition
  hash_key     = "UserId"
  range_key    = "UploadId"

  # You MUST declare the data types for the keys used above.
  # S = String, N = Number, B = Binary
  attribute {
    name = "UserId"
    type = "S"
  }

  attribute {
    name = "UploadId"
    type = "S"
  }

  # Best Practice: Always tag your databases
  tags = {
    Environment = "Production"
    ManagedBy   = "Terraform"
  }
}
```
