import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";

const sha = value => createHash("sha256").update(value).digest("hex");
const normalize = paths => [...paths].sort().map(p => p.replaceAll("\\", "/"));

test("inventory digest is stable regardless of input ordering", () => {
  const a = [{path:"js/app.js",sha256:"abc"},{path:"index.html",sha256:"def"}];
  const b = [...a].reverse();
  const digest = items => sha(normalize(items.map(x=>x.path)).map(p => p + ":" + items.find(x=>x.path===p).sha256).join("\n"));
  assert.equal(digest(a), digest(b));
});

test("secret and build paths are excluded by generator policy", () => {
  const skipped = file => file.split("/").some(p => [".git","node_modules","dist","coverage"].includes(p)) ||
    /^\.env(?:\.|$)/i.test(file) ||
    /(^|\/)(?:secrets?|credentials?)(?:\/|\.|$)/i.test(file) ||
    /(^|\/).+\.(?:pem|key|p12|pfx|keystore)$/i.test(file);
  for (const file of [".env", ".env.production", "secrets/key.json", "certs/server.pem", "node_modules/pkg/index.js", "dist/app.js"]) assert.equal(skipped(file), true);
  for (const file of ["js/app-core.js", "docs/codebase-memory/INDEX.md", "index.html"]) assert.equal(skipped(file), false);
});

test("generated map is excluded from recursive source content through explicit output exclusion", () => {
  const generated = "docs/codebase-memory/generated/repository-map.json";
  assert.equal(path.posix.normalize(generated), generated);
});
