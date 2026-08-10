# Cumulative Exercise — Chapters 1–10: `forge`, Building `class` by Hand

**Time estimate:** 2–3 hours
**Concepts integrated:** Execution model, contexts, scope, hoisting, `this`, closures, references, coercion, the object model, and `new`/class internals

---

## Project Brief

You've just learned that `class` is **not** syntactic sugar — seven behaviours differ from the function form.

So prove it. Build `forge()`: a function that takes a plain description and produces a constructor **structurally indistinguishable** from a real `class` declaration. Same two prototype chains. Non-enumerable methods. A working `constructor` back-link. Refuses to be called without `new`. Inherited statics. Working `super`.

Then verify it — not by eye, but by **diffing your output against a real class** with the `introspect` tool you built in Chapter 9.

This is the exercise that converts "I know the seven differences" into "I can reproduce them," and the gap between those two is usually larger than people expect.

**No frameworks. No libraries. And — the point of the whole thing — no `class` keyword inside `forge`.**

---

## What You'll Need From Each Chapter

| Chapter | Concept Applied |
|---|---|
| Ch 1–2 | When each part of your builder executes; the call stack during construction |
| Ch 3 | The scope chain your methods close over |
| Ch 4 | Why a `class` is in the TDZ and your `forge` result isn't — and whether you can fix that |
| Ch 5 | `this` binding in methods, and `new.target` |
| Ch 6 | Closures for private state — the pre-`#` technique |
| Ch 7 | Shared mutable state on a prototype (your `statics` object is one) |
| Ch 8 | `Symbol.toPrimitive` / `Symbol.toStringTag` on forged classes |
| Ch 9 | Descriptors, `defineProperty`, both prototype chains |
| **Ch 10** | **`new`'s four steps, `new.target`, `constructor`, `instanceof`, static inheritance** |

---

## The Target API

```javascript
const Animal = forge("Animal", {
  constructor(name) { this.name = name; },
  methods: {
    speak() { return `${this.name} makes a sound`; },
  },
  statics: {
    kingdom: "Animalia",
    describe() { return `a ${this.name}`; },
  },
});

const Dog = forge("Dog", {
  extends: Animal,
  constructor(name, breed) {
    this.super(name);        // your super() — see Phase 4
    this.breed = breed;
  },
  methods: {
    speak() { return `${this.name} barks`; },
  },
});
```

---

## Phase 1 — The Constructor and Its Prototype

```javascript
function forge(name, spec) {
  // TODO Phase 1:
  // - Build a function that, when called with `new`, runs spec.constructor
  // - Give it the right `name` (hint: it is a configurable, non-writable property)
  // - Create its .prototype object
  // - Put a `constructor` back-link on .prototype — NON-ENUMERABLE, like a real class
  // - Install spec.methods onto .prototype — NON-ENUMERABLE
  // - Install spec.statics onto the constructor itself
}
```

**Acceptance:**

```javascript
const rex = new Animal("Rex");
rex.speak();                                  // "Rex makes a sound"
Object.keys(rex);                             // ["name"]  — methods are NOT here
Object.keys(Animal.prototype);                // []        — non-enumerable
Object.getOwnPropertyDescriptor(Animal.prototype, "speak").enumerable;  // false
Animal.prototype.constructor === Animal;      // true
Animal.name;                                  // "Animal"

const seen = []; for (const k in rex) seen.push(k);
seen;                                         // ["name"] — nothing leaks (Ch 9)
```

That last check is difference #3, and it's the one that's easy to get wrong: a plain `proto.speak = fn` assignment gives you an **enumerable** property and the method leaks into every `for...in`.

---

## Phase 2 — Refuse a Plain Call

```javascript
// TODO Phase 2: make this throw, the way a real class does
Animal("Rex");
// TypeError: Class constructor Animal cannot be invoked without 'new'
```

Use `new.target`, not the `this instanceof` hack — and write a comment explaining, with a concrete example, why the hack is defeatable.

**Acceptance:**

```javascript
try { Animal("Rex"); } catch (e) { e.constructor.name; }  // "TypeError"

// and the hack you did NOT use must be demonstrably broken:
const decoy = Object.create(Animal.prototype);
// show that `Animal.call(decoy, "Rex")` would fool an instanceof-based guard
```

---

## Phase 3 — `extends`: Both Chains

```javascript
// TODO Phase 3:
// - link Child.prototype  →  Parent.prototype    (instance chain)
// - link Child            →  Parent              (STATIC chain)
// - do it at CREATION time, not with setPrototypeOf on a live object (Ch 9)
```

**Acceptance:**

```javascript
const rex = new Dog("Rex", "lab");
rex.speak();                                              // "Rex barks"     — shadows Animal's
rex instanceof Dog;                                       // true
rex instanceof Animal;                                    // true

Object.getPrototypeOf(Dog.prototype) === Animal.prototype; // true — chain 1
Object.getPrototypeOf(Dog) === Animal;                     // true — chain 2

Dog.kingdom;                                              // "Animalia" — static INHERITED
Dog.describe();                                           // "a Dog" — `this` is Dog
```

`Dog.kingdom` is the acceptance test that the ES5 pattern fails. If it's `undefined`, you built only the instance chain.

---

## Phase 4 — `super`

Real `super` uses `[[HomeObject]]`, which you cannot create from userland. So implement the closest honest approximation and **document the difference**.

```javascript
// TODO Phase 4:
// - give constructors a way to call the parent constructor
// - give methods a way to call the parent's version of the same method
// - it must work for a THREE-level chain without infinite recursion
```

**Acceptance — the test that kills the naive implementation:**

```javascript
const A = forge("A", { methods: { who() { return "A"; } } });
const B = forge("B", { extends: A, methods: { who() { return "B←" + this.super("who"); } } });
const C = forge("C", { extends: B, methods: { who() { return "C←" + this.super("who"); } } });

new C().who();   // "C←B←A"   — must NOT hang or return "C←B←B←B←..."
```

**Why the naive version fails.** If your `super` resolves from `this` (`Object.getPrototypeOf(this)`), then when `B.who` runs on a `C` instance, `this` is still the `C` instance — so it finds `B.who` again, forever. Real `super` anchors to **where the method was defined**, not to the receiver.

Fix it by capturing each method's defining prototype in a closure (Ch 6) when you install it. Then write a comment on how your version still differs from `[[HomeObject]]`.

---

## Phase 5 — Prove It

Point Chapter 9's `introspect` at both a forged class and a real one, and **diff them**.

```javascript
class RealAnimal {
  static kingdom = "Animalia";
  constructor(name) { this.name = name; }
  speak() { return `${this.name} makes a sound`; }
}

diff(describeCallable(Animal), describeCallable(RealAnimal));
```

Report on each of these explicitly — matching, or a stated known difference:

| Property | Forged | Real |
|---|---|---|
| method enumerability | | |
| `constructor` back-link + descriptor | | |
| `.prototype` descriptor on the constructor | | |
| refuses a plain call | | |
| both prototype chains | | |
| `fn.name` and its descriptor | | |
| `fn.length` | | |
| `Function.prototype.toString()` output | | |
| TDZ before declaration | | |
| strict mode inside the body | | |

**The last three you cannot reproduce**, and knowing *why* is the real deliverable:

- `toString()` returns your builder's source, not a class definition
- TDZ is a **syntactic** property of `class`/`let` declarations — a function call can't create one
- Strict mode is per-source-text; your methods are only strict if *your file* is

Write those three up as a short "what userland cannot forge" note. That list is the honest answer to "is `class` just sugar?" — everything except those is reproducible, and those three are exactly why the answer is no.

---

## Success Criteria

- [ ] Phase 1: Methods non-enumerable; `for...in` over an instance shows only fields
- [ ] Phase 1: `constructor` back-link present and non-enumerable
- [ ] Phase 1: `Animal.name` is `"Animal"`
- [ ] Phase 2: Plain call throws `TypeError`, using `new.target`
- [ ] Phase 2: You demonstrated why the `instanceof` hack is defeatable
- [ ] Phase 3: Both chains linked, at creation time
- [ ] Phase 3: `Dog.kingdom` inherits
- [ ] Phase 4: Three-level `super` returns `"C←B←A"` and terminates
- [ ] Phase 4: You can state why resolving `super` from `this` recurses
- [ ] Phase 5: Diff table filled in against a real class
- [ ] Phase 5: The three unforgeable behaviours written up with reasons
- [ ] No `class` keyword anywhere inside `forge`

---

## Hints

<details>
<summary>Hints (read only if stuck)</summary>

**Phase 1** — `Object.defineProperty(proto, key, { value: fn, writable: true, enumerable: false, configurable: true })` matches what a class produces. Check a real one with `getOwnPropertyDescriptor` first and copy the flags exactly. For `fn.name`, note it's `configurable: true, writable: false` — so `defineProperty`, not assignment.

**Phase 2** — `if (new.target === undefined) throw new TypeError(...)`. The hack's failure: `Animal.call(Object.create(Animal.prototype), "Rex")` passes an `instanceof` guard while constructing nothing.

**Phase 3** — `Object.create(Parent.prototype)` for the instance chain; `Object.setPrototypeOf(Child, Parent)` for the static chain. The static one is the rare legitimate use of `setPrototypeOf`, because it runs once at creation. Better still: build the constructor so its prototype is right from the start.

**Phase 4** — when installing method `m` on `proto`, close over `proto` itself. Then `super("m")` looks up `Object.getPrototypeOf(capturedProto)[m]` — the *defining* object, not `this`. That closure is your hand-rolled `[[HomeObject]]`.

**Phase 5** — `Object.getOwnPropertyDescriptor(RealClass, "prototype")` is worth a look: on a class it's `writable: false`, on an ordinary function it's `writable: true`. That's an eighth difference the chapter didn't list — find it yourself and add it.

</details>

---

## Notes

- Write everything in `exercises/solution/forge.js`
- No `class` keyword inside `forge` — that's the whole point
- Keep your Phase 5 write-up as comments; it's the main deliverable
- When you're done you'll have built, by hand, the thing the language gives you for free — and you'll know precisely what it's giving you
