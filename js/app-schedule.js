// ================= SCHEDULE =================
// Position/schedule screens: timezone detection, loading applications,
// and rendering the time-slot table.
// Part of the app script, split out of the old single script.js.
// Load order matters: see the <script> tags in index.html.

function showSchedule(positionName) {
    currentPosition = positionName;
    currentHowToUseNotes = '';
    howToUseNotesLoaded = false;
    document.getElementById('positions-page').classList.add('hidden');
    document.getElementById('schedule-page').classList.remove('hidden');
    document.getElementById('selected-title').innerText = translatePositionName(positionName);
    detectAndSetTimezone();
    
    checkReservationStatus().then(() => {
        loadApplications();
    });
}

function detectAndSetTimezone() {
    const selector = document.getElementById('timezone');
    if (!selector) return;
    selector.innerHTML = "";

    const tzLabels = {
        "-12": "Kwajalein", "-11": "Midway Island", "-10": "Hawaii", "-9": "Alaska", 
        "-8": "Pacific Time", "-7": "Mountain Time", "-6": "Central Time", 
        "-5": "Eastern Time", "-4": "Atlantic Time", "-3.5": "Newfoundland", 
        "-3": "Buenos Aires", "-2": "Mid-Atlantic", "-1": "Azores", 
        "0": "GMT / UTC", "1": "Berlin, Paris", "2": "Cairo, Johannesburg", 
        "3": "Moscow, Nairobi", "3.5": "Tehran", "4": "Dubai", 
        "4.5": "Kabul", "5": "Karachi", "5.5": "New Delhi", 
        "5.75": "Kathmandu", "6": "Dhaka", "6.5": "Yangon", 
        "7": "Jakarta, WIB", "8": "Singapore, WITA", "9": "Tokyo, WIT", 
        "9.5": "Darwin", "10": "Sydney", "10.5": "Lord Howe",
        "11": "Solomon Is.", "11.5": "Norfolk Is.", "12": "Auckland, Fiji", 
        "12.75": "Chatham Is.", "13": "Tonga", "14": "Kiritimati"
    };

    const offsets = [
        -12, -11, -10, -9, -8, -7, -6, -5, -4, -3.5, -3, -2, -1, 0, 
        1, 2, 3, 3.5, 4, 4.5, 5, 5.5, 5.75, 6, 6.5, 7, 8, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.75, 13, 14
    ];

    const userOffsetMinutes = new Date().getTimezoneOffset();
    const userOffsetHours = parseFloat((-(userOffsetMinutes / 60)).toFixed(2));
    let exactMatchFound = false;

    offsets.forEach(offset => {
        const option = document.createElement('option');
        option.value = offset;
        const sign = offset >= 0 ? "+" : "-";
        const absOffset = Math.abs(offset);
        const hours = Math.floor(absOffset);
        const minutes = Math.round((absOffset % 1) * 60);
        const timeString = `UTC ${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        const label = tzLabels[String(offset)] ? ` (${tzLabels[String(offset)]})` : "";
        option.text = `${timeString}${label}`;

        if (Math.abs(offset - userOffsetHours) < 0.1) {
            option.selected = true;
            exactMatchFound = true;
        }
        selector.add(option);
    });

    if (!exactMatchFound) {
        const sign = userOffsetHours >= 0 ? "+" : "-";
        const absOffset = Math.abs(userOffsetHours);
        const hours = Math.floor(absOffset);
        const minutes = Math.round((absOffset % 1) * 60);
        const customOption = document.createElement('option');
        customOption.value = userOffsetHours;
        customOption.text = `UTC ${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} (Your Location)`;
        customOption.selected = true;
        selector.insertBefore(customOption, selector.firstChild);
    }
}

function showPositions() {
    document.getElementById('schedule-page').classList.add('hidden');
    document.getElementById('positions-page').classList.remove('hidden');
}

async function loadApplications() {
    const client = getSupabase();
    if (!client) return;

    isLoadingApplications = true;
    renderLoadingState();

    try {
        const { data, error } = await client.from('reservation_slots').select('*').eq('position', currentPosition);
        if (error) throw error;
        savedApplications = data || [];
    } catch (e) {
        console.error("Database failure:", e);
        savedApplications = [];
        showToast(t("toast_load_schedule_failed"), "error");
    }
    isLoadingApplications = false;
    renderTimeSlots();
}

// Placeholder row while data is still being fetched from Supabase, so the
// table doesn't look empty or flicker before the data appears.
function renderLoadingState() {
    const tbody = document.getElementById('schedule-table-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr class="loading-row"><td colspan="6"><span class="spinner-inline"></span>${t("loading_schedule")}</td></tr>`;
}

function renderTimeSlots() {
    const tbody = document.getElementById('schedule-table-body');
    if (!tbody) return;
    if (isLoadingApplications) return;
    const offset = parseFloat(document.getElementById('timezone').value);
    tbody.innerHTML = "";

    for (let i = 0; i < 48; i++) {
        let totalMinutes = i * 30;
        let utcH = Math.floor(totalMinutes / 60);
        let utcM = totalMinutes % 60;
        let utcTimeStr = `${String(utcH).padStart(2, '0')}:${String(utcM).padStart(2, '0')}`;

        let totalLocalMinutes = totalMinutes + Math.round(offset * 60);
        let localH = Math.floor(totalLocalMinutes / 60) % 24;
        if (localH < 0) localH += 24;
        let localM = totalLocalMinutes % 60;
        if (localM < 0) localM += 60;
        let localTimeStr = `${String(localH).padStart(2, '0')}:${String(localM).padStart(2, '0')}`;

        let appsInSlot = savedApplications.filter(a => String(a.time_slot).trim() === utcTimeStr);
        let acceptedApp = appsInSlot.find(a => a.status === 'Accepted');
        let countWaiting = appsInSlot.filter(a => a.status === 'Waiting').length;

        const row = document.createElement('tr');
        if (acceptedApp) {
            let detailBtn = `<span class="icon-tap-target" style="cursor:pointer; font-size: 1rem; vertical-align: middle;" title="${t("title_view_details")}" onclick="openDetailsModal(${acceptedApp.id})">🔍</span>`;
            // PENTING: bungkus ikon+tombol ini pakai display:inline-flex, BUKAN
            // display:flex. Sebagai <div> block-level biasa, display:flex akan
            // otomatis melebar mengikuti lebar KOLOM tabel (bukan lebar
            // kontennya sendiri) — dan karena table-layout:auto + table
            // width:100% bisa menghitung kolom ACTION lebih sempit dari total
            // lebar ikon+gap+tombol, item flex (yang defaultnya flex-shrink:1)
            // jadi "diperas" sampai ikon kaca pembesar terdorong keluar batas
            // kiri kolom sticky lalu terpotong. Ini hanya kejadian di mode
            // admin karena hanya di sini ikon & tombol digabung dalam satu div
            // flex; mode biasa cuma me-render ikon sendirian. inline-flex
            // membuat div ini shrink-to-fit ke lebar kontennya sendiri (sama
            // seperti span/inline-block), jadi kolom otomatis melebar untuk
            // menampung isinya dan tidak ada lagi yang diperas/terpotong.
            // flex-shrink:0 pada kedua child jadi jaring pengaman tambahan.
            let actionBtn = isAdmin
                ? `<div style="display:inline-flex; flex-wrap:nowrap; align-items:center; justify-content:center; gap:6px;">
                     <span style="flex-shrink:0;">${detailBtn}</span>
                     <button class="btn-apply btn-danger btn-compact" style="padding: 4px 8px; font-size: 0.75rem; flex-shrink:0; white-space:nowrap;" onclick="removeApp(${acceptedApp.id})">${t("btn_remove")}</button>
                   </div>`
                : detailBtn;

            // Other applicants who were still "Waiting" in this slot are NOT
            // removed just because one got accepted — surface them here so
            // the President can always come back and move them later, not
            // only right after clicking Accept.
            let leftoverCount = appsInSlot.filter(a => a.status === 'Waiting').length;
            let leftoverBadge = (isAdmin && leftoverCount > 0)
                ? `<br><span style="color:#f59e0b; font-size:0.75rem; cursor:pointer; text-decoration:underline;" onclick="openReassignModal('${utcTimeStr}')">${t("move_waiting_count", { count: leftoverCount })}</span>`
                : '';

            row.innerHTML = `
                <td>${actionBtn}</td>
                <td><strong>${utcTimeStr} UTC</strong><br><small style="color:#8a8d98;">${t("local_prefix", { time: localTimeStr })}</small></td>
                <td><span style="color:#22c55e; font-weight:bold;">${t("status_accepted")}</span>${leftoverBadge}</td>
                <td>${escapeHtml(capZalgo(acceptedApp.nickname))}</td>
                <td><span style="cursor:pointer; color:#3b82f6; text-decoration:underline;" onclick="copyToClipboard('${escapeHtml(acceptedApp.game_id)}')">${escapeHtml(acceptedApp.game_id)}</span></td>
                <td>${escapeHtml(acceptedApp.furnace_level) || '-'}</td>
            `;
        } else {
            let actionBtn = `<button class="btn-apply" onclick="applySlot('${utcTimeStr}')">${t("btn_apply_action")}</button>`;
            let statusText = `<span class="no-apps">${t("status_no_applications")}</span>`;
            if (countWaiting > 0) {
                statusText = `<span style="color:#f59e0b; font-weight:bold; cursor:pointer; text-decoration:underline;" onclick="openWaitingModal('${utcTimeStr}')">${t("status_waiting_count", { count: countWaiting })}</span>`;
            }
            row.innerHTML = `
                <td>${actionBtn}</td>
                <td><strong>${utcTimeStr} UTC</strong><br><small style="color:#8a8d98;">${t("local_prefix", { time: localTimeStr })}</small></td>
                <td>${statusText}</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
            `;
        }
        tbody.appendChild(row);
    }
}

