# Hooks and error handling — live/prod/app/terragrunt.hcl (excerpt)
#
# Hook types available:
#   before_hook — runs BEFORE the terraform command
#   after_hook  — runs AFTER the terraform command (regardless of success unless run_on_error = false)
#   error_hook  — runs ONLY on error, matches on error messages via regex
#
# Source: pkg/config/config.go — TerraformConfig.BeforeHooks, AfterHooks, ErrorHooks

terraform {
  source = "git::git@github.com:myorg/modules.git//app?ref=v2.3.1"

  # --- before_hook: security scan before every plan and apply ---
  before_hook "tfsec_scan" {
    commands = ["plan", "apply"]
    execute  = ["tfsec", ".", "--no-colour"]
    # If tfsec exits non-zero, the plan/apply is ABORTED.
    # run_on_error defaults to false — if a previous hook failed,
    # this hook will not run.
  }

  # --- before_hook: inject secrets from Vault before apply ---
  before_hook "inject_secrets" {
    commands = ["apply"]
    execute  = ["vault-inject.sh", get_env("ENV", "staging")]
    # Scripts run with the current shell environment.
    # get_env() reads from the actual environment at Terragrunt execution time.
  }

  # --- after_hook: notify Slack after apply (success or failure) ---
  after_hook "slack_notify" {
    commands     = ["apply"]
    execute      = ["slack-notify.sh", "--env", get_env("ENV"), "--result", "$?"]
    run_on_error = true   # always run, even if apply failed
  }

  # --- after_hook: clean up a temp file after plan ---
  after_hook "cleanup" {
    commands     = ["plan"]
    execute      = ["rm", "-f", "/tmp/planout.txt"]
    run_on_error = false  # skip cleanup if plan itself errored
  }

  # --- error_hook: page on-call only on specific errors ---
  error_hook "page_oncall" {
    commands  = ["apply"]
    execute   = ["pagerduty-alert.sh", "--priority", "high"]
    on_errors = [
      ".*Error creating.*",
      ".*timeout.*",
      ".*ResourceNotReady.*"
    ]
    # on_errors is a list of Go regex patterns matched against the error output.
    # The hook runs when ANY pattern matches the error message.
  }
}

# --- errors block: retry and ignore patterns ---
#
# Separate from hooks — this operates at the Terragrunt orchestration level,
# not at the Terraform command level.
errors {
  # Retry transient provider errors (e.g. rate limiting, eventual consistency)
  retry "aws_throttle" {
    max_attempts       = 5
    sleep_interval_sec = 10
    retryable_errors = [
      ".*ThrottlingException.*",
      ".*RequestLimitExceeded.*",
      ".*ServiceUnavailableException.*"
    ]
  }

  # Ignore specific non-critical errors
  ignore "resource_already_exists" {
    ignorable_errors = [".*AlreadyExistsException.*"]
    message          = "Resource may already exist from a previous partial apply — safe to ignore"
    # Signals allow passing custom data back to hooks or CI systems
    signals = {
      notify = "false"
    }
  }
}

# ===== Common gotchas =====
#
# 1. Hooks run in the unit's working directory (.terragrunt-cache), NOT in the
#    directory containing terragrunt.hcl. Use ${get_original_terragrunt_dir()}
#    if you need paths relative to the terragrunt.hcl file.
#
# 2. Hook environment: the hook inherits the Terragrunt process environment,
#    including TF_VAR_* variables from the inputs block. This makes hooks
#    aware of unit inputs without extra plumbing.
#
# 3. exit code matters: a non-zero exit from before_hook aborts the terraform
#    command. Use `on_failure = continue` equivalent by wrapping your script
#    in `|| true` if you want a best-effort hook.
