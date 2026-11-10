# PRODUCT REQUIREMENTS DOCUMENT (PRD)

**Nama Proyek:** State 3475 — Whiteout Survival Management Portal  
**Repository:** `ferdinanflash/reservation`  
**Domain Utama:** `https://3475.web.id`  
**Versi Dokumen:** 2.0  
**Tanggal Pembaruan:** 11 November 2026  
**Status:** Active Development

---

## 1. Ringkasan Produk

State 3475 Management Portal adalah aplikasi web berbasis **Progressive Web App (PWA)** untuk mendukung operasional komunitas Whiteout Survival State 3475.

Aplikasi utama menyediakan:
- Reservasi posisi Minister berbasis slot waktu.
- Pengelolaan aplikasi, jadwal, waiting list, dan aktivitas President.
- Informasi State lawan melalui SvS Enemies / TAL Enemies.
- Riwayat pertandingan SvS State 3475.
- Ringkasan reservasi terbaru yang diterima.
- Redeem Code, pengumuman, notifikasi, pengaturan tema, dan dukungan multibahasa.
- Navigasi ke portal Battle Events, Transfer Portal, Events Record, dan WoS Tool yang dikelola sebagai aplikasi terpisah.

Frontend di-host sebagai static site, sedangkan data, autentikasi, realtime, dan proses server-side terintegrasi dengan Supabase.

## 2. Tujuan Produk

1. Menyediakan alur reservasi Minister yang mudah digunakan dan transparan.
2. Memberikan President kontrol administratif atas pemohon, jadwal, kuota, antrean, dan pengumuman.
3. Menyajikan informasi State lawan dan riwayat SvS dari sumber data yang relevan.
4. Menyediakan pengalaman konsisten pada desktop, perangkat mobile, dan instalasi PWA.
5. Mendukung komunitas multibahasa dan tema visual yang dapat berubah sesuai musim.
6. Menjaga stabilitas integrasi API melalui cache, antrean request, dan penanganan kegagalan.

## 3. Ruang Lingkup

### 3.1 Termasuk dalam repository ini

- Main dashboard dan navigasi.
- Minister Reservation.
- President/admin controls untuk reservasi.
- SvS Enemies / TAL Enemies.
- SvS Record.
- Recently Accepted Reservation.
- Redeem Code, Announcement, push notification UI, What's New, Donate, dan Discord.
- PWA, service worker, banner, animasi, bahasa, dan tema.
- Supabase Edge Functions serta SQL migrations yang terkait.

### 3.2 Portal eksternal

Menu utama juga menyediakan tautan ke aplikasi terpisah:
- Battle Events — `https://tal.3475.web.id`
- Transfer Portal — `https://transfer.3475.web.id`
- Events Record — `https://events.3475.web.id`
- WoS Tool — `https://calc.3475.web.id`

Fitur internal, database, dan deployment portal eksternal tersebut berada di luar ruang lingkup repository ini, kecuali integrasi tautan navigasinya.

## 4. Pengguna dan Hak Akses

| Peran | Hak akses |
|---|---|
| Guest / Player | Melihat slot, mengajukan reservasi, melihat status aplikasi dan informasi publik, memilih bahasa, serta menggunakan fitur publik |
| President / Admin | Seluruh akses publik ditambah pengelolaan aplikasi, jadwal, kuota, antrean, catatan, pengaturan State musuh, SvS Record, pengumuman, footer, dan tema sesuai otorisasi |

Hak administratif harus diperiksa melalui mekanisme autentikasi/otorisasi aplikasi dan Supabase. Kontrol UI saja tidak boleh dianggap sebagai pengganti validasi akses di backend/database.

## 5. Persyaratan Fungsional

### 5.1 Minister Reservation

**FR-RES-01 — Tampilan jadwal**
- Sistem menampilkan posisi dan slot waktu reservasi yang tersedia.
- Ketersediaan dan kapasitas mengikuti data Supabase.

**FR-RES-02 — Pengajuan reservasi**
- Pemain dapat memilih slot yang tersedia.
- Pemain mengisi informasi dalam game yang diwajibkan.
- Sistem menyimpan pengajuan dan menampilkan statusnya.

**FR-RES-03 — Status dan antrean**
- Sistem mendukung status aplikasi, termasuk Waiting dan Accepted, serta status lain yang diizinkan implementasi.
- Pemain dapat memantau status aplikasi.
- Waiting menunjukkan slot memiliki pemohon tetapi belum memiliki pemohon Accepted.

**FR-RES-04 — President application management**
- President dapat membuka detail pemohon.
- President dapat mengubah status, waktu/slot, dan menghapus aplikasi.
- Pemindahan slot harus mempertahankan status sebelumnya dan mencatat perubahan pada Time Log sesuai aturan aplikasi.
- President dapat melakukan operasi massal yang disediakan UI.

**FR-RES-05 — Schedule management**
- President dapat mengelola slot, kapasitas, pembukaan/penutupan, dan slot waktu tambahan.
- Sistem harus menghindari pemakaian kapasitas yang melebihi batas yang ditetapkan.

**FR-RES-06 — Internal notes and audit**
- President dapat menambahkan catatan internal.
- Perubahan aplikasi yang relevan dicatat dalam Time Log agar dapat ditinjau kembali.

### 5.2 SvS Enemies / TAL Enemies

**FR-ENM-01 — Enemy State configuration**
- President dapat mengatur daftar nomor State lawan.
- Label menu dapat dipilih sebagai SvS Enemies atau TAL Enemies.
- Label halaman dan deskripsi harus mengikuti pilihan menu aktif.

**FR-ENM-02 — State information**
- Sistem mengambil informasi State, alliance, dan pemain yang tersedia dari WoS Atlas/ACE.
- Data ditampilkan untuk setiap State yang dikonfigurasi.
- Sistem mendukung refresh data.

**FR-ENM-03 — Request management**
- Pemuatan State dilakukan dengan antrean/konkurensi terbatas untuk mengurangi lonjakan request.
- Kegagalan pada satu State tidak boleh menghalangi pemrosesan semua State lainnya.
- Retry dan pesan error harus memberikan konteks State yang bermasalah.

**FR-ENM-04 — Persistent cache**
- Browser membaca cache State dari tabel Supabase `svs_enemy_cache`.
- Edge Function `wosatlas-states` memperbarui cache sesuai aturan throttling.
- Data cache yang masih layak digunakan harus tetap dapat ditampilkan ketika refresh gagal atau terlalu lama.
- Cache yang lebih lama dari ambang refresh dapat diperbarui di latar belakang.

**FR-ENM-05 — Match history matrix**
- Halaman menyediakan matriks/riwayat SvS untuk State lawan.
- Pengguna dapat memilih tanggal yang ingin ditampilkan, termasuk menambah atau menghapus pilihan tanggal.

**Sumber upstream:** `https://wosatlas.com/api/v1`. Endpoint lama `https://api.wosatlas.com/v1/states/summary` tidak digunakan oleh implementasi saat ini.

### 5.3 SvS Record

**FR-SVSR-01 — Official State 3475 history**
- Halaman menampilkan riwayat resmi State 3475 yang tersedia dari data permainan.
- Ringkasan mencakup hasil PREP dan Castle sesuai data yang tersedia.

**FR-SVSR-02 — Match timeline**
- Sistem menampilkan daftar/timeline pertandingan.
- Catatan dapat memuat tanggal, lawan, hasil, skor PREP/BATTLE, dan selisih skor sesuai skema tabel.

**FR-SVSR-03 — Record administration**
- President yang berwenang dapat menambah, mengubah, dan menghapus record.
- Perubahan data harus tercermin pada tampilan setelah pemuatan ulang atau event realtime.

**FR-SVSR-04 — Realtime**
- Perubahan tabel SvS Records dapat disinkronkan melalui Supabase Realtime.

### 5.4 Recently Accepted Reservation

**FR-RAR-01**
- Sistem menampilkan maksimal 20 reservasi Accepted terbaru.
- Urutan berdasarkan `updated_at` terbaru.
- Setiap item menampilkan informasi pemain/posisi yang tersedia.
- Posisi khusus memiliki tag: VP D1, VP D2, EDU D4, dan VP D5.

### 5.5 Redeem Code

**FR-RED-01**
- Pengguna dapat mengirim kode redeem beserta satu atau beberapa Player ID sesuai batas input.
- Nama pemain dapat diperkaya dari data yang tersedia di Supabase.
- Permintaan diproses melalui Edge Function `redeem-giftcode`.
- UI menampilkan hasil per Player ID, termasuk sukses, gagal, pending, dan retry untuk kondisi timeout sesuai respons backend.
- Secret/API key tidak boleh disimpan di frontend.

### 5.6 Announcement dan Push Notification

**FR-NOT-01**
- President dapat membuat dan mengirim pengumuman.
- Pengiriman pengumuman diproses melalui Edge Function `send-announcement`.
- Pengguna dapat mengaktifkan notifikasi perangkat jika browser mendukung dan izin diberikan.
- Perubahan status reservasi dan pengumuman dapat dikirim melalui Web Push menggunakan Edge Function `send-push-notification`.
- Kegagalan izin, subscription, atau pengiriman harus ditangani tanpa merusak fungsi reservasi utama.

### 5.7 What's New dan fitur pendukung

- Modal What's New menampilkan catatan rilis aplikasi.
- Donate modal dan Discord menyediakan akses komunitas.
- Live clock menyesuaikan waktu lokal pengguna.
- Recently Accepted menampilkan aktivitas reservasi terbaru.

### 5.8 Bahasa dan lokalisasi

**FR-I18N-01**
- Delapan bahasa tersedia: EN, ID, CN, PH, TH, IT, RU, FR.
- Terjemahan UI dikelola melalui `lang.js`.
- Teks dinamis, status, tombol, pesan validasi, modal, dan notifikasi yang terlihat oleh pengguna harus menggunakan key terjemahan bila relevan.
- Menambahkan key baru berarti melengkapi seluruh bahasa yang didukung.
- Pemilihan bahasa harus konsisten pada tampilan utama dan komponen dinamis.

### 5.9 PWA, tema, dan antarmuka

**FR-PWA-01**
- Aplikasi menyediakan manifest, ikon, dan Service Worker.
- Aset penting dapat di-cache untuk mempercepat pemuatan dan mendukung pengalaman PWA.
- Strategi cache harus menghindari aset lama yang terus tersaji setelah deployment.

**FR-UI-01**
- Layout responsif untuk desktop dan perangkat mobile.
- Banner, animasi pembuka, ikon, menu, dan komponen UI menyesuaikan tema aktif.
- Tema yang didukung: Default, Halloween, Christmas, Thanksgiving, Valentine, Chinese New Year, Eid al-Fitr, Mid-Autumn Festival, dan Blue Fire.
- Tema mengikuti kalender yang dikonfigurasi atau pilihan manual President; tema manual-only tidak boleh diasumsikan aktif otomatis.
- Animasi harus menghormati `prefers-reduced-motion`.
- Ornamen dekoratif tidak boleh menutupi kontrol utama atau mengganggu keterbacaan.

## 6. Persyaratan Non-Fungsional

| ID | Persyaratan |
|---|---|
| NFR-01 | Antarmuka harus responsif dan dapat digunakan pada perangkat mobile maupun desktop. |
| NFR-02 | Operasi database dan fungsi administratif harus mengikuti otorisasi yang benar. |
| NFR-03 | Secret backend tidak boleh dikirim ke browser atau disimpan dalam repository publik. |
| NFR-04 | Kegagalan API upstream tidak boleh menyebabkan seluruh halaman gagal ditampilkan jika cache tersedia. |
| NFR-05 | Request upstream harus dibatasi melalui antrean, cache, dan throttling yang sesuai. |
| NFR-06 | Teks UI harus tersedia dalam delapan bahasa yang didukung. |
| NFR-07 | Perubahan aset harus memperhatikan versi file, APP_BUILD, dan Service Worker cache. |
| NFR-08 | Animasi dan efek visual harus tetap memperhatikan aksesibilitas serta performa perangkat. |
| NFR-09 | Data yang ditampilkan harus berasal dari database atau sumber upstream yang teridentifikasi; error harus ditampilkan secara jelas. |

## 7. Arsitektur Teknis

### 7.1 Frontend

- HTML5 dan CSS3.
- Vanilla JavaScript modular.
- `index.html` sebagai entry point.
- `style.css` untuk layout, komponen, responsivitas, tema, dan animasi.
- `lang.js` untuk terjemahan delapan bahasa.
- `fire-banner.js` untuk banner dan logika tema musiman.
- `opening-animation.js` untuk animasi pembuka.
- `sw.js` untuk cache PWA dan strategi pembaruan aset.

### 7.2 JavaScript modules

| File | Tanggung jawab |
|---|---|
| `app-core.js` | Bootstrap dan fungsi inti |
| `app-auth.js` | Auth, role/admin, pengaturan President |
| `app-applications.js` | Pengajuan dan administrasi reservasi |
| `app-bulk.js` | Operasi massal |
| `app-schedule.js` | Slot dan jadwal |
| `app-waiting.js` | Waiting list |
| `app-notes.js` | Catatan dan Time Log |
| `app-notifications.js` | Subscription dan notifikasi |
| `app-extras.js` | Redeem Code, Recently Accepted, What's New, Donate, dan fitur tambahan |
| `app-svs-enemies.js` | Enemy State, WoS Atlas, cache, dan matriks |
| `app-svs-record.js` | Riwayat SvS dan administrasi record |

### 7.3 Backend

Supabase menyediakan:
- PostgreSQL untuk penyimpanan data.
- Auth untuk identitas dan sesi.
- Realtime untuk pembaruan data.
- Edge Functions untuk integrasi API dan proses server-side.
- SQL migrations untuk perubahan skema.

Edge Functions utama:
- `wosatlas-states`
- `redeem-giftcode`
- `send-announcement`
- `send-push-notification`

### 7.4 Hosting dan deployment

- Static hosting melalui GitHub Pages.
- Custom domain `3475.web.id`.
- Workflow deployment: `.github/workflows/static.yml`.
- Edge Functions dideploy ke project Supabase secara terpisah dari frontend.

## 8. Data dan Database Migrations

Repository menyediakan migration SQL untuk beberapa kelompok fitur:
- Reservasi dan slot tambahan.
- Application Time Log.
- Fire Crystal Shard.
- Guest notifications dan push subscriptions.
- SvS Enemies settings, menu label, dan cache.
- Theme settings dan constraint tema musiman.
- SvS Records.

Nama migration yang tersedia di root repository merupakan sumber daftar aktual. Urutan penerapan harus disesuaikan dengan keadaan database; backup dan pemeriksaan schema diperlukan sebelum perubahan produksi. Migration tidak boleh dijalankan berulang tanpa memeriksa apakah operasi bersifat idempotent.

## 9. Struktur Repository

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
├── .github/workflows/static.yml
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
├── fonts/
├── live/
│   └── index.html
├── supabase/functions/
│   ├── index.ts
│   ├── redeem-giftcode/index.ts
│   ├── send-announcement/index.ts
│   ├── send-push-notification/index.ts
│   └── wosatlas-states/index.ts
└── supabase_migration_*.sql
```

Daftar tersebut merupakan ringkasan struktur penting. Aset dan file migration lengkap tetap berada di repository.

## 10. Kriteria Penerimaan

| Area | Kriteria |
|---|---|
| Reservation | Pemain dapat melihat slot dan mengirim aplikasi; President dapat mengelola aplikasi dan jadwal sesuai role. |
| Waiting list | Status dan urutan antrean tampil konsisten dengan database. |
| Time Log | Perubahan penting tercatat dan dapat dilihat oleh President. |
| SvS Enemies | Daftar State dapat dikelola; data cache dapat ditampilkan; error satu State tidak menghentikan State lainnya. |
| SvS Record | Riwayat resmi dan timeline tampil; President dapat mengelola record; perubahan realtime tercermin. |
| Recently Accepted | Maksimal 20 item terbaru ditampilkan dengan tag posisi yang sesuai. |
| Redeem Code | Hasil permintaan ditampilkan per Player ID tanpa mengekspos secret. |
| Notification | Subscription dan pengiriman mengikuti izin perangkat serta konfigurasi server. |
| Localization | Tidak ada teks UI baru yang tertinggal tanpa terjemahan pada delapan bahasa. |
| PWA/UI | Aplikasi dapat dimuat melalui HTTPS, aset terbarui setelah deployment, dan layout bekerja di mobile/desktop. |
| Themes | Tema manual/otomatis mengikuti konfigurasi dan tidak merusak keterbacaan atau kontrol UI. |

## 11. Operasional, Keamanan, dan Pemeliharaan

- Gunakan Supabase Auth dan pemeriksaan otorisasi untuk fungsi President.
- Batasi akses tabel melalui kebijakan database yang sesuai.
- Simpan API key dan service-role key hanya sebagai server-side secrets.
- Pantau log Edge Functions dan Supabase ketika upstream API mengalami kegagalan.
- Pertahankan cache fallback untuk data WoS Atlas agar gangguan sementara tidak mengosongkan tampilan.
- Setelah mengubah file JS/CSS, periksa query version di `index.html`, `APP_BUILD`, `CACHE_VERSION`, dan daftar precache.
- Uji bahasa, tema, animasi, mobile layout, serta role User/President sebelum rilis.
- Pastikan file yang dihapus tidak lagi direferensikan oleh HTML, CSS, JavaScript, manifest, atau Service Worker.

## 12. Roadmap dan Pekerjaan Lanjutan

Daftar berikut adalah area peningkatan, bukan klaim bahwa fitur inti belum tersedia:
- Memperluas cakupan automated regression test untuk alur reservasi, role, bahasa, tema, dan PWA.
- Memperkuat observability untuk kegagalan upstream WoS Atlas dan Edge Functions.
- Meninjau performa serta batas cache berdasarkan volume data dan pola penggunaan.
- Menjaga dokumentasi migration dan prosedur deployment tetap sinkron dengan schema produksi.
- Melakukan audit aksesibilitas, terutama kontras warna musiman, navigasi keyboard, dan reduced motion.

---

**Dokumen ini menggambarkan implementasi repository utama per 11 November 2026.** Perubahan fitur dan struktur berikutnya harus tercermin pada README dan PRD.
