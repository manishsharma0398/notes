# Cumulative Exercise — Chapters 1–6: Build a Minimal Reactive Store

## Project Brief

You're building a **lightweight reactive state store** — a simplified version of what powers Redux or Zustand. The store holds application state, allows controlled mutations through actions, and notifies subscribers when state changes.

This is not a toy example. A well-implemented version of this is production-worthy as a state container for any vanilla JavaScript application.

**No frameworks. No libraries. Vanilla JS only.**

---

## What You'll Need From Each Chapter

| Chapter | Concept Applied |
|---|---|
| Ch 1 — Parsing & Execution | Understanding when code runs, declaration order |
| Ch 2 — Execution Contexts | Call stack depth during dispatch, how each method runs |
| Ch 3 — Lexical Scope | Scope chain inside reducers and subscribers |
| Ch 4 — Hoisting | Understanding TDZ traps in your store's initialization |
| Ch 5 — `this` Binding | Methods on the store object — what `this` refers to |
| Ch 6 — Closures | Private state, the subscription list, the ER that survives |

---

## The Interface

Your store must implement this exact interface:

```javascript
const store = createStore(reducer, initialState);

store.getState();          // returns current state (a copy, not the live reference)
store.dispatch(action);    // runs the reducer, updates state, notifies subscribers
store.subscribe(listener); // registers a listener; returns an unsubscribe function
```

### Rules

1. **State is private.** `store.state` must be `undefined` from the outside. State is only accessible via `getState()`.
2. **`getState()` returns a shallow copy.** Callers cannot mutate the store's internal state by modifying what `getState()` returns.
3. **`dispatch(action)` calls the reducer.** The reducer is a pure function: `(currentState, action) => newState`. The store calls it and replaces state with the result.
4. **After every dispatch, all active subscribers are called** with the new state.
5. **`subscribe(listener)` returns an unsubscribe function.** Calling it removes the listener — future dispatches won't notify it.
6. **Listeners that unsubscribe during a dispatch should not be called in that same dispatch cycle.**

---

## Phase 1 — Core Store (Ch 6: Closures, Ch 5: `this`)

Implement `createStore(reducer, initialState)`.

```javascript
function createStore(reducer, initialState) {
  // TODO Phase 1:
  // - Private state variable
  // - Private subscribers list
  // - Implement getState() — returns a shallow copy
  // - Implement dispatch(action) — runs reducer, updates state, notifies subscribers
  // - Implement subscribe(listener) — adds listener, returns unsubscribe fn
  // - Return the public API object
}
```

**Acceptance criteria for Phase 1:**
- `store.getState()` returns correct initial state
- `store.state` is `undefined`
- Dispatching an action updates the state
- Subscribers are called after each dispatch
- Unsubscribe stops future notifications

---

## Phase 2 — Counter Reducer (Ch 3: Scope)

Write a reducer for a simple counter:

```javascript
function counterReducer(state = { count: 0 }, action) {
  switch (action.type) {
    case "INCREMENT": return { count: state.count + (action.by ?? 1) };
    case "DECREMENT": return { count: state.count - (action.by ?? 1) };
    case "RESET":     return { count: 0 };
    default:          return state;
  }
}
```

Wire it up and verify:

```javascript
const store = createStore(counterReducer);

const unsub = store.subscribe((state) => {
  console.log("State changed:", state);
});

store.dispatch({ type: "INCREMENT" });        // State changed: { count: 1 }
store.dispatch({ type: "INCREMENT", by: 5 }); // State changed: { count: 6 }
store.dispatch({ type: "DECREMENT" });        // State changed: { count: 5 }

unsub(); // unsubscribe

store.dispatch({ type: "RESET" }); // no log — subscriber is gone
console.log(store.getState());     // { count: 0 }
```

---

## Phase 3 — Middleware Support (Ch 6: Closures, Ch 5: `this`)

Extend `createStore` to optionally accept a middleware function.

Middleware has the signature:
```javascript
function middleware(store) {
  return function(next) {
    return function(action) {
      // do something before
      next(action); // call the original dispatch
      // do something after
    };
  };
}
```

This is the exact Redux middleware pattern.

```javascript
function createStore(reducer, initialState, middleware) {
  // TODO Phase 3:
  // - If middleware is provided, wrap dispatch with it
  // - The wrapped dispatch replaces the original
  // - middleware receives an object with getState and dispatch
}
```

**Logger middleware (implement this to test Phase 3):**

```javascript
function logger(store) {
  return function(next) {
    return function(action) {
      console.log("Before:", store.getState());
      console.log("Dispatching:", action);
      next(action);
      console.log("After:", store.getState());
    };
  };
}

const store = createStore(counterReducer, undefined, logger);
store.dispatch({ type: "INCREMENT" });
// Before: { count: 0 }
// Dispatching: { type: "INCREMENT" }
// After: { count: 1 }
```

---

## Phase 4 — Edge Cases (Ch 4: Hoisting, Ch 2: EC)

Handle these correctly:

1. **Dispatching during a subscriber callback** — what happens if a subscriber calls `store.dispatch`?

   ```javascript
   store.subscribe((state) => {
     if (state.count === 3) {
       store.dispatch({ type: "RESET" }); // ← dispatching inside a listener
     }
   });
   ```

   Your store should handle this without crashing or entering infinite recursion. Document the behaviour you chose and why.

2. **Late subscriber** — a subscriber added inside a dispatch should not be called in that same dispatch cycle:

   ```javascript
   store.subscribe(() => {
     store.subscribe(() => console.log("late subscriber")); // added during dispatch
   });
   store.dispatch({ type: "INCREMENT" }); // should NOT call "late subscriber"
   store.dispatch({ type: "INCREMENT" }); // SHOULD call "late subscriber"
   ```

3. **`getState()` returns a copy** — mutating the returned object must not affect the store:

   ```javascript
   const state = store.getState();
   state.count = 9999;
   console.log(store.getState().count); // must NOT be 9999
   ```

---

## Success Criteria

- [ ] `store.state` is `undefined` (private)
- [ ] `getState()` returns a shallow copy
- [ ] `dispatch()` updates state and notifies all active subscribers
- [ ] `subscribe()` returns a working unsubscribe function
- [ ] Unsubscribed listeners are not called in future dispatches
- [ ] Phase 3: Logger middleware wraps dispatch correctly
- [ ] Phase 4: No crash when dispatching inside a subscriber
- [ ] Phase 4: Late subscribers are not called in the same dispatch cycle
- [ ] Phase 4: Mutating returned state does not corrupt the store

---

## Notes

- Write everything in a single file `store.js` inside `exercises/solution/`
- You are allowed to write helper functions
- Do NOT use classes — implement using closures and factory functions only
- Do NOT use any global variables outside of `createStore` and `counterReducer`
