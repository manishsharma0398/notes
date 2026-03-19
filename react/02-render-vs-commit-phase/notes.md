# Render vs Commit Phase - Quick Notes

## Two Phases

### Render Phase (Interruptible, Pure)

- Calls component functions
- Builds/updates fiber tree
- Computes diffs, marks changes
- **Can pause, abort, restart**
- **No side effects**
- Runs: `useState`, `useMemo`, `useCallback`, component body

### Commit Phase (Synchronous, Uninterruptible)

- Applies DOM mutations (atomic)
- Runs `useLayoutEffect` (before paint)
- Browser paints
- Runs `useEffect` (after paint, async)
- Updates refs (`ref.current`)

## Critical Rules

1. **Component re-render ≠ DOM update**
   - Render phase calculates changes
   - Commit only happens if output different

2. **Component can run multiple times per update**
   - Concurrent Mode: renders may be abandoned
   - Only final render gets committed

3. **Side effects → Effects only**

   ```
   ❌ Render phase: analytics, fetch, DOM mutations
   ✅ Effects: useEffect, useLayoutEffect
   ```

4. **Render phase must be pure**
   - Idempotent (same input → same output)
   - No side effects
   - Safe to call multiple times

## Common Mistakes

```js
// ❌ Side effect in render
function Bad({ userId }) {
  analytics.track("view", userId); // Sent 3x in Concurrent Mode!
  return <div>{userId}</div>;
}

// ✅ Side effect in effect
function Good({ userId }) {
  useEffect(() => {
    analytics.track("view", userId); // Sent 1x
  }, [userId]);
  return <div>{userId}</div>;
}
```

## Timeline

```
setState → Render Phase → Commit Phase → Paint → useEffect
             (pure)        (DOM updates)  (visible) (async)
```

## Strict Mode (Development)

- Intentionally double-calls components in render phase
- Exposes impure logic
- `Render → Render → Commit → Effect → Cleanup → Effect`

## When to Use Which Effect

- **useLayoutEffect**: Read/write layout (scroll position, measurements) before paint
- **useEffect**: Everything else (fetch, subscriptions, analytics)

## Why Two Phases Exist

- **Interruptible render**: Pause for urgent updates, enable Concurrent Mode
- **Atomic commit**: DOM always consistent, no partial UI states visible
