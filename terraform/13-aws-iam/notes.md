# Chapter 08: AWS IAM Cheatsheet

### 1. `data "aws_iam_policy_document"`
**Purpose:** Generates a JSON policy document. Superior to heredoc JSON strings (`<<EOF...EOF`) because Terraform validates the syntax at `plan` time.

**Key Arguments:**
*   `statement {}`: Block representing a single policy rule.
    *   `effect`: "Allow" or "Deny" (defaults to "Allow").
    *   `actions`: List of AWS API actions (e.g., `["s3:PutObject", "dynamodb:PutItem"]`).
    *   `resources`: List of specific ARNs the actions apply to (`["arn:aws:s3:::my-bucket/*"]`).
    *   `principals {}`: (Used *only* in Trust Policies or Resource-based policies like S3 Bucket Policies) Defines the entity assuming the role or accessing the resource.

### 2. `aws_iam_role`
**Purpose:** Creates the Identity.
**Key Connection:** Must receive a JSON string for `assume_role_policy` (the Trust Policy) directly upon creation.

### 3. `aws_iam_policy`
**Purpose:** Creates a customer-managed permission policy in AWS.
**Key Connection:** Must receive a JSON string for `policy` (the Permission Policy) directly upon creation.

### 4. `aws_iam_role_policy_attachment`
**Purpose:** The "glue" resource. Attaches a Permission Policy (created above, or an AWS-managed one) to the IAM Role.

---

### Standard Pattern: The "Holy Trinity" of Terraform IAM
Almost every IAM deployment requires these three resources working together:

```hcl
# 1. THE ROLE (Who it is / Trust)
resource "aws_iam_role" "this" {
  name               = "my-service-role"
  assume_role_policy = data.aws_iam_policy_document.trust.json
}

# 2. THE POLICY (What it can do)
resource "aws_iam_policy" "this" {
  name   = "my-service-permissions"
  policy = data.aws_iam_policy_document.permissions.json
}

# 3. THE ATTACHMENT (The Glue)
resource "aws_iam_role_policy_attachment" "this" {
  role       = aws_iam_role.this.name
  policy_arn = aws_iam_policy.this.arn
}
```

### Common Service Principals for Trust Policies
When granting an AWS Service the ability to assume your role, use these exact string identifiers inside your `principals` block:
*   **Lambda:** `lambda.amazonaws.com`
*   **API Gateway:** `apigateway.amazonaws.com`
*   **EC2:** `ec2.amazonaws.com`
*   **ECS Tasks:** `ecs-tasks.amazonaws.com`
