# State 3475 — Whiteout Survival Management Portal

**Website:** [https://3475.web.id](https://3475.web.id)  
**Repository:** [ferdinanflash/reservation](https://github.com/ferdinanflash/reservation)  
**Project status:** Active development  
**Documentation updated:** 11 November 2026

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
- [Deployment and Maintenance](#deployment-and-maintenance)\n- [License and Ownership](#license-and-ownership)

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
├── index.html
├── style.css
├── lang.js
├── common.js
├── fire-banner.js
├── opening-animation.js
├── sw.js
├── site.webmanifest
├── CNAME
├── Readme.MD
├── Readme_EN.MD
├── PRD.MD
├── .github/
│   └── workflows/
│       └── static.yml
├── js/
│   ├── app-core.js
│   ├── app-auth.js
│   ├── app-applications.js
│   ├── app-bulk.js
│   ├── app-schedule.js
│   ├── app-waiting.js
│   ├── app-notes.js
│   ├── app-notifications.js
│   ├── app-extras.js
│   ├── app-svs-enemies.js
│   └── app-svs-record.js
├── images/
│   ├── furnace/
│   ├── resources/
│   ├── speedups/
│   └── check.svg
├── fonts/
├── live/
│   └── index.html
├── supabase/
│   └── functions/
│       ├── index.ts
│       ├── redeem-giftcode/
│       ├── send-announcement/
│       ├── send-push-notification/
│       └── wosatlas-states/
└── supabase_migration_*.sql
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
| `redeem-giftcode` | Processes gift-code redemption |
| `send-announcement` | Delivers President announcements |
| `send-push-notification` | Sends push notifications |

Function source files are under `supabase/functions/`.

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

## License and Ownership

**Copyright © 2026 Ferdinan. All rights reserved.**

The `ferdinanflash/reservation` repository and [3475.web.id](https://3475.web.id) website are owned and maintained by **Ferdinan**.

The original source code, application logic, original designs, documentation, and other materials specifically created for this project are protected by copyright and are licensed as **Proprietary — All Rights Reserved**. No one may copy, reuse, modify, distribute, sell, or create derivative works from these proprietary materials without Ferdinan's prior written permission.

See the [LICENSE](LICENSE) file for the complete terms.

**Exclusions:** Third-party libraries, frameworks, fonts, icons, images, APIs, trademarks, game content, and other materials not originally owned by Ferdinan are not claimed as Ferdinan's property. They remain subject to their respective owners' copyrights, licenses, and terms. This project license does not override any third-party license.
