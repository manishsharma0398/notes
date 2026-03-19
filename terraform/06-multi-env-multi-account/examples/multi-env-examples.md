# Multi-Environment and Multi-Account — Examples

## Example 1: Complete Workspace-Based Layout (Your Prasaarit Project)

```
prasaarit-upload-service/
│
├── infra/                            # single root module
│   ├── main.tf                       # provider + module calls
│   ├── variables.tf                  # input variables
│   ├── locals.tf                     # env_config map + derived values
│   ├── backend.tf                    # S3 backend (workspaces separate state)
│   ├── outputs.tf
│   ├── iam.tf
│   └── api_gateway.tf
│
├── modules/                          # shared module code
│   └── lambda_function/
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
│
└── src/
    └── generate_presigned_url/
        └── handler.py
```

### The `env_config` map — single source of per-env values:

```hcl
# infra/locals.tf

locals {
  env_config = {
    stg = {
      timeout         = 10
      memory          = 128
      allowed_origins = ["*"]
      s3_bucket       = "prasaarit-uploads-stg"
    }
    prod = {
      timeout         = 30
      memory          = 256
      allowed_origins = ["https://prasaarit.com"]
      s3_bucket       = "prasaarit-uploads-prod"
    }
  }

  config = local.env_config[terraform.workspace]
  prefix = "${var.project_name}-${terraform.workspace}"

  common_tags = {
    Project   = var.project_name
    Stage     = terraform.workspace
    ManagedBy = "terraform"
  }
}
```

### Backend — workspaces auto-separate state:

```hcl
# infra/backend.tf

terraform {
  backend "s3" {
    bucket         = "prasaarit-terraform-state"
    key            = "upload-service/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "prasaarit-terraform-locks"
    encrypt        = true
  }
}

# With workspace "stg":  env:/stg/upload-service/terraform.tfstate
# With workspace "prod": env:/prod/upload-service/terraform.tfstate
```

### Clean resource definitions — no conditionals:

```hcl
# infra/main.tf

module "presign_lambda" {
  source = "../modules/lambda_function"

  function_name = "${local.prefix}-presign"
  role_arn      = aws_iam_role.lambda_exec.arn
  source_path   = "${path.root}/../lambda_payload.zip"
  timeout       = local.config.timeout       # ← from env_config map
  memory_size   = local.config.memory        # ← from env_config map
  tags          = local.common_tags

  environment_variables = {
    BUCKET_NAME    = local.config.s3_bucket
    ALLOWED_ORIGIN = join(",", local.config.allowed_origins)
  }
}
```

### Workflow:

```bash
cd infra
terraform init

# Deploy to staging
terraform workspace select stg
terraform plan -out=stg.tfplan
terraform apply stg.tfplan

# Deploy to production
terraform workspace select prod
terraform plan -out=prod.tfplan
terraform apply prod.tfplan
```

---

## Example 2: GitLab CI Pipeline with Workspaces

```yaml
# .gitlab-ci.yml

stages:
  - plan
  - deploy

.terraform_base:
  image: hashicorp/terraform:1.9
  before_script:
    - cd infra
    - terraform init

plan-stg:
  extends: .terraform_base
  stage: plan
  script:
    - terraform workspace select stg
    - terraform plan -out=stg.tfplan
  artifacts:
    paths: [infra/stg.tfplan]

deploy-stg:
  extends: .terraform_base
  stage: deploy
  script:
    - terraform workspace select stg
    - terraform apply stg.tfplan
  needs: [plan-stg]
  only: [main]

plan-prod:
  extends: .terraform_base
  stage: plan
  script:
    - terraform workspace select prod
    - terraform plan -out=prod.tfplan
  artifacts:
    paths: [infra/prod.tfplan]

deploy-prod:
  extends: .terraform_base
  stage: deploy
  script:
    - terraform workspace select prod
    - terraform apply prod.tfplan
  needs: [plan-prod]
  when: manual          # manual approval gate
  only: [main]
```

---

## Example 3: Cross-Stack Communication via SSM

```hcl
# ─── core-infra repo: publish bucket ARN ──────────────────

resource "aws_s3_bucket" "uploads" {
  bucket = "prasaarit-uploads-${terraform.workspace}"
}

resource "aws_ssm_parameter" "upload_bucket_arn" {
  name  = "/prasaarit/${terraform.workspace}/upload-bucket-arn"
  type  = "String"
  value = aws_s3_bucket.uploads.arn
}
```

```hcl
# ─── upload-service repo: consume bucket ARN ──────────────

data "aws_ssm_parameter" "upload_bucket_arn" {
  name = "/prasaarit/${terraform.workspace}/upload-bucket-arn"
}

resource "aws_iam_role_policy" "lambda_s3" {
  role   = aws_iam_role.lambda_exec.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "s3:PutObject"
      Resource = "${data.aws_ssm_parameter.upload_bucket_arn.value}/*"
    }]
  })
}
```

---

## Example 4: Prod-Only Resources with Workspace Toggle

```hcl
# CloudWatch alarm — only in production
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  count = terraform.workspace == "prod" ? 1 : 0

  alarm_name          = "${local.prefix}-presign-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 5

  dimensions = {
    FunctionName = module.presign_lambda.function_name
  }
}

# If you have more than 3-4 such toggles, consider whether
# directory-per-env would be cleaner for your use case.
```
