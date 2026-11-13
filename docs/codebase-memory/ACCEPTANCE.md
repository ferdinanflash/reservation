# Codebase Memory MCP — Final Acceptance Checklist

Use this checklist for a completion review and for future maintenance. A checkbox is complete only when its evidence is available.

## Repository-verifiable checks

- [ ] MCP TypeScript type-check passes.
- [ ] MCP unit tests pass.
- [ ] Project contract check passes; translation warnings have been reviewed.
- [ ] Static PR review workflow passes and its report artifact is available.
- [ ] Dependency audit report is available and all HIGH/CRITICAL advisories are triaged.
- [ ] Repository inventory generation is deterministic.
- [ ] AST graph generation is deterministic and parse diagnostics are reviewed.
- [ ] Generated repository map and AST graph are fresh.
- [ ] Feature maps, known issues and ADRs match current source.
- [ ] All changes are committed to the intended branch and CI checks correspond to the final commit.

## Owner-run checks requiring external access

- [ ] Connect the local MCP server to the intended MCP client and verify all ten tools and three resources.
- [ ] Verify Supabase production schema, applied migrations, RLS, grants, triggers, and Edge Function deployments.
- [ ] Verify production secrets and webhook settings without exposing secret values.
- [ ] Test critical user flows in real browsers and mobile devices.
- [ ] Verify every supported theme and all eight languages visually.
- [ ] Test PWA installation, update and cache recovery.
- [ ] Confirm upstream API behavior, rate limits and failure handling.

## Completion decision

Repository-verifiable checks may be marked complete from GitHub Actions evidence. Owner-run checks must not be marked complete based only on source inspection. If any external check cannot be performed, record it as an explicit handoff or open risk in `known-issues.md`.

Codebase Memory is a continuous maintenance system. Completion of this checklist is a point-in-time acceptance, not a guarantee that future changes remain safe without rerunning the checks.
