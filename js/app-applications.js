// ================= APPLICATIONS =================
// Everything about a single application: time log, admin edit controls,
// detail cards, details/waiting modals, the apply form (incl. additional
// preferred time slots), submitting and accepting applications.
// Part of the app script, split out of the old single script.js.
// Load order matters: see the <script> tags in index.html.

// ================= APPLICATION TIME LOG =================
// Time history is stored per application in reservation_slots.time_log as a
// JSON array. It is intentionally rendered only inside the magnifying-glass
// detail view, never in the main schedule table.
function getApplicationTimeLog(app) {
    let log = app && app.time_log;
    if (typeof log === 'string') {
        try { log = JSON.parse(log); } catch (_) { log = []; }
    }
    if (!Array.isArray(log)) log = [];

    // Older records may predate the time_log column. If they have created_at,
    // surface that timestamp without changing the record until an admin saves it.
    if (log.length === 0 && app && app.created_at) {
        log = [{ action: 'created', at: app.created_at, actor: 'Applicant' }];
    }
    return log;
}

function formatApplicationLogTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(String(value));
    const langMap = { en: 'en-US', id: 'id-ID', ph: 'fil-PH', cn: 'zh-CN' };
    const locale = langMap[(typeof getLang === 'function' ? getLang() : 'en')] || 'en-US';
    try {
        return new Intl.DateTimeFormat(locale, {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }).format(date);
    } catch (_) {
        return date.toLocaleString();
    }
}

function buildApplicationTimeLogHtml(app) {
    const log = getApplicationTimeLog(app);
    if (log.length === 0) {
        return `<div class="application-time-log-empty">${t("time_log_empty")}</div>`;
    }

    return log.map(entry => {
        const actionKey = String(entry.action || 'updated').toLowerCase();
        const actionLabel = t(`time_log_${actionKey}`) || entry.action || t("time_log_updated");
        const detail = entry.detail ? ` — ${escapeHtml(String(entry.detail))}` : '';
        const actor = entry.actor ? `<span class="time-log-actor">${escapeHtml(String(entry.actor))}</span>` : '';
        return `<div class="time-log-entry">
            <div class="time-log-main"><strong>${escapeHtml(actionLabel)}</strong>${detail}</div>
            <div class="time-log-meta">${formatApplicationLogTime(entry.at)}${actor ? ` · ${actor}` : ''}</div>
        </div>`;
    }).join('');
}

async function appendApplicationTimeLog(app, entry) {
    const client = getSupabase();
    if (!client || !app || !app.id) return;

    const nextLog = [...getApplicationTimeLog(app), {
        action: entry.action || 'updated',
        at: entry.at || new Date().toISOString(),
        actor: entry.actor || (isAdmin ? (currentStaffUsername || 'President') : 'Applicant'),
        detail: entry.detail || ''
    }];

    const { error } = await client
        .from('reservation_slots')
        .update({ time_log: nextLog })
        .eq('id', app.id);
    if (error) throw error;
    app.time_log = nextLog;
}

function buildAdminApplicationControls(app) {
    if (!isAdmin) return '';

    const currentStatus = app.status === 'Accepted' ? 'Accepted' : 'Waiting';
    const allSlots = getAllUtcSlots();
    const options = allSlots.map(time =>
        `<option value="${time}" ${String(app.time_slot).trim() === time ? 'selected' : ''}>${time} UTC</option>`
    ).join('');

    return `
        <div class="admin-application-controls">
            <div class="admin-control-title">${t("admin_application_controls")}</div>
            <div class="admin-control-grid">
                <label>${t("admin_status_label")}
                    <select id="admin-status-select-${app.id}" class="admin-control-select">
                        <option value="Waiting" ${currentStatus === 'Waiting' ? 'selected' : ''}>${t("status_waiting")}</option>
                        <option value="Accepted" ${currentStatus === 'Accepted' ? 'selected' : ''}>${t("status_accepted")}</option>
                    </select>
                </label>
                <label>${t("admin_time_label")}
                    <select id="admin-time-select-${app.id}" class="admin-control-select">${options}</select>
                </label>
            </div>
            <button type="button" class="btn-apply admin-save-application-btn" onclick="saveAdminApplicationChanges(${app.id})">${t("btn_save_changes")}</button>
        </div>
    `;
}

async function saveAdminApplicationChanges(id) {
    if (!isAdmin) return;
    const app = savedApplications.find(a => a.id === id);
    if (!app) return;

    const statusEl = document.getElementById(`admin-status-select-${id}`);
    const timeEl = document.getElementById(`admin-time-select-${id}`);
    if (!statusEl || !timeEl) return;

    const newStatus = statusEl.value === 'Accepted' ? 'Accepted' : 'Waiting';
    const newTime = String(timeEl.value || '').trim();
    const oldStatus = app.status === 'Accepted' ? 'Accepted' : 'Waiting';
    const oldTime = String(app.time_slot).trim();

    if (!newTime) {
        showToast(t("toast_no_slot_selected"), "warning");
        return;
    }
    if (newStatus === oldStatus && newTime === oldTime) {
        showToast(t("toast_no_changes"), "warning");
        return;
    }

    // Only one Accepted application is allowed per UTC slot.
    const occupiedByAnotherAccepted = savedApplications.some(other =>
        other.id !== id &&
        other.status === 'Accepted' &&
        String(other.time_slot).trim() === newTime
    );
    if (newStatus === 'Accepted' && occupiedByAnotherAccepted) {
        showToast(t("toast_slot_already_accepted"), "error");
        return;
    }

    const changes = {};
    if (newStatus !== oldStatus) changes.status = newStatus;
    if (newTime !== oldTime) changes.time_slot = newTime;

    const detailParts = [];
    if (newTime !== oldTime) detailParts.push(`${oldTime} UTC → ${newTime} UTC`);
    if (newStatus !== oldStatus) detailParts.push(`${oldStatus} → ${newStatus}`);

    const now = new Date().toISOString();
    const nextLog = [...getApplicationTimeLog(app), {
        action: newTime !== oldTime && newStatus !== oldStatus ? 'updated' : (newTime !== oldTime ? 'moved' : 'status_changed'),
        at: now,
        actor: currentStaffUsername || 'President',
        detail: detailParts.join('; ')
    }];
    changes.time_log = nextLog;

    const client = getSupabase();
    if (!client) return;

    const saveBtn = document.querySelector(`#details-content .admin-save-application-btn`);
    setButtonBusy(saveBtn, true, t("saving"));
    try {
        const { error } = await client.from('reservation_slots').update(changes).eq('id', id);
        if (error) throw error;
        showToast(t("toast_application_updated"), "success");
        await loadApplications();
        loadRecentAccepts();
        const refreshed = savedApplications.find(a => a.id === id);
        if (refreshed) openDetailsModal(id);
    } catch (err) {
        console.error("Failed to update application:", err);
        showToast(t("toast_application_update_failed"), "error");
    } finally {
        setButtonBusy(saveBtn, false);
    }
}

// ================= DETAIL CARD VISUAL HELPERS =================
// Small presentational helpers used only by the full (non-compact) branch
// of buildStatDetailsHtml() below — the "Application Details" card view.
function stripTrailingColon(label) {
    return String(label || '').replace(/:\s*$/, '');
}

// Half-circle furnace gauge (cyan -> amber -> red zones) with a needle
// pointing at the current furnace level out of 10.
function buildFurnaceGaugeSvg(level) {
    const lvl = Math.max(0, Math.min(10, parseInt(level, 10) || 0));
    const rad = (180 + (lvl / 10) * 180) * Math.PI / 180;
    const nx = (50 + 29 * Math.cos(rad)).toFixed(1);
    const ny = (50 + 29 * Math.sin(rad)).toFixed(1);
    return `
        <svg width="60" height="38" viewBox="0 0 100 58" class="furnace-gauge-svg" aria-hidden="true">
            <path d="M 12 50 A 38 38 0 0 1 31 17.1" stroke="#22d3ee" stroke-width="9" fill="none" stroke-linecap="round"/>
            <path d="M 31 17.1 A 38 38 0 0 1 69 17.1" stroke="#f59e0b" stroke-width="9" fill="none" stroke-linecap="round"/>
            <path d="M 69 17.1 A 38 38 0 0 1 88 50" stroke="#ef4444" stroke-width="9" fill="none" stroke-linecap="round"/>
            <line x1="50" y1="50" x2="${nx}" y2="${ny}" stroke="#e5e7eb" stroke-width="3" stroke-linecap="round"/>
            <circle cx="50" cy="50" r="4.5" fill="#e5e7eb"/>
        </svg>
    `;
}

// One donut-ring speedup indicator. `pct` (0-100) drives the conic-gradient
// fill; the raw day count + label are rendered centered/underneath.
function buildSpeedupRing(value, maxValue, colorKey, label) {
    const ringColors = { general: '#22d3ee', construction: '#a78bfa', research: '#34d399', training: '#f59e0b' };
    const color = ringColors[colorKey] || '#3b82f6';
    const pct = maxValue > 0 ? Math.min(100, Math.round((value / maxValue) * 100)) : 0;
    return `
        <div class="speedup-ring-wrap">
            <div class="speedup-ring-outer" style="background: conic-gradient(${color} 0% ${pct}%, #262a35 ${pct}% 100%);">
                <div class="speedup-ring-inner">
                    <span class="ring-value">${value}</span>
                    <span class="ring-unit">${escapeHtml(t('days_suffix'))}</span>
                </div>
            </div>
            <div class="speedup-ring-label">${escapeHtml(label)}</div>
        </div>
    `;
}

// ================= SHARED DETAIL BLOCK BUILDER =================
// Shared by openDetailsModal() and openWaitingModal() so the stat detail
// markup isn't duplicated in two different places.
function buildStatDetailsHtml(app, compact = false) {
    const additionalSlots = getAdditionalTimeSlots(app);
    const additionalSlotsText = additionalSlots.map(s => `${escapeHtml(s)} UTC`).join(', ');
    const additionalRowCompact = additionalSlots.length > 0
        ? `<div class="stat-compact-row"><span class="stat-compact-label" style="color:#8a8d98;">${t("stat_additional_time_slots")}</span> <strong style="color:#f1f5f9;">${additionalSlotsText}</strong></div>`
        : '';
    const additionalRowFull = additionalSlots.length > 0
        ? `<div class="detail-extra-row">${t("stat_additional_time_slots")} <strong>${additionalSlotsText}</strong></div>`
        : '';

    if (compact) {
        return `
            <div class="stat-compact-row"><span class="stat-compact-label" style="color:#8a8d98;">${t("stat_furnace_lvl")}</span> <strong style="color:#f1f5f9;">${escapeHtml(app.furnace_level) || '-'}</strong></div>
            ${additionalRowCompact}
            <div class="stat-compact-row"><span class="stat-compact-label" style="color:#8a8d98;">${t("stat_fc")}</span> <strong style="color:#f59e0b;">${escapeHtml(app.fire_crystal) || '0'}</strong></div>
            <div class="stat-compact-row"><span class="stat-compact-label" style="color:#8a8d98;">${t("stat_rfc")}</span> <strong style="color:#f59e0b;">${escapeHtml(app.refined_fire_crystal) || '0'}</strong></div>
            <div class="stat-compact-row"><span class="stat-compact-label" style="color:#8a8d98;">${t("stat_shard")}</span> <strong style="color:#f59e0b;">${escapeHtml(app.fire_crystal_shard) || '0'}</strong></div>
            <div class="stat-compact-row"><span class="stat-compact-label" style="color:#8a8d98;">${t("stat_general")}</span> <strong style="color:#f1f5f9;">${escapeHtml(app.general_speedup) || '0'}</strong></div>
            <div class="stat-compact-row"><span class="stat-compact-label" style="color:#8a8d98;">${t("stat_const")}</span> <strong style="color:#f1f5f9;">${escapeHtml(app.construction_speedup) || '0'}</strong></div>
            <div class="stat-compact-row"><span class="stat-compact-label" style="color:#8a8d98;">${t("stat_research")}</span> <strong style="color:#f1f5f9;">${escapeHtml(app.research_speedup) || '0'}</strong></div>
            <div class="stat-compact-row"><span class="stat-compact-label" style="color:#8a8d98;">${t("stat_train")}</span> <strong style="color:#f1f5f9;">${escapeHtml(app.training_speedup) || '0'}</strong></div>
        `;
    }

    const furnaceLevel = parseInt(app.furnace_level, 10) || 0;
    const fc = parseInt(app.fire_crystal, 10) || 0;
    const rfc = parseInt(app.refined_fire_crystal, 10) || 0;
    const shard = parseInt(app.fire_crystal_shard, 10) || 0;
    const gen = parseInt(app.general_speedup, 10) || 0;
    const cons = parseInt(app.construction_speedup, 10) || 0;
    const res = parseInt(app.research_speedup, 10) || 0;
    const train = parseInt(app.training_speedup, 10) || 0;
    const maxSpeedup = Math.max(gen, cons, res, train, 20);
    const gameId = escapeHtml(app.game_id) || '-';

    return `
        <div class="detail-card">
            <div class="detail-card-title"><span class="detail-card-icon">🛡️</span>${t("detail_section_player_info")}</div>
            <div class="player-info-row">
                <div class="player-avatar">🔥</div>
                <div class="player-info-text">
                    <div>${t("stat_nickname")} <strong>${escapeHtml(capZalgo(app.nickname)) || '-'}</strong></div>
                    <div>${t("stat_game_id")} <strong class="game-id-copy" title="${t('title_view_details')}" onclick="copyToClipboard('${gameId}')">${gameId} <span class="copy-icon">📋</span></strong></div>
                    ${additionalRowFull}
                </div>
            </div>
        </div>

        <div class="detail-card">
            <div class="detail-card-title"><span class="detail-card-icon">🏰</span>${t("detail_section_city_power")}</div>
            <div class="city-power-row">
                <div class="city-power-text">${t("stat_furnace_level")} <strong>${furnaceLevel || '-'}</strong></div>
                ${buildFurnaceGaugeSvg(furnaceLevel)}
            </div>
        </div>

        <div class="detail-card">
            <div class="detail-card-title"><span class="detail-card-icon">💎</span>${t("detail_section_essentials")}</div>
            <div class="essentials-badges">
                <span class="essential-badge essential-fc">🔥 ${t("stat_fc")} <strong>${fc}</strong></span>
                <span class="essential-badge essential-rfc">🔥 ${t("stat_rfc")} <strong>${rfc}</strong></span>
                <span class="essential-badge essential-shard">💠 ${t("essentials_shard_label")} <strong>${shard}</strong></span>
            </div>
        </div>

        <div class="detail-card">
            <div class="detail-card-title"><span class="detail-card-icon">⚡</span>${t("detail_section_speedups")}</div>
            <div class="speedup-rings-row">
                ${buildSpeedupRing(gen, maxSpeedup, 'general', stripTrailingColon(t('stat_general')))}
                ${buildSpeedupRing(cons, maxSpeedup, 'construction', stripTrailingColon(t('stat_const')))}
                ${buildSpeedupRing(res, maxSpeedup, 'research', stripTrailingColon(t('stat_research')))}
                ${buildSpeedupRing(train, maxSpeedup, 'training', stripTrailingColon(t('stat_train')))}
            </div>
        </div>
    `;
}

// Function to open the detail popup modal
function openDetailsModal(appId) {
    const app = savedApplications.find(a => a.id === appId);
    if (!app) return;

    const modal = document.getElementById('details-modal');
    const contentEl = document.getElementById('details-content');
    contentEl.innerHTML = `
        ${buildStatDetailsHtml(app, false)}
        <div class="application-time-log">
            <div class="application-time-log-title">${t("time_log_title")}</div>
            <div class="application-time-log-list">${buildApplicationTimeLogHtml(app)}</div>
        </div>
        ${buildAdminApplicationControls(app)}
    `;
    contentEl.dataset.appId = String(appId);
    modal.classList.remove('hidden');
}

function closeDetailsModal() {
    document.getElementById('details-modal').classList.add('hidden');
}

function openWaitingModal(timeStr) {
    const modal = document.getElementById('waiting-modal');
    if (!modal) return;
    
    currentWaitingModalTime = timeStr;
    document.getElementById('modal-title').innerText = t("waiting_list_title", { time: timeStr });
    const modalTbody = document.getElementById('modal-table-body');
    modalTbody.innerHTML = "";

    const thead = modal.querySelector('thead tr');
    thead.innerHTML = `
        <th style="padding: 5px 10px; text-align: left;">${t("modal_nickname_short")}</th>
        <th style="padding: 5px 10px; text-align: left;">${t("modal_id_short")}</th>
        ${isAdmin ? `<th style="padding: 5px 10px; text-align: left;">${t("th_move_to")}</th>` : ''}
        ${isAdmin ? `<th style="padding: 5px 10px; text-align: left;">${t("th_actions")}</th>` : ''}
    `;

    let appsInSlot = savedApplications.filter(a => String(a.time_slot).trim() === timeStr && a.status === 'Waiting');

    appsInSlot.forEach(app => {
        const mainRow = document.createElement('tr');
        let adminButtons = isAdmin ? `
            <div class="admin-action-buttons" role="group" aria-label="Application actions">
                <button type="button" class="btn-apply btn-compact admin-action-btn admin-accept-btn" onclick="acceptApp(${app.id})">${t("btn_accept")}</button>
                <button type="button" class="btn-apply btn-danger btn-compact admin-action-btn admin-reject-btn" onclick="removeApp(${app.id})">${t("btn_drop")}</button>
            </div>
        ` : '';

        // President/Admin can move ANY Waiting application directly from the Waiting List.
        // The status remains Waiting; only time_slot and the time log are changed.
        const availableWaitingSlots = isAdmin ? getAvailableTimeSlots(timeStr) : [];
        const moveSelectId = `waiting-move-select-${app.id}`;
        const moveOptions = availableWaitingSlots.length > 0
            ? availableWaitingSlots.map(time => `<option value="${time}">${time} UTC</option>`).join('')
            : `<option value="">${t("no_free_slots")}</option>`;
        const moveControls = isAdmin ? `
            <select id="${moveSelectId}" class="admin-control-select waiting-move-select" ${availableWaitingSlots.length === 0 ? 'disabled' : ''}>${moveOptions}</select>
            <button type="button" class="btn-apply btn-compact waiting-move-btn" ${availableWaitingSlots.length === 0 ? 'disabled' : ''} onclick="moveWaitingListApp(${app.id}, document.getElementById('${moveSelectId}').value, '${timeStr}')">${t("btn_move")}</button>
        ` : '-';

        mainRow.innerHTML = `
            <td style="padding: 5px 10px; text-align: left; font-weight: 500; white-space: nowrap;">
                <span class="icon-tap-target" style="cursor:pointer; margin-right: 6px;" onclick="toggleDetails(${app.id})">🔍</span>${escapeHtml(capZalgo(app.nickname))}
            </td>
            <td style="padding: 5px 10px; text-align: left; white-space: nowrap;">
                <span style="cursor:pointer; color:#3b82f6; text-decoration:underline;" onclick="copyToClipboard('${escapeHtml(app.game_id)}')">${escapeHtml(app.game_id)}</span>
            </td>
            ${isAdmin ? `<td style="padding: 5px 10px; text-align: left; white-space: nowrap;">${moveControls}</td>` : ''}
            ${isAdmin ? `<td style="padding: 5px 10px; text-align: left; white-space: nowrap;">${adminButtons}</td>` : ''}
        `;
        modalTbody.appendChild(mainRow);

        const detailsRow = document.createElement('tr');
        detailsRow.id = `details-${app.id}`;
        detailsRow.style.display = 'none'; 
        detailsRow.innerHTML = `
            <td colspan="${isAdmin ? 4 : 2}" style="padding: 0; border: none;">
                <div style="background: #151821; padding: 8px; margin: 2px 5px; border-radius: 4px; font-size: 0.8rem; text-align: left; border: 1px solid #334155;">
                    ${buildStatDetailsHtml(app, true)}
                    <div class="waiting-time-log">
                        <div class="application-time-log-title">${t("time_log_title")}</div>
                        <div class="application-time-log-list">${buildApplicationTimeLogHtml(app)}</div>
                    </div>
                </div>
            </td>
        `;
        modalTbody.appendChild(detailsRow);
    });
    
    modal.classList.remove('hidden');
}

// Move directly from the Waiting List. This intentionally preserves the Waiting status.
async function moveWaitingListApp(id, newTimeSlot, originTime) {
    if (!isAdmin) return;
    if (!newTimeSlot) {
        showToast(t("toast_no_slot_selected"), "warning");
        return;
    }

    const app = savedApplications.find(a => a.id === id);
    if (!app) return;
    if (app.status !== 'Waiting') return;

    const oldTime = String(app.time_slot).trim();
    if (oldTime === String(newTimeSlot).trim()) {
        showToast(t("toast_no_changes"), "warning");
        return;
    }

    const client = getSupabase();
    if (!client) return;

    const btn = document.querySelector(`#waiting-move-select-${id}`)?.nextElementSibling;
    setButtonBusy(btn, true, t("saving"));
    try {
        const nextLog = [...getApplicationTimeLog(app), {
            action: 'moved',
            at: new Date().toISOString(),
            actor: currentStaffUsername || 'President',
            detail: `${oldTime} UTC → ${String(newTimeSlot).trim()} UTC`
        }];
        const { error } = await client.from('reservation_slots').update({
            time_slot: String(newTimeSlot).trim(),
            time_log: nextLog
        }).eq('id', id);
        if (error) throw error;

        showToast(t("toast_applicant_moved", { time: String(newTimeSlot).trim() }), "success");
        await loadApplications();
        openWaitingModal(originTime);
    } catch (err) {
        console.error("Failed to move waiting application:", err);
        showToast(t("toast_move_failed"), "error");
    } finally {
        setButtonBusy(btn, false);
    }
}

function toggleDetails(id) {
    const detailsRow = document.getElementById(`details-${id}`);
    if (detailsRow) {
        detailsRow.style.display = detailsRow.style.display === 'none' ? 'table-row' : 'none';
    }
}

function closeModal() {
    currentWaitingModalTime = null;
    document.getElementById('waiting-modal').classList.add('hidden');
}

function applySlot(time) {
    if (!isReservationOpen) {
        showToast(t("toast_reservation_locked"), "error");
        return; 
    }

    selectedTimeSlot = time;
    document.getElementById('form-position-title').innerText = translatePositionName(currentPosition);
    document.getElementById('form-time-title').innerText = time + " UTC";
    
    document.getElementById('input-nickname').value = "";
    document.getElementById('input-gameid').value = "";
    document.getElementById('input-furnace').value = "";
    document.getElementById('input-fc').value = "";
    document.getElementById('input-rfc').value = "";
    document.getElementById('input-shard').value = "";
    document.getElementById('input-gensp').value = "";
    document.getElementById('input-constsp').value = "";
    document.getElementById('input-ressp').value = "";
    document.getElementById('input-trainsp').value = "";

    // Reset the Additional Preferred Time Slot section for a fresh form.
    document.getElementById('input-additional-time-toggle').checked = false;
    const additionalContainer = document.getElementById('additional-time-slots-container');
    additionalContainer.innerHTML = "";
    additionalContainer.classList.add('hidden');
    document.getElementById('btn-add-another-time').classList.add('hidden');
    additionalTimeSlotSeq = 0;

    const fieldGroups = {
        fc: document.getElementById('input-fc').closest('.form-group'),
        rfc: document.getElementById('input-rfc').closest('.form-group'),
        shard: document.getElementById('input-shard').closest('.form-group'),
        const: document.getElementById('input-constsp').closest('.form-group'),
        res: document.getElementById('input-ressp').closest('.form-group'),
        train: document.getElementById('input-trainsp').closest('.form-group')
    };

    Object.values(fieldGroups).forEach(group => group.classList.remove('hidden'));

    const { hiddenFields } = getPositionConfig(currentPosition);
    hiddenFields.forEach(fieldKey => {
        if (fieldGroups[fieldKey]) fieldGroups[fieldKey].classList.add('hidden');
    });
    
    document.getElementById('apply-modal').classList.remove('hidden');
}

function closeApplyModal() {
    document.getElementById('apply-modal').classList.add('hidden');
}

// Called when the "Additional Preferred Time Slot" checkbox is toggled.
// Checking it reveals the first extra dropdown; unchecking it clears
// everything back out.
function toggleAdditionalTimeSlots() {
    const checked = document.getElementById('input-additional-time-toggle').checked;
    const container = document.getElementById('additional-time-slots-container');
    const addBtn = document.getElementById('btn-add-another-time');

    if (checked) {
        container.classList.remove('hidden');
        if (container.children.length === 0) {
            addAdditionalTimeSlotRow();
        }
        addBtn.classList.toggle('hidden', container.children.length >= MAX_ADDITIONAL_TIME_SLOTS);
    } else {
        container.classList.add('hidden');
        container.innerHTML = "";
        addBtn.classList.add('hidden');
    }
}

// Triggered by the "+ Add another time?" button.
function addAnotherTimeSlot() {
    addAdditionalTimeSlotRow();
}

// Appends one more time-slot dropdown row, up to MAX_ADDITIONAL_TIME_SLOTS.
function addAdditionalTimeSlotRow() {
    const container = document.getElementById('additional-time-slots-container');
    const addBtn = document.getElementById('btn-add-another-time');
    if (container.children.length >= MAX_ADDITIONAL_TIME_SLOTS) return;

    additionalTimeSlotSeq++;
    const rowId = additionalTimeSlotSeq;

    const options = getAllUtcSlots().map(time => `<option value="${time}">${time} UTC</option>`).join('');
    const row = document.createElement('div');
    row.className = 'additional-time-slot-row';
    row.id = `additional-time-row-${rowId}`;
    row.innerHTML = `
        <select id="input-additional-time-${rowId}" class="additional-time-select">
            <option value="">${t("option_select_additional_time")}</option>
            ${options}
        </select>
        <button type="button" class="btn-remove-additional-time" onclick="removeAdditionalTimeSlot(${rowId})" aria-label="${t("btn_remove")}" title="${t("btn_remove")}">&times;</button>
    `;
    container.appendChild(row);

    addBtn.classList.toggle('hidden', container.children.length >= MAX_ADDITIONAL_TIME_SLOTS);
}

// Removes a single additional time-slot row (does not touch the checkbox;
// the user can always add another one back up to the max).
function removeAdditionalTimeSlot(rowId) {
    const row = document.getElementById(`additional-time-row-${rowId}`);
    if (row) row.remove();

    const container = document.getElementById('additional-time-slots-container');
    const addBtn = document.getElementById('btn-add-another-time');
    const stillChecked = document.getElementById('input-additional-time-toggle').checked;
    addBtn.classList.toggle('hidden', !stillChecked || container.children.length >= MAX_ADDITIONAL_TIME_SLOTS);
}

// Reads every additional time-slot dropdown currently in the form and
// returns the distinct, non-empty selections (excluding the main
// selectedTimeSlot), capped at MAX_ADDITIONAL_TIME_SLOTS.
function collectAdditionalTimeSlots() {
    const values = Array.from(document.querySelectorAll('#additional-time-slots-container .additional-time-select'))
        .map(sel => sel.value.trim())
        .filter(v => v !== '' && v !== selectedTimeSlot);
    return [...new Set(values)].slice(0, MAX_ADDITIONAL_TIME_SLOTS);
}

// Normalizes an application's stored additional_time_slots (jsonb array or
// legacy JSON string) into a clean array of "HH:MM" strings.
function getAdditionalTimeSlots(app) {
    let slots = app && app.additional_time_slots;
    if (typeof slots === 'string') {
        try { slots = JSON.parse(slots); } catch (_) { slots = []; }
    }
    if (!Array.isArray(slots)) slots = [];
    return slots.filter(s => typeof s === 'string' && s.trim() !== '');
}

async function submitApplication() {
    if (!isReservationOpen) {
        showToast(t("toast_reservation_locked"), "error");
        return;
    }

    const client = getSupabase();
    if (!client) return;

    const nickname = document.getElementById('input-nickname').value.trim();
    const gameId = document.getElementById('input-gameid').value.trim();
    const furnaceLevel = document.getElementById('input-furnace').value.trim();
    const fc = parseInt(document.getElementById('input-fc').value.trim()) || 0;
    const rfc = parseInt(document.getElementById('input-rfc').value.trim()) || 0;
    const shard = parseInt(document.getElementById('input-shard').value.trim()) || 0;
    const genSp = parseInt(document.getElementById('input-gensp').value.trim()) || 0;
    const constSp = parseInt(document.getElementById('input-constsp').value.trim()) || 0;
    const resSp = parseInt(document.getElementById('input-ressp').value.trim()) || 0;
    const trainSp = parseInt(document.getElementById('input-trainsp').value.trim()) || 0;

    if (!nickname) { showToast(t("toast_enter_nickname"), "warning"); return; }
    if (!gameId) { showToast(t("toast_enter_gameid"), "warning"); return; }
    if (!/^\d+$/.test(gameId)) { showToast(t("toast_gameid_numeric"), "warning"); return; }
    if (!furnaceLevel) { showToast(t("toast_select_furnace"), "warning"); return; }

    const additionalTimeSlots = collectAdditionalTimeSlots();

    const submitBtn = document.querySelector('#apply-modal .btn-apply');
    setButtonBusy(submitBtn, true, 'Submitting...');

    try {
        const { error } = await client
            .from('reservation_slots')
            .insert({ 
                time_slot: selectedTimeSlot, position: currentPosition, nickname: nickname, game_id: gameId, 
                furnace_level: furnaceLevel,
                fire_crystal: fc, refined_fire_crystal: rfc, fire_crystal_shard: shard, general_speedup: genSp, construction_speedup: constSp, research_speedup: resSp, training_speedup: trainSp,
                status: 'Waiting',
                additional_time_slots: additionalTimeSlots,
                time_log: [{ action: 'created', at: new Date().toISOString(), actor: 'Applicant', detail: `${selectedTimeSlot} UTC` }]
            });

        if (error) throw error;

        showToast(t("toast_app_submitted"), "success");
        closeApplyModal();
        loadApplications();
    } catch (err) {
        console.error("Failed to submit application:", err);
        showToast(t("toast_app_submit_failed"), "error");
    } finally {
        setButtonBusy(submitBtn, false);
    }
}

async function acceptApp(id) {
    // Grab this app's time slot BEFORE it's accepted, so we know which
    // slot's other applicants (if any) need attention afterwards.
    const targetApp = savedApplications.find(a => a.id === id);
    const targetTime = targetApp ? String(targetApp.time_slot).trim() : null;

    showCustomConfirm(t("confirm_accept_app"), async () => {
        const client = getSupabase();
        if (!client) return;
        closeModal();
        try {
            if (!targetApp) throw new Error('Application not found');
            const nextLog = [...getApplicationTimeLog(targetApp), {
                action: 'status_changed',
                at: new Date().toISOString(),
                actor: currentStaffUsername || 'President',
                detail: `${targetApp.status} → Accepted`
            }];
            const { error } = await client.from('reservation_slots').update({ status: 'Accepted', time_log: nextLog }).eq('id', id);
            if (error) throw error;
            showToast(t("toast_app_approved"), "success");
            await loadApplications();
            loadRecentAccepts(); 

            // IMPORTANT: any other application that was still "Waiting" in
            // this same slot is NEVER deleted just because one got accepted.
            // Instead, immediately prompt the President to move each one to
            // a free slot instead of letting them sit invisible in the DB.
            if (targetTime && getLeftoverWaitingApps(targetTime).length > 0) {
                openReassignModal(targetTime);
            }
        } catch (err) {
            console.error("Failed to approve application:", err);
            showToast(t("toast_app_approve_failed"), "error");
            loadApplications();
        }
    }, '#22c55e');
}

