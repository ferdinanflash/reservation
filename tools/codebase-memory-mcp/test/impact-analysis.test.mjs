import test from "node:test";
import assert from "node:assert/strict";
import { analyzeImpactGraph, buildVerificationChecklist } from "../src/impact-analysis.mjs";

test("impact traversal follows static imports and function calls from seed files", () => {
  const graph = {
    functions: [
      { id: "js/a.js#save", file: "js/a.js" },
      { id: "js/b.js#persist", file: "js/b.js" },
      { id: "js/c.js#refresh", file: "js/c.js" }
    ],
    edges: [
      { from: "js/a.js#save", to: "js/b.js#persist", kind: "call", confidence: "static-name-match" },
      { from: "js/b.js", to: "js/c.js", kind: "import", confidence: "static" }
    ]
  };
  const result = analyzeImpactGraph(graph, ["js/a.js"], 2);
  assert.deepEqual(result.seed_files, ["js/a.js"]);
  assert.ok(result.impacted_files.some(item => item.file === "js/b.js" && item.depth === 1));
  assert.ok(result.impacted_files.some(item => item.file === "js/c.js" && item.depth === 2));
});

test("impact traversal excludes seeds and handles missing graph", () => {
  const result = analyzeImpactGraph(null, ["js/a.js"]);
  assert.deepEqual(result.impacted_files, []);
});

test("verification checklist adds relevant cross-cutting checks", () => {
  const checklist = buildVerificationChecklist("Update reservation UI translations and Supabase table");
  assert.ok(checklist.some(item => item.includes("eight language")));
  assert.ok(checklist.some(item => item.includes("RLS")));
  assert.ok(checklist.some(item => item.includes("mobile")));
});
