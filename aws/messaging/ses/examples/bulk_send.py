"""
SES v2 — Bulk email to up to 50 recipients in a single API call.

Prerequisites:
  1. A verified SES domain identity
  2. A pre-created SES template (see create_template() below)
  3. Production access (out of sandbox) if any recipient is unverified

Key rule: SendBulkEmail returns HTTP 200 even when individual destinations fail.
You MUST iterate BulkEmailEntryResults and handle per-destination errors explicitly.

Rate limit reality (default production account):
  - SES allows 14 emails/second (TPS).
  - A SendBulkEmail call with 50 destinations counts as 50 sends, NOT 1 API call.
  - 50 destinations consumes 50/14 ≈ 3.57 seconds of your rate budget instantly.
  - Fire two back-to-back bulk calls → Throttling on the second call.
  - AWS does NOT buffer or slow-drip for you. Throttling = your problem to handle.
"""

import json
import logging
import math
import random
import time
from dataclasses import dataclass

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

ses = boto3.client("sesv2", region_name="us-east-1")

TEMPLATE_NAME = "order-confirmation-v1"
FROM_ADDRESS = "orders@yourdomain.com"
CONFIG_SET = "transactional"
MAX_DESTINATIONS_PER_CALL = 50  # hard SES limit

# Default production SES rate. Increase via Service Quotas.
# A bulk call of N destinations consumes N against this limit.
SES_TPS_LIMIT = 14  # emails/second


###############################################################################
# Data model
###############################################################################


@dataclass
class Recipient:
    email: str
    name: str
    order_id: str
    total: str


###############################################################################
# Template management — run once during deployment
###############################################################################


def create_template():
    """
    Create the SES email template. Template variables use {{variable}} syntax.
    Run this once; update when content changes (update_template / delete + recreate).
    """
    ses.create_email_template(
        TemplateName=TEMPLATE_NAME,
        TemplateContent={
            "Subject": "Your order {{order_id}} is confirmed",
            "Html": """
                <html><body>
                  <p>Hi {{name}},</p>
                  <p>Order <strong>{{order_id}}</strong> totalling <strong>{{total}}</strong>
                     has been confirmed.</p>
                  <p>Questions? Contact <a href="mailto:{{support_email}}">{{support_email}}</a></p>
                </body></html>
            """,
            "Text": (
                "Hi {{name}},\n\n"
                "Order {{order_id}} totalling {{total}} has been confirmed.\n\n"
                "Questions? Contact {{support_email}}"
            ),
        },
    )
    logger.info("Template '%s' created.", TEMPLATE_NAME)


###############################################################################
# Bulk send — exactly 50 recipients in one call
###############################################################################


def send_bulk(recipients: list[Recipient]) -> dict:
    """
    Send personalised emails to up to 50 recipients in a single SES call.
    Returns a dict: { "success": [...emails], "failed": [...emails] }
    """
    if len(recipients) > MAX_DESTINATIONS_PER_CALL:
        raise ValueError(
            f"Too many destinations: {len(recipients)}. "
            f"Max is {MAX_DESTINATIONS_PER_CALL}. Chunk the list first."
        )

    # Build per-destination entries
    destinations = []
    for r in recipients:
        destinations.append(
            {
                "Destination": {
                    "ToAddresses": [r.email],
                },
                # Per-recipient data — overrides / supplements default_template_data
                "ReplacementTemplateData": json.dumps(
                    {
                        "name": r.name,
                        "order_id": r.order_id,
                        "total": r.total,
                    }
                ),
            }
        )

    try:
        response = ses.send_bulk_email(
            FromEmailAddress=FROM_ADDRESS,
            ConfigurationSetName=CONFIG_SET,
            DefaultContent={
                "Template": {
                    "TemplateName": TEMPLATE_NAME,
                    # Default values for any token not overridden per-destination.
                    # Any token missing from BOTH default and per-destination data
                    # causes a renderingFailure for that destination — not the whole call.
                    "TemplateData": json.dumps(
                        {
                            "support_email": "support@yourdomain.com",
                            # Provide a safe fallback for all tokens you use in the template
                            "name": "Valued Customer",
                            "order_id": "UNKNOWN",
                            "total": "N/A",
                        }
                    ),
                }
            },
            BulkEmailEntries=destinations,
        )
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "Throttling":
            # Whole call rejected — re-queue and retry with backoff
            logger.error("Throttled on bulk send of %d recipients.", len(recipients))
            raise
        elif code == "SendingPausedException":
            logger.critical(
                "SES account paused — check bounce/complaint rates immediately."
            )
            raise
        else:
            raise

    # CRITICAL: check per-destination results — HTTP 200 does NOT mean all succeeded
    results = response["BulkEmailEntryResults"]
    success = []
    failed = []

    for recipient, result in zip(recipients, results):
        status = result["Status"]
        if status == "SUCCESS":
            success.append(recipient.email)
        else:
            # Status values on failure:
            #   MESSAGE_REJECTED    — address in suppression list
            #   FAILED              — rendering failure, invalid address format, etc.
            #   ACCOUNT_SUSPENDED   — account paused
            error = result.get("Error", "unknown error")
            logger.warning(
                "Bulk send failed for %s: status=%s error=%s",
                recipient.email,
                status,
                error,
            )
            failed.append({"email": recipient.email, "status": status, "error": error})

    logger.info(
        "Bulk send complete: %d succeeded, %d failed (total=%d)",
        len(success),
        len(failed),
        len(recipients),
    )
    return {"success": success, "failed": failed}


###############################################################################
# Handling throttling — what AWS actually recommends
#
# AWS does NOT prescribe "sleep N seconds between calls." Their documented
# strategies (https://aws.amazon.com/blogs/messaging-and-targeting/how-to-handle-a-throttling-maximum-sending-rate-exceeded-error/):
#
#   1. Exponential backoff (PRIMARY) — retry after Throttling, double the wait
#      each time. Self-tunes to actual throughput regardless of network/load.
#   2. Proactive rate limiting — cap rate before hitting SES (e.g. RateLimiter).
#   3. Downscale — reduce threads / add static delays if consistently over limit.
#
# The "sleep(N)" pattern is a user-derived implementation of option 2/3.
# It is NOT documented by AWS and is brittle: SES throughput can vary with
# message size, SES availability, and network conditions. You end up needing
# exponential backoff as a fallback anyway, which makes the sleep redundant.
#
# Approach A — exponential backoff (AWS primary recommendation):
#   React to Throttling. Self-tunes. Works under all conditions.
#
# Approach B — proactive rate limiting with sleep (derived, scripts only):
#   Pre-calculated sleep to avoid hitting the limit. Fine for scripts.
#   Requires fallback backoff anyway.
#
# Approach C — SQS-backed Lambda (production):
#   Throttling → Lambda raises → SQS retries with natural backoff.
#   No sleep, no rate math in application code.
###############################################################################


def send_bulk_with_backoff(
    recipients: list["Recipient"],
    max_retries: int = 5,
) -> dict:
    """
    Approach A: exponential backoff — AWS's primary recommendation.

    On Throttling: wait and retry with exponentially increasing delay + jitter.
    Self-tunes to actual SES throughput regardless of network latency,
    message size, or SES availability fluctuations.

    Use for: scripts, workers sending multiple batches, any context where
    you need reliable delivery without an SQS queue.

    The jitter prevents thundering herd: if multiple workers throttle at the
    same time, randomised wait means they don't all retry simultaneously.
    """
    wait = 0.1  # start at 100ms
    last_exc = None

    for attempt in range(max_retries):
        try:
            return send_bulk(recipients)
        except ClientError as e:
            code = e.response["Error"]["Code"]
            if code == "Throttling":
                if attempt == max_retries - 1:
                    logger.error(
                        "Throttling: exhausted %d retries for %d recipients.",
                        max_retries,
                        len(recipients),
                    )
                    raise
                jitter = random.uniform(0, wait)
                total_wait = wait + jitter
                logger.warning(
                    "Throttled (attempt %d/%d) — backing off %.2fs.",
                    attempt + 1,
                    max_retries,
                    total_wait,
                )
                time.sleep(total_wait)
                wait = min(wait * 2, 30)  # double each time, cap at 30s
                last_exc = e
            else:
                raise

    raise last_exc  # unreachable but satisfies type checkers


def send_at_rate_with_sleep(
    all_recipients: list["Recipient"],
    tps_limit: int = SES_TPS_LIMIT,
    batch_size: int | None = None,
) -> dict:
    """
    Approach B: proactive rate limiting with clock-aware sleep.
    NOT prescribed by AWS — derived approach. Brittle if SES throughput varies.
    Still add backoff: if sleep is slightly too short and Throttling fires,
    you need to handle it, which means you need Approach A anyway.

    If you must use this pattern (e.g. one-off script, no SQS):
      - batch_size == tps_limit → exactly 1 batch per second
      - sleep(window - elapsed) accounts for the time the API call took
      - flat sleep(1) after the call wastes quota (~15% at 14/s)

    Not for Lambda — sleep wastes billed duration.
    """
    effective_batch = min(batch_size or tps_limit, MAX_DESTINATIONS_PER_CALL)
    aggregate: dict = {"success": [], "failed": []}
    total_batches = math.ceil(len(all_recipients) / effective_batch)

    logger.info(
        "Sending %d recipients in %d batch(es) of %d at target %d/s.",
        len(all_recipients),
        total_batches,
        effective_batch,
        tps_limit,
    )

    for batch_num, i in enumerate(
        range(0, len(all_recipients), effective_batch), start=1
    ):
        chunk = all_recipients[i : i + effective_batch]
        t_start = time.monotonic()

        logger.info(
            "Batch %d/%d — %d recipients.", batch_num, total_batches, len(chunk)
        )

        # Use backoff here too — sleep may be slightly too short under load
        result = send_bulk_with_backoff(chunk)
        aggregate["success"].extend(result["success"])
        aggregate["failed"].extend(result["failed"])

        if batch_num < total_batches:
            elapsed = time.monotonic() - t_start
            # Window for this chunk = how long it SHOULD take at tps_limit
            window = len(chunk) / tps_limit
            remaining = window - elapsed
            if remaining > 0:
                logger.debug("Call took %.3fs — sleeping %.3fs.", elapsed, remaining)
                time.sleep(remaining)

    return aggregate


def send_to_many_via_sqs(
    all_recipients: list["Recipient"],
    queue_url: str,
    sqs_client=None,
) -> int:
    """
    Approach B (recommended for production): push chunks to SQS.
    This function just enqueues — actual sending happens in a separate Lambda.

    The Lambda (ses_bulk_worker) processes one SQS message at a time:
      - Reserved concurrency = 1 → guaranteed sequential processing → no TPS clash
      - On Throttling from SES → Lambda raises → SQS retries with backoff
      - No sleep, no rate math, no manual retry loops

    Returns: number of SQS messages enqueued (= number of 50-recipient batches).

    Architecture:
      your code (this fn)
        → SQS queue (ses-bulk-jobs)
          → Lambda (concurrency=1, batch size=1)
            → SES SendBulkEmail (50 recipients per message)
              → on Throttling: Lambda fails → SQS backs off and retries
    """
    sqs = sqs_client or boto3.client("sqs", region_name="us-east-1")
    enqueued = 0

    for i in range(0, len(all_recipients), MAX_DESTINATIONS_PER_CALL):
        chunk = all_recipients[i : i + MAX_DESTINATIONS_PER_CALL]
        message_body = json.dumps(
            [
                {
                    "email": r.email,
                    "name": r.name,
                    "order_id": r.order_id,
                    "total": r.total,
                }
                for r in chunk
            ]
        )
        sqs.send_message(QueueUrl=queue_url, MessageBody=message_body)
        enqueued += 1

    logger.info("Enqueued %d batch message(s) onto %s.", enqueued, queue_url)
    return enqueued


def ses_bulk_worker_lambda_handler(event, context):
    """
    Lambda handler that processes one SQS message = one batch of ≤50 recipients.
    Deploy with:
      - Reserved concurrency: 1  (guarantees sequential, no TPS collision)
      - Batch size: 1             (one SQS message = one SES bulk call)
      - Max receive count: 3      (after 3 failures → DLQ)

    On Throttling: raise the exception → Lambda fails → SQS visibility timeout
    expires → message becomes visible again → Lambda retries (with natural backoff
    from SQS's visibility timeout, typically 30–300s).
    """
    for record in event["Records"]:
        raw = json.loads(record["body"])
        recipients = [
            Recipient(
                email=r["email"],
                name=r["name"],
                order_id=r["order_id"],
                total=r["total"],
            )
            for r in raw
        ]

        # send_bulk raises on Throttling — SQS will retry this message.
        # Do NOT catch Throttling here and return success; that would ACK the message.
        send_bulk(recipients)


###############################################################################
# Example usage
###############################################################################

if __name__ == "__main__":
    test_recipients = [
        Recipient(
            email=f"user{i}@example.com",
            name=f"User {i}",
            order_id=f"ORD-{1000 + i}",
            total=f"${(i + 1) * 9.99:.2f}",
        )
        for i in range(50)
    ]

    # --- Single batch of exactly 50: one API call, no rate concern ---
    results = send_bulk(test_recipients)
    print(f"Success: {len(results['success'])}")
    print(f"Failed:  {len(results['failed'])}")
    if results["failed"]:
        for f in results["failed"]:
            print(f"  {f['email']}: {f['status']} — {f['error']}")

    # --- Multiple batches: exponential backoff (AWS primary recommendation) ---
    # large_list = [Recipient(...) for ...] * 3  # e.g. 150 recipients
    # for i in range(0, len(large_list), MAX_DESTINATIONS_PER_CALL):
    #     send_bulk_with_backoff(large_list[i:i+MAX_DESTINATIONS_PER_CALL])
    # Throttling → waits 100ms, 200ms, 400ms... self-tunes to actual SES throughput.

    # --- Multiple batches: proactive rate-limited sleep (derived, scripts only) ---
    # results = send_at_rate_with_sleep(large_list, batch_size=14)
    # Still uses exponential backoff internally as fallback.
    # AWS does not prescribe this pattern — see README rate-limiting section.

    # --- Production (Lambda + SQS): no sleep, no rate math ---
    # send_to_many_via_sqs(large_list, queue_url="https://sqs.us-east-1.amazonaws.com/123/ses-bulk-jobs")
