# Codebase Memory MCP — Completion Roadmap

Status reviewed against `main` on 2026-11-14.

## Completed foundations

- **Phase 1 — Repository memory:** feature maps, decisions, known issues and repository map.
- **Phase 2 — Local read-only MCP:** stdio server, resources and ten read-only tools.
- **Phase 3 — Inventory automation:** deterministic file hashes, freshness checks and GitHub Actions refresh.
- **Phase 4 — AST analysis:** static function/call/import graph and integration extraction.
- **Phase 5 — Change impact planning:** bounded graph traversal, risk flags and verification checklists.

## Completion phases

### Phase 6 — Automated change review
Status: implemented; CI verification pending.

- PR workflow runs deterministic static review against the base branch.
- Checks changed JavaScript syntax, likely exposed credential patterns, frontend service-role references, dynamic code execution and missing local script references when `index.html` changes.
- Produces a downloadable review artifact.
- Only confirmed high-confidence blockers (credential patterns, syntax errors, broken local script references) fail the job. Heuristic HIGH findings require human triage.
- This is static analysis, not an AI reviewer and not proof that a change is safe.

### Phase 7 — Project contract and regression checks
Status: implemented; CI verification pending.

- Validate translation dictionary key coverage across EN, ID, CN, PH, TH, IT, RU and FR.
- Validate main HTML script references and critical classic-script load order.
- Add focused regression tests for the MCP's security boundary, indexer, AST graph and impact planner.
- Keep browser/UI and live-backend checks separate from static CI.

### Phase 8 — Security and dependency governance
Status: implemented; CI verification pending.

- Add dependency audit reporting and a documented triage process; do not auto-upgrade production dependencies blindly.
- Review secret boundaries, Supabase RLS/grants, Edge Function authorization, CORS, webhook verification and browser-exposed configuration.
- Maintain a threat model and security review checklist.
- Live Supabase configuration and Actions secrets cannot be verified from repository source alone.

### Phase 9 — Operational readiness
Status: implemented.

- Document local MCP installation and client configuration, backup/recovery of generated memory, troubleshooting and safe update steps.
- Document how to regenerate and validate repository map and AST graph.
- Add a release checklist for source, translations, PWA cache markers, SQL migrations and Edge Functions.
- Keep all MCP tools read-only; implementation and deployment remain separate explicit workflows.

### Phase 10 — Acceptance and maintenance
Status: in progress; final CI acceptance pending.

- Run all automated checks on the final commit and verify generated artifacts are fresh and deterministic.
- Verify PR review workflow and memory refresh workflow independently.
- Review feature maps and known issues against current source.
- Record external verification gaps (live Supabase, mobile browsers, production API behavior) rather than marking them passed.
- Define completion as all repository-verifiable checks passing and external checks explicitly handed off.

## Completion criteria

The project is considered complete when Phases 6–10 have implementation evidence, automated checks pass, documentation matches the shipped behavior, and all checks requiring access outside GitHub are clearly listed as owner-run tasks. Codebase Memory remains a living maintenance system; future source changes should continue updating its generated index and semantic notes.


## Operations and acceptance references

- [Operations runbook](OPERATIONS.md)
- [Final acceptance checklist](ACCEPTANCE.md)
