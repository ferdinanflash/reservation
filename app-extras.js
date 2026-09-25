// ================= EXTRAS =================
// Live clock, the "recently accepted reservation" banner, and the snow effect.
// Part of the app script, split out of the old single script.js.
// Load order matters: see the <script> tags in index.html.

function startLiveClock() {
    const localClockEl = document.getElementById('local-clock');
    const localLabelEl = document.getElementById('local-clock-label');
    const utcClockEl = document.getElementById('utc-clock');
    const timezoneSelect = document.getElementById('timezone');

    if (!localClockEl || !utcClockEl || !localLabelEl) return;

    setInterval(() => {
        const now = new Date();
        const utcHours = String(now.getUTCHours()).padStart(2, '0');
        const utcMinutes = String(now.getUTCMinutes()).padStart(2, '0');
        const utcSeconds = String(now.getUTCSeconds()).padStart(2, '0');
        utcClockEl.innerText = `${utcHours}:${utcMinutes}:${utcSeconds}`;

        const schedulePage = document.getElementById('schedule-page');
        const isScheduleVisible = schedulePage && !schedulePage.classList.contains('hidden');

        if (isScheduleVisible && timezoneSelect && timezoneSelect.value !== "") {
            const offset = parseFloat(timezoneSelect.value); 
            const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
            const targetTime = new Date(utcTime + (3600000 * offset));

            const displayHours = String(targetTime.getHours()).padStart(2, '0');
            const displayMinutes = String(targetTime.getMinutes()).padStart(2, '0');
            const displaySeconds = String(targetTime.getSeconds()).padStart(2, '0');
            
            const sign = offset >= 0 ? "+" : "-";
            const absOffset = Math.abs(offset);
            const hours = Math.floor(absOffset); 
            const minutes = Math.round((absOffset - hours) * 60); 
            
            if (minutes > 0) {
                localLabelEl.innerText = `UTC${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:`;
            } else {
                localLabelEl.innerText = `UTC${sign}${String(hours).padStart(2, '0')}:`;
            }
            localClockEl.innerText = `${displayHours}:${displayMinutes}:${displaySeconds}`;
        } else {
            localLabelEl.innerText = t("local_label");
            localClockEl.innerText = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        }
    }, 1000);
}

// ================= "RECENTLY ACCEPTED RESERVATION" BANNER =================
// Each accepted reservation can carry up to 8 different stat fields, but
// only some are relevant to a given position (see POSITION_CONFIG's
// hiddenFields) and only some were actually filled in by the applicant.
// getRarVisibleStats() narrows the pool down to "hidden for this position?
// no. + has a real value? yes." — exactly what's applicable and filled in.
// If more than 3 stats survive that filter, renderRarStats() rotates
// through them 3-at-a-time every 2-3 seconds instead of cramming them all
// into the row at once.
let recentAcceptRotationTimers = [];

const RAR_STAT_POOL = [
    { key: 'fire_crystal',         hideKey: 'fc',    icon: '🔥', color: '#3b82f6', style: 'bar',  labelKey: 'stat_fc' },
    { key: 'refined_fire_crystal', hideKey: 'rfc',   icon: '🔥', color: '#f59e0b', style: 'bar',  labelKey: 'stat_rfc' },
    { key: 'fire_crystal_shard',   hideKey: 'shard', icon: '💠', color: '#2dd4bf', style: 'dots', labelKey: 'stat_shard' },
    { key: 'general_speedup',      hideKey: null,    icon: '⚡', color: '#a78bfa', style: 'bar',  labelKey: 'stat_general' },
    { key: 'construction_speedup', hideKey: 'const', icon: '🏗️', color: '#f472b6', style: 'bar',  labelKey: 'stat_const' },
    { key: 'research_speedup',     hideKey: 'res',   icon: '🔬', color: '#38bdf8', style: 'bar',  labelKey: 'stat_research' },
    { key: 'training_speedup',     hideKey: 'train', icon: '🏋️', color: '#fb923c', style: 'bar',  labelKey: 'stat_train' }
];

// Furnace level is shown inline next to the player's name ("Test 2 (FC 9)"),
// not as one of the rotating stat badges below — so it's kept out of
// RAR_STAT_POOL entirely and rendered separately in loadRecentAccepts().
function buildRarFurnaceLabel(item) {
    const level = String(item.furnace_level || '').trim();
    return level ? `<span class="rar-furnace">(FC ${escapeHtml(level)})</span>` : '';
}

// Returns only the stats that are (a) not hidden for this app's position and
// (b) actually have a value — "hanya menampilkan sesuai isian pada posisinya".
function getRarVisibleStats(item) {
    const hidden = getPositionConfig(item.position).hiddenFields || [];
    return RAR_STAT_POOL.filter(stat => {
        if (stat.hideKey && hidden.includes(stat.hideKey)) return false;
        return (parseInt(item[stat.key], 10) || 0) > 0;
    }).map(stat => ({ ...stat, value: item[stat.key] }));
}

function buildRarStatHtml(stat) {
    const value = parseInt(stat.value, 10) || 0;
    const label = `${stat.icon} ${t(stat.labelKey)}`;
    const indicator = stat.style === 'dots'
        ? `<div class="rar-stat-dots">${[0, 1, 2].map(() => `<span class="rar-dot-on" style="color:${stat.color}; background:${stat.color};"></span>`).join('')}</div>`
        : `<div class="rar-stat-bar"><span style="background:${stat.color};"></span></div>`;
    return `<div class="rar-stat">
        <div class="rar-stat-line"><span class="rar-stat-label">${label}</span><span class="rar-stat-value">${value}</span></div>
        ${indicator}
    </div>`;
}

// Renders a card's stat area. 3 or fewer applicable stats -> show them all,
// no animation. More than 3 -> rotate through 3-item groups (wrapping
// around so every group is always full) every 2-3s with a short fade.
function renderRarStats(container, stats) {
    if (!container) return;
    if (stats.length <= 3) {
        container.innerHTML = stats.map(buildRarStatHtml).join('');
        return;
    }

    const groups = [];
    for (let i = 0; i < stats.length; i += 3) {
        let group = stats.slice(i, i + 3);
        if (group.length < 3) group = group.concat(stats.slice(0, 3 - group.length));
        groups.push(group);
    }

    let groupIndex = 0;
    const renderGroup = () => { container.innerHTML = groups[groupIndex].map(buildRarStatHtml).join(''); };
    renderGroup();

    const scheduleNext = () => {
        const delay = 2000 + Math.random() * 1000; // 2-3 detik
        const timerId = setTimeout(() => {
            container.classList.add('rar-fade');
            setTimeout(() => {
                groupIndex = (groupIndex + 1) % groups.length;
                renderGroup();
                container.classList.remove('rar-fade');
            }, 300);
            scheduleNext();
        }, delay);
        recentAcceptRotationTimers.push(timerId);
    };
    scheduleNext();
}

async function loadRecentAccepts() {
    const logListEl = document.getElementById('recent-log-list');
    if (!logListEl) return;
    const client = getSupabase();
    if (!client) return;

    // Old rotation timers point at DOM nodes that are about to be thrown
    // away below — clear them first so they don't keep firing on nothing.
    recentAcceptRotationTimers.forEach(clearTimeout);
    recentAcceptRotationTimers = [];

    try {
        const { data, error } = await client
            .from('reservation_slots')
            .select('nickname, position, time_slot, updated_at, furnace_level, fire_crystal, refined_fire_crystal, fire_crystal_shard, general_speedup, construction_speedup, research_speedup, training_speedup')
            .eq('status', 'Accepted')
            .not('nickname', 'is', null)
            .neq('nickname', '')
            .order('updated_at', { ascending: false })
            .limit(10);

        if (error) throw error;
        if (!data || data.length === 0) {
            logListEl.innerHTML = `<div class="log-item-empty">${t("log_empty")}</div>`;
            return;
        }
        logListEl.innerHTML = '';
        data.forEach(item => {
            const shortPos = item.position ? translatePositionShort(item.position) : t('label_unknown');
            const card = document.createElement('div');
            card.className = 'rar-card';
            card.innerHTML = `
                <div class="rar-info">
                    <div class="rar-name">${escapeHtml(capZalgo(item.nickname))} ${buildRarFurnaceLabel(item)}</div>
                    <div class="rar-pos">[${escapeHtml(shortPos)}]</div>
                </div>
                <div class="rar-right">
                    <div class="rar-top"><span class="rar-check">✅</span><span class="rar-time">${escapeHtml(item.time_slot)} UTC</span></div>
                    <div class="rar-stats"></div>
                </div>
            `;
            logListEl.appendChild(card);
            renderRarStats(card.querySelector('.rar-stats'), getRarVisibleStats(item));
        });
    } catch (err) { console.error("Failed to load recent accepts:", err); }
}

// ================= SNOWFLAKE EFFECT =================
function createSnowEffect() {
    const snowContainer = document.getElementById('snow-container');
    if (!snowContainer) return;

    const maxSnowflakes = 20; 
    if (snowContainer.querySelectorAll('.snowflake').length >= maxSnowflakes) return;

    const snowflake = document.createElement('div');
    snowflake.classList.add('snowflake');
    snowflake.style.left = Math.random() * 100 + 'vw';

    const size = Math.random() * 3 + 2 + 'px';
    snowflake.style.width = size;
    snowflake.style.height = size;

    const durationSeconds = Math.random() * 5 + 10; 
    snowflake.style.animationDuration = durationSeconds + 's';
    snowflake.style.opacity = Math.random() * 0.5 + 0.2;

    snowContainer.appendChild(snowflake);

    setTimeout(() => {
        snowflake.remove();
    }, durationSeconds * 1000);
}
setInterval(createSnowEffect, 200);
// ======================================================

// ================= REDEEM CODE MODAL =================
// "Redeem Code" navbar button -> popup modal with a real Player ID check +
// gift code form. Both actions call the `redeem-giftcode` Supabase Edge
// Function (supabase/functions/redeem-giftcode/index.ts), which in turn
// calls Century Games' own wos-giftcode-api.centurygame.com server-side
// (the browser can't call it directly: that API only accepts requests from
// wos-giftcode.centurygame.com itself, and every request must be signed
// with a secret we don't want to ship in this file).
let redeemModalTrigger = null;
const REDEEM_STATE_ID = '3475'; // shown in the disabled State field; also hardcoded server-side as the redeem kingdom id

function setRedeemStatus(elId, message, type) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = message || '';
    el.classList.remove('is-success', 'is-error', 'is-visible');
    if (message) {
        el.classList.add('is-visible');
        if (type) el.classList.add(type === 'success' ? 'is-success' : 'is-error');
    }
}

async function invokeGiftCodeApi(payload) {
    const client = getSupabase();
    if (!client) throw new Error('no-supabase-client');
    const { data, error } = await client.functions.invoke('redeem-giftcode', { body: payload });
    if (error) throw error;
    return data; // { ok, status, data: <Century Games response> }
}

// Century Games' response shape isn't publicly documented, so this maps the
// known message strings and otherwise falls back to showing their raw `msg`
// rather than a wrong-sounding generic error.
function redeemUpstreamIsSuccess(upstream) {
    if (!upstream) return false;
    const msg = String(upstream.msg || '').trim().toUpperCase();
    return upstream.err_code === 0 || upstream.code === 0 || msg === 'SUCCESS' || msg === 'SUCCESS.';
}

function redeemMessageKeyFor(upstream) {
    const msg = String((upstream && upstream.msg) || '').trim().toUpperCase();
    const map = {
        'RECEIVED': 'redeem_already_used',
        'SAME TYPE EXCHANGE': 'redeem_already_used',
        'CDK NOT FOUND': 'redeem_code_invalid',
        'NOT FOUND': 'redeem_code_invalid',
        'CDK NOT FOUND.': 'redeem_code_invalid',
        'TIME ERROR': 'redeem_code_expired',
        'TIME ERROR.': 'redeem_code_expired',
        'USAGE LIMIT': 'redeem_code_usage_limit',
        'USED': 'redeem_code_usage_limit',
    };
    return map[msg] || null;
}

// Parses the FID textarea: one ID per line (commas/spaces also accepted),
// de-duplicated, keeping first-seen order.
function parseRedeemFidList(raw) {
    const seen = new Set();
    const out = [];
    for (const piece of String(raw || '').split(/[\s,]+/)) {
        const fid = piece.trim();
        if (!fid) continue;
        if (!/^[0-9]{4,20}$/.test(fid)) continue;
        if (seen.has(fid)) continue;
        seen.add(fid);
        out.push(fid);
    }
    return out;
}

function renderRedeemResultList(rows) {
    const list = document.getElementById('redeem-result-list');
    if (!list) return;
    list.innerHTML = '';
    for (const row of rows) {
        const li = document.createElement('li');
        li.className = `redeem-result-row is-${row.status}`;
        li.textContent = `${row.fid} — ${row.message}`;
        list.appendChild(li);
    }
}

// A short pause between requests so a batch of FIDs doesn't hammer Century
// Games' API (their gift_code endpoint reported a "x-ratelimit-limit: 30"
// header) or trip an anti-bot rate check.
const REDEEM_BATCH_DELAY_MS = 1200;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function submitRedeemCode() {
    const fidInput = document.getElementById('redeem-fid-input');
    const codeInput = document.getElementById('redeem-code-input');
    const submitBtn = document.getElementById('redeem-submit-btn');
    const cdk = (codeInput?.value || '').trim();
    const fids = parseRedeemFidList(fidInput?.value);

    setRedeemStatus('redeem-result-status', '', null);
    renderRedeemResultList([]);

    if (fids.length === 0) {
        setRedeemStatus('redeem-result-status', t('redeem_fid_invalid'), 'error');
        return;
    }
    if (!cdk) {
        setRedeemStatus('redeem-result-status', t('redeem_code_required'), 'error');
        return;
    }

    setButtonBusy(submitBtn, true, t('redeem_redeeming'));
    const rows = fids.map((fid) => ({ fid, status: 'pending', message: t('redeem_pending') }));
    renderRedeemResultList(rows);

    for (let i = 0; i < fids.length; i++) {
        const fid = fids[i];
        setRedeemStatus(
            'redeem-result-status',
            t('redeem_batch_progress', { current: i + 1, total: fids.length }),
            null,
        );
        try {
            const result = await invokeGiftCodeApi({ action: 'redeem', fid, cdk });
            const upstream = (result && result.data) || {};
            if (result.ok && redeemUpstreamIsSuccess(upstream)) {
                rows[i] = { fid, status: 'success', message: t('redeem_success') };
            } else {
                const key = redeemMessageKeyFor(upstream);
                const message = key ? t(key) : (upstream.msg ? t('redeem_server_said', { msg: escapeHtml(upstream.msg) }) : t('redeem_generic_error'));
                // "Already used" isn't really a failure for this FID (the
                // account already has the reward), so mark it distinctly.
                rows[i] = { fid, status: key === 'redeem_already_used' ? 'info' : 'error', message };
            }
        } catch (e) {
            console.error('submitRedeemCode failed for fid', fid, e);
            rows[i] = { fid, status: 'error', message: t('redeem_generic_error') };
        }
        renderRedeemResultList(rows);
        if (i < fids.length - 1) await sleep(REDEEM_BATCH_DELAY_MS);
    }

    const successCount = rows.filter((r) => r.status === 'success').length;
    setRedeemStatus('redeem-result-status', t('redeem_batch_done', { success: successCount, total: fids.length }), 'success');
    setButtonBusy(submitBtn, false);
}

function resetRedeemForm() {
    const fidInput = document.getElementById('redeem-fid-input');
    const codeInput = document.getElementById('redeem-code-input');
    if (fidInput) fidInput.value = '';
    if (codeInput) codeInput.value = '';
    setRedeemStatus('redeem-result-status', '', null);
    renderRedeemResultList([]);
}

function openRedeemModal() {
    const modal = document.getElementById('redeem-modal');
    if (!modal) return;

    redeemModalTrigger = document.activeElement;
    resetRedeemForm();

    modal.classList.remove('hidden');
    document.body.classList.add('redeem-modal-open');

    const fidInput = document.getElementById('redeem-fid-input');
    if (fidInput) fidInput.focus();
}

function closeRedeemModal() {
    const modal = document.getElementById('redeem-modal');
    if (!modal || modal.classList.contains('hidden')) return;

    modal.classList.add('hidden');
    document.body.classList.remove('redeem-modal-open');

    if (redeemModalTrigger && typeof redeemModalTrigger.focus === 'function') {
        redeemModalTrigger.focus();
    }
    redeemModalTrigger = null;
}

(function initRedeemModal() {
    const modal = document.getElementById('redeem-modal');
    if (!modal) return;

    // Close on Escape
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeRedeemModal();
        }
    });

    // Close when the dark backdrop is clicked. Requiring the press to start
    // on the backdrop too avoids closing when someone drags a text selection
    // out of the modal and releases the mouse outside it.
    let pressStartedOnBackdrop = false;
    modal.addEventListener('mousedown', (event) => {
        pressStartedOnBackdrop = (event.target === modal);
    });
    modal.addEventListener('click', (event) => {
        if (event.target === modal && pressStartedOnBackdrop) closeRedeemModal();
        pressStartedOnBackdrop = false;
    });
})();
// ======================================================
