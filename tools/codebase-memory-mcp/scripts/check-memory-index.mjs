import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(process.env.CODEBASE_ROOT || path.resolve(process.cwd(), "../.."));
const MAP = "docs/codebase-memory/generated/repository-map.json";
const SKIP_DIRS = new Set([".git", "node_modules", ".next", "dist", "build", "coverage", ".vercel", ".supabase", ".turbo", ".cache"]);
const EXTENSIONS = new Set([".html", ".htm", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".css", ".scss", ".json", ".md", ".mdx", ".sql", ".yml", ".yaml", ".toml", ".xml", ".txt", ".py", ".sh", ".svg"]);
const SKIP_FILES = [/^\.env(?:\.|$)/i, /(^|\/)(?:secrets?|credentials?)(?:\/|\.|$)/i, /(^|\/).+\.(?:pem|key|p12|pfx|keystore)$/i, /(^|\/)(?:id_rsa|id_ed25519)(?:\.pub)?$/i, /(^|\/)(?:service-account|supabase-service-role).*\.json$/i];
const excluded = file => file.split("/").some(part => SKIP_DIRS.has(part)) || SKIP_FILES.some(pattern => pattern.test(file));
const sha = value => createHash("sha256").update(value).digest("hex");
function trackedFiles() {
  try {
    return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" })
      .split("\0").filter(Boolean)
      .filter(file => !excluded(file) && EXTENSIONS.has(path.extname(file).toLowerCase()))
      .sort();
  } catch { return null; }
}

async function walk(dir = ROOT, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const rel = prefix ? prefix + "/" + entry.name : entry.name;
    if (excluded(rel)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full, rel));
    else if (entry.isFile() && EXTENSIONS.has(path.extname(rel).toLowerCase())) {
      const info = await lstat(full);
      if (!info.isSymbolicLink() && info.size <= 600_000) files.push(rel.replaceAll("\\", "/"));
    }
  }
  return files.sort();
}
const map = JSON.parse(await readFile(path.join(ROOT, MAP), "utf8"));
const expected = map.generated_inventory?.files;
if (!Array.isArray(expected)) {
  process.stderr.write("Memory index is missing generated_inventory.files. Run npm run index first.\n");
  process.exit(2);
}
const currentPaths = (trackedFiles() || await walk()).filter(file => file !== MAP && file !== "docs/codebase-memory/generated/ast-dependency-graph.json");
const expectedPaths = expected.map(item => item.path).sort();
const added = currentPaths.filter(file => !expectedPaths.includes(file));
const removed = expectedPaths.filter(file => !currentPaths.includes(file));
const changed = [];
for (const item of expected) {
  if (!currentPaths.includes(item.path)) continue;
  const content = await readFile(path.join(ROOT, item.path));
  if (sha(content) !== item.sha256) changed.push(item.path);
}
const stale = added.length > 0 || removed.length > 0 || changed.length > 0;
process.stdout.write(JSON.stringify({ stale, indexed_file_count: expected.length, current_file_count: currentPaths.length, added, removed, changed, indexed_digest: map.generated_inventory.content_digest }, null, 2) + "\n");
if (stale) {
  process.stderr.write("Codebase memory is stale. Run npm run index and review the generated diff.\n");
  process.exit(1);
}
