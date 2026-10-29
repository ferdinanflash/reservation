// ================= BULK ACTION (President-only) =================
// Lets the President accept or reject many applications at once instead of
// opening each one. Opened from the President Panel.
//   - Works on any position (not just the one currently on screen).
//   - Accept: only "Waiting" applications. A time slot can hold ONE accepted
//     applicant, so slots that are already taken, or that have more than one
//     selected application, are skipped (and reported).
//   - Reject: "Waiting" or "Accepted" applications, one shared reason.
//   - Every row is updated only if its status is still what was loaded
//     (so a concurrent change by someone else is never overwritten) and gets
//     the same time_log entry the single-item buttons write.
let bulkRows = [];
const bulkSelected = new Set();
let bulkBusy = false;
let bulkLoadSeq = 0;

function bulkEl(id) { return document.getElementById(id); }

function fillBulkPositionOptions() {
    const select = bulkEl('bulk-position');
    if (!select) return;
    const previous = select.value || currentPosition;
    select.innerHTML = '';
    Object.keys(POSITION_CONFIG).forEach((name) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = translatePositionName(name);
        select.appendChild(option);
    });
    if (POSITION_CONFIG[previous]) select.value = previous;
}

function openBulkModal() {
    if (!isAdmin) return;
    const modal = bulkEl('bulk-modal');
    if (!modal) return;
    fillBulkPositionOptions();
    const filter = bulkEl('bulk-filter');
    if (filter) filter.value = 'Waiting';
    modal.classList.remove('hidden');
    loadBulkRows();
}

function closeBulkModal() {
    const modal = bulkEl('bulk-modal');
    if (!modal || modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    bulkRows = [];
    bulkSelected.clear();
    bulkLoadSeq++;
}

async function loadBulkRows() {
    const client = getSupabase();
    const list = bulkEl('bulk-list');
    const position = bulkEl('bulk-position')?.value;
    if (!client || !list || !position) return;

    const seq = ++bulkLoadSeq;
    bulkSelected.clear();
    updateBulkSelectionUI();
    list.innerHTML = `<div class="bulk-empty"><span class="spinner-inline"></span>${escapeHtml(t('loading_schedule'))}</div>`;

    try {
        const { data, error } = await client
            .from('reservation_slots')
            .select('*')
            .eq('position', position)
            .order('time_slot', { ascending: true });
        if (error) throw error;
        if (seq !== bulkLoadSeq) return;
        bulkRows = data || [];
    } catch (err) {
        if (seq !== bulkLoadSeq) return;
        console.error('Bulk action: failed to load applications:', err);
        bulkRows = [];
        list.innerHTML = `<div class="bulk-empty">${escapeHtml(t('bulk_load_failed'))}</div>`;
        return;
    }
    renderBulkList();
}

function getBulkVisibleRows() {
    const filter = bulkEl('bulk-filter')?.value || 'Waiting';
    return bulkRows
        .filter((r) => filter === 'all' ? (r.status === 'Waiting' || r.status === 'Accepted') : r.status === filter)
        .sort((a, b) => String(a.time_slot).trim().localeCompare(String(b.time_slot).trim()));
}

function renderBulkList() {
    const list = bulkEl('bulk-list');
    if (!list) return;
    const rows = getBulkVisibleRows();
    // Drop selections that are no longer visible after a filter change.
    const visibleIds = new Set(rows.map((r) => r.id));
    Array.from(bulkSelected).forEach((id) => { if (!visibleIds.has(id)) bulkSelected.delete(id); });

    if (rows.length === 0) {
        list.innerHTML = `<div class="bulk-empty">${escapeHtml(t('bulk_empty'))}</div>`;
        updateBulkSelectionUI();
        return;
    }
    list.innerHTML = rows.map((r) => {
        const accepted = r.status === 'Accepted';
        const statusLabel = accepted ? t('bulk_filter_accepted') : t('bulk_filter_waiting');
        return `<label class="bulk-row">
            <input type="checkbox" class="bulk-check" data-id="${escapeHtml(String(r.id))}"${bulkSelected.has(r.id) ? ' checked' : ''}>
            <span class="bulk-row-time">${escapeHtml(String(r.time_slot).trim())} UTC</span>
            <span class="bulk-row-name">${escapeHtml(capZalgo(r.nickname || '-'))}<small>${escapeHtml(r.game_id || '-')}</small></span>
            <span class="bulk-tag ${accepted ? 'bulk-tag-accepted' : 'bulk-tag-waiting'}">${escapeHtml(statusLabel)}</span>
        </label>`;
    }).join('');
    updateBulkSelectionUI();
}

function updateBulkSelectionUI() {
    const visible = getBulkVisibleRows();
    const count = bulkSelected.size;
    const countEl = bulkEl('bulk-count');
    if (countEl) countEl.textContent = t('bulk_selected', { count });
    const all = bulkEl('bulk-select-all');
    if (all) {
        all.checked = visible.length > 0 && visible.every((r) => bulkSelected.has(r.id));
        all.indeterminate = count > 0 && !all.checked;
        all.disabled = visible.length === 0 || bulkBusy;
    }
    ['bulk-accept-btn', 'bulk-reject-btn'].forEach((id) => {
        const btn = bulkEl(id);
        if (btn && !bulkBusy) btn.disabled = count === 0;
    });
}

function toggleBulkSelectAll(checked) {
    const visible = getBulkVisibleRows();
    visible.forEach((r) => { if (checked) bulkSelected.add(r.id); else bulkSelected.delete(r.id); });
    document.querySelectorAll('#bulk-list .bulk-check').forEach((box) => { box.checked = !!checked; });
    updateBulkSelectionUI();
}

function runBulkAction(kind) {
    if (!isAdmin || bulkBusy) return;
    const selected = bulkRows.filter((r) => bulkSelected.has(r.id));
    if (selected.length === 0) {
        showToast(t('bulk_none_selected'), 'warning');
        return;
    }

    let targets = [];
    let skipped = 0;
    if (kind === 'accept') {
        const taken = new Set(bulkRows.filter((r) => r.status === 'Accepted').map((r) => String(r.time_slot).trim()));
        const used = new Set();
        selected.forEach((r) => {
            const slot = String(r.time_slot).trim();
            if (r.status !== 'Waiting' || taken.has(slot) || used.has(slot)) { skipped++; return; }
            used.add(slot);
            targets.push(r);
        });
    } else {
        targets = selected.filter((r) => r.status === 'Waiting' || r.status === 'Accepted');
        skipped = selected.length - targets.length;
    }
    if (targets.length === 0) {
        showToast(t('bulk_none_actionable'), 'warning');
        return;
    }

    let message = t(kind === 'accept' ? 'bulk_confirm_accept' : 'bulk_confirm_reject', { count: targets.length });
    if (skipped > 0) message += '\n' + t('bulk_skipped', { count: skipped });

    showCustomConfirm(message, async () => {
        let reason = '';
        if (kind === 'reject') {
            const answer = await showReasonModal(t('reason_rejection'));
            if (answer === null) return;
            reason = answer;
        }
        await applyBulkAction(kind, targets, reason);
    }, kind === 'accept' ? '#22c55e' : '#ef4444');
}

async function applyBulkAction(kind, targets, reason) {
    const client = getSupabase();
    if (!client || !isAdmin || bulkBusy) return;
    bulkBusy = true;

    const acceptBtn = bulkEl('bulk-accept-btn');
    const rejectBtn = bulkEl('bulk-reject-btn');
    const busyBtn = kind === 'accept' ? acceptBtn : rejectBtn;
    [acceptBtn, rejectBtn].forEach((b) => { if (b) b.disabled = true; });
    setButtonBusy(busyBtn, true, t('please_wait'));

    const actor = currentStaffUsername || 'President';
    const newStatus = kind === 'accept' ? 'Accepted' : 'Rejected';
    let ok = 0;
    let fail = 0;

    try {
        for (let i = 0; i < targets.length; i += 5) {
            const chunk = targets.slice(i, i + 5);
            const results = await Promise.allSettled(chunk.map(async (app) => {
                const entry = kind === 'accept'
                    ? { action: 'status_changed', at: new Date().toISOString(), actor, detail: `${app.status} → Accepted` }
                    : {
                        action: 'rejected',
                        at: new Date().toISOString(),
                        actor,
                        detail: `${app.status} → Rejected${reason ? `; Reason: ${reason}` : ''}`,
                        reason
                    };
                const { data, error } = await client
                    .from('reservation_slots')
                    .update({ status: newStatus, time_log: [...getApplicationTimeLog(app), entry] })
                    .eq('id', app.id)
                    .eq('status', app.status)   // skip rows someone else changed meanwhile
                    .select('id');
                if (error) throw error;
                if (!data || data.length === 0) throw new Error('Row changed by someone else');
            }));
            results.forEach((r) => { if (r.status === 'fulfilled') ok++; else { fail++; console.error('Bulk action item failed:', r.reason); } });
        }
    } finally {
        bulkBusy = false;
        setButtonBusy(busyBtn, false);
    }

    showToast(t('bulk_done', { ok, fail }), fail === 0 ? 'success' : 'warning');
    if (typeof requestApplicationsReload === 'function') requestApplicationsReload(0);
    if (typeof requestRecentAcceptsReload === 'function') requestRecentAcceptsReload(0);
    if (!bulkEl('bulk-modal')?.classList.contains('hidden')) loadBulkRows();
}

(function initBulkModal() {
    const modal = bulkEl('bulk-modal');
    if (!modal) return;
    const list = bulkEl('bulk-list');
    if (list) {
        list.addEventListener('change', (event) => {
            const box = event.target.closest('.bulk-check');
            if (!box) return;
            const id = Number(box.dataset.id);
            if (box.checked) bulkSelected.add(id); else bulkSelected.delete(id);
            updateBulkSelectionUI();
        });
    }
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || modal.classList.contains('hidden')) return;
        const overlayOpen = ['confirm-modal', 'reason-modal'].some((id) => {
            const el = document.getElementById(id);
            return el && !el.classList.contains('hidden');
        });
        if (!overlayOpen) closeBulkModal();
    });
    let pressStartedOnBackdrop = false;
    modal.addEventListener('mousedown', (event) => { pressStartedOnBackdrop = (event.target === modal); });
    modal.addEventListener('click', (event) => {
        if (event.target === modal && pressStartedOnBackdrop) closeBulkModal();
        pressStartedOnBackdrop = false;
    });
})();
