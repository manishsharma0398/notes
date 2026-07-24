const REGEX_VAR_DECL = /\bvar\s+([A-Za-z_$][\w$]*)\s*=\s*.+?(?=;|\n|$)/gm;

const REGEX_VAR_FUNCTION_DECL =
  /\bvar\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\b/gm;

const REGEX_LET_CONST_DECL =
  /(?:let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*.+?(?=;|\n|$)/gm;

const REGEX_FUNCTION_EXPR = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/gm;

function getNames(source, regex) {
  return [...source.matchAll(regex)].map((match) => match[1]);
}

function scanDeclarations(source) {
  const result = {
    vars: [],
    functionDeclarations: [],
    letConst: [],
    functionExpressions: [],
  };

  // Detect `var <name>` patterns
  result.vars = getNames(source, REGEX_VAR_DECL);

  // Detect `let <name>` and `const <name>` patterns
  result.letConst = getNames(source, REGEX_LET_CONST_DECL);

  // Detect `function <name>(` patterns
  result.functionDeclarations = getNames(source, REGEX_FUNCTION_EXPR);

  // Detect `var <name> = function` patterns
  result.functionExpressions = getNames(source, REGEX_VAR_FUNCTION_DECL);

  return result;
}

function sanitizeNames(names) {
  names = names.map((name) => `'${name}'`);

  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;

  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

function printReport(declarations) {
  console.log("=== DECLARATION SCAN (Compile Phase Simulation) ===");
  if (declarations.vars.length > 0) {
    console.log("var declarations:    ", declarations.vars.join(", "));
  }
  if (declarations.functionDeclarations.length > 0) {
    console.log(
      "function decls:      ",
      declarations.functionDeclarations.join(", "),
    );
  }
  if (declarations.letConst.length > 0) {
    console.log("let/const:           ", declarations.letConst.join(", "));
  }
  if (declarations.functionExpressions.length > 0) {
    console.log(
      "function exprs:      ",
      declarations.functionExpressions.join(", "),
    );
  }

  console.log("\nHoisting note:");
  if (declarations.vars.length > 0) {
    console.log(
      sanitizeNames(declarations.vars),
      " will be initialized to undefined",
    );
  }
  if (declarations.functionDeclarations.length > 0) {
    console.log(
      sanitizeNames(declarations.functionDeclarations),
      " will be fully available before execution",
    );
  }
  if (declarations.letConst.length > 0) {
    console.log(
      sanitizeNames(declarations.letConst),
      " will be in TDZ until its declaration line",
    );
  }
}

const main = () => {
  const args = process.argv.slice(2);

  const data = scanDeclarations(code);

  printReport(data);
};

main();
