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
├── fire-banner.js                         # Custom animated banner UI element + seasonal themes (Halloween / Christmas / Valentine / Chinese New Year / Eid al-Fitr / Mid-Autumn)
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

## V17 update
- **`sw.js`: fixed two service-worker cache issues.**
  1. **Self-healing cache (stale-while-revalidate).** Static assets (`js/*.js`, `style.css`, `common.js`, `lang.js`, `fire-banner.js`) used to be pure cache-first: once cached, a URL was never checked against the network again. If a deploy ever changed a file's content but forgot to bump its `?v=` (or forgot to bump `CACHE_VERSION`), that stale copy would be served forever until someone manually cleared site data. Now every request for these files still answers instantly from cache, but also fires a background fetch that refreshes the cache for next time — so a forgotten version bump self-heals within one extra visit instead of staying stale indefinitely. Verified end-to-end with a Playwright test: changed a file's content without bumping its version, confirmed visit 1 still executes the old cached code (fast-path), and visit 2 already executes the corrected code with no cache clear.
  2. **No more wasted precache entries.** `PRECACHE` used to hardcode entries like `./js/app-core.js` (no query string), while the page actually requests `js/app-core.js?v=48`. Cache Storage keys on the full URL, so those two never matched — the no-query entry was precached on install and then never read by anyone, ever. `sw.js` now fetches `index.html` itself at install time, reads out the real `?v=`-versioned URLs it references, and precaches exactly those — no more drift, no more dead cache entries, and one less place to remember to update by hand. Verified the installed cache now holds exactly the 28 URLs the page actually requests, all with their correct `?v=`, zero no-query duplicates.
  - Icons/images/manifest that version themselves via filename (`-v8.png` etc.) are unaffected and still listed in a small `PRECACHE_STATIC` array.
  - Bumped `CACHE_VERSION` and `APP_BUILD` to `2026-09-21-06`.

## V16 update
- **All text now follows the active seasonal theme** (Halloween, Christmas, Valentine, Chinese New Year, Eid al-Fitr, Mid-Autumn Festival). Before this, only the buttons, the header logo and the footer names changed color; headings, labels, table text, modal text, the activity feed, links and the footer credit stayed white / grey / cyan.
  - `style.css` has a new "SEASONAL TEXT COLORS" block near the top: each theme defines a small set of `--t-*` color roles (`--t-strong`, `--t-primary`, `--t-soft`, `--t-secondary`, `--t-muted`, `--t-faint`, `--t-accent`, `--t-link`, `--t-gold`, `--t-amber`, ...). Text rules read them as `var(--t-muted, #8a8d98)`, so **outside a season nothing changes** (the fallback is the original color; verified identical computed colors on all elements).
  - Also themed: the cyan glow on the activity-feed title / names, the animated footer credit ("Made With ♥ By"), the Theme Switcher modal text, and the colors written inline in `index.html`, `app-applications.js`, `app-schedule.js`, `app-waiting.js`.
  - To tune a season's text colors, edit only its `body.<season>-theme { --t-... }` block.
  - Intentionally NOT themed: green (Accepted / success), red (Reject / error / President mode), the per-resource colors of the stat bars, the Discord button, and the opening animation (it already has its own per-season palette).
- Bumped `style.css`, `app-applications.js`, `app-schedule.js`, `app-waiting.js`, `APP_BUILD` and the cache version.

## V15 update
- Added a **Mid-Autumn Festival** seasonal theme (`midautumn`), active automatically every **19-27 September** (see `SEASONS.midautumn` in `fire-banner.js`; the inline script at the top of `<body>` in `index.html` has the same dates, keep them in sync) or on demand from the President's Theme Switcher (new 🌕 option, translated in all 6 languages). The dates are fixed each year; the festival itself follows the lunar calendar (25 Sep in 2026), so shift the range if you want it to follow the real date. It does not overlap any other automatic season.
  - New banner artwork `midautumn-banner-v1.jpg` (jade / red / gold "3475" under a full moon with rabbits, phoenixes, osmanthus, mooncakes, fireworks and lanterns), with 9 firework twinkles (`.midautumn-glow-spot`), 18 lantern flickers (`.midautumn-lantern-glow`), a slow breathing glow on the moon (`.midautumn-moon-glow`) and the embers canvas emitting rising gold / orange / lilac sparkles and 4-point stars.
  - The generator sparkle watermark in the bottom-right corner was removed by reversing its semi-transparent overlay, so the lantern and flowers underneath are restored (only that area was touched).
  - Buttons re-skinned via `body.midautumn-theme` (gold Apply with dark text, red Reject/Remove, jade Accept, midnight-purple President button); the header logo (🌕 in front) and footer names use a gold / cream / lilac shine; the opening animation follows the palette (🌕 around the title).
- **Required:** run `supabase_migration_theme_midautumn.sql` once in the Supabase SQL Editor (it keeps `cny` and `eid`); without it, saving "Mid-Autumn Festival" from the Theme Switcher is rejected by the `theme_override` CHECK constraint (the automatic dates work either way). `supabase_migration_theme_settings.sql` was updated for fresh installs.
- Added the image to the Service Worker precache; bumped `style.css`, `lang.js`, `fire-banner.js`, `APP_BUILD` and the cache version.

## V14 update
- Added an **Eid al-Fitr (Idul Fitri)** seasonal theme (`eid`). **It is never automatic**: it has no date range and is not part of the Auto calendar, so it only appears when the President picks it in the Theme Switcher (new 🌙 Eid al-Fitr option, translated in all 6 languages; the hint text says it is manual only). Choosing "Auto" or another theme switches it off again.
  - New banner artwork `eid-banner-v1.jpg` (golden "3475" before a green mosque with crescent moon, ketupat, hanging lanterns and an "Eid al-Fitr / Idul Fitri" ribbon), with 14 twinkles on its real lights (`.eid-art` / `.eid-glow-spot`), a warm flicker on the four hanging lanterns (`.eid-lantern-glow`) and the embers canvas emitting rising golden sparkles / 4-point stars. Shown whole on desktop like the other banners.
  - The small generator sparkle watermark in the bottom-right corner of the picture was removed (only that area of the image was touched).
  - Buttons re-skinned via `body.eid-theme` (gold Apply with dark text, red Reject/Remove, emerald Accept, deep-emerald President button); the header logo (🌙 in front) and footer names use an emerald / gold / cream shine; the opening animation follows the palette (🌙 around the title).
- **Required:** run `supabase_migration_theme_eid.sql` once in the Supabase SQL Editor (it also keeps `cny`); without it, saving "Eid al-Fitr" from the Theme Switcher is rejected by the `theme_override` CHECK constraint. `supabase_migration_theme_settings.sql` was updated for fresh installs.
- Added the image to the Service Worker precache; bumped `style.css`, `lang.js`, `fire-banner.js`, `APP_BUILD` and the cache version.

## V13 update
- Added a **Chinese New Year (Imlek)** seasonal theme (`cny`), on demand from the President's Theme Switcher (new 🏮 Chinese New Year option, translated in all 6 languages) or automatically on the dates listed in `CNY_DATES` in `fire-banner.js`. Chinese New Year follows the lunar calendar, so the dates are listed per year; a year that is not listed simply has no automatic Imlek banner. **2027: 6 - 13 Feb** (Imlek falls on 6 Feb 2027).
  - **No clash with Valentine:** the Chinese New Year check runs BEFORE the Valentine check, so on overlapping days Imlek wins and Valentine yields. In 2027 the automatic sequence is Valentine 1 - 5 Feb, Chinese New Year 6 - 13 Feb, Valentine again on 14 Feb (Valentine's Day itself). In years without a `CNY_DATES` entry, Valentine runs 1 - 14 Feb as before. For a later year add one line to `CNY_DATES` (months are 0-based, Feb = 1) and to the matching inline script at the top of `<body>` in `index.html` (keep the two in sync).
  - New banner artwork `cny-banner-v1.jpg` (red / gold "3475" wrapped by a dragon, lanterns, gold clouds, lucky coins, cherry blossoms and a "Chinese New Year" ribbon), with 16 twinkles on its real lights (`.cny-art` / `.cny-glow-spot`), a warm flicker on the three lanterns (`.cny-lantern-glow`) and the embers canvas emitting rising gold / red sparks plus drifting blossom petals. Shown whole on desktop, like the default, Christmas and Valentine banners.
  - The small generator sparkle watermark in the bottom-right corner of the picture was removed (only that area of the image was touched).
  - Buttons re-skinned via `body.cny-theme` (gold Apply with dark text, red Reject/Remove, jade-green Accept, red-lacquer President button); the header "SvS Minister" logo (🏮 in front) and footer names use a red / gold shine; the opening (intro) animation follows the palette (🏮 around the title).
- **Required:** run `supabase_migration_theme_cny.sql` once in the Supabase SQL Editor, otherwise saving "Chinese New Year" from the Theme Switcher is rejected by the `theme_override` CHECK constraint (the automatic dates work either way). `supabase_migration_theme_settings.sql` was updated for fresh installs.
- Added the image to the Service Worker precache; bumped `style.css`, `lang.js`, `fire-banner.js`, `APP_BUILD` and the cache version.

## V12 update
- Added a **Valentine** seasonal theme, active automatically every 1-14 February (see `SEASONS` in `fire-banner.js`) or on demand from the President's Theme Switcher (new 💖 Valentine option, translated in all 6 languages). It mirrors the Christmas / Halloween themes:
  - New banner artwork `valentine-banner-v1.jpg` (glittery pink / gold "3475" with cupid wings, roses, fireworks and a "Happy Celebration / Festival of Love" ribbon), with 18 twinkles placed on its real lights (`.valentine-art` / `.valentine-glow-spot`) and the embers canvas emitting softly rising pink / red / gold sparkles and tiny hearts. Shown whole on desktop, like the default and Christmas banners.
  - The small generator sparkle watermark in the bottom-right corner of the picture was removed (only that area of the image was touched).
  - Buttons re-skinned via `body.valentine-theme` (rose-pink Apply, crimson Reject/Remove, gold Accept, wine President button); the header "SvS Minister" logo (💖 in front) and footer names use a rose / white / gold shine; the opening (intro) animation follows the palette (💖 around the title).
  - The inline script at the top of `<body>` in `index.html` also knows the Valentine dates; keep them in sync with `SEASONS`.
- **Required:** run `supabase_migration_theme_valentine.sql` once in the Supabase SQL Editor. The `theme_override` column had a CHECK constraint that only allowed `auto` / `halloween` / `christmas` / `none`, so without it saving "Valentine" from the Theme Switcher fails (the automatic 1-14 Feb dates work either way). `supabase_migration_theme_settings.sql` was updated for fresh installs.
- Added the image to the Service Worker precache; bumped `style.css`, `fire-banner.js`, `APP_BUILD` and the cache version.

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
- Christmas banner cleanup: removed the floating 🎅🔔🎁 emoji (they clashed with the illustrated artwork) and the hidden `.christmas-glow-back` layer. The 6 twinkling spots, which were positioned for the old artwork, were replaced by 10 twinkles placed exactly on the picture's real lights (wreath bulbs, gold stars, sparkles). They now live inside `.christmas-art` so they sway together with the picture; their `left`/`top` are % of the picture, set inline in `index.html`.
- Fixed: the embers canvas now follows the banner's size (`ResizeObserver` plus a resize on every theme change), so switching live between Halloween (shorter on desktop) and Christmas/default no longer cuts the glitter off.
- Default banner review: the orange sparks now spawn around the flaming shield (30-70% of the width) instead of across the whole banner, so they no longer float in the dark background like fireflies.
- New safety net: `fire-banner.js` checks the banner picture of the ACTIVE theme (`ART_FILES`); if it fails to load (file missing, offline), it adds the class `art-failed` to `#fire-banner` and the old animated CSS fire digits come back (see the `art-failed` rules in `style.css`) instead of an empty banner. Each theme's picture is only requested while that theme is active. This also covers Halloween while `halloween-banner.png` is missing.
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
