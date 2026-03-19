"""
SES v2 — Send transactional email with configuration set.
Always attach a configuration set so delivery/bounce/complaint events are routed.
"""

import boto3
from botocore.exceptions import ClientError

ses = boto3.client("sesv2", region_name="us-east-1")


def send_transactional_email(
    to_address: str,
    subject: str,
    html_body: str,
    text_body: str,
    from_address: str = "noreply@yourdomain.com",
    reply_to: str = "support@yourdomain.com",
    config_set: str = "transactional",  # separate config set from marketing
):
    try:
        response = ses.send_email(
            FromEmailAddress=from_address,
            ReplyToAddresses=[reply_to],
            Destination={"ToAddresses": [to_address]},
            Content={
                "Simple": {
                    "Subject": {"Data": subject, "Charset": "UTF-8"},
                    "Body": {
                        "Html": {"Data": html_body, "Charset": "UTF-8"},
                        "Text": {"Data": text_body, "Charset": "UTF-8"},
                    },
                }
            },
            ConfigurationSetName=config_set,
            # Tag emails to segment metrics in CloudWatch/Firehose
            EmailTags=[
                {"Name": "email_type", "Value": "transactional"},
                {"Name": "service", "Value": "auth"},
            ],
        )
        return response["MessageId"]

    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "MessageRejected":
            # Address is on the account suppression list — do not retry
            # Mark in your DB as suppressed
            raise SuppressionError(to_address) from e
        elif code == "Throttling":
            # Do not swallow — let the caller retry with backoff
            # Or better: don't call SES directly from API path; use SQS worker
            raise
        elif code == "SendingPausedException":
            # Account paused by AWS — page on-call immediately
            raise CriticalSESError(
                "SES account paused — check bounce/complaint rates"
            ) from e
        else:
            raise


class SuppressionError(Exception):
    def __init__(self, address):
        self.address = address
        super().__init__(f"Address suppressed: {address}")


class CriticalSESError(Exception):
    pass


# --- Check if address is suppressed before sending ---
def is_suppressed(address: str) -> bool:
    try:
        ses.get_suppressed_destination(EmailAddress=address)
        return True
    except ses.exceptions.NotFoundException:
        return False


# --- Remove from suppression list (e.g., after user re-opts-in with confirmed re-engagement) ---
def remove_from_suppression(address: str):
    ses.delete_suppressed_destination(EmailAddress=address)
