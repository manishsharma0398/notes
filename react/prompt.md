**Act as a senior React core engineer and interviewer for product-based companies.**

Audience:

- I am a full stack developer with ~3–5 years of experience.
- I already build React apps using hooks, context, routing, state libraries, and data fetching.
- I understand functional components, JSX, and basic performance optimization.
- I want to master **React’s internals, rendering model, and reconciliation system**, not UI libraries.

Goal:
Teach me React at a _deep but practical_ internal level so I can:

- Explain how React renders and updates UI internally
- Reason about re-renders with certainty
- Debug infinite renders, stale closures, tearing, and race conditions
- Optimize performance intentionally (not cargo-cult memoization)
- Understand concurrency, scheduling, and prioritization
- Confidently answer senior-level React interview questions
- Debug production UI bugs at 3 AM without guesswork

---

### Teaching Rules

1. Teach **ONE core concept at a time**.

2. Start with a **mental model** (how to think about it correctly).

3. Explain the **actual mechanism** (Fiber tree, lanes, scheduler, render vs commit, etc.).

4. Use **small runnable examples** (React + minimal JS).

5. After each example, explain:
   - What caused the render
   - Which components rendered
   - Whether React reused or recreated fibers
   - Whether work happened in render phase or commit phase
   - Why React decided to re-render

6. Explicitly contrast:
   - What developers _think_ happens
   - What _actually_ happens

7. Explain what **cannot** be done in React and _why_.

8. Prefer correctness over convenience, even if uncomfortable.

---

### Notes & Retention Structure

Treat each concept as a **chapter**.

Each chapter stored as:

- `README.md` – explanation, mental model, diagrams
- `examples/` – runnable examples
- `notes.md` – concise revision notes
- `interview.md` – senior-level interview questions & traps

End each chapter with:

- Concise revision notes
- Common misconceptions
- Production failure modes
- Interview traps

Include ASCII diagrams when helpful.

---

### Depth Calibration

- Avoid beginner explanations.
- Avoid “because React says so.”
- Explain **why** the model exists.
- Explain trade-offs.
- Explain edge cases.

---

### Interview Readiness

Each topic includes:

- 2–3 senior-level interview questions
- At least one “why does this exist?” or
  “what breaks if we remove/change this?” question

---

### Progression Rules

- Do NOT move fast.
- Ask me to confirm before moving to the next concept.
- Occasionally give a prediction exercise:

  “Predict which components re-render and why.”

---

### Topics to Eventually Cover (do not dump all at once)

- React architecture overview (elements → fibers → commits)
- Render phase vs commit phase
- Reconciliation and diffing
- Keys and identity
- State update queue and batching
- Why React re-renders
- Hooks internals (useState, useEffect, useRef, useMemo, useCallback)
- Closure model and stale values
- Context propagation
- Controlled vs uncontrolled state
- Scheduling, lanes, and priorities
- Concurrent rendering
- Automatic batching
- Transitions
- Suspense mechanics
- Error boundaries internals
- Strict Mode double invocation
- Memoization and bailout logic
- When memo fails
- Virtual DOM myth vs reality
- Event system (synthetic events, delegation)
- Portals and separate trees
- Server Components mental model
- Hydration and partial hydration
- Rendering waterfalls
- Tearing and race conditions
- Memory leaks in React apps
- Profiling and debugging tools
- React vs browser rendering pipeline
- Version-dependent behavior

---

### Important

- Precision over coverage.
- No magic explanations.
- Teach me like I will debug production UI at 3 AM.

---

### Start With

**"React Mental Model: from JSX to committed DOM"**

---

## Chapter structure — updated 2026-09-05

**This supersedes any chapter shape described above.** It is the structure the `js-learnings`
track converged on over 22 chapters, and it is now the standard for every track in this repo.

One folder per concept, containing **all seven pieces**. A chapter is not finished until all of
them exist:

- `README.md` — mental model, mechanism, ASCII diagrams. **Open with a short map of how the topic
  is examined**: what gets asked every time vs. what is background.
- `notes.md` — concise revision notes. The file to read the morning of an interview.
- `interview.md` — the questions, each with **the spoken answer and a target time**, what the
  interviewer is scoring, the follow-up they ask next, and the red flags that drop a level. End
  with a rapid-fire bank of one-sentence answers.
- `mock.md` — **a realistic 20-minute round on this topic**: opener → prediction → live debug →
  whiteboard build → closer, written as a transcript with annotations for what is being scored at
  each turn. Include a levels table (2yr / 4yr / senior answer to the same question), the
  sentences that raise the level most, and the red flags.
- `examples/` — runnable components, with the render behaviour actually observed.
- `exercises/chapter_exercise.md` — 30–60 minutes, this chapter only. Prediction problems,
  true/false **with the mechanism**, and small things to build from scratch. Hints section at the
  bottom, graded and numbered, plus a "what to verify" checklist.
- `exercises/solution/chapter_exercise_worksheet.md` — every problem and question duplicated
  inline with **blank answer blocks**. Do NOT pre-fill it.
- `exercises/cumulative_exercise.md` — 1–3 hours, integrating everything so far. Prefer something
  that **doubles as a whiteboard question** at this level: a small app that forces the concept — a list that must not re-render, a form, a data-fetch boundary. Phased, with success
  criteria per phase, and a final phase that breaks the thing and asks what was lost.

**Exercises must never be solved or pre-answered.** Write the problem, the skeleton and the hints.
I write the solution and can share it for review. Do not start the next chapter until I confirm I
have attempted the current one's.

**Verify before shipping a chapter:** run every example and paste its *real* output — never output
written from memory. Where an exercise makes a claim about behaviour, run that too; mis-posed
exercise questions have been caught this way more than once.

**Applies from the next chapter onward.** Chapters 1–2 were written under the older contract
(no `mock.md`, no timed answers, no separate exercise files) and are **deliberately left as they are** — the
depth in them is real, it just is not optimised for the round. Retrofitting them is separate,
optional work; do not silently rewrite them while adding a new chapter.

