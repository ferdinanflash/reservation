import ts from "typescript";
import path from "node:path";

const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

function propertyName(node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  return null;
}
function calledName(expr) {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  if (ts.isElementAccessExpression(expr)) return propertyName(expr.argumentExpression) || null;
  return null;
}
function stringValue(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
}
function functionName(node) {
  if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) return node.name.text;
  if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) return propertyName(node.name);
  if (ts.isConstructorDeclaration(node)) return "constructor";
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    const parent = node.parent;
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
    if (ts.isPropertyAssignment(parent)) return propertyName(parent.name);
    if (ts.isBinaryExpression(parent) && ts.isIdentifier(parent.left)) return parent.left.text;
  }
  return null;
}
function isFunctionLike(node) {
  return ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) || ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node);
}
function visitWithoutNestedFunctions(node, visit) {
  const walk = current => {
    if (current !== node && isFunctionLike(current)) return;
    visit(current);
    ts.forEachChild(current, walk);
  };
  walk(node);
}

export function analyzeSource(filePath, sourceText) {
  const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true,
    /\.tsx?$/.test(filePath) ? ts.ScriptKind.TS : /\.jsx$/.test(filePath) ? ts.ScriptKind.JSX : ts.ScriptKind.JS);
  const functions = [];
  const imports = [];
  const rawCalls = [];
  const integrations = [];
  const declarations = new Map();

  const addFunction = (node, name, kind) => {
    if (!name || !node.body) return;
    const record = { id: filePath + "#" + name, name, file: filePath, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, kind };
    functions.push(record);
    if (!declarations.has(name)) declarations.set(name, []);
    declarations.get(name).push(record);
    visitWithoutNestedFunctions(node, current => {
      if (ts.isCallExpression(current) || ts.isNewExpression(current)) {
        const target = calledName(current.expression);
        if (target) rawCalls.push({ caller: record.id, name: target, line: source.getLineAndCharacterOfPosition(current.getStart(source)).line + 1 });
        const receiver = ts.isPropertyAccessExpression(current.expression) ? current.expression.name.text : null;
        const arg = current.arguments?.[0];
        const value = stringValue(arg);
        if (receiver === "from" && value) integrations.push({ kind: "supabase-table", value, function: record.id, line: source.getLineAndCharacterOfPosition(current.getStart(source)).line + 1 });
        if (receiver === "invoke" && value) integrations.push({ kind: "edge-function", value, function: record.id, line: source.getLineAndCharacterOfPosition(current.getStart(source)).line + 1 });
        if ((target === "fetch" || target === "WebSocket" || target === "EventSource") && value && /^https?:\/\//i.test(value)) integrations.push({ kind: target.toLowerCase(), value, function: record.id, line: source.getLineAndCharacterOfPosition(current.getStart(source)).line + 1 });
      }
    });
  };

  const topLevelId = filePath + "#<top-level>";
  rawCalls.push({ caller: topLevelId, name: null, line: 1 });
  const walk = node => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push({ file: filePath, specifier: node.moduleSpecifier.text, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
    }
    if (ts.isFunctionDeclaration(node)) addFunction(node, functionName(node), "function");
    else if (ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) addFunction(node, functionName(node), "method");
    else if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && functionName(node)) addFunction(node, functionName(node), "function-expression");
    ts.forEachChild(node, walk);
  };
  walk(source);

  // Calls outside named functions are useful entry-point evidence, but do not recurse into function bodies.
  const topCalls = [];
  const visitTop = node => {
    if (isFunctionLike(node)) return;
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const name = calledName(node.expression);
      if (name) topCalls.push({ caller: topLevelId, name, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
      const receiver = ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : null;
      const value = stringValue(node.arguments?.[0]);
      if (receiver === "from" && value) integrations.push({ kind: "supabase-table", value, function: topLevelId, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
      if (receiver === "invoke" && value) integrations.push({ kind: "edge-function", value, function: topLevelId, line: source.getLineAndCharacterPosition?.(node.getStart(source))?.line ?? 1 });
      if (name === "fetch" && value && /^https?:\/\//i.test(value)) integrations.push({ kind: "fetch", value, function: topLevelId, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
    }
    ts.forEachChild(node, visitTop);
  };
  visitTop(source);

  const diagnostics = source.parseDiagnostics.map(d => ({
    line: source.getLineAndCharacterOfPosition(d.start || 0).line + 1,
    message: ts.flattenDiagnosticMessageText(d.messageText, " ")
  }));
  return { file: filePath, functions, imports, rawCalls: [...rawCalls.filter(c => c.name), ...topCalls], integrations, diagnostics };
}

export function resolveRelativeImport(fromFile, specifier, knownFiles) {
  if (!specifier.startsWith(".")) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  const candidates = [base, ...CODE_EXTENSIONS.map(ext => base + ext), ...CODE_EXTENSIONS.map(ext => path.posix.join(base, "index" + ext))];
  return candidates.find(candidate => knownFiles.has(candidate)) || null;
}
