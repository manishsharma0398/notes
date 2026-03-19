# Example: Complete GitLab CI Pipeline for Prasaarit (Workspaces)

This `.gitlab-ci.yml` demonstrates:
1. Validating and formatting Terraform on every commit.
2. OIDC Passwordless Authentication with AWS.
3. Passing binary plan files (`tfplan`) between jobs safely.
4. Auto-deploying to staging on merge to `main`.
5. Manual approval gate for deploying to production.

```yaml
# .gitlab-ci.yml

stages:
  - validate
  - plan-stg
  - deploy-stg
  - plan-prod
  - deploy-prod

# ─── 1. BASE TEMPLATE ───────────────────────────────────────
# Define the environment all jobs share
.terraform_base:
  image: hashicorp/terraform:1.9
  before_script:
    - cd infra
    # Initialize the backend and modules
    - terraform init -input=false
  # Standardize artifacts to expire quickly (security best practice)
  artifacts:
    expire_in: 1 day

# ─── 2. OIDC AUTHENTICATION TEMPLATE ────────────────────────
# Instead of storing AWS keys, trade the GitLab token for temporary STS keys
.aws_oidc_auth:
  id_tokens:
    GITLAB_OIDC_TOKEN:
      aud: https://gitlab.com
  before_script:
    - apk add --no-cache aws-cli jq
    - >
      export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s"
      $(aws sts assume-role-with-web-identity
      --role-arn ${AWS_ROLE_ARN}
      --role-session-name "GitLabRunner-${CI_PROJECT_ID}-${CI_PIPELINE_ID}"
      --web-identity-token ${GITLAB_OIDC_TOKEN}
      --duration-seconds 3600
      --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]'
      --output text))
    - terraform init -input=false

# ─── 3. VALIDATE (Runs on every commit) ─────────────────────
fmt-and-validate:
  extends: .terraform_base
  stage: validate
  script:
    - terraform fmt -check
    - terraform validate
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# ─── 4. STAGING (Runs on Merge Requests & Main) ─────────────
plan-stg:
  extends:
    - .terraform_base
    - .aws_oidc_auth
  stage: plan-stg
  variables:
    # Set the IAM Role ARN configured in your AWS account for Prasaarit staging
    AWS_ROLE_ARN: "arn:aws:iam::111111111111:role/PrasaaritGitlabDeployRoleStg"
  script:
    - terraform workspace select stg
    - terraform plan -out=stg.tfplan
    # Output a human-readable text file for reviewers
    - terraform show -no-color stg.tfplan > stg-plan.txt
  artifacts:
    paths:
      - infra/stg.tfplan
      - infra/stg-plan.txt
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

deploy-stg:
  extends:
    - .terraform_base
    - .aws_oidc_auth
  stage: deploy-stg
  variables:
    AWS_ROLE_ARN: "arn:aws:iam::111111111111:role/PrasaaritGitlabDeployRoleStg"
  needs:
    - plan-stg
  environment:
    name: staging
  script:
    - terraform workspace select stg
    # ⚠️ CRITICAL: Apply the exact binary plan from the previous job
    - terraform apply -input=false stg.tfplan
  rules:
    # Only deploy staging automatically when code hits main
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# ─── 5. PRODUCTION (Runs ONLY on Main, after Staging) ────────
plan-prod:
  extends:
    - .terraform_base
    - .aws_oidc_auth
  stage: plan-prod
  variables:
    # Use the stricter production IAM role
    AWS_ROLE_ARN: "arn:aws:iam::222222222222:role/PrasaaritGitlabDeployRoleProd"
  needs:
    - deploy-stg
  script:
    - terraform workspace select prod
    - terraform plan -out=prod.tfplan
    - terraform show -no-color prod.tfplan > prod-plan.txt
  artifacts:
    paths:
      - infra/prod.tfplan
      - infra/prod-plan.txt
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

deploy-prod:
  extends:
    - .terraform_base
    - .aws_oidc_auth
  stage: deploy-prod
  variables:
    AWS_ROLE_ARN: "arn:aws:iam::222222222222:role/PrasaaritGitlabDeployRoleProd"
  needs:
    - plan-prod
  environment:
    name: production
  # ⚠️ CRITICAL: The security gate. Pipeline pauses here.
  when: manual
  script:
    - terraform workspace select prod
    - terraform apply -input=false prod.tfplan
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```
