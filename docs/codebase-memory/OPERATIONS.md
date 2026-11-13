# Codebase Memory MCP — Operations Runbook

## Before changing application code

1. Confirm the active branch and latest commit.
2. Read `docs/codebase-memory/INDEX.md`, the relevant feature map, and `known-issues.md`.
3. Use the MCP `plan_change` tool (or the equivalent manual checklist) to identify likely source files, data integrations, and regressions.
4. Inspect the actual source and current SQL migrations. Treat generated graph edges as candidate evidence only.
5. Make the smallest change that preserves existing browser globals, script load order, API contracts and database behavior.

## Local validation

From the repository root:

```bash
cd tools/codebase-memory-mcp
npm install
npm run typecheck
npm test
npm run contracts
npm run review
npm run index
npm run ast
npm run check:index
```

For a PR-equivalent review, set `REVIEW_BASE` to the target branch and `REVIEW_HEAD` to the commit being reviewed. The local review command writes `code-review-report.md` in the current directory.

## Refresh generated memory

- `repository-map.json` and `ast-dependency-graph.json` are generated artifacts; do not hand-edit them.
- Run `npm run index` and `npm run ast` after source changes.
- Run `npm run check:index` to detect stale or missing inventory entries.
- Update semantic feature maps and ADRs manually when ownership, data flow, security boundaries or architecture change.
- On relevant pushes, GitHub Actions regenerates and commits changed generated artifacts. On pull requests, the generated artifacts must be part of the PR.

## Review reports and dependencies

- The PR review workflow uploads `3475-static-code-review` for 14 days.
- The memory workflow uploads `3475-codebase-memory-dependency-audit` for 14 days.
- Dependency audit is deliberately non-blocking until findings are triaged. Do not apply `npm audit fix --force` or bulk-upgrade dependencies without checking breaking changes and testing.
- Record each accepted risk, remediation decision and follow-up in `known-issues.md` or an ADR.

## Production-sensitive changes

Never infer live state from repository files. Before applying SQL or changing production Edge Functions, the owner must verify:

- Actual Supabase schema, migration history, constraints, indexes, triggers, grants and RLS policies.
- Edge Function deployment names, deployed versions, secrets and authorization.
- Webhook signatures, rate limits, upstream API contracts and error behavior.
- Browser-visible keys are public-only; service-role keys and private VAPID material remain server-side.

The local MCP has no write or deployment capability. It must remain read-only unless a separately reviewed architecture change explicitly authorizes another boundary.

## PWA and frontend release checklist

- Update `APP_BUILD` and relevant asset query versions when deploying frontend changes.
- Inspect `sw.js` cache version and precache/runtime asset lists.
- Check all eight languages and every supported theme for UI changes.
- Verify mobile and desktop layouts, keyboard access, touch interactions and browser console errors.
- Test a clean install and an upgrade from a previous PWA cache.

## Recovery and troubleshooting

- If the generated map is stale, rerun `npm run index`, `npm run ast`, then `npm run check:index`.
- If MCP cannot start, confirm Node.js 20+, run `npm install`, `npm run typecheck`, and inspect stderr. Do not log diagnostics to stdout (MCP stdio protocol).
- If an Actions bot push fails, inspect workflow permissions, branch rules and concurrent workflow runs before retrying.
- If the MCP reports a missing source path, confirm the current checkout and branch before changing feature maps.
- If a dependency audit reports vulnerabilities, inspect the advisory, affected dependency path, fix version and breaking-change risk; do not blindly force-upgrade.

## Boundaries

This runbook does not grant production access. Live Supabase, browser/device QA, external API behavior, GitHub secret values and deployed configuration require owner-controlled verification.
