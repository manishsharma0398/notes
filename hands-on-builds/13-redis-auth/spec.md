# Build 13 — Redis-backed auth: sessions, JWT, and revocation

**Time:** ~4 hours. **Prerequisites:** `redis/` Ch3 (TTL and expiry) and **Ch7 (atomicity and
Lua)** — phase 5 cannot be done correctly without Lua. **Theory:** `js-learnings` Ch17
(retention), Ch16 (error semantics); `node-learnings` Ch20 (async error propagation).

The most-asked backend auth question is *"JWT or sessions?"*, and the answer that scores is not a
preference — it is **"stateless tokens cannot be revoked, so the moment you need logout, you need
state, and the interesting design is where you put it."** This build makes you produce that
answer from having hit the problem.

**Dependency exception:** this is the first build allowed a non-core dependency (a Redis client).
JWT itself is **node core only** — `crypto.createHmac`, `crypto.timingSafeEqual`,
`crypto.randomUUID`. Do not install a JWT library; signing and verifying one is twenty lines and
is itself an interview question. *(If you have done build 12, the RESP client, use it and keep the
whole thing dependency-free.)*

```bash
docker run -d --rm --name redis-auth -p 6379:6379 redis:7-alpine
node --test "13-redis-auth/tests/*.test.js"
```

Tests **skip** with a message if Redis is not reachable rather than failing — so a red run always
means your code, never your environment.

---

## Phase 1 — Prove the problem before solving it

**Build:** `sign(payload, secret)` and `verify(token, secret)` for HS256, from `node:crypto`.

**Success criteria**

- [ ] A tampered payload fails verification. A tampered signature fails.
- [ ] Comparison uses `timingSafeEqual`, not `===`. One sentence on what `===` leaks.
- [ ] `exp` is enforced, and an expired token fails with a *distinguishable* error from an invalid
      one — the caller needs to tell "log in again" from "something is wrong".
- [ ] `alg: "none"` is **rejected**. Say what the attack is.
- [ ] **The punchline:** issue a valid 15-minute token, then write the test asserting you can
      revoke it. You cannot. Record what you had to conclude.

**Say out loud:** what does a stateless token actually buy, given that?

## Phase 2 — Server sessions in Redis

**Build:** `createSession(userId)` → opaque id; `getSession(id)`; `destroySession(id)`.

**Success criteria**

- [ ] The session id is from a CSPRNG (`crypto.randomBytes`), not `Math.random` or a counter. One
      sentence on why.
- [ ] Sessions carry a TTL and expire on their own — no sweeper process (`redis/` Ch3).
- [ ] Sliding expiration: reading a session extends it. Decide whether that is one round trip or
      two, and justify it.
- [ ] String-vs-hash decision recorded: which did you store the session as, and what did the
      other cost? Measure both with `MEMORY USAGE` (`redis/` Ch2).
- [ ] Revocation is now one `DEL`. Write the test Phase 1 could not pass.

## Phase 3 — The hybrid everyone actually ships

Short-lived access JWT + long-lived refresh token held in Redis.

**Success criteria**

- [ ] Access token ~15 min, verified **without touching Redis** — that is the point of the hybrid.
- [ ] Refresh token is opaque, stored in Redis, long TTL.
- [ ] `refresh(refreshToken)` issues a new access token.
- [ ] A comment stating the tradeoff you have just bought: revocation is now delayed by up to the
      access-token lifetime. Name the knob and what it trades against.

## Phase 4 — Revocation that actually works

**Build:** a denylist, and "log out everywhere".

**Success criteria**

- [ ] Denylist keyed by the token's `jti`, with **TTL set to the token's remaining lifetime** —
      not a fixed TTL, and not forever. Say why that is the only correct TTL.
- [ ] "Log out everywhere" without enumerating sessions: a per-user token version, bumped on
      logout, carried in the token and compared on verify. Explain why enumeration (`KEYS
      user:*`) is the wrong answer (`redis/` Ch14).
- [ ] Verify path costs **at most one** Redis round trip. Measure it.
- [ ] A revoked token fails immediately; an unrelated user's token is unaffected.

## Phase 5 — Refresh rotation and reuse detection

The security-critical phase, and the one that needs Lua.

**Build:** rotation — every refresh invalidates the old token and issues a new one — plus
detection of a **reused** token, which means it was stolen.

**Success criteria**

- [ ] Using a refresh token twice is detected. The second use **revokes the entire token family**,
      not just that token. Say why revoking one is insufficient.
- [ ] **The race:** two concurrent refreshes with the same token must not both succeed. Prove your
      naive version fails — fire both with `Promise.all` and show two valid access tokens come
      back — then fix it atomically with a Lua script (`redis/` Ch7) and show only one wins.
- [ ] The check-and-rotate is **one** script, not a `GET` then `DEL` then `SET`. State the
      guarantee the script gives you that three commands do not.
- [ ] A legitimate user racing themselves (two browser tabs) is distinguished from theft — or, if
      you decide it cannot be, say so and pick the failure you would rather have.

## Phase 6 — Rate-limit the login endpoint

**Success criteria**

- [ ] Per-IP **and** per-account limits, with different windows. Say why per-account alone is
      exploitable and per-IP alone is too.
- [ ] Built atomically (`redis/` Ch8). The naive `INCR` then `EXPIRE` can leave a key with no TTL
      — demonstrate that failure, then fix it.
- [ ] Lockout is announced identically for a valid and an invalid username. One sentence on the
      enumeration attack that prevents.

## Phase 7 — Break it, then decide

The phase that makes this a senior answer.

**Success criteria**

- [ ] Stop Redis mid-flight. Record exactly what still works and what does not. (Access-token
      verification should still work — if it does not, your Phase 3 is wrong.)
- [ ] **Make the fail-open vs fail-closed decision explicitly.** Redis is down and you cannot check
      the denylist: do you accept the token or reject it? There is no correct answer — there is a
      decision and a justification. Write yours, and name what it costs.
- [ ] Retention check: after 10,000 logins and logouts, nothing grows unbounded. Name which key
      would have grown if you had used a fixed denylist TTL (`js-learnings` Ch17 Part 4).
- [ ] One paragraph: which attack your finished design still does **not** stop.

---

## What they're scoring, if this comes up in a round

| Question | The answer that scores |
|---|---|
| "JWT or sessions?" | Not a preference — "stateless can't be revoked, so where do you put the state?" |
| "How do you log someone out?" | Denylist with TTL = remaining token life; or a version counter for everywhere |
| "How do you handle refresh?" | Rotation, and reuse means theft |
| "Two refreshes race — what happens?" | Names the race unprompted, and reaches for a script |
| "Redis is down. Now what?" | Has a fail-open/fail-closed position and can defend the cost |

---

## Hints

**1** — `timingSafeEqual` throws on length mismatch; handle that before comparing. The `alg: none`
attack is that the *token* tells you how to verify it.

**2** — `crypto.randomBytes(32).toString("base64url")`. The sliding-expiration round-trip question
has a `GETEX` shaped answer.

**4** — Remaining lifetime is `exp - now`. A token that has already expired needs no denylist entry
at all — it fails on `exp` anyway, which is the observation that keeps the denylist bounded.

**5** — The script needs to: read the token, check it is unused, mark it used, and write the
successor — with nothing able to run between those steps. If you cannot express "check then write"
as one `EVAL`, that is the thing to fix, not to work around.

**6** — The atomic version is either a single script or the `SET key 1 EX n NX` shape. Work out
which fits a counter.

**7** — Fail-open is available because the access token is self-verifying. That is the *whole*
argument for the hybrid, arriving three phases later.

---

## What to verify

- [ ] Phase 1's punchline written down: you could not revoke it, and that is why the rest exists.
- [ ] The string-vs-hash memory numbers recorded, both.
- [ ] Phase 5's race **demonstrated failing** before it is fixed. A fix without the failing test is
      not evidence.
- [ ] The `INCR`-without-TTL leak demonstrated, then fixed.
- [ ] The fail-open/fail-closed decision written with its cost.
- [ ] The paragraph naming the attack you still do not stop.
- [ ] You can answer "JWT or sessions?" in under 60 seconds without expressing a preference.
