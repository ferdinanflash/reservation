#!/usr/bin/env node
/**
 * Structural contract checks for the 3475 browser application.
 * Translation gaps are reported without failing by default because legacy
 * dictionaries may intentionally omit keys and fall back to English.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(process.cwd(), "../..");
const findings = [];
const report = (level, message) => findings.push({ level, message });

const languageFile = resolve(root, "lang.js");
if (!existsSync(languageFile)) {
  report("BLOCKER", "lang.js is missing.");
} else {
  const source = readFileSync(languageFile, "utf8");
  const ast = ts.createSourceFile("lang.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const diagnostics = ast.parseDiagnostics;
  if (diagnostics.length) {
    for (const diagnostic of diagnostics) report("BLOCKER", `lang.js parse error: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`);
  } else {
    let dictionaries = null;
    const visit = node => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "TRANSLATIONS" && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
        dictionaries = node.initializer;
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
    if (!dictionaries) {
      report("BLOCKER", "Could not locate TRANSLATIONS object in lang.js.");
    } else {
      const getName = property => {
        if (ts.isPropertyAssignment(property)) {
          if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) return property.name.text;
        }
        return null;
      };
      const languages = new Map();
      for (const property of dictionaries.properties) {
        const language = getName(property);
        if (!language || !ts.isPropertyAssignment(property) || !ts.isObjectLiteralExpression(property.initializer)) continue;
        const keys = new Set(property.initializer.properties.map(getName).filter(Boolean));
        languages.set(language, keys);
      }
      // RU and FR are layered on top of EN using TRANSLATIONS.xx = Object.assign(...).
      // Merge those assignments and later Object.assign patches into their key sets.
      const propertyPath = expression => ts.isPropertyAccessExpression(expression)
        && ts.isIdentifier(expression.expression)
        && expression.expression.text === "TRANSLATIONS"
        ? expression.name.text : null;
      const objectKeys = object => ts.isObjectLiteralExpression(object)
        ? object.properties.map(getName).filter(Boolean) : [];
      const mergeObject = (target, object) => {
        if (!languages.has(target)) languages.set(target, new Set(languages.get("en") || []));
        for (const key of objectKeys(object)) languages.get(target).add(key);
      };
      const mergeVisitor = node => {
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
          const target = propertyPath(node.left);
          if (target && ["ru", "fr"].includes(target) && ts.isCallExpression(node.right)) {
            const args = node.right.arguments;
            if (args.some(arg => ts.isPropertyAccessExpression(arg) && propertyPath(arg) === "en")) {
              languages.set(target, new Set(languages.get("en") || []));
            }
            for (const arg of args) mergeObject(target, arg);
          }
        }
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
          && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "Object"
          && node.expression.name.text === "assign" && node.arguments.length > 1) {
          const target = propertyPath(node.arguments[0]);
          if (target && ["ru", "fr"].includes(target)) {
            for (const arg of node.arguments.slice(1)) mergeObject(target, arg);
          }
        }
        ts.forEachChild(node, mergeVisitor);
      };
      mergeVisitor(ast);

      const expected = ["en", "id", "cn", "ph", "th", "it", "ru", "fr"];
      for (const language of expected) {
        if (!languages.has(language)) report("BLOCKER", `Missing language dictionary: ${language}`);
      }
      const english = languages.get("en");
      if (english) {
        for (const language of expected.filter(code => code !== "en" && languages.has(code))) {
          const missing = [...english].filter(key => !languages.get(language).has(key)).sort();
          if (missing.length) report("WARN", `${language}: ${missing.length} keys missing vs EN (fallback may apply): ${missing.slice(0, 12).join(", ")}${missing.length > 12 ? ", …" : ""}`);
          else report("PASS", `${language}: all ${english.size} EN keys are present.`);
        }
      }
    }
  }
}

const htmlFile = resolve(root, "index.html");
if (!existsSync(htmlFile)) {
  report("BLOCKER", "index.html is missing.");
} else {
  const html = readFileSync(htmlFile, "utf8");
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(match => match[1].split("?")[0]);
  for (const src of scripts) {
    if (/^(?:https?:)?\/\//i.test(src) || src.startsWith("data:")) continue;
    const target = resolve(root, src.replace(/^\.\//, ""));
    if (!existsSync(target)) report("BLOCKER", `index.html references missing local script: ${src}`);
  }
  const positions = ["common.js", "lang.js", "js/app-core.js"].map(name => scripts.indexOf(name));
  if (positions.some(position => position < 0)) report("BLOCKER", "Required classic scripts common.js, lang.js and js/app-core.js must all be loaded.");
  else if (!(positions[0] < positions[1] && positions[1] < positions[2])) report("BLOCKER", "Classic script order must be common.js → lang.js → js/app-core.js.");
  else report("PASS", "Critical classic-script load order is correct.");
}

const summary = [
  "# 3475 Project Contract Check",
  "",
  `- Findings: ${findings.length}`,
  "",
  ...(findings.length ? findings.map(item => `- **${item.level}** — ${item.message}`) : ["No structural findings."]),
  "",
  "Translation omissions are warnings because runtime fallback behavior may supply English. Review all warnings before release."
].join("\n") + "\n";
console.log(summary);
if (process.env.STRICT_TRANSLATIONS === "1" && findings.some(item => item.level === "WARN")) process.exitCode = 1;
if (findings.some(item => item.level === "BLOCKER")) process.exitCode = 1;
