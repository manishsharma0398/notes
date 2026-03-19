# Chapter 07 — Terraform in CI/CD

## Mental Model

Running Terraform on your laptop is fine for testing, but in a team (or a disciplined solo project like Prasaarit), Terraform should exclusively run in a CI/CD pipeline.

Why?
1. **Consistency**: The deployment environment is always identical (same Terraform version, same tools).
2. **Auditability**: Every infrastructure change is tied to a git commit and a pipeline log.
3. **Drift Prevention**: Developers aren't manually applying changes that aren't in git.

The core CI/CD flow is a two-stage process matching Terraform's execution model:
```
Git Commit ──► [Pipeline Starts] ──► terraform plan (creates plan file) ──► [Approval Gate] ──► terraform apply (consumes plan file)
```

---

## 1. Saved Plan Files: The Contract

The biggest mistake teams make in CI/CD is this script:

```bash
# WRONG - DANGEROUS PIPELINE
terraform apply -auto-approve
```

Or this two-stage pipeline:

```bash
# Job 1 (Plan phase)
terraform plan

# Job 2 (Apply phase - runs later)
terraform apply -auto-approve
```

**Why this is dangerous:** What you reviewed in Job 1 is NOT necessarily what Job 2 applies. `terraform apply` without a plan file calculates a _new_ plan implicitly. If someone changed the cloud via the console between Job 1 and Job 2, Job 2 will apply a different set of changes than what was approved.

### The Fix: Binary Plan Artifacts

You must pass the **exact** plan calculated in the plan phase to the apply phase.

```bash
# Job 1 (Plan phase)
terraform plan -out=tfplan.binary

# Job 2 (Apply phase)
# Takes tfplan.binary from Job 1's artifacts
terraform apply tfplan.binary
```

When you pass a saved plan file, Terraform **guarantees** it will only execute those exact changes. If the state has diverged in the background since the plan was created, the `apply` will fail safely rather than doing something unexpected.

### The Security Warning

Saved plan files contain **your entire state** and all planned changes in plaintext (including secrets). In GitLab CI, you must protect these artifacts:
- Don't set public visibility on infrastructure pipelines.
- Ensure the artifact expires quickly (e.g., `expire_in: 1 day`).

---

## 2. OIDC Credential Injection (Passwordless Authentication)

How does your GitLab runner get permission to provision AWS resources?

**The Old Way (Bad)**: Generate an IAM Data `Access Key ID` and `Secret Access Key` for a "gitlab_deployer" IAM user. Store them as masked CI/CD variables in GitLab.
_Why it's bad_: Long-lived credentials leak. They get checked into code, accidentally logged, or an ex-employee takes them. You have to rotate them manually.

**The Modern Way (OIDC)**: OpenID Connect. GitLab and AWS establish a trust relationship. GitLab gives the pipeline runner a temporary, cryptographically signed token (JWT). The runner trades that token with AWS STS for temporary IAM credentials.

```
 GitLab Runner               AWS IAM
 ─────────────               ───────
       │                        │
       │ 1. "I am GitLab job "  │
       │    running on repo X"  │
       ├───────────────────────►│
       │                        │ 2. Validates GitLab's signature
       │                        │ 3. Checks Trust Policy (Is repo X allowed?)
       │ 4. Here are temporary  │
       │    access keys (1hr)   │
       ◄────────────────────────┤
       │                        │
```

### Setting up OIDC for Prasaarit (GitLab -> AWS)

**Step 1: In AWS, create the OIDC Identity Provider** (telling AWS to trust your GitLab instance).

```hcl
# This is usually done once in a "bootstrap" terraform repo
resource "aws_iam_openid_connect_provider" "gitlab" {
  url             = "https://gitlab.com"
  client_id_list  = ["https://gitlab.com"]
  thumbprint_list = ["b3dd..."] # GitLab's TLS certificate thumbprint
}
```

**Step 2: Create the IAM Role with a Trust Policy** (saying WHICH GitLab repo can assume it).

```hcl
resource "aws_iam_role" "gitlab_deploy_role" {
  name = "PrasaaritGitlabDeployRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.gitlab.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        "StringLike" = {
          # ONLY allow the Prasaarit project, and ONLY the main branch
          "gitlab.com:sub": "project_path:your-username/prasaarit-upload-service:ref_type:branch:ref:main"
        }
      }
    }]
  })
}
```

**Step 3: In `.gitlab-ci.yml`, trade the token**

```yaml
deploy-prod:
  # GitLab provides this token automatically
  id_tokens:
    GITLAB_OIDC_TOKEN:
      aud: https://gitlab.com
  script:
    # Use AWS CLI to exchange the GitLab token for temporary AWS keys
    - >
      export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s"
      $(aws sts assume-role-with-web-identity
      --role-arn arn:aws:iam::123456789012:role/PrasaaritGitlabDeployRole
      --role-session-name "GitLabRunner-${CI_PROJECT_ID}-${CI_PIPELINE_ID}"
      --web-identity-token ${GITLAB_OIDC_TOKEN}
      --duration-seconds 3600
      --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]'
      --output text))
    # Now terraform runs using those temporary keys
    - terraform apply prod.tfplan
```

Result: **Zero secrets stored in GitLab.** Highly secure.

---

## 3. Plan Review Gates

You don't want every push to `main` deploying straight to production. You want a human to see the `terraform plan` output and approve it.

In GitLab CI, this is handled using `when: manual`.

```yaml
plan-prod:
  stage: plan
  script:
    - terraform workspace select prod
    - terraform plan -out=prod.tfplan
    # Optional but nice: Post the plan to the Merge Request
    - terraform show prod.tfplan > plan.txt
  artifacts:
    paths: [prod.tfplan]

apply-prod:
  stage: deploy
  when: manual        # Pipeline PAUSES here waiting for human click
  needs: [plan-prod]
  environment:
    name: production
  script:
    - terraform workspace select prod
    - terraform apply prod.tfplan
```

The pipeline stops. You review `plan.txt` from the artifacts. If it looks correct, you click the "Play" button on the `apply-prod` job.

---

## 4. State Locking and Concurrency

What happens when Alice pushes a commit, triggering Pipeline A, and two minutes later Bob pushes a commit, triggering Pipeline B?

Both pipelines run `terraform apply` against the same state file simultaneously.
- Pipeline A reads state, decides to create Lambda X.
- Pipeline B reads state, decides to create Lambda X.
- Both call AWS API to create Lambda X. One fails, state is corrupted.

### The Fix: DynamoDB Lock Table

If you configured your S3 backend with a `dynamodb_table`, Terraform handles this safely:

1. Pipeline A starts `terraform plan`. It writes a lock record to DynamoDB.
2. Pipeline B starts `terraform plan`. It checks DynamoDB, sees the lock, and **fails immediately**:
   `Error: Error acquiring the state lock`
3. Pipeline A finishes, deletes the lock record.
4. Bob must re-run Pipeline B.

This is a feature, not a bug. It forces pipeline serialization.

**Advanced GitLab Tip**: You can tell GitLab to restrict pipeline concurrency inherently, so the second pipeline queues up rather than failing on the Terraform lock:

```yaml
# In .gitlab-ci.yml
deploy-prod:
  resource_group: production-env   # GitLab ensures only one job runs this at a time
  script:
    - terraform apply prod.tfplan
```

---

## The Perfect Pipeline (GitLab CI + Workspaces)

Bringing it all together for your Prasaarit project:

1. **Format/Validate** on every commit (fast feedback).
2. **Plan (Stg)** on merge requests.
3. **Apply (Stg)** automatically on merge to `main`.
4. **Plan (Prod)** automatically after Stg deploy.
5. **Apply (Prod)** via manual click on `main`.

_See `examples/gitlab-ci.md` for the complete implementation._

---

## 5. Terragrunt in CI/CD

If you are using Terragrunt, the CI/CD pipeline principles remain the same (OIDC, locking, manual review gates), but the execution commands change slightly.

### The `--non-interactive` Flag

Terragrunt occasionally prompts the user interactively (e.g., "Do you want to create the S3 state bucket now?"). In a GitLab pipeline, an interactive prompt will hang the job until it times out. 

**Rule:** Always pass `--non-interactive` in CI (Note: In older versions of Terragrunt before RFC-3445, this flag was `--terragrunt-non-interactive`).

```yaml
script:
  - terragrunt plan --non-interactive -out=plan.tfplan
```

### Passing Binary Plans in Terragrunt

The syntax for passing a binary plan file in Terragrunt is identical to native Terraform, but you must make sure Terragrunt is running against the same `.terragrunt-cache` directory in both the `plan` and `apply` jobs, OR use absolute paths.

```yaml
plan-stg:
  script:
    # Generate the plan file at the root of the repository
    - terragrunt plan --non-interactive -out=$CI_PROJECT_DIR/stg.tfplan
  artifacts:
    paths:
      - stg.tfplan

apply-stg:
  script:
    # Consume the absolute path to the plan file
    - terragrunt apply --non-interactive $CI_PROJECT_DIR/stg.tfplan
```

### Orchestrating Multiple Modules with `run --all`

If your environment contains multiple modules (e.g., `vpc/terragrunt.hcl`, `database/terragrunt.hcl`, `lambda/terragrunt.hcl`), native Terraform requires you to run them one by one in the correct dependency order.

Terragrunt handles this automatically using the `--all` flag (formerly `run-all`). In CI/CD, this collapses a complex multi-stage pipeline into a single command:

```yaml
deploy-stg:
  script:
    # Terragrunt scans the directory tree, calculates dependencies, 
    # creates the VPC, then the DB, then the Lambda, in parallel where possible.
    - terragrunt run --all apply --non-interactive --queue-exclude-dir .terragrunt-cache
```

*(Note: `run --all plan` with binary plan files is currently difficult to implement cleanly in CI because each module requires its own `-out` file. Most teams rely on `run --all apply --non-interactive` for lower environments, and single-module `plan/apply` for production).*

---
## Source References

- [Running Terraform in Automation](https://developer.hashicorp.com/terraform/tutorials/automation/automate-terraform) — Official HashiCorp guide
- [GitLab CI/CD OIDC with AWS](https://docs.gitlab.com/ee/ci/cloud_services/aws/) — GitLab docs on passwordless auth
- [Terraform CLI: Backend DynamoDB Lock](https://developer.hashicorp.com/terraform/language/settings/backends/s3#dynamodb_table) — How state locking works
