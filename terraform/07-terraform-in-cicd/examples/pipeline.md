# GitLab CI — Complete Terraform Pipeline Example

## File: `.gitlab-ci.yml`

This is a complete, production-grade pipeline for a single environment using workspaces.
It demonstrates: plan artifact contract, OIDC auth, manual gate, and resource group locking.

```yaml
# .gitlab-ci.yml
stages:
  - validate
  - plan
  - apply

variables:
  TF_VERSION: "1.11.0"
  TF_WORKSPACE: ${CI_ENVIRONMENT_NAME}  # "staging" or "production"
  AWS_REGION: "ap-south-1"
  AWS_ROLE_ARN: "arn:aws:iam::123456789012:role/terraform-ci-deploy"

default:
  image: hashicorp/terraform:${TF_VERSION}
  before_script:
    # Exchange GitLab JWT for temporary AWS credentials (OIDC)
    - |
      export $(aws sts assume-role-with-web-identity \
        --role-arn "${AWS_ROLE_ARN}" \
        --role-session-name "gitlab-ci-${CI_PIPELINE_ID}" \
        --web-identity-token "${GITLAB_OIDC_TOKEN}" \
        --duration-seconds 3600 \
        --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' \
        --output text | awk '{
          print "AWS_ACCESS_KEY_ID="$1
          print "AWS_SECRET_ACCESS_KEY="$2
          print "AWS_SESSION_TOKEN="$3
        }')
    - terraform init -input=false

# ─── Stage 1: Validate (always, on every push) ─────────────────────────────
validate:
  stage: validate
  id_tokens:
    GITLAB_OIDC_TOKEN:
      aud: https://gitlab.com
  script:
    - terraform fmt -check -recursive
    - terraform validate
  # No artifacts needed

# ─── Stage 2: Plan Staging ─────────────────────────────────────────────────
plan-staging:
  stage: plan
  id_tokens:
    GITLAB_OIDC_TOKEN:
      aud: https://gitlab.com
  environment:
    name: staging
  script:
    - terraform workspace select -or-create ${TF_WORKSPACE}
    - terraform plan -input=false -out=staging.tfplan
    # Generate human-readable plan text for MR review (be aware: may contain secrets)
    - terraform show -no-color staging.tfplan | tee staging-plan.txt
  artifacts:
    name: "staging-plan-${CI_COMMIT_SHORT_SHA}"
    paths:
      - staging.tfplan
      - staging-plan.txt
    expire_in: 4 hours   # Never leave plan artifacts around indefinitely
    access: developer
  only:
    - merge_requests
    - main

# ─── Stage 3: Apply Staging (automatic on merge to main) ───────────────────
apply-staging:
  stage: apply
  id_tokens:
    GITLAB_OIDC_TOKEN:
      aud: https://gitlab.com
  environment:
    name: staging
  needs: [plan-staging]
  # No 'when: manual' — staging auto-deploys
  resource_group: staging-tf     # Serialises concurrent apply jobs
  script:
    - terraform workspace select ${TF_WORKSPACE}
    - terraform apply -input=false staging.tfplan
  only:
    - main

# ─── Stage 2b: Plan Production (runs after staging apply succeeds) ──────────
plan-production:
  stage: plan
  id_tokens:
    GITLAB_OIDC_TOKEN:
      aud: https://gitlab.com
  environment:
    name: production
  needs: [apply-staging]
  script:
    - terraform workspace select -or-create production
    - terraform plan -input=false -out=prod.tfplan
    - terraform show -no-color prod.tfplan | tee prod-plan.txt
  artifacts:
    name: "prod-plan-${CI_COMMIT_SHORT_SHA}"
    paths:
      - prod.tfplan
      - prod-plan.txt
    expire_in: 4 hours
    access: maintainer    # More restrictive for production plans
  only:
    - main

# ─── Stage 3b: Apply Production (manual gate) ──────────────────────────────
apply-production:
  stage: apply
  id_tokens:
    GITLAB_OIDC_TOKEN:
      aud: https://gitlab.com
  environment:
    name: production         # Can be configured with required approvers in GitLab
  needs: [plan-production]
  when: manual               # ◄─── Pipeline pauses here. Human clicks ▶ after reviewing plan.
  resource_group: production-tf   # Serialises concurrent apply jobs
  script:
    - terraform workspace select production
    - terraform apply -input=false prod.tfplan
  only:
    - main
```

---

## GitHub Actions Equivalent

```yaml
# .github/workflows/terraform.yml
name: Terraform

on:
  push:
    branches: [main]
  pull_request:

permissions:
  id-token: write   # Required for OIDC token request
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.11.0"
      - run: terraform fmt -check -recursive
      - run: terraform validate

  plan:
    needs: validate
    runs-on: ubuntu-latest
    outputs:
      plan-exitcode: ${{ steps.plan.outputs.exitcode }}
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.11.0"
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform-ci-deploy
          aws-region: ap-south-1
      - run: terraform init -input=false
      - id: plan
        run: |
          terraform plan -input=false -out=prod.tfplan -detailed-exitcode
          echo "exitcode=$?" >> $GITHUB_OUTPUT
        continue-on-error: true
      - uses: actions/upload-artifact@v4
        with:
          name: prod-tfplan
          path: prod.tfplan
          retention-days: 1

  apply:
    needs: plan
    if: github.ref == 'refs/heads/main' && needs.plan.outputs.plan-exitcode == '2'
    runs-on: ubuntu-latest
    environment: production    # ◄─── Requires approval from configured reviewers
    concurrency:
      group: terraform-prod
      cancel-in-progress: false  # Queue — don't cancel concurrent deployments
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.11.0"
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform-ci-deploy
          aws-region: ap-south-1
      - uses: actions/download-artifact@v4
        with:
          name: prod-tfplan
      - run: terraform init -input=false
      - run: terraform apply -input=false prod.tfplan
```

---

## Failure Scenario: Stale Lock Recovery

```bash
# Pipeline dies mid-apply. Next pipeline sees:
# Error: Error acquiring the state lock
#   Lock Info:
#     ID:        3946e1d0-d6d8-4c3e-5f34-8cd5e4e10234
#     Path:      infra/terraform.tfstate
#     Operation: OperationTypeApply
#     Who:       runner-abc123@gitlab-runner
#     Created:   2026-03-21T06:43:11Z
#     Info:

# Step 1: verify no apply is actually running (check GitLab job status)
# Step 2: inspect what state currently looks like
terraform show   # reads state; does NOT require the lock

# Step 3: check what AWS actually has vs what state says
terraform plan   # will also fail due to lock; use -lock=false for inspection only
terraform plan -lock=false

# Step 4: only when certain no apply is running:
terraform force-unlock 3946e1d0-d6d8-4c3e-5f34-8cd5e4e10234

# Step 5: reconcile any partially applied resources
terraform plan   # now shows delta between state and reality
# Use terraform import for any resources created in AWS but not in state
```
