# Interview Questions: Render vs Commit Phase

## Question 1: Fundamentals

**Q: Why does React split work into render and commit phases?**

**Answer:**

- **Render phase (interruptible):** React can pause/abort work to prioritize urgent updates (typing over data fetching), enabling Concurrent Rendering and time-slicing
- **Commit phase (synchronous):** Ensures DOM is always in consistent state; user never sees half-updated UI
- Separation allows React to call components multiple times without side effects, then apply changes atomically

**Follow-up:** What breaks if we make commit phase interruptible?

- User sees partial UI updates (button moved but text not updated)
- Layout thrashing (multiple reflows)
- Inconsistent application state

---

## Question 2: Purity Requirements

**Q: What does "render phase must be pure" mean? Give 3 specific rules.**

**Answer:**

1. **Idempotent:** Same props/state → same JSX output
2. **No side effects:** Cannot mutate external state, DOM, start timers, make network requests
3. **Safe to call multiple times:** React can render, discard, re-render without issues

**Why it matters:**

- Concurrent Mode renders components speculatively
- Strict Mode intentionally double-renders to catch violations
- React might call your component 3x but only commit final result

**Follow-up:** Is calling `setState` during render a violation?

- **No**, but triggers immediate re-render before commit
- React treats as "render-phase state update"
- Not batched with other updates

---

## Question 3: Debugging Challenge

```js
function SearchBar() {
  const [query, setQuery] = useState("");

  // Developer adds this
  fetch(`/suggestions?q=${query}`)
    .then((res) => res.json())
    .then((data) => setSuggestions(data));

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

**Q: What's wrong? What happens in production?**

**Answer:**

**Problems:**

1. **Fetch in render phase** (side effect)
2. Every re-render sends new request
3. User types "react" → 5 requests sent (r, re, rea, reac, react)
4. In Concurrent Mode: component might render 15x → 15 requests
5. **Race condition:** Responses arrive out of order, wrong suggestions displayed

**Symptoms:**

- Network tab shows duplicate requests
- UI shows stale/wrong suggestions
- "Too many requests" errors

**Fix:**

```js
function SearchBar() {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/suggestions?q=${query}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setSuggestions(data))
      .catch((err) => {
        if (err.name !== "AbortError") throw err;
      });

    return () => controller.abort(); // Cleanup
  }, [query]);

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

---

## Question 4: Execution Order

```js
function App() {
  console.log("1: Render");

  useLayoutEffect(() => {
    console.log("2: Layout effect");
  });

  useEffect(() => {
    console.log("3: Effect");
  });

  return <div ref={() => console.log("4: Ref callback")}>Hello</div>;
}
```

**Q: What's the console output order on mount?**

**Answer:**

```
1: Render              (Render phase)
1: Render              (Strict Mode double-render)
4: Ref callback        (Commit phase - DOM mutation)
2: Layout effect       (Commit phase - before paint)
[Browser paints]
3: Effect              (After paint, async)
```

**In production (no Strict Mode):**

```
1: Render
4: Ref callback
2: Layout effect
3: Effect
```

**Key insights:**

- Ref callbacks run during commit (DOM mutations)
- `useLayoutEffect` runs **before** browser paint (synchronous)
- `useEffect` runs **after** browser paint (async, separate task)

---

## Question 5: Infinite Loop Detection

```js
function Counter() {
  const [count, setCount] = useState(0);

  if (count < 5) {
    setCount(count + 1);
  }

  return <div>{count}</div>;
}
```

**Q: Does this cause an infinite loop? Why or why not?**

**Answer:**

**No infinite loop, but renders multiple times:**

1. Render 1: count=0 → `setCount(1)` → queue re-render
2. React re-renders **before commit** (render-phase update)
3. Render 2: count=1 → `setCount(2)` → queue re-render
4. Renders 3, 4, 5 continue...
5. Render 6: count=5 → no setCount → commit

**Final output:** Displays "5"

**Why no infinite loop:**

- `setCount` during render triggers immediate re-render
- But condition `count < 5` eventually becomes false
- React commits final state

**When does infinite loop happen:**

```js
if (count >= 0) {
  // ❌ Always true
  setCount(count + 1);
}
```

React throws: "Maximum update depth exceeded"

---

## Question 6: Production Bug

**Q: This code worked in development but breaks in production. Why?**

```js
function VideoPlayer({ src, isPlaying }) {
  const ref = useRef();

  if (isPlaying) {
    ref.current?.play();
  } else {
    ref.current?.pause();
  }

  return <video ref={ref} src={src} />;
}
```

**Answer:**

**Why it "works" in dev:**

- Strict Mode double-renders, so `ref.current` exists on 2nd render
- Play/pause happens to execute (by luck)

**Why it breaks in production:**

- No double-render
- On initial mount: `ref.current` is `null` during render phase
- Refs are assigned **during commit**, not render
- `ref.current?.play()` does nothing
- Video doesn't auto-play

**Deeper issue:**

- Side effect (calling `.play()`) in render phase
- In Concurrent Mode: might call `.play()` 3 times

**Correct solution:**

```js
function VideoPlayer({ src, isPlaying }) {
  const ref = useRef();

  useEffect(() => {
    if (isPlaying) {
      ref.current.play();
    } else {
      ref.current.pause();
    }
  }, [isPlaying]);

  return <video ref={ref} src={src} />;
}
```

---

## Question 7: Performance Trap

**Q: Does re-rendering a component always update the DOM? When can you optimize this?**

**Answer:**

**No, re-render ≠ DOM update:**

```js
function Child({ value }) {
  console.log("Child rendered"); // Runs
  return <div>{value}</div>;
}

function Parent() {
  const [count, setCount] = useState(0);
  return (
    <>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <Child value={42} /> {/* Re-renders but value unchanged */}
    </>
  );
}
```

**What happens:**

1. Button click → `setCount` → Parent re-renders
2. Parent re-renders → **Render phase:** React calls `Child()`
3. Child returns `<div>42</div>` (same as before)
4. **Commit phase:** React compares virtual trees
5. `<div>42</div>` === `<div>42</div>` → **No DOM update**

**But Child's function still ran!**

**Optimization with React.memo:**

```js
const Child = React.memo(function Child({ value }) {
  console.log("Child rendered"); // Doesn't run if value unchanged
  return <div>{value}</div>;
});
```

Now:

- Parent re-renders
- React checks: `value` prop changed? No → Skip calling Child()
- No render phase work for Child
- No commit phase work (already skipped)

**When to use:**

- Expensive render logic
- Large component trees
- Frequent parent re-renders

**When NOT to use:**

- Props change often anyway
- Render logic is cheap
- Premature optimization

---

## Question 8: Concurrent Mode Behavior

**Q: In Concurrent Mode, React might call your component 3 times but only commit once. Give a real scenario where this breaks user experience.**

**Answer:**

**Scenario: Form analytics**

```js
function CheckoutForm() {
  const [step, setStep] = useState(1);

  // ❌ Track step view in render
  analytics.track("checkout_step_viewed", { step });

  return <div>Step {step}</div>;
}
```

**What breaks:**

1. User navigates to step 2
2. React starts render (step=2) → sends analytics event
3. Higher priority update interrupts (user clicks back to step 1)
4. React abandons step 2 render, restarts with step 1
5. Renders step 1 → sends analytics event
6. User changes mind, goes to step 2 again
7. Renders step 2 → sends analytics event

**Result:**

- User saw: Step 1 → Step 2
- Analytics received: Step 2 → Step 1 → Step 2
- Reports show: "50% of users go backwards in checkout" (false!)

**Fix:**

```js
function CheckoutForm() {
  const [step, setStep] = useState(1);

  useEffect(() => {
    analytics.track("checkout_step_viewed", { step });
  }, [step]);

  return <div>Step {step}</div>;
}
```

Now analytics only fires when commit happens (user actually sees the step).

---

## Traps & Edge Cases

### Trap 1: "I used `useEffect`, but it still runs twice!"

**Scenario:**

```js
useEffect(() => {
  console.log("Effect ran");
}, []);
```

**Output in dev:**

```
Effect ran
Effect ran  // ← Why twice?
```

**Answer:** Strict Mode intentionally:

1. Runs effect
2. Runs cleanup
3. Runs effect again

**Purpose:** Ensures your cleanup logic works (simulates unmount/remount)

**Production:** Runs once

### Trap 2: "`useLayoutEffect` vs `useEffect` - when does it matter?"

**Scenario:**

```js
function Tooltip() {
  const [position, setPosition] = useState(0);

  useEffect(() => {
    setPosition(calculatePosition());
  }, []);

  return <div style={{ top: position }}>Tooltip</div>;
}
```

**Problem:**

1. Render with `position=0`
2. Commit to DOM (tooltip at top)
3. **Browser paints** (user sees tooltip at wrong position)
4. `useEffect` runs → `setPosition(100)`
5. Re-render, commit, paint (tooltip jumps)

**User sees flicker!**

**Fix:**

```js
useLayoutEffect(() => {
  setPosition(calculatePosition());
}, []);
```

Now:

1. Render with `position=0`
2. Commit to DOM
3. `useLayoutEffect` runs **before paint** → `setPosition(100)`
4. Re-render, commit
5. **Browser paints once** (correct position)

**No flicker!**

---

## Advanced: When Render Phase Updates Trigger

**Q: Explain the execution flow when `setState` is called during render.**

**Answer:**

```js
function App() {
  const [count, setCount] = useState(0);

  if (count === 0) {
    setCount(1); // ← Render-phase update
  }

  return <div>{count}</div>;
}
```

**Internal React flow:**

1. **Render phase begins:** Call `App()` with `count=0`
2. Component runs `if (count === 0)` → true
3. Calls `setCount(1)`
4. **React marks "needs re-render before commit"**
5. Render phase restarts immediately: Call `App()` with `count=1`
6. Component runs `if (count === 1)` → false
7. Returns `<div>1</div>`
8. **Commit phase:** Update DOM to show "1"

**Key points:**

- Re-render happens **before commit** (still in render phase)
- Not batched with other updates
- Triggers immediate re-render
- If this happens in a loop → "Maximum update depth exceeded"

**Comparison with effect updates:**

```js
useEffect(() => {
  setCount(1); // ← Commit-phase update
}, []);
```

Flow:

1. Render with `count=0`
2. Commit (DOM shows "0")
3. Effect runs → `setCount(1)`
4. **Queue re-render** (batched)
5. Next render with `count=1`
6. Commit (DOM shows "1")

**User sees:** "0" briefly, then "1" (two paints)
