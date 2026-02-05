# Chapter 1: The React Mental Model - From JSX to Committed DOM

> **Goal**: Understand what React _actually_ does when you write `<div />`.  
> **Anti-Pattern**: Thinking JSX "is" the DOM.  
> **Mental Model**: The Menu (Description) vs The Ticket (Tracking) vs The Meal (UI).

---

## 1. The Separation of Concerns

Most developers mentally collapse React into one step:
`JSX -> Scary Magic -> DOM`

To master React, you must separate it into three distinct layers:

1.  **React Element (The Description)**
    - What you want (JSX).
    - Cheap, immutable, plain JavaScript objects.
    - Like a line item on a menu: _"Burger, no onions"_.
    - **Developer's Domain**.

2.  **Fiber (The Internals)**
    - What React is currently tracking.
    - Mutable, heavy data structure.
    - Like the kitchen's active order ticket. It tracks state, side effects, and relationships.
    - **React's Domain**.

3.  **Host Instance (The Result)**
    - The actual thing on screen (DOM Node, iOS View).
    - Expensive to create and touch.
    - Like the actual burger on the plate.
    - **Browser's Domain**.

---

## 2. The Lifecycle of a "Render"

When you write:

```jsx
// 1. You write JSX
const element = <h1 className="title">Hello</h1>;
```

### Phase 1: The Compiler (Babel/SWC)

Your JSX is stripped away _before_ it hits the browser. It becomes a function call.
`React.createElement("h1", { className: "title" }, "Hello")`

### Phase 2: Execution (Render Phase)

React calls your component function. It returns a **React Element**.
This is just a plain object!

```js
{
  type: 'h1',
  props: { className: 'title', children: 'Hello' },
  key: null,
  ref: null,
  // ...
}
```

**Crucial Insight**: Creating this object costs _almost nothing_. You can create millions of them per second. It is NOT a DOM node.

### Phase 3: Reconciliation (Render Phase)

React compares this new object (The logic) with the **Fiber tree** (The current state of the world).

- "Last time, there was nothing here. Now there is an H1."
- "Okay, I need to create a new Fiber for this H1."
- "And I'll mark it with a 'Placement' flag (EffectTag)."

### Phase 4: Commit (Commit Phase)

React takes the list of effects (what changed) and applies them to the host (DOM).
`document.createElement('h1')` is finally called here.

---

## 3. The "Ordering Dinner" Analogy

1.  **Function Component**: The **Chef**. They know how to make the dish.
2.  **JSX**: The **Customer's Order**. "I want a Burger".
3.  **React (Reconciler)**: The **Waiter**.
    - Waiter takes the order (Element).
    - Waiter checks the table (Fiber). "They already have a Burger, they just want extra fries?" OR "New table, full setup needed?"
    - Waiter decides the absolute minimum work needed.
4.  **ReactDOM (Renderer)**: The **Line Cook**. They actually chop the vegetables and put the food on the plate (Update the DOM).

**Why this matters**:
Developers often think they are the Line Cook. They try to "force" the DOM to update.
In React, you are _only_ the Customer. You just describe what you want. You never touch the kitchen.

---

## 4. Key Contrast

| Developer Thinking                                   | Reality                                                                        |
| :--------------------------------------------------- | :----------------------------------------------------------------------------- |
| "I updated the component state, so the DOM changed." | "I scheduled an update. React will decide _when_ and _if_ to call me back."    |
| "This component re-rendered."                        | "The function ran again and returned a new description object."                |
| `<Child />` is a component instance.                 | `<Child />` is a `createElement` call. It's just an object describing a child. |

---

## 5. Production Implication: The "Value UI"

Because JSX is just data, you can pass it around like any other variable.

```jsx
// This does NOT render anything yet!
const dangerousUI = <div className="bomb">BOOM</div>;

// This logs a plain object
console.log(dangerousUI);

// React only cares when you RETURN it from a component rooted in the tree.
```

If you understand that **UI is a Value**, patterns like "Render Props" and "Slots" become obvious. They are just passing data.

---

## 6. Runnable Example (Mental Model)

Run the example in `examples/01-element-vs-dom.js` to see the difference between an Element and a DOM Node.
