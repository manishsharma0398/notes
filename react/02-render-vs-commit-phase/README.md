# Chapter 2: Render Phase vs Commit Phase

## Mental Model

React's work happens in **two distinct phases**:

1. **Render Phase** (pure, interruptible)
   - React calculates what **should** change
   - Builds/updates the fiber tree
   - Calls your component functions
   - Computes diffs
   - **Can be paused, aborted, or restarted**
   - **No side effects allowed**

2. **Commit Phase** (synchronous, uninterruptible)
   - React applies changes to the **actual DOM**
   - Runs layout effects (`useLayoutEffect`)
   - Runs cleanup functions
   - **Cannot be interrupted**
   - **Side effects happen here**

```
State Update → Render Phase → Commit Phase → Browser Paint
                (can pause)     (atomic)       (user sees it)
```

### Critical Insight

**Your component function runs in the RENDER phase, NOT the commit phase.**

This means:

- Component re-renders don't mean DOM updates
- React might call your component multiple times and throw away the result
- You can't rely on "one render = one DOM update"

---

## Why Two Phases?

### Before Fiber (React 15 and earlier)

React did everything synchronously:

```
setState() → Calculate all changes → Update DOM → Done
            ↑_____ BLOCKS THE MAIN THREAD _____↑
```

Problems:

- Large component trees froze the UI
- No way to prioritize urgent updates (typing) over less urgent ones (data fetching)
- Once started, React couldn't stop until done

### After Fiber (React 16+)

React split the work:

```
setState() → [Render Phase: Build fiber tree] → [Commit: Apply to DOM]
                    ↑ Interruptible ↑               ↑ Atomic ↑
```

Benefits:

- Can pause render work to handle user input
- Can prioritize updates (Concurrent React)
- Can throw away work if props/state change mid-render

---

## What Happens in Each Phase

### Render Phase

1. **Calls your component functions**

   ```js
   function Counter({ count }) {
     console.log("Rendering Counter:", count); // ← Render phase
     return <div>{count}</div>;
   }
   ```

2. **Creates/updates fiber nodes**
   - React builds a work-in-progress fiber tree
   - Compares new output with previous fibers
   - Marks what needs to change (flags)

3. **Runs render-phase hooks**
   - `useState` (returns current state)
   - `useMemo` (computes value)
   - `useCallback` (creates function)
   - `useReducer`
   - The **function body** of `useEffect` is NOT run yet

4. **Pure operations only**
   - Must be safe to call multiple times
   - Must not mutate DOM
   - Must not set timers
   - Must not make network requests

### Commit Phase

1. **DOM mutations**

   ```
   Before:              After commit:
   <div>Old</div>   →   <div>New</div>
   ```

2. **Runs layout effects**

   ```js
   useLayoutEffect(() => {
     // ← Runs AFTER DOM updates, BEFORE browser paints
     const height = div.offsetHeight; // Can read layout
   });
   ```

3. **Browser paints**

4. **Runs passive effects** (separate microtask)

   ```js
   useEffect(() => {
     // ← Runs AFTER browser paint (async)
   });
   ```

5. **Update refs**
   ```js
   <div ref={myRef} /> // myRef.current is set during commit
   ```

---

## ASCII Diagram: The Two Phases

```
User clicks button
      ↓
   setState(2)
      ↓
┌─────────────────────────────────────────────┐
│         RENDER PHASE (Interruptible)        │
├─────────────────────────────────────────────┤
│ 1. Call Component(props)                    │
│    → Returns JSX (createElement calls)      │
│                                             │
│ 2. Build/update fiber tree                 │
│    → Compare new elements with old fibers   │
│                                             │
│ 3. Mark side effects                        │
│    → "Update text in this <div>"            │
│    → "Replace this <span>"                  │
│                                             │
│ 4. This work can be paused/resumed          │
└─────────────────────────────────────────────┘
      ↓ (No pause → continue)
┌─────────────────────────────────────────────┐
│        COMMIT PHASE (Synchronous)           │
├─────────────────────────────────────────────┤
│ 1. Apply all DOM mutations                  │
│    → Update text content                    │
│    → Remove old nodes                       │
│    → Insert new nodes                       │
│                                             │
│ 2. Run useLayoutEffect                      │
│                                             │
│ 3. Browser paints                           │
│                                             │
│ 4. Run useEffect (passive, async)           │
└─────────────────────────────────────────────┘
      ↓
  User sees update
```

---

## Common Misconceptions

### ❌ Misconception 1: "Re-render = DOM update"

**Wrong:**

```js
function App() {
  const [count, setCount] = useState(0);

  // Developers think: "This runs → DOM updates"
  return <div>{count}</div>;
}
```

**Reality:**

- Component re-render → Render phase (calculates what to change)
- If output is identical to previous render → **No DOM update, no commit phase**
- Commit only happens if React detects actual changes

### ❌ Misconception 2: "Component runs once per update"

**Wrong:**

```js
function App() {
  console.log("Component called"); // Might run 3 times for one update!
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}
```

**Reality in Concurrent React:**

- React might call your component multiple times
- React might start rendering, pause, throw away work, and restart
- Only the **final** render result gets committed

### ❌ Misconception 3: "useEffect runs in render phase"

**Wrong:**

```js
function App() {
  useEffect(() => {
    console.log("Does this run during render?"); // NO!
  });
  return <div>Hello</div>;
}
```

**Reality:**

- `useEffect` **callback** runs in commit phase (actually after paint)
- Only the **setup** (registering the effect) happens in render phase

---

## Why This Matters: Real-World Examples

### Example 1: Logging in Components is Unsafe

```js
function UserProfile({ userId }) {
  // ⚠️ BAD: Analytics in render phase
  analytics.track("profile_viewed", userId);

  return <div>User {userId}</div>;
}
```

**Problem:**

- In Concurrent Mode, React might render this 3 times
- You send 3 analytics events for one view
- Analytics data is now incorrect

**Solution:**

```js
function UserProfile({ userId }) {
  useEffect(() => {
    // ✅ GOOD: Analytics in effect (commit phase)
    analytics.track("profile_viewed", userId);
  }, [userId]);

  return <div>User {userId}</div>;
}
```

### Example 2: DOM Measurements

```js
function AnimatedBox() {
  const [height, setHeight] = useState(0);

  // ❌ WRONG: Can't measure DOM in render phase
  const div = document.getElementById("box");
  setHeight(div.offsetHeight); // Infinite loop!

  return <div id="box">Content</div>;
}
```

**Solution:**

```js
function AnimatedBox() {
  const [height, setHeight] = useState(0);
  const ref = useRef();

  useLayoutEffect(() => {
    // ✅ GOOD: DOM exists now, before browser paints
    setHeight(ref.current.offsetHeight);
  }, []);

  return <div ref={ref}>Content</div>;
}
```

### Example 3: Synchronizing with External Systems

```js
function VideoPlayer({ src, isPlaying }) {
  const ref = useRef();

  // ❌ WRONG: Side effect in render phase
  if (isPlaying) {
    ref.current.play();
  } else {
    ref.current.pause();
  }

  return <video ref={ref} src={src} />;
}
```

**Problems:**

- `ref.current` might be null during initial render
- In Concurrent Mode, this could run multiple times
- Video might play/pause unexpectedly

**Solution:**

```js
function VideoPlayer({ src, isPlaying }) {
  const ref = useRef();

  useEffect(() => {
    // ✅ GOOD: Synchronize in effect
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

## Production Failure Modes

### 1. Race Conditions from Render-Phase Side Effects

```js
// 💥 Production bug example
let requestId = 0;

function SearchResults({ query }) {
  // ❌ Side effect in render
  requestId++;
  const id = requestId;

  fetch(`/search?q=${query}`)
    .then((res) => res.json())
    .then((data) => {
      // ⚠️ Multiple fetches in-flight, wrong order response
      if (id === requestId) {
        setResults(data);
      }
    });

  return <div>Searching...</div>;
}
```

**What breaks:**

- Concurrent Mode renders component 3 times
- 3 fetch requests sent
- Race condition: wrong results displayed

### 2. Broken Cleanup Logic

```js
function ChatRoom({ roomId }) {
  // ❌ Setup in render phase
  const socket = io.connect(`/rooms/${roomId}`);

  // ⚠️ When does cleanup happen?
  // Never! Memory leak.

  return <div>Room: {roomId}</div>;
}
```

**What breaks:**

- Every re-render creates a new WebSocket
- Old sockets never close
- Eventually: "Too many connections" error

### 3. Stale DOM Reads

```js
function Tooltip({ children }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // ❌ Reading DOM in render
  const buttonRect = document.querySelector("button").getBoundingClientRect();
  setPosition({ x: buttonRect.left, y: buttonRect.top });

  return <div style={{ left: position.x }}>{children}</div>;
}
```

**What breaks:**

- Infinite render loop
- React throws "Maximum update depth exceeded"

---

## Interview Questions

### Question 1: Explain why React has two phases

**Expected answer:**

- Render phase is **pure and interruptible** so React can pause work, prioritize urgent updates, and implement Concurrent Rendering
- Commit phase is **synchronous and uninterruptible** to ensure the DOM is always in a consistent state (no half-updated UI visible to the user)
- Separation allows React to:
  - Call components multiple times without side effects
  - Implement time-slicing
  - Abort low-priority work
  - Ensure atomic DOM updates

### Question 2: Can you modify the DOM in the render phase? Why or why not?

**Expected answer:**

- **No**, you cannot and should not
- Render phase can be called multiple times (Concurrent Mode)
- React might throw away render work if props/state change
- DOM modifications are side effects, violates purity requirement
- Causes race conditions and inconsistent UI
- **Solution:** Use `useLayoutEffect` (before paint) or `useEffect` (after paint)

### Question 3: Debugging challenge

```js
function Counter() {
  const [count, setCount] = useState(0);
  console.log("Render:", count);

  if (count === 0) {
    setCount(1);
  }

  return <div>{count}</div>;
}
```

**Question:** What happens when this component mounts? Why?

**Expected answer:**

- React throws "Maximum update depth exceeded"
- On first render: count=0, calls `setCount(1)`, triggers re-render
- On second render: count=1, no state update, commit happens
- But in **Strict Mode** (development):
  - First render: count=0, setCount(1)
  - React throws away work, renders again: count=0, setCount(1)
  - Infinite loop detected, React throws error
- **Why this exists:** To catch render-phase side effects before Concurrent Mode
- **Fix:** Move state update to `useEffect`

### Question 4: Render phase purity

**Question:** What does it mean for the render phase to be "pure"? List 3 rules.

**Expected answer:**

1. **Idempotent:** Calling the component with same props/state produces same JSX
2. **No side effects:** Cannot mutate DOM, start timers, fetch data, change external state
3. **Safe to call multiple times:** React can render, pause, throw away work, re-render
4. **No dependencies on render count:** Cannot rely on "this is the 2nd render"

**Bonus:** Mention that this enables:

- Concurrent rendering
- Time-slicing
- Automatic batching
- React DevTools time-travel

---

## Edge Cases

### Edge Case 1: Strict Mode Double Render

```js
<React.StrictMode>
  <App />
</React.StrictMode>
```

In development:

- React intentionally calls components **twice** in render phase
- Helps detect impure render logic
- Effects run → cleanup → run again

**Why:**

```
Mount:   Render → Render (2nd call) → Commit → Effect → Cleanup → Effect
Unmount: Cleanup
```

Production:

- Normal behavior (single render)

### Edge Case 2: Conditional State Updates

```js
function App({ theme }) {
  const [color, setColor] = useState("blue");

  // ⚠️ Conditional update in render
  if (theme === "dark" && color === "blue") {
    setColor("white"); // Allowed, but triggers immediate re-render
  }

  return <div style={{ color }}>{color}</div>;
}
```

**What happens:**

- Render 1: theme=dark, color=blue → setColor('white')
- React queues re-render **before commit**
- Render 2: theme=dark, color=white → no update
- Commit with final color=white

**Rule:** You can call setState during render, but React treats it as "render-phase state update" and re-renders immediately (not batched).

---

## Key Takeaways

1. **Render phase = Calculate changes (pure, interruptible)**
   - Component functions run here
   - Can happen multiple times
   - No side effects

2. **Commit phase = Apply changes (synchronous, uninterruptible)**
   - DOM updates here
   - Side effects via `useEffect` / `useLayoutEffect`
   - Happens once

3. **Side effects MUST go in effects, not render**
   - Analytics
   - Subscriptions
   - DOM measurements
   - Network requests

4. **React can pause/abort render work**
   - Concurrent Mode behavior
   - Your component might run 3 times, but only commit once

5. **Strict Mode helps catch violations**
   - Double-renders in development
   - Exposes impure logic early

---

Next: [Chapter 3: Reconciliation and the Fiber Tree](#)
