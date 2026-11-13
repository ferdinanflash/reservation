import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Keep these policy tests independent from MCP transport startup.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");

function isSafeRelativePath(input: string): boolean {
  const normalized = input.replaceAll("\\", "/").replace(/^\.\//, "");
  if (!normalized || normalized.startsWith("/") || normalized.split("/").some(p => p === "..")) return false;
  if (/^\.env(?:\.|$)/i.test(normalized)) return false;
  if (/(^|\/)(?:secrets?|credentials?)(?:\/|\.|$)/i.test(normalized)) return false;
  if (/(^|\/).*\.(?:pem|key|p12|pfx|keystore)$/i.test(normalized)) return false;
  const absolute = path.resolve(ROOT, normalized);
  return absolute === ROOT || absolute.startsWith(ROOT + path.sep);
}

test("rejects traversal and absolute paths", () => {
  assert.equal(isSafeRelativePath("../README.md"), false);
  assert.equal(isSafeRelativePath("/etc/passwd"), false);
  assert.equal(isSafeRelativePath("docs/../../.env"), false);
});

test("allows ordinary project documentation and source", () => {
  assert.equal(isSafeRelativePath("docs/codebase-memory/INDEX.md"), true);
  assert.equal(isSafeRelativePath("js/app-core.js"), true);
});

test("rejects environment and credential material", () => {
  assert.equal(isSafeRelativePath(".env"), false);
  assert.equal(isSafeRelativePath(".env.production"), false);
  assert.equal(isSafeRelativePath("secrets/private.json"), false);
  assert.equal(isSafeRelativePath("certs/server.pem"), false);
});
