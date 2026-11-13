import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSource, resolveRelativeImport } from "../src/ast-analysis.mjs";

test("AST analyzer extracts function definitions, calls and static integrations", () => {
  const source = `
    function loadData() {
      return supabase.from("svs_records").select("*");
    }
    const refresh = async () => {
      await supabase.functions.invoke("wosatlas-states", { body: {} });
      loadData();
      await fetch("https://example.test/api");
    };
  `;
  const result = analyzeSource("js/sample.js", source);
  assert.ok(result.functions.some(item => item.name === "loadData"));
  assert.ok(result.functions.some(item => item.name === "refresh"));
  assert.ok(result.rawCalls.some(item => item.name === "loadData" && item.callType === "identifier"));
  assert.ok(result.integrations.some(item => item.kind === "supabase-table" && item.value === "svs_records"));
  assert.ok(result.integrations.some(item => item.kind === "edge-function" && item.value === "wosatlas-states"));
  assert.ok(result.integrations.some(item => item.kind === "fetch" && item.value === "https://example.test/api"));
});

test("AST analyzer excludes property-method calls from function call edges", () => {
  const result = analyzeSource("js/methods.js", "function run() { element.remove(); helper(); }");
  assert.ok(!result.rawCalls.some(item => item.name === "remove"));
  assert.ok(result.rawCalls.some(item => item.name === "helper" && item.callType === "identifier"));
});

test("AST analyzer reports syntax diagnostics without crashing", () => {
  const result = analyzeSource("broken.js", "function {");
  assert.ok(result.diagnostics.length > 0);
});

test("relative import resolution only returns tracked candidates", () => {
  const known = new Set(["js/app.js", "js/utils/index.js", "common.js"]);
  assert.equal(resolveRelativeImport("js/app.js", "./utils/index", known), "js/utils/index.js");
  assert.equal(resolveRelativeImport("js/app.js", "../common.js", known), "common.js");
  assert.equal(resolveRelativeImport("js/app.js", "external-package", known), null);
});
