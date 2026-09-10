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
