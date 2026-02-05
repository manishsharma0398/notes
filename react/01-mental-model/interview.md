# Chapter 1 Interview Questions

## Q1: Explain the difference between `React.createElement` and the actual DOM node.

**Answer:**
`createElement` returns a plain JavaScript object (React Element) that _describes_ the UI. It has no methods, no real link to the screen, and is extremely cheap to create.
The DOM node is the heavy platform object created by the Renderer (ReactDOM) during the Commit phase, based on the Fiber's instructions.

## Q2: If I write `const App = () => { return MyComponent() }` instead of `<MyComponent />`, what breaks?

**Answer:**
**Hooks break.**

- When you write `<MyComponent />`, React creates a specific **Fiber** for that component. This Fiber holds the linked list of hooks (state, effects).
- When you call `MyComponent()`, it runs in the _parent's_ Fiber.
- If `MyComponent` and `Parent` both have hooks, the hook order indices will clash/overflow, leading to an "Invalid Hook Call" or state corruption.
- Also, performance dies because `MyComponent` isn't memoizable separately.

## Q3: Why does React need the "Fiber" layer? Why not just diff the new Elements against the real DOM?

**Answer:**

1.  **Read/Write capability**: Reading from the actual DOM is slow (layout thrashing). React keeps its own internal tree (Fiber) to read state instantly.
2.  **Scheduling/Prioritization**: You can't "pause" a DOM update halfway through. You CAN pause working on a Fiber tree.
3.  **Portability**: Fibers are platform-agnostic. The DOM is not.

## Q4 (Trap): "Does a re-render mean the DOM updates?"

**Answer:**
No.

- **Re-render**: React calling the function and diffing the result.
- **Commit**: React actually touching the DOM.
- React often renders, sees no changes, and touches nothing (Bailout).
