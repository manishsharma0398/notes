import fs from "node:fs/promises";

const REGEX_VAR_DECL = /\bvar\s+([A-Za-z_$][\w$]*)(?:\s*=\s*.+?)?(?=;|\n|$)/gm;

const REGEX_FUNCTION_DECL =
  /\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;

const REGEX_LET_CONST_DECL =
  /(?:let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*.+?(?=;|\n|$)/gm;

// Classic function expressions
const REGEX_FUNCTION_EXPR =
  /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\b/gm;

// Arrow functions
const REGEX_ARROW_FUNCTION =
  /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/gm;

function getNames(source, regex) {
  return [...source.matchAll(regex)].map((match) => match[1]);
}

function stripComments(source) {
  return (
    source
      // block comments
      .replace(/\/\*[\s\S]*?\*\//g, "")
      // line comments
      .replace(/\/\/.*$/gm, "")
  );
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

  // Detect `var/let/const <name> = function` and arrow function patterns
  result.functionExpressions = [
    ...getNames(source, REGEX_FUNCTION_EXPR),
    ...getNames(source, REGEX_ARROW_FUNCTION),
  ];

  // Detect `let <name>` and `const <name>` patterns (exclude function expressions)
  result.letConst = getNames(source, REGEX_LET_CONST_DECL);
  result.letConst = result.letConst.filter(
    (name) => !result.functionExpressions.includes(name),
  );

  // Exclude var-declared function expressions from vars (same as let/const filter above)
  result.vars = result.vars.filter(
    (name) => !result.functionExpressions.includes(name),
  );

  // Detect `function <name>(` declaration patterns
  result.functionDeclarations = getNames(source, REGEX_FUNCTION_DECL);

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
    console.log(`${sanitizeNames(declarations.vars)} will be initialized to undefined`);
  }
  if (declarations.functionDeclarations.length > 0) {
    console.log(`${sanitizeNames(declarations.functionDeclarations)} will be fully available before execution`);
  }
  if (declarations.letConst.length > 0) {
    console.log(`${sanitizeNames(declarations.letConst)} will be in TDZ until its declaration line`);
  }
}

const main = async () => {
  const filePath = process.argv.slice(2)[0];

  try {
    const code = await fs.readFile(filePath, { encoding: "utf-8" });

    // new Function() does not support ES module syntax (import/export).
    // Skip the syntax check if the file uses ESM to avoid false SyntaxErrors.
    const isESM = /\b(?:import|export)\b/.test(code);
    if (!isESM) {
      new Function(code);
    }

    const cleanedCode = stripComments(code);

    const declarations = scanDeclarations(cleanedCode);

    printReport(declarations);
  } catch (error) {
    console.log("\nError detected: \n");
    console.error(error);
  }
};

main();
