# Chapter 21 — Cumulative Exercise: A Config Resolver That Can Explain Itself

**Time:** 1–3 hours. **Scope:** everything from Chapters 16–21 — error semantics, retention,
immutability and freezing, numeric edge cases, modules, and absence.

Build a layered configuration resolver: defaults, then a config file, then environment variables,
then CLI flags, then runtime patches. Every layer disagrees about what "not set" means, and the
whole exercise is that **each disagreement is a decision you have to make and be able to defend.**

This doubles as a system-design whiteboard question — *"how would you build config resolution for a
service?"* — and the reason it's a good one is that the naive answer (`{...a, ...b, ...c}`) is wrong
in five separate ways you can now name.

**The deliverable is the `explain()` output, not the resolver.** Anyone can merge objects. The thing
worth building is a resolver that can tell you, for any key, which layer won and which layers tried.

No libraries. Node only.

---

## The layers, and what absence means in each

Write this table down before you write code. It is the actual content of the exercise.

| Layer | "absent" looks like | "explicitly empty" looks like | Gotcha |
|---|---|---|---|
| defaults | — (it's the base) | — | must be frozen; it's shared |
| file (JSON) | key not present | `null` | `undefined` is unrepresentable |
| env vars | `process.env.X === undefined` | `X=""` | **everything is a string** |
| CLI flags | flag not passed | `--tag=` or `--no-verbose` | `--retries 0` vs `--retries` |
| runtime patch | key not present | `null` | must not mutate the resolved object |

Two of those rows can't express something the others can. Find out which before Phase 1.

---

## The fixture

Use this throughout. Do not change it after Phase 2 — an input you edited is not a comparison.

```javascript
// fixture.mjs
export const DEFAULTS = Object.freeze({
  retries: 3,
  timeoutMs: 5000,
  tag: "app",
  verbose: false,
  rate: 0.5,
  endpoints: Object.freeze(["a", "b"]),
  auth: Object.freeze({ token: null, scheme: "bearer" }),
});

export const FILE = { retries: 0, tag: null, auth: { token: "from-file" } };

export const ENV = { APP_TIMEOUT_MS: "0", APP_VERBOSE: "false", APP_TAG: "", APP_RATE: "0.1" };

export const ARGV = ["--retries", "5", "--no-verbose", "--tag="];

export const PATCH = { timeoutMs: undefined, "auth.token": null };
```

Every one of those values is chosen to break something. `retries: 0` breaks `||`. `tag: null` asks
whether null clears. `APP_VERBOSE: "false"` is a truthy string. `APP_TAG: ""` is an empty string
that may or may not mean unset. `--tag=` is a flag with an empty value. `PATCH` mixes an explicit
`undefined` with a dotted path.

---

## Phase 0 — The state function and the trace

**Build**

- `stateOf(container, key)` → `"value" | "undefined" | "null" | "absent" | "hole"`. Works on plain
  objects, arrays, `Object.create(null)` and `Map`.
- `Trace` — an append-only record of `{ key, layer, sawState, action, valueAfter }`, one entry per
  layer per key it touches. `action` is one of `set`, `skip`, `clear`, `reject`.
- `explain(trace, key)` → a printable account of every layer that had an opinion about one key, in
  order, ending with the winner.

**Success criteria**

- [ ] `stateOf` returns a different answer for a key holding `undefined` and an absent key, on all
      four container types — or you can say precisely which container makes that impossible and why.
- [ ] `explain` on a key no layer mentioned still prints something useful, not an empty string.
- [ ] Nothing in the trace holds a reference to a layer's objects. Say how you ensured that and what
      Chapter 17 says about why it matters for a long-lived process.

---

## Phase 1 — The naive resolver, and its five bugs

Write the version everyone writes first, against the fixture:

```javascript
const config = { ...DEFAULTS, ...FILE, ...envToObject(ENV), ...argvToObject(ARGV), ...PATCH };
```

**Do not fix anything.** Produce a table of every key where the result is wrong, with the state that
caused it. There are at least five distinct failures, each from a different mechanism in Chapter 21.

**Success criteria**

- [ ] A table: key · expected · actual · which mechanism.
- [ ] For each row, the mechanism is named specifically — "spread creates the key even when the
      value is `undefined`", not "spread is wrong".
- [ ] One row where the naive version is *accidentally right*, and the sentence explaining why it
      won't stay right.

---

## Phase 2 — Layer adapters

Each source becomes an adapter producing a uniform shape:

```javascript
// -> { values: Map<string, {state, value}>, name: string }
```

**Build**

- `fromObject(name, obj)` — for `DEFAULTS`, `FILE`, `PATCH`. Must distinguish absent from `undefined`
  from `null`, which spread cannot.
- `fromEnv(prefix, env, schema)` — `APP_TIMEOUT_MS` → `timeoutMs`. **Everything arriving is a
  string**, so this needs the schema to coerce, and coercion has to fail loudly.
- `fromArgv(argv, schema)` — `--retries 5`, `--tag=`, `--no-verbose`, and a bare `--verbose`.

**Success criteria**

- [ ] `APP_VERBOSE: "false"` becomes `false`, not `true`. Say what the one-line naive version does
      and why it's the most common config bug in Node.
- [ ] `APP_TIMEOUT_MS: "0"` becomes `0`, and survives every later stage. If it doesn't, you have `||`
      somewhere.
- [ ] `APP_RATE: "0.1"` parses to a number, and you can say what Chapter 19 says about comparing that
      number to anything later.
- [ ] `--no-verbose` and `--verbose=false` produce the same result, and `--tag=` produces an empty
      string rather than `true` or missing.
- [ ] A malformed value (`APP_TIMEOUT_MS: "soon"`) is a **rejection with the key, the layer and the
      raw text**, not a `NaN` that flows onward. Chapter 19's rule.

---

## Phase 3 — The policy, made explicit

```javascript
resolve(layers, {
  undefinedMeans: "skip",   // or "clear"
  nullMeans: "clear",       // or "value"
  emptyStringMeans: "value" // or "unset"  (env and CLI only)
})
```

**Build** the resolver, driven entirely by that policy object, recording a trace entry per layer per
key.

**Success criteria**

- [ ] All eight combinations of the three knobs run without special-casing any key.
- [ ] Fill in the table: for a key present in `DEFAULTS` and `null` in `FILE`, what is the result
      under each of the four `(undefinedMeans, nullMeans)` pairs?
- [ ] **Name the combination that makes "unset this key" inexpressible**, and say what you'd add to
      recover it.
- [ ] `emptyStringMeans` applies only to string-typed sources. Explain in one sentence why applying
      it to the file layer would be a bug.

---

## Phase 4 — Dotted paths, and reading back

`PATCH` contains `"auth.token": null`. Runtime patches address nested values.

**Build**

- `setIn(obj, path, value)` — returns a **new** object, structurally shared where nothing changed.
- `getIn(obj, path)` → `{ value, found, stoppedAt }` — distinguishing "found and holds `undefined`"
  from "path broken at segment 2".

**Success criteria**

- [ ] `getIn(config, ["auth", "token"])` reports `found: true` when the token is `null`, and
      `found: false` for `["auth", "nope"]`. `a?.b?.c` cannot do this — write the sentence saying
      why.
- [ ] `setIn` does not mutate, and does not deep-clone what it didn't touch. Prove the sharing with
      an identity check, and say which chapter that technique is from.
- [ ] `setIn` on a frozen input works. `DEFAULTS` is frozen; if this throws, say whether you are in
      strict mode and what that changed (Chapter 18, and Chapter 20's "modules are always strict").
- [ ] A path segment that would collide with a prototype key (`__proto__`, `constructor`) is
      rejected. Say what the attack is.

---

## Phase 5 — Freezing and provenance

**Build**

- The resolved config is **deeply frozen** before it is returned.
- `explain(key)` prints every layer that had an opinion, in order, with the state it saw and the
  action taken.

Target output shape:

```
retries
  defaults   value(3)        set    -> 3
  file       value(0)        set    -> 0
  env        absent          skip   -> 0
  argv       value(5)        set    -> 5
  patch      absent          skip   -> 5
  WINNER: argv = 5
```

**Success criteria**

- [ ] `explain("tag")` shows the `null` from the file, the empty string from env, and `--tag=`, and
      the winner is unambiguous from reading it.
- [ ] `explain("timeoutMs")` shows the `PATCH`'s explicit `undefined` and what your policy did.
- [ ] Deep-freezing is genuinely deep — an array inside an object inside the config. Test a write and
      say what it does in strict versus sloppy mode.
- [ ] One paragraph: what does freezing buy in a long-running service, and what does it *not* buy?
      (Chapter 18 has the answer, and it is not "immutability".)

---

## Phase 6 — Async sources and failure

One layer now loads over the network: `fromRemote(url)`.

**Build**

- `resolveAsync(layerFactories, policy)` — factories are called concurrently; the resolution order
  is still lowest-priority-first regardless of completion order.
- A failed layer must be a recorded `reject` in the trace, not a thrown resolve.

**Success criteria**

- [ ] Layers load concurrently but apply in priority order — prove it with a factory that resolves
      out of order.
- [ ] One failing layer does not lose the others. Say which promise combinator you used and why the
      obvious one is wrong (Chapter 14).
- [ ] A layer that never settles: what happens, and what did you put in place? Chapter 20's exit-13
      failure is the shape to avoid.
- [ ] The error from a rejected layer keeps its cause. Say what `{ cause }` gives you here that a
      re-thrown string doesn't (Chapter 16).

---

## Phase 7 — The write-up

One page, no more.

1. **The five bugs from Phase 1**, each in one sentence naming its mechanism.
2. **Your policy defaults, and why.** Specifically: does `null` clear, and what does an explicit
   `undefined` in a patch mean? These are the two decisions the whole thing rests on.
3. **The combination that can't express "unset"**, and your fix.
4. **The three sentences you'd say** if asked "how would you do config resolution for a service?"
5. **What you'd do differently for a config that reloads at runtime** rather than at startup — which
   is where Chapters 17 and 18 stop being theoretical.

---

## Success criteria for the whole exercise

- [ ] The fixture is unchanged from Phase 2 and every phase runs against it.
- [ ] Every claim in the Phase 1 table came from a run.
- [ ] `explain()` output for `tag` is readable by someone who has not seen the code.
- [ ] You can state, in one sentence each, what `undefined` and `null` mean in *this* system — and
      they are not the same sentence as the language's.

---

## If you want to go further

Out of scope; only after the write-up:

- **A `--explain-config` CLI flag** that prints the trace for every key at startup. This is a real
  feature that real services should have and almost none do.
- **Schema-driven required keys**: a key with no default and no layer providing it fails startup with
  the list of every layer that was checked.
- **Redaction**: `auth.token` must never appear in `explain()` output, but the *provenance* still
  must. Consider what that means for a trace you already built.
