// Sloppy top level.
// ─────────────────────────────────────────────────────────────
// 04 — Category 3: syntax that is simply not in the strict dialect.
// These are SyntaxErrors, which means they are rejected at PARSE time —
// before a single line runs. That is a different failure mode from
// everything in 02 and 03, and it matters for how you find them.
//
// Run: node 04_removed_syntax.js
// ─────────────────────────────────────────────────────────────

function inSloppy(src) {
  try {
    // eslint-disable-next-line no-eval
    return "allowed -> " + String(eval(src));
  } catch (e) {
    return e.constructor.name + ": " + e.message.split("\n")[0];
  }
}

function inStrict(src) {
  "use strict";
  try {
    // eval inherits the strictness of the code that called it
    // eslint-disable-next-line no-eval
    return "allowed -> " + String(eval(src));
  } catch (e) {
    return e.constructor.name;
  }
}

const cases = [
  ["legacy octal literal", "010"],
  ["octal escape in a string", "'\\101'"],
  ["with (obj) { }", "with ({ a: 1 }) { a }"],
  ["delete an unqualified name", "var v = 1; delete v"],
  ["duplicate parameter names", "(function (x, x) { return x; })(1, 2)"],
  ["`private` as an identifier", "var private = 1; private"],
  ["`interface` as an identifier", "var interface = 1; interface"],
  ["`package` as an identifier", "var package = 1; package"],
  ["assigning to `eval`", "var eval = 1; eval"],
  ["assigning to `arguments`", "(function () { arguments = 1; return arguments; })()"],
];

console.log("  case                              sloppy                     strict");
console.log("  " + "-".repeat(84));
for (const [label, src] of cases) {
  console.log(`  ${label.padEnd(33)} ${inSloppy(src).padEnd(26)} ${inStrict(src)}`);
}

console.log(`

  Why each one was removed — none of these is arbitrary tidying:

    with            makes every identifier in its body unresolvable until
                    runtime, because the object's properties can change. It
                    defeats every static analysis, including the engine's own
                    scope resolution. It is the single biggest reason a sloppy
                    function is harder to optimise.

    legacy octal    "010" meaning 8 is a trap inherited from C. Every reader who
                    has not memorised it reads ten. Modern code writes 0o10,
                    which is explicit and is legal in BOTH dialects.

    delete v        deleting a variable binding (as opposed to an object
                    property) is meaningless in a lexically scoped language —
                    bindings are not properties of anything you can delete.

    duplicate args  function (x, x) silently made the second win. There is no
                    reading of that which is what the author meant.

    reserved words  implements, interface, let, package, private, protected,
                    public, static, yield. Reserved in 2009 for a future
                    version. Most were never used, but they cannot be released
                    now without breaking the strict code written since.

    eval/arguments  assigning to them makes the two most special names in the
                    language mean something else locally, which is exactly the
                    kind of thing static analysis cannot see through.
`);

console.log("=== The function-in-a-block difference, which is subtler ===\n");

console.log("  SLOPPY:");
console.log("    typeof f BEFORE the block:", typeof f);
{
  // eslint-disable-next-line no-inner-declarations
  function f() {
    return "from block";
  }
}
console.log("    typeof f AFTER  the block:", typeof f, " <- Annex B hoisted the binding to function scope");

(function () {
  "use strict";
  console.log("\n  STRICT:");
  {
    function g() {
      return "from block";
    }
    console.log("    typeof g INSIDE the block:", typeof g);
  }
  console.log("    typeof g AFTER  the block:", typeof g, " <- block-scoped. gone.");
})();

console.log(`
  In sloppy mode a function declaration in a block gets "Annex B" web-compat
  semantics: the binding is also created in the enclosing function scope, so it
  escapes the block. In strict mode a block is a real scope and the declaration
  stays in it — the behaviour everyone already assumed they had.

  This one is worth knowing because it is a SILENT behavioural difference, not
  an error. The same file moved into a module (Ch20) changes what this code does
  with no diagnostic anywhere.
`);

console.log("=== And eval stops leaking bindings ===\n");

function sloppyEval() {
  eval("var sneaky = 7");
  return typeof sneaky;
}
console.log("  sloppy: eval('var sneaky = 7') then typeof sneaky ->", sloppyEval(), " <- it leaked into the function");

(function () {
  "use strict";
  function strictEval() {
    eval("var sneaky = 7");
    return typeof sneaky;
  }
  console.log("  strict: same code                              ->", strictEval(), " <- eval got its own scope");
})();

console.log(`
  Sloppy 'eval' can introduce a new variable into the scope that called it,
  which means the engine cannot know a function's set of bindings by reading it.
  Strict 'eval' runs in its own scope, so the call site's bindings are fixed at
  parse time. Together with removing 'with', that is what makes a strict
  function statically analysable — and it is the honest answer to "is strict
  mode faster?": it removed the two constructs that made scope resolution
  undecidable, which mattered a great deal in 2009 and much less now that
  engines optimise both paths well.
`);
