# SES — Revision Notes

[← README](./README.md) | [← Back to Messaging Index](../prompt.md) | [← Back to AWS Index](../../prompt.md)

---

1. **SES is a reputation-gated relay** — you own the domain reputation. Bounce rate > 10% or complaint rate > 0.5% pauses your account. AWS monitors a rolling 7-day window. There is no grace period; your account goes dark.

2. **Authentication is three separate checks** — DKIM (SES signs with your key in DNS), SPF (authorize IPs via MAIL FROM subdomain for alignment), DMARC (policy over SPF+DKIM alignment). You need DKIM verified + custom MAIL FROM domain for full DMARC alignment. DKIM is more reliable; do not skip it.

3. **Account suppression list is automatic but silent** — SES adds hard bounce and complaint addresses automatically. Sending to a suppressed address returns `MessageRejected` (not a bounce), costs quota, and means you need to handle the exception explicitly. You can query and remove suppression entries via the v2 API.

4. **Configuration sets are your observability hook** — without one, you're blind to what happens after `send`. Attach a config set to every send call, route events to SNS→SQS→Lambda (or Firehose→S3 for analytics). Events: `send`, `delivery`, `bounce`, `complaint`, `open`, `click`, `renderingFailure`, `deliveryDelay`.

5. **Throttling is your problem to handle** — SES returns HTTP 400 `Throttling` when you exceed TPS limits. It does not buffer. The correct pattern: publish send jobs to an SQS queue, have a Lambda poll it with a controlled concurrency ceiling that matches your SES sending rate. Never call SES synchronously from your API path at scale.

6. **Dedicated IPs require warmup** — a fresh IP has no sending reputation. ISPs see it as suspicious. Warm by doubling volume weekly over 4–6 weeks. SES auto-warmup exists but is slow. Skipping warmup means deliverability failures that don't show up as bounces — they show up as spam folder placement.

7. **v2 API is the right default** — `boto3.client('sesv2')`, cleaner send structure, suppression list management APIs, list subscription support. v1 still works but has fewer features.
