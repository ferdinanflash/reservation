# Stage 4 — Discord Reliability Test & Security Audit

Audit snapshot: 2026-11-24 UTC, Supabase project `pwqkpeykjyujhnreleax` (Postgres 17.6).

## Changes in this stage

- Add a GitHub Actions workflow that runs the Deno Discord permission unit tests on relevant pull requests and pushes to `main`.
- Extend permission tests for Administrator bypass, @everyone channel overwrite grants, and missing-permission reporting.
- Revoke unnecessary `anon` and `authenticated` table privileges from the two private Discord poller cursor tables. The poller uses the service-role key; no browser/client policy is required.
- Pin `claim_discord_announcement_retries` to `pg_catalog, public` and retain execute permission for `service_role` only.

Apply migration `20261125020000_discord_poll_state_permissions.sql` before deploying any code that depends on the changed permissions. No data is deleted and the poller continues to use service_role.

## Discord-specific security review

- All Discord tables inspected have RLS enabled.
- Announcement queue, announcement history, guild settings, subscriptions, notification settings, and cleanup queue are service-role-only at the table grant layer.
- Poll cursor tables had unnecessary table privileges granted to `anon` and `authenticated`; the migration removes those grants. Their RLS policies remain absent, so client roles were already denied by RLS.
- `claim_discord_announcement_retries(integer, integer)` is SECURITY DEFINER, but execute permission is restricted to `service_role`. Its search path is now pinned to trusted schemas.
- President-only management endpoints validate the Supabase user against the configured internal President identities before using service-role database access.

## Project-wide Supabase Security Advisor findings (not silently changed)

The Security Advisor reported the following items. These are broader Reservation Portal concerns and need table-by-table/function-by-function review before changing access behavior.

### ERROR — RLS disabled on exposed public tables

1. `public.reservation_slots`: RLS disabled; broad table privileges exist for `anon` and `authenticated`; no policies were present. The public portal currently relies on direct table access, so enabling RLS without designing read/write policies would break reservations.
2. `public.system_settings`: RLS disabled; broad table privileges exist for `anon` and `authenticated`; no policies were present. The intended public-read/admin-write contract must be mapped before enabling RLS.
3. `public.player_transfers`: RLS disabled; broad table privileges exist. A policy named `Public can read applications for status check` exists with `USING (true)`, but is currently inactive because RLS is disabled. Public SELECT exposure should be narrowed to the minimum fields/use case.
4. `public.push_subscriptions`: RLS disabled; broad table privileges exist. Existing guest INSERT/UPDATE/DELETE policies use unconditional `true` predicates and would not become safe merely by enabling RLS. Subscription ownership and endpoint/token access need redesign.

**Do not run a blanket `ENABLE ROW LEVEL SECURITY` migration for these tables.** First map every frontend query, RPC, trigger, and service-role access path; then introduce narrowly scoped policies and verify guest reservation, President operations, transfer status lookup, and push notifications end-to-end.

### WARN — SECURITY DEFINER RPC exposure

The Advisor reported 21 SECURITY DEFINER functions executable by `anon` and 25 executable by `authenticated`. Examples include transfer-application, top-up, order-history, admin adjustment, API-key, and admin-code functions. Some may intentionally validate internal credentials in their function bodies; each definition must be inspected before revoking access. Prioritize administrative mutation functions and verify authorization inside the function itself, not only in the UI.

### WARN — Mutable function search paths

Eight functions were reported with mutable search paths, including reservation insert triggers, push subscription maintenance, `verify_admin_code`, and `panggil_validasi_token`. Pin trusted search paths after reviewing each function's object references.

### WARN — Auth leaked-password protection

Supabase Auth reports leaked-password protection disabled. Enable it in Auth settings after confirming the desired sign-up/password-change behavior.

## Verification checklist

- Deno permission tests are now wired into GitHub Actions; their pass/fail result must be read from the workflow run.
- Migration should be applied and then verified with:
  - RLS still enabled on both poll cursor tables.
  - No table grants for `anon` or `authenticated`.
  - `service_role` retains table privileges.
  - `claim_discord_announcement_retries` remains executable by `service_role` only and has `search_path=pg_catalog, public`.
- No production announcement or redeem poller was manually invoked during this audit.
