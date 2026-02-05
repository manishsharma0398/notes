# Chapter 1 Revision: The Mental Model

## The Big Idea

React separates **Description** (cheap) from **Work** (expensive).

## 1. The Three Layers

| Layer              | Analogy      | Technical Name | Mutable? |
| :----------------- | :----------- | :------------- | :------- |
| **Description**    | Menu Item    | `ReactElement` | No       |
| **Work Container** | Order Ticket | `Fiber`        | **Yes**  |
| **Outcome**        | Valid Meal   | `HostInstance` | Yes      |

## 2. Key Takeaways

- **JSX is not the DOM**. It's a function call that creates a plain object.
- **Rendering != Updating DOM**. Rendering is just calling your function to get the **Description**.
- **Fiber is the source of truth**. React trusts the Fiber tree, not the DOM.

## 3. Production Failure Modes

- **Thinking UI is instantaneous**: Leads to race conditions. React is asynchronous/batched by default (mostly).
- **Mutating Props**: Elements are immutable. If you mutate them, React won't know.
- **Calling Components as Functions**: `App()` vs `<App />`.
  - `<App />` tells React "Create a Fiber for this".
  - `App()` just runs the code _inside_ the current Fiber. **Breaks Hooks**.
