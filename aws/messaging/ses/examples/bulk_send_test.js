/**
 * SES v2 — Bulk email throttle test (sandbox)
 *
 * PURPOSE
 * -------
 * Deliberately trigger SES throttling to observe exactly what AWS returns:
 *   - Top-level Throttling rejection (TooManyRequestsException, HTTP 429)
 *   - Per-destination failures inside a 200 response (BulkEmailEntryResults)
 *
 * SANDBOX RATE LIMITS (as of 2024)
 * ---------------------------------
 *   Max send rate : 1 email/second
 *   Daily quota   : 200 emails
 *   Recipients    : must be verified in SES console
 *
 * A SendBulkEmail call with N destinations counts as N sends against the rate limit.
 * Two parallel calls of 3 recipients each = 6 sends/s against a 1/s cap → Throttling.
 *
 * PREREQUISITES
 * -------------
 *   1. AWS credentials in env / ~/.aws/credentials with ses:SendEmail permission
 *   2. FROM_ADDRESS verified as SES identity (sandbox: also verify all RECIPIENTS)
 *   3. node >= 18, run: npm install
 *
 * USAGE
 *   node bulk_send_test.js
 *
 * AWS SDK v3 — @aws-sdk/client-sesv2
 */

import {
  SESv2Client,
  SendBulkEmailCommand,
  SendEmailCommand,
  CreateEmailTemplateCommand,
  DeleteEmailTemplateCommand,
} from "@aws-sdk/client-sesv2";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — edit these before running
// ─────────────────────────────────────────────────────────────────────────────

const REGION = "ap-south-1";

// Must be a verified SES identity in your account.
const FROM_ADDRESS = "hello@themanishsharma.in";

// Sandbox: every address here must be individually verified in SES console.
// Add at least 2 addresses so batches have something to send to.
const RECIPIENTS = [
  { email: "manish.sharma0398@gmail.com", name: "Test User One" },
  { email: "webdevmanish8@gmail.com", name: "Test User Two" },
];

// Unique-enough to avoid collision with real templates.
const TEMPLATE_NAME = `ses-throttle-test-${Date.now()}`;

// How many parallel bulk calls to fire in the backoff test.
const NUM_PARALLEL_BATCHES = 3;

// Flood test: how many individual SendEmail calls to fire per round.
// SES sandbox token bucket burst capacity is undocumented but empirically > 18.
// FLOOD_COUNT=30 fires 30 sends per round; rounds repeat back-to-back until
// the bucket is exhausted and TooManyRequestsException surfaces.
// At 200/day daily limit, max 5 rounds = 150 sends — leave headroom.
const FLOOD_COUNT = 30;
const FLOOD_MAX_ROUNDS = 4; // hard cap: 4×30 = 120 sends max

// HTML variable test mode:
//   "basic"         -> same htmlContent for every recipient (escape vs raw demo)
//   "per-recipient" -> different htmlContent per recipient
//   "both"          -> run both tests (uses more daily quota)
const HTML_TEST_MODE = "per-recipient";

// ─────────────────────────────────────────────────────────────────────────────

// maxAttempts: 1 — CRITICAL for observing throttling.
//
// AWS SDK v3 has built-in retry middleware (default: 3 attempts, exponential backoff).
// With the default client, SDK silently retries TooManyRequestsException and your
// Promise.allSettled() sees only successes — throttling never surfaces to app code.
//
// Setting maxAttempts: 1 disables SDK retries so the raw TooManyRequestsException
// propagates immediately. Our own backoff logic in sendWithBackoff() handles retries
// explicitly in the backoff test.
const client = new SESv2Client({ region: REGION, maxAttempts: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// Template lifecycle
// ─────────────────────────────────────────────────────────────────────────────

async function createTemplate() {
  const cmd = new CreateEmailTemplateCommand({
    TemplateName: TEMPLATE_NAME,
    TemplateContent: {
      Subject: "SES throttle test — {{label}}",
      Html: [
        `<p>Hi {{name}},</p>`,
        `<p>This is batch <strong>{{label}}</strong>.</p>`,
        ``,
        `<!-- VARIABLE RENDERING TEST -->`,
        `<!-- double-brace {{htmlContent}}: SES HTML-escapes the value -->`,
        `<!-- triple-brace {{{htmlContent}}}: SES injects raw, unescaped -->`,
        ``,
        `<p><strong>Double brace (escaped):</strong><br>{{htmlContent}}</p>`,
        `<p><strong>Triple brace (raw HTML):</strong><br>{{{htmlContent}}}</p>`,
      ].join("\n"),
      Text: "Hi {{name}}, batch {{label}}.\n\nContent (plain): {{htmlContent}}",
    },
  });

  try {
    await client.send(cmd);
    console.log(`[template] Created: ${TEMPLATE_NAME}`);
  } catch (err) {
    if (err.name === "AlreadyExistsException") {
      console.log(`[template] Already exists, reusing: ${TEMPLATE_NAME}`);
    } else {
      throw err;
    }
  }
}

async function deleteTemplate() {
  try {
    await client.send(
      new DeleteEmailTemplateCommand({ TemplateName: TEMPLATE_NAME }),
    );
    console.log(`[template] Deleted: ${TEMPLATE_NAME}`);
  } catch {
    // Best-effort cleanup — don't mask the main error
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core send — single bulk call
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send one bulk batch synchronously (no retry).
 * Returns { success: string[], failed: Array<{email, status, error}> }
 *
 * KEY POINT: SendBulkEmail returns HTTP 200 even when individual destinations
 * fail. You MUST iterate BulkEmailEntryResults — the top-level response tells
 * you nothing about per-destination outcomes.
 */
async function sendBulkBatch(recipients, batchLabel) {
  const entries = recipients.map((r) => ({
    Destination: { ToAddresses: [r.email] },
    ReplacementTemplateData: JSON.stringify({ name: r.name }),
  }));

  const cmd = new SendBulkEmailCommand({
    FromEmailAddress: FROM_ADDRESS,
    DefaultContent: {
      Template: {
        TemplateName: TEMPLATE_NAME,
        TemplateData: JSON.stringify({
          name: "Valued Customer",
          label: batchLabel,
        }),
      },
    },
    BulkEmailEntries: entries,
  });

  const response = await client.send(cmd);

  // HTTP 200 — now check each destination individually
  const results = response.BulkEmailEntryResults ?? [];
  const success = [];
  const failed = [];

  for (let i = 0; i < results.length; i++) {
    const { Status, Error: errMsg, MessageId } = results[i];
    const email = recipients[i]?.email ?? `index-${i}`;

    if (Status === "SUCCESS") {
      success.push({ email, messageId: MessageId });
    } else {
      // Per-destination failure status values (returned inside HTTP 200):
      //   MESSAGE_REJECTED   — address on the account suppression list
      //   FAILED             — rendering failure, invalid address format
      //   ACCOUNT_SUSPENDED  — account paused by AWS (page on-call immediately)
      //   ACCOUNT_THROTTLED  — rate limit exceeded for this destination.
      //                        This is NOT a top-level exception (HTTP is 200).
      //                        The call "succeeded" at the API level but SES refused
      //                        this recipient. Retry the throttled destinations only.
      failed.push({ email, status: Status, error: errMsg ?? "unknown" });
    }
  }

  // isThrottled=true only for ACCOUNT_THROTTLED (rate limit — recovers in seconds, retryable).
  // ACCOUNT_DAILY_QUOTA_EXCEEDED is a separate condition — not retryable until midnight UTC.
  const isThrottled = failed.some((f) => f.status === "ACCOUNT_THROTTLED");

  return { batchLabel, success, failed, isThrottled };
}

// ─────────────────────────────────────────────────────────────────────────────
// Burst test — deliberately trigger throttling
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FLOOD TEST — fire FLOOD_COUNT individual SendEmailCommand calls simultaneously.
 *
 * Strategy: repeated back-to-back rounds with no pause between them.
 *   - Each round fires FLOOD_COUNT parallel sends at once.
 *   - The SES token bucket refills at 1 token/second (sandbox).
 *   - The bucket has some undocumented burst capacity (empirically > 18).
 *   - Back-to-back rounds drain the bucket faster than it refills.
 *   - Once the bucket is empty, TooManyRequestsException surfaces.
 *
 * Why individual SendEmailCommand instead of SendBulkEmailCommand here:
 *   - No template needed — simpler, no setup overhead.
 *   - Each call = 1 email against the rate limit (same as bulk per-destination).
 *   - More representative of real Lambda-per-event send patterns.
 *   - Easier to count: N parallel calls = exactly N sends.
 *
 * Promise.allSettled() vs Promise.all():
 *   Promise.all()        — rejects on FIRST failure, hides all other results.
 *   Promise.allSettled() — waits for ALL to settle; gives fulfilled + rejected together.
 *   We use allSettled so we see WHICH specific calls throttled, not just "something failed".
 */
async function runBurstTest() {
  console.log("\n" + "=".repeat(60));
  console.log("BURST/FLOOD TEST — rapid back-to-back rounds until Throttling");
  console.log("=".repeat(60));
  console.log(
    `${FLOOD_COUNT} parallel sends per round, up to ${FLOOD_MAX_ROUNDS} rounds.` +
      `\nMax emails this test: ${FLOOD_COUNT * FLOOD_MAX_ROUNDS} (sandbox daily limit: 200)\n`,
  );

  // Rotate recipients so every parallel call has a distinct destination.
  // (All RECIPIENTS must be verified in sandbox.)
  const floodRecipients = Array.from(
    { length: FLOOD_COUNT },
    (_, i) => RECIPIENTS[i % RECIPIENTS.length],
  );

  for (let round = 1; round <= FLOOD_MAX_ROUNDS; round++) {
    console.log(
      `--- Round ${round}/${FLOOD_MAX_ROUNDS} (${FLOOD_COUNT} sends fired simultaneously) ---`,
    );

    const settled = await Promise.allSettled(
      floodRecipients.map((r) =>
        client.send(
          new SendEmailCommand({
            FromEmailAddress: FROM_ADDRESS,
            Destination: { ToAddresses: [r.email] },
            Content: {
              Simple: {
                Subject: { Data: `Flood test r${round}` },
                Body: {
                  Text: { Data: "SES throttle test — ignore this email." },
                },
              },
            },
          }),
        ),
      ),
    );

    const fulfilled = settled.filter((s) => s.status === "fulfilled");
    const rejected = settled.filter((s) => s.status === "rejected");
    const throttled = rejected.filter(
      (s) => s.reason?.name === "TooManyRequestsException",
    );
    const otherErr = rejected.filter(
      (s) => s.reason?.name !== "TooManyRequestsException",
    );

    console.log(`  fulfilled : ${fulfilled.length}`);
    console.log(
      `  rejected  : ${rejected.length}  (throttled=${throttled.length}, other=${otherErr.length})`,
    );

    if (throttled.length > 0) {
      // Print details for the first throttled call only — they're all identical
      const err = throttled[0].reason;
      console.log("\n  ════ THROTTLING OBSERVED ════");
      console.log(`  error name       : ${err.name}`);
      console.log(`  message          : ${err.message}`);
      console.log(
        `  HTTP status      : ${err.$metadata?.httpStatusCode ?? "n/a"}`,
      );
      console.log(`  requestId        : ${err.$metadata?.requestId ?? "n/a"}`);
      console.log(
        `  retryable        : ${err.$retryable?.throttling ?? false}`,
      );
      console.log(
        "  [!] AWS does NOT buffer. Your code must handle this and retry with backoff.",
      );
      console.log(
        `  Stopping flood test after round ${round} — throttle confirmed.`,
      );
      return; // exit early, we've seen what we came to see
    }

    if (otherErr.length > 0) {
      const err = otherErr[0].reason;
      console.warn(`  [!] Non-throttle error: ${err.name} — ${err.message}`);
    }

    // No pause — fire the next round immediately so the token bucket cannot refill.
    // The ~0ms gap between rounds is intentional.
  }

  console.log(
    `\n[!] No TooManyRequestsException after ${FLOOD_MAX_ROUNDS} rounds (${FLOOD_COUNT * FLOOD_MAX_ROUNDS} sends).`,
  );
  console.log(
    "    SendEmailCommand calls were all accepted — SES may async-process individual sends.",
  );

  // ── IMPORTANT: probe with SendBulkEmailCommand now ──────────────────────
  // After flooding, the rate quota is depleted. SendBulkEmailCommand evaluates
  // quota PER-DESTINATION at request time and reports failures in the result body.
  // This is WHERE the throttle surfaces for bulk sends: not as an exception,
  // but as ACCOUNT_THROTTLED inside BulkEmailEntryResults of a HTTP 200 response.
  console.log(
    "\n--- Post-flood bulk probe (SendBulkEmailCommand after quota exhausted) ---",
  );
  console.log(
    "    Watch for ACCOUNT_THROTTLED — throttling hidden inside a 200 response.\n",
  );

  try {
    const { success, failed, isThrottled } = await sendBulkBatch(
      RECIPIENTS,
      "post-flood-probe",
    );
    console.log(`  HTTP response : 200 (the call itself succeeded)`);
    console.log(`  success       : ${success.length}`);
    console.log(`  failed        : ${failed.length}`);
    for (const f of failed) {
      console.log(`    → ${f.email}: status=${f.status}, error=${f.error}`);
      if (f.status === "ACCOUNT_THROTTLED") {
        console.log(
          "    ════ THROTTLING OBSERVED (per-destination, inside HTTP 200) ════",
        );
        console.log("    This is the SES bulk throttle failure mode:");
        console.log(
          "      - HTTP status is 200 — the API call was NOT rejected",
        );
        console.log(
          "      - Throttle is reported per-destination in BulkEmailEntryResults",
        );
        console.log(
          "      - If you only check HTTP status, you miss this silently",
        );
        console.log(
          "      - You MUST iterate BulkEmailEntryResults and check .Status",
        );
      }
    }
    if (!isThrottled && failed.length === 0) {
      console.log(
        "  All succeeded — quota may have partially recovered. Increase FLOOD_MAX_ROUNDS.",
      );
    }
  } catch (err) {
    // A top-level TooManyRequestsException can also appear here if burst is extreme
    if (err.name === "TooManyRequestsException") {
      console.log("  ════ THROTTLING OBSERVED (top-level, HTTP 429) ════");
      console.log(`  error name  : ${err.name}`);
      console.log(`  message     : ${err.message}`);
      console.log(`  HTTP status : ${err.$metadata?.httpStatusCode}`);
    } else {
      throw err;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Backoff test — exponential backoff, sequential batches
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send the same N batches but sequentially with exponential backoff on Throttling.
 * This is the approach that recovers vs the burst that fails.
 *
 * Backoff parameters:
 *   initialDelay : 100ms  — AWS starts throttling on burst, not gradual ramp
 *   multiplier   : 2      — double each retry (classic binary exponential)
 *   cap          : 30s    — prevents infinite growth; SES clears fast
 *   jitter       : ±50%   — prevents thundering herd when multiple workers retry
 *   maxRetries   : 5
 */
/**
 * Bulk send with backoff — handles both throttle surfaces:
 *
 *   Surface A — TooManyRequestsException (HTTP 429, top-level):
 *     The entire API call was refused. Nothing was processed.
 *     Retry the full recipients list.
 *
 *   Surface B — ACCOUNT_THROTTLED inside HTTP 200 (per-destination):
 *     The API call succeeded but some recipients were refused by SES.
 *     Retry ONLY the throttled destinations — re-sending successful ones
 *     would cause duplicates.
 *
 * BUG THIS FIXES: partial successes must be accumulated across retries.
 * Without accumulation: attempt 1 sends A✅ B❌, attempt 2 retries B✅.
 * Naive return of attempt 2's result loses A — caller sees success=1 not 2.
 */
async function sendWithBackoff(recipients, batchLabel, maxRetries = 5) {
  let delay = 100; // ms
  let currentRecipients = recipients;

  // Accumulate results across all attempts so the final return reflects
  // every email that was actually sent, not just the last attempt's batch.
  const accSuccess = [];
  const accFailed = []; // permanent failures only (MESSAGE_REJECTED, FAILED, etc.)

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await sendBulkBatch(currentRecipients, batchLabel);

      // Always collect successes and permanent (non-throttle) failures immediately.
      // These destinations are done — no retry regardless of what the throttled ones do.
      accSuccess.push(...result.success);
      accFailed.push(
        ...result.failed.filter(
          (f) =>
            f.status !== "ACCOUNT_THROTTLED" &&
            f.status !== "ACCOUNT_DAILY_QUOTA_EXCEEDED",
        ),
      );

      // ACCOUNT_DAILY_QUOTA_EXCEEDED: hard daily ceiling hit.
      // Unlike ACCOUNT_THROTTLED (rate limit, recovers in seconds), this will not
      // recover until midnight UTC. Do not retry — treat as permanent failure today.
      const quotaExceeded = result.failed.filter(
        (f) => f.status === "ACCOUNT_DAILY_QUOTA_EXCEEDED",
      );
      if (quotaExceeded.length > 0) {
        accFailed.push(...quotaExceeded);
        console.log(
          `  [backoff] ACCOUNT_DAILY_QUOTA_EXCEEDED for ${quotaExceeded.length} destinations — daily limit hit, not retrying.`,
        );
      }

      if (result.isThrottled) {
        // ACCOUNT_THROTTLED: per-destination throttle inside HTTP 200.
        const throttledEmails = new Set(
          result.failed
            .filter((f) => f.status === "ACCOUNT_THROTTLED")
            .map((f) => f.email),
        );

        if (attempt === maxRetries) {
          // Exhausted — treat remaining throttled as final failures
          accFailed.push(
            ...result.failed.filter((f) => f.status === "ACCOUNT_THROTTLED"),
          );
          console.log(
            `  [backoff] Exhausted ${maxRetries} retries — ${throttledEmails.size} destinations still ACCOUNT_THROTTLED.`,
          );
          return { batchLabel, success: accSuccess, failed: accFailed };
        }

        // Jitter: actual wait = delay + random(0, delay * 0.5)
        const jitter = Math.random() * delay * 0.5;
        const wait = Math.min(delay + jitter, 30_000);
        console.log(
          `  [backoff] ACCOUNT_THROTTLED on ${throttledEmails.size} destinations (attempt ${attempt}/${maxRetries}) — waiting ${wait.toFixed(0)}ms`,
        );
        await sleep(wait);
        delay = Math.min(delay * 2, 30_000);

        // Narrow retry set to only throttled destinations.
        // Succeeded + permanently-failed destinations are already in accSuccess/accFailed.
        currentRecipients = currentRecipients.filter((r) =>
          throttledEmails.has(r.email),
        );
        continue;
      }

      if (attempt > 1) {
        console.log(
          `  [backoff] All destinations succeeded on attempt ${attempt}.`,
        );
      }
      return { batchLabel, success: accSuccess, failed: accFailed };
    } catch (err) {
      if (err.name === "TooManyRequestsException") {
        // Top-level rejection (HTTP 429) — entire call refused, nothing processed.
        // accSuccess/accFailed unchanged. Retry the full current recipients list.
        if (attempt === maxRetries) {
          console.log(
            `  [backoff] Exhausted ${maxRetries} retries on ${batchLabel}.`,
          );
          throw err;
        }
        const jitter = Math.random() * delay * 0.5;
        const wait = Math.min(delay + jitter, 30_000);
        console.log(
          `  [backoff] TooManyRequestsException (attempt ${attempt}/${maxRetries}) — waiting ${wait.toFixed(0)}ms`,
        );
        await sleep(wait);
        delay = Math.min(delay * 2, 30_000);
      } else {
        throw err; // non-throttle errors are not retried
      }
    }
  }
}

/**
 * Single send with backoff — for individual SendEmailCommand sends.
 *
 * Only surface: TooManyRequestsException (HTTP 429, top-level).
 * Individual sends have no per-destination result body to inspect —
 * the call either succeeds or throws.
 *
 * Use this in Lambda-per-event patterns where each invocation sends
 * one email. Without backoff, a burst of Lambda invocations all
 * hitting SES simultaneously will have some throw TooManyRequestsException
 * with no retry — those emails are lost.
 */
async function sendSingleWithBackoff(
  recipient,
  subject,
  textBody,
  maxRetries = 5,
) {
  let delay = 100;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.send(
        new SendEmailCommand({
          FromEmailAddress: FROM_ADDRESS,
          Destination: { ToAddresses: [recipient.email] },
          Content: {
            Simple: {
              Subject: { Data: subject },
              Body: { Text: { Data: textBody } },
            },
          },
        }),
      );
      if (attempt > 1) {
        console.log(`  [single-backoff] Succeeded on attempt ${attempt}.`);
      }
      return response.MessageId;
    } catch (err) {
      if (err.name === "TooManyRequestsException") {
        if (attempt === maxRetries) {
          console.log(
            `  [single-backoff] Exhausted ${maxRetries} retries for ${recipient.email}.`,
          );
          throw err;
        }
        const jitter = Math.random() * delay * 0.5;
        const wait = Math.min(delay + jitter, 30_000);
        console.log(
          `  [single-backoff] TooManyRequestsException (attempt ${attempt}/${maxRetries}) — waiting ${wait.toFixed(0)}ms`,
        );
        await sleep(wait);
        delay = Math.min(delay * 2, 30_000);
      } else {
        throw err;
      }
    }
  }
}

async function runBackoffTest() {
  console.log("\n" + "=".repeat(60));
  console.log(
    "BACKOFF TEST — sequential with exponential backoff on Throttling",
  );
  console.log("=".repeat(60));

  // ── Part A: bulk send backoff (SendBulkEmailCommand) ──────────────────────
  // Throttle surface: ACCOUNT_THROTTLED per-destination inside HTTP 200.
  // Partial successes are accumulated across retries — only throttled
  // destinations are retried, not ones that already succeeded.
  console.log(
    `\n[Part A] Bulk (SendBulkEmailCommand) — ${NUM_PARALLEL_BATCHES} batches of ${RECIPIENTS.length} recipients\n`,
  );
  for (let i = 0; i < NUM_PARALLEL_BATCHES; i++) {
    const label = `backoff-batch-${i + 1}`;
    console.log(`[${label}] Starting...`);
    try {
      const { success, failed } = await sendWithBackoff(RECIPIENTS, label);
      console.log(
        `[${label}] Done — success=${success.length}, failed=${failed.length}`,
      );
      if (failed.length) {
        for (const f of failed) {
          console.log(`  → ${f.email}: ${f.status} — ${f.error}`);
        }
      }
    } catch (err) {
      console.log(
        `[${label}] FAILED after all retries: ${err.name} — ${err.message}`,
      );
    }
  }

  // ── Part B: single send backoff (SendEmailCommand) ────────────────────────
  // Throttle surface: TooManyRequestsException (HTTP 429, top-level only).
  // Individual sends have no per-destination result body — the call either
  // succeeds or throws. Each recipient gets its own retry loop independently.
  console.log(
    `\n[Part B] Single (SendEmailCommand) — ${RECIPIENTS.length} individual sends with backoff\n`,
  );
  for (const recipient of RECIPIENTS) {
    console.log(`[single] Sending to ${recipient.email}...`);
    try {
      const messageId = await sendSingleWithBackoff(
        recipient,
        "Single send backoff test",
        "SES throttle test — ignore this email.",
      );
      console.log(`[single] Done — messageId=${messageId}`);
    } catch (err) {
      console.log(
        `[single] FAILED after all retries: ${err.name} — ${err.message}`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────
// HTML variable injection test
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tests whether SES template variables can carry HTML content.
 *
 * SES templates use Handlebars-style syntax with two distinct behaviours:
 *
 *   {{variable}}  — DOUBLE braces — SES HTML-escapes the value before injection.
 *                   Pass "<b>hello</b>" → renders as "&lt;b&gt;hello&lt;/b&gt;"
 *                   The recipient sees the literal string, not bold text.
 *                   Safe: prevents XSS from per-recipient data.
 *
 *   {{{variable}}} — TRIPLE braces — SES injects the raw value, unescaped.
 *                   Pass "<b>hello</b>" → renders as actual bold text in the email.
 *                   Unsafe: never put user-supplied content in triple-brace slots.
 *                   Useful for: per-recipient HTML blocks (promo banners, CTA buttons)
 *                   where YOU control the HTML string, not the end user.
 *
 * The template defined in createTemplate() has both slots side by side so you
 * can see the difference in the actual received email.
 */
async function runHtmlVariableBasicTest() {
  console.log("\n" + "=".repeat(60));
  console.log("HTML VARIABLE TEST (BASIC) — same HTML for all recipients");
  console.log("=".repeat(60));

  const htmlSnippet = `<a href="https://example.com" style="background:#0070f3;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">Click me</a>`;

  console.log(`\nInjecting as template variable value:`);
  console.log(`  ${htmlSnippet}\n`);
  console.log(`  {{htmlContent}}  -> escaped text (not a link)`);
  console.log(`  {{{htmlContent}}} -> rendered HTML (real button)\n`);

  const entries = RECIPIENTS.map((r) => ({
    Destination: { ToAddresses: [r.email] },
    ReplacementTemplateData: JSON.stringify({
      name: r.name,
      label: "html-basic-test",
      htmlContent: htmlSnippet,
    }),
  }));

  const cmd = new SendBulkEmailCommand({
    FromEmailAddress: FROM_ADDRESS,
    DefaultContent: {
      Template: {
        TemplateName: TEMPLATE_NAME,
        TemplateData: JSON.stringify({
          name: "Valued Customer",
          label: "html-basic-test",
          htmlContent: htmlSnippet,
        }),
      },
    },
    BulkEmailEntries: entries,
  });

  try {
    const response = await client.send(cmd);
    const results = response.BulkEmailEntryResults ?? [];

    for (let i = 0; i < results.length; i++) {
      const { Status, Error: errMsg, MessageId } = results[i];
      const email = RECIPIENTS[i]?.email ?? `index-${i}`;
      if (Status === "SUCCESS") {
        console.log(`  [${email}] SENT — messageId=${MessageId}`);
        console.log("    Expect escaped row + rendered row in the same email.");
      } else {
        console.log(`  [${email}] FAILED — status=${Status}, error=${errMsg}`);
      }
    }
  } catch (err) {
    if (err.name === "TooManyRequestsException") {
      console.log("  Throttled — quota exhausted. Re-run tomorrow.");
    } else {
      throw err;
    }
  }
}

async function runHtmlVariablePerRecipientTest() {
  console.log("\n" + "=".repeat(60));
  console.log(
    "HTML VARIABLE TEST — per-recipient dynamic HTML via {{{triple braces}}}",
  );
  console.log("=".repeat(60));

  // Each recipient gets completely different HTML injected into the same template.
  // This is the core use case: one template, N recipients, N different rendered emails.
  //
  // Real-world examples of what you'd put here:
  //   - Per-recipient CTA button with unique tracking URL
  //   - Personalised promo banner (different colour per tier: gold/silver/bronze)
  //   - Unique discount code displayed as a styled badge
  //   - Product recommendations block (different products per user)
  //
  // The template has ONE {{{htmlContent}}} slot. What each person receives is
  // entirely determined by what you put in their ReplacementTemplateData.

  // Build a unique HTML block per recipient.
  // recipientData mirrors RECIPIENTS but adds a unique htmlContent per person.
  const recipientData = RECIPIENTS.map((r, i) => {
    // Give each recipient a different colour, CTA label, and promo code
    // so you can visually confirm in your inbox that they differ.
    const configs = [
      {
        color: "#0070f3",
        label: "Claim your 20% discount",
        code: "SAVE20-ALPHA",
        trackingUrl: "https://example.com/promo?ref=alpha&uid=001",
      },
      {
        color: "#e53935",
        label: "Exclusive offer — 30% off",
        code: "SAVE30-BETA",
        trackingUrl: "https://example.com/promo?ref=beta&uid=002",
      },
    ];
    const cfg = configs[i % configs.length];

    // This entire block is the value of the {{{htmlContent}}} variable.
    // Because it's triple-brace, SES injects it raw — it renders as real HTML.
    const htmlContent = [
      `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">`,
      `  <tr>`,
      `    <td style="background:${cfg.color};border-radius:6px;padding:16px 24px;text-align:center;">`,
      `      <p style="color:#fff;font-size:18px;font-weight:bold;margin:0 0 8px;">${cfg.label}</p>`,
      `      <p style="color:#fff;font-size:13px;margin:0 0 12px;">`,
      `        Your personal code: <strong style="letter-spacing:2px;">${cfg.code}</strong>`,
      `      </p>`,
      `      <a href="${cfg.trackingUrl}"`,
      `         style="background:#fff;color:${cfg.color};padding:8px 20px;`,
      `                border-radius:4px;text-decoration:none;font-weight:bold;">`,
      `        Redeem now`,
      `      </a>`,
      `    </td>`,
      `  </tr>`,
      `</table>`,
    ].join("\n");

    return { recipient: r, htmlContent, cfg };
  });

  // Log what each person will receive so you can verify in your inbox
  for (const { recipient, cfg } of recipientData) {
    console.log(`\n  ${recipient.email}`);
    console.log(`    colour : ${cfg.color}`);
    console.log(`    code   : ${cfg.code}`);
    console.log(`    url    : ${cfg.trackingUrl}`);
  }
  console.log();

  const entries = recipientData.map(({ recipient, htmlContent }) => ({
    Destination: { ToAddresses: [recipient.email] },
    // ReplacementTemplateData overrides DefaultContent.Template.TemplateData
    // for THIS specific recipient only. All other recipients are unaffected.
    ReplacementTemplateData: JSON.stringify({
      name: recipient.name,
      label: "per-recipient-html-test",
      htmlContent, // unique HTML block — different per recipient
    }),
  }));

  const cmd = new SendBulkEmailCommand({
    FromEmailAddress: FROM_ADDRESS,
    DefaultContent: {
      Template: {
        TemplateName: TEMPLATE_NAME,
        // Fallback values used when a recipient has no ReplacementTemplateData,
        // or when a key is missing from their replacement data.
        TemplateData: JSON.stringify({
          name: "Valued Customer",
          label: "per-recipient-html-test",
          htmlContent: "<p>No personalised content available.</p>",
        }),
      },
    },
    BulkEmailEntries: entries,
  });

  try {
    const response = await client.send(cmd);
    const results = response.BulkEmailEntryResults ?? [];

    console.log("Results:");
    for (let i = 0; i < results.length; i++) {
      const { Status, Error: errMsg, MessageId } = results[i];
      const { recipient, cfg } = recipientData[i];
      if (Status === "SUCCESS") {
        console.log(`  [${recipient.email}] SENT — messageId=${MessageId}`);
        console.log(
          `    Check inbox: expect a ${cfg.color} banner with code ${cfg.code}`,
        );
      } else {
        console.log(
          `  [${recipient.email}] FAILED — status=${Status}, error=${errMsg}`,
        );
      }
    }
  } catch (err) {
    if (err.name === "TooManyRequestsException") {
      console.log(
        `  Throttled — quota exhausted. Re-run tomorrow (quota resets midnight UTC).`,
      );
    } else {
      throw err;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("SES Bulk Throttle Test");
  console.log(`Region           : ${REGION}`);
  console.log(`From             : ${FROM_ADDRESS}`);
  console.log(
    `Recipients       : ${RECIPIENTS.map((r) => r.email).join(", ")}`,
  );
  console.log(`Parallel batches : ${NUM_PARALLEL_BATCHES}`);
  console.log(`Template         : ${TEMPLATE_NAME}\n`);

  try {
    await createTemplate();

    // Phase 1 — burst: intentionally throttle to observe the error
    // await runBurstTest();

    // Phase 2 — backoff: show the recovery path
    // await runBackoffTest();

    // Phase 3 — HTML variable injection
    if (HTML_TEST_MODE === "basic") {
      await runHtmlVariableBasicTest();
    } else if (HTML_TEST_MODE === "per-recipient") {
      await runHtmlVariablePerRecipientTest();
    } else if (HTML_TEST_MODE === "both") {
      await runHtmlVariableBasicTest();
      await runHtmlVariablePerRecipientTest();
    } else {
      console.log(
        `[WARN] Unknown HTML_TEST_MODE=${HTML_TEST_MODE}. Valid: basic | per-recipient | both`,
      );
    }
  } finally {
    // Always clean up the test template, even if something throws
    await deleteTemplate();
  }
}

main().catch((err) => {
  console.error("\n[FATAL]", err.name, err.message);
  if (err.$metadata) {
    console.error("  HTTP status :", err.$metadata.httpStatusCode);
    console.error("  Request ID  :", err.$metadata.requestId);
  }
  process.exitCode = 1;
});
