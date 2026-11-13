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

The local MCP server in `tools/codebase-memory-mcp/` is read-only. Search ranking, symbol definition classification, data-flow lookup and change-impact suggestions use text/keyword heuristics; they are not a complete AST or runtime dependency graph. Verify every candidate against current source. The server is not remotely hosted and does not automatically connect to ChatGPT.

## 8. Generated index freshness

This map is manually curated from the tracked repository at baseline commit `7b911f94acfedec5b4a477c0e7a7dc94344c4897`. It is not yet an automatically refreshed dependency graph. The Phase 2 MCP can warn when the local checkout commit differs from the recorded baseline, but it cannot refresh the map. Re-check the live repository before each change. Phase 3 should add deterministic index generation and stale-index validation.
