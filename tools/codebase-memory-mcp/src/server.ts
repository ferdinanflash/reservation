import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { isExcludedPath, resolveSafePath } from "./security.js";
import { analyzeImpactGraph, buildVerificationChecklist } from "./impact-analysis.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.CODEBASE_ROOT || path.resolve(HERE, "../../.."));
const MEMORY = "docs/codebase-memory";
const MAP_PATH = path.join(MEMORY, "generated/repository-map.json");
const MAX_FILE_BYTES = 600_000;
const MAX_RESULTS = 12;

const SKIP_DIRS = new Set([
  ".git", "node_modules", ".next", "dist", "build", "coverage",
  ".vercel", ".supabase", ".turbo", ".cache"
]);
const TEXT_EXTENSIONS = new Set([
  ".html", ".htm", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
  ".css", ".scss", ".json", ".md", ".mdx", ".sql", ".yml", ".yaml",
  ".toml", ".xml", ".txt", ".py", ".sh", ".svg"
]);

type FileRecord = { path: string; content: string; lines: string[] };

function isTextFile(filePath: string): boolean {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function walk(dir = ROOT, prefix = ""): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries) {
    const rel = prefix ? prefix + "/" + entry.name : entry.name;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) result.push(...await walk(path.join(dir, entry.name), rel));
    } else if (entry.isFile() && isTextFile(rel) && !isExcludedPath(rel)) {
      result.push(rel);
    }
  }
  return result;
}

async function readRepoFile(relativePath: string): Promise<FileRecord | null> {
  const absolute = resolveSafePath(ROOT, relativePath);
  if (!absolute || isExcludedPath(relativePath)) return null;
  try {
    const info = await lstat(absolute);
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_FILE_BYTES || !isTextFile(relativePath)) return null;
    const content = await readFile(absolute, "utf8");
    if (content.includes("\u0000")) return null;
    return { path: relativePath.replaceAll("\\", "/"), content, lines: content.split(/\r?\n/) };
  } catch {
    return null;
  }
}

async function readMemory(relativePath: string): Promise<string> {
  const record = await readRepoFile(relativePath);
  return record?.content ?? "";
}

async function allTextFiles(): Promise<FileRecord[]> {
  const paths = await walk();
  const records = await Promise.all(paths.map(readRepoFile));
  return records.filter((item): item is FileRecord => item !== null);
}

function excerpt(lines: string[], lineIndex: number, radius = 2): string {
  const start = Math.max(0, lineIndex - radius);
  const end = Math.min(lines.length, lineIndex + radius + 1);
  return lines.slice(start, end).map((line, i) => `${start + i + 1}: ${line}`).join("\n");
}

function tokens(input: string): string[] {
  return [...new Set(input.toLowerCase().split(/[^a-z0-9_$-]+/).filter(t => t.length >= 2))];
}

function jsonText(value: unknown): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

const featureFiles: Record<string, string[]> = {
  reservation: ["features/reservation.md", "js/app-applications.js", "js/app-schedule.js", "js/app-waiting.js", "js/app-bulk.js", "js/app-core.js", "js/app-auth.js", "js/app-notes.js"],
  "svs-enemies": ["features/svs-enemies.md", "js/app-svs-enemies.js", "supabase/functions/wosatlas-states/index.ts"],
  "svs-record": ["features/svs-record.md", "js/app-svs-record.js", "svs_record_migration.sql"],
  "redeem-and-extras": ["features/redeem-and-extras.md", "js/app-extras.js", "supabase/functions/redeem-giftcode/index.ts"],
  notifications: ["features/notifications.md", "js/app-notifications.js", "supabase/functions/send-announcement/index.ts", "supabase/functions/send-push-notification/index.ts"],
  "themes-translations-pwa": ["features/themes-translations-pwa.md", "style.css", "lang.js", "index.html", "sw.js"],
  "shared-core-auth": ["features/shared-core-auth.md", "common.js", "js/app-core.js", "js/app-auth.js"]
};

const server = new McpServer({ name: "3475-codebase-memory", version: "1.2.0" });

server.tool(
  "search_codebase",
  "Search tracked text source and project memory. Returns ranked file paths, line numbers and short excerpts.",
  { query: z.string().min(2).max(300), feature: z.string().optional() },
  async ({ query, feature }) => {
    const terms = tokens(query);
    const files = await allTextFiles();
    const matches: Array<{ path: string; score: number; matches: Array<{ line: number; excerpt: string }> }> = [];
    for (const file of files) {
      if (feature && !(featureFiles[feature] || []).some(p => file.path.endsWith(p) || file.path === p)) continue;
      const lower = file.content.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (lower.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))?.length || 0), 0);
      if (!score) continue;
      const hits: Array<{ line: number; excerpt: string }> = [];
      for (let i = 0; i < file.lines.length && hits.length < 3; i++) {
        if (terms.some(term => file.lines[i].toLowerCase().includes(term))) hits.push({ line: i + 1, excerpt: excerpt(file.lines, i, 1) });
      }
      matches.push({ path: file.path, score, matches: hits });
    }
    matches.sort((a, b) => b.score - a.score);
    return jsonText({ query, feature: feature || null, repository_root: ROOT, results: matches.slice(0, MAX_RESULTS), total_matching_files: matches.length });
  }
);

server.tool(
  "get_feature_map",
  "Read the maintained feature map and list the principal source files for a known feature.",
  { feature_id: z.enum(["reservation", "svs-enemies", "svs-record", "redeem-and-extras", "notifications", "themes-translations-pwa", "shared-core-auth"]) },
  async ({ feature_id }) => {
    const paths = featureFiles[feature_id];
    const docs = await readMemory(`${MEMORY}/${paths[0]}`);
    const source = await Promise.all(paths.slice(1).map(async p => ({ path: p, exists: !!(await readRepoFile(p)) })));
    return jsonText({ feature_id, memory_document: docs, source_files: source, note: "Memory is a navigation aid. Re-check current source before changing code." });
  }
);

server.tool(
  "trace_symbol",
  "Find exact symbol definitions and references across readable project files.",
  { symbol: z.string().min(2).max(160) },
  async ({ symbol }) => {
    const files = await allTextFiles();
    const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matcher = new RegExp(escaped, "i");
    const results: Array<{ path: string; line: number; kind: string; excerpt: string }> = [];
    for (const file of files) {
      for (let i = 0; i < file.lines.length; i++) {
        const line = file.lines[i];
        if (!matcher.test(line)) continue;
        const kind = new RegExp(`(?:function|const|let|var|class)\\s+${escaped}\\b|\\b${escaped}\\s*[:=]\\s*(?:async\\s*)?function`, "i").test(line) ? "possible-definition" : "reference";
        results.push({ path: file.path, line: i + 1, kind, excerpt: excerpt(file.lines, i, 1) });
        if (results.length >= 80) break;
      }
      if (results.length >= 80) break;
    }
    return jsonText({ symbol, results, truncated: results.length >= 80, note: "Definition classification is heuristic; inspect surrounding code and runtime call paths." });
  }
);

server.tool(
  "get_change_impact",
  "Build a conservative change-impact shortlist using feature memory, source matches and the generated AST dependency graph.",
  { change_request: z.string().min(5).max(500) },
  async ({ change_request }) => {
    const terms = tokens(change_request);
    const docs = await Promise.all(Object.entries(featureFiles).map(async ([id, paths]) => {
      const content = await readMemory(`${MEMORY}/${paths[0]}`);
      const score = terms.reduce((n, t) => n + (content.toLowerCase().includes(t) ? 1 : 0), 0);
      return { id, score, files: paths.slice(1) };
    }));
    const ranked = docs.filter(d => d.score > 0).sort((a, b) => b.score - a.score);
    const source = await allTextFiles();
    const candidates = source.map(f => ({ path: f.path, score: terms.reduce((n, t) => n + (f.content.toLowerCase().includes(t) ? 1 : 0), 0) }))
      .filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 15);
    const graph = await readAstGraph();
    const seeds = [...new Set([...ranked.slice(0, 3).flatMap(item => item.files), ...candidates.slice(0, 8).map(item => item.path)])];
    const dependencyImpact = graph ? analyzeImpactGraph(graph, seeds, 2) : null;
    return jsonText({
      request: change_request,
      likely_features: ranked,
      source_candidates: candidates,
      direct_seed_files: seeds,
      graph_impact: dependencyImpact,
      confidence: graph ? "direct matches plus AST-linked candidate dependencies; inspect each relationship and runtime call path" : "heuristic shortlist only; AST graph unavailable",
      checklist: buildVerificationChecklist(change_request)
    });
  }
);

server.tool(
  "plan_change",
  "Create a pre-edit change plan: rank source files, traverse AST dependencies, detect relevant static integrations and produce cross-cutting verification checks. This tool is read-only.",
  {
    change_request: z.string().min(5).max(500),
    focus_files: z.array(z.string().min(1).max(240)).max(20).optional()
  },
  async ({ change_request, focus_files = [] }) => {
    const terms = tokens(change_request);
    const source = await allTextFiles();
    const sourceMatches = source.map(file => ({
      path: file.path,
      score: terms.reduce((sum, term) => sum + (file.content.toLowerCase().includes(term) ? 1 : 0), 0)
    })).filter(item => item.score > 0).sort((a,b) => b.score - a.score || a.path.localeCompare(b.path));
    const featureMatches = await Promise.all(Object.entries(featureFiles).map(async ([id, paths]) => {
      const doc = await readMemory(`${MEMORY}/${paths[0]}`);
      const score = terms.reduce((sum, term) => sum + (doc.toLowerCase().includes(term) ? 1 : 0), 0);
      return { feature_id: id, score, source_files: paths.slice(1) };
    }));
    const likelyFeatures = featureMatches.filter(item => item.score > 0).sort((a,b) => b.score - a.score);
    const seeds = [...new Set([...focus_files, ...likelyFeatures.slice(0, 3).flatMap(item => item.source_files), ...sourceMatches.slice(0, 8).map(item => item.path)])];
    const graph = await readAstGraph();
    const impact = graph ? analyzeImpactGraph(graph, seeds, 2) : null;
    const integrations = (graph?.integrations || []).filter((item: any) => {
      const haystack = `${item.kind} ${item.value} ${item.function}`.toLowerCase();
      return terms.some(term => haystack.includes(term));
    }).slice(0, 50);
    const risks = [];
    if (/translation|language|i18n|bahasa|label|text/.test(change_request.toLowerCase())) risks.push("Translation completeness and long-label layout");
    if (/ui|css|layout|mobile|theme|button|modal|icon|animation/.test(change_request.toLowerCase())) risks.push("Theme consistency, mobile responsiveness and interaction regression");
    if (/database|sql|table|supabase|rls|policy|migration/.test(change_request.toLowerCase())) risks.push("Schema compatibility, RLS, grants and migration safety");
    if (/api|edge function|backend|atlas|fetch|webhook/.test(change_request.toLowerCase())) risks.push("API contract, upstream behavior, authorization and secret handling");
    if (/cache|pwa|service worker|build|asset/.test(change_request.toLowerCase())) risks.push("Build marker, asset versioning and service-worker cache invalidation");
    return jsonText({
      change_request,
      plan_status: graph ? "static-analysis-assisted" : "heuristic-only",
      likely_features: likelyFeatures,
      focus_files,
      direct_file_candidates: sourceMatches.slice(0, 15),
      dependency_impact: impact,
      matching_static_integrations: integrations,
      risk_flags: risks,
      verification_checklist: buildVerificationChecklist(change_request),
      execution_boundary: "Planning only. No source files, database records, deployments or Git history are modified.",
      confidence_notes: [
        "Direct file matches are keyword evidence, not proof a file must change.",
        "AST edges are static candidates; ambiguous or dynamic runtime relationships may be missing.",
        "Inspect current source, feature contracts and live Supabase configuration before implementation."
      ]
    });
  }
);

server.tool(
  "get_data_flow",
  "Retrieve documented data-flow information for a feature, table or endpoint.",
  { feature_id: z.string().optional(), table_or_endpoint: z.string().optional() },
  async ({ feature_id, table_or_endpoint }) => {
    if (!feature_id && !table_or_endpoint) return jsonText({ error: "Provide feature_id or table_or_endpoint." });
    const docs = await Promise.all(["reservation", "svs-enemies", "svs-record", "redeem-and-extras", "notifications", "shared-core-auth"].map(async id => ({
      id, content: await readMemory(`${MEMORY}/features/${id}.md`)
    })));
    const needle = (feature_id || table_or_endpoint || "").toLowerCase();
    const hits = docs.filter(d => d.id === needle || d.content.toLowerCase().includes(needle));
    return jsonText({ query: needle, matches: hits.map(h => ({ feature_id: h.id, documented_flow: h.content })), warning: hits.length ? "Verify the current implementation and live Supabase configuration; memory may be stale." : "No documented match. Do not infer a data flow from this empty result." });
  }
);

server.tool(
  "get_runbook",
  "Return safe maintenance steps for common project tasks.",
  { task: z.string().min(2).max(200) },
  async ({ task }) => {
    const t = task.toLowerCase();
    const common = ["Read the relevant feature map and known-issues register", "Confirm the current source at the active branch and identify callers", "Make the smallest change that preserves existing contracts", "Run syntax/type checks and focused tests", "Verify mobile, all supported languages and themes when UI is affected", "Update codebase memory when ownership, data flow or architecture changes"];
    let specific = ["Identify the affected feature using INDEX.md, then use search_codebase and trace_symbol."];
    if (/cache|pwa|service worker|build/.test(t)) specific = ["Inspect index.html and sw.js together", "Update APP_BUILD, asset query versions and CACHE_VERSION consistently", "Check precache entries and test a clean install plus an upgrade from an older cache"];
    else if (/translation|language|i18n|bahasa/.test(t)) specific = ["Inspect lang.js and the caller that renders the text", "Keep all eight language dictionaries aligned", "Check long labels and overflow on mobile and desktop"];
    else if (/database|sql|table|rls|supabase/.test(t)) specific = ["Inspect the relevant SQL migrations and all client/backend queries", "Verify live schema, indexes, constraints, triggers, RLS and grants before designing changes", "Never assume a migration was applied or safe to rerun"];
    else if (/svs|enemy|atlas|state/.test(t)) specific = ["Inspect js/app-svs-enemies.js and wosatlas-states/index.ts", "Preserve explicit action parameters and current upstream API behavior", "Do not call or revive the retired summary endpoint without a separately verified decision"];
    else if (/push|notification|announcement/.test(t)) specific = ["Trace browser subscription through push_subscriptions and both notification Edge Functions", "Keep private VAPID material and service-role credentials server-side", "Verify permission, subscription cleanup and delivery failure handling"];
    return jsonText({ task, steps: [...specific, ...common], safety: "This runbook is advisory and read-only. No production mutation is performed." });
  }
);

server.tool(
  "get_repository_status",
  "Report the current checked-out commit, memory baseline and whether the generated map appears stale.",
  {},
  async () => {
    let head = "unavailable";
    try {
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const run = promisify(execFile);
      const result = await run("git", ["-C", ROOT, "rev-parse", "HEAD"]);
      head = result.stdout.trim();
    } catch { /* git metadata may not be available in a packaged checkout */ }
    let baseline: string | null = null;
    let indexedAt: string | null = null;
    let indexedDigest: string | null = null;
    let currentDigest: string | null = null;
    let addedFiles: string[] = [];
    let removedFiles: string[] = [];
    let changedFiles: string[] = [];
    try {
      const map = JSON.parse(await readFile(path.join(ROOT, MAP_PATH), "utf8"));
      baseline = map.inspected_commit || null;
      indexedAt = map.inspected_at_utc || null;
      indexedDigest = map.generated_inventory?.content_digest || null;
      const indexedFiles = map.generated_inventory?.files;
      if (Array.isArray(indexedFiles)) {
        let trackedPaths: Set<string> | null = null;
        try {
          const { execFile } = await import("node:child_process");
          const { promisify } = await import("node:util");
          const run = promisify(execFile);
          const result = await run("git", ["-C", ROOT, "ls-files", "-z"]);
          trackedPaths = new Set(result.stdout.split("\0").filter(Boolean));
        } catch { /* fall back to readable checkout files when Git metadata is unavailable */ }
        const currentFiles = (await allTextFiles()).filter(file => file.path !== MAP_PATH && file.path !== "docs/codebase-memory/generated/ast-dependency-graph.json" && (!trackedPaths || trackedPaths.has(file.path)));
        const currentByPath = new Map(currentFiles.map(file => [file.path, file]));
        const expectedPaths = new Set(indexedFiles.map((item: { path: string }) => item.path));
        const currentPaths = new Set(currentByPath.keys());
        addedFiles = [...currentPaths].filter(file => !expectedPaths.has(file)).sort();
        removedFiles = [...expectedPaths].filter(file => !currentPaths.has(file)).sort();
        const actualHashes = currentFiles.map(file => ({ path: file.path, sha256: createHash("sha256").update(file.content).digest("hex") }));
        const expectedHashes = new Map(indexedFiles.map((item: { path: string; sha256: string }) => [item.path, item.sha256]));
        changedFiles = actualHashes.filter(item => expectedHashes.get(item.path) !== item.sha256).map(item => item.path).sort();
        currentDigest = createHash("sha256").update(actualHashes.map(item => item.path + ":" + item.sha256).sort().join("\\n")).digest("hex");
      }
    } catch { /* missing or invalid map */ }
    const stale = !indexedDigest || !currentDigest || indexedDigest !== currentDigest || addedFiles.length > 0 || removedFiles.length > 0 || changedFiles.length > 0;
    return jsonText({
      repository_root: ROOT,
      current_commit: head,
      indexed_commit_at_initial_inspection: baseline,
      index_timestamp: indexedAt,
      indexed_digest: indexedDigest,
      current_digest: currentDigest,
      stale_index: stale,
      added_files: addedFiles,
      removed_files: removedFiles,
      changed_files: changedFiles,
      warning: stale ? "The generated file inventory does not match the current checkout. Run npm run index in tools/codebase-memory-mcp, then review the map diff. Semantic feature notes still require human review." : "Generated inventory matches the current checkout. Semantic feature notes remain human-maintained."
    });
  }
);


const AST_GRAPH_PATH = `${MEMORY}/generated/ast-dependency-graph.json`;

async function readAstGraph(): Promise<any | null> {
  try { return JSON.parse(await readMemory(AST_GRAPH_PATH)); }
  catch { return null; }
}

server.tool(
  "trace_call_graph",
  "Trace AST-indexed function definitions, incoming callers and outgoing calls. Cross-file classic-script name matches may be candidates, not proven runtime calls.",
  { symbol: z.string().min(2).max(160), direction: z.enum(["both", "callers", "callees"]).optional() },
  async ({ symbol, direction = "both" }) => {
    const graph = await readAstGraph();
    if (!graph) return jsonText({ error: "AST dependency graph is not available. Run npm run ast from tools/codebase-memory-mcp." });
    const needle = symbol.toLowerCase();
    const definitions = graph.functions.filter((item: any) => item.name.toLowerCase() === needle || item.id.toLowerCase().includes(needle));
    const ids = new Set(definitions.map((item: any) => item.id));
    const callers = direction === "callees" ? [] : graph.edges.filter((edge: any) => edge.kind === "call" && ids.has(edge.to));
    const callees = direction === "callers" ? [] : graph.edges.filter((edge: any) => edge.kind === "call" && ids.has(edge.from));
    return jsonText({
      symbol, definitions, callers, callees,
      confidence_note: "static-name-match indicates a statically resolved name; candidate-name-match means multiple cross-file definitions share the name. Dynamic dispatch and runtime behavior are not resolved.",
      parse_diagnostics_for_definitions: graph.parse_diagnostics.filter((item: any) => definitions.some((def: any) => def.file === item.file))
    });
  }
);

server.tool(
  "get_static_integrations",
  "List AST-detected static Supabase table, Edge Function and literal network endpoint references.",
  { kind: z.enum(["all", "supabase-table", "edge-function", "fetch", "websocket", "eventsource"]).optional(), value: z.string().optional() },
  async ({ kind = "all", value }) => {
    const graph = await readAstGraph();
    if (!graph) return jsonText({ error: "AST dependency graph is not available. Run npm run ast from tools/codebase-memory-mcp." });
    const integrations = graph.integrations.filter((item: any) =>
      (kind === "all" || item.kind === kind) && (!value || item.value.toLowerCase().includes(value.toLowerCase()))
    );
    return jsonText({
      count: integrations.length,
      integrations,
      limitation: "Only literal strings passed directly to recognized calls are detected. Computed URLs/table names and indirect wrappers may be missed."
    });
  }
);

server.resource("project-overview", "3475://project/overview", async uri => ({
  contents: [{ uri: uri.href, mimeType: "text/markdown", text: await readMemory("docs/codebase-memory/INDEX.md") }]
}));
server.resource("known-issues", "3475://known-issues", async uri => ({
  contents: [{ uri: uri.href, mimeType: "text/markdown", text: await readMemory("docs/codebase-memory/known-issues.md") }]
}));
server.resource("architecture", "3475://architecture/mcp", async uri => ({
  contents: [{ uri: uri.href, mimeType: "text/markdown", text: await readMemory("docs/CODEBASE_MEMORY_MCP.md") }]
}));

const transport = new StdioServerTransport();
await server.connect(transport);
