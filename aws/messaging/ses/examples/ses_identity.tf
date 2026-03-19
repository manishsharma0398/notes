# SES domain identity, DKIM, custom MAIL FROM, configuration set, event routing.
# Assumes Route 53 hosted zone. Adjust DNS resource type for other providers.

variable "domain" {
  default = "yourdomain.com"
}

variable "mail_from_subdomain" {
  default = "mail.yourdomain.com"
}

variable "region" {
  default = "us-east-1"
}

###############################################################################
# Domain identity + DKIM
###############################################################################

resource "aws_sesv2_email_identity" "domain" {
  email_identity = var.domain

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

# SES gives you 3 CNAME records to add to DNS for DKIM verification.
# These are CNAMEs, not TXT records — a common mistake.
resource "aws_route53_record" "dkim" {
  count   = 3
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.domain}"
  type    = "CNAME"
  ttl     = 300
  records = ["${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

###############################################################################
# Custom MAIL FROM domain — required for SPF DMARC alignment
# Without this, Return-Path is @amazonses.com and SPF alignment fails.
###############################################################################

resource "aws_ses_domain_mail_from" "main" {
  domain           = var.domain
  mail_from_domain = var.mail_from_subdomain
}

# SPF record for MAIL FROM subdomain
resource "aws_route53_record" "mail_from_spf" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.mail_from_subdomain
  type    = "TXT"
  ttl     = 300
  records = ["v=spf1 include:amazonses.com ~all"]
}

# MX record for MAIL FROM subdomain — SES needs to receive bounce messages here
resource "aws_route53_record" "mail_from_mx" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.mail_from_subdomain
  type    = "MX"
  ttl     = 300
  records = ["10 feedback-smtp.${var.region}.amazonses.com"]
}

# DMARC record — start with p=none (monitor), move to p=quarantine/reject after validating
resource "aws_route53_record" "dmarc" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "_dmarc.${var.domain}"
  type    = "TXT"
  ttl     = 300
  records = [
    # rua = where to send aggregate DMARC reports (use a mailbox you actually monitor)
    "v=DMARC1; p=none; rua=mailto:dmarc-reports@${var.domain}; ruf=mailto:dmarc-failures@${var.domain}; pct=100"
  ]
}

###############################################################################
# SNS topics for bounce + complaint events
###############################################################################

resource "aws_sns_topic" "ses_events" {
  name = "ses-events"
}

resource "aws_sqs_queue" "ses_events" {
  name                       = "ses-events"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 86400 # 1 day
}

resource "aws_sqs_queue" "ses_events_dlq" {
  name = "ses-events-dlq"
}

resource "aws_sqs_queue_redrive_policy" "ses_events" {
  queue_url = aws_sqs_queue.ses_events.id
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.ses_events_dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sns_topic_subscription" "ses_events_sqs" {
  topic_arn = aws_sns_topic.ses_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.ses_events.arn
}

resource "aws_sqs_queue_policy" "ses_events" {
  queue_url = aws_sqs_queue.ses_events.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "sns.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.ses_events.arn
      Condition = {
        ArnEquals = { "aws:SourceArn" = aws_sns_topic.ses_events.arn }
      }
    }]
  })
}

###############################################################################
# Configuration set — transactional sends
###############################################################################

resource "aws_sesv2_configuration_set" "transactional" {
  configuration_set_name = "transactional"

  # Enable engagement tracking (open/click)
  # Only enable if your privacy policy covers pixel tracking
  tracking_options {
    custom_redirect_domain = "click.${var.domain}"
  }

  reputation_options {
    reputation_metrics_enabled = true # CloudWatch metrics per config set
  }

  sending_options {
    sending_enabled = true
  }

  suppression_options {
    suppressed_reasons = ["BOUNCE", "COMPLAINT"]
  }
}

resource "aws_sesv2_configuration_set_event_destination" "transactional_sns" {
  configuration_set_name = aws_sesv2_configuration_set.transactional.configuration_set_name
  event_destination_name = "sns-all-events"

  event_destination {
    enabled = true

    matching_event_types = [
      "SEND",
      "DELIVERY",
      "BOUNCE",
      "COMPLAINT",
      "RENDERING_FAILURE",
      "DELIVERY_DELAY",
    ]

    sns_destination {
      topic_arn = aws_sns_topic.ses_events.arn
    }
  }
}

###############################################################################
# Marketing sends — separate config set, separate IP pool if using dedicated IPs
###############################################################################

resource "aws_sesv2_configuration_set" "marketing" {
  configuration_set_name = "marketing"

  reputation_options {
    reputation_metrics_enabled = true
  }

  sending_options {
    sending_enabled = true
  }

  suppression_options {
    suppressed_reasons = ["BOUNCE", "COMPLAINT"]
  }
}

###############################################################################
# Data sources
###############################################################################

data "aws_route53_zone" "main" {
  name         = var.domain
  private_zone = false
}
