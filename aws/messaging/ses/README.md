# AWS SES — Simple Email Service

[← Back to Messaging Index](../prompt.md) | [← Back to AWS Index](../../prompt.md)

---

## Mental Model

SES is **not** a fire-and-forget queue. It is a **reputation-gated email relay** with a shared (or dedicated) IP infrastructure managed by AWS.

The fundamental constraint: **your domain/IP reputation is a resource you can exhaust**. Email providers (Gmail, Outlook, Yahoo) score your sending reputation based on bounce rates, complaint rates, spam trap hits, and engagement. SES is the plumbing; reputation is the variable you are actually managing.

```
Your App
  │
  ├── AWS SDK / SMTP interface
  │       │
  │       ▼
  │   SES API (identity validation → rate limiting → queue)
  │       │
  │       ├── Shared IP pool  (default)
  │       └── Dedicated IP pool  (opt-in, ~$24.95/IP/month)
  │               │
  │               ▼
  │       Receiving Mail Server (Gmail, Outlook, etc.)
  │               │
  │       ┌───────┴────────────────────┐
  │       │                            │
  │    Delivered                  Bounced / Complained
  │                                    │
  │                            SES Notification
  │                            (SNS / Config Set)
  │                                    │
  │                            YOUR app must handle this
  │                            or SES pauses your account
```

The key insight: **SES does not protect you from yourself.** If you blast bad addresses, SES will take the hit at ISPs and then punish your account — silently at first, then visibly by pausing sending.

---

## Core Concepts

### 1. Identities

Before you send, you must **verify** either:

- An **email address** — simple, but limits sending to `From: <that-address>`
- A **domain** — allows sending from any address in the domain; required for production

Verification proves you control the domain/address. It does **not** authenticate your email. Authentication is DKIM/SPF.

### 2. Authentication (DKIM, SPF, DMARC)

These are three separate mechanisms. Passing one doesn't mean passing all three. DMARC requires **alignment**.

| Mechanism | What it does                             | Where it lives                                   |
| --------- | ---------------------------------------- | ------------------------------------------------ |
| **SPF**   | Authorizes IPs to send for your domain   | DNS TXT record (`v=spf1`)                        |
| **DKIM**  | Cryptographic signature on email headers | DNS TXT record (public key) + SES signs outbound |
| **DMARC** | Policy: what to do if SPF or DKIM fails  | DNS TXT record (`_dmarc.yourdomain.com`)         |

**DKIM in SES**: SES generates a private key, gives you the public key CNAME to add to DNS. SES signs all outbound mail from your domain with this key. Receiving servers verify the signature.

**SPF in SES**: SES sends from its own IP space (`amazonses.com`). For SPF alignment with DMARC, you need `Return-Path` to match your domain — achieved by setting a **custom MAIL FROM domain** (a subdomain of yours, e.g., `mail.yourdomain.com`).

**DMARC alignment failure scenario**:

```
From: noreply@yourdomain.com
Return-Path: bounce.amazonses.com   ← SPF passes for amazonses.com, NOT yourdomain.com
                                     ← DMARC SPF check fails (misalignment)
DKIM: passes for yourdomain.com     ← DMARC DKIM check passes

Result: DMARC passes (only one needs to align) — but without DKIM this would fail
```

→ Always verify DKIM. DKIM alignment is more reliable than SPF alignment in SES.

### 3. Sending Interface

Two ways to send:

**API (recommended)**

- `SendEmail` — simple: subject, body, to/from
- `SendRawEmail` — full MIME control: attachments, custom headers
- `SendBulkTemplatedEmail` — template substitution, up to 50 destinations per call

**SMTP Interface**

- Endpoint: `email-smtp.<region>.amazonaws.com:587` (STARTTLS) or 465 (TLS)
- Auth: SMTP credentials (NOT your AWS access key — generate separate SMTP credentials in IAM → SES)
- Useful for apps that only support SMTP (e.g., legacy apps, WordPress)

### 4. Sending Limits

New SES accounts start in **sandbox mode**:

- Can only send to **verified** email addresses/domains
- Max 200 emails/day
- Max 1 email/second

Production access is requested manually (or via Terraform/API). AWS reviews and enables it:

- Default: 50,000 emails/day, 14 emails/second (region-specific)
- Can be increased via support ticket / Service Quotas

**Throttling behavior**: SES returns `Throttling` error (HTTP 400, error code `Throttling`). You must implement exponential backoff. SES does **not** queue for you on throttle.

### 5. Configuration Sets

A **configuration set** is a named set of rules applied to a group of emails. Attach it to a send call via `ConfigurationSetName` parameter.

What you configure per set:

- **Event destinations** — where to publish sending events
- **Sending pool** — which dedicated IP pool to use
- **Suppression list scope** — account-level vs configuration-set-level
- **Reputation metrics** — enable CloudWatch metrics per config set

**Event types** you can publish:
| Event | Meaning |
|-------|---------|
| `send` | SES accepted the message |
| `delivery` | Receiving server accepted the message |
| `bounce` | Permanent or transient delivery failure |
| `complaint` | Recipient marked as spam (via ISP feedback loop) |
| `open` | Recipient opened the email (pixel tracking) |
| `click` | Recipient clicked a tracked link |
| `renderingFailure` | Template substitution failed |
| `deliveryDelay` | Delivery taking longer than expected |
| `subscription` | List management action (unsubscribe/subscribe) |

**Event destinations**:

- SNS topic (push each event as JSON)
- CloudWatch (aggregate metrics only)
- Kinesis Data Firehose (stream events to S3/Redshift)

### 6. Bounces and Complaints — The Critical Path

This is where accounts get paused.

**Hard bounce**: permanent failure — address doesn't exist, domain doesn't exist, server explicitly rejects.
**Soft bounce**: transient failure — mailbox full, server temporarily unavailable. SES retries over 72 hours.

**Thresholds that trigger account review/pause**:

- Bounce rate > **5%** → AWS sends warning
- Bounce rate > **10%** → sending paused
- Complaint rate > **0.1%** → warning
- Complaint rate > **0.5%** → sending paused

These thresholds are monitored by AWS on a rolling 7-day window per sending identity.

**Account-level suppression list**: SES automatically adds hard bounce and complaint addresses to your account suppression list. Attempting to send to a suppressed address returns `MessageRejected` — SES won't even attempt delivery. This protects your reputation.

```
First send to bad@example.com
  → Hard bounce
  → SES adds bad@example.com to account suppression list

Second send to bad@example.com
  → SES rejects immediately (MessageRejected)
  → No delivery attempt, no reputation hit
  → BUT still counts toward your daily quota
```

**Handling bounce/complaint notifications**:

You MUST set up bounce/complaint handling. The production-grade approach:

```
SES → SNS Topic (bounce/complaint) → SQS Queue → Lambda → Mark address in your DB
```

Never send to bounced/complained addresses again. Unsubscribe complaint addresses automatically; do not rely on users to re-opt-in.

### 7. Dedicated IP Pools

Shared pools: your sending reputation is influenced (partially) by other SES customers. AWS segments shared pools so high-volume senders don't drag small ones, but you have no isolation guarantee.

Dedicated IPs: your sending reputation is entirely yours. You "warm" the IP yourself (gradually increasing volume over weeks). If you don't warm properly, ISPs treat the new IP as suspicious.

**When to use dedicated IPs**:

- Volume > 100k emails/day
- You need ISP feedback loops attributed to your specific IP
- You need reputation isolation between email types (transactional vs marketing)

**Warming a dedicated IP**:

```
Week 1: 200/day
Week 2: 500/day
Week 3: 1,000/day
Week 4: 5,000/day
... double every week with good engagement metrics
```

SES has an **auto-warmup** feature but it's conservative. For aggressive ramp-up, disable it and warm manually.

### 8. Bulk Sending (`SendBulkEmail`)

**When**: you need to send the same email structure to multiple recipients, each potentially with different personalisation (name, order ID, coupon code, etc.).

For 50 recipients — one `SendBulkEmail` call is enough. The hard limit is **50 destinations per call**.

#### How it works

1. **Create an SES template** (once, reuse forever):
   - HTML body, text body, subject — all support `{{variable_name}}` substitution tokens.
   - Stored in SES, referenced by name at send time.

2. **Call `SendBulkEmail`** with:
   - A **default template data** object (fallback values for all tokens)
   - A list of up to 50 **destination objects**, each with its own template data override and `To/CC/BCC` addresses

3. **SES renders** each email server-side by merging per-destination data over the default data, then sends independently.

```
SendBulkEmail call
  ├── template: "order-confirmation"
  ├── default data: { "support_email": "help@store.com" }
  └── destinations[]:
        ├── [0] to: alice@acme.com   data: { "name": "Alice", "order_id": "A-001" }
        ├── [1] to: bob@corp.com     data: { "name": "Bob",   "order_id": "B-042" }
        └── ... up to 50 entries

SES renders independently per entry and sends 50 separate emails.
```

#### Key behaviour

| Property                  | Detail                                                                                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Destinations per call** | Max **50**                                                                                                                                                                        |
| **Rate accounting**       | 50 destinations = 50 sends against your TPS limit. One `SendBulkEmail` call for 50 recipients still counts as 50 sends/second if it resolves instantly.                           |
| **Billing**               | $0.10 per 1,000 emails — 50 recipients = 50 billable sends                                                                                                                        |
| **Partial failures**      | A `renderingFailure` or suppressed address for one destination does NOT fail the whole call. The response includes a per-destination `Status` field. You must check each entry.   |
| **Template requirement**  | Must use a pre-created SES template. You cannot inline HTML in a bulk call (use `SendEmail` for that).                                                                            |
| **Config set**            | Applied at the call level, not per destination. All 50 share the same event routing.                                                                                              |
| **Suppression**           | SES checks each destination against the suppression list independently before sending. Suppressed destinations return `MessageRejected` status in the response, not an exception. |

#### Failure handling — the trap

`SendBulkEmail` **does not raise an exception for per-destination failures**. It returns HTTP 200 with a list of statuses. If you don't iterate the response, you silently miss failures.

```
Response shape:
{
  "BulkEmailEntryResults": [
    { "Status": "SUCCESS",          "MessageId": "..." },
    { "Status": "MESSAGE_REJECTED", "Error": "Address suppressed" },
    { "Status": "FAILED",           "Error": "Template rendering failure: missing variable 'order_id'" },
    ...
  ]
}
```

Process every entry. Collect `FAILED`/`MESSAGE_REJECTED` entries and handle them explicitly (retry, log, alert).

#### Rate limiting with bulk send — AWS does NOT protect you

SES TPS limits apply to **emails sent**, not **API calls made**.

```
Default production limit: 14 emails/second

SendBulkEmail(50 destinations) = 50 emails
  → consumes 50/14 = 3.57 seconds of rate budget instantly

Two back-to-back bulk calls with no gap:
  Call 1: 50 emails → OK
  Call 2: 50 emails → Throttling (HTTP 400)   ← AWS rejects the entire call
```

AWS does not slow-drip, buffer, or smooth your sends. You get a `Throttling` error and it is entirely your responsibility to handle it.

**What AWS actually recommends** ([source: AWS Messaging Blog](https://aws.amazon.com/blogs/messaging-and-targeting/how-to-handle-a-throttling-maximum-sending-rate-exceeded-error/))

AWS does not prescribe "sleep N seconds between calls." Their documented strategies are:

| Strategy                          | Description                                                                                        | AWS recommendation                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Exponential backoff**           | Wait and retry _after_ receiving a `Throttling` error; double the wait on each consecutive failure | ✅ Primary recommendation                                                                     |
| **Proactive rate limiting**       | Cap your send rate using a token-bucket or leaky-bucket limiter _before_ hitting SES               | ✅ Also recommended                                                                           |
| **Downscale**                     | Reduce threads / add delays if you're consistently over the limit                                  | ✅ Mentioned                                                                                  |
| **Sleep N seconds between calls** | Pre-calculated fixed delay                                                                         | ❌ Not prescribed — brittle because network latency and message size affect actual throughput |

AWS's own words: _"The advantage of the exponential backoff approach is that your application will self-tune and it will call Amazon SES at close to the maximum allowed rate."_

**Exponential backoff — what AWS actually recommends**

```python
import time
import random
from botocore.exceptions import ClientError

def send_bulk_with_backoff(recipients, max_retries=5):
    wait = 0.1  # 100ms initial wait
    for attempt in range(max_retries):
        try:
            return send_bulk(recipients)
        except ClientError as e:
            if e.response["Error"]["Code"] == "Throttling":
                if attempt == max_retries - 1:
                    raise
                jitter = random.uniform(0, wait)       # avoid thundering herd
                time.sleep(wait + jitter)
                wait = min(wait * 2, 30)               # cap at 30s
            else:
                raise
```

Self-tunes to your actual throughput. Works regardless of message size, network latency, or SES availability fluctuations.

**Proactive rate limiting (derived approach — valid but not AWS-prescribed)**

If you know your chunk size exactly and want to avoid ever hitting `Throttling`, you can pre-calculate a sleep window. This is a user-derived implementation of option 2 above — AWS does not document it this way:

```python
# Derived: 14 recipients/batch × 1 batch/second = 14 emails/second
t_start = time.monotonic()
send_bulk(chunk)                               # consumes up to 14 tokens
elapsed = time.monotonic() - t_start
remaining = (len(chunk) / SES_TPS_LIMIT) - elapsed
if remaining > 0:
    time.sleep(remaining)                      # wait for token bucket to refill
```

Correct in theory but brittle in practice: SES does not guarantee the token bucket refills at exactly 14/s — it can vary under load. If you slightly underestimate the sleep and hit `Throttling`, you need fallback backoff logic anyway. This means you end up implementing exponential backoff _on top of_ the sleep, which makes the sleep redundant.

**Approach C — SQS-backed worker (production, what you should actually use)**

```
your code
  → push each ≤14-recipient chunk as a SQS message
    → Lambda (reserved concurrency = 1, batch size = 1)
      → SES SendBulkEmail
        if Throttling → Lambda raises → SQS backs off → retries automatically
```

No sleep. No rate math. Natural exponential backoff via SQS visibility timeout. This is the pattern that holds up at scale.

#### Template constraints — what you can and cannot vary per recipient

SES templates use **`{{variable}}` substitution only**. This is not Handlebars, Jinja, or any logic-capable engine. There are no conditionals, no loops, no nested object access.

| What you CAN vary per recipient                            | What you CANNOT vary per recipient                       |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| Any `{{token}}` value (name, order ID, URL, dollar amount) | The HTML structure / layout                              |
| Subject line text (subject is also a template field)       | Which sections of the email are shown                    |
| Links (inject a full URL as a variable)                    | The From address or Reply-To                             |
| Locale-specific text (inject translated strings)           | The template itself — all 50 use the same `TemplateName` |

**Example of what is/isn't possible**:

```
✅ Subject: "Hi {{name}}, your order {{order_id}} is confirmed"
✅ Body: "Your total is {{total}}"
✅ CTA link: <a href="{{cta_url}}">View Order</a>

❌ Show a "VIP" section for some recipients and not others  ← no conditionals
❌ Iterate a list of ordered items                          ← no loops
❌ Use a different email layout for different product types ← one template only
```

If you need conditional content, flatten it before the call: pre-render the conditional parts in application code, inject the final HTML chunk as a `{{content_block}}` variable. This works but means your template is mostly a wrapper, which is fine for simple cases.

#### Template must be pre-saved in SES — always

You cannot inline HTML in `SendBulkEmail`. There is no `TemplateContent` field in the bulk call — only `TemplateName`. The template must:

1. Exist in SES in the **same region** as your send call
2. Be created before you call `SendBulkEmail` (deployment-time, not request-time)
3. Be updated via `UpdateEmailTemplate` API when content changes — there is no versioning; updating overwrites the stored template immediately

**Region trap**: if your app is in `us-west-2` but the template was created in `us-east-1`, the call fails with `TemplateDoesNotExistException`. Templates are not global.

#### Sending completely different emails to each recipient

If you need structurally different emails per recipient — different layouts, different conditional sections, different From addresses — `SendBulkEmail` cannot do it. Your options:

| Scenario                                 | Approach                                                           |
| ---------------------------------------- | ------------------------------------------------------------------ |
| Same structure, different values         | `SendBulkEmail` (1 call, ≤ 50 recipients)                          |
| Conditional sections, same base template | Pre-render blocks in app code, inject as `{{variable}}`            |
| Completely different HTML per recipient  | `SendEmail` loop (1 call per recipient)                            |
| Different From address per recipient     | `SendEmail` loop — From is a call-level field, not per-destination |
| 50 recipients, all different templates   | 50 × `SendEmail` calls                                             |

For `SendEmail` in a loop at scale: do not call SES synchronously from your API path. Produce send jobs to SQS and consume with a rate-capped worker — same pattern as the bulk queue.

#### Choosing between `SendEmail` loop vs `SendBulkEmail`

|                              | `SendEmail` in loop           | `SendBulkEmail` (single call)                     |
| ---------------------------- | ----------------------------- | ------------------------------------------------- |
| Max recipients               | Unlimited (rate-limited)      | 50 per call                                       |
| Template required            | No — inline HTML              | Yes — pre-created, region-local template          |
| Per-recipient HTML structure | Full control                  | Same template for all                             |
| Conditional content          | Full control                  | Flatten conditionals into variables               |
| Partial failure visibility   | Exception per call            | Response status per destination — HTTP 200 always |
| API call overhead            | N calls                       | 1 call (for ≤ 50)                                 |
| Best for                     | Varied/personalised structure | Uniform structure, data-varied content            |

For > 50 recipients with the same template: chunk into batches of 50 and call `SendBulkEmail` once per batch. At high volume, feed chunks into an SQS queue and process with a rate-capped Lambda.

→ See [`examples/bulk_send.py`](./examples/bulk_send.py)

---

## Sending Flow (Sequence Diagram)

```
App              SES API           DNS (ISP lookup)     Receiving MX
 │                  │                    │                   │
 │── SendEmail ────►│                    │                   │
 │   (ConfigSet,    │                    │                   │
 │    Identity,     │── verify identity ─┤                   │
 │    From/To/Body) │◄── OK ─────────────┤                   │
 │                  │                    │                   │
 │                  │── rate limit check │                   │
 │                  │   (per-second)     │                   │
 │                  │                    │                   │
 │                  │── check suppression list               │
 │                  │   if suppressed → reject               │
 │                  │                    │                   │
 │◄── MessageId ────│                    │                   │
 │                  │── DKIM sign ───────┤                   │
 │                  │── SMTP connect ───────────────────────►│
 │                  │── DATA (email) ────────────────────────►│
 │                  │◄── 250 OK (accepted) ──────────────────│
 │                  │                    │                   │
 │                  │── publish `delivery` event to SNS      │
 │                  │                    │                   │
 │                  │   ... if ISP marks spam ...            │
 │                  │◄── complaint via feedback loop ────────│
 │                  │── publish `complaint` event to SNS     │
 │                  │── add to suppression list              │
```

---

## Failure Modes

| Failure                               | Root cause                                      | Detection                                         | Mitigation                                                    |
| ------------------------------------- | ----------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| Emails delivered but going to spam    | Low domain reputation, no DKIM, no DMARC policy | ISP postmaster tools (Google Postmaster, SNDS)    | Fix DKIM/DMARC, warm IP, reduce complaint rate                |
| Account paused — bounce rate          | Sending to stale lists, purchased lists         | CloudWatch `BounceRate` metric, bounce SNS events | Validate emails pre-send, honor suppressions, clean lists     |
| Account paused — complaint rate       | Sending unsolicited/unexpected email            | CloudWatch `ComplaintRate`, complaint SNS events  | Unsubscribe immediately, audit opt-in flows                   |
| `MessageRejected` on send             | Address in suppression list                     | SDK exception                                     | Query suppression list before send or handle exception        |
| `Throttling` error                    | Exceeding TPS limit                             | SDK exception (400)                               | Exponential backoff + jitter, queue sends via SQS             |
| Template rendering failure            | Missing substitution variable                   | `renderingFailure` event                          | Validate substitution data pre-send, add defaults in template |
| DKIM verification failure at ISP      | DKIM DNS record not propagated or deleted       | DMARC report / ISP bounce message                 | Verify DKIM records in DNS, use `dig TXT` to validate         |
| Soft bounce storm                     | Receiving server overloaded                     | `bounce` events with `bounceType: Transient`      | SES retries automatically for 72h; investigate if persists    |
| Sandbox sending to unverified address | Account still in sandbox                        | `MessageRejected`                                 | Request production access via support / quotas                |

---

## Cost Model

- **Per email**: $0.10 per 1,000 emails sent
- **Attachments**: $0.12 per GB of attachments
- **Dedicated IPs**: $24.95/IP/month (regardless of volume)
- **Inbound email**: $0.10 per 1,000 received (first 1,000 free)
- **No charge** for: bounces, complaints, suppression list operations, configuration set existence

**Where cost accumulates unexpectedly**:

- Suppressed addresses still count toward daily quota but generate no delivery event — you pay for the send, get no delivery
- Retry attempts on soft bounces — each retry attempt counts as a new send for billing purposes? **No** — SES retries are internal and not billed separately. The original `SendEmail` call is the only billable event.
- `open`/`click` tracking uses redirect proxies hosted by SES — no additional charge but adds latency to link clicks

---

## Inbound Email (Receiving)

SES can receive email for your domain and route it:

```
Inbound MX record → SES → Rule set
                              ├── S3 (store full email as .eml)
                              ├── SNS (publish as JSON)
                              ├── Lambda (invoke with parsed email)
                              └── Bounce (reject with 5xx)
```

**Rule sets** are evaluated in order, first match wins. A domain can only receive mail in one region (your MX record points to one SES region endpoint).

**Use cases**: automated email parsing, support ticket ingestion, inbound webhook via email, spam filtering pipeline.

---

## VPC Endpoints

SES supports VPC Interface Endpoints (PrivateLink), allowing EC2/Lambda in a VPC to call SES API without traversing the public internet. Useful for compliance requirements (data never leaves AWS network).

Note: SMTP interface also works over VPC endpoints since SES v2 (verify per region).

---

## SES v1 vs SES v2 API

AWS has two API versions. Prefer **v2** for new projects:

- v2 has suppression list management APIs
- v2 has `SendEmail` with `EmailContent` (cleaner structure)
- v2 supports list management (subscription tracking)
- v1 still works but lacks newer features

SDK:

```python
import boto3
ses = boto3.client('sesv2', region_name='us-east-1')  # v2
ses = boto3.client('ses', region_name='us-east-1')    # v1
```
