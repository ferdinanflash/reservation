# ADR-001: Preserve classic-script load order and global contracts

- **Status:** Accepted (describes current architecture)
- **Date:** 2026-11-14

## Context

The main application loads many deferred JavaScript files as classic scripts from `index.html`. Modules share globals and functions; they are split by feature but are not independent ES modules with explicit imports/exports.

## Decision

Treat script order and global symbol contracts as dependencies. Any refactor that changes loading, names, initialization timing or ownership must trace every consumer and update the HTML entry point in the same change.

## Consequences

- Feature fixes should start in the owning module but inspect shared callers/callees.
- Moving code between files requires checking globals and DOMContentLoaded timing.
- A future ES-module/bundler migration should be a separately planned architecture project with tests and staged rollout.
