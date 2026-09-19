# Reservation System Web App

A modern, responsive, and lightweight **Reservation & Queue Management System** built as a **Progressive Web App (PWA)**. Integrated with **Supabase** for real-time database management and authentication, this platform allows users to apply for time slot reservations while empowering administrators with full control via the **President Feature (Admin Mode)**.

**Domain:** [3475.web.id](https://3475.web.id)

--- 
## 🌟 Key Features

### 👤 User Features
* **Time Slot Reservation:** View available time slots in real-time and submit reservation applications seamlessly.
* **Waiting List Tracking:** Monitor reservation status and position in the waiting list.
* **Multi-language Support:** Easily toggle between multiple languages dynamically (`lang.js`).
* **PWA Capability:** Fast loading speeds, service worker caching, and offline support (`sw.js`).

### 👑 President Feature (Admin Mode)
* **Application Management:** Review, approve, reject, or update incoming reservation requests (`app-applications.js`).
* **Schedule & Slot Control:** Open, close, or adjust time slot availability and capacity (`app-schedule.js`).
* **Queue Control:** Reorder, promote, or manage users in the waiting queue (`app-waiting.js`).
* **Audit & Notes:** Track application submission time logs and attach internal administrative notes (`app-notes.js`).

--- 
## 🛠️ Tech Stack

* **Frontend:** Vanilla JavaScript (ES6 Modules), HTML5, CSS3, Service Workers (PWA)
* **Backend & Database:** Supabase (PostgreSQL)
* **Web Server / Hosting:** Static Web Hosting with CNAME configuration

--- 
## 📁 Project Structure

```text
reservation-main/
├── CNAME                                  # Custom domain config (3475.web.id)
├── index.html                             # Main application entrance
├── style.css                              # Main stylesheet
├── lang.js                                # Localization and language translations
├── common.js                              # Shared utility functions
├── sw.js                                  # Service Worker for PWA functionality
├── site.webmanifest                       # Web app manifest configuration
├── opening-animation.js                   # Visual opening sequence
├── fire-banner.js                         # Custom animated banner UI element
├── js/
│   ├── app-auth.js                        # Authentication & role authorization
│   ├── app-applications.js                # Application submission & President review
│   ├── app-schedule.js                    # Time slot rendering & management
│   ├── app-waiting.js                     # Waiting list management
│   ├── app-notes.js                       # Admin notes & time log auditing
│   ├── app-extras.js                      # Additional UI functionality
│   └── app-core.js                        # Core application initialization
└── supabase_migration_*.sql              # Database schema migrations
```

--- 
## 🚀 Getting Started

### Prerequisites
* A web server (e.g., Live Server, Nginx, Apache) or a static hosting platform (GitHub Pages, Vercel, Netlify).
* A **Supabase** project configured with authentication and database tables.

### Installation & Setup

1. **Clone or Extract the Project:**
   ```bash
   git clone <repository-url>
   cd reservation-main
   ```

2. **Configure Database & Migrations:**
   Run the SQL migration scripts in your Supabase SQL Editor:
   * `supabase_migration_additional_time_slots.sql`
   * `supabase_migration_application_time_log.sql`
   * `supabase_migration_fire_crystal_shard.sql`

3. **Run Locally:**
   Serve the root directory using any local development server:
   ```bash
   # Using Python 3
   python -m http.server 8000
   ```
   Open `http://localhost:8000` in your browser.

--- 
## 🔐 Role Access (President Feature)

* **User Role:** Granted by default upon user sign-up. Access is limited to viewing availability and submitting requests.
* **President Role:** Requires `President` / `Admin` privileges in Supabase Auth metadata or roles table. Unlocks full control over schedules, application approvals, and waiting list management.

--- 
## 📄 License

This project is proprietary and maintained for **3475.web.id**.

## V11 update
- **Fix:** the President's Theme Switcher choice was only stored in the President's own browser (`localStorage`), so other users never saw it. The choice is now saved in Supabase (`theme_settings` table, row `main`) and applies to every visitor.
- Visitors read the theme on load and receive changes live through Supabase Realtime, with a 60-second / tab-visible refresh as a fallback. `localStorage` (`svs_theme_override`) is now only a cache of the last server value.
- The Theme Switcher shows an error toast if saving fails (not logged in, or migration not run) instead of silently changing only the local screen.
- **Required:** run `supabase_migration_theme_settings.sql` once in the Supabase SQL Editor before deploying.
- Bumped `fire-banner.js`, `app-auth.js`, `lang.js`, `APP_BUILD` and the Service Worker cache version.
- Replaced the Christmas banner artwork with a new full-scene "3475 / Merry Christmas" illustration (`christmas-banner-v3.jpg`, ~220 KB instead of a 1.3 MB transparent PNG). It is shown whole (`background-size: cover`, no more transparent overlay on a gradient), so the Christmas banner is now taller on desktop than the other themes. The old `christmas-banner.png` was removed; the new file name also avoids stale browser/PWA caches. Bumped `style.css` and the Service Worker cache version.
- The "SvS Minister" logo in the header and the President / guild names in the footer now follow the seasonal theme: Christmas (candy-cane red / gold / holly green, 🎄 before the logo) and Halloween (pumpkin orange / witch violet / witch green, 🎃 before the logo), via `body.christmas-theme` / `body.halloween-theme` rules in `style.css`. The plain gold look returns automatically outside the seasons.
- The opening (intro) animation now follows the season too: glow, sparks, rays, the "3475" number, the line and the "SvS MINISTER" title switch to the Christmas or Halloween palette (🎄 / 🎃 around the title). Timing and layout are unchanged. A tiny inline script at the top of `<body>` in `index.html` sets the season class immediately (cached override or date), so the intro never flashes the orange colors first; keep its date ranges in sync with `SEASONS` in `fire-banner.js`.
- The default (non-seasonal) banner now uses new artwork, `default-banner-v2.jpg` (flaming "3475" shield), instead of the CSS/SVG fire digits. The gold/orange embers canvas still floats on top and a soft glow pulses over the flames. Like the Christmas banner it is shown whole on desktop (`.fire-banner:not(.halloween-theme)` rule in `style.css`). The old fire-digit markup is still in `index.html` but hidden; to bring it back, delete the `DEFAULT BANNER ART` block in `style.css`. Added the image to the Service Worker precache and bumped `style.css`, `APP_BUILD` and the cache version.
- Removed the small generator sparkle icon from the bottom-right corner of both banner images (default and Christmas). The cleaned files are `default-banner-v2.jpg` and `christmas-banner-v3.jpg`; new names avoid stale browser/PWA caches.
- Note: `halloween-banner.png` is referenced by `style.css` but was not included in the project zip; upload it next to `index.html` or the Halloween banner will show without its artwork.

## V10 update
- Added a Christmas seasonal banner theme (active automatically every 1-30 December), alongside the existing Halloween theme, reusing the same `#fire-banner` container and embers canvas (now emitting falling gold/red/green glitter instead of embers during Christmas).
- Unified the seasonal-theme logic in `fire-banner.js` behind a single `svs_theme_override` localStorage key (`auto` / `halloween` / `christmas` / `none`) and a public `window.SVSSeasonalTheme` API, while keeping the old Halloween-only override key working for backward compatibility.
- Added a **Theme Switcher** menu to the President panel (footer, admin-only) so the President can preview or force a specific banner theme instantly, without waiting for the calendar or editing localStorage by hand.
- Added `christmas-banner.png` artwork and matching festive (holly-green / candy-cane-red / gold) button re-skinning via `body.christmas-theme`, mirroring the existing Halloween button theme.
- Added i18n strings for the Theme Switcher across all 6 supported languages (EN/CN/ID/PH/TH/IT).
- Bumped `style.css`, `lang.js`, `app-core.js`, `app-auth.js`, `fire-banner.js` and the Service Worker cache versions to force clients to receive the new UI.

## V7 update
- Replaced native `window.prompt()` reason dialogs with a responsive HTML modal for consistent Android/PWA/iOS behavior.
- Reason modal is used for slot changes, slot moves, and rejection reasons.
- Build/cache versions bumped to force clients to receive the new UI.

## V9 update
- Fixed remaining Indonesian wording in the English Reason / Details modal.
- Bumped app and Service Worker cache versions to `2026-09-12-4` and language script to `lang.js?v=4`.

## V8 update
- Replaced the PWA/app icon with a custom Frost/Ice Flame shield design inspired by the project's winter-survival theme.
- Added versioned PWA, Apple Touch, favicon, and notification icon assets to reduce stale-icon caching on existing devices.
- Bumped Safari build and Service Worker cache versions.
