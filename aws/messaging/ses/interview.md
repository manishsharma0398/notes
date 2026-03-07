# SES — Interview Questions

[← README](./README.md) | [← Back to Messaging Index](../prompt.md)

---

## Q1. Your bounce rate spiked from 0.3% to 12% overnight after a marketing batch send. What happened and how do you fix it without losing the ability to send transactional email?

**What the interviewer is testing**: whether you understand reputation isolation, the difference between transactional and marketing sending, and the SES account-level vs configuration-set-level blast radius.

**Traps**:

- "I'll just clean the list and retry" — doesn't address the root cause (stale list, no opt-in validation, shared pool contamination)
- "I'll request AWS to increase my limit" — irrelevant; this is a reputation problem, not a quota problem
- Missing that transactional email is now also at risk because account reputation is shared

**Strong answer**:

1. Immediately stop the marketing batch send. Do not retry.
2. The account bounce rate is a 7-day rolling window — the damage persists; focus on not worsening it.
3. Separate transactional and marketing sends using **dedicated configuration sets per traffic type** and ideally **dedicated IP pools**. Transactional (receipts, password resets) should be on a pool that marketing cannot pollute.
4. Identify the dirty segment: pull bounce events from SNS/Firehose, map to the marketing list segment, quarantine those addresses.
5. Validate the list: run through SES email validation API or a third-party validator. Remove addresses that haven't engaged in 6+ months.
6. Contact AWS support to explain the spike if you're near the pause threshold and have a remediation plan.
7. Long-term: set up a pre-send suppression check against your own bounce/complaint database and the SES account suppression list.

---

## Q2. You send an email via SES and get back a MessageId immediately. Your customer says they never received it. Walk through every place the email could have been silently dropped or delayed.

**What the interviewer is testing**: whether you understand that `MessageId` means "SES accepted it", not "delivered". And whether you have observability into the full delivery pipeline.

**Traps**:

- "If SES returned a MessageId it was delivered" — false. SES accepted it; delivery is async.
- Stopping the investigation at "must be the recipient's spam folder" without data.

**Possible failure points in order**:

1. **SES accepted but delivery event never fired** — SES queued the message but the receiving MX never connected back. Check: absence of `delivery` event in your config set event stream.
2. **Soft bounce loop** — receiving server temporarily rejected (mailbox full, greylisting). SES retries for 72h. Check: `bounce` events with `bounceType: Transient`.
3. **Address in account suppression list** — the send call returned `MessageRejected` but your application ignored the exception, or the address was suppressed silently on a previous attempt. Check: suppression list API / exception logs.
4. **Spam folder placement** — delivery event fired but ISP classified it as spam. Check: Google Postmaster Tools, DMARC reports, complaint events. This is invisible to SES — SES sees it as delivered.
5. **No configuration set attached** — you have zero observability. You don't actually know which of the above happened.
6. **Wrong region** — SES is regional; if your Lambda is in `us-west-2` but your verified identity is in `us-east-1`, you'd get an error, but if the region is valid and wrong, email might be sent from an identity you didn't intend.
7. **DKIM failure at ISP** — DKIM key rotated/deleted, DNS not updated. Receiving server may filter or reject. Check: DMARC aggregate reports (`rua` in your DMARC record).

---

## Q3. You need to send 500,000 transactional emails within a 2-hour window for a scheduled event (e.g., a flash sale notification). Your current SES sending rate is 14 emails/second. Describe your architecture.

**What the interviewer is testing**: whether you understand SES rate limits, the async send pipeline, and how to decompose a burst problem into a tractable queue-based solution.

**Traps**:

- "I'll just call SendEmail in a loop with threads" — will hit throttling, no retry logic, no observability
- "I'll request a higher limit the day before" — quota increases are approved in hours to days; not reliable under deadline pressure
- Not calculating whether 14/s is mathematically sufficient: 14 × 7200 = 100,800 — NOT enough. Need ~70/s minimum for 500k in 2h.

**Strong answer**:

1. **Request a quota increase well in advance** via Service Quotas. Target 200+/s. Factor in that the increase request needs lead time (days, not hours).
2. **Architecture**:
   ```
   Scheduler / batch job
     → batches of 50 (SendBulkTemplatedEmail max)
     → SQS queue (standard, no ordering needed)
       → Lambda (concurrency-capped to match SES TPS)
         → SES SendBulkTemplatedEmail
         → config set events → SNS → DLQ for failures
   ```
3. **Rate control**: Lambda reserved concurrency × batch size × average send duration must not exceed SES TPS. Example: 10 concurrency × 50 batch = 500 sends per Lambda duration cycle. If each invocation takes 1s, that's 500/s send attempts — too high. Tune concurrency.
4. **Failure handling**: on `Throttling` from SES, the Lambda should return a partial failure so SQS re-queues the failed batch items (using partial batch failure response). Do not catch and swallow `Throttling`.
5. **Monitoring**: CloudWatch metric `Send` on your config set, alarm on `Throttling` errors, alarm on `BounceRate` in real time.

---

## Q4. Your application uses SES with DKIM enabled. A customer's IT team reports that their email gateway is rejecting your emails as "DKIM signature verification failed." DKIM was working last week. What do you investigate?

**What the interviewer is testing**: operational knowledge of DKIM key lifecycle and DNS propagation.

**Traps**:

- "SES manages DKIM so I can't investigate" — you still own DNS
- Not distinguishing between the CNAME existing vs actually resolving

**Investigation steps**:

1. **Verify the CNAME records exist**: `dig CNAME <token>._domainkey.yourdomain.com`. If it returns the SES target, the record is in DNS.
2. **Verify the TXT record resolves via the CNAME**: `dig TXT <ses-dkim-endpoint>`. If this fails, there's a DNS propagation or SES-side issue.
3. **Check SES console** — does the identity still show "DKIM: Verified"? If SES shows "Failed" or "Pending", the CNAME was removed or the DNS zone was modified (e.g., during a migration).
4. **Common cause**: DNS zone migration to a new provider (Route 53 → Cloudflare, etc.) where CNAMEs weren't exported. The domain still resolves for A records but DKIM CNAMEs are missing.
5. **Another common cause**: DKIM key rotation. SES can rotate DKIM keys. If SES rotated and you have old keys cached, check if multiple DKIM CNAME records are expected and only some are present.
6. **Fix**: re-add the missing CNAME records, propagation takes up to 72h (usually minutes in practice). During the window, DMARC may fail on DKIM alignment if SPF alignment is also not set up.

---

## Q5. You have a multi-tenant SaaS. Each tenant wants to send email from their own domain via your platform. How do you architect identity management in SES?

**What the interviewer is testing**: cross-account vs shared-account tradeoffs, sending authorization policies, and reputation isolation.

**Traps**:

- "One SES account for all tenants" — one tenant's bounce spike affects all tenants
- "Separate AWS accounts per tenant" — operationally expensive, overkill for most cases

**Option A: Shared SES account, per-tenant domain identities**

- Verify each tenant's domain in your SES account. They add your DKIM CNAMEs to their DNS.
- Use **sending authorization policies** to allow tenant-specific IAM roles to send only from their identity.
- Risk: your account bounce rate is the aggregate of all tenants. One bad tenant poisons the account.
- Mitigation: per-tenant configuration sets with separate dedicated IP pools (expensive: $25/IP/month per tenant).

**Option B: Per-tenant AWS accounts with cross-account sending authorization**

- Each tenant has their own SES identity in their own AWS account (or your account per environment).
- Your platform assumes a role or uses SES sending authorization to send on their behalf.
- Better reputation isolation. Higher operational overhead.

**Option C: SES account per tier (shared, premium)**

- Tenants are bucketed into shared or premium SES accounts.
- Premium tenants get dedicated IPs and isolated reputation pools.
- Good balance of cost vs isolation.

**Production recommendation**: Option A with per-tenant configuration sets and IP pool assignment, plus strict bounce/complaint monitoring with automated tenant suspension if their metrics exceed thresholds. This protects the overall account reputation while sharing infrastructure costs.
