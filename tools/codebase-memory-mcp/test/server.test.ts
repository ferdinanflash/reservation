import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isExcludedPath, resolveSafePath } from "../src/security.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");

test("rejects traversal and absolute paths", () => {
  assert.equal(resolveSafePath(ROOT, "../README.md"), null);
  assert.equal(resolveSafePath(ROOT, "/etc/passwd"), null);
  assert.equal(resolveSafePath(ROOT, "docs/../../.env"), null);
});

test("allows ordinary project documentation and source", () => {
  assert.equal(resolveSafePath(ROOT, "docs/codebase-memory/INDEX.md"), path.join(ROOT, "docs/codebase-memory/INDEX.md"));
  assert.equal(resolveSafePath(ROOT, "js/app-core.js"), path.join(ROOT, "js/app-core.js"));
});

test("excludes environment and credential material", () => {
  for (const candidate of [".env", ".env.production", "secrets/private.json", "certs/server.pem", "config/id_rsa"]) {
    assert.equal(isExcludedPath(candidate), true, candidate);
    assert.equal(resolveSafePath(ROOT, candidate), null, candidate);
  }
});

test("normalizes harmless current-directory prefixes", () => {
  assert.equal(resolveSafePath(ROOT, "./README.md"), path.join(ROOT, "README.md"));
});
