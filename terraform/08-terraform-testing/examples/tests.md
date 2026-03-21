# Chapter 08 — Examples

## Example 1: Integration Test (Real Provider)

A test for an S3 bucket module that verifies the bucket is created with
the correct configuration using real AWS API calls.

```hcl
# tests/s3_bucket_integration.tftest.hcl

# Use real provider — requires AWS credentials in environment
provider "aws" {
  region = "ap-south-1"
}

variables {
  # Generate a unique bucket name per test run to avoid naming collisions
  bucket_name_prefix = "test-tftest"
  environment        = "test"
  force_destroy      = true   # Allow cleanup to succeed even if bucket has objects
}

run "bucket_exists_and_is_private" {
  command = apply

  assert {
    condition     = aws_s3_bucket.this.id != ""
    error_message = "Bucket was not created"
  }

  assert {
    condition     = aws_s3_bucket_public_access_block.this.block_public_acls == true
    error_message = "Public ACLs should be blocked"
  }

  assert {
    condition     = aws_s3_bucket_versioning.this.versioning_configuration[0].status == "Enabled"
    error_message = "Versioning should be enabled"
  }
}

run "plan_shows_idempotent_on_reapply" {
  command = plan   # After apply, a fresh plan should show no changes

  assert {
    condition     = length([for r in planned_values.root_module.resources : r if r.action_reason != ""])  == 0
    error_message = "Re-plan after apply should show no pending changes"
  }
}
```

---

## Example 2: Unit Test (Mock Provider)

Test the same module's HCL logic without any AWS calls.
Useful for testing variable validation, computed locals, and output values.

```hcl
# tests/s3_bucket_unit.tftest.hcl

mock_provider "aws" {
  # Auto-generates schema-valid values for all aws_* resources.
  # Override specific resources for deterministic assertion values.

  override_resource {
    target = aws_s3_bucket.this
    values = {
      id                          = "test-tftest-bucket-mock"
      arn                         = "arn:aws:s3:::test-tftest-bucket-mock"
      bucket                      = "test-tftest-bucket-mock"
      bucket_domain_name          = "test-tftest-bucket-mock.s3.amazonaws.com"
      bucket_regional_domain_name = "test-tftest-bucket-mock.s3.ap-south-1.amazonaws.com"
      region                      = "ap-south-1"
    }
  }
}

variables {
  bucket_name_prefix = "test-tftest"
  environment        = "test"
  force_destroy      = true
}

# Test 1: Happy path — correct inputs produce correct outputs
run "outputs_expose_correct_bucket_arn" {
  command = plan

  assert {
    condition     = output.bucket_arn == "arn:aws:s3:::test-tftest-bucket-mock"
    error_message = "Expected bucket_arn output to match mocked ARN"
  }

  assert {
    condition     = output.bucket_name == "test-tftest-bucket-mock"
    error_message = "Expected bucket_name output to match mocked id"
  }
}

# Test 2: Invalid environment name is rejected
run "rejects_invalid_environment_name" {
  command = plan

  variables {
    environment = "PRODUCTION"   # Module validation requires lowercase
  }

  expect_failures = [var.environment]
}

# Test 3: Empty bucket prefix is rejected
run "rejects_empty_bucket_prefix" {
  command = plan

  variables {
    bucket_name_prefix = ""
  }

  expect_failures = [var.bucket_name_prefix]
}
```

---

## Example 3: GitLab CI Pipeline with JUnit Reporting

```yaml
# .gitlab-ci.yml
stages:
  - unit-test
  - integration-test

# Fast unit tests on every push — no AWS credentials needed
unit-test:
  stage: unit-test
  image: hashicorp/terraform:1.11.0
  script:
    - terraform init -input=false
    # Run only test files matching the naming convention for unit tests
    - terraform test -filter=tests/unit -junit-xml=unit-results.xml
  artifacts:
    reports:
      junit: unit-results.xml   # GitLab renders this in pipeline Test tab
    when: always                # Always capture, even on test failure
    expire_in: 7 days

# Integration tests only on MR to main — requires real AWS via OIDC
integration-test:
  stage: integration-test
  image: hashicorp/terraform:1.11.0
  id_tokens:
    GITLAB_OIDC_TOKEN:
      aud: https://gitlab.com
  before_script:
    - |
      export $(aws sts assume-role-with-web-identity \
        --role-arn "${TEST_ROLE_ARN}" \
        --role-session-name "tftest-${CI_PIPELINE_ID}" \
        --web-identity-token "${GITLAB_OIDC_TOKEN}" \
        --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' \
        --output text | awk '{print "AWS_ACCESS_KEY_ID="$1" AWS_SECRET_ACCESS_KEY="$2" AWS_SESSION_TOKEN="$3}')
    - terraform init -input=false
  script:
    - terraform test -filter=tests/integration -junit-xml=integration-results.xml
  artifacts:
    reports:
      junit: integration-results.xml
    when: always
    expire_in: 1 day
  only:
    - merge_requests
```

---

## Example 4: Plan Output — What Passing and Failing Look Like

```bash
# terraform test output (passing)
$ terraform test
tests/s3_bucket_unit.tftest.hcl... in progress
  outputs_expose_correct_bucket_arn... pass
  rejects_invalid_environment_name... pass
  rejects_empty_bucket_prefix... pass
tests/s3_bucket_unit.tftest.hcl... tearing down
tests/s3_bucket_unit.tftest.hcl... pass

Success! 3 passed, 0 failed.
```

```bash
# terraform test output (failing assertion)
$ terraform test
tests/s3_bucket_unit.tftest.hcl... in progress
  outputs_expose_correct_bucket_arn... fail

  Failure! The following assertions failed:

  tests/s3_bucket_unit.tftest.hcl:35,5-35,62
  │ Error: Test assertion failed
  │
  │   on tests/s3_bucket_unit.tftest.hcl line 30, in run "outputs_expose_correct_bucket_arn":
  │    30:     condition = output.bucket_arn == "arn:aws:s3:::test-tftest-bucket-mock"
  │
  │ Expected bucket_arn output to match mocked ARN
  │  Got: "arn:aws:s3:::unexpected-bucket-name"

tests/s3_bucket_unit.tftest.hcl... tearing down

Failure! 0 passed, 1 failed.
```
