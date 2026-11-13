import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(process.env.CODEBASE_ROOT || path.resolve(process.cwd(), "../.."));
const MAP = "docs/codebase-memory/generated/repository-map.json";
const VERSION = 1;
const SKIP_DIRS = new Set([".git", "node_modules", ".next", "dist", "build", "coverage", ".vercel", ".supabase", ".turbo", ".cache"]);
const EXTENSIONS = new Set([".html", ".htm", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".css", ".scss", ".json", ".md", ".mdx", ".sql", ".yml", ".yaml", ".toml", ".xml", ".txt", ".py", ".sh", ".svg"]);
const SKIP_FILES = [/^\.env(?:\.|$)/i, /(^|\/)(?:secrets?|credentials?)(?:\/|\.|$)/i, /(^|\/).+\.(?:pem|key|p12|pfx|keystore)$/i, /(^|\/)(?:id_rsa|id_ed25519)(?:\.pub)?$/i, /(^|\/)(?:service-account|supabase-service-role).*\.json$/i];

function excluded(file) {
  const normalized = file.replaceAll("\\", "/");
  return normalized.split("/").some(part => SKIP_DIRS.has(part)) || SKIP_FILES.some(pattern => pattern.test(normalized));
}
function sha(value) { return createHash("sha256").update(value).digest("hex"); }
async function walk(dir = ROOT, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))) {
    const rel = prefix ? prefix + "/" + entry.name : entry.name;
    if (excluded(rel)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full, rel));
    else if (entry.isFile() && EXTENSIONS.has(path.extname(rel).toLowerCase())) {
      const info = await lstat(full);
      if (info.isSymbolicLink() || info.size > 600_000) continue;
      files.push(rel.replaceAll("\\", "/"));
    }
  }
  return files.sort();
}
function trackedFiles() {
  try {
    return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" })
      .split("\0").filter(Boolean)
      .filter(file => !excluded(file) && EXTENSIONS.has(path.extname(file).toLowerCase()))
      .sort();
  } catch { return null; }
}
function gitValue(args) {
  try { return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return null; }
}
function unique(values) { return [...new Set(values)].sort(); }

const mapPath = path.join(ROOT, MAP);
const current = JSON.parse(await readFile(mapPath, "utf8"));
const allFiles = (trackedFiles() || await walk()).filter(file => file !== MAP);
const fileHashes = [];
for (const rel of allFiles) {
  const content = await readFile(path.join(ROOT, rel));
  fileHashes.push({ path: rel, sha256: sha(content) });
}
const digest = sha(fileHashes.map(item => item.path + ":" + item.sha256).join("\n"));

const indexHtml = await readFile(path.join(ROOT, "index.html"), "utf8").catch(() => "");
const scriptOrder = [...indexHtml.matchAll(/<script\b[^>]*\bsrc=["']([^"'?#]+)(?:\?[^"']*)?["'][^>]*>/gi)]
  .map(match => match[1])
  .filter(src => !/^(?:https?:)?\/\//i.test(src) && !src.startsWith("data:"))
  .map(src => src.replace(/^\.\//, "").replace(/^\//, ""))
  .filter(src => allFiles.includes(src));

const frontendModules = unique(allFiles.filter(file => /^js\/.*\.(?:js|mjs)$/.test(file)));
const edgeFunctions = unique(allFiles.filter(file => /^supabase\/functions\/.*\.ts$/.test(file)));
const sqlMigrations = unique(allFiles.filter(file => /(?:^|\/)[^/]*migration[^/]*\.sql$/i.test(file) || /^svs_record_migration\.sql$/i.test(file)));
const featureDocs = unique(allFiles.filter(file => file.startsWith("docs/codebase-memory/features/") && file.endsWith(".md")));
const sharedFiles = unique(["index.html", "common.js", "lang.js", "style.css", "sw.js", "site.webmanifest", "fire-banner.js", "opening-animation.js", "live/index.html"].filter(file => allFiles.includes(file)));
const categories = {
  frontend_modules: frontendModules,
  edge_functions: edgeFunctions,
  sql_migrations: sqlMigrations,
  feature_maps: featureDocs,
  shared_files: sharedFiles
};
const sourcePaths = fileHashes.map(item => item.path);
const next = {
  ...current,
  generated_mode: "automated-deterministic-inventory",
  automation_status: "automated-inventory; semantic-feature-notes-require-human-review",
  note: "Generated inventory and file digests are deterministic for the same repository contents and generator version. Semantic feature maps remain human-maintained. This is not a complete AST dependency graph.",
  script_load_order: scriptOrder,
  ...categories,
  generated_inventory: {
    generator_version: VERSION,
    file_count: allFiles.length,
    digest_algorithm: "sha256",
    content_digest: digest,
    files: fileHashes
  },
  generation_warnings: [
    "Static inventory does not prove runtime dependencies or deployed configuration.",
    "Semantic feature descriptions and known issues require human review."
  ]
};
await writeFile(mapPath, JSON.stringify(next, null, 2) + "\n");
const commit = gitValue(["rev-parse", "HEAD"]);
process.stdout.write(JSON.stringify({ map: MAP, file_count: allFiles.length, digest, source_commit: commit, script_count: scriptOrder.length, edge_function_count: edgeFunctions.length, migration_count: sqlMigrations.length }) + "\n");
