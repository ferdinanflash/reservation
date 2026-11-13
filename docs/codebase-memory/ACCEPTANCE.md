# Codebase Memory MCP — Final Acceptance Checklist

Use this checklist for a completion review and for future maintenance. A checkbox is complete only when its evidence is available.

## Repository-verifiable checks

- [x] MCP TypeScript type-check passes (GitHub Actions run [43521506377](https://github.com/ferdinanflash/reservation/actions/runs/43521506377)).
- [x] MCP unit tests pass (10 tests; run [43521506377](https://github.com/ferdinanflash/reservation/actions/runs/43521506377)).
- [x] Project contract check passes; translation warnings are recorded in ROADMAP.md and need product-language review (run [43521506377](https://github.com/ferdinanflash/reservation/actions/runs/43521506377)).
- [x] Static review workflow passes on direct pushes and its report artifact is available; the PR-specific base/head comparison still needs its first real PR test ([run 43521506313](https://github.com/ferdinanflash/reservation/actions/runs/43521506313)).
- [ ] Dependency audit report is available ([artifact run 43521506377](https://github.com/ferdinanflash/reservation/actions/runs/43521506377)); HIGH/CRITICAL advisories still require owner triage.
- [x] Repository inventory generation is deterministic (run [43521506377](https://github.com/ferdinanflash/reservation/actions/runs/43521506377)).
- [x] AST graph generation is deterministic; 0 parse diagnostics in the verified run [43521506377](https://github.com/ferdinanflash/reservation/actions/runs/43521506377).
- [x] Generated repository map and AST graph are fresh after the verified refresh run [43521506377](https://github.com/ferdinanflash/reservation/actions/runs/43521506377).
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


## Verification record

Latest complete repository validation: [Codebase Memory MCP run 43521506377](https://github.com/ferdinanflash/reservation/actions/runs/43521506377) — success. The static review run [43521506313](https://github.com/ferdinanflash/reservation/actions/runs/43521506313) also succeeded with zero BLOCKER and zero HIGH findings. These checks validate repository content only; they do not certify production Supabase state or browser/device behavior.
