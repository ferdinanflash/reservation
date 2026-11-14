# State 3475 — Whiteout Survival Management Portal

**Website:** [https://3475.web.id](https://3475.web.id)  
**Repository:** [ferdinanflash/reservation](https://github.com/ferdinanflash/reservation)  
**Project status:** Active development  
**Documentation updated:** 14 November 2026

Portal State 3475 adalah aplikasi web berbasis **Progressive Web App (PWA)** untuk mendukung pengelolaan State 3475 di Whiteout Survival. Aplikasi utama menggabungkan sistem reservasi Minister, pengelolaan SvS Enemies, riwayat SvS, informasi aktivitas terbaru, serta pintasan ke portal dan tools pendukung State.

---

## Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Menu dan Portal Terintegrasi](#menu-dan-portal-terintegrasi)
- [Teknologi](#teknologi)
- [Struktur Repository](#struktur-repository)
- [Integrasi Supabase](#integrasi-supabase)
- [Bahasa dan Tema](#bahasa-dan-tema)
- [Menjalankan Project](#menjalankan-project)
- [Deployment dan Pemeliharaan](#deployment-dan-pemeliharaan)
- [Lisensi dan Kepemilikan](#lisensi-dan-kepemilikan)

---

## Fitur Utama

### 1. Minister Reservation

Sistem reservasi slot waktu untuk posisi Minister di State 3475.

**Untuk pemain**
- Melihat jadwal dan ketersediaan slot.
- Mengajukan reservasi pada slot yang tersedia.
- Mengisi informasi akun/permainan yang diperlukan.
- Memantau status aplikasi, termasuk Waiting dan Accepted.

**Untuk President**
- Mengelola aplikasi dan status pemohon.
- Membuka detail pemohon, mengubah waktu/slot, menerima atau menolak aplikasi, dan menghapus data.
- Mengatur jadwal, kapasitas, dan slot tambahan.
- Mengelola waiting list.
- Menambahkan catatan internal serta meninjau Time Log perubahan.
- Mengelola pengaturan portal, pengumuman, informasi footer, dan tema.

### 2. SvS Enemies / TAL Enemies

Halaman untuk melihat informasi State lawan yang ditentukan oleh President.

- President dapat mengatur daftar State musuh.
- Label menu dapat dialihkan antara **SvS Enemies** dan **TAL Enemies**.
- Menampilkan informasi State, alliance, pemain, dan data terkait yang tersedia dari sumber WoS Atlas/ACE.
- Memiliki pemuatan bertahap dan antrean permintaan untuk mengurangi lonjakan request.
- Menggunakan cache persisten Supabase agar browser dapat membaca data tersimpan tanpa selalu meminta data upstream.
- Cache lama dapat diperbarui di latar belakang; data cache sebelumnya tetap dapat ditampilkan jika refresh lambat atau gagal.
- Menyediakan riwayat/matriks SvS berdasarkan tanggal yang dipilih.

**Sumber data:** endpoint publik `https://wosatlas.com/api/v1` dan Supabase Edge Function `wosatlas-states`. Integrasi ini tidak menggunakan endpoint lama `api.wosatlas.com/v1/states/summary`.

### 3. SvS Record

Halaman riwayat pertandingan SvS untuk State 3475.

- Menampilkan riwayat resmi State 3475 yang tersedia dari data permainan.
- Menampilkan timeline catatan pertandingan.
- President yang memiliki izin dapat menambahkan, mengedit, dan menghapus catatan.
- Data pertandingan dapat mencakup lawan, tanggal, hasil, skor PREP/BATTLE, dan perubahan skor sesuai kolom yang digunakan aplikasi.
- Pembaruan data dapat diterima melalui Supabase Realtime.

### 4. Recently Accepted Reservation

- Menampilkan hingga **20 reservasi yang baru diterima**, diurutkan berdasarkan pembaruan terbaru.
- Menampilkan informasi pemain dan posisi.
- Tag posisi khusus tersedia untuk VP D1, VP D2, EDU D4, dan VP D5.

### 5. Fitur Pendukung

- **Redeem Code:** mengirim permintaan penukaran gift code melalui Supabase Edge Function, termasuk pemrosesan beberapa Player ID dan penanganan hasil.
- **Discord Redeem Bot:** menyediakan slash command `/redeem single` untuk satu Player ID dan `/redeem alliance` untuk anggota aliansi. Bot memproses anggota secara berurutan dan menampilkan progres serta hasil redeem. Detail setup tersedia di [docs/DISCORD_BOT_REDEEM.md](docs/DISCORD_BOT_REDEEM.md).
- **Announcement:** President dapat mengirim pengumuman kepada pengguna.
- **Push Notification:** notifikasi untuk pembaruan reservasi dan pengumuman, bergantung pada izin perangkat dan konfigurasi push.
- **Donate dan Discord:** akses informasi dukungan dan komunitas.
- **What's New:** catatan pembaruan aplikasi.
- **Live Clock:** menampilkan waktu lokal pengguna.

---

## Menu dan Portal Terintegrasi

Menu utama aplikasi menghubungkan fitur internal dan portal terpisah berikut:

| Menu | Tujuan |
|---|---|
| Minister Reservation | Sistem reservasi Minister di aplikasi utama |
| SvS Enemies / TAL Enemies | Informasi State lawan |
| SvS Record | Riwayat SvS State 3475 |
| Battle Events | [tal.3475.web.id](https://tal.3475.web.id) |
| Transfer Portal | [transfer.3475.web.id](https://transfer.3475.web.id) |
| Events Record | [events.3475.web.id](https://events.3475.web.id) |
| WoS Tool | [calc.3475.web.id](https://calc.3475.web.id) |

Portal eksternal tersebut merupakan aplikasi terpisah dan bukan folder/submodul dari repository ini.

---

## Teknologi

| Bagian | Teknologi |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Realtime | Supabase Realtime |
| Backend/API | Supabase Edge Functions (Deno/TypeScript) |
| PWA | Web App Manifest, Service Worker, Web Push |
| Hosting | GitHub Pages dengan custom domain |
| Version control | Git dan GitHub |

Tidak menggunakan framework frontend besar; aplikasi utama dibuat dengan JavaScript modular.

---

## Struktur Repository

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

**Catatan:** daftar di atas menggambarkan file dan direktori penting, bukan seluruh aset gambar, video, ikon, atau file migrasi.

### Ringkasan modul JavaScript

| Modul | Tanggung jawab |
|---|---|
| `app-core.js` | Inisialisasi dan fungsi inti aplikasi |
| `app-auth.js` | Login, otorisasi President, pengaturan admin, dan pengumuman |
| `app-applications.js` | Pengajuan dan pengelolaan aplikasi reservasi |
| `app-bulk.js` | Operasi massal pada data reservasi |
| `app-schedule.js` | Jadwal dan slot reservasi |
| `app-waiting.js` | Waiting list dan pengurutan antrean |
| `app-notes.js` | Catatan internal dan Time Log |
| `app-notifications.js` | Langganan dan pengiriman notifikasi |
| `app-extras.js` | Recently Accepted, Redeem Code, What's New, Donate, dan fitur pendukung |
| `app-svs-enemies.js` | SvS/TAL Enemies dan integrasi WoS Atlas |
| `app-svs-record.js` | Riwayat dan pengelolaan SvS Record |

---

## Integrasi Supabase

Supabase digunakan sebagai database utama, autentikasi, realtime, dan backend serverless.

### Edge Functions

| Function | Kegunaan |
|---|---|
| `wosatlas-states` | Mengambil detail State, alliance, pemain, dan memperbarui cache data WoS Atlas |
| `redeem-giftcode` | Backend redeem bersama untuk website dan Discord bot |
| `discord-interactions` | Verifikasi signature Discord dan pemrosesan slash command redeem |
| `send-announcement` | Mengirim pengumuman President |
| `send-push-notification` | Mengirim push notification |

File function berada di `supabase/functions/`. Endpoint Discord memverifikasi signature Ed25519 dan dideploy dengan `--no-verify-jwt`; verifikasi signature di dalam function tetap wajib. `redeem-giftcode` tetap menggunakan verifikasi JWT normal dari gateway Supabase.

### Tabel dan migrasi

Repository menyimpan migrasi SQL untuk fitur seperti:
- Slot waktu tambahan dan kapasitas reservasi.
- Application Time Log.
- Fire Crystal Shard.
- Guest notifications dan push subscriptions.
- SvS Enemies settings, label menu, dan cache.
- Theme settings serta tema musiman.
- SvS Records.

Nama file migrasi yang tersedia dapat dilihat langsung di root repository. Terapkan migrasi yang sesuai dengan versi database dan fitur yang akan digunakan; jangan menjalankan ulang migrasi secara membabi buta pada database produksi.

### Konfigurasi

- Hubungkan project Supabase yang benar.
- Pastikan URL dan anon/public key yang digunakan frontend sesuai dengan project.
- Deploy Edge Functions yang diperlukan.
- Atur secrets server-side yang diminta oleh function. Jangan menaruh service-role key atau API secret di frontend/repository.
- Aktifkan konfigurasi Auth, Realtime, dan Web Push sesuai fitur yang digunakan.

Untuk integrasi WoS Atlas, function dapat menggunakan jalur publik terlebih dahulu dan API key server-side sebagai jalur opsional sesuai implementasi function.

---

## Bahasa dan Tema

### Bahasa

Antarmuka mendukung delapan bahasa:

1. English (EN)
2. Bahasa Indonesia (ID)
3. 简体中文 (CN)
4. Filipino (PH)
5. ไทย (TH)
6. Italiano (IT)
7. Русский (RU)
8. Français (FR)

Terjemahan dikelola di `lang.js`. Ketika menambahkan teks UI baru, tambahkan key dan terjemahannya untuk seluruh bahasa yang didukung.

### Tema visual

Aplikasi mendukung tema default dan tema musiman:
- Default
- Halloween
- Christmas
- Thanksgiving
- Valentine
- Chinese New Year
- Eid al-Fitr
- Mid-Autumn Festival
- Blue Fire

Tema dapat berubah otomatis pada periode kalender yang dikonfigurasi atau dipilih secara manual melalui Theme Switcher oleh President. Beberapa tema, seperti Eid, hanya tersedia melalui pemilihan manual. Aturan tanggal dan prioritas tema dikelola di `fire-banner.js` dan skrip inisialisasi tema pada `index.html`; jaga keduanya tetap sinkron.

Animasi banner, ikon, menu, dan elemen UI mengikuti tema aktif. Preferensi aksesibilitas seperti `prefers-reduced-motion` perlu tetap dihormati saat menambah animasi.

---

## Menjalankan Project

### Persyaratan
- Git
- Browser modern
- Web server lokal atau static hosting
- Project Supabase untuk fitur yang memerlukan database/backend

### Langkah

```bash
git clone https://github.com/ferdinanflash/reservation.git
cd reservation
python -m http.server 8000
```

Buka [http://localhost:8000](http://localhost:8000).

> Membuka `index.html` langsung melalui protokol `file://` tidak disarankan karena module, fetch, Service Worker, dan fitur browser tertentu membutuhkan HTTP/HTTPS.

### Deploy

Project utama dipublikasikan sebagai static site melalui GitHub Pages dan custom domain `3475.web.id`. Workflow deployment berada di `.github/workflows/static.yml`.

Setiap perubahan aset frontend perlu memperhatikan:
- Query version pada file JS/CSS di `index.html`.
- `APP_BUILD` untuk cache guard browser.
- `CACHE_VERSION` di `sw.js`.
- Daftar aset precache dan nama file aset versi baru.

Service Worker saat ini menggunakan precache URL yang mengikuti referensi aset dari HTML dan mekanisme pembaruan cache untuk membantu menghindari aset lama yang tertahan.

---

## Pemeliharaan

- Periksa tampilan desktop dan mobile setelah mengubah layout.
- Uji setiap bahasa setelah menambah atau mengubah teks.
- Uji tema default dan seluruh tema musiman setelah perubahan CSS/banner.
- Uji hak akses User dan President.
- Periksa log Supabase dan Edge Function saat integrasi API gagal.
- Jangan menghapus aset hanya berdasarkan nama atau usia file; pastikan tidak lagi direferensikan oleh HTML, CSS, JavaScript, manifest, atau Service Worker.
- Perbarui README dan PRD ketika fitur, struktur modul, integrasi, atau alur kerja berubah.

---

## Codebase Memory

Repository ini juga menyertakan dokumentasi arsitektur dan alat **Codebase Memory MCP** untuk membantu memahami struktur kode, alur data, integrasi, serta dampak perubahan.

- Dokumentasi utama: [docs/CODEBASE_MEMORY_MCP.md](docs/CODEBASE_MEMORY_MCP.md).
- Peta fitur dan catatan risiko: [docs/codebase-memory/INDEX.md](docs/codebase-memory/INDEX.md), folder `docs/codebase-memory/features/`, dan `docs/codebase-memory/known-issues.md`.
- Indeks inventaris source: `docs/codebase-memory/generated/repository-map.json`.
- Grafik dependensi AST: `docs/codebase-memory/generated/ast-dependency-graph.json`.
- Implementasi MCP lokal: `tools/codebase-memory-mcp/`. Server ini bersifat read-only dan tidak otomatis terhubung ke ChatGPT atau di-host sebagai layanan remote.
- Workflow `.github/workflows/codebase-memory-mcp.yml` menjalankan pemeriksaan yang dikonfigurasi untuk typecheck, tests, project contracts, pembaruan indeks/grafik, dan determinisme. Periksa hasil GitHub Actions aktual sebelum menyatakan pemeriksaan berhasil.

### Batasan dan pemeliharaan

Indeks inventaris dan grafik AST adalah hasil analisis statis; keduanya bukan bukti bahwa suatu jalur benar-benar berjalan saat runtime. Peta fitur dan known issues tetap perlu ditinjau manusia. Source aktif adalah acuan utama jika dokumentasi atau generated map berbeda.

Status Phase 1–10 dan kriteria penerimaan dipelihara di [docs/CODEBASE_MEMORY_MCP.md](docs/CODEBASE_MEMORY_MCP.md) dan [docs/codebase-memory/ROADMAP.md](docs/codebase-memory/ROADMAP.md); jangan menganggap semua fase selesai hanya berdasarkan nomor fase atau satu workflow yang sukses.

**Catatan redeem (14 November 2026):** website dan Discord bot menggunakan Edge Function `redeem-giftcode` yang sama. Investigasi signing Century Games menemukan canonicalization nilai sebelum MD5 (nilai biasa menggunakan URL encoding dan object menggunakan JSON). Redeem pada layanan live dilaporkan berhasil setelah perbaikan, tetapi source GitHub yang diperiksa masih perlu direkonsiliasi dengan implementasi live yang telah diuji sebelum deployment berikutnya. Jangan menaruh signing secret, bot token, atau kredensial server di README maupun source publik.

---

## Lisensi dan Kepemilikan

**Hak Cipta © 2026 Ferdinan. Seluruh hak dilindungi.**

Repository `ferdinanflash/reservation` dan website [3475.web.id](https://3475.web.id) merupakan proyek yang dimiliki dan dikelola oleh **Ferdinan**.

Kode sumber orisinal, logika aplikasi, desain orisinal, dokumentasi, dan materi lain yang dibuat khusus untuk proyek ini dilindungi hak cipta dan menggunakan lisensi **Proprietary — All Rights Reserved**. Tanpa izin tertulis terlebih dahulu dari Ferdinan, pihak lain tidak diperkenankan menyalin, menggunakan kembali, memodifikasi, mendistribusikan, menjual, atau membuat karya turunan dari materi proprietary tersebut.

Ketentuan lengkap terdapat pada file [LICENSE](LICENSE).

**Pengecualian:** library, framework, font, ikon, gambar, API, merek dagang, konten game, dan materi pihak ketiga bukan diklaim sebagai milik Ferdinan. Materi tersebut tetap tunduk pada hak cipta, lisensi, dan ketentuan pemilik masing-masing. Lisensi proyek ini tidak membatalkan atau menggantikan lisensi pihak ketiga.
