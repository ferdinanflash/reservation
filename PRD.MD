# Product Requirement Document (PRD)

**Nama Proyek:** Reservation System Web App (reservation-main)  
**Versi:** 1.0  
**Tanggal:** 11 September 2026  
**Domain Utama:** `3475.web.id`  
**Status:** Draft / Active  

---

## 1. Ringkasan Produk (Executive Summary)
Aplikasi web berbasis **Progressive Web App (PWA)** yang dirancang untuk mengelola sistem pendaftaran, reservasi slot waktu, daftar tunggu (*waiting list*), dan manajemen data pengguna secara terintegrasi dengan basis data **Supabase**. 

Aplikasi ini dilengkapi dengan antarmuka multi-bahasa serta panel kontrol khusus **President Feature (Admin Mode)** untuk pengelolaan penuh seluruh alur kerja reservasi.

---

## 2. Tujuan & Sasaran Proyek (Objectives)
* **Efisiensi Pengguna:** Memudahkan pengguna umum dalam mengajukan reservasi, memilih slot waktu yang tersedia, dan memantau status antrean secara real-time.
* **Kontrol Terpusat (President Mode):** Menyediakan kontrol penuh bagi pengelola (President/Admin) untuk mengelola pendaftaran, kuota slot waktu, daftar tunggu, serta catatan internal secara responsif.
* **Portabilitas & Aksesibilitas:** Memastikan aplikasi dapat diakses dengan cepat melalui arsitektur PWA berbasis *Service Worker*.

---

## 3. Peran Pengguna (User Roles & Permissions)

| Peran | Otorisasi & Hak Akses |
| :--- | :--- |
| **Guest / User** | - Melihat ketersediaan slot waktu<br>- Mengajukan pendaftaran/reservasi<br>- Memantau status antrean & daftar tunggu<br>- Mengubah setelan bahasa UI |
| **President (Admin)** | - Akses ke **President Feature / Admin Panel**<br>- Menyetujui, menolak, atau memperbarui status pendaftaran<br>- Menambah, mengubah, dan membatasi slot waktu reservasi<br>- Mengelola daftar tunggu (*waiting list*) secara interaktif<br>- Memantau *time log* pendaftaran dan menambahkan catatan internal |

---

## 4. Spesifikasi Modul & Fitur Utama

### 4.1 Modul Autentikasi (`app-auth.js`)
* Integrasi dengan Supabase Auth untuk verifikasi identitas pengguna.
* Pembatasan hak akses berbasis peran (*role-based access control*).
* Penanganan status sesi login dan pembaruan token otomatis.

### 4.2 President Feature / Admin Mode (`app-applications.js`, `app-schedule.js`, `app-waiting.js`)
* **Manajemen Pendaftaran:** Peninjauan seluruh formulir pengajuan masuk beserta detail data pemohon.
* **Manajemen Slot Waktu:** Kontrol penuh atas pembukaan, penutupan, atau penambahan slot waktu reservasi.
* **Kontrol Daftar Tunggu:** Penyesuaian urutan dan pemindahan status antrean bagi pengguna yang terdaftar di *waiting list*.
* **Pencatatan & Catatan (`app-notes.js`):** Fasilitas penambahan catatan internal per pendaftaran serta audit *time log* pengajuan.

### 4.3 Modul Reservasi & Jadwal (`app-schedule.js`)
* Penayangan ketersediaan slot waktu yang sinkron secara real-time dengan basis data.
* Pencegahan *double-booking* melalui pembatasan kuota otomatis.

### 4.4 Modul Lokalisasi & Bahasa (`lang.js`)
* Dukungan multi-bahasa untuk seluruh komponen antarmuka pengguna (*UI strings*).
* Perpindahan bahasa secara fleksibel tanpa perlu memuat ulang seluruh halaman (*hot-reload text*).

### 4.5 Modul PWA & Visual (`sw.js`, `site.webmanifest`, `style.css`)
* *Service Worker* untuk pemuatan aset secara instan dan dukungan akses *offline-capable*.
* Visual animasi pembuka (*opening animation*) serta *banner* interaktif (`fire-banner.js`).

---

## 5. Arsitektur Teknis & Database

### 5.1 Tech Stack
* **Frontend:** Vanilla JavaScript (ES6 Modules), HTML5, CSS3, Service Worker.
* **Backend & Database:** Supabase (PostgreSQL).

### 5.2 Skema & Migrasi Database
* `supabase_migration_additional_time_slots.sql`: Penanganan skema slot waktu tambahan.
* `supabase_migration_application_time_log.sql`: Pencatatan *timestamp* dan log perubahan status pengajuan.
* `supabase_migration_fire_crystal_shard.sql`: Penanganan modul/kategori khusus pada basis data.

---

## 6. Rencana Pengembangan Selanjutnya (Roadmap)
* [ ] Integrasi **Web Push Notification** via Service Worker untuk pembaruan status pendaftaran pengguna secara instan.
* [ ] Fitur ekspor data pendaftaran dan rekapitulasi ke format **CSV / Excel** untuk kebutuhan pelaporan President/Admin.
* [ ] Peningkatan filter dan pencarian tingkat lanjut pada panel pendaftaran President.
