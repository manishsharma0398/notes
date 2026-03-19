"""
Lambda handler: process SES bounce/complaint notifications from SNS → SQS → Lambda.

Pipeline:
    SES (config set event destination)
      → SNS topic (ses-events)
        → SQS queue (ses-events-queue)  ← Lambda event source mapping
          → this Lambda

Why SQS between SNS and Lambda:
- Durability: if this Lambda fails, messages stay in queue for retry
- Rate control: SES can fire many events; SQS buffers the spike
- DLQ: failed processing lands in ses-events-dlq, not silently dropped
"""

import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    results = []
    for record in event["Records"]:
        # SQS record → SNS envelope → SES event
        sns_message = json.loads(record["body"])
        ses_event = json.loads(sns_message["Message"])

        event_type = ses_event.get("eventType")  # v2 API field name

        try:
            if event_type == "Bounce":
                handle_bounce(ses_event["bounce"])
            elif event_type == "Complaint":
                handle_complaint(ses_event["complaint"])
            elif event_type == "Delivery":
                handle_delivery(ses_event["delivery"])
            else:
                logger.info("Unhandled SES event type: %s", event_type)

        except Exception:
            logger.exception("Failed to process SES event type=%s", event_type)
            # Re-raise so SQS keeps the message and retries.
            # If using partial batch failure response, append to failures instead.
            raise

    return results


def handle_bounce(bounce: dict):
    bounce_type = bounce["bounceType"]  # "Permanent" | "Transient" | "Undetermined"
    bounce_subtype = bounce["bounceSubType"]

    recipients = [r["emailAddress"] for r in bounce["bouncedRecipients"]]

    if bounce_type == "Permanent":
        # Hard bounce: address is invalid/doesn't exist.
        # SES already added to suppression list automatically.
        # We ALSO mark in our DB so we don't even attempt to call SES for these.
        for address in recipients:
            logger.info(
                "Hard bounce — marking suppressed: %s (subtype=%s)",
                address,
                bounce_subtype,
            )
            mark_address_suppressed(address, reason=f"hard_bounce:{bounce_subtype}")

    elif bounce_type == "Transient":
        # Soft bounce — SES is retrying for up to 72h.
        # Log for monitoring; don't mark as permanently suppressed.
        for address in recipients:
            logger.warning(
                "Soft bounce — SES retrying: %s (subtype=%s)", address, bounce_subtype
            )
            # Optionally: increment a transient bounce counter; if > N in window, suppress

    elif bounce_type == "Undetermined":
        # ISP didn't give a clear reason. Treat as soft.
        for address in recipients:
            logger.warning("Undetermined bounce: %s", address)


def handle_complaint(complaint: dict):
    # User hit "mark as spam" at their ISP (feedback loop).
    # MUST unsubscribe immediately. Do not send again without explicit re-consent.
    # SES adds to suppression list automatically for complaint type too.
    recipients = [r["emailAddress"] for r in complaint["complainedRecipients"]]
    feedback_type = complaint.get(
        "complaintFeedbackType"
    )  # "abuse" | "fraud" | "virus" | etc.

    for address in recipients:
        logger.warning(
            "Complaint received — unsubscribing: %s (feedbackType=%s)",
            address,
            feedback_type,
        )
        unsubscribe_address(address, reason=f"complaint:{feedback_type}")
        mark_address_suppressed(address, reason=f"complaint:{feedback_type}")


def handle_delivery(delivery: dict):
    recipients = delivery.get("recipients", [])
    processing_time_ms = delivery.get("processingTimeMillis")
    smtp_response = delivery.get("smtpResponse")

    for address in recipients:
        logger.info(
            "Delivered to %s in %sms — SMTP: %s",
            address,
            processing_time_ms,
            smtp_response,
        )
    # Optionally: update delivery status in DB, trigger downstream event


# --- Stubs — replace with actual DB/service calls ---


def mark_address_suppressed(address: str, reason: str):
    """Write to your DB: this address must not be sent to."""
    # e.g., DynamoDB put_item or RDS update
    pass


def unsubscribe_address(address: str, reason: str):
    """Remove from all mailing lists / marketing segments."""
    # e.g., update user preferences record
    pass
