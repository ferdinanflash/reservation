# Codebase Memory: confirmed issues and verification gaps

Last reviewed: 2026-11-14

## 1. Missing base schema migrations

The repository contains incremental migrations that alter `public.reservation_slots`, but this snapshot does not include its authoritative base CREATE TABLE definition. Similar live-schema verification is needed for `system_settings`, `footer_settings` and `troops_power`, which are referenced by code but do not have a full base schema migration here.

**Rule:** do not design DB changes from client-side select/insert calls alone. Inspect the live schema, indexes, constraints, triggers and RLS first.

## 2. Legacy WoS Atlas summary route remains

`supabase/functions/wosatlas-states/index.ts` still defines a legacy `summary` handler against `https://api.wosatlas.com/v1/states/summary`; when no action is supplied, backend defaults to `summary`. Current SvS Enemies frontend calls explicit action values and uses the public-site API path in the backend. Avoid invoking the default action or restoring the retired endpoint without an explicit decision and verified credentials.

## 3. Gift-code signing secret fallback in source

The dedicated `redeem-giftcode` Edge Function source has a fallback signing-secret value. This is a security-review item. Do not reproduce the value in documentation. Confirm deployment configuration, rotate if it may have been exposed, and prefer requiring a Supabase secret rather than shipping a source fallback.

## 4. Duplicate gift-code Edge Function implementation

Both `supabase/functions/index.ts` and `supabase/functions/redeem-giftcode/index.ts` contain gift-code implementation material. Confirm Supabase deployment conventions/history before modifying either. Avoid allowing two implementations to drift.

## 5. Public portal boundaries

The main menu links to TAL, Transfer Portal, Events Record and WoS Tool as separate hostnames/projects. This repository contains the links, not the source for those products.

## 6. Live Supabase state not available from repository inspection

SQL files are migration instructions, not proof that they have been applied. Realtime publication membership, webhook configuration, secrets, RLS policy state and production table schemas require direct verification in Supabase.

## 7. MCP analysis limitations

The local MCP server in `tools/codebase-memory-mcp/` is read-only. Search ranking, symbol definition classification and data-flow lookup use text/keyword heuristics. Change-impact planning also traverses the generated AST graph, but it remains a conservative static candidate graph, not a complete runtime dependency graph. Verify every candidate against current source. The server is not remotely hosted and does not automatically connect to ChatGPT.

## 8. Generated index freshness

The structural inventory in `docs/codebase-memory/generated/repository-map.json` is refreshed by the Phase 3 generator and checked by GitHub Actions on relevant source/documentation changes. The local MCP compares the current tracked-file inventory and content hashes against the generated map and reports added, removed or modified files.

The AST generator infers statically discoverable syntax only and does not model a complete runtime dependency graph or rewrite semantic feature notes. Feature maps, data-flow explanations, known issues and live Supabase configuration still require human review. Re-check current source before every change; source remains authoritative.
\n## 9. Change-impact planning confidence\n\n`plan_change` ranks likely files from feature notes and keyword evidence, then traverses statically indexed import and function-call edges. The resulting files are candidates, not guaranteed edit targets. Dynamic dispatch, indirect callbacks, event listeners, data flow through runtime state, computed API paths, external consumers and deployed Supabase configuration may be missed or over-included. Inspect every proposed path and verify live contracts before editing.\n