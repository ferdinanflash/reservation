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
            doc_title: "3475 SVS Ministry Reservation",
            admin_login_btn: "President Login",
            admin_logout_btn: "Logout President",
            admin_logout_named: "Logout ({{name}})",
            page_title: "SVS Ministry Position",
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
            th_preferred_time: "PREFERRED TIME (UTC)",
            th_status: "STATUS (APPLICANTS)",
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
            footer_recent_log_title: "📢 RECENTLY ACCEPTED APPOINTMENT",
            log_empty: "No recent activity",
            btn_edit_footer: "Edit President Info",
            btn_finish_svs: "FINISH SVS",
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
            confirm_finish_svs: "Caution to finish SVS!\n Are you sure ?, this will be reset all applied data",
            toast_all_cleared: "All record has been cleared.",
            toast_clear_failed: "Failed to clear data. Please try again.",
            your_location_suffix: " (Your Location)",
            toast_load_schedule_failed: "Failed to load schedule data. Please refresh.",
            toast_id_copied: "ID {{id}} copied to clipboard!",
            toast_id_copied_fallback: "ID {{id}} copied!",
            toast_copy_failed: "Failed to copy ID automatically."
        },
        cn: {
            doc_title: "3475 SVS Ministry 预约系统",
            admin_login_btn: "会长登录",
            admin_logout_btn: "退出会长模式",
            admin_logout_named: "退出会长模式（{{name}}）",
            page_title: "SVS Ministry 职位",
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
            th_preferred_time: "首选时间（UTC）",
            th_status: "状态（申请人数）",
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
            btn_finish_svs: "结束SVS",
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
            confirm_finish_svs: "警告：结束SVS！\n您确定吗？这将重置所有已提交的申请数据",
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
        'Vice President D1': { en: 'Vice President D1', cn: '副会长 D1' },
        'Vice President D2': { en: 'Vice President D2', cn: '副会长 D2' },
        'Minister of Education D4': { en: 'Minister of Education D4', cn: '教育部长 D4' },
        'Vice President D5': { en: 'Vice President D5', cn: '副会长 D5' }
    };
    const POSITION_SHORT_LABELS = {
        'Vice President D1': { en: 'VP D1', cn: '副D1' },
        'Vice President D2': { en: 'VP D2', cn: '副D2' },
        'Minister of Education D4': { en: 'Edu D4', cn: '教D4' },
        'Vice President D5': { en: 'VP D5', cn: '副D5' }
    };

    let currentLang = (localStorage.getItem(LANG_STORAGE_KEY) === 'cn') ? 'cn' : 'en';

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
        document.documentElement.lang = (currentLang === 'cn') ? 'zh' : 'en';
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
            toggleBtn.setAttribute('aria-label', currentLang === 'cn' ? 'Switch to English' : '切换为中文');
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
        if (lang !== 'en' && lang !== 'cn') return;
        currentLang = lang;
        localStorage.setItem(LANG_STORAGE_KEY, lang);
        applyStaticTranslations();
        refreshDynamicUI();
    }

    function toggleLanguage() {
        setLanguage(currentLang === 'en' ? 'cn' : 'en');
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
