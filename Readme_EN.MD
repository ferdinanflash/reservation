# State 3475 — Whiteout Survival Management Portal

**Website:** [https://3475.web.id](https://3475.web.id)  
**Repository:** [ferdinanflash/reservation](https://github.com/ferdinanflash/reservation)  
**Project status:** Active development  
**Documentation updated:** 14 November 2026

The State 3475 portal is a **Progressive Web App (PWA)** supporting the management of Whiteout Survival State 3475. The main application brings together Minister reservations, SvS enemy-State information, SvS history, recent reservation activity, and links to supporting State portals and tools.

---

## Contents

- [Core Features](#core-features)
- [Main Menu and Connected Portals](#main-menu-and-connected-portals)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Supabase Integration](#supabase-integration)
- [Languages and Themes](#languages-and-themes)
- [Run Locally](#run-locally)
- [Deployment and Maintenance](#deployment-and-maintenance)
- [License and Ownership](#license-and-ownership)

---

## Core Features

### 1. Minister Reservation

A time-slot reservation system for Minister positions in State 3475.

**Player experience**
- View the schedule and available time slots.
- Apply for an available slot.
- Submit the required in-game information.
- Track application status, including Waiting and Accepted.

**President controls**
- Review applications and applicant details.
- Change application status or assigned slot, accept or reject applications, and remove records.
- Manage schedules, capacity, and additional time slots.
- Manage the waiting list.
- Add internal notes and review application Time Logs.
- Manage portal settings, announcements, footer information, and the active theme.

### 2. SvS Enemies / TAL Enemies

A view of enemy States configured by the President.

- The President manages the enemy-State list.
- The menu label can switch between **SvS Enemies** and **TAL Enemies**.
- Displays available State, alliance, player, and related information from WoS Atlas/ACE.
- Uses queued loading to reduce bursts of upstream requests.
- Uses persistent Supabase caching so browsers can read stored State data without always calling the upstream service.
- Older cache entries can be refreshed in the background. Previously cached data can remain visible if a refresh is slow or fails.
- Includes a date-filtered SvS history/matrix.

**Data source:** the public `https://wosatlas.com/api/v1` endpoints and the Supabase Edge Function `wosatlas-states`. The integration does not use the retired `api.wosatlas.com/v1/states/summary` endpoint.

### 3. SvS Record

SvS match history for State 3475.

- Displays available official State 3475 history.
- Provides a match timeline.
- Authorized President users can add, edit, and delete records.
- Match data can include opponent, date, result, PREP/BATTLE scores, and score differences according to the fields used by the application.
- Data changes can be received through Supabase Realtime.

### 4. Recently Accepted Reservation

- Displays up to **20 recently accepted reservations**, ordered by most recently updated.
- Shows player and position information.
- Includes dedicated position tags for VP D1, VP D2, EDU D4, and VP D5.

### 5. Supporting Features

- **Redeem Code:** submits gift-code redemption requests through a Supabase Edge Function, including multi-Player-ID processing and result handling.
- **Discord Redeem Bot:** provides `/redeem single` for one Player ID and `/redeem alliance` for alliance members. The bot processes members sequentially and posts progress and redemption results. Setup details are in [docs/DISCORD_BOT_REDEEM.md](docs/DISCORD_BOT_REDEEM.md).
- **Announcements:** the President can send announcements to users.
- **Push Notifications:** reservation updates and announcements, subject to device permission and push configuration.
- **Donate and Discord:** community and support links.
- **What's New:** in-app release notes.
- **Live Clock:** displays the visitor's local time.

---

## Main Menu and Connected Portals

The main menu links to internal features and separate State portals:

| Menu | Destination |
|---|---|
| Minister Reservation | Minister reservation system in this application |
| SvS Enemies / TAL Enemies | Enemy-State information |
| SvS Record | State 3475 SvS history |
| Battle Events | [tal.3475.web.id](https://tal.3475.web.id) |
| Transfer Portal | [transfer.3475.web.id](https://transfer.3475.web.id) |
| Events Record | [events.3475.web.id](https://events.3475.web.id) |
| WoS Tool | [calc.3475.web.id](https://calc.3475.web.id) |

The linked portals are separate applications; they are not subdirectories or submodules of this repository.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Realtime | Supabase Realtime |
| Backend/API | Supabase Edge Functions (Deno/TypeScript) |
| PWA | Web App Manifest, Service Worker, Web Push |
| Hosting | GitHub Pages with a custom domain |
| Version control | Git and GitHub |

The main application uses modular JavaScript without a large frontend framework.

---

## Repository Structure

```text
reservation/
├── index.html                    # Entry point, UI markup, script references
├── style.css                     # Main styles, responsive layout, themes
├── lang.js                       # EN, ID, CN, PH, TH, IT, RU, FR translations
├── common.js                     # Shared browser utilities
├── fire-banner.js                # Seasonal banner/theme behavior
├── opening-animation.js          # Opening animation
├── sw.js                         # PWA service worker and cache versioning
├── site.webmanifest              # PWA manifest
├── CNAME                         # GitHub Pages custom domain
├── PRD.MD                        # Product requirements
├── Readme.MD                     # Indonesian project documentation
├── Readme_EN.MD                  # English project documentation
├── LICENSE / LICENSE_ID.md       # Proprietary ownership terms
├── config/                       # Project configuration files
├── fonts/                        # Local font assets
├── images/                       # UI and game-related image assets
├── live/
│   └── index.html                # Live/status page
├── scripts/                      # Repository utility scripts
├── js/                            # Modular frontend application
│   ├── app-core.js               # Initialization and shared core
│   ├── app-auth.js               # Authentication and President controls
│   ├── app-applications.js       # Reservation applications
│   ├── app-bulk.js               # Bulk reservation operations
│   ├── app-schedule.js           # Schedule and time slots
│   ├── app-waiting.js            # Waiting-list management
│   ├── app-notes.js              # Notes and Time Log
│   ├── app-notifications.js      # Notification subscriptions/delivery
│   ├── app-extras.js             # Redeem, Recently Accepted, What's New, extras
│   ├── app-svs-enemies.js        # SvS/TAL Enemies and WoS Atlas
│   └── app-svs-record.js         # SvS Record history
├── supabase/
│   └── functions/
│       ├── index.ts              # Legacy/root function source; verify before deployment
│       ├── discord-interactions/
│       │   └── index.ts          # Discord slash-command endpoint (Ed25519)
│       ├── redeem-giftcode/
│       │   └── index.ts          # Shared website + Discord redeem backend
│       ├── send-announcement/
│       ├── send-push-notification/
│       └── wosatlas-states/
├── supabase_migration_*.sql      # Database migrations (root-level)
├── svs_record_migration.sql
├── .github/
│   └── workflows/
│       ├── static.yml                    # Website publishing
│       ├── deploy-discord-redeem.yml     # Discord/redeem Edge Function deployment
│       ├── register-discord-commands.yml # Discord slash-command registration
│       ├── codebase-memory-mcp.yml       # Memory inventory, AST, tests/contracts
│       ├── codebase-memory-review.yml    # Static change review
│       └── source-protection-monitor.yml # Source-protection monitoring
└── docs/
    ├── CODEBASE_MEMORY_MCP.md
    ├── DISCORD_BOT_REDEEM.md
    ├── SOURCE_PROTECTION_MONITOR.md
    └── codebase-memory/
        ├── INDEX.md
        ├── ROADMAP.md
        ├── ACCEPTANCE.md
        ├── OPERATIONS.md
        ├── known-issues.md
        ├── decisions/
        ├── features/             # Feature architecture and data-flow maps
        └── generated/
            ├── repository-map.json       # Tracked-source inventory and digests
            └── ast-dependency-graph.json # Static AST dependency graph
└── tools/
    └── codebase-memory-mcp/
        ├── README.md
        ├── package.json
        ├── tsconfig.json
        ├── src/                  # Read-only MCP server and analysis modules
        ├── scripts/              # Inventory, AST, contracts, review generators
        └── test/                 # MCP, indexer, AST and impact-analysis tests
```

This is a high-level map of the important files and directories, not an exhaustive list of every image, video, icon, or migration.

### JavaScript modules

| Module | Responsibility |
|---|---|
| `app-core.js` | Application initialization and core behavior |
| `app-auth.js` | Login, President authorization, admin settings, and announcements |
| `app-applications.js` | Reservation applications and administration |
| `app-bulk.js` | Bulk operations on reservation data |
| `app-schedule.js` | Reservation schedule and time slots |
| `app-waiting.js` | Waiting-list and queue management |
| `app-notes.js` | Internal notes and Time Logs |
| `app-notifications.js` | Notification subscriptions and delivery |
| `app-extras.js` | Recently Accepted, Redeem Code, What's New, Donate, and supporting UI |
| `app-svs-enemies.js` | SvS/TAL Enemies and WoS Atlas integration |
| `app-svs-record.js` | SvS history and record management |

---

## Supabase Integration

Supabase provides the primary database, authentication, realtime updates, and serverless backend.

### Edge Functions

| Function | Purpose |
|---|---|
| `wosatlas-states` | Retrieves State, alliance, and player details and refreshes WoS Atlas cache data |
| `redeem-giftcode` | Shared redeem backend for the website and Discord bot |
| `discord-interactions` | Verifies Discord signatures and processes redeem slash commands |
| `send-announcement` | Delivers President announcements |
| `send-push-notification` | Sends push notifications |

Function source files are under `supabase/functions/`. The Discord endpoint verifies Ed25519 signatures itself and is deployed with `--no-verify-jwt`; in-function signature verification remains mandatory. `redeem-giftcode` retains normal Supabase gateway JWT verification.

### Database migrations

The repository includes SQL migrations for:
- Additional reservation time slots and capacity.
- Application Time Logs.
- Fire Crystal Shard.
- Guest notifications and push subscriptions.
- SvS Enemies settings, menu labels, and cached State data.
- Theme settings and seasonal themes.
- SvS Records.

See the migration files in the repository root. Apply migrations appropriate to the current database schema and deployed features; do not blindly re-run migrations against production.

### Configuration

- Connect the intended Supabase project.
- Ensure the frontend Supabase URL and anon/public key point to that project.
- Deploy the required Edge Functions.
- Configure server-side secrets required by each function. Never expose service-role keys or private API secrets in frontend code or the repository.
- Configure Auth, Realtime, and Web Push for the features being used.

For WoS Atlas, the Edge Function can try the public-site path first and use a server-side API key as an optional fallback, as implemented in the function.

---

## Languages and Themes

### Languages

The interface supports eight languages:

1. English (EN)
2. Bahasa Indonesia (ID)
3. 简体中文 (CN)
4. Filipino (PH)
5. ไทย (TH)
6. Italiano (IT)
7. Русский (RU)
8. Français (FR)

Translations are maintained in `lang.js`. Add translations for every supported language whenever new UI text is introduced.

### Visual themes

The application supports a default theme and seasonal themes:
- Default
- Halloween
- Christmas
- Thanksgiving
- Valentine
- Chinese New Year
- Eid al-Fitr
- Mid-Autumn Festival
- Blue Fire

Themes can switch automatically during configured calendar periods or be selected manually by the President through the Theme Switcher. Some themes, such as Eid, are manual-only. Theme dates and priority are maintained in `fire-banner.js` and the early theme-initialization script in `index.html`; keep these definitions synchronized.

Banner effects, icons, menu elements, and UI styling follow the active theme. Respect accessibility preferences such as `prefers-reduced-motion` when adding animations.

---

## Run Locally

### Requirements
- Git
- A modern browser
- A local HTTP server or static hosting
- A Supabase project for database/backend features

### Steps

```bash
git clone https://github.com/ferdinanflash/reservation.git
cd reservation
python -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000).

> Opening `index.html` directly with the `file://` protocol is not recommended because JavaScript modules, fetch, Service Worker, and other browser features require HTTP/HTTPS.

### Deployment

The main application is published as a static site through GitHub Pages with the custom domain `3475.web.id`. The deployment workflow is located at `.github/workflows/static.yml`.

When changing frontend assets, review:
- JS/CSS query versions in `index.html`.
- `APP_BUILD` for the browser cache guard.
- `CACHE_VERSION` in `sw.js`.
- The precache asset list and versioned asset filenames.

The current Service Worker derives precache URLs from the HTML asset references and refreshes cached assets to help prevent stale files from persisting.

---

## Maintenance

- Check desktop and mobile layouts after UI changes.
- Test all supported languages after adding or changing text.
- Test the default theme and seasonal themes after CSS/banner changes.
- Verify both User and President permissions.
- Check Supabase and Edge Function logs when an upstream integration fails.
- Do not remove assets based only on their names or age; confirm they are no longer referenced by HTML, CSS, JavaScript, the manifest, or the Service Worker.
- Update the README and PRD when features, modules, integrations, or workflows change.

---

## Codebase Memory

This repository also includes **Codebase Memory MCP** documentation and tooling to help explain source structure, data flows, integrations, and the impact of proposed changes.

- Main architecture and usage: [docs/CODEBASE_MEMORY_MCP.md](docs/CODEBASE_MEMORY_MCP.md).
- Feature maps and risk notes: [docs/codebase-memory/INDEX.md](docs/codebase-memory/INDEX.md), `docs/codebase-memory/features/`, and `docs/codebase-memory/known-issues.md`.
- Generated source inventory: `docs/codebase-memory/generated/repository-map.json`.
- Generated AST dependency graph: `docs/codebase-memory/generated/ast-dependency-graph.json`.
- Local MCP implementation: `tools/codebase-memory-mcp/`. The server is read-only and is not automatically connected to ChatGPT or hosted as a remote service.
- The `.github/workflows/codebase-memory-mcp.yml` workflow runs its configured typecheck, tests, project-contract checks, index/graph generation, and determinism checks. Inspect the actual GitHub Actions run before reporting any check as successful.

### Limitations and maintenance

The inventory and AST graph are static-analysis outputs; they do not prove that a path executes at runtime. Feature maps and known issues still require human review. Active source code is authoritative whenever documentation or generated maps disagree.

Phase 1–10 status and acceptance criteria are maintained in [docs/CODEBASE_MEMORY_MCP.md](docs/CODEBASE_MEMORY_MCP.md) and [docs/codebase-memory/ROADMAP.md](docs/codebase-memory/ROADMAP.md). Do not assume every phase is complete based only on its phase number or a single successful workflow run.

**Redeem note (14 November 2026):** the website and Discord bot use the same `redeem-giftcode` Edge Function. The Century Games signing investigation identified value canonicalization before MD5 (ordinary values are URL-encoded and objects are serialized as JSON). Redemption on the live service was reported working after the fix, but the reviewed GitHub source still needs to be reconciled with the tested live implementation before the next deployment. Never place signing secrets, bot tokens, or server credentials in this README or public source.

---

## License and Ownership

**Copyright © 2026 Ferdinan. All rights reserved.**

The `ferdinanflash/reservation` repository and [3475.web.id](https://3475.web.id) website are owned and maintained by **Ferdinan**.

The original source code, application logic, original designs, documentation, and other materials specifically created for this project are protected by copyright and are licensed as **Proprietary — All Rights Reserved**. No one may copy, reuse, modify, distribute, sell, or create derivative works from these proprietary materials without Ferdinan's prior written permission.

See the [LICENSE](LICENSE) file for the complete terms.

**Exclusions:** Third-party libraries, frameworks, fonts, icons, images, APIs, trademarks, game content, and other materials not originally owned by Ferdinan are not claimed as Ferdinan's property. They remain subject to their respective owners' copyrights, licenses, and terms. This project license does not override any third-party license.
