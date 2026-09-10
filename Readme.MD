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
