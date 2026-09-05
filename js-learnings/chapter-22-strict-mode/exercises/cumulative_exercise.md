# Chapter 22 — Cumulative Exercise: Audit and Migrate a Mixed-Mode Codebase

**Time:** 2–3 hours. **Scope:** the capstone. Ch5 (`this`), Ch17 (retention), Ch18 (freezing),
Ch20 (modules), Ch21 (absence), Ch22 (strict mode).

**This is the last exercise in the track**, and it is deliberately not another single-topic build.
By this point the interesting problems are the ones that cross chapters — and "migrate this
codebase to modules" is the most common real task that touches all of them at once.

You are given a small CommonJS service with a mixed-mode build. It works. Your job is to prove
what it currently relies on, migrate it, and prove what changed — because **the failure mode of
this migration is silence**: several behaviours change with no error anywhere, and the ones that
do throw will throw in production rather than in your tests if you migrate without an audit first.

**The deliverable is the audit, not the migration.** A migration nobody can review is worth less
than a document that says exactly what will change and why.

---

## The codebase

Create these files exactly as given. They are deliberately imperfect; do not fix anything yet.

```javascript
// package.json
{ "name": "legacy-service", "version": "1.0.0" }
```

```javascript
// lib/registry.js
/* Copyright 2018 */
const MAX_ENTRIES = 100;
"use strict";

const entries = {};

function register(name, handler) {
  if (typeof count === "undefined") { count = 0; }
  entries[name] = handler;
  count++;
  return count;
}

function get(name) {
  return entries[name];
}

module.exports = { register, get, MAX_ENTRIES };
```

```javascript
// lib/config.js
const defaults = Object.freeze({
  retries: 3,
  timeout: 5000,
  tags: [],
});

function withOverrides(overrides) {
  const merged = Object.freeze({ ...defaults, ...overrides });
  merged.timeout = merged.timeout || defaults.timeout;
  merged.tags.push("default");
  return merged;
}

module.exports = { defaults, withOverrides };
```

```javascript
// lib/metrics.js
"use strict";

const counters = {};

class Metric {
  constructor(name) {
    this.name = name;
    counters[name] = 0;
  }
  increment() {
    counters[this.name] += 1;
    return counters[this.name];
  }
}

function collect(metric) {
  const bump = metric.increment;
  return bump();
}

module.exports = { Metric, collect };
```

```javascript
// index.js
const { register, get } = require("./lib/registry");
const { withOverrides } = require("./lib/config");
const { Metric, collect } = require("./lib/metrics");

register("ping", () => "pong");
const cfg = withOverrides({ timeout: 0 });
const m = new Metric("requests");

console.log("handler:", get("ping")());
console.log("timeout:", cfg.timeout);
console.log("tags:", cfg.tags);
console.log("metric:", (() => { try { return collect(m); } catch (e) { return e.constructor.name; } })());
```

---

## Phase 0 — Establish the baseline

Before changing anything, record what it currently does.

**Success criteria**

- [ ] `node index.js` runs and its complete output is recorded verbatim. Do not clean it up.
- [ ] For **each of the four files**, state its current mode and the evidence. One of them is not
      what its author intended — find it before reading on, and say how you detected it.
- [ ] `cfg.timeout` — record the value and explain it. **The caller passed `0` and the recorded
      value is `0`, which is correct — and it is correct by accident.** Two independent bugs are
      cancelling each other out here. Name both, say which chapter each comes from, and state
      which one will stop cancelling after Phase 3. This is the most important question in Phase 0.
- [ ] `typeof count` on `globalThis` — record it, and say what that proves about `registry.js`.
      Then explain why the author's `typeof count === "undefined"` guard was necessary rather than
      just `if (!count)` (try both; only one of them runs at all, in either mode).
- [ ] `cfg.tags` after two calls to `withOverrides` — record it, and say which chapter's rule this
      is. Would a second `require` of `config.js` reset it?
- [ ] `collect(m)` — record the result and name the mechanism.

---

## Phase 1 — The audit document

This is the phase the exercise exists for. Produce a written audit — a markdown file — **before**
touching any code.

For every file, list every behaviour that will change under ES modules, classified as:

| Class | Meaning |
|---|---|
| **THROWS** | works now, will throw after migration |
| **SILENT** | works now, behaves differently after, with no error |
| **FIXED** | currently broken, will start working or start failing loudly |
| **NEUTRAL** | genuinely unaffected |

**Success criteria**

- [ ] At least one entry in each of the four classes, each naming the file, the line, and the rule.
- [ ] The **SILENT** section is the one to get right — a reviewer reading only that section should
      be able to predict the behaviour change without running anything.
- [ ] For `registry.js`, explain precisely why its directive is inert, and what a `grep -r "use
      strict"` audit of this repo would wrongly conclude.
- [ ] For `config.js`, state what `Object.freeze` currently does and does not prevent, in both
      modes — there are two distinct problems and only one of them is about strict mode (Ch18).
- [ ] For `metrics.js`, predict what `collect` does after migration and why it differs. Name the
      chapter for the `this` rule and the chapter for the arithmetic result (Ch5 and Ch19).
- [ ] A **risk ranking**: which single change is most likely to reach production undetected, with
      your reasoning. Justify it by how the failure would present, not by how bad it is.

---

## Phase 2 — Make the current behaviour verifiable

You cannot safely migrate what you cannot test. Write tests **against the current, buggy
behaviour** — including the bugs.

**Success criteria**

- [ ] A test asserting `cfg.timeout` is what it currently is, with a comment marking it as
      *characterisation, not desired* behaviour.
- [ ] A test that fails if `withOverrides` stops mutating shared state — proving the mutation
      currently happens.
- [ ] A test capturing `collect(m)`'s current result.
- [ ] A mode assertion per file, using your Ch22 probe, so the migration can't silently change a
      file's dialect without a test noticing.
- [ ] No test depends on module load order — or if one must, it says so explicitly and explains
      why (Ch20).

---

## Phase 3 — Migrate

Convert all four files to ES modules. Do not fix the logic bugs yet — migrate first, so the
diff between "same code, new module system" and "bugs fixed" stays readable.

**Success criteria**

- [ ] All four files are ESM; `package.json` has `"type": "module"`.
- [ ] Every test from Phase 2 has been re-run, and each one that now fails is matched to an entry
      in your Phase 1 audit. **An unpredicted failure means the audit was wrong** — go back and
      say what you missed and why.
- [ ] `registry.js` now throws. Fix only what is necessary to make it run, and state which
      chapter's rule the fix comes from.
- [ ] The `"use strict"` directives are removed, with one sentence on why keeping them would be
      wrong rather than merely redundant.
- [ ] A note on what `module.exports` became, and whether any consumer relied on the
      export object being mutable after import (Ch20's live bindings).

---

## Phase 4 — Now fix the bugs

With the migration proven, fix the actual defects.

**Success criteria**

- [ ] `cfg.timeout` respects an explicit `0`. Name the operator you used and why the other one is
      wrong here (Ch21).
- [ ] `withOverrides` no longer mutates anything shared. State whether you fixed it with a copy,
      a deep freeze, or a redesign — and what each would have cost (Ch18).
- [ ] `defaults.tags` can no longer be mutated by any caller. Prove it, and then name the one
      mutation your fix still permits if `tags` held a `Map` instead (Ch18, Part 4).
- [ ] `collect` works for any metric. Say which of the available fixes you chose — `bind`, an arrow
      field, calling it as a method — and why, in terms of what each one costs per instance (Ch5,
      and Ch17 for the per-instance cost).
- [ ] `registry.js`'s `count` is a real binding, and you can say what it was before and why the
      module system made that impossible.

---

## Phase 5 — The retention question

One of these modules holds things forever. Find it.

**Success criteria**

- [ ] Identify the structure that grows without bound and name which of Ch17's shapes it is.
- [ ] Demonstrate it: register 10,000 handlers, measure, and record the numbers.
- [ ] Note that `MAX_ENTRIES` exists and is never used. Decide whether to enforce it or delete it,
      and justify the choice — an unused constant that names an invariant nobody checks is its own
      kind of defect.
- [ ] Say whether converting `entries` to a `Map` would change the retention story, and why.
- [ ] One sentence on whether module-level state surviving for the process lifetime is a leak or a
      design decision, and what makes the difference (Ch20 + Ch17).

---

## Phase 6 — Prove it, and write the note

**Success criteria**

- [ ] A before/after table: for each of the five behaviours in Phase 0, the old value, the new
      value, and the chapter whose rule explains the change.
- [ ] Every Phase 1 audit entry marked as **confirmed** or **wrong**, with the wrong ones explained.
      Being wrong here is expected and is worth more than a clean sheet — say what misled you.
- [ ] **The migration note**: the text you would put on the PR. Three to six sentences, aimed at a
      reviewer who has not read any of this. It must state what changed behaviourally, what the
      riskiest change is, and what you did to de-risk it.
- [ ] One paragraph on what this codebase would have needed to make the migration boring —
      answered concretely (what tooling, what conventions), not as "better tests".
- [ ] One sentence you could say in an interview describing the whole thing in under 30 seconds.

---

## Stretch, genuinely optional

- Write `auditModes(dir)` — walk a directory, classify every file's effective mode, and flag any
  file containing a `"use strict"` that is not in effect. Run it over a real project you have and
  record what it finds. The false-positive rate is the interesting result.
- Add a `Map`-based cache to `registry.js` with a bound, then answer the Ch18 question it raises:
  can you hand a caller a read-only view of it, and what does `Object.freeze` do to a `Map`?
- Take the finished ESM version and produce a single-file bundle two ways — naive concatenation
  and per-file function wrappers — and demonstrate the Ch22 hazard on the *pre-migration* CommonJS
  version. Then explain in two sentences why the ESM version cannot exhibit it.

---

## Where this goes next

Nowhere — this is the end of the track. Chapters 1–22 cover the topic list in `prompt.md`.

What is left is not another chapter, it is repetition: the `mock.md` files are the thing to
re-run, out loud and timed, and the `notes.md` files are the morning-of read. If you want a next
piece of work, the honest one is to go back to the chapters whose exercises are still unattempted
and do them, since a chapter you read is not a chapter you can answer under pressure.
