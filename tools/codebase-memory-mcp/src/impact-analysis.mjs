function fileOf(node) {
  if (typeof node !== "string") return null;
  return node.includes("#") ? node.slice(0, node.indexOf("#")) : node;
}

export function analyzeImpactGraph(graph, seedFiles, maxDepth = 2) {
  const seeds = [...new Set(seedFiles)].filter(Boolean).sort();
  const adjacency = new Map();
  const add = (from, to, edge) => {
    if (!from || !to) return;
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from).push({ node: to, edge });
  };
  for (const edge of graph?.edges || []) {
    if (edge.kind === "import" && edge.to) {
      add(edge.from, edge.to, edge);
      add(edge.to, edge.from, edge);
    } else if (edge.kind === "call") {
      add(edge.from, edge.to, edge);
      add(edge.to, edge.from, edge);
    }
  }
  const queue = [];
  for (const file of seeds) {
    queue.push({ node: file, depth: 0 });
    for (const fn of graph?.functions || []) {
      if (fn.file === file) queue.push({ node: fn.id, depth: 0 });
    }
  }
  const visited = new Map();
  const evidence = new Map();
  while (queue.length) {
    const current = queue.shift();
    const previous = visited.get(current.node);
    if (previous !== undefined && previous <= current.depth) continue;
    visited.set(current.node, current.depth);
    if (current.depth >= maxDepth) continue;
    for (const next of adjacency.get(current.node) || []) {
      const targetFile = fileOf(next.node);
      if (targetFile) {
        if (!evidence.has(targetFile)) evidence.set(targetFile, []);
        evidence.get(targetFile).push({
          depth: current.depth + 1,
          kind: next.edge.kind,
          from: current.node,
          to: next.node,
          confidence: next.edge.confidence || "static"
        });
      }
      queue.push({ node: next.node, depth: current.depth + 1 });
    }
  }
  const impacted = [...evidence.entries()].map(([file, links]) => ({
    file,
    depth: Math.min(...links.map(link => link.depth)),
    relationship: [...new Set(links.map(link => link.kind))],
    evidence: links.sort((a,b) => a.depth - b.depth || a.from.localeCompare(b.from)).slice(0, 5)
  })).filter(item => !seeds.includes(item.file))
    .sort((a,b) => a.depth - b.depth || a.file.localeCompare(b.file));
  return {
    seed_files: seeds,
    impacted_files: impacted,
    traversed_edges: impacted.reduce((sum, item) => sum + item.evidence.length, 0),
    limitation: "Impact is a static candidate graph, not proof of runtime execution. Dynamic calls, runtime registration, indirect data flow and external consumers may be absent."
  };
}

export function buildVerificationChecklist(request) {
  const text = String(request || "").toLowerCase();
  const checklist = [
    "Inspect each proposed file and confirm the actual entry point and callers before editing.",
    "Run the MCP type-check and complete test suite; add focused regression tests for changed behavior.",
    "Review the generated inventory and AST graph after source changes; update semantic feature notes when architecture or data flow changes."
  ];
  if (/ui|interface|layout|css|button|modal|icon|animation|mobile|theme|banner/.test(text)) {
    checklist.push("Verify desktop and mobile layouts, interactions, accessibility and every supported theme.");
  }
  if (/translation|language|i18n|bahasa|russian|french|indonesia|text|label/.test(text)) {
    checklist.push("Audit all eight language dictionaries and check long translated labels for clipping or overflow.");
  }
  if (/database|sql|table|supabase|rls|policy|migration|reservation|record/.test(text)) {
    checklist.push("Inspect schema, constraints, indexes, triggers, grants and RLS; verify live Supabase state before applying migrations.");
  }
  if (/edge function|api|endpoint|atlas|fetch|backend|webhook/.test(text)) {
    checklist.push("Verify request/response contracts, authentication, upstream limits, error handling and server-side secret boundaries.");
  }
  if (/cache|pwa|service worker|build|asset|version/.test(text)) {
    checklist.push("Review APP_BUILD, asset versioning, service-worker precache/runtime caches and upgrade behavior.");
  }
  if (/notification|push|announcement|vapid/.test(text)) {
    checklist.push("Test permission, subscription lifecycle, delivery failures and private VAPID/service-role handling.");
  }
  return [...new Set(checklist)];
}
