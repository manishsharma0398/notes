// "use strict" is redundant here; the interesting part is that you cannot opt OUT.
console.log(0o17, "octal literal is fine");
try { eval("var x = 010;"); } catch (e) { console.log("legacy octal 010 ->", e.constructor.name + ":", e.message); }
try { eval("with ({}) {}"); } catch (e) { console.log("with statement   ->", e.constructor.name + ":", e.message); }
function dup(a) { return a; }
try { eval("function d(a, a) { return a; }"); } catch (e) { console.log("duplicate params ->", e.constructor.name + ":", e.message); }
