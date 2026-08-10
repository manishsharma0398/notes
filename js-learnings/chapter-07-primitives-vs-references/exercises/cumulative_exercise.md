# Cumulative Exercise — Chapters 1–7: `timelapse`, an Immutable State Engine

**Time estimate:** 2–3 hours
**Concepts integrated:** Execution model, execution contexts, lexical scope, hoisting, `this` binding, closures, value vs reference semantics

---

## Project Brief

In Chapter 6 you built a reactive store. It works, but it has two defects that every real state library has had to solve — and both of them are *reference semantics* problems, not architecture problems:

1. **`getState()` returns a shallow copy.** That protects the top level and nothing else. A caller can still reach `getState().user.profile.name` and mutate the store's live heap object. Your store has no idea it happened.
2. **Every subscriber fires on every dispatch.** A component that only cares about `state.cart.total` gets woken up when `state.session.lastPing` changes. The store has no way to answer "did the part you care about actually change?"

`timelapse` fixes both, and gets a third thing almost for free: **time travel**. Once state is genuinely immutable, every past state is still sitting there intact — undo/redo becomes an array index.

This is the core of what Redux DevTools, Immer, and MobX's structural sharing actually do. A working version is worth showing.

**No frameworks. No libraries. Vanilla JS only.**

---

## What You'll Need From Each Chapter

| Chapter | Concept Applied |
|---|---|
| Ch 1 — Parsing & Execution | Declaration order in your module; when each helper is available |
| Ch 2 — Execution Contexts | Stack depth during recursive freeze and recursive copy |
| Ch 3 — Lexical Scope | The scope chain that lets nested helpers see the `seen` set |
| Ch 4 — Hoisting | Recursive function declarations vs `const` arrow functions + TDZ |
| Ch 5 — `this` Binding | Store methods and what happens when a subscriber is a method torn off its object |
| Ch 6 — Closures | Private state, private history, the ER that survives after `createStore` returns |
| **Ch 7 — Primitives vs References** | **Every phase. Copying, identity, mutation vs reassignment, freezing.** |

---

## Phase 0 — Starting Point

Reuse your Chapter 6 `createStore` if you have it. If not, this is enough to build on:

```javascript
"use strict";

function createStore(reducer, initialState) {
  let state = initialState;
  const subscribers = [];

  function getState() { return state; }

  function dispatch(action) {
    state = reducer(state, action);
    subscribers.slice().forEach((fn) => fn(state));
  }

  function subscribe(listener) {
    subscribers.push(listener);
    return function unsubscribe() {
      const i = subscribers.indexOf(listener);
      if (i !== -1) subscribers.splice(i, 1);
    };
  }

  return { getState, dispatch, subscribe };
}
```

Work through the phases in order — each one depends on the previous.

---

## Phase 1 — `deepFreeze(value)`

`Object.freeze` is shallow (Chapter 7). Write a recursive version that freezes an entire object graph.

```javascript
function deepFreeze(value) {
  // TODO Phase 1:
  // - Return `value` unchanged if it is not an object (primitives are already immutable)
  // - Remember: typeof null === "object" — handle it
  // - Freeze the object itself, then recurse into every own property value
  // - Arrays are objects too — they must be frozen as well
  // - A graph can contain the SAME object twice, or a cycle (a.self = a).
  //   Naive recursion either does redundant work or never terminates.
  //   Track what you have already visited.
}
```

**Why the cycle case matters:** `deepFreeze` recursing into a cycle blows the call stack — that's Chapter 2's stack, hit for real. Your fix should be a set of already-seen objects. Ask yourself why a `WeakSet` is a better choice here than an array or a `Set`, and write your answer as a comment.

**Acceptance criteria:**

```javascript
"use strict";
const s = deepFreeze({ user: { profile: { name: "Ada" } }, tags: ["a"] });

s.user.profile.name = "Bob";   // TypeError in strict mode
s.tags.push("b");              // TypeError — frozen array
console.log(s.user.profile.name); // "Ada"

const cyclic = { n: 1 };
cyclic.self = cyclic;
deepFreeze(cyclic);            // must terminate, not overflow the stack

console.log(Object.isFrozen(s.user.profile)); // true
console.log(deepFreeze(42));                  // 42 — primitives pass through
console.log(deepFreeze(null));                // null — no crash
```

Then wire it in: `dispatch` should `deepFreeze` the new state before storing it, and `getState()` should return the frozen state **directly** — no copy needed. Explain in a comment why the copy is now unnecessary.

---

## Phase 2 — `setIn(state, path, value)` — Structural Sharing

Freezing means you can no longer mutate. So you need a way to produce a *new* state that differs in one spot — while **reusing every untouched subtree by reference**.

```javascript
function setIn(obj, path, value) {
  // TODO Phase 2:
  // - path is an array of keys, e.g. ["user", "profile", "name"]
  // - Return a NEW object. Do not mutate `obj`.
  // - Every object ALONG the path is shallow-copied
  // - Every object OFF the path must be the SAME reference in the result
  // - An empty path replaces the root entirely
  // - Handle arrays in the path (numeric keys) without turning them into objects
}
```

This is the heart of the exercise. The tests are written with `===` on purpose — they are asserting *identity*, which is the only way to prove sharing actually happened:

**Acceptance criteria:**

```javascript
const before = {
  user: { profile: { name: "Ada" }, id: 7 },
  cart: { items: [1, 2], total: 30 },
};

const after = setIn(before, ["user", "profile", "name"], "Bob");

console.log(after.user.profile.name);      // "Bob"
console.log(before.user.profile.name);     // "Ada"  — original untouched

console.log(after !== before);             // true — new root
console.log(after.user !== before.user);   // true — on the path, copied
console.log(after.user.profile !== before.user.profile); // true — on the path

console.log(after.cart === before.cart);   // true  ← THE POINT: off the path, shared
console.log(after.user.id === before.user.id); // true — sibling key carried over
```

That last pair is what makes Phase 3 and Phase 4 cheap. If `after.cart === before.cart` is `false`, you deep-copied and the rest of the project falls apart.

Add a `SET_IN` action to your reducer so dispatch can drive it.

---

## Phase 3 — Selector Subscriptions

Now that untouched subtrees keep their identity, "did this slice change?" is a single `!==`.

```javascript
function subscribe(selector, listener) {
  // TODO Phase 3:
  // - selector: (state) => any — picks the slice this listener cares about
  // - Capture the selected value at subscribe time (closure — Ch 6)
  // - On each dispatch, select again and compare against the previous selection
  // - Only invoke listener if it changed; then store the new selection
  // - Keep the old one-argument form working: subscribe(listener) with no selector
}
```

**Acceptance criteria:**

```javascript
const store = createStore(reducer, {
  user: { profile: { name: "Ada" } },
  cart: { items: [], total: 0 },
});

let cartCalls = 0;
store.subscribe((s) => s.cart, () => { cartCalls++; });

store.dispatch({ type: "SET_IN", path: ["user", "profile", "name"], value: "Bob" });
console.log(cartCalls); // 0  ← cart subtree is reference-identical, listener never ran

store.dispatch({ type: "SET_IN", path: ["cart", "total"], value: 99 });
console.log(cartCalls); // 1
```

**Then break it deliberately.** Add this subscriber:

```javascript
store.subscribe(
  (s) => ({ name: s.user.profile.name, total: s.cart.total }), // builds a NEW object each call
  () => console.log("derived slice changed")
);
```

It fires on *every* dispatch, even when neither field changed. Explain why in a comment — it's Program 2 question 1 from the chapter exercise, showing up in production code. Then fix it by comparing with the `shallowEqual` you wrote in the chapter exercise, and note the trade-off: identity compare is O(1), `shallowEqual` is O(keys). Real libraries make you opt in to the second for exactly this reason.

---

## Phase 4 — Time Travel

```javascript
// TODO Phase 4 — inside createStore's closure:
// - Keep a private history array of past states, plus a cursor index
// - Every dispatch pushes the new state and advances the cursor
// - store.undo()      — move cursor back, notify subscribers
// - store.redo()      — move cursor forward, notify subscribers
// - store.jumpTo(i)   — absolute move
// - Dispatching while the cursor is in the past DISCARDS the redo tail
//   (same as a text editor: type after undo and the redo history is gone)
// - store.history()   — returns the list WITHOUT letting callers mutate it
```

**Acceptance criteria:**

```javascript
store.dispatch({ type: "SET_IN", path: ["cart", "total"], value: 10 });
store.dispatch({ type: "SET_IN", path: ["cart", "total"], value: 20 });
store.dispatch({ type: "SET_IN", path: ["cart", "total"], value: 30 });

store.undo();
console.log(store.getState().cart.total); // 20
store.undo();
console.log(store.getState().cart.total); // 10
store.redo();
console.log(store.getState().cart.total); // 20

store.dispatch({ type: "SET_IN", path: ["cart", "total"], value: 99 });
store.redo();                              // no-op — tail was discarded
console.log(store.getState().cart.total);  // 99
```

**The question this phase is really asking:** history stores *references* to old state roots, not copies. Nothing is cloned. Write a short comment answering both halves:

- Why is storing bare references safe here, when it would be a disaster in the Chapter 6 store?
- Two snapshots five steps apart share most of their subtrees. How much memory does 100 snapshots of a large state tree actually cost, and what does that depend on?

---

## Phase 5 — Copy Semantics Audit

Short written phase — no store code. Fill in this table by *running* each case, then explain the results:

```javascript
const original = {
  when: new Date(),
  tags: new Set(["a"]),
  lookup: new Map([["k", 1]]),
  missing: undefined,
  fn: () => 1,
  nested: { deep: true },
};
original.self = original; // cycle
```

| Technique | Survives nesting? | `Date` | `Map`/`Set` | `undefined` values | Functions | Cycles |
|---|---|---|---|---|---|---|
| `{ ...original }` | | | | | | |
| `structuredClone(original)` | | | | | | |
| `JSON.parse(JSON.stringify(original))` | | | | | | |

Then answer:

1. Which of the three would silently corrupt your store's state, and how would that bug present itself to a user?
2. `structuredClone` handles cycles. Your `deepFreeze` had to handle them manually. What do the two have in common?
3. You never needed a deep copy anywhere in Phases 1–4. Why not? What did you use instead?

---

## Success Criteria

- [ ] Phase 1: `deepFreeze` freezes every level, including arrays
- [ ] Phase 1: Terminates on cyclic structures without stack overflow
- [ ] Phase 1: Primitives and `null` pass through unharmed
- [ ] Phase 1: `getState()` no longer copies, and you can explain why
- [ ] Phase 2: `setIn` returns a new root and never mutates the input
- [ ] Phase 2: Objects off the path are reference-identical (`===`) in the result
- [ ] Phase 2: Empty path and array indices both handled
- [ ] Phase 3: A listener on an untouched slice is not called
- [ ] Phase 3: The new-object-per-call selector problem is reproduced, explained, and fixed
- [ ] Phase 4: undo / redo / jumpTo work, redo tail is discarded on new dispatch
- [ ] Phase 4: `history()` cannot be used to corrupt internal history
- [ ] Phase 4: Memory question answered in writing
- [ ] Phase 5: Table filled in from actual runs, all three questions answered

---

## Hints

<details>
<summary>Hints (read only if stuck)</summary>

**Phase 1**
- Guard clause first: `if (value === null || typeof value !== "object") return value;`
- `Object.freeze` returns the object, so you can freeze and recurse in either order — but freeze *before* recursing if you want the cycle guard to be simplest.
- The seen-set has to be shared across the whole recursion. Either pass it as a second parameter with a default, or use an inner helper that closes over it (Ch 3 / Ch 6).
- `WeakSet` holds its members weakly — it won't keep a discarded object graph alive just because you froze it once.

**Phase 2**
- Base case: `if (path.length === 0) return value;`
- Recursive case: shallow-copy the current level, then set `copy[head] = setIn(obj[head], rest, value)`.
- `{ ...obj }` on an array gives you an object with numeric string keys — not an array. Check `Array.isArray` and copy with `slice()` or `[...arr]` instead.
- Everything you *don't* touch in the shallow copy is carried over as the same reference automatically. That's the sharing — you get it for free by copying only one level at a time.

**Phase 3**
- Overload detection: `if (typeof selector === "function" && typeof listener === "undefined")` means the caller passed only a listener.
- Each subscription needs its own remembered previous value — that's one closure per subscription, not one shared variable.
- The derived-object selector fires every time because `{a:1} !== {a:1}`. Two structurally identical objects built at different moments are different heap objects, always.

**Phase 4**
- The cursor is an index into history; `getState()` returns `history[cursor]`.
- Discarding the redo tail is `history.length = cursor + 1` — a mutation of `length`, exactly like `clearHistory` in the chapter exercise.
- `history()` returning the internal array hands callers a pointer to your private state. Return a copy of the array — the *snapshots inside it* are already frozen, so a shallow copy is enough here. Make sure you can explain why.

**Phase 5**
- Run it. Don't reason it out from memory — two of the rows have results people consistently guess wrong.

</details>

---

## Notes

- Write everything in `exercises/solution/timelapse.js`
- Implement with closures and factory functions — no classes
- No global variables outside `createStore` and your helpers
- `deepFreeze` and `setIn` should be standalone and independently testable
- Keep your written answers as comments in the file — they are part of the deliverable
