# ------------------------------------------------------------------------------
# GENERIC EXAMPLE: AWS DYNAMODB
# This example demonstrates creating a serverless, On-Demand DynamoDB table
# designed for high-performance key-value lookups with a Global Secondary Index.
# ------------------------------------------------------------------------------

# 1. Variables (Simulating a generic environment)
variable "project" {
  description = "The project name"
  type        = string
  default     = "prasaarit"
}

variable "environment" {
  description = "The deployment environment"
  type        = string
  default     = "stg"
}

# ------------------------------------------------------------------------------
# STEP 1: The DynamoDB Table
# ------------------------------------------------------------------------------
resource "aws_dynamodb_table" "metadata_table" {
  name         = "${var.project}-${var.environment}-metadata"
  
  # "PAY_PER_REQUEST" completely eliminates capacity planning and throttling limits
  # for spiky workloads. This is the Serverless gold standard.
  billing_mode = "PAY_PER_REQUEST" 

  # The Primary Key (Partition Key + Sort Key)
  hash_key     = "UserId"
  range_key    = "UploadId"

  # ----------------------------------------------------------------------------
  # Attribute Definitions
  # You DO NOT define arbitrary data fields here (e.g., FileSize, FileName). 
  # You ONLY define the attributes used in the hash_key, range_key, or any GSIs.
  # S = String, N = Number, B = Binary
  # ----------------------------------------------------------------------------
  attribute {
    name = "UserId"
    type = "S"
  }

  attribute {
    name = "UploadId"
    type = "S"
  }

  # This attribute is only used by the Global Secondary Index below
  attribute {
    name = "UploadStatus"
    type = "S"
  }

  # ----------------------------------------------------------------------------
  # Global Secondary Index (GSI)
  # Allows the application to query all uploads globally by their Status
  # (e.g., "Find all COMPLETED uploads") without scanning the entire table.
  # ----------------------------------------------------------------------------
  global_secondary_index {
    name               = "StatusIndex"
    hash_key           = "UploadStatus"
    range_key          = "UploadId"     # Optional: Order by UploadId
    
    # "ALL" copies every single attribute from the main table into the index. 
    # Can use "INCLUDE" or "KEYS_ONLY" to save storage costs.
    projection_type    = "ALL"          
  }

  tags = {
    Name        = "${var.project}-${var.environment}-metadata"
    Environment = var.environment
  }
}

# ------------------------------------------------------------------------------
# Outputs
# ------------------------------------------------------------------------------
output "dynamodb_table_arn" {
  description = "The ARN of the DynamoDB table (Inject this into your Chapter 08 IAM Policy!)"
  value       = aws_dynamodb_table.metadata_table.arn
}

output "dynamodb_table_name" {
  description = "The literal name of the table (Inject this as an ENV VAR to your Chapter 10 Lambda!)"
  value       = aws_dynamodb_table.metadata_table.name
}
