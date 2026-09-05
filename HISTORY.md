# History

A running record of what changed and why. Newest first. **Update this with every
meaningful change** — it is the thing that makes it possible to walk away for a
few months and pick the project back up without archaeology.

This file is private to the notes repo. The portfolio projects present themselves as
independent work and must not reference the roadmap, the chapters, or this record.

---

## 2026-09-05 — The `js-learnings` chapter structure standardised across all 16 track prompts

Asked to push the structure the JS track converged on — README · notes · interview · mock ·
examples · chapter exercise · cumulative exercise · blank worksheet — into every track's
`prompt.md`, so any new chapter anywhere is written to it.

Surveyed first. **Only three of sixteen tracks had it**: `js-learnings` (the source),
`ts-learnings` and `redis` (both written this week). The other thirteen had README/notes/interview
and **no `mock.md` and no exercise files at all** — `ai` and `python` had the two exercise types
but no mock or worksheet; the remaining eleven had neither. So the majority of the repo's tracks
would have produced a chapter missing four of its seven pieces.

All thirteen patched. Two things were done per-track rather than by pasting one block:

- **The `examples/` line is track-specific**, because a generic one would be wrong — SQL gets
  "runnable SQL with `EXPLAIN` output pasted verbatim", Terraform "real `plan`/`apply` output",
  k8s "real `kubectl` output", AWS "real CLI/SDK output, secrets redacted". Same for the
  cumulative-exercise suggestions, which name something plausible for that subject rather than
  the JS track's concurrency limiter.
- **Tracks with existing chapters got a legacy note; empty ones did not.** `node-learnings` (25),
  `terraform` (20), `sql` (14), `ai` (10), `aws` (7), `nginx`/`react` (2), `python` (1) now say
  the structure "applies from the next chapter onward" and that existing chapters are
  **deliberately left as they are** — the same wording and the same reasoning `js-learnings` used
  for its own chapters 1–12. The five empty tracks (`docker`, `k8s`, `linux`, `ci-cd-pipelines`,
  `scripting`) have no such note because there is nothing to exempt. This matters: without it, a
  future session could read "all chapters must have a mock" and start silently rewriting 25
  finished Node chapters.

**`js-machine-round/` and `hands-on-builds/` were deliberately excluded**, and `CLAUDE.md` now
says so explicitly. They are not chapter tracks — a drill bank has `problems.md` plus executable
tests, a build bank has `spec.md` plus tests, and giving either a `notes.md` and a `mock.md` would
duplicate theory that already exists in the chapter tracks. That exclusion is the kind of thing
that gets "helpfully" undone later, so it is written down rather than left as an omission.

Two rules were folded into the standard block while it was being written, both earned earlier this
week: **run every example and paste its real output, never output written from memory**, and
**where an exercise claims a behaviour, run that too** — mis-posed exercise questions were caught
this way in Ch17, Ch22 and again in the Redis auth build's `alg: none` test.

---

## 2026-09-05 — Build 13: Redis-backed auth, and the one rule the build bank now bends

Asked for a Redis-flavoured item in one of the practice banks — "session manager for JWT auth, or
anything helpful for interviews and Redis knowledge". It goes in `hands-on-builds/`, not
`js-machine-round/`: a drill is one function in four minutes with zero dependencies, and Redis
cannot be that. An auth system is exactly a four-hour integrative build.

**The build is organised around the question the topic is actually asked as.** "JWT or sessions?"
is the most common backend auth question, and the answer that scores is not a preference — it is
*"stateless tokens cannot be revoked, so the moment you need logout you need state, and the
interesting design is where you put it."* So **Phase 1 makes you prove the problem before solving
it**: implement HS256 from `node:crypto`, then write the test that tries to revoke a valid token
and cannot. Everything after that exists because of what Phase 1 could not do.

Seven phases: prove-the-problem → server sessions → the hybrid → revocation → **rotation and reuse
detection** → login rate limiting → break it. Two phases carry the weight:

- **Phase 5 needs Lua**, which is why the spec lists `redis/` Ch7 as a hard prerequisite. Two
  concurrent refreshes with the same token must not both succeed; the spec requires
  *demonstrating the naive version failing* (`Promise.all`, two valid access tokens come back)
  before fixing it with a script. A fix without the failing test is not evidence.
- **Phase 7 is the fail-open/fail-closed decision.** Redis is down and the denylist cannot be
  checked: accept the token or reject it? There is no correct answer, only a decision and a cost —
  and being able to defend one is the senior half of the round.

**The dependency rule was bent deliberately and narrowly.** The bank's rule was "node core only";
a datastore cannot be reimplemented in an afternoon, so Tier 6 allows **a Redis client and nothing
else**. JWT stays `node:crypto` — signing one is twenty lines and is itself an interview question,
so importing a library would remove the content. Build 12 (a RESP client over `net`) is indexed so
the exception can be closed entirely if wanted, and it also completes a protocol trilogy with
build 05 (TCP framing) and build 07 (WebSocket frames).

**The boundary with the `redis/` track is written into both files**: that track teaches the
mechanisms, this build applies them, and a chapter whose cumulative exercise would duplicate build
13 should point at it instead.

Phase 1's tests were validated in both directions, and the first pass produced a **weak test worth
recording**. The `alg: "none"` test asserted only that verification throws — which a naive
implementation passes for the wrong reason, because the empty signature fails the signature
comparison regardless of whether the algorithm was ever checked. Replaced with the real shape of
the attack: a token claiming `HS512` but signed with HMAC-SHA256, which is exactly what a verifier
that hardcodes SHA-256 and never reads `header.alg` computes — such a verifier accepts it. With
that change the naive implementation fails 2 of 8 instead of 1, and the correct one passes 8 of 8.
**A test that passes for the wrong reason is worse than no test**, because it reads as coverage.

Tests skip with an instruction when Redis is unreachable rather than failing, so a red run always
means the code and never the environment. Tier ordering was also corrected — the datastore tier
had been inserted ahead of the capstone.

---

## 2026-09-05 — `redis/` promoted to its own track, overruling me

I had argued Redis belonged as chapters inside a future `system-design/` track, on the grounds
that caching, rate limiting and distributed locks are distributed-systems questions. Asked for it
as a root-level folder instead. **The counter-argument is decisive and the original position was
weaker than I made it sound:**

- **`sql/` is equally a "system-design component" and has its own 47-file track.** By my own
  reasoning SQL should have been chapters inside system design too, which is obviously wrong.
- **The repo's established shape is technology-specific tracks** — `terraform` (78 files), `sql`
  (47), `nginx` — each with a `prompt.md` and `NN-topic/` chapters. Redis fits that pattern
  exactly; nothing about it is unusual.
- **Redis is asked about by name in interviews**, not only as a design ingredient. "Have you used
  Redis, what for, and how would you rate-limit with it" is a question about the technology.

`redis/prompt.md` written: 14 chapters, under the current contract (`mock.md`, timed spoken
answers, resume block) rather than the older `sql`/`terraform` shape. Ordered so that the three
chapters where rounds are actually decided — caching patterns, rate limiting, distributed locks —
sit at 6, 7 and 8, after the memory and persistence models they depend on.

**The boundary with `system-design/` is stated in the prompt rather than fudged:** this track
teaches the Redis half of each pattern properly and marks the architectural half — caching
*strategy*, rate limiting *across services*, the general Redlock debate — as belonging to the
other track when it exists. Both files now say so, so the overlap is a documented seam rather
than a duplication waiting to happen.

Track-specific rules worth keeping: **every command output must be run against a real Redis 7 in
Docker and pasted**, never written from memory, because reply formats and `INFO` fields drift
between versions; and every chapter names its **production failure mode** — what pages you, what
it looks like in `INFO`, what you do at 3am. The chapter that carries the track is the one whose
honest answer is "Redis does not guarantee that".

`BACKLOG.md` and `CLAUDE.md` both updated: Redis moved out of the "agreed but has no home" row
into a queued track with a resume point, and the system-design row narrowed to
payments-as-idempotency, caching strategy and WebSocket scaling.

**Then corrected on review:** the first draft of `redis/prompt.md` specified the chapter shape
only loosely in its resume block and **omitted the `Chapter structure` and `Exercises` sections
entirely** — so `chapter_exercise.md` and `cumulative_exercise.md` appeared nowhere and a chapter
written from it would have been missing two of its seven pieces. Both sections added verbatim from
`js-learnings/prompt.md` and adapted: prediction problems are "what does the server reply, and
what does `INFO`/`MEMORY USAGE` say afterwards", and **every cumulative ends with a phase that
breaks the thing** — kill the server mid-write, fill memory until eviction, fail over the primary
— and asks what was lost. `ts-learnings`' resume block was aligned the same way; its structure
section was already complete. Both now state "a chapter is not finished until all seven exist".

**Asked whether Lua scripting was included — it was, and checking exposed a dependency bug in the
chapter order.** Lua was one clause inside Chapter 10 ("Atomicity — MULTI/EXEC, WATCH, Lua
scripting"), but **Chapters 7 (rate limiting) and 8 (distributed locks) both require it**: a
correct sliding-window limiter needs an atomic multi-step operation, and releasing a lock safely
is a compare-and-delete, which is a script. The plan had the prerequisite two chapters *after* its
dependents.

Fixed by promoting atomicity+Lua to **Chapter 7**, pushing rate limiting to 8, locks to 9 and
pub/sub to 10 — and giving Lua real weight rather than a mention: `KEYS` vs `ARGV` and why the
split exists (cluster key routing), the `SCRIPT LOAD` → `EVALSHA` cache and the `NOSCRIPT` case a
client must handle after a restart, **a script blocking the whole server for its duration** as the
cost that buys atomicity, effects-based replication, and **Redis Functions** (7.0+) as the modern
successor to `EVAL`.

All of it verified against the container rather than recalled: `EVAL` works, `SCRIPT LOAD`
returned sha `a27e7e8a…` and `EVALSHA` ran it, and `FUNCTION STATS` reports engine `LUA` — so
Redis Functions are genuinely available in `redis:7-alpine` and the chapter can be written against
them. The three-question-escalation note now reads "Chapters 6, 8 and 9 … all three depend on
Chapter 7, which is why atomicity and Lua come before them rather than after".

**The toolchain claim was also asserted rather than verified, and was partly wrong.** The prompt
said to use `redis-cli` against Docker; Docker is running here, but **`redis-cli` is not installed
on the host**. Ran the real workflow instead of assuming it: `redis:7-alpine` resolves to
**redis_version 7.4.11** (`multiplexing_api:epoll`), commands go through
`docker exec redis-lab redis-cli`, and the mapped port is reachable from Node — a raw socket
writing `*1\r\n$4\r\nPING\r\n` gets `+PONG\r\n` back, so client examples need nothing
installed. `MEMORY USAGE` on a 5-byte string returned **72**, and `OBJECT ENCODING` returned
`embstr` — both the kind of number Chapter 2 and 4 will be built on, and both now confirmed to be
obtainable. The prompt records the verified commands rather than the imagined ones.

---

## 2026-09-05 — `BACKLOG.md`: the ideas index, added after a fair challenge

Asked whether the topics raised over the session had actually been kept, and how to resume them.
Verified rather than asserted — grepped all thirteen topics mentioned across the conversation
(socket.io, currying, polyfills, event bubbling, promisification, payments, Redis, system design,
React/Next, Express, EventEmitter, fs sync/async, CRUD REST API) against every file written.

**All thirteen were recorded — but across five files, with no single view.** Each topic had gone
to whichever artifact owned it, which is correct for the artifacts and useless for the question
"I mentioned X once, what happened to it?". Two were genuinely weak: **payments and Redis existed
only as a sentence inside a paragraph about system design**, not as resumable items.

`BACKLOG.md` is that missing view. Sections: ready now · queued in order · **agreed but has no
home yet** · deliberately not doing, with reasons · stalled or owed · where practice already
exists.

**The section that mattered most is "agreed but has no home yet".** System design — and with it
Redis, payments, caching, rate limiting and WebSocket scaling — was agreed as the next track but
has **no `prompt.md`**, so "continue system design" resolves to nothing. Every other track has a
resume point; that one does not, and saying so plainly is more useful than letting it look
scheduled. The reasoning for folding those three topics into system design rather than making
them separate tracks is recorded there so it does not get re-litigated.

The "deliberately not doing" section exists for the same reason — Express-as-a-track and
Next-as-a-track were both considered and rejected with specific arguments, and without writing
that down they come back around every few months.

`CLAUDE.md` now points at `BACKLOG.md` from the top of the track index, with the distinction
stated: HISTORY is what was done and why, BACKLOG is what was asked for and where it went.

---

## 2026-09-05 — Made "continue" work: resume points in every prompt, and a track index in CLAUDE.md

Asked for the thing that makes a track resumable — "so that I can go back to it later and say
continue and it should start the next chapter, same as we did for js and node." Checking what a
cold session would actually find turned up three problems, and the third was the real one:

1. **`hands-on-builds/prompt.md` did not exist.** It had a `README.md` but no contract, so
   nothing said how to write the next build or what the rules were.
2. **State was split across two files** in `js-machine-round/` — the contract in `prompt.md`, the
   status in `README.md`. Resuming meant reading both and inferring.
3. **`CLAUDE.md` — the file loaded into every session — knew nothing about `ts-learnings`,
   `js-machine-round` or `hands-on-builds`.** Greps returned 0 for all three. It also still said
   "Chapters 1–10" as though `ai/` were the only track and listed a stale "14 domains" line. A
   fresh session would not have known the new tracks existed at all, which is the actual failure
   mode behind "say continue and it works".

**What makes "continue" deterministic, extracted from how `js-learnings/prompt.md` behaved:** it
worked because that file carried a *state marker* ("Covered, chapters 1–17") next to a *queue*
("Remaining, in priority order"), so resuming was reading one file, not reconstructing intent
from a directory listing. Every track prompt now opens with an explicit
`## To continue this track` block containing a status table, a one-line "continue means X", the
shape of the deliverable, and the bookkeeping to do afterwards (update the status table, update
the README, add a HISTORY entry).

Added to `CLAUDE.md`: a **track index** giving every track's state and what `continue` resolves
to for each, plus the instruction to read that track's `prompt.md` first rather than inferring —
and to **ask which track** when "continue" arrives with no track named, since four are now
active. Also folded in three things that were only in HISTORY and would otherwise be re-litigated:
the distinct jobs of the three practice artifacts (drill = one function timed, build = one program,
cumulative = one chapter's theory), the **check-before-you-write rule** for exercises given ~60
already exist, and the standing decisions that `system-design/` is the agreed next track and that
Express is deliberately not one.

The `ai/`-specific state section was retitled rather than replaced — it is still accurate, it was
just sitting under a heading that implied it described the whole repo.

---

## 2026-09-05 — New artifact: `hands-on-builds/` — a practice **map**, mostly pointers

Asked for applied practice on top of the two finished tracks (custom EventEmitter, fs sync/async,
a pure-node CRUD REST API), plus "so many other such topics exist that I have not mentioned".
Followed with the instruction that decided the design: **"if those already exist somewhere let's
add the references to them."** That was the right instinct and it halved the artifact.

**Surveyed before building, and the survey changed the plan:**

- **All 25 `node-learnings` chapters already have a "Practice Exercises" section**, and 6 have
  populated `exercises/` dirs. Extracting every exercise title showed roughly **60% of what was
  about to be written already existed** — worker pools, AsyncLocalStorage request tracking, the
  three leak shapes, graceful shutdown and signal queuing, event-loop lag, thread-pool starvation,
  backpressure, heap snapshots, CPU profiling.
- So `README.md` is primarily an **index**, not a workbook. For every applied skill it points at
  either an existing exercise (chapter + exercise name) or a build defined here. Eleven builds
  against ~60 existing exercises. Adding a build is the exception; the default is a pointer.

**Verified gaps, before claiming them:**

- **There is no HTTP chapter in `node-learnings` at all** — 25 chapters, TCP socket internals
  present, HTTP absent. Everything HTTP-shaped is therefore a build here, which is also why the
  capstone is "write a minimal Express": you understand a framework faster by building the
  200-line version than by reading its docs, and it answers the earlier "should I study Express?"
  question without a track.
- **"Build an EventEmitter" is not an exercise anywhere** in either track.
- **`js-learnings` Ch14 never asks you to build a Promise.**

The existing node exercises are also **underspecified** relative to the `js-learnings` standard —
prose prompts ("Create a script that: writes large amounts of data, handles backpressure") rather
than phases with success criteria. Upgrading them is noted as separate later work, deliberately
not bundled in.

**Build 01 (EventEmitter) is complete, and the verification method is the part worth keeping:
the tests were validated against Node's own `EventEmitter` as the reference implementation.**
23 of 25 passed, which confirms the spec's claims about Node semantics are true rather than
remembered — snapshot-during-emit (a listener removed by an earlier listener still runs for that
emit), `once` being removable by the *original* function despite the internal wrapper, the
`error`-event asymmetry, `listeners()` returning a copy, `prependListener` ordering.

The 2 failures were the useful part. **Node's `EventEmitter.on()` silently ignores an options
object — `{ signal }` is an `EventTarget`/DOM feature, and Node ships both APIs separately.**
Verified directly: `e.on("x", fn, { signal })` then `ac.abort()` leaves `listenerCount` at 1,
while the same pattern on `EventTarget` works. Phase 6 asks for that capability deliberately, so
the tests are correct — but Node's own implementation failing two tests in a build that says
"rebuild `node:events`" reads as a broken test unless it is labelled. Both the spec and the test
file now say so explicitly: *you are adding a capability, not matching the reference.*

Structure mirrors `js-machine-round/` — `spec.md` with phased success criteria, executable tests,
empty `solution/`, no answers anywhere. The distinction between the three practice artifacts is
stated in the README so the right one gets picked: machine round = one function in 4–10 minutes
timed; a build = one program in 1–4 hours; a chapter's `cumulative_exercise.md` = that chapter's
theory right after reading it.

---

## 2026-09-05 — New artifact: `js-machine-round/`, a drill bank (not a track)

Created after floating a longer list of candidate topics — WebSocket/Socket.io, currying,
polyfills, event bubbling, promisification, payments, Redis, system design. Sorting that list was
most of the value, and the sort is worth keeping because the same list will come up again:

- **Currying / polyfills / promisification / output prediction are not new content.** Currying is
  `js-learnings` Ch6, polyfills are Ch11 and Ch14, output prediction is Ch5 and Ch15. What was
  missing was the **format** — reps under a clock — so the right artifact is a problem bank, not
  another chapter track. Cheapest high-value thing available, because it converts finished reading
  into interview performance.
- **Redis, WebSocket and payments are not three tracks, they are system-design components.** Redis
  is caching/rate-limiting/locks, WebSocket is real-time delivery and scaling across instances,
  and the interesting half of payments is idempotency keys, webhook delivery guarantees and
  reconciliation. As separate folders they would be shallow and overlapping; as chapters in one
  system-design track they reinforce each other. **System design is the agreed next piece of work
  after this bank.**
- **Express was rejected again**, same reasoning as the `ts-learnings` entry.

Verified before asserting any of it: `redis` appears in 21 files and `websocket` in 7, but only
ever as incidental examples inside other chapters (1–3 mentions each, never a chapter topic).
`socket.io`, `curry`, `event bubbling`, `event delegation`: zero files. A `DOM` grep returning 111
files was a **false positive** — it matches "domain".

**The genuine content gap the bank carries is the browser.** `js-learnings` scoped the DOM out
deliberately ("language only") and `node-learnings` is server-side, so the DOM event model —
bubbling, capturing, delegation — is taught nowhere in this repo. Category 07 is the only place in
the bank where teaching is in scope, and it gets a short `concepts.md` rather than a chapter.

**Design decision: every problem ships with an executable spec.** `node --test` and `node:assert`
are built into Node 22, so the bank has zero dependencies except category 07 (jsdom, verified
working — it correctly produces `a-capture -> b-target -> a-bubble`). The tests *are* the "what to
verify" checklist in executable form, which is what makes this a drill rather than a reading list,
and they specify behaviour without leaking implementation so the no-solving contract holds.
`lib/load.js` fails with an instruction naming the file and export to create, rather than a
module-not-found stack — a useless error under a timer is its own bug.

**Category 01 is complete and was verified in both directions**, which is the part worth
recording as a method:

1. **Satisfiable** — reference solutions written in `/tmp`, all **33 tests pass**, then deleted so
   `solution/` stays empty per the contract. They never entered the repo.
2. **Discriminating** — deliberately naive implementations run against the same tests, each
   failing exactly the tests that claim to catch it and passing the happy-path ones:

   | Naive implementation | Result |
   |---|---|
   | `curry` with a shared accumulator | 3 pass / 3 fail |
   | `memoize` with `join()` + truthiness check | 2 pass / 3 fail |
   | `once` that forgets the result | 2 pass / 2 fail |
   | `partial` as an arrow (loses the receiver) | 3 pass / 1 fail |

   A bank whose tests pass naive code is worthless, and half of these problems have a naive
   version that passes the happy path — so this second pass is not optional. It is the same
   lesson Ch17 and Ch22 both recorded about exercise questions needing verification, applied
   before shipping rather than after.

One test turned out to demand more than the textbook implementation and was kept deliberately:
`curry` preserving the receiver for a method requires capturing `this` at the partial-application
site, which most reference implementations of `curry` do not do. It is listed explicitly in the
problem's edge cases, so it is fair, and it is a real discriminator.

`problems.md` for category 01 carries 7 problems with target times (4–10 min), the edge case each
one is really testing phrased as a question to ask out loud, graded hints (1 = nudge, 3 = nearly
the shape), and a cross-reference to the `js-learnings` chapter that explains the mechanism, so a
failed drill has somewhere to go back to.

---

## 2026-09-05 — New track: `ts-learnings/`. Chosen over React/Next and Express, with reasons.

`js-learnings/` finished at 22 chapters, so the question was what comes next. Surveyed the repo
before answering rather than guessing, and three facts decided it:

- **No TypeScript anywhere.** 145 JS content files, zero TS, and no mention in any track prompt.
- **`react/` is not empty** — it has `prompt.md` plus two chapters (`01-mental-model`,
  `02-render-vs-commit-phase`) with README/notes/interview but **no `mock.md` and no exercises**.
  Written under the older contract; the same state `js-learnings` chapters 1–12 are in. So React
  is a *resumption*, not a new folder.
- **Five tracks have mentor prompts written and zero content**: `docker`, `k8s`, `linux`,
  `ci-cd-pipelines`, `scripting`.

**The decisive argument for TypeScript over React/Next was ordering, not preference.** TS is a
*dependency* of the React work: a React round at a product company is conducted in TS, a large
share of real React questions are typing questions (props generics, `ReactNode` vs `ReactElement`,
discriminated unions for component state), and React notes written in plain JS would have to be
rewritten. Next.js was additionally judged a poor standalone track because App Router and caching
semantics churn fast enough that notes go stale inside a year — it belongs as an extension of
`react/`.

**Express was rejected as a track**, and the reasoning is worth keeping so it does not get
re-proposed: the material that goes deep — async error propagation, middleware as composition,
streaming responses, `next(err)` — is already in `node-learnings`, which references Express in
four chapters as applied examples. What is left is roughly one chapter of genuinely new content,
and it belongs inside `node-learnings` rather than in a folder of its own.

**Toolchain finding that shapes the track: `tsc` was not installed, and npm reports TypeScript
7.0.2 as current** — the native compiler port, newer than the assistant's training data. Installed
and verified rather than assumed: diagnostics still use the familiar
`file(line,col): error TS2322: ...` format with error codes intact. The track pins 7.0.2 the way
the JS track pins its Node version, because flag-dependent behaviour is most of the subject.

**The one substantive change to the contract**, versus `js-learnings/prompt.md` which it is
otherwise adapted from: **every example must show both the compiler diagnostic and the runtime
behaviour.** The gap between what `tsc` says and what Node does *is* TypeScript, so an example
showing one half teaches half the subject. Corollary rules: paste `tsc` output verbatim
**including the error code** (that is what gets searched at 2am), and state when
`--experimental-strip-types` is used to produce the runtime half, because stripping is not
compiling.

Thirteen chapters planned, opening with structural typing and erasure — the two facts that
generate the rest — and closing with runtime validation, because "the type system stops at the
network boundary" is the honest limit of everything above it. `JSON.parse(x) as User` is named in
the plan as the most common production bug in TypeScript codebases.

Also recorded in the track's own history: the scale caveat for this track is usually **compile**
cost, not runtime — a conditional type that explodes on a large union, a `.d.ts` that slows the
whole project.

---

## 2026-09-05 — JS Chapter 22: Strict Mode. **The language track is complete.**

`js-learnings/chapter-22-strict-mode/` — README, notes, interview, mock, six runnable examples,
chapter + cumulative exercises, blank worksheet. Chapters 1–22 now cover `prompt.md`'s topic list
end to end, and `prompt.md`'s "Remaining" section reads *nothing* for the first time.

**Written last on purpose, and the chapter says so.** Almost everything strict mode changes had
already appeared somewhere else — `Object.freeze` throwing (Ch18), `this` in an extracted method
(Ch5), `undefined = 42` (Ch21), unmapped `arguments` (Ch21), modules always strict (Ch20). What
was missing was the story connecting them, so the chapter is framed as *the reason those are all
the same fact* rather than as new material.

**The spine: you cannot remove a behaviour from JavaScript.** Every page ever written has to keep
working and the web has no recall mechanism, so the only way to fix a design mistake is to define
a second dialect and let code opt in. That single constraint then explains the parts that look
odd — most usefully **why the directive is a string literal**: a keyword would have been a
`SyntaxError` on every pre-2009 engine, so no page could have adopted it until old browsers were
gone, which for the web is never. The ugly syntax is what made incremental adoption possible. That
framing is the chapter's best interview answer and it is one almost nobody gives.

**Structured as three categories, not twenty items**, on the grounds that the list is the two-year
answer: silent failures become errors; `this` and `arguments` change behaviour; some syntax is
removed at parse time. Plus the closing reframe — *strict mode doesn't add rules, it makes the
rules that already existed produce errors instead of silence.*

Measured on Node 22.13.0. Four things worth keeping:

- **Reads of an undeclared name throw in BOTH modes; only writes differ.** Added as its own
  section after it nearly broke two teaching fixtures (below). It is also the diagnostic that
  matters when someone says "this vendor file worked before the build change" — a file doing
  `if (!queue) { queue = []; }` cannot have been relying on sloppy mode for the *read*, so
  something else must have created the global. That is usually the actual bug.
- **The concatenation hazard fails in both directions**, run as real subprocesses in
  `examples/05_*`: a strict file bundled *after* a sloppy one silently loses strictness (the
  directive is no longer first), and bundled *before* one silently imposes it on vendor code that
  never asked. The reviewable sentence: **a file-level directive is a claim about a file, and a
  file is not a unit the runtime respects — only functions and modules are.** That is most of why
  bundlers wrap each module in a function.
- **A directive preceded by another string literal is still a directive** (the prologue is a *run*
  of string literals), but one preceded by a `const` is inert — and the file still passes a
  `grep "use strict"` audit. That combination is the chapter's live-debug question.
- **`this` sloppiness is two independent behaviours**, routinely conflated: *substitution*
  (null/undefined → `globalThis`) and *boxing* (primitive → wrapper object). The `.call(null)` row
  reads `typeof "object"` in strict mode because `typeof null` is `"object"` (Ch21) — null arriving
  intact, not boxing. Annotated explicitly so the table isn't misread.

**Two exercise fixtures were mis-posed and only caught by running them** — the same lesson Ch17
recorded, arriving again in the same shape, which suggests it is structural rather than bad luck:

1. The cumulative exercise's `registry.js` used `if (!count) { count = 0; }` to demonstrate an
   implicit global, and the premise of the whole exercise is "it works". It does not: reading an
   undeclared `count` throws in sloppy mode too. Changed to `typeof count === "undefined"`, which
   is both correct and the more realistic legacy idiom — and the corrected question now *asks* why
   the author needed the `typeof` guard.
2. Chapter-exercise question K asked for four predictions in a sloppy file, but both probes return
   `false` for every call shape there — the disagreement that identifies the broken detector only
   appears in a **strict** file. Rewritten to require both runs and to name the single row that is
   the evidence.

The corrected cumulative fixture turned out better than the original: `cfg.timeout` comes back as
`0` — the correct answer — **by accident**, because a Ch21 bug (`|| defaults.timeout` clobbering a
legitimate `0`) is cancelled by a Ch22 one (the frozen write failing silently). Migrate to modules
and the cancellation stops: the write throws. Two bugs whose combination is invisible until one of
them is fixed is a better teaching case than either alone, and Phase 0 now points straight at it.

The cumulative exercise is a **capstone** rather than another single-topic build — audit, then
migrate, then fix a mixed-mode CommonJS service, touching Ch5, Ch17, Ch18, Ch20, Ch21 and Ch22.
Its deliverable is the *audit document*, not the migration, because the failure mode of this
particular task is silence.

`prompt.md`'s "Remaining" now says what the actual remaining work is, and it is not more chapters:
**several chapters still have unattempted exercises** (Ch13 partly, Ch14, Ch17, and everything from
Ch18 on). A chapter that was read is not a chapter that can be answered under pressure.

---

## 2026-09-05 — JS Chapter 21 written: `undefined`, `null`, and Missing

`js-learnings/chapter-21-undefined-null-and-missing/` — README (697 lines), notes, interview, mock,
eight runnable examples, chapter + cumulative exercises, blank worksheet. `prompt.md` updated:
only strict mode remains.

**Framed as a modelling topic, not a syntax one — that decision is the chapter.** Everyone knows
what `??` does, so nothing is scored on the operator. The round turns on two things: *"when would
you deliberately want `||`?"* (the answer is a form field or query param, where `""` and "not filled
in" genuinely are the same thing — "always use `??`" is a rule-repeater's answer), and whether
`a?.b?.c?.d?.e` reads as caution or as not knowing your data's shape.

**Absence is taught as FIVE states, not two:** holds a value · holds `undefined` · holds `null` ·
absent · array hole. That framing is what makes the operator table legible — the final table in the
README shows that **only `in` separates "holds undefined" from "absent"**, and every operator in the
language treats them identically.

**The design rule that answers "when do you use each":** `undefined` is what the *language*
produces (six sources, all measured); `null` is what *you or an API* assign — JS never produces one
on its own. Hence `PATCH { "nickname": null }` means delete, an absent key means don't touch, and
flattening both makes deletion inexpressible. That is the sentence that turns the opener from a
definition into an answer.

Six things the examples pinned down:

- **`null == 0` is `false` and `null >= 0` is `true`** because they are *different algorithms*:
  `==` hard-codes nullish and coerces nothing; relational coerces with `ToNumber`, and
  `Number(null)` is `0`. `undefined` differs on the second because `Number(undefined)` is `NaN`.
- **`a ?? b || c` is a parse error, not a lint rule**, and the committee was right: `(0 ?? 1) || 2`
  is `2` while `0 ?? (1 || 2)` is `0`, so either precedence would silently do the other thing.
- **`??=` short-circuits the assignment, not just the value.** A getter/setter log proves
  `target.v ??= 9` on `v === 0` reads and never writes, where `v = v ?? 9` always calls the setter.
  Matters for setters, `Proxy` traps, reactive tracking and frozen objects.
- **A default parameter is `!== undefined`, not `??`** — narrower by exactly one value. Two features
  added for the same reason with different rules, and nobody volunteers it.
- **Adding a default changes two other things**: `arguments` stops being a live view of the
  parameters (rest params and destructuring do it too), and a `"use strict"` body directive becomes
  `SyntaxError: Illegal 'use strict' directive in function with non-simple parameter list`.
- **`?.` short-circuits the whole remaining chain**, stops at a parenthesis, skips argument
  evaluation, and does *not* make the result safe — `a.b?.c + 1` is `NaN`. It converts a loud
  failure at the read into a quiet one downstream.

**Scale caveat, measured on a 50,000-key object:** `'k' in obj` is 37 ns/op;
`Object.keys(obj).includes('k')` is 19.3 ms/op — 528,000x, because it materialises the whole key
array every call. Both spellings look equally innocent in review. *Fine for a ten-key options
object, wrong for a cache.*

**The cumulative exercise is a layered config resolver with `explain()`** — defaults → file → env →
CLI → runtime patch, where every layer disagrees about what absence means (`APP_VERBOSE="false"` is
a truthy string, `--tag=` is an empty value, a JSON layer cannot carry `undefined`). It reaches back
into Ch16 error causes, Ch17 retention, Ch18 freezing and structural sharing, and Ch19 numeric
parsing. The deliverable is the provenance output, not the merge.

---

## 2026-09-05 — JS Chapter 20 written: Modules (ESM)

`js-learnings/chapter-20-modules-esm/` — README (876 lines), notes, interview, mock, nine runnable
example sets, chapter + cumulative exercises, blank worksheet. `prompt.md` updated: modules moves
into "covered", leaving `undefined`/`null`/missing and strict mode as the remaining two.

**The spine is one sentence:** an ES module's imports are wired to the *exporter's own binding
slots* by a linking phase that completes before any code runs. Live bindings, read-only imports,
link-time export checking and the cycle TDZ are all the same fact seen from four angles, and the
chapter is organised so each part names which of the three phases — parse, link, evaluate — it
belongs to. The habit being trained: **answer "what happens" with "in which phase"**.

**Scoped against `node-learnings/14-module-system-internals/` deliberately, per the note left in
`prompt.md` on 2026-09-03.** Zero overlap: that chapter owns resolution, the module cache and
startup cost; this one owns the phase split, binding indirection, cycle TDZ, module scope and
interop. The Node chapter's claim that cycles "safely point to empty memory slots" is corrected
here with a measured run.

**Everything was measured on Node 22.13.0, and the version turned out to matter more than in any
other chapter.** `require(esm)` shipped unflagged in **22.12**, so the standard interview answer —
"you can't `require()` an ES module because ESM is async" — is now wrong. It works whenever the
whole graph is synchronous; with top-level await anywhere in it you get `ERR_REQUIRE_ASYNC_MODULE`,
because the one thing `require` cannot do is return a promise. `require("./sync.mjs")` returns the
**namespace** (with `__esModule: true` added), not `module.exports`. This is now the closer of
`mock.md`, framed as a dating question.

Five things the examples proved that reading would not have:

- **A link error runs nothing.** `import { MISSING }` from a module that `console.log`s on
  evaluation produces `SyntaxError: ... does not provide an export named` and the log never appears.
  Missing exports are a *static* defect, same class as a bad brace.
- **The namespace object's descriptor lies.** `Object.getOwnPropertyDescriptor(ns, "count")` reports
  `writable: true` and the assignment still throws `Cannot assign to read only property` — the
  exotic `[[Set]]` returns false unconditionally. `Object.isFrozen(ns)` is `false` while nothing can
  be written. The only place in the language where the descriptor is not the authority.
- **The two systems disagree about who runs first in a cycle.** ESM: `main → a → b → a` evaluates
  `b` to completion before `a` starts (depth-first post-order). CJS: `a` starts first and is
  interrupted mid-body. Same graph, opposite order — a detail almost nobody has.
- **An unsettled top-level await exits 13 with no exception.** `Warning: Detected unsettled
  top-level await`, then the loop empties and Node quits. Nothing is thrown, so nothing catches it.
  In production: a container that starts, logs nothing useful, and dies.
- **A module that throws is cached as errored; CJS deletes it and re-runs.** Two `import()`s of a
  throwing module evaluate it once and replay the same error; two `require()`s evaluate it *twice*.
  A CJS module that opens a connection before it throws opens two.

**`cjs-module-lexer` is a text scanner, and the exercise leans on the distinction.**
`exports.devOnly = …` inside an `if` **is** found (it matches a shape); `exports[computed] = …` is
not (the name isn't in the text). That is why named imports from a CJS dependency can work in dev
and fail after a build changes the dist file.

**Chapter 19's worksheet is still blank** — Ch20 was written ahead of it deliberately, same as
Ch10's exercises in the AI track. Both sets are open.

---

## 2026-09-03 — JS Chapter 19 written: Numeric Edge Cases (and the topic order changed)

`js-learnings/chapter-19-numeric-edge-cases/` — README, notes, interview, mock, six runnable
examples, chapter + cumulative exercises, blank worksheet.

**Numeric was promoted over modules, and the reason is worth keeping.** `prompt.md` had modules
(ESM) as priority 1. Checked the overlap before starting and found
`node-learnings/14-module-system-internals/` already covers ~70% of it in 1,735 lines: CJS vs ESM,
the four load phases, **live bindings explicitly** ("CJS copies, ESM live bindings" is its
circular-dependency punchline), hoisting during linking, top-level await, resolution, the module
cache, "cannot mix CJS and ESM freely". Meanwhile numeric had **zero** coverage anywhere —
`grep` for `0.1 + 0.2`, `Number.EPSILON`, `MAX_SAFE_INTEGER` hit only `prompt.md` — and two
chapters were already forward-referencing it (Ch8 mentions IEEE-754 without unpacking it; Ch18
defers `Object.is` on `NaN`/`-0` to "Chapter 20"). Swapped, and `prompt.md`'s modules entry now
carries the scoping note so the eventual chapter is written as language-semantics-only rather than
duplicating a sibling track.

**One real gap in the node track was found while checking this, and is recorded in `prompt.md`:**
that chapter says linking wires up slots so cycles "safely point to empty memory slots". Verified
with an actual ESM cycle — reading an imported `const` mid-cycle throws
`ReferenceError: Cannot access 'aValue' before initialization`. Linking-not-looping is true;
reading is a TDZ error, not a safe read.

**The spine is one sentence:** a JS number is a fixed count of significant *bits*, not decimal
places — so what's stored is the nearest representable value to what you wrote, and how near
depends on how big it is. `examples/01_the_format.js` prints the actual 64-bit layout, and four
facts are visible in the table before any prose: `0.1` and `0.2` share a repeating mantissa, `0.3`
and `0.1+0.2` differ in the last bit, `+0`/`-0` differ in exactly one bit, and `Infinity`/`NaN` are
the all-ones exponent with zero / any-non-zero mantissa. That table replaced what would otherwise
have been three paragraphs of explanation.

**Everything measured on node 22.17.1. Four results changed what got written:**

- **`Number.EPSILON` as an absolute tolerance is off by 537 million x at 1e9.** The naive
  `Math.abs(a-b) < Number.EPSILON` returns `true` for `0.1+0.2 vs 0.3` and `false` for the same
  arithmetic shifted to 1e9, where the real difference is 1.19e-7. This is the chapter's Q2 and the
  mock's live-debug, because "use Number.EPSILON" is the answer most candidates give and it is
  wrong everywhere except near 1.0. The honest caveat that goes with the fix — relative tolerance
  is undefined against exactly zero — is stated rather than glossed.
- **`toFixed` is not broken and is not banker's rounding, and I had to survey it to say so
  precisely.** The first draft claimed it was "inconsistent by value"; that was wrong. It rounds
  half-up correctly *on the value it was given*, and that value is never the decimal you typed.
  Surveyed 399 values of the form `x.xx5`: **120 round up, 279 round down**, decided by whether the
  nearest double landed above or below the decimal half. `(1.005).toFixed(20)` is
  `1.00499999999999989342` (below → down); `(0.025).toFixed(20)` is `0.02500000000000000139`
  (above → up). "Correct rounding of a number that isn't the one you typed" is the reframe the
  chapter sells.
- **The `-0` story is two bugs, not one.** Expected `toFixed` to expose a true `-0`; it doesn't —
  `(-0).toFixed(2)` is `"0.00"`. What produces `"-0.00"` is a small *negative* that rounds to zero
  (`(-0.001).toFixed(2)`), which is the more common cause. Meanwhile `Intl.NumberFormat().format(-0)`
  **does** render `"-0"` while `String(-0)` gives `"0"` — so a true `-0` is invisible to every log
  line you'd naturally write and visible in the formatted UI. Corrected an example annotation that
  had asserted the opposite before running it.
- **`Math.max(...arr)` overflows the stack between 125,000 and 150,000 elements** on node 22 —
  measured after catching myself asserting "around 100k+" from memory in `interview.md`. Two
  independent reasons the spread form is the wrong default, alongside `Math.max()` returning
  `-Infinity` for an empty array.

**Money is the chapter's decided-on question**, answered as four steps (integer minor units →
integer arithmetic → one explicit rounding where you divide → `Intl.NumberFormat` at the edge). The
argument that carries it is a two-line measurement: `[19.99, 5.01, 0.1, 0.2]` sums *exactly*, and
`[12.35, 4.45, 8.90]` gives `25.700000000000003` — nothing in either list looks different, so "it
worked when I tested it" is not evidence about the next basket. That example was rewritten after
the first two candidate price lists both happened to sum exactly, which would have undercut the
point rather than made it. Accumulation at three scales (100 / 10k / 1M additions of 10c) shows
float error growing to 1.33e-6 while integer cents stays at exactly 0, and `splitEvenly(1000, 3)`
→ `[334, 333, 333]` versus the naive float split's `9.99` makes "the parts must sum to the whole"
a business rule rather than a rounding mode.

Also corrected in passing, since it would cost points in a round: **`Math.Infinity` does not
exist** (it's `undefined` — `Math` holds functions and mathematical constants; numeric limits live
on `Number`), and `Number.MIN_VALUE` is the smallest *positive* value, not the most negative.

Exercises unsolved and the worksheet blank, per the track contract. The cumulative is a
double-entry **ledger organised around one invariant** — every entry sums to exactly zero and the
parts of a split equal the whole — which is trivially true with integers and quietly false with
floats, so Phase 1 builds the float version and measures its drift over 10,000 generated invoices
and Phase 7 requires the finished version's drift column to be **exactly zero, asserted with
`===`**. Phase 7 also requires naming what the ledger still cannot represent, which is where FX and
fractional minor units come in.

Two stale `Part 8` cross-references in Chapter 18's examination table were fixed (the earlier
renumber's `sed` matched `Part 8` but not `Parts 4, 8`).

**Part 0 was added after the fact, and the gap it fills is worth recording.** The chapter as first
written opened on a 64-bit layout diagram using "mantissa" and "exponent" as if defined, and used
`1e9`/`1e16` throughout without ever saying what the notation means. Asked about it directly, which
was correct feedback: the track's "no beginner explanations" rule is about not padding, not about
assuming vocabulary the chapter itself depends on. `examples/00_notation_primer.js` now builds it
from scratch — `1e9` as a spelling rather than a type (and the fact that JS *prints* that way on
its own, so `5e-7` in a log means nothing about how it was written), then mantissa/exponent in
decimal (`6371000 = 6.371 x 10^6`) before binary, then a decoder that pulls the three fields out of
a real double and **reconstructs the value exactly** — `0.1` is significand `1.6`, exponent `-4`,
and `1.6 x 2^-4 === 0.1`. The payoff is the sentence the whole chapter rests on: the mantissa is a
fixed 53 bits so you get ~15-17 significant digits at *every* scale and the exponent only moves the
point, which is why `1e15 + 1` changes the value and `1e16 + 1` does not, and why the gap to the
next double is 1 at 1e15 and **16,384** at 1e20.

`prompt.md` now reads "Covered, chapters 1–19", with modules (ESM) as the next chapter at 20.

---

## 2026-09-03 — JS Chapter 18 written: Copying, Immutability and Freezing

`js-learnings/chapter-18-copying-immutability-and-freezing/` — README, notes, interview, mock, six
runnable examples, chapter + cumulative exercises, blank worksheet. First of the four topics left
in `prompt.md` after Chapter 17 closed the memory-management one out.

**The spine reuses Chapter 17's question from the other side.** Ch17 asked "who points at this,
and how long does that live?" to explain leaks. This chapter asks "who else points at this, and
did I mean to let them?" to explain accidental mutation — same reference-tracing habit, opposite
symptom. The unifying sentence: **nothing in JS walks your object graph for you — copying,
freezing and equality all stop at the first reference, and depth is always something you ask for.**

**Every number in the chapter was measured, not recalled, on node 22.17.1**, and three of them
overturned an assumption going in:

- **`structuredClone` preserves aliasing within one clone call; `JSON.parse(JSON.stringify(x))`
  does not.** `state = {a: shared, b: shared}` clones to `clone.a === clone.b` staying `true` under
  `structuredClone` (a NEW object, shared by both properties) and `false` under the JSON hack
  (duplicated into two independent objects). This wasn't in the plan for the chapter and turned
  out to be the sharpest fact in Part 3 — it's the same memo-table mechanism that lets
  `structuredClone` survive a cycle, stated as a fact about ordinary aliasing instead of about
  cycles specifically.
- **`Object.freeze` on a `Map` or `Set` does not stop `.set()`/`.add()`/`.delete()`.** Expected
  this to at least throw on reassignment attempts; it does nothing at all, silently, because a
  `Map`'s entries live in `[[MapData]]`, not in enumerable own properties — freeze has nothing to
  lock. `deepFreeze` doesn't close the gap either, because it walks properties too. This became the
  chapter's other flagship gotcha, on equal footing with the accessor-setter one already expected.
- **Sloppy mode makes a frozen write silently no-op; strict mode throws the identical line.**
  Verified by writing the failing case in a file with no `"use strict"` — not "modules are strict",
  literally checked the CommonJS-script default. This is the trap `examples/04_freeze_gotchas.js`
  exists to demonstrate, and it needed a strict-mode IIFE wrapped around one specific write to show
  both behaviours in the same file without fighting the file's own default mode.

**The scale-caveat numbers are the chapter's other pillar**, in `examples/06_scale_structural_sharing.js`:
on a 100,000-object tree (20 slices × 5,000 items), changing one field of one item costs 139.69 ms
via `structuredClone`-the-whole-tree, 69.25 ms via the JSON round trip, and 1.14 ms via path-copying
— spreading only the objects on the route from root to the change. **~120x**, and it's not just a
speed number: `sameRef`-style checks prove the untouched sibling slice and the untouched sibling
item are the literal same object, not equal copies of it — which is the actual mechanism (stated
with no framework attached) behind every "only re-render what changed" system. The freeze version
of the same measurement — 0.04 ms shallow vs 82.14 ms for a full `deepFreeze` traversal, **~2000x**
— is why freeze defaults to shallow, and the chapter argues there's a second reason beyond speed:
a deep operation walks past objects the caller doesn't own (a shared logger reachable from a config
object would get silently locked for everyone else holding it), which shallow-by-default respects
and deep-by-default cannot.

**One structural decision, made while outlining, was to fold "why doesn't X recurse" into the
existing Part 6 ("what JS cannot do") rather than give it its own part** — the ownership argument
(reachable ≠ owned) is the same shape as "you cannot force a collection" from Ch17: both are
restrictions the language keeps on purpose, and the chapter's "what would break if this worked
differently" question for this topic is literally that argument run forward.

Verified, not assumed, before writing them into the chapter: `Object.freeze` returns the *same*
reference (not a frozen copy) and is idempotent; primitives are always `Object.isFrozen` `true`;
an accessor property's setter still runs after freeze because freeze only ever sets `writable` on
data properties; `const` reassignment throws regardless of strict mode (binding-level, unlike
property writes) while a `const` array's `.push()` is untouched by `const` at all.

Exercises unsolved and the worksheet blank, per the track contract. The cumulative (an immutable,
structurally-shared store) is phased the same way Ch17's was: Phase 1 is the obviously-wrong
mutate-in-place version, measured honestly, and every later phase closes one gap — path-copied
updates, reference-equality-gated subscriptions, a frozen `getState()` with its gap named out loud,
memoised selectors, a `structuredClone` escape hatch with its own limits demonstrated — ending in a
Phase 7 that benchmarks v1 against the finished store on the identical workload and requires naming
what the finished version still cannot protect against.

`prompt.md` now reads "Covered, chapters 1–18", with modules (ESM) promoted to next.

---

## 2026-09-02 — JS Chapter 17 written: Memory Management and Leaks

`js-learnings/chapter-17-memory-management-and-leaks/` — README, notes, interview, mock, six
runnable examples, chapter + cumulative exercises, blank worksheet. First of the five topics left
in `prompt.md`, and the one it flagged as most often asked.

**The spine is one sentence and everything else is a consequence:** a leak in JavaScript is never
a failure to free, it is a reference you did not know you were keeping. There is no `free()`, so
the only lever is *stopping pointing at things* — which turns every question in the chapter into
"who points at this, and how long does *that* live?" rather than "am I still using this?".

**The flagship result — closures share one context, and it is measurable.** Both of the usual
answers to "do closures leak" are wrong. Not "a closure keeps its whole scope alive", and not the
plausible correction "only what it references". V8 allocates **one context object per scope**
holding every variable that *any* inner function references, and every closure born there points
at that same context. So a two-line logger retains its big sibling's buffer:

```
A. small closure, big sibling exists    7.6 MB held   RETAINED
B. small closure, no sibling at all     0.0 MB held   collected
C. sibling exists, payload nulled       0.0 MB        collected
D. payload isolated in its own scope    0.0 MB        collected
```

Identical outer function, identical returned closure. The only difference is whether a *second*
function in that scope mentions the variable. C is also the one place where `x = null` "for the
GC" stops being cargo cult — the context slot is literally the thing being retained.

Measured on node 22.17.1 rather than recalled:

- **2,000,000 identical allocations: 13 ms if none survive, 207 ms if all do.** Same work, 16×,
  and the only variable is the survival rate. Kills "allocating in a hot loop is slow" and, with
  it, the argument for object pooling — a pool is long-lived objects by construction.
- **Sawtooth vs staircase, measured as post-collection floors:** `4 4 4 4 4 4 4 4` against
  `4 5 6 6 7 7 8 8`. The peak says nothing; the floor is the whole diagnostic.
- **`unref()` freed nothing.** It stops a timer holding the event loop open. `clearInterval` is
  what releases the closure. Two questions that get conflated constantly, now with numbers.
- **A `deref()` keeps its target alive to the end of the turn.** "Drop it, force gc, deref" in one
  turn always returns the object — that is the spec preventing two `deref` calls in one function
  from disagreeing, not a failed collection. It only reports `undefined` a turn later.

**Four measurements failed before they worked, all the same root cause: a running frame keeps its
own slots and registers alive.** This cost the most time and turned out to be the most useful
thing in the chapter.

1. Scenarios written at the **top level of a module** freed nothing, ever — that frame does not
   return until the process exits. Every case read "still retained" and the file proved nothing.
2. `let handle = build(); handle = null;` also freed nothing: the value was still live in a
   register of the same frame. Only clearing a **property of a heap object** is reliably
   observable, which is why the harness in every example is `holder.ref = null`.
3. A template literal evaluated `above()` *before* the `buildCycle()` call interpolated after it,
   so the "before" reading was taken before anything was allocated.
4. `i % Infinity` forces float modulo, so the "keep none" row was timing arithmetic and came out
   *slower* than the row keeping 20,000 objects. Integer divisor, and the ordering inverted back.

This is the same lesson Chapter 13 recorded in different clothes — a measurement showing no
difference usually means the probe is wrong — but it earns a place in the chapter itself, because
it is also a production fact: it is why a heap snapshot taken mid-request shows objects you are
certain you released, and why the **retainer path** is the thing to read in a snapshot, never the
object count.

**Two questions were mis-posed in the exercise and only caught by running them.** Case D asked why
nesting a closure one level deeper gives a different answer from case A — it does not, because
contexts chain to their parent, so the answer is identical and the question asserted something
false. Case E asked why its "after" number was not zero; it is zero. Both rewritten to ask what is
actually true. Exercise questions need the same verification pass as example output, and they
don't get it for free — nothing runs them.

`mock.md`'s whiteboard is a bounded LRU built on `Map` insertion order, and it was executed
before being written down: filled to `max`, touched the oldest key, inserted one more, asserted
the *second* oldest was the one evicted. It also had two real defects on the first pass — `#max`
and `#ttl` used but never declared as private fields, and the debug snippet reading `session.url`
off an object that has no `url`.

The scale caveat the chapter leans on hardest is `Promise.all`: peak memory is the **sum** of every
result, held until the slowest input settles. That reframes Chapter 14's concurrency limiter as a
memory control rather than a politeness control, which is the version that survives a follow-up.

Chapter 16's closing pointer already said "Chapter 17 is memory management" — the renumber's N+1
sweep on 2026-09-01 retargeted it, and it landed correctly. `prompt.md` now reads "Covered,
chapters 1–17", with copying/immutability promoted to next.

Exercises unsolved and the worksheet blank, per the track contract. The cumulative (a store that
caches, deduplicates and publishes) is built so the **delta is the deliverable**: Phase 1 writes
the obvious leaky version and measures the staircase, and every later phase closes one shape and
re-runs the identical workload. Phase 7 requires the before/after table and a paragraph naming
which shape the finished design *still* structurally allows — because every design permits some
misuse and the useful answer names it.

---

## 2026-09-01 — JS Chapter 13 written: Callbacks and Inversion of Control

`js-learnings/chapter-13-callbacks-and-inversion-of-control/` — README, notes, interview, mock,
six runnable examples, chapter + cumulative exercises, blank worksheet. Fills the gap the
renumber was done for.

**The spine is a mapping table, not a history lesson.** Each promise guarantee cancels exactly
one way a callback API can betray you: settle-once kills called-twice, always-async kills Zalgo,
propagating rejections kill the per-level `if (err) return`, and `.then` returning a promise kills
"a callback has nowhere to return to". Written that way because the question this chapter exists
to answer — *what problem do promises solve?* — had no answer anywhere in the track. The promises
`interview.md` has eleven questions and none of them was that one.

**The thesis worth keeping: callback hell is not indentation.** Flattening a pyramid into named
functions removes the shape and fixes nothing — error handling stays per-level, the concurrency
latch stays hand-written, and reading order stops matching execution order. The real defect is
that `return` inside a callback returns to the engine, so **an async operation is not a value**,
and nothing that combines values applies to it. Everything else follows from that.

Measured on node 22.17.1 rather than recalled:

- **50,000-deep sync CPS is a `RangeError`; the same depth async completes in 35ms.** Unbounded
  depth and unreachable-by-`catch` are one fact read two ways: every async link starts a fresh
  stack, so there is no frame beneath it to overflow *and* none to catch a throw.
- **A library that catches your callback's throw calls you twice for one operation** — once with
  the value, once with your own handler's bug re-reported as the operation's failure. The
  error-first protocol cannot distinguish "operation failed" from "handler failed".
- **`runIt(counter.increment)` does not throw in sloppy mode.** `this` is `globalThis`, so
  `this.n++` writes `NaN` to the global object and returns. The strict-mode `TypeError` is the
  *better* outcome; silent global corruption is the one that ships.
- **A process exits 0 with a promise still pending.** The event loop does not consider a pending
  promise to be work. That is why "callback never called" survives promises — it becomes "never
  settles", which is not an error, produces no `unhandledRejection`, and in a request handler
  shows up only as p99 latency.

One example was rewritten after it measured nothing: the first version contrasted stack depth in
direct vs sync-CPS calls and got **10 frames against 10** — a true comparison of two things that
are the same. Replaced with the 50k overflow, which is the memorable version of the same claim.
**A measurement that shows no difference is not evidence of subtlety; usually the probe is
pointed at the wrong thing.**

`mock.md` is deliberately not a standalone callback round, because that isn't a real interview.
It's written as the opener that escalates into promises — which is how the topic is actually
examined, and it makes the levels table honest.

Exercises unsolved and the worksheet blank, per the track contract. The cumulative (`flow`) is
built so the **port is the deliverable**: write `parallel` deliberately wrong first with four
failing tests, fix it, then rewrite the whole thing on promises and write the paragraph about
which guards disappeared. Phase 6 is marked genuinely optional.
---

## 2026-09-01 — JS chapters renumbered: callbacks inserted at 13

Callbacks were never taught as a topic. "Callback" appears ~90 times across the track, but
always as vocabulary in service of something else: `fn.length === 2` dispatch in Ch11, one
`getUser(id, cb)` Zalgo snippet in promises, queue entries in microtasks, "a scheduled callback
runs on a fresh stack" in error handling. **Continuation-passing style, callback hell,
error-first as a convention, and inversion of control had no home** — and the promises
`interview.md` had eleven questions, none of them "what problem do promises solve".

**The renumber:**

| Was | Now |
|---|---|
| — | `chapter-13-callbacks-and-inversion-of-control` |
| `chapter-13-promises-and-async-foundations` | `chapter-14-...` |
| `chapter-14-microtasks-and-macrotasks` | `chapter-15-...` |
| `chapter-15-error-handling-semantics` | `chapter-16-...` |

Every entry below this one predates the shift and **names chapters by their old numbers**.
That is deliberate — a dated log that gets retroactively edited stops being evidence of what
happened. Read the table above and subtract one.

**Appending as Chapter 16 was the first instinct, and it was wrong.** The argument for it was
that numbering here tracks writing order, citing Ch15 as precedent for writing out of order.
But Ch15 was *written* out of order and *numbered in its reading slot* — `prompt.md`'s topic
list enumerates 1–15 in exactly directory order. Numbering has always been reading order, so
the precedent said the opposite of what it was cited for. What made the renumber cheap: **14
and 15 were never committed**, so only the promises directory had history to preserve, and
`git mv` preserved it.

Three things the mechanical pass got wrong, all found by verification rather than by review:

1. **`sed` silently did nothing.** The file list came from an unquoted `$files` in zsh, which
   does not word-split — `sed` received one newline-laden blob as a single filename and failed
   on all 30 files. It exited 2, but a pipeline that swallowed the status would have reported
   success over an untouched tree. **Null-delimited `grep -rlZ | xargs -0` is the only safe
   shape.** Checked the diff was empty before retrying, rather than assuming a partial write.
2. **Substitution must run descending — 15→16, then 14→15, then 13→14.** Ascending
   double-shifts: 13 becomes 14, then that new 14 becomes 15.
3. **Forward references to unwritten chapters are invisible to the pass.** Error handling
   closed with "Chapter 16 is memory management" — a pointer at the *next* chapter, written
   when the file was Ch15. The pass only touched 13/14/15, so the file ended up as Chapter 16
   announcing itself as memory management. Two of these (README and the cumulative exercise);
   both retargeted to 17. **Any renumber has to sweep N+1 as well as the range being moved.**

Ranges (`Chapters 12–15`, `Cumulative Exercise — Chapters 1–13`) were excluded automatically by
anchoring on singular `Chapter N`, then fixed by hand. Chapter 12's seventeen forward references
all turned out to mean promises specifically — "the channel `await` runs on" — not "the next
chapter", so shifting them to 14 was correct; verified by reading each in context, not by
pattern.

`prompt.md` needed two rewordings a number shift could not do: the recalibration note now reads
"applies from Chapter 13 onward" (the new callbacks chapter is written under the new contract
too) rather than naming the chapter that triggered it.

---

## 2026-08-31 — JS Chapter 15 written: Error Handling Semantics

`js-learnings/chapter-15-error-handling-semantics/` — README, notes, interview, mock, six
runnable examples, chapter + cumulative exercises, blank worksheet. Chapters 13 and 14 both
deferred the language mechanism here; this is it.

**Written out of order, deliberately.** Chapter 14's exercises are unattempted and Chapter 13's
worksheet is half-finished, which the track contract says should block the next chapter. Asked
rather than assumed, and was told to proceed — both exercise sets stay open.

The framing: **everything is a completion.** Every statement finishes normally or abruptly
(`return` / `throw` / `break` / `continue`), abrupt completions travel outward, `catch` absorbs a
throw, and `finally` runs past every completion — replacing it if `finally` completes abruptly
itself. That one rule makes the whole `finally` family answerable instead of memorised, and it
generalises to the async half: a completion travels through frames on the current stack, and
cannot travel through *time*.

**Everything measured on node 22.17.1 rather than recalled.** What the measurements settled:

- **`JSON.stringify(new Error("x"))` is `{}`.** `message` and `stack` are own but
  **non-enumerable**. The nastier case is a custom class: fields you assign *are* enumerable, so
  you get `{"name":"AppError","code":"E_DB"}` — which looks like it worked while message and
  stack are gone.
- **`class X extends Error {}` does not set `name`.** It stays `"Error"`, and so does the stack
  header. Every log line lies until you assign `this.name`.
- **`instanceof Error` is wrong in both directions.** False for a genuine Error from a `vm`
  context (or a second copy of a package in `node_modules`); true for
  `Object.create(Error.prototype)`, which has no stack. `Object.prototype.toString.call(x)` is
  the realm-proof check.
- **The cost of an Error is the stack, not the throw.** Reading `.stack` costs ~5x constructing
  the Error, because construction captures structured frames and `.stack` *formats* them lazily
  on first access. `stackTraceLimit = 0` makes construction ~7x cheaper. So a logger that
  serialises every handled error pays the large number.
- **`unhandledRejection` and `uncaughtException` are different events, and Node ≥15 converts the
  first into the second when unlistened.** The handler's **`origin`** argument is what tells them
  apart — install only an `uncaughtException` listener and rejections arrive there with
  `origin="unhandledRejection"`.

Two traps in writing it, both worth keeping:

1. **The benchmark's plain-object baseline was a lie.** V8's escape analysis deleted the
   allocation, so it read 12.8M/s in one run and 71M/s in another. Adding a sink did not fix it —
   the object still does not escape. Fixed by reporting the two ratios that *do* reproduce
   (`.stack` vs construct, and `stackTraceLimit=0` vs default) and labelling the plain-object row
   as a floor rather than a measurement. **A benchmark number that moves 5x between runs is not a
   number.**
2. **A probe conflated the two failure events.** An `uncaughtException` listener appeared to
   catch three unrelated things; two of them were unhandled rejections being converted. Splitting
   the probe into separate processes is what produced the `origin` finding — which is now the
   sharpest detail in Part 6.

The whiteboard build for `mock.md` and Phase 3 of the cumulative is `withRetry`, chosen because
it forces four chapters at once: thunks (Ch13), `return await` inside a `try` (Ch15), the
microtask/macrotask distinction in the backoff (Ch14), and `AggregateError` for the give-up path.
The scored line is `return await thunk()` — plain `return` exits the `try` before the rejection,
so the `catch` never runs and the retry loop silently becomes a single attempt.

Also updated `js-learnings/prompt.md`'s progress list: covered is now 1–15, and error handling
came off the remaining list (memory management is next, and Chapter 15's README points at it).

---

## 2026-08-31 — JS Chapter 14 Part 8: stated that `Promise.reject` does not throw

Part 8 explained *when* an unhandled rejection is reported but never said what a rejection **is**,
and that gap is what made the section confusing to read. The snippet opens with
`Promise.reject(new Error(...))` followed by a `console.log` that prints first — which looks
wrong if you are carrying the assumption that rejecting and throwing are the same act.

They are unrelated mechanisms that happen to involve the same object:

- `throw` unwinds the stack immediately; the next line is never reached.
- `Promise.reject()` **constructs a promise in the rejected state and returns normally.** The
  next line runs. `try`/`catch` around it catches nothing.
- `new Error(x)` does not throw either — it allocates and captures a stack trace. Which is why
  the trace in Part 8's output points at the `new Error`, not at a `throw`.

So the error text in that output is not an exception propagating. It is the host **reporting** an
unobserved rejection at a scheduled checkpoint. Added as a comparison table plus a four-line
`try`/`catch` demonstration, and a misconceptions row: *"a rejected promise throws" → it holds an
error as a value; only `throw` unwinds the stack.*

This is Chapter 13's **errors are values** rule, and the cross-reference is now explicit in both
directions.

The section also described the deadline without ever showing it. Added **"Watching the check
fire"**: an `unhandledRejection` listener keeps the process alive, and work is queued in both
queues, so the checkpoint becomes visible in one run —

```
1  sync line
2  microtask
3  microtask
   >>> CHECK RUNS: nobody handled it <<<
5  macrotask (the timer)
```

The check sits **after every microtask and before the first macrotask**, which is the whole of
Part 8 in one output block. Also replaced the bare `PromiseRejectionHandledWarning` quote with
the real three-line sequence — report, then the late `.catch`, then the warning — so the warning
reads as "you missed the deadline" rather than as a separate mystery. Output captured from a real
run, with the PID elided the same way the existing block elides the stack trace.

---

## 2026-08-31 — JS Chapter 13: README edited, not rewritten (and a broken table found)

Asked to give Chapter 13's README the same treatment as Chapter 14's. **It did not need it, and
saying so was the right answer.** Chapter 13 is the document Chapter 14 was rewritten *toward* —
it already opens with a facts box and an examined-topics table, leads with mechanism, and uses
tables where the content is a lookup. A ground-up rewrite would have been churn against a good
file, with a real risk of losing detail.

What it actually needed was a light register pass and one genuine bug. 591 lines to 583.

**The bug: a markdown table has rendered wrong since the chapter was written.** In the
combinators table, `allSettled`'s cell is `{status, value|reason}[]` — and an unescaped `|`
splits a table row even inside a code span. That row had six separators against five everywhere
else, so it rendered with a phantom column and `never` in the wrong place. Escaped now.
`interview.md` had the same cell written correctly as `value \| reason`, which is why the bug
survived: the file it was most likely to be compared against was already right.

Added a check worth reusing: count **unescaped** pipes (`(?<!\\)\|`) per row and assert every
row in a contiguous table block agrees. Naive pipe-counting flags the escaped fix as broken and
misses nothing else.

The register pass removed the handful of places where the prose graded the reader rather than
explaining the mechanism — "the fact that separates people who use promises from people who
understand them" opening Part 3, "misconceptions dissolve once that lands", "interview bait",
"this is the interview-grade detail", "breaks in a way that looks like magic". Each became a
statement of what happens. Deliberately kept: the sayable-sentence blockquotes (contract), the
3am-log-line line (concrete, and echoed in `mock.md`), and "knowing a mechanism you can't say
out loud in 45 seconds scores zero", which is the point of the track.

Also converted "What You'll Actually Hit in Production" from a numbered prose list to the
**symptom → cause** table Chapter 14 now uses, so both chapters present production failures the
way they are actually encountered — you have the symptom, you want the cause.

**Worth remembering: "do the same to X" is a request to reach the same standard, not to run the
same process.** Chapter 14 needed a rewrite because it was narrative; Chapter 13 was already
there and needed proofreading. Applying Chapter 14's process to Chapter 13 would have destroyed
value while looking like more work.

---

## 2026-08-31 — JS Chapters 13 + 14: interview.md audited against the track contract

Checked `notes.md`, `interview.md` and `mock.md` against `js-learnings/prompt.md`, which
specifies exactly what each file must contain.

**Clean:** `mock.md` in both chapters (opener → prediction → live debug → whiteboard → closer,
annotations, levels table, level-raising sentences, red flags) and `notes.md` in both.

**One gap, and it was track-wide.** The contract requires every interview question to carry four
things — spoken answer with a target time, what the interviewer is scoring, the follow-up, and
**the red flags that drop a level**. Red flags were essentially missing: one mention in each
file, both inside a single question. They existed only as a consolidated block at the end of
`mock.md`, which is the wrong place to drill them — you rehearse a question, not a chapter.

Chapter 14 was otherwise complete. **Chapter 13 was worse than Chapter 14 despite being the
reference implementation**: six of eleven questions were missing `Scored on:` or `They'll push:`
as well. Both files are now complete on all four elements across 11 questions each.

Also added, per the contract's "one *why does JavaScript behave this way?* and one *what breaks
if this worked differently?* per topic":

- **Ch14 Q11 is new** — "what breaks if this worked differently?", answered in both directions.
  If microtasks went one-per-pass, promise chains stop being atomic and "end of turn" loses its
  definition, so unhandled-rejection detection has nothing to fire at. If macrotasks drained to
  empty, one self-rescheduling timer or a fast socket starves every other connection. The point
  being scored is that the asymmetry is a **trade with a price** — you accept starvation to get
  atomic chains — not an arbitrary rule.
- **Ch13 already answered it inside Q2** (handlers always async: if they fired synchronously,
  callback timing would depend on cache warmth). Made the framing explicit rather than adding a
  redundant twelfth question.

Block ordering in ch13 was also inconsistent — some questions had `Scored on` before the
follow-up, some after — and is now canonical across all eleven: **answer → Scored on → follow-up
→ asides → Red flags**. Seven questions moved. Done with a fence-aware paragraph parser rather
than regex, because Q10's code block contains blank lines and naive paragraph splitting cuts it
in half; the reorder asserts the multiset of paragraphs is unchanged before and after.

**Worth remembering: the newest chapter is the reference for *shape*, not for *completeness*.**
Chapter 13 set the conventions and still failed its own contract on half its questions. Reading
the sibling tells you what the structure should be; only the prompt tells you what has to be in
it.

---

## 2026-08-31 — JS Chapter 14: README rewritten, register corrected

The README was written as narrative and read like one: an extended receptionist / waiting-room
/ sticky-note metaphor carried Part 3, sections opened with "here's the trick" and "look at what
just happened", and explanation arrived as coaching rather than as reference. Rewritten end to
end — mechanism first, consequence second, no metaphor scenes. 886 lines to 759, nothing
technical dropped (verified by diffing the technical vocabulary of both versions: every measured
figure, API name and code block survives).

What changed structurally, since the substance is identical:

- **Prose replaced by tables where the content was really a lookup.** Microtask/macrotask
  membership, the job/microtask/task/tick vocabulary, and the production section — now a
  symptom → cause table, which is how it actually gets used.
- **The receptionist metaphor is gone.** The asymmetry it existed to convey is stated directly
  and reinforced by the diagram that was already there.

**The rewrite initially drifted from `js-learnings/prompt.md`, which I had not read.** Caught
on being asked. Three deviations, all now fixed, and they are the reusable part of this entry:

1. **The contract says the README must *open* with the map of how the topic is examined.** I had
   demoted it to a `###` subsection underneath the mental model. It is the first `##` now.
2. **"Part N" is the track's convention**, set by Chapter 13, which was the first chapter written
   under this contract. I had renumbered to "§N" for a reference feel and broken consistency
   with the sibling chapter. Reverted, including the one external cross-reference in
   `examples/03_tick_costs.js`.
3. **"Teach me the mechanism, then teach me the sentence" is an explicit rule**, and Chapter 13
   implements it as a sayable line in a blockquote ("A promise is a value, not a task"). Purging
   the coaching voice took some of those with it. Restored as blockquotes in the model section,
   Part 2 and Part 5.

Also added the **"Read this box first — six facts"** opener that Chapter 13 uses and Chapter 14
never had.

**The lesson, which generalises past this chapter: `CLAUDE.md` is the repo contract, but each
track has its own `prompt.md`, and the sibling chapter written most recently under that contract
is the reference implementation.** Read both before restructuring anything. "Reads like a story"
was a register complaint, not a licence to redesign the chapter's shape — the shape was already
specified.

Open question, deliberately not acted on: Part 6's `setTimeout` vs `setImmediate` subsection is
now the longest in the chapter (~65 lines with three experiments) and sits close to the
language/runtime scope line the prompt draws. The conclusion is a language-round answer; the
proof arguably belongs in `node-learnings/`. Left in for now because it is what turns the
question from folklore into mechanism.

---

## 2026-08-31 — JS Chapter 14: the setTimeout-vs-setImmediate tail was overstated

The Part 4 prediction question printed a single fixed output block ending
`setImmediate` / `setTimeout`, while Part 6 correctly said that ordering is
non-deterministic. Both could not be right. Measured, and Part 4 was wrong.

**The last two lines of that snippet are a coin flip: 20 runs split 11/9.** The first
seven are guaranteed. README, `notes.md` and `examples/04_node_queues.js` now all say so.

What the measurement actually settled:

- **The whole race is one question — did 1ms elapse between the `setTimeout` call and the
  loop's first timers check?** `setImmediate` runs in `check` unconditionally; the timer
  runs in `timers` only if it has expired, and Node clamps `0` to `1ms`.
- **Burning ≥1ms *after* the `setTimeout` call makes `T` win, 20/20** (also at 2ms and 5ms).
  Burning the same 1ms *before* it changes nothing — 20/20 `I`. The clock starts when
  `setTimeout` is called, not at process start. That kills the intuition that "enough
  synchronous work anywhere in the script" flips it.
- **The old "20/20 gave I first" note was measuring a different file.** The bare two-liner
  is 29/30 `I`; the fuller Part 4 snippet is 11/9. The difference is its five `console.log`
  calls, which sit between the `setTimeout` and the loop and cost roughly the whole 1ms.
  Buffer the output into an array instead of printing and it goes back to 19/20 `I`.
  **The textbook answer to this interview question depends on how fast the terminal is.**

Also fixed a real bug in `examples/04_node_queues.js`: section 4 was labelled "main module:
documented as NON-DETERMINISTIC" but sat inside a `setTimeout(..., 10)` callback. From
inside a timer callback `check` is two phases away while a fresh timer needs a full lap, so
it is deterministic — 30/30 `I` first. It was demonstrating the opposite of its caption, and
is almost certainly where the bogus 20/20 measurement came from. Relabelled, with the real
main-module race written out as a comment, since seeing it requires its own file.

Interview answer to give: *"those two aren't ordered, and here's why."* That scores better
than a lucky guess. `interview.md` already said this and needed no change.

---

## 2026-08-30 — JS Chapter 14: Microtasks and Macrotasks

Written as `js-learnings/chapter-14-microtasks-and-macrotasks/` — README, notes, interview,
mock, six runnable examples, chapter + cumulative exercises, blank worksheet. Chapter 13's
README had deferred every ordering question to this chapter; this is where they land.

The framing: **the event loop is not in the JavaScript language.** ECMAScript defines jobs
and run-to-completion; `setTimeout` appears nowhere in the spec. Drawing that line is what
makes the Node-vs-browser questions predictable instead of trivia — the microtask half is
ECMAScript's and identical everywhere, the macrotask half is the host's.

**Every number in the chapter was measured, not remembered, and two pieces of folklore did
not survive** (node 22.17.1, reproduced by `examples/03_tick_costs.js`):

- `await` on a native promise is **1 tick**, not 3. It was 3 until V8 7.2 / Node 12 (2019).
  The pre-2019 blog posts are still the top search results, which is why the wrong number is
  so widely repeated.
- `return p` costs **one** more tick than `return await p`, not two (3 vs 2). Returning a
  *thenable* measures 2 — cheaper than a native promise, because the thenable's `then`
  resolves synchronously inside the adoption job instead of scheduling a second reaction.

The chapter states the tick table and then tells him not to trust it: these are engine
numbers, not language guarantees. The spec orders microtasks, it does not number them.

Three things the examples exist to prove, because each is a bug people ship:

- **`await null` is not a yield.** 50,000 of them, and a timer due at 0ms still has not run;
  one `await setTimeout(0)` and it has. This is the most common wrong fix for a blocked
  event loop, and it is plausible enough to pass review. It is the live-debug question in
  `mock.md`.
- **"End of turn" has a definition** — after the microtask drain. The same `.catch` attached
  in a microtask saves the process and attached in a macrotask lets it die with exit 1.
  `PromiseRejectionHandledWarning` means exactly "you attached a handler after the turn
  ended", and the production shape is a cached promise awaited by a later request.
- **Starvation is silent.** A microtask spin loop leaves the process alive, at 100% CPU,
  serving nothing, with no error. The identical `setTimeout` version is harmless — one task
  per pass.

Two things measured that contradict the usual teaching, worth remembering before rewriting
anything here:

- `setTimeout(0)` vs `setImmediate` from the main module is *documented* as
  non-deterministic, but gave `I` first in 20/20 runs on this machine (node 22 / WSL2),
  including runs padded with random startup work. The chapter reports both facts and says to
  rely on neither.
- `process.nextTick` and the microtask queue **alternate**, nextTick winning each time — a
  nextTick queued from inside a microtask still runs after that whole drain, not before it.

Scope call: libuv's phase list stays in `node-learnings/`. What is here is only what an
interviewer asks inside a language question — `nextTick` vs microtasks, and `setImmediate`
vs `setTimeout` inside an I/O callback.

The cumulative exercise is `Scheduler`, ending in a microtask-batched DataLoader — the
"batch these fifty calls into one" whiteboard question, which is the best available answer
to "what is the microtask queue actually *for*".

Chapter 13's exercises are still mostly open: only markers A, B, C, I, K, O of Program 1 are
answered, and Programs 3–5 (the four primitives, the bug hunt, async iteration) are
untouched. He moved on deliberately after being told what that skips — per the chapter's own
examination table, Programs 3–5 are where the asked-every-time questions live. Debt, not
deletion.

---

## 2026-08-27 — Chapter 10: LangGraph

Written as `ai/10-langgraph/` — README, notes, interview, four examples, two exercises
(unsolved, as always). Chapter 8's exercises are still open; the chapter order moved ahead
of them deliberately.

The framing the chapter commits to: **LangGraph is a checkpointed state machine whose nodes
call LLMs**, not "an agent framework". It is the Chapter 9 `while` loop plus a durable write
between every step, and the five things that write buys — resume, human-in-the-loop,
per-step observability, concurrency with a defined merge, and shapes other than a loop — are
also the five reasons to *not* adopt it when none of them applies.

Three points the examples exist to make, because each is a bug people ship:

- `interrupt()` is not `await`. **The node re-runs from the top on resume**, so any side
  effect above the interrupt call happens twice. `03_human_in_the_loop.py` prints the
  double-sent email before showing the correct shape.
- `invoke(None, config)` means *continue*. Any other input restarts the graph and re-pays
  for every LLM call already made.
- Parallel writes to an un-reduced key raise `InvalidUpdateError` rather than silently
  dropping one. And a reducer still does not fix concurrent read-modify-write — both
  branches read the same pre-step value, so emit deltas, don't compute totals.

Cost framing, since durability is not free: one serialised state write **per super-step**.
A 6-step agent at 10k runs/day is 60k writes/day, each carrying the whole state — which is
why chunk text does not belong in graph state.

### Where it lands in the projects

The cumulative exercise is DocuMind's `/ask`, built as `retrieve → grade → (rewrite ⟲ |
generate)` with an attempts budget. The justification is the frozen baseline, not the
chapter: hit@10 0.929 against hit@1 0.750, and **no score floor separates correct answers
from absent ones** — `absent-webpack-01` at 0.504 outranks a third of the correct answers.
A fixed cutoff cannot refuse confidently on this corpus, so `/ask` has to judge the
retrieved *text* and act on it.

Stated in the exercise so it cannot be forgotten later: **the graph does not improve
retrieval.** Reranking does. The graph buys confident refusal and one bounded second chance,
and it is measured on different axes — faithfulness, refusal accuracy, p95, $/query — with
retrieval metrics expected to come back **unchanged** at 0.857. If hit@5 moves, the harness
is broken, not the graph improved.

The chapter exercise is the Chapter 9 file-system agent ported to a checkpointed graph with
an approval gate on `write_file`/`delete_file`, proving resume across two processes.

### Note for the eval

This chapter adds six files to the corpus. `evals/config.yaml` pins `corpus_commit`, so the
frozen baseline is unaffected — but a re-ingest before the next eval run scores a different
corpus, which is exactly what that pin exists to prevent.

---

## 2026-08-25 — The baseline, and four guesses it overturned

*Shipped as **v0.8.0**.*

Retrieval quality stopped being a judgement call. 33 golden questions, an eval harness, and
a frozen dense-only baseline:

```
hit@1 0.750   hit@5 0.857   hit@10 0.929   MRR 0.800
ambiguous-term 0.900   identifier 1.000   factual 0.769
```

### The harness records; it does not score

`run_eval.py` fetches the API maximum with no floor and writes the raw hits. `report.py`
derives hit@1/3/5/10, MRR and the entire threshold sweep from that file. The split exists
because the floor is chosen by *reading the distribution*, and a design where each candidate
value costs another 33 embeddings quietly discourages looking.

`config.yaml` pins the embedding model, the exclusion globs and `corpus_commit`. That last
one matters more than it looks: this is a living notes repo, so without it a run next month
would score corpus growth as retrieval improvement.

### The floor is ~0.45-0.50, not ~0.6

The four-query ladder from two days ago gave ~0.6. The measurement:

| floor | refuses absent | keeps correct |
|---|---|---|
| 0.45 | 0.600 | 0.786 |
| 0.50 | 0.800 | 0.714 |
| 0.55 | 1.000 | 0.464 |
| **0.60** | 1.000 | **0.107** |

At the eyeballed value, refusal is perfect and 25 of 28 correct answers are gone. The old
ladder had sampled four easy questions; real answers routinely score 0.42-0.51.

Worse — and this is the useful part — **no floor separates cleanly.** `absent-webpack-01`
scores 0.504, higher than a third of the correct answers. Dense cosine cannot do confident
refusal on this corpus. That is now a measured fact justifying reranking, rather than an
assumption about it.

### Question phrasing is worth 13 points of hit@5

The same 28 questions, same corpus, same retriever, two phrasings:

| | heading-echo | problem-phrased |
|---|---|---|
| hit@5 | 0.957 | 0.826 |
| factual | 1.000 | 0.769 |

Questions written after reading the corpus borrow its vocabulary and hand the retriever its
own tokens. The lower number is the honest one. A baseline that flatters itself is worse than
none, because every later delta is measured against a ceiling that was never real.

### BM25's case is already covered

All five `identifier` questions — `prevent_destroy`, `NULLS FIRST`, `require.cache`, `HNSW` —
return at **rank 1**. The query class BM25 exists for is not failing here. Probably because
these terms are rare enough that the embedding model has a distinct representation, and the
questions are short, so the identifier dominates the query vector instead of being averaged
away.

So BM25 moves down the list. What the remaining failures actually need:

- Three of four are **right chapter, wrong file** — `chapter_exercise.md` outranking the
  README that explains the thing. Exercises restate topics tersely, which reads as dense to a
  similarity score. That is a cross-encoder's job.
- One is a **total vocabulary miss**: "how do I get a structured object back from a model
  instead of a string" shares no terms with its target, because the notes only ever say
  "output parser". Query rewriting or HyDE. BM25 would make it strictly worse.

Recall is near-saturated (hit@10 0.929) while hit@1 is 0.750 — the gap is ordering, not
retrieval. **Rerank before hybrid.**

### A bad answer key looks exactly like a retrieval failure

I keyed an `identifier` question to three files containing `logprobs` — all three merely
name-drop it in a list of parameters LangChain does not expose. Nothing explains what
logprobs are. The question read as a total retrieval miss; it was an unanswerable question
with a wrong key. Fixing it took `identifier` from 0.800 to 1.000 and hit@1 from 0.714 to
0.750.

Grep finds the term. Only reading finds the answer. And never let `/retrieve` pick
`expected_sources` — a system that defines its own ground truth scores 100% forever.

### The corpus is not the same corpus

`**/prompt.md` was added to the exclusions and the collection rebuilt: **373 documents,
5,154 chunks, 77s, $0.018**. Twenty-one mentor prompts and 191 chunks of instructions-not-
knowledge left the index. "what is AWS" fell 0.567 → 0.499 while real-content queries did not
move — a wider, more separable gap.

### Open

`content_tokens` is still unwired as a query filter, and it is now a knob the eval could
sweep in one run.

`evals/results/` accumulates ~200KB per run and is currently committed wholesale. Fine at
one file, annoying at twenty.

Still no tests, and the harness is now load-bearing for numbers that will go on a CV.

---

## 2026-08-23 (later) — Search, and a corpus that was lying

*Shipped as **v0.7.0**, with the diagram correction as **v0.7.1**.*

### The retriever was fine. The corpus was not.

First real query — "what is AWS ?" — returned five `prompt.md` files: mentor instructions
like *"Act as a principal AWS security engineer and systems interviewer."* Not knowledge.
An S3 consistency question returned SQL transaction notes.

Both were **correct behaviour**. `aws/storage/` contains exactly one file and it is a
mentor prompt. `docker`, `k8s`, `linux`, `ci-cd-pipelines` and `scripting` are one file
each, and that file is a prompt too. Five of the fourteen advertised domains have no
content at all; 400 of 423 real files sit in five domains. There was no S3 content to find,
so the retriever returned the nearest neighbour — and "read-after-write consistency"
genuinely does live in database land.

Twenty-one prompt files, 191 chunks, all indexed. They win generic queries precisely
because they are short and topic-dense: little other text to dilute the match. `ai/prompt.md`
was already excluded; the glob should always have been `**/prompt.md`.

Dropping them and rebuilding — 373 documents, 5,154 chunks, 77s, $0.018 — moved exactly
what it should:

| query | before | after |
|---|---|---|
| Node backpressure | 0.731 | 0.731 |
| terraform state locking | 0.666 | 0.666 |
| **"what is AWS ?"** | **0.567** | **0.499** |
| chocolate cake | 0.214 | 0.214 |

Real-content scores did not move, because nothing about those documents changed. The junk
query fell 0.07 once the scaffolding inflating it was gone. The gap between "here is your
answer" and "nothing good here" went from ~0.10 to ~0.15, which is what makes a threshold
viable at all.

The lesson worth keeping: **a retrieval system can only be debugged by looking at scores and
sources.** Had `/retrieve` returned a generated answer, this would have surfaced as a fluent
paragraph synthesised from mentor prompts, and the corpus problem would have stayed
invisible behind good prose. That is the argument for `/retrieve` and `/ask` being separate,
independent of the eval-cost argument.

### `/retrieve` and `/ask` are separate on purpose

Two reasons, and the second is the one that survives scrutiny:

- The eval scores hit@5 across ~30 golden questions and must not pay for a completion each
  time. Retrieval quality and answer quality also fail differently — sharing an endpoint
  makes a bad answer unattributable.
- Query rewrite, hybrid search and reranking stay on `/retrieve`, because their gain **is**
  a retrieval metric. Push them behind `/ask` and Chapter 8's headline number — "hybrid
  lifted hit@5 from X to Y" — becomes unmeasurable. Conversational rewrite is the one
  exception: it needs history a stateless endpoint does not have.

They should be per-request flags, not just present, so the eval can attribute the gain to
each component rather than to all three at once.

### Things that only showed up by running it

- **`result.section or "" + "\n\n"`** parses as `result.section or ("" + "\n\n")` — `+`
  binds tighter than `or`. Every result kept its leading blank line, and a sectionless chunk
  stripped a bare newline pair instead. Valid code, wrong meaning; no linter can see it.
- **The response echoed `top_k` it never used.** Defaults were resolved into locals and then
  the *raw* payload values were passed to the query, so a request without `top_k` returned 3
  results while reporting 5. The wrapper exists to tell an eval what was applied; reporting a
  number that was never applied is worse than reporting nothing.
- **`payload` is `dict[str, Any] | None`**, not an object. Attribute access fails, and
  narrowing `with_payload` to four fields means `Chunk.model_validate` can no longer be used
  — it requires the bookkeeping you deliberately stopped fetching. That is the point: fetch
  what you return, and nothing added to `Chunk` later can leak into the API.
- **Pydantic v2 does not expose fields as class attributes.** `RetrieveResult.text` is an
  `AttributeError`. Payload keys are storage keys; they only happen to match field names.
- **A bare `except:` hid three separate bugs in a row**, each time turning an immediate
  one-line fix into a silent wrong answer — once as a 200 carrying `{"message": "Error"}`.
  flake8 flagged it as E722 and bugbear as B001 the entire time.

### Small things that were not small

`MAX_TOP_K` now bounds the request field *and* the settings default: `le=20` on the request
was bypassable by setting `DEFAULT_TOP_K=1000`, and a bad config should fail at startup
rather than quietly ignore a documented limit.

Optional numeric knobs resolve with `is None`, never `or`. A caller sending `score_threshold:
0.0` means "no floor" — which is exactly what you send while debugging a query that returns
nothing — and `or` silently replaces it with the default.

A missing collection returns **503 `index does not exist`** rather than 500, and never an
empty 200. Empty-with-200 would make "the corpus has nothing on X" indistinguishable from
"there is no corpus", and the eval would record it as a retrieval miss.

`embed_query` checks the API returned exactly one embedding at the expected width. A
mis-sized vector is not a crash — it produces plausible garbage rankings, which is the worst
possible failure for a search system.

### Open

`content_tokens` is still not wired as a query filter. 6.9% of chunks are under 30 tokens
and they rank — the best query's top hit is 19 tokens, too short to answer anything. Wire it
as a knob defaulting to 0; the golden set picks the value.

Still no tests. This endpoint alone produced six live bugs today, including a precedence bug
that passed flake8 *and* pyright, and every check was a throwaway script.

---

## 2026-08-23 — A failed ingest that reported success

*Shipped as **v0.6.2**.*

### The money record was the thing being lost

The ingest loop had no error handling at all, which was half deliberate: the client
propagates, and partial writes were already safe, since a source that dies mid-run fails the
`chunk_total` vs point-count check and rebuilds next time. Nothing corrupts.

What was lost was the accounting. `billed`, `counted` and `batches` accumulate inside the
loop and the summary log sits *after* it, so a run that died at batch 12 had spent real money
on eleven batches and said nothing about it. Not a correctness bug — an operability one. You
cannot decide whether to re-run something when you do not know what the last attempt cost.

Subtler, and found only while writing the fix: the counters were incremented *after* the
upsert. So a **Qdrant** failure dropped that batch's token count entirely, even though the
embedding call had already succeeded and already been charged. A `finally` layered on top of
that ordering would have faithfully reported a wrong number.

The split that fixes it is by what each counter asserts. `billed`, `counted`, `batches` are
facts about money, true the moment the API answered — they increment before the upsert.
`chunk_count` is a fact about the index — it increments after. On a partial run
`embedded > indexed` is then the expected shape rather than a discrepancy.

### `return` inside `finally` swallows the exception

The first attempt put the `return` in the `finally`. Python discards an in-flight exception
when the `finally` returns, so a dead run stopped reaching the handlers and came back as
**HTTP 200** with plausible partial numbers. Strictly worse than the no-handling version,
which at least produced a 503.

Nothing in the toolchain caught it. flake8 without bugbear has no such check and pyright
reports zero errors — it is a control-flow bug, not a type error. The only thing that flagged
anything was `F841` on the now-unused `completed` flag, which pointed at the omission
sideways.

So: `finally` holds **logging only**. The `return` and the drift check sit below the whole
block, where an exception simply never reaches them. `try`/`finally` with a `completed` flag
rather than `except`/re-raise, because a bare `except Exception` misses `CancelledError` —
which is what a client disconnect mid-ingest raises, and the case where silence is least
affordable.

The failure line is `warning`, not `error`: the app-level handler already logs what broke
with a stack trace and OpenAI's `request_id`. The loop's line answers a different question —
what it cost — and says outright that the in-flight documents rebuild next run, so nobody has
to reason about `chunk_total` at 2am.

### openai 3.x is built on `httpx2`, not `httpx`

The flat `OPENAI_TIMEOUT = 500` had no reasoning behind it. A 256-chunk batch returns in
single-digit seconds; at 500s one hung socket stalls the run for eight minutes before the
first of five retries. Replaced with a granular `Timeout(connect=10, read=60, write=30,
pool=10)` — a dead host now fails in ten seconds instead of waiting on a read that will never
come.

Writing `httpx.Timeout` for that is wrong, and wrong in a way nothing but a type checker sees:

```
"httpx._config.Timeout" is not assignable to "httpx2._config.Timeout"
```

openai 3.3.1 depends on `httpx2` 2.12. The two classes are structurally identical and
identically named, so the failure would have surfaced at runtime inside client construction.
Fourth type error pyright has caught past black/isort/flake8/bandit, and probably beyond mypy
too — it needs the installed distribution's own stubs to see that two same-named classes come
from different packages.

`httpx2` is now a declared dependency, since it is imported directly rather than reached
through openai.

### The guard, added separately

`flake8-bugbear`'s **B012** is exactly the return-in-`finally` check, so it went into the
`lint` group as its own change rather than folded into the fix — a linter addition and a bug
fix answer different questions, and squashing them together makes both harder to read later.

Verified by running it against the original bug shape rather than trusting the install:

```
B012 return/continue/break inside finally blocks cause exceptions to be silenced.
```

Clean against `src/` as it stands, so nothing had to be retrofitted. The flake8 hook already
runs through `uv run --group lint`, so no hook change was needed.

---

## 2026-08-22 (later) — Logging that can be read, and a type checker

*Shipped as **v0.6.0**, alongside corpus exclusions.*

### The logs were unreadable, for a boring reason

`logging.getLogger()` with no name returns the *root* logger, and a handler there formats
whatever any library emits as if the service had said it. One ingest produced ~90 lines of
httpx request logs and watchfiles change notifications around the four lines that were ours.

Named logger, `propagate = False`, and the noisy libraries pinned to WARNING. Root keeps its
own handler at WARNING, though — without it a library error falls through to
`logging.lastResort`, which prints bare text with no request id, and that is exactly the
line worth having in production.

### Correlation ids without threading a parameter

A `ContextVar` set by middleware and read by a `logging.Filter`, so every record picks it up
— including ones from `filesystem.py` and `qdrant.py`, which know nothing about HTTP. Task
local, so concurrent requests cannot see each other's. Echoed as `x-request-id`, and an
upstream one is honoured only if it matches `[A-Za-z0-9._-]{1,64}`: a header that lands in a
log is otherwise a log-injection vector.

Two lines per request rather than one, because a minute-long ingest is otherwise silent
until it finishes.

The logs immediately paid for themselves: they made a config failure diagnosable that had
resisted a restart and a corrected `.env`. `INGEST_ROOT=.` was exported in the shell, and
environment variables beat `.env` in pydantic-settings — the file was right, a fresh
`Settings()` read it right, and the process still disagreed. Only `/proc/<pid>/environ`
showed it.

### pyright, because the linters were blind to a whole class of bug

Three type errors in one week got past black, isort, flake8 and bandit: `APIStatusError`
passed to a parameter typed `APIConnectionError` (siblings, not subclasses), a NamedTuple
field named `count` shadowing `tuple.count`, and an override with a renamed parameter after
python-json-logger 4.0 renamed it upstream. None break at runtime; none show up in tests.

Tested mypy first — it catches two of the three, missing the override. Pyright catches all
three, and being Pylance's engine it agrees with the editor rather than offering a second
opinion.

### A style correction worth keeping

The comments had grown into design documents — 37% of `logger.py`, one 16-line block. On a
portfolio repo that reads as machine-written regardless of whether it is right. Cut to 1-3
lines each, docstrings added where they were missing (`get_files_from_folder` had none at 85
lines), and the archaeology removed: comments whose only content was a bug already fixed are
working notes, not something a reader needs. Losing the protective ones is fine now that
pyright enforces what they were asking a reader to remember.

Same rule applies to commit messages and PR bodies in that repo. This file is the place for
depth.

### Also

A `gh pr merge` returned 504 and half-succeeded: the squash commit landed on master, the PR
stayed open, the branch survived, and no push event fired, so no workflow ran. Nothing was
lost — release-please computes from history since the last tag — but `release-please.yml`
has only an `on: push` trigger, so a missed release cannot be kicked off manually. Adding
`workflow_dispatch:` is two lines and still outstanding.

Branch protection has `strict_required_status_checks_policy`, so parallel PRs merge
serially: each one goes `BEHIND` when master moves and needs a rebase and a re-run.

---

## 2026-08-22 — Ingestion runs against the real corpus, and four things only that could show

*Shipped: embed/upsert loop, re-ingest skip, corpus exclusions.*

### The numbers

406 documents, 5,453 chunks, 22 batches, 942,719 tokens, **$0.019**, 60 seconds through
`POST /ingest`. Re-running: **0 documents, 406 skipped, 0.2 seconds.** Editing a file
rebuilds only that file; touching its mtime rebuilds nothing; reverting an edit is detected
as a change. Point count holds steady across rebuilds, so delete and upsert agree.

### A hash cannot tell you the write finished

The re-ingest skip recorded a hash per source and skipped when it matched. The reasoning
for tolerating *sets* of hashes assumed an interrupted run leaves some chunks at the old
hash and some at the new — but old points are deleted **before** new ones are written, so a
crash mid-file leaves the survivors all carrying the **new** hash. Indistinguishable from
success, and every later run skips it: the document stays indexed, truncated, retrievable
and plausible. 20 of 406 files are large enough to straddle two embed batches.

Fixed by recording `chunk_total` per chunk and requiring the payload's claim to match the
actual point count. `entry.totals == {entry.point_count}` — what the writer said should
exist, against what does.

The general shape: **a hash proves content, a count proves completion.** No amount of
hashing substitutes for the second.

### Empty files could never converge

Six 0-byte `README.md` scaffolds from `uv init` were re-processed on every single ingest.
An empty file produces no chunks, so no points, so the next run finds no hash for that
source and rebuilds it — producing no chunks again. Every run reported six documents
ingested while writing nothing.

Only visible because the full-corpus run was actually performed. At two files it never
appeared.

### Reading the index cost the size of the index

`indexed_sources` scrolled every payload in the collection to use a fraction of them, while
the delete twenty lines below already filtered on `source` — the same field, carrying a
payload index created for exactly that purpose. The asymmetry was the tell. Scoped, the cost
is the size of the request and stays there as the collection grows.

### Streaming, measured

`batch_embed` now takes an iterable, so `chunk_docs` is no longer materialised at its only
call site: **24MB peak against 87MB accumulating**, same 5,453 chunks. The ratio matters
less than the shape — streaming is flat in chunk count, accumulating is linear.

`iter()` is what makes it work, and not obviously: it converts an iterable into something
with a *position*, so successive `islice` calls resume rather than restart. Without it, on a
list, the loop re-slices the first batch forever.

### Corpus exclusions are the caller's business

`IngestRequest.exclude` takes globs matched against `source`. Deliberately not `SKIP_NAMES`:
that is the service's list of things no corpus should hold, and it ships in a public repo,
where a hardcoded `CLAUDE.md` would be both wrong generically and a small disclosure. Four
planning documents and nine support-fiction files take the corpus to 393.

### Two traps worth not repeating

**Config precedence.** The server kept rejecting the corpus path after `.env` was corrected
and the process restarted. `INGEST_ROOT=.` was exported in the shell, and environment
variables beat `.env` in pydantic-settings. The file was right, a fresh `Settings()` read it
right, and the running process still disagreed — with nothing anywhere reporting the
conflict. Only `/proc/<pid>/environ` showed it.

**A merge can half-succeed.** `gh pr merge` returned a 504: the squash commit landed on
master, the PR stayed open, the branch survived, and no push event was dispatched, so no
workflow ran at all. Checking `gh run list` after a merge is what caught it.

### Where retrieval starts from

Ingestion is done and exercised end to end. Still absent: retrieval, answer generation
(a second OpenAI path, with its own prompt and refusal behaviour), the golden set,
`evals/run_eval.py`, and any tests at all — `tests/` is still a `.gitkeep`, while a dozen
verification scenarios built today live only in scratch files.

---

## 2026-08-21 — Chunking, the OpenAI client, and bugs that only measurement found

*Shipped as **v0.4.0** (chunking) and **v0.5.0** (client and error mapping).*

### The OpenAI client, and where errors are allowed to be caught

Mirrors the qdrant client: an `AsyncOpenAI` singleton built from settings, opened and closed
in the app lifespan, with `OPENAI_API_KEY` required rather than optional so a missing key
fails at startup instead of at the first embed call.

`embed()` deliberately does not catch. The client cannot decide what a failure *means* —
only the ingest loop knows whether to skip a batch, abort, or record it and carry on.
A first attempt caught `APIConnectionError` and `pass`ed, which returns `None` to a caller
expecting a response and resurfaces as an `AttributeError` a long way from the cause.

A second dead end worth remembering: subclassing the SDK's exceptions in order to catch
them. `class APIConnectionError(openai.APIConnectionError)` creates a *new* class the SDK
never raises. Inheritance runs the wrong way — catching a parent catches its children, never
the reverse. To intercept a library's errors you register on the library's own classes.

Two handlers cover all eight SDK exception types because Starlette dispatches on the MRO.
Transport failures and their 5xx map to 503; 429 to 503 logged as a *warning*, since it is
only reached after the client exhausted its own retries; 401/403 to 500 logged at *error*,
because they are not transient and every request fails until the key is fixed; other 4xx to
500, because we sent something malformed.

One hierarchy difference bit: the qdrant handlers delegate to their own 503 case and it
type-checks because `UnexpectedResponse` subclasses `ApiException`. `APIStatusError` is a
**sibling** of `APIConnectionError`, not a subclass, so the shared handler needs their common
parent. Pylance caught it; every runtime test passed, because annotations are not enforced.

**Logs carry OpenAI's `request_id` as a structured field** — it is what their support asks
for and nothing else identifies the failed call. The batch is never logged: for embeddings
the request body *is* the corpus, so a failed batch in the log store is document text in the
log store.

`EMBEDDING_DIMENSIONS` and `DEFAULT_TOP_K` moved from settings to constants. Both define the
index rather than the deployment — changing either means re-embedding everything, which is
not something to expose as an env var.

### The handlers do not cover ingest

FastAPI exception handlers only run during request handling. Once `/ingest` is a background
task, an embedding failure happens after the response has been sent and the handler never
fires. The ingest loop needs its own error handling recording failure into job state. That
is the answer to "where does try/except belong": not in the client, not only in `app.py`,
but in the loop that owns the job.


### Header-aware chunking with breadcrumbs

Markdown header split first so chunks follow the document's structure, then a token split
because a section can be far larger than the budget. Every chunk is prefixed with a
breadcrumb — folder path plus the deepest two headings — so that "caching" under
`terraform` is distinguishable from "caching" under `sql`, which is the whole discriminator
the ambiguous-term queries rest on.

The non-obvious part: the breadcrumb is applied **after** the token split, never before.
Header-splitting alone leaves chunks 2..n of a section orphaned, because the heading only
survives in chunk 1. Prefixing every chunk re-anchors them.

### Three bugs, none visible by reading the code

Chunking was reviewed by running it over the real 411-document corpus and looking at the
distribution. Nothing here would have been caught by eye or by the linter.

**TOKEN_SIZE was not a ceiling.** The breadcrumb was prepended after the splitter had
already spent its whole budget, so stored chunks ran to 467 tokens against a nominal 400,
with 4.6% over. The split now reserves the breadcrumb first, per section, because each
section has a different breadcrumb and so a different budget. Max is now 399 with nothing
over, at a cost of 120 extra chunks.

**Headings were duplicated.** `strip_headers=False` kept the heading in the body while the
breadcrumb prepended it again — 73% of chunks restated their own heading, sections nested
two deep restated both, costing 6% of all tokens. Stripping is safe because a section's
body always begins with its deepest heading and the breadcrumb always keeps the deepest, so
what is removed is always the redundant copy.

**`token_count` drifted to measuring the bare chunk** rather than the stored text,
understating every chunk by ~29 tokens. Since batch sizing, cost and retrieval context
budget all derive from it, that would have been a systematic drift toward OpenAI's 300k
request cap showing up only as an occasional 400.

A fourth was caught before it shipped: `content_tokens` was briefly `len(chunk)` — the
*character* count under a field named tokens. It would not have crashed, and a content
floor of "10 tokens" would silently have meant 10 characters.

### Deferring the near-empty chunks properly

Some chunks carry almost no content — a heading and a horizontal rule, or a heading and the
lead-in sentence to content that lives in the next chunk. They matter because their
embedding is dominated by the breadcrumb, so they match breadcrumb-shaped queries strongly
while containing nothing. That is exactly the ambiguous-term query shape.

Rather than dropping them at ingest, `content_tokens` is stored alongside `total_tokens`
so a floor can be applied as a **query-time filter**. That converts a frozen ingest decision
into a retrieval variable that can be swept during evaluation without re-ingesting. When
retrieval exists it needs a Qdrant payload index on the field, and the floor must be ANDed
with any caller-supplied filter rather than replacing it.

`chunk_docs` also became a generator. Holding every chunk is survivable; holding every
*embedded* chunk at 1536 floats each is not, and the consumer can only stream if this end
does.

### Corpus after chunking

411 documents, 5,435 chunks, 938k tokens, about $0.019 to embed. Breadcrumb overhead is 17%
of the corpus. `MIN_CHUNK_TOKENS` never engages — the longest breadcrumb is 141 tokens
against a 300 threshold — so it is insurance, not a working part.

Still not wired: the corpus-scope exclusions. `CLAUDE.md`, `HISTORY.md`, `ai/prompt.md`,
`ai/resume-roadmap.md` and nine support-fiction files under the old in-repo DocuMind are all
still ingested. That has to be fixed before any baseline is frozen.

---

## 2026-08-20 — Qdrant layer lands, and ingestion gets split at the Document boundary

*Shipped as **v0.2.0** (Qdrant layer) and **v0.3.0** (document source, settings, error handling).*

### v0.2.0: the connection and collection layer

`AsyncQdrantClient` as a module-level singleton opened in `lifespan` and closed on
shutdown, plus the operations the rest of the service builds on: `ensure_collection`
treating a 409 as success (two workers starting concurrently would otherwise race, and the
loser crashes on a collection that now exists), `upsert_collection`, `query_collection`
exposing `top_k` / `score_threshold` / payload filter, and `delete_collection_data` by
payload filter — the last of which is what makes re-indexing idempotent rather than
duplicating chunks.

The module is `src/clients/qdrant.py`, not `qdrant_client.py`. The latter shadows the
third-party package it imports from; it resolves correctly today, but breaks confusingly
the moment `src/clients/` lands on `sys.path`.

### The architectural problem: the corpus is local, the service is not

`ingest(docs_folder)` welded "walk a directory" to "chunk, embed, upsert", which is fine
for a CLI and meaningless once FastAPI runs on a server that cannot see the laptop's
filesystem.

Split at the `Document` boundary: a **source adapter** yields `Iterable[Document]`, and the
pipeline knows nothing about paths, requests or archives. Filesystem walk first — the
Phase 0 eval harness runs locally and has to build an index without a server — with archive
upload as a second adapter later.

Upload beats S3 or a git-clone source here purely on numbers: the corpus is **460 markdown
files, 4.5 MB raw, 1.06 MB gzipped, ~660k tokens**. A megabyte over multipart needs no
infrastructure. The cost is that extracting a caller-supplied archive is a path-traversal
and zip-bomb vector, which has to be handled deliberately.

Make it an iterable rather than a list. Streaming files costs nothing now and is the
difference at ten times the corpus.

### Reading a folder as if the path is hostile

The walker confines every request to `INGEST_ROOT`, refuses credentials by name and suffix
independently of the extensions requested (asking for `*` does not opt into reading
secrets), prunes vendor and cache directories during the walk rather than filtering after,
sniffs for NUL bytes instead of trusting extensions, and caps file count, per-file size and
total size.

Two gaps remain, both recorded in CLAUDE.md: files are still read **through symlinks**,
which routes around the deny-lists; and `.env.example` does not document `INGEST_ROOT`,
which is the setting that bounds all of this.

Configuration also moved from scattered `os.getenv` calls to `pydantic-settings`, so a
missing `QDRANT_URL` fails at startup rather than at the first request. A blank
`QDRANT_API_KEY=` normalises to `None` — the client otherwise reads `""` as a key being
present and warns about sending it over plain http.

### Decisions deferred, deliberately

Chunk size is the one that matters: the old 100 tokens / 10 overlap is too small for
technical prose with code blocks, and ~500/50 is the likely answer. But it is an **eval
variable** — pick it, freeze it, then measure, because tuning it after the baseline exists
invalidates every later delta.

Two consequences follow from raising it. `EMBED_BATCH_SIZE` counts *chunks*, so 500 × 500
tokens is 250k per request against OpenAI's ~300k cap — batching has to become token-aware.
And accumulate-then-upsert stops fitting in memory at ~10k chunks; the loop has to embed a
batch, upsert it, and discard.

Also still true and worth not forgetting: the README claims re-ingesting an unchanged corpus
is a no-op, and nothing implements that yet.

---

## 2026-08-19 — DocuMind leaves the notes repo, and gets a real release pipeline

### The project moved out, and Phase 4 came first

DocuMind now lives at `/home/manish/code/personal/documind`
(`github.com/manishsharma0398/documind`), not at
`ai/07-rag-pipelines/exercises/solutions/DocuMind/`. That pulls the roadmap's Phase 4
("extract two standalone public repos") to the very start.

The reason is presentational, not technical: a path containing `exercises/solutions/`
reads as homework to anyone browsing, however good the code underneath is. Starting
standalone also avoids a history rewrite later — extracting a subdirectory into its own
repo with history intact is filter-branch work nobody enjoys.

Consequence to remember: the in-repo copy is now **superseded**, same status as `docbot`,
`smart-doc`, `semantic-search`, `support-bot-rag-pipeline` and `code-review-ai`. Its ~521
lines (`src/main.py` at 370, the Qdrant and OpenAI clients, the Pydantic models) still need
porting by hand. Its `docs/` corpus does **not** move — that six-file corpus is precisely
the no-headroom problem Phase 0 exists to fix.

The teaching contract travels with it. Implementation in the new repo is still Manish's to
write, including the mechanical port, on the grounds that a resume project has to be
defensible line by line. Config, tooling and docs are fair game to write when asked.

### Versioning derived from git, not from a CI counter

GitLab hands you per-branch versioning almost free via `$CI_COMMIT_REF_SLUG.$CI_PIPELINE_IID`,
because it maintains a per-project incrementing pipeline counter. GitHub has no equivalent:
`github.run_number` is **global across all branches**, so two concurrent feature branches
would interleave 1, 2, 3, 4 between them.

The answer was to stop looking for a CI counter. `git rev-list --count origin/master..HEAD`
counts exactly the commits the branch adds, which is both what was wanted and better than
GitLab's IID in one respect — it is deterministic and recomputable from any clone, with no
build-server state behind it. The tradeoff is honest: it is *not* monotonic. Rebase or
squash and the number can go down. For feature-branch builds that is fine.

`fetch-depth: 0` on `actions/checkout` is mandatory. The default is a depth-1 shallow clone
where that count is always `1` — the single most likely cause of a version stuck at `.1`.

Two representations are emitted because they serve different consumers, and neither accepts
the other's format:

| | Branch build | Release |
|---|---|---|
| SemVer 2.0.0 | `0.1.2-hybrid-search.3` | `0.1.2` |
| PEP 440 | `0.1.2.dev3+hybrid.search` | `0.1.2` |

The originally-sketched scheme (`hybrid-search.3`) is valid under neither standard — no
`MAJOR.MINOR.PATCH` core for SemVer, and PEP 440 would reject it outright, which matters
because `uv_build` reads that field. Both standards already have a slot for this: SemVer's
pre-release identifier after a hyphen, PEP 440's dev release plus local version label. CI
validates both strings against the official SemVer regex and `packaging.Version`, and that
validator immediately earned its place (see below).

Nothing consumes these outputs downstream yet — there is no Dockerfile and no package
publish. They become load-bearing in Phase 2 when the image gets tagged.

### Three traps that only an end-to-end run exposed

None of these were visible from reading the config. All three were found by actually
cutting releases, and all are now fixed — do not reintroduce them.

**release-please does not understand PEP 621.** Its `python` release type looks for
`version.py`, `setup.py`, `setup.cfg` and Poetry-style pyproject files. This project uses
`[project] version` with the `uv_build` backend, so v0.1.0 shipped a changelog and a tag
while `pyproject.toml` sat untouched at `0.1.0`. Left alone, that drift compounds silently
across releases. Fixed by switching to manifest mode with an explicit toml updater on
`$.project.version`.

**`uv.lock` carries the project's own version.** Bumping `pyproject.toml` desyncs the two,
and `uv sync --locked` then fails on the release PR — correctly, which is the entire point
of `--locked`. release-please ships no updater for it, so `release-please.yml` now
regenerates and commits `uv.lock` onto the release branch.

**Slug sanitising must collapse runs of separators.** A per-character substitution leaves
`--` intact. SemVer tolerates that, but converting `-` to `.` for the PEP 440 local label
then yields `..`, which is invalid. The branch that caught it was release-please's own
`release-please--branches--master`. The conformance check in CI is what surfaced it rather
than a malformed tag appearing somewhere downstream weeks later.

### `master` is strictly protected, with no escape hatch

A ruleset with **`bypass_actors: []`** — the rules apply to everyone including the owner.
Verified: a direct push is rejected with `GH013`. PR required (0 approvals, so there is no
being blocked waiting for a reviewer), `quality` and `version / version` must pass, linear
history, no force-push, no deletion.

Chosen over adding a bypass actor deliberately: CI takes about 25 seconds, so an escape
hatch buys very little and costs the guarantee.

This required making the repo **public** — branch protection and rulesets are both gated
behind Pro for private repos. Before flipping it, every blob in every commit was scanned
for `sk-`, `ghp_`, `github_pat_`, `AKIA`, `xox*` and PEM private-key headers; 20 files ever
committed, nothing sensitive. That came down to `.gitignore` covering `.env` from the very
first commit.

**Standing annoyance:** every release PR needs one manual workflow-approval click.
`approval_policy: first_time_contributors` treats `github-actions[bot]` as a first-time
contributor every single time — approving once does not clear it. Left as-is on purpose,
since that setting is what stops hostile fork PRs running workflows on a public repo.

### Also worth knowing

Conventional Commits are enforced at commit time by a `commit-msg` hook, because a bad
message is only fixable by rewriting history once pushed. The hook does **not** check PR
titles — and since merges are squashes, the PR title *is* the commit message release-please
reads. A PR titled `updates` silently earns no version bump.

`default_install_hook_types: [pre-commit, commit-msg]` matters: without it, a plain
`pre-commit install` wires only the pre-commit stage and the commit-msg hook never runs.

Dependabot's first run immediately caught four action pins that were already stale
(`checkout` v4→v7, `cache` v4→v6, `setup-uv` v5→v7, `release-please-action` v4→v5). Action
updates are now grouped into a single weekly PR; Python dependencies are deliberately left
ungrouped, since a library bump that breaks something is far easier to bisect alone.

Released **v0.1.0 → v0.1.1 → v0.1.2** in the process of proving the pipeline works.

### Where this leaves the actual work

Nothing has been ported. Ingestion and retrieval in the new repo are stubs, and Phase 0 has
not started — no golden set, no `evals/`, no frozen baseline. The open design question
gating the port: the old `main.py` does ingest, chunk, embed, retrieve and answer in one
370-line file, but the eval harness needs to call retrieval *without* the answering step so
hit@k can be scored independently of faithfulness.

---

## 2026-08-10 — Four branches land on master

`feat/js-notes`, `feat/ai-notes`, `feat/nginx` and `feat/python-notes` merged via PRs #1–#4,
bringing master up to date after months of parallel branch work. The branches were deleted
upstream; stale local tracking refs lingered until pruned.

---

## 2026-06-01 → 2026-08-02 — The AI track, chapters 1 through 9

Nine chapters written at roughly one every two to four weeks, each following the same shape:
`README.md` for mental models and architecture diagrams, `notes.md` for revision,
`interview.md` for senior-level questions, `examples/` written by the mentor, `exercises/`
solved by Manish.

| Chapter | Started |
|---|---|
| 01 how LLMs work | 2026-06-01 |
| 02 prompt engineering | 2026-06-01 |
| 03 LLM APIs in production | 2026-06-02 |
| 04 Python for AI engineering | 2026-06-04 |
| 05 LangChain fundamentals | 2026-06-28 |
| 06 vector databases and embeddings | 2026-07-07 |
| 07 RAG pipelines | 2026-07-15 |
| 08 advanced RAG | 2026-07-26 |
| 09 AI agents | 2026-08-02 |

Still open: chapter 8's exercises have no `solution/` directory — hybrid search, query
rewriting and reranking are unsolved. Chapter 9's cumulative exercise (the Code Review
Agent) has not been started, and `09-.../file-system-assistant/main.py` still carries four
`# TODO`s with an empty `test.py`.

---

## 2026-01-19 → 2026-06-12 — Fourteen domains of notes

Started with Node on 2026-01-19. The bulk of the infrastructure and backend domains
(`js-learnings`, `aws`, `sql`, `docker`, `k8s`, `linux`, `ci-cd-pipelines`, `scripting`)
landed on 2026-01-29, `react` in February, `python` and `terraform` in March, `ai` in June
and `nginx` last on 2026-06-12.

Roughly 410 markdown files and 484k words. The size is what makes the corpus useful to
DocuMind: large enough that retrieval metrics have somewhere to move, with terms like
*caching*, *retry*, *health check*, *connection pool* and *rate limit* appearing across many
unrelated domains — exactly the queries dense-only retrieval blurs.
