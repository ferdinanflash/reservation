#!/usr/bin/env node
/**
 * 3475 static change reviewer. Run against a base/head Git diff.
 * Heuristic guardrails only; this is not an AI review or a substitute for human review.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const root = process.cwd();
const base = process.env.REVIEW_BASE || process.env.GITHUB_BASE_REF || "";
const head = process.env.REVIEW_HEAD || "HEAD";
const reportPath = process.env.REVIEW_REPORT || "code-review-report.md";

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function changedFiles() {
  if (base) {
    try {
      git(["fetch", "origin", base, "--depth=1"]);
      return git(["diff", "--name-only", "--diff-filter=ACMR", `origin/${base}...${head}`]).split("\n").filter(Boolean);
    } catch (error) {
      console.error("Could not compare with base branch:", error.message);
      process.exitCode = 2;
      return [];
    }
  }
  try {
    return git(["diff", "--name-only", "--diff-filter=ACMR", "HEAD^", head]).split("\n").filter(Boolean);
  } catch {
    return git(["ls-files"]).split("\n").filter(Boolean);
  }
}

const findings = [];
const add = (severity, file, message) => findings.push({ severity, file, message });

const sourceExtensions = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".html", ".css", ".sql"]);
const secretPatterns = [
  { name: "private-key block", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "GitHub personal access token", regex: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { name: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Slack token", regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { name: "service-role JWT literal", regex: /(?:service_role|SUPABASE_SERVICE_ROLE_KEY)[\s\S]{0,100}?eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\./i }
];

const files = changedFiles();
for (const file of files) {
  if (!existsSync(resolve(root, file))) continue;
  const ext = extname(file).toLowerCase();
  if (!sourceExtensions.has(ext)) continue;
  const text = readFileSync(resolve(root, file), "utf8");

  if (!file.startsWith("docs/") && !file.includes("/test/") && !file.startsWith("test/")) {
    for (const pattern of secretPatterns) {
      if (pattern.regex.test(text)) add("BLOCKER", file, `Possible exposed credential: ${pattern.name}. Rotate/revoke if genuine.`);
    }
    if (/\bservice_role\b/i.test(text) && /^(?:index\.html|common\.js|lang\.js|style\.css|js\/)/.test(file)) {
      add("HIGH", file, "Frontend source references service_role. Confirm no privileged key or privileged token is shipped to browsers.");
    }
    if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(text)) {
      add("HIGH", file, "Dynamic code execution detected (eval/new Function); verify necessity and untrusted-input boundaries.");
    }
  }

  if (ext === ".js" || ext === ".mjs" || ext === ".cjs") {
    try {
      execFileSync(process.execPath, ["--check", resolve(root, file)], { cwd: root, stdio: "pipe" });
    } catch (error) {
      add("BLOCKER", file, "JavaScript syntax check failed.");
    }
  }
}

// Validate local script references in the main HTML shell when it changed.
if (files.includes("index.html") && existsSync(resolve(root, "index.html"))) {
  const html = readFileSync(resolve(root, "index.html"), "utf8");
  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    const src = match[1].split("?")[0];
    if (/^(?:https?:)?\/\//i.test(src) || src.startsWith("data:")) continue;
    const local = resolve(root, src.replace(/^\.\//, ""));
    if (!existsSync(local)) add("BLOCKER", "index.html", `Local script reference does not exist: ${src}`);
  }
}

const counts = ["BLOCKER", "HIGH", "MEDIUM"].map(level => [level, findings.filter(f => f.severity === level).length]);
const lines = [
  "# 3475 Static Change Review",
  "",
  `- Reviewed files: ${files.length}`,
  `- Base: ${base || "(local fallback)"}`,
  `- Head: ${head}`,
  "- Scope: deterministic static checks; not an AI code review",
  "",
  "## Findings",
  "",
  ...(findings.length ? findings.map(f => `- **${f.severity}** — \`${f.file}\`: ${f.message}`) : ["No findings from the configured static checks."]),
  "",
  "## Summary",
  "",
  ...counts.map(([level, count]) => `- ${level}: ${count}`),
  "",
  "Human review is still required for authorization logic, RLS, runtime behavior, data migrations, accessibility, and product correctness."
];
writeFileSync(resolve(root, reportPath), lines.join("\n") + "\n");
console.log(lines.join("\n"));
if (findings.some(f => f.severity === "BLOCKER")) process.exitCode = 1;
