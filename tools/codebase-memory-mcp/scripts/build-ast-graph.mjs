import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { analyzeSource, resolveRelativeImport } from "../src/ast-analysis.mjs";

const ROOT = path.resolve(process.env.CODEBASE_ROOT || path.resolve(process.cwd(), "../.."));
const MAP = "docs/codebase-memory/generated/ast-dependency-graph.json";
const CODE = /\.(?:js|jsx|mjs|cjs|ts|tsx)$/i;
const SKIP = /^(?:tools\/codebase-memory-mcp\/|node_modules\/|\.github\/)/;
const sha = value => createHash("sha256").update(value).digest("hex");
let files;
try {
  files = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean);
} catch {
  throw new Error("AST graph generation requires a Git checkout with tracked files.");
}
files = files.filter(file => CODE.test(file) && !SKIP.test(file)).sort();
const known = new Set(files);
const parsed = [];
for (const file of files) {
  const source = await readFile(path.join(ROOT, file), "utf8");
  parsed.push(analyzeSource(file, source));
}
const definitions = parsed.flatMap(item => item.functions);
const byName = new Map();
for (const item of definitions) {
  if (!byName.has(item.name)) byName.set(item.name, []);
  byName.get(item.name).push(item);
}
const edges = [];
for (const item of parsed) {
  for (const imp of item.imports) {
    const resolved = resolveRelativeImport(item.file, imp.specifier, known);
    edges.push({ from: item.file, to: resolved, kind: "import", specifier: imp.specifier, line: imp.line, confidence: resolved ? "static" : "unresolved" });
  }
  for (const call of item.rawCalls) {
    const sameFile = definitions.filter(def => def.file === item.file && def.name === call.name);
    const candidates = sameFile.length ? sameFile : (byName.get(call.name) || []);
    const uniqueTargets = [...new Map(candidates.map(target => [target.id, target])).values()];
    for (const target of uniqueTargets) {
      edges.push({ from: call.caller, to: target.id, kind: "call", line: call.line, confidence: sameFile.length || uniqueTargets.length === 1 ? "static-name-match" : "candidate-name-match" });
    }
  }
}
const integrations = parsed.flatMap(item => item.integrations);
const diagnostics = parsed.flatMap(item => item.diagnostics.map(d => ({ file: item.file, ...d })));
const graph = {
  schema_version: 1,
  generated_mode: "typescript-compiler-ast-static-analysis",
  note: "Static analysis only. Dynamic dispatch, computed names, runtime injection, framework behavior and indirect API URLs may not be resolved. Cross-file classic-script matches are candidates unless the symbol is unique.",
  source_files: files.length,
  function_count: definitions.length,
  import_count: edges.filter(e => e.kind === "import").length,
  call_edge_count: edges.filter(e => e.kind === "call").length,
  edges: edges.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  functions: definitions.sort((a,b) => a.id.localeCompare(b.id)),
  integrations: integrations.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  parse_diagnostics: diagnostics.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  source_digest: sha(parsed.map(p => p.file + ":" + sha(JSON.stringify(p))).join("\n"))
};
await writeFile(path.join(ROOT, MAP), JSON.stringify(graph, null, 2) + "\n");
process.stdout.write(JSON.stringify({ map: MAP, source_files: files.length, functions: definitions.length, import_edges: graph.import_count, call_edges: graph.call_edge_count, integrations: integrations.length, parse_diagnostics: diagnostics.length, digest: graph.source_digest }) + "\n");
