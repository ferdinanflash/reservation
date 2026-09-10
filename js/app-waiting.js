// ================= WAITING =================
// Moving leftover waiting-list applications to another slot, removing
// applications, CSV export, and finishing SvS.
// Part of the app script, split out of the old single script.js.
// Load order matters: see the <script> tags in index.html.

// ================= MOVE LEFTOVER WAITING APPS TO ANOTHER SLOT =================
// Whenever a slot gets an Accepted application, any OTHER application that
// was still "Waiting" in that same slot is left completely intact in the
// database — it is never auto-deleted or auto-accepted. This section gives
// the President a way to relocate each leftover applicant to a free slot
// instead, from a dedicated modal (openReassignModal / closeReassignModal).

// All 48 half-hour UTC slots used by the schedule table, as "HH:MM" strings.
function getAllUtcSlots() {
    const slots = [];
    for (let i = 0; i < 48; i++) {
        const totalMinutes = i * 30;
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
    return slots;
}

// A slot counts as "free" for reassignment if it doesn't already have an
// Accepted application. excludeTime lets the origin slot be left out, since
// moving an applicant back to the slot they're already stuck in is pointless.
function getAvailableTimeSlots(excludeTime = null) {
    return getAllUtcSlots().filter(time => {
        if (time === excludeTime) return false;
        const hasAccepted = savedApplications.some(a => String(a.time_slot).trim() === time && a.status === 'Accepted');
        return !hasAccepted;
    });
}

function getLeftoverWaitingApps(timeStr) {
    return savedApplications.filter(a => String(a.time_slot).trim() === timeStr && a.status === 'Waiting');
}

function openReassignModal(originTime) {
    if (!isAdmin) return;
    const modal = document.getElementById('reassign-modal');
    if (!modal) return;

    currentReassignModalTime = originTime;
    const titleEl = document.getElementById('reassign-modal-title');
    if (titleEl) titleEl.innerText = t("reassign_modal_title_dyn", { time: originTime });

    renderReassignRows(originTime);
    modal.classList.remove('hidden');
}

function closeReassignModal() {
    currentReassignModalTime = null;
    const modal = document.getElementById('reassign-modal');
    if (modal) modal.classList.add('hidden');
}

function renderReassignRows(originTime) {
    const tbody = document.getElementById('reassign-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const leftovers = getLeftoverWaitingApps(originTime);
    if (leftovers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="padding:12px; text-align:center; color:#8a8d98;">${t("no_more_waiting")}</td></tr>`;
        return;
    }

    const availableSlots = getAvailableTimeSlots(originTime);

    leftovers.forEach(app => {
        const row = document.createElement('tr');
        const selectId = `reassign-select-${app.id}`;
        const options = availableSlots.length > 0
            ? availableSlots.map(t => `<option value="${t}">${t} UTC</option>`).join('')
            : `<option value="">${t("no_free_slots")}</option>`;

        row.innerHTML = `
            <td style="padding: 5px 10px; text-align: left; white-space: nowrap;">${escapeHtml(capZalgo(app.nickname))}</td>
            <td style="padding: 5px 10px; text-align: left; white-space: nowrap;">
                <span style="cursor:pointer; color:#3b82f6; text-decoration:underline;" onclick="copyToClipboard('${escapeHtml(app.game_id)}')">${escapeHtml(app.game_id)}</span>
            </td>
            <td style="padding: 5px 10px; text-align: left;">
                <select id="${selectId}" style="max-width: 140px;" ${availableSlots.length === 0 ? 'disabled' : ''}>${options}</select>
            </td>
            <td style="padding: 5px 10px; text-align: left; white-space: nowrap;">
                <button class="btn-apply btn-compact" style="font-size:0.7rem;" ${availableSlots.length === 0 ? 'disabled' : ''} onclick="moveAppToSlot(${app.id}, document.getElementById('${selectId}').value, '${originTime}')">${t("btn_move")}</button>
                <button type="button" class="btn-apply btn-danger btn-compact admin-action-btn admin-reject-btn" onclick="removeApp(${app.id})">${t("btn_drop")}</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Relocates one leftover applicant to a different (still free) slot. Status
// stays "Waiting" — this only moves them, it never deletes or auto-accepts.
async function moveAppToSlot(id, newTimeSlot, originTime) {
    if (!isAdmin) return;
    if (!newTimeSlot) {
        showToast(t("toast_no_slot_selected"), "warning");
        return;
    }

    const client = getSupabase();
    if (!client) return;

    try {
        const app = savedApplications.find(a => a.id === id);
        if (!app) throw new Error('Application not found');
        const oldTime = String(app.time_slot).trim();
        const nextLog = [...getApplicationTimeLog(app), {
            action: 'moved',
            at: new Date().toISOString(),
            actor: currentStaffUsername || 'President',
            detail: `${oldTime} UTC → ${newTimeSlot} UTC`
        }];
        const { error } = await client
            .from('reservation_slots')
            .update({ time_slot: newTimeSlot, time_log: nextLog })
            .eq('id', id);
        if (error) throw error;
        showToast(t("toast_applicant_moved", { time: newTimeSlot }), "success");
        await loadApplications();
        renderReassignRows(originTime);
    } catch (err) {
        console.error("Failed to move application:", err);
        showToast(t("toast_move_failed"), "error");
    }
}

async function removeApp(id) {
    showCustomConfirm("Delete this application record permanently?", async () => {
        const client = getSupabase();
        if (!client) return;
        closeModal(); 
        try {
            const { error } = await client.from('reservation_slots').delete().eq('id', id);
            if (error) throw error;
            showToast(t("toast_record_dropped"), "success");
            loadApplications();
            loadRecentAccepts(); 
        } catch (err) {
            console.error("Failed to delete application:", err);
            showToast(t("toast_delete_failed"), "error");
        }
    }, '#ef4444');
}

function exportToCSV() {
    if (savedApplications.length === 0) {
        showToast(t("toast_no_data_export"), "warning");
        return;
    }
    const headers = ["Position", "Time Slot UTC", "Status", "Nickname", "Game ID", "Furnace Level", "Fire Crystal", "Refined Fire Crystal", "Fire Crystal Shard", "General SP (Days)", "Construction SP (Days)", "Research SP (Days)", "Training SP (Days)"];
    const rows = savedApplications.map(app => [
        sanitizeCsvField(app.position), sanitizeCsvField(app.time_slot), sanitizeCsvField(app.status),
        sanitizeCsvField(app.nickname || '-'), sanitizeCsvField(app.game_id || '-'), sanitizeCsvField(app.furnace_level || '-'), sanitizeCsvField(app.fire_crystal || '0'),
        sanitizeCsvField(app.refined_fire_crystal || '0'), sanitizeCsvField(app.fire_crystal_shard || '0'),
        sanitizeCsvField(app.general_speedup || '0'), sanitizeCsvField(app.construction_speedup || '0'),
        sanitizeCsvField(app.research_speedup || '0'), sanitizeCsvField(app.training_speedup || '0')
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SVS_Minister_Export_${currentPosition.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(t("toast_csv_downloaded"), "success");
}

async function handleFinishSVS() {
    if (!isAdmin) return;
    const client = getSupabase();
    if (!client) return;

    showCustomConfirm("Caution to finish SvS!\n Are you sure ?, this will be reset all applied data", async () => {
        const finishBtn = document.getElementById('finish-svs-btn');
        setButtonBusy(finishBtn, true, 'Clearing...');
        try {
            const { error } = await client.from('reservation_slots').delete().neq('id', 0); 
            if (error) throw error;
            showToast(t("toast_all_cleared"), "success");
            loadApplications();
            loadRecentAccepts(); 
        } catch (err) {
            console.error("Failed to clear data:", err);
            showToast(t("toast_clear_failed"), "error");
        } finally {
            setButtonBusy(finishBtn, false);
        }
    }, '#dc2626'); 
}

