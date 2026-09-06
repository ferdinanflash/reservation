// ================= LANGUAGE / i18n (ENG / CN) =================
// Single source of truth for the ENG/CN toggle button + translation
// dictionaries. Load this AFTER common.js and BEFORE script.js:
//   <script src="common.js"></script>
//   <script src="lang.js"></script>
//   <script src="script.js"></script>
//
// Static text in index.html is translated via [data-i18n] /
// [data-i18n-placeholder] attributes (see applyStaticTranslations()).
// Dynamic text generated inside script.js calls the global t(key, vars)
// helper defined here instead of using hardcoded English strings.

(function () {
    'use strict';

    const LANG_STORAGE_KEY = 'svs_site_lang';

    // ================= DICTIONARIES =================
    const TRANSLATIONS = {
        en: {
            doc_title: "3475 SvS Minister Reservation",
            admin_login_btn: "President Login",
            admin_logout_btn: "Logout President",
            admin_logout_named: "Logout ({{name}})",
            page_title: "SvS Minister Position",
            page_subtitle: "Select a position to make reservation",
            selected_position_title: "Position Title",
            pos_vp_d1: "Vice President D1 (Monday)",
            pos_vp_d2: "Vice President D2 (Tuesday)",
            pos_edu_d4: "Minister of Education D4 (Thursday)",
            pos_vp_d5: "Vice President D5 (Friday)",
            link_leaderboard: "Events Leaderboard Record",
            link_tal: "Tundra Arm League",
            link_transfer_portal: "Transfer Portal",
            btn_back: "< Back to positions",
            btn_export_csv: "Export CSV",
            btn_close_reservation: "Close Reservation",
            btn_open_reservation: "Open Reservation",
            schedule_opening: "Opening...",
            schedule_closing: "Closing...",
            schedule_heading: "Time Slot Schedule",
            admin_mode_indicator: "(PRESIDENT MODE)",
            label_timezone: "Display Time Zone:",
            th_action: "ACTION",
            th_preferred_time: "TIME SLOT (UTC+0)",
            th_status: "STATUS",
            th_nickname: "IN-GAME NICKNAME",
            th_gameid: "IN-GAME ID",
            th_fc: "FC",
            modal_nickname_short: "NICKNAME",
            modal_id_short: "ID",
            reassign_modal_title: "Move Waiting Applicants",
            reassign_desc: "This slot now has an Accepted application. The applicants below are NOT deleted — pick a free slot for each one and click Move.",
            th_move_to: "MOVE TO",
            details_modal_title: "Application Details",
            apply_modal_title: "Apply for Time Slot",
            apply_position_label: "Position:",
            apply_time_label: "Time:",
            label_nickname: "In-Game Nickname",
            placeholder_nickname: "Enter your nickname",
            label_gameid: "In-Game ID",
            placeholder_gameid: "Enter your game ID",
            label_furnace: "Furnace Level",
            option_select_furnace: "Select Furnace Level",
            label_fc: "Fire Crystals Amount",
            placeholder_fc: "Fire Crystal",
            label_rfc: "Refined Fire Crystals Amount",
            placeholder_rfc: "Refined Fire Crystal",
            label_gensp: "General Speedups (Days)",
            placeholder_gensp: "General Speedup in Days",
            label_constsp: "Construction Speedups (Days)",
            placeholder_constsp: "Construction Speedup in Days",
            label_ressp: "Research Speedups (Days)",
            placeholder_ressp: "Research Speedup in Days",
            label_trainsp: "Troops Training Speedups (Days)",
            placeholder_trainsp: "Training Speedup in Days",
            btn_cancel: "Cancel",
            btn_submit_application: "Submit Application",
            footer_current_president: "Current President",
            footer_recent_log_title: "📢 RECENTLY ACCEPTED RESERVATION",
            log_empty: "No recent activity",
            btn_edit_footer: "Edit President Info",
            btn_finish_svs: "FINISH SvS",
            login_modal_title: "President Login",
            label_username: "Username",
            placeholder_username: "Enter username",
            label_password: "Password",
            placeholder_password: "Enter password",
            btn_signin: "Sign In",
            edit_footer_modal_title: "Edit President Info",
            label_president_name: "President Name",
            placeholder_president_name: "Enter president name",
            label_guild_name: "Guild Name",
            placeholder_guild_name: "Enter guild name",
            btn_save: "Save",
            confirm_default_message: "Are you sure?",
            btn_ok: "OK",
            title_view_details: "View Details",
            label_unknown: "Unknown",
            applicants_list_title: "Applicants List",
            btn_close: "Close",
            created_by: "Created By : ACE aka DEMON",

            // dynamic strings (used from script.js / common.js via t())
            confirm_toggle_reservation: "Are you sure to {{action}} reservation for {{position}}?",
            action_open: "open",
            action_close: "close",
            toast_reservation_now: "Reservation of {{position}} now-{{status}}!",
            status_word_open: "open",
            status_word_close: "close",
            toast_update_reservation_failed: "Failed to update reservation status. Please try again.",
            please_wait: "Please wait...",
            saving: "Saving...",
            loading_schedule: "Loading schedule...",
            signing_in: "Signing in...",
            submitting: "Submitting...",
            clearing: "Clearing...",
            toast_name_guild_empty: "Name and Guild cannot be empty!",
            toast_president_updated: "President info updated globally!",
            toast_update_db_failed: "Failed to update database: {{detail}}",
            toast_enter_both: "Please enter both username and password!",
            toast_president_only: "This page is for the President account only.",
            toast_login_failed: "Login failed: incorrect username or password",
            toast_welcome_back: "Welcome back, President!",
            toast_logged_out: "Logged out from President Mode.",
            local_label: "LOCAL:",
            utc_label: "UTC-0:",
            status_accepted: "Accepted",
            status_no_applications: "No Applications",
            status_waiting_count: "Waiting ({{count}})",
            btn_remove: "Remove",
            move_waiting_count: "⚠️ Move Waiting ({{count}})",
            local_prefix: "Local: {{time}}",
            btn_apply_action: "Apply",
            waiting_list_title: "Waiting List - {{time}} UTC",
            btn_accept: "Accept",
            btn_drop: "Drop",
            stat_furnace_lvl: "Furnace Lvl:",
            stat_fc: "FC:",
            stat_rfc: "RFC:",
            stat_general: "General:",
            stat_const: "Const:",
            stat_research: "Research:",
            stat_train: "Train:",
            stat_nickname: "Nickname:",
            stat_game_id: "Game ID:",
            stat_furnace_level: "Furnace Level:",
            stat_fire_crystals: "Fire Crystals (FC):",
            stat_refined_fire_crystals: "Refined Fire Crystals (RFC):",
            stat_general_speedup: "General Speedup:",
            stat_construction_speedup: "Construction Speedup:",
            stat_research_speedup: "Research Speedup:",
            stat_training_speedup: "Training Speedup:",
            days_suffix: "Days",
            toast_reservation_locked: "This day reservation still locked for now",
            toast_enter_nickname: "Please enter In-Game Nickname!",
            toast_enter_gameid: "Please enter In-Game ID!",
            toast_gameid_numeric: "Game ID must contain numbers only!",
            toast_select_furnace: "Please select Furnace Level!",
            toast_app_submitted: "Application submitted successfully!",
            toast_app_submit_failed: "Failed to submit application. Please try again.",
            confirm_accept_app: "Accept this application? This will lock this time slot.",
            toast_app_approved: "Application Approved!",
            toast_app_approve_failed: "Failed to approve. It may have just been taken by someone else.",
            reassign_modal_title_dyn: "Move Waiting Applicants - {{time}} UTC",
            no_more_waiting: "No more waiting applicants in this slot.",
            no_free_slots: "No free slots",
            btn_move: "Move",
            toast_no_slot_selected: "No available slot selected.",
            toast_applicant_moved: "Applicant moved to {{time}} UTC.",
            toast_move_failed: "Failed to move applicant. Please try again.",
            confirm_delete_record: "Delete this application record permanently?",
            toast_record_dropped: "Record dropped successfully.",
            toast_delete_failed: "Failed executing delete request.",
            toast_no_data_export: "No data available to export!",
            toast_csv_downloaded: "CSV File downloaded successfully!",
            confirm_finish_svs: "Caution to finish SvS!\n Are you sure ?, this will be reset all applied data",
            toast_all_cleared: "All record has been cleared.",
            toast_clear_failed: "Failed to clear data. Please try again.",
            your_location_suffix: " (Your Location)",
            toast_load_schedule_failed: "Failed to load schedule data. Please refresh.",
            toast_id_copied: "ID {{id}} copied to clipboard!",
            toast_id_copied_fallback: "ID {{id}} copied!",
            toast_copy_failed: "Failed to copy ID automatically."
        },
        id: {
            doc_title: "3475 SvS Menteri Reservasi",
            admin_login_btn: "Login Presiden",
            admin_logout_btn: "Logout Presiden",
            admin_logout_named: "Logout ({{name}})",
            page_title: "Posisi Menteri SvS",
            page_subtitle: "Pilih posisi untuk membuat reservasi",
            selected_position_title: "Judul Posisi",
            pos_vp_d1: "Wakil Presiden H+1 (Senin)",
            pos_vp_d2: "Wakil Presiden H+2 (Selasa)",
            pos_edu_d4: "Menteri Pendidikan H+4 (Kamis)",
            pos_vp_d5: "Wakil Presiden H+5 (Jumat)",
            link_leaderboard: "Rekor Events Leaderboard",
            link_tal: "Tundra Arm League",
            link_transfer_portal: "Portal Transfer",
            btn_back: "< Kembali ke posisi",
            btn_export_csv: "Ekspor CSV",
            btn_close_reservation: "Tutup Reservasi",
            btn_open_reservation: "Buka Reservasi",
            schedule_opening: "Membuka...",
            schedule_closing: "Menutup...",
            schedule_heading: "Jadwal Slot Waktu",
            admin_mode_indicator: "(MODE PRESIDEN)",
            label_timezone: "Zona Waktu Tampilan:",
            th_action: "AKSI",
            th_preferred_time: "SLOT WAKTU (UTC+0)",
            th_status: "STATUS",
            th_nickname: "NAMA",
            th_gameid: "ID DALAM GAME",
            th_fc: "FC",
            modal_nickname_short: "NAMA",
            modal_id_short: "ID",
            reassign_modal_title: "Pindahkan Pemohon yang Menunggu",
            reassign_desc: "Slot ini sekarang memiliki aplikasi yang Diterima. Pemohon di bawah TIDAK dihapus — pilih slot kosong untuk masing-masing lalu klik Pindahkan.",
            th_move_to: "PINDAHKAN KE",
            details_modal_title: "Detail Aplikasi",
            apply_modal_title: "Ajukan Slot Waktu",
            apply_position_label: "Posisi:",
            apply_time_label: "Waktu:",
            label_nickname: "Nama",
            placeholder_nickname: "Masukkan nama panggilan",
            label_gameid: "ID Dalam Game",
            placeholder_gameid: "Masukkan ID game",
            label_furnace: "Level Tungku",
            option_select_furnace: "Pilih Level Tungku",
            label_fc: "Kristal Api",
            placeholder_fc: "Kristal Api",
            label_rfc: "Kristal Api Yang dimurnikan",
            placeholder_rfc: "Refined Kristal Api",
            label_gensp: "Percepatan Umum (Hari)",
            placeholder_gensp: "Percepatan Umum dalam Hari",
            label_constsp: "Percepatan Konstruksi (Hari)",
            placeholder_constsp: "Percepatan Konstruksi dalam Hari",
            label_ressp: "Percepatan Penelitian (Hari)",
            placeholder_ressp: "Percepatan Penelitian dalam Hari",
            label_trainsp: "Percepatan Pelatihan Pasukan (Hari)",
            placeholder_trainsp: "Percepatan Pelatihan dalam Hari",
            btn_cancel: "Batal",
            btn_submit_application: "Kirim Aplikasi",
            footer_current_president: "Presiden Saat Ini",
            footer_recent_log_title: "📢 RESERVASI YANG BARU DITERIMA",
            log_empty: "Belum ada aktivitas",
            btn_edit_footer: "Edit Info Presiden",
            btn_finish_svs: "SELESAIKAN SvS",
            login_modal_title: "Login Presiden",
            label_username: "Nama Pengguna",
            placeholder_username: "Masukkan nama pengguna",
            label_password: "Kata Sandi",
            placeholder_password: "Masukkan kata sandi",
            btn_signin: "Masuk",
            edit_footer_modal_title: "Edit Info Presiden",
            label_president_name: "Nama Presiden",
            placeholder_president_name: "Masukkan nama presiden",
            label_guild_name: "Nama Guild",
            placeholder_guild_name: "Masukkan nama guild",
            btn_save: "Simpan",
            confirm_default_message: "Apakah Anda yakin?",
            btn_ok: "OK",
            title_view_details: "Lihat Detail",
            label_unknown: "Tidak Diketahui",
            applicants_list_title: "Daftar Pemohon",
            btn_close: "Tutup",
            created_by: "Dibuat Oleh : ACE aka DEMON",
            confirm_toggle_reservation: "Apakah Anda yakin ingin {{action}} reservasi untuk {{position}}?",
            action_open: "membuka",
            action_close: "menutup",
            toast_reservation_now: "Reservasi {{position}} sekarang-{{status}}!",
            status_word_open: "terbuka",
            status_word_close: "tertutup",
            toast_update_reservation_failed: "Gagal memperbarui status reservasi. Silakan coba lagi.",
            please_wait: "Harap tunggu...",
            saving: "Menyimpan...",
            loading_schedule: "Memuat jadwal...",
            signing_in: "Sedang masuk...",
            submitting: "Mengirim...",
            clearing: "Menghapus...",
            toast_name_guild_empty: "Nama dan Guild tidak boleh kosong!",
            toast_president_updated: "Info Presiden berhasil diperbarui secara global!",
            toast_update_db_failed: "Gagal memperbarui database: {{detail}}",
            toast_enter_both: "Harap masukkan nama pengguna dan kata sandi!",
            toast_president_only: "Halaman ini hanya untuk akun Presiden.",
            toast_login_failed: "Login gagal: nama pengguna atau kata sandi salah",
            toast_welcome_back: "Selamat datang kembali, Presiden!",
            toast_logged_out: "Keluar dari Mode Presiden.",
            local_label: "LOKAL:",
            utc_label: "UTC-0:",
            status_accepted: "Diterima",
            status_no_applications: "Tidak Ada Aplikasi",
            status_waiting_count: "Menunggu ({{count}})",
            btn_remove: "Hapus",
            move_waiting_count: "⚠️ Pindahkan yang Menunggu ({{count}})",
            local_prefix: "Lokal: {{time}}",
            btn_apply_action: "Mag-apply",
            waiting_list_title: "Daftar Tunggu - {{time}} UTC",
            btn_accept: "Terima",
            btn_drop: "Hapus",
            stat_furnace_lvl: "Level Tungku:",
            stat_fc: "FC:",
            stat_rfc: "RFC:",
            stat_general: "Umum:",
            stat_const: "Konstruksi:",
            stat_research: "Penelitian:",
            stat_train: "Pelatihan:",
            stat_nickname: "Nama Panggilan:",
            stat_game_id: "ID Game:",
            stat_furnace_level: "Level Tungku:",
            stat_fire_crystals: "Kristal Api:",
            stat_refined_fire_crystals: "Kristal Api Yang dimurnikan:",
            stat_general_speedup: "Percepatan Umum:",
            stat_construction_speedup: "Percepatan Konstruksi:",
            stat_research_speedup: "Percepatan Penelitian:",
            stat_training_speedup: "Percepatan Pelatihan:",
            days_suffix: "Hari",
            toast_reservation_locked: "Reservasi hari ini masih terkunci untuk saat ini",
            toast_enter_nickname: "Harap masukkan Nama!",
            toast_enter_gameid: "Harap masukkan ID Dalam Game!",
            toast_gameid_numeric: "ID Game hanya boleh berisi angka!",
            toast_select_furnace: "Harap pilih Level Tungku!",
            toast_app_submitted: "Aplikasi berhasil dikirim!",
            toast_app_submit_failed: "Gagal mengirim aplikasi. Silakan coba lagi.",
            confirm_accept_app: "Terima aplikasi ini? Slot waktu ini akan terkunci.",
            toast_app_approved: "Aplikasi Disetujui!",
            toast_app_approve_failed: "Gagal menyetujui. Mungkin baru saja diambil orang lain.",
            reassign_modal_title_dyn: "Pindahkan Pemohon yang Menunggu - {{time}} UTC",
            no_more_waiting: "Tidak ada lagi pemohon yang menunggu di slot ini.",
            no_free_slots: "Tidak ada slot kosong",
            btn_move: "Pindahkan",
            toast_no_slot_selected: "Tidak ada slot tersedia yang dipilih.",
            toast_applicant_moved: "Pemohon dipindahkan ke {{time}} UTC.",
            toast_move_failed: "Gagal memindahkan pemohon. Silakan coba lagi.",
            confirm_delete_record: "Hapus catatan aplikasi ini secara permanen?",
            toast_record_dropped: "Catatan berhasil dihapus.",
            toast_delete_failed: "Gagal menjalankan penghapusan.",
            toast_no_data_export: "Tidak ada data untuk diekspor!",
            toast_csv_downloaded: "File CSV berhasil diunduh!",
            confirm_finish_svs: "Hati-hati saat menyelesaikan SvS!\n Apakah Anda yakin? Semua data yang diajukan akan direset",
            toast_all_cleared: "Semua catatan telah dihapus.",
            toast_clear_failed: "Gagal menghapus data. Silakan coba lagi.",
            your_location_suffix: " (Lokasi Anda)",
            toast_load_schedule_failed: "Gagal memuat data jadwal. Silakan refresh.",
            toast_id_copied: "ID {{id}} disalin ke clipboard!",
            toast_id_copied_fallback: "ID {{id}} disalin!",
            toast_copy_failed: "Gagal menyalin ID secara otomatis."
        },
        ph: {
            doc_title: "3475 SvS Minister Reservation",
            admin_login_btn: "Login ng Pangulo",
            admin_logout_btn: "Logout ng Pangulo",
            admin_logout_named: "Logout ({{name}})",
            page_title: "Posisyon ng SvS Minister",
            page_subtitle: "Pumili ng posisyon para gumawa ng reservation",
            selected_position_title: "Pangalan ng Posisyon",
            pos_vp_d1: "Bise Presidente H+1 (Lunes)",
            pos_vp_d2: "Bise Presidente H+2 (Martes)",
            pos_edu_d4: "Minister ng Edukasyon H+4 (Huwebes)",
            pos_vp_d5: "Bise Presidente H+5 (Biyernes)",
            link_leaderboard: "Record ng Events Leaderboard",
            link_tal: "Tundra Arm League",
            link_transfer_portal: "Transfer Portal",
            btn_back: "< Bumalik sa mga posisyon",
            btn_export_csv: "I-export ang CSV",
            btn_close_reservation: "Isara ang Reservation",
            btn_open_reservation: "Buksan ang Reservation",
            schedule_opening: "Binubuksan...",
            schedule_closing: "Isinasara...",
            schedule_heading: "Iskedyul ng Time Slot",
            admin_mode_indicator: "(PRESIDENT MODE)",
            label_timezone: "Timezone na Ipinapakita:",
            th_action: "AKSYON",
            th_preferred_time: "TIME SLOT (UTC+0)",
            th_status: "STATUS",
            th_nickname: "NICKNAME SA GAME",
            th_gameid: "GAME ID",
            th_fc: "FC",
            modal_nickname_short: "NICKNAME",
            modal_id_short: "ID",
            reassign_modal_title: "Ilipat ang mga Naghihintay na Aplikante",
            reassign_desc: "Ang slot na ito ay mayroon nang tinanggap na application. HINDI buburahin ang mga aplikante sa ibaba — pumili ng bakanteng slot para sa bawat isa at i-click ang Ilipat.",
            th_move_to: "ILIPAT SA",
            details_modal_title: "Detalye ng Application",
            apply_modal_title: "Mag-apply para sa Time Slot",
            apply_position_label: "Posisyon:",
            apply_time_label: "Oras:",
            label_nickname: "Nickname sa Game",
            placeholder_nickname: "Ilagay ang iyong nickname",
            label_gameid: "Game ID",
            placeholder_gameid: "Ilagay ang iyong game ID",
            label_furnace: "Level ng Furnace",
            option_select_furnace: "Piliin ang Level ng Furnace",
            label_fc: "Halaga ng Fire Crystals",
            placeholder_fc: "Fire Crystal",
            label_rfc: "Halaga ng Refined Fire Crystals",
            placeholder_rfc: "Refined Fire Crystal",
            label_gensp: "General Speedups (Araw)",
            placeholder_gensp: "General Speedup sa Araw",
            label_constsp: "Construction Speedups (Araw)",
            placeholder_constsp: "Construction Speedup sa Araw",
            label_ressp: "Research Speedups (Araw)",
            placeholder_ressp: "Research Speedup sa Araw",
            label_trainsp: "Troop Training Speedups (Araw)",
            placeholder_trainsp: "Training Speedup sa Araw",
            btn_cancel: "Kanselahin",
            btn_submit_application: "Isumite ang Application",
            footer_current_president: "Kasalukuyang Pangulo",
            footer_recent_log_title: "📢 MGA BAGONG TINANGGAP NA RESERVATION",
            log_empty: "Wala pang kamakailang aktibidad",
            btn_edit_footer: "I-edit ang Info ng Pangulo",
            btn_finish_svs: "TAPUSIN ANG SvS",
            login_modal_title: "Login ng Pangulo",
            label_username: "Username",
            placeholder_username: "Ilagay ang username",
            label_password: "Password",
            placeholder_password: "Ilagay ang password",
            btn_signin: "Mag-sign In",
            edit_footer_modal_title: "I-edit ang Info ng Pangulo",
            label_president_name: "Pangalan ng Pangulo",
            placeholder_president_name: "Ilagay ang pangalan ng pangulo",
            label_guild_name: "Pangalan ng Guild",
            placeholder_guild_name: "Ilagay ang pangalan ng guild",
            btn_save: "I-save",
            confirm_default_message: "Sigurado ka ba?",
            btn_ok: "OK",
            title_view_details: "Tingnan ang Detalye",
            label_unknown: "Hindi Alam",
            applicants_list_title: "Listahan ng mga Aplikante",
            btn_close: "Isara",
            created_by: "Ginawa Ni : ACE aka DEMON",
            confirm_toggle_reservation: "Sigurado ka bang {{action}} ang reservation para sa {{position}}?",
            action_open: "buksan",
            action_close: "isara",
            toast_reservation_now: "Ang reservation ng {{position}} ay {{status}} na!",
            status_word_open: "bukas",
            status_word_close: "sarado",
            toast_update_reservation_failed: "Hindi ma-update ang status ng reservation. Pakisubukan muli.",
            please_wait: "Mangyaring maghintay...",
            saving: "Sine-save...",
            loading_schedule: "Nilo-load ang schedule...",
            signing_in: "Nagsa-sign in...",
            submitting: "Isinusumite...",
            clearing: "Binubura...",
            toast_name_guild_empty: "Hindi maaaring walang laman ang Name at Guild!",
            toast_president_updated: "Na-update na ang info ng Pangulo para sa lahat!",
            toast_update_db_failed: "Hindi ma-update ang database: {{detail}}",
            toast_enter_both: "Ilagay ang username at password!",
            toast_president_only: "Para lamang sa account ng Pangulo ang page na ito.",
            toast_login_failed: "Nabigo ang login: maling username o password",
            toast_welcome_back: "Maligayang pagbabalik, Pangulo!",
            toast_logged_out: "Nag-logout mula sa President Mode.",
            local_label: "LOKAL:",
            utc_label: "UTC-0:",
            status_accepted: "Tinanggap",
            status_no_applications: "Walang Application",
            status_waiting_count: "Naghihintay ({{count}})",
            btn_remove: "Alisin",
            move_waiting_count: "⚠️ Ilipat ang Naghihintay ({{count}})",
            local_prefix: "Lokal: {{time}}",
            btn_apply_action: "Mag-apply",
            waiting_list_title: "Listahan ng Naghihintay - {{time}} UTC",
            btn_accept: "Tanggapin",
            btn_drop: "I-drop",
            stat_furnace_lvl: "Level ng Furnace:",
            stat_fc: "FC:",
            stat_rfc: "RFC:",
            stat_general: "General:",
            stat_const: "Construction:",
            stat_research: "Research:",
            stat_train: "Training:",
            stat_nickname: "Nickname:",
            stat_game_id: "Game ID:",
            stat_furnace_level: "Level ng Furnace:",
            stat_fire_crystals: "Fire Crystals (FC):",
            stat_refined_fire_crystals: "Refined Fire Crystals (RFC):",
            stat_general_speedup: "General Speedup:",
            stat_construction_speedup: "Construction Speedup:",
            stat_research_speedup: "Research Speedup:",
            stat_training_speedup: "Training Speedup:",
            days_suffix: "Araw",
            toast_reservation_locked: "Naka-lock pa ang reservation para sa araw na ito",
            toast_enter_nickname: "Ilagay ang In-Game Nickname!",
            toast_enter_gameid: "Ilagay ang In-Game ID!",
            toast_gameid_numeric: "Numero lamang ang maaaring nasa Game ID!",
            toast_select_furnace: "Piliin ang Level ng Furnace!",
            toast_app_submitted: "Matagumpay na naisumite ang application!",
            toast_app_submit_failed: "Hindi naisumite ang application. Pakisubukan muli.",
            confirm_accept_app: "Tanggapin ang application na ito? Ila-lock nito ang time slot.",
            toast_app_approved: "Naaprubahan ang Application!",
            toast_app_approve_failed: "Hindi maaprubahan. Maaaring kinuha na ito ng iba.",
            reassign_modal_title_dyn: "Ilipat ang Naghihintay na Aplikante - {{time}} UTC",
            no_more_waiting: "Wala nang naghihintay na aplikante sa slot na ito.",
            no_free_slots: "Walang bakanteng slot",
            btn_move: "Ilipat",
            toast_no_slot_selected: "Walang napiling available na slot.",
            toast_applicant_moved: "Nailipat ang aplikante sa {{time}} UTC.",
            toast_move_failed: "Hindi nailipat ang aplikante. Pakisubukan muli.",
            confirm_delete_record: "Permanenteng burahin ang application record na ito?",
            toast_record_dropped: "Matagumpay na na-delete ang record.",
            toast_delete_failed: "Nabigo ang pag-delete.",
            toast_no_data_export: "Walang data na maaaring i-export!",
            toast_csv_downloaded: "Matagumpay na na-download ang CSV file!",
            confirm_finish_svs: "Babala sa pagtatapos ng SvS!\n Sigurado ka ba? Mare-reset ang lahat ng na-submit na data",
            toast_all_cleared: "Nabura na ang lahat ng record.",
            toast_clear_failed: "Hindi mabura ang data. Pakisubukan muli.",
            your_location_suffix: " (Iyong Lokasyon)",
            toast_load_schedule_failed: "Hindi ma-load ang schedule data. I-refresh ang page.",
            toast_id_copied: "Nakopya ang ID {{id}} sa clipboard!",
            toast_id_copied_fallback: "Nakopya ang ID {{id}}!",
            toast_copy_failed: "Hindi awtomatikong makopya ang ID."
        },
        cn: {
            doc_title: "3475 SvS 部长预约系统",
            admin_login_btn: "会长登录",
            admin_logout_btn: "退出会长模式",
            admin_logout_named: "退出会长模式（{{name}}）",
            page_title: "SvS 部长职位",
            page_subtitle: "请选择职位进行预约",
            selected_position_title: "职位名称",
            pos_vp_d1: "副会长 D1（周一）",
            pos_vp_d2: "副会长 D2（周二）",
            pos_edu_d4: "教育部长 D4（周四）",
            pos_vp_d5: "副会长 D5（周五）",
            link_leaderboard: "活动排行榜记录",
            link_tal: "苔原联盟",
            link_transfer_portal: "转移门户",
            btn_back: "< 返回职位列表",
            btn_export_csv: "导出CSV",
            btn_close_reservation: "关闭预约",
            btn_open_reservation: "开启预约",
            schedule_opening: "开启中...",
            schedule_closing: "关闭中...",
            schedule_heading: "时段预约表",
            admin_mode_indicator: "（会长模式）",
            label_timezone: "显示时区：",
            th_action: "操作",
            th_preferred_time: "时间段（UTC+0）",
            th_status: "状态",
            th_nickname: "游戏昵称",
            th_gameid: "游戏ID",
            th_fc: "火晶",
            modal_nickname_short: "昵称",
            modal_id_short: "ID",
            reassign_modal_title: "移动等待中的申请人",
            reassign_desc: "该时段已有一个被接受的申请。以下申请人不会被删除——请为每位申请人选择一个空闲时段，然后点击「移动」。",
            th_move_to: "移动至",
            details_modal_title: "申请详情",
            apply_modal_title: "申请时间段",
            apply_position_label: "职位：",
            apply_time_label: "时间：",
            label_nickname: "游戏昵称",
            placeholder_nickname: "请输入您的昵称",
            label_gameid: "游戏ID",
            placeholder_gameid: "请输入您的游戏ID",
            label_furnace: "熔炉等级",
            option_select_furnace: "选择熔炉等级",
            label_fc: "火晶数量",
            placeholder_fc: "火晶",
            label_rfc: "精炼火晶数量",
            placeholder_rfc: "精炼火晶",
            label_gensp: "通用加速（天）",
            placeholder_gensp: "通用加速天数",
            label_constsp: "建筑加速（天）",
            placeholder_constsp: "建筑加速天数",
            label_ressp: "科研加速（天）",
            placeholder_ressp: "科研加速天数",
            label_trainsp: "训练加速（天）",
            placeholder_trainsp: "训练加速天数",
            btn_cancel: "取消",
            btn_submit_application: "提交申请",
            footer_current_president: "当前会长",
            footer_recent_log_title: "📢 最近已接受的预约",
            log_empty: "暂无最近活动",
            btn_edit_footer: "编辑会长信息",
            btn_finish_svs: "结束SvS",
            login_modal_title: "会长登录",
            label_username: "用户名",
            placeholder_username: "请输入用户名",
            label_password: "密码",
            placeholder_password: "请输入密码",
            btn_signin: "登录",
            edit_footer_modal_title: "编辑会长信息",
            label_president_name: "会长名称",
            placeholder_president_name: "请输入会长名称",
            label_guild_name: "联盟名称",
            placeholder_guild_name: "请输入联盟名称",
            btn_save: "保存",
            confirm_default_message: "您确定吗？",
            btn_ok: "确定",
            title_view_details: "查看详情",
            label_unknown: "未知",
            applicants_list_title: "申请人列表",
            btn_close: "关闭",
            created_by: "创建者：ACE aka DEMON",

            confirm_toggle_reservation: "确定要{{action}}「{{position}}」的预约吗？",
            action_open: "开启",
            action_close: "关闭",
            toast_reservation_now: "「{{position}}」的预约现在已{{status}}！",
            status_word_open: "开启",
            status_word_close: "关闭",
            toast_update_reservation_failed: "更新预约状态失败，请重试。",
            please_wait: "请稍候...",
            saving: "保存中...",
            loading_schedule: "正在加载时间表...",
            signing_in: "登录中...",
            submitting: "提交中...",
            clearing: "清除中...",
            toast_name_guild_empty: "名称和联盟不能为空！",
            toast_president_updated: "会长信息已全局更新！",
            toast_update_db_failed: "更新数据库失败：{{detail}}",
            toast_enter_both: "请输入用户名和密码！",
            toast_president_only: "此页面仅限会长账号使用。",
            toast_login_failed: "登录失败：用户名或密码错误",
            toast_welcome_back: "欢迎回来，会长！",
            toast_logged_out: "已退出会长模式。",
            local_label: "本地：",
            utc_label: "UTC-0：",
            status_accepted: "已接受",
            status_no_applications: "暂无申请",
            status_waiting_count: "等待中（{{count}}）",
            btn_remove: "移除",
            move_waiting_count: "⚠️ 移动等待者（{{count}}）",
            local_prefix: "本地：{{time}}",
            btn_apply_action: "申请",
            waiting_list_title: "等待名单 - {{time}} UTC",
            btn_accept: "接受",
            btn_drop: "丢弃",
            stat_furnace_lvl: "熔炉等级：",
            stat_fc: "火晶：",
            stat_rfc: "精炼火晶：",
            stat_general: "通用：",
            stat_const: "建筑：",
            stat_research: "科研：",
            stat_train: "训练：",
            stat_nickname: "昵称：",
            stat_game_id: "游戏ID：",
            stat_furnace_level: "熔炉等级：",
            stat_fire_crystals: "火晶（FC）：",
            stat_refined_fire_crystals: "精炼火晶（RFC）：",
            stat_general_speedup: "通用加速：",
            stat_construction_speedup: "建筑加速：",
            stat_research_speedup: "科研加速：",
            stat_training_speedup: "训练加速：",
            days_suffix: "天",
            toast_reservation_locked: "该时段预约目前仍处于锁定状态",
            toast_enter_nickname: "请输入游戏昵称！",
            toast_enter_gameid: "请输入游戏ID！",
            toast_gameid_numeric: "游戏ID只能包含数字！",
            toast_select_furnace: "请选择熔炉等级！",
            toast_app_submitted: "申请提交成功！",
            toast_app_submit_failed: "提交申请失败，请重试。",
            confirm_accept_app: "接受此申请？这将锁定该时段。",
            toast_app_approved: "申请已通过！",
            toast_app_approve_failed: "通过失败，该时段可能刚被其他人占用。",
            reassign_modal_title_dyn: "移动等待中的申请人 - {{time}} UTC",
            no_more_waiting: "该时段已没有等待中的申请人。",
            no_free_slots: "没有空闲时段",
            btn_move: "移动",
            toast_no_slot_selected: "未选择可用时段。",
            toast_applicant_moved: "申请人已移动至 {{time}} UTC。",
            toast_move_failed: "移动申请人失败，请重试。",
            confirm_delete_record: "确定要永久删除此申请记录吗？",
            toast_record_dropped: "记录已成功删除。",
            toast_delete_failed: "执行删除请求失败。",
            toast_no_data_export: "没有可导出的数据！",
            toast_csv_downloaded: "CSV文件下载成功！",
            confirm_finish_svs: "警告：结束SvS！\n您确定吗？这将重置所有已提交的申请数据",
            toast_all_cleared: "所有记录已被清除。",
            toast_clear_failed: "清除数据失败，请重试。",
            your_location_suffix: "（您的位置）",
            toast_load_schedule_failed: "加载时间表数据失败，请刷新页面。",
            toast_id_copied: "ID {{id}} 已复制到剪贴板！",
            toast_id_copied_fallback: "ID {{id}} 已复制！",
            toast_copy_failed: "自动复制ID失败。"
        }
    };

    // Position display-name translations. Internal English keys (used as
    // DB values / currentPosition) never change — only the label shown.
    const POSITION_NAMES = {
        'Vice President D1': { en: 'Vice President D1', cn: '副会长 D1', id: 'Wakil Presiden H+1', ph: 'Bise Presidente H+1' },
        'Vice President D2': { en: 'Vice President D2', cn: '副会长 D2', id: 'Wakil Presiden H+2', ph: 'Bise Presidente H+2' },
        'Minister of Education D4': { en: 'Minister of Education D4', cn: '教育部长 D4', id: 'Menteri Pendidikan H+4', ph: 'Minister ng Edukasyon H+4' },
        'Vice President D5': { en: 'Vice President D5', cn: '副会长 D5', id: 'Wakil Presiden H+5', ph: 'Bise Presidente H+5' }
    };
    const POSITION_SHORT_LABELS = {
        'Vice President D1': { en: 'VP D1', cn: '副D1', id: 'WP H+1', ph: 'BP H+1' },
        'Vice President D2': { en: 'VP D2', cn: '副D2', id: 'WP H+2', ph: 'BP H+2' },
        'Minister of Education D4': { en: 'Edu D4', cn: '教D4', id: 'Pendidikan H+4', ph: 'Edu H+4' },
        'Vice President D5': { en: 'VP D5', cn: '副D5', id: 'WP H+5', ph: 'BP H+5' }
    };

    let currentLang = ['en', 'cn', 'id', 'ph'].includes(localStorage.getItem(LANG_STORAGE_KEY)) ? localStorage.getItem(LANG_STORAGE_KEY) : 'en';

    function t(key, vars) {
        const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
        let str = (dict[key] !== undefined) ? dict[key]
            : (TRANSLATIONS.en[key] !== undefined ? TRANSLATIONS.en[key] : key);
        if (vars) {
            Object.keys(vars).forEach(function (k) {
                str = str.replace(new RegExp('{{' + k + '}}', 'g'), vars[k]);
            });
        }
        return str;
    }

    function translatePositionName(name) {
        const entry = POSITION_NAMES[name];
        if (!entry) return name;
        return entry[currentLang] || entry.en;
    }

    function translatePositionShort(name) {
        const entry = POSITION_SHORT_LABELS[name];
        if (!entry) return name;
        return entry[currentLang] || entry.en;
    }

    function getLang() { return currentLang; }

    function applyStaticTranslations() {
        document.documentElement.lang = currentLang === 'cn' ? 'zh' : (currentLang === 'id' ? 'id' : (currentLang === 'ph' ? 'tl' : 'en'));
        document.title = t('doc_title');

        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            el.textContent = t(el.getAttribute('data-i18n'));
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
            el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
        });

        document.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
            el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
        });

        const toggleBtn = document.getElementById('lang-toggle-btn');
        if (toggleBtn) {
            toggleBtn.setAttribute('data-lang', currentLang);
            toggleBtn.setAttribute('aria-label', currentLang === 'en' ? 'Switch to Chinese, Indonesian, or Filipino' : (currentLang === 'cn' ? '切换为英语、印尼语或菲律宾语' : (currentLang === 'id' ? 'Ganti ke Bahasa Inggris, Mandarin, atau Filipino' : 'Lumipat sa English, Mandarin, o Bahasa Indonesia')));
        }
    }

    // Re-renders whatever dynamic content is currently on screen so it
    // picks up the new language immediately, without a page reload.
    function refreshDynamicUI() {
        try {
            if (typeof isAdmin !== 'undefined') {
                if (isAdmin && typeof updateAdminUI === 'function') updateAdminUI();
                else if (!isAdmin && typeof resetAdminUI === 'function') resetAdminUI();
            }
        } catch (e) { /* script.js not loaded yet */ }

        try {
            if (typeof updateReservationButtonUI === 'function') updateReservationButtonUI();
        } catch (e) { /* noop */ }

        try {
            const schedulePage = document.getElementById('schedule-page');
            if (schedulePage && !schedulePage.classList.contains('hidden')) {
                const titleEl = document.getElementById('selected-title');
                if (titleEl && typeof currentPosition !== 'undefined') {
                    titleEl.innerText = translatePositionName(currentPosition);
                }
                if (typeof renderTimeSlots === 'function') renderTimeSlots();
            }
        } catch (e) { /* noop */ }

        try {
            const waitingModal = document.getElementById('waiting-modal');
            if (waitingModal && !waitingModal.classList.contains('hidden') && typeof currentWaitingModalTime !== 'undefined' && currentWaitingModalTime && typeof openWaitingModal === 'function') {
                openWaitingModal(currentWaitingModalTime);
            }
        } catch (e) { /* noop */ }

        try {
            const reassignModal = document.getElementById('reassign-modal');
            if (reassignModal && !reassignModal.classList.contains('hidden') && typeof currentReassignModalTime !== 'undefined' && currentReassignModalTime && typeof openReassignModal === 'function') {
                openReassignModal(currentReassignModalTime);
            }
        } catch (e) { /* noop */ }

        try {
            const detailsModal = document.getElementById('details-modal');
            const detailsContent = document.getElementById('details-content');
            if (detailsModal && !detailsModal.classList.contains('hidden') && detailsContent && detailsContent.dataset.appId && typeof openDetailsModal === 'function') {
                openDetailsModal(Number(detailsContent.dataset.appId));
            }
        } catch (e) { /* noop */ }

        try {
            if (typeof loadRecentAccepts === 'function') loadRecentAccepts();
        } catch (e) { /* noop */ }
    }

    function setLanguage(lang) {
        if (!['en', 'cn', 'id', 'ph'].includes(lang)) return;
        currentLang = lang;
        localStorage.setItem(LANG_STORAGE_KEY, lang);
        applyStaticTranslations();
        refreshDynamicUI();
    }

    function toggleLanguage() {
        setLanguage(currentLang === 'en' ? 'cn' : (currentLang === 'cn' ? 'id' : (currentLang === 'id' ? 'ph' : 'en')));
    }

    // Expose globally so script.js / common.js / inline HTML can use them.
    window.t = t;
    window.getLang = getLang;
    window.setLanguage = setLanguage;
    window.toggleLanguage = toggleLanguage;
    window.translatePositionName = translatePositionName;
    window.translatePositionShort = translatePositionShort;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyStaticTranslations, { once: true });
    } else {
        applyStaticTranslations();
    }
})();
