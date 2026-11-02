// ================= SVS ENEMIES =================
// Main-menu page that shows live WoS Atlas info for enemy States configured
// by the President (President Panel → SvS Enemies Settings).
// Data source matches tal-main State Tracker: api.wosatlas.com (direct, with
// optional Supabase edge-function fallback wosatlas-states if deployed).

(function () {
    'use strict';

    const CFG = {
        apiBase: 'https://api.wosatlas.com/v1',
        proxyFunction: 'wosatlas-states',
        sourceUrl: 'https://wosatlas.com/states/',
        myState: 3475,
        cacheMs: 5 * 60 * 1000,
        allianceLimit: 10,
        topPlayersLimit: 100,
        storageKey: 'svs_enemies_kids',
        maxEnemies: 20
    };

    const nfCompact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
    const nfFull = new Intl.NumberFormat(undefined);

    const fmtCompact = (n) => (Number.isFinite(n) ? nfCompact.format(n) : '—');
    const fmtFull = (n) => (Number.isFinite(n) ? nfFull.format(n) : '—');

    const S = {
        kids: [],
        mode: null, // 'direct' | 'proxy'
        cache: new Map(), // kid -> { fetchedAt, state, power, alliances, players, error, loading }
        allianceCache: new Map(), // aid -> { fetchedAt, data, error, loading }
        loadedAt: 0
    };

    // ---------- Settings (localStorage + Supabase) ----------
    function parseKids(raw) {
        if (!raw) return [];
        const parts = String(raw)
            .split(/[\s,;]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        const seen = new Set();
        const out = [];
        for (const p of parts) {
            const n = Number(p);
            if (!Number.isFinite(n) || n <= 0 || n > 999999) continue;
            const k = Math.trunc(n);
            if (seen.has(k)) continue;
            seen.add(k);
            out.push(k);
            if (out.length >= CFG.maxEnemies) break;
        }
        return out;
    }

    function kidsToString(kids) {
        return (kids || []).join(', ');
    }

    function loadKidsFromLocal() {
        try {
            return parseKids(localStorage.getItem(CFG.storageKey) || '');
        } catch (_) {
            return [];
        }
    }

    function saveKidsLocal(kids) {
        try {
            localStorage.setItem(CFG.storageKey, kidsToString(kids));
        } catch (_) {}
    }

    async function loadKidsFromDb() {
        const client = typeof getSupabase === 'function' ? getSupabase() : null;
        if (!client) return null;
        try {
            const { data, error } = await client
                .from('svs_enemies_settings')
                .select('enemy_kids')
                .eq('id', 'main')
                .maybeSingle();
            if (error) throw error;
            if (data && typeof data.enemy_kids === 'string') {
                return parseKids(data.enemy_kids);
            }
        } catch (err) {
            console.warn('SvS Enemies: could not load settings from DB', err);
        }
        return null;
    }

    async function saveKidsToDb(kids) {
        const client = typeof getSupabase === 'function' ? getSupabase() : null;
        if (!client) return false;
        try {
            const { error } = await client
                .from('svs_enemies_settings')
                .upsert({
                    id: 'main',
                    enemy_kids: kidsToString(kids),
                    updated_at: new Date().toISOString()
                });
            if (error) throw error;
            return true;
        } catch (err) {
            console.warn('SvS Enemies: could not save settings to DB', err);
            return false;
        }
    }

    async function refreshKidsConfig() {
        const fromDb = await loadKidsFromDb();
        if (fromDb) {
            S.kids = fromDb;
            saveKidsLocal(fromDb);
        } else {
            S.kids = loadKidsFromLocal();
        }
        return S.kids;
    }

    function getEnemyKids() {
        return S.kids.slice();
    }

    // ---------- Fetch (same endpoints as State Tracker) ----------
    async function fetchJson(url, signal) {
        const res = await fetch(url, {
            headers: { accept: 'application/json' },
            signal,
            credentials: 'omit',
            mode: 'cors'
        });
        if (!res.ok) throw new Error('http-' + res.status);
        return res.json();
    }

    async function fetchDetailDirect(kid, signal) {
        const base = CFG.apiBase;
        const results = await Promise.allSettled([
            fetchJson(`${base}/states/${kid}`, signal),
            fetchJson(`${base}/kingdoms/${kid}/power`, signal),
            fetchJson(`${base}/alliances/leaderboard?kid=${kid}&limit=${CFG.allianceLimit}`, signal),
            // Full leaderboard (up to topPlayersLimit). kingdoms/.../power only has ~5 in "top".
            fetchJson(`${base}/power/leaderboard?kid=${kid}&limit=${CFG.topPlayersLimit}`, signal)
        ]);
        const state = results[0].status === 'fulfilled' ? results[0].value : null;
        const power = results[1].status === 'fulfilled' ? results[1].value : null;
        let alliances = results[2].status === 'fulfilled' ? results[2].value : null;
        const leaderboard = results[3].status === 'fulfilled' ? results[3].value : null;

        if (alliances && Array.isArray(alliances.entries)) alliances = alliances.entries;
        else if (alliances && Array.isArray(alliances)) { /* ok */ }
        else if (alliances && Array.isArray(alliances.alliances)) alliances = alliances.alliances;
        else alliances = null;

        // Dedicated player list: prefer /power/leaderboard, else short power.top
        let players = [];
        if (leaderboard && Array.isArray(leaderboard.entries) && leaderboard.entries.length) {
            players = leaderboard.entries.slice(0, CFG.topPlayersLimit);
        } else if (power && Array.isArray(power.top) && power.top.length) {
            players = power.top.slice(0, CFG.topPlayersLimit);
        }

        if (!state && !power && !alliances && !players.length) throw new Error('direct-detail-failed');
        return { state, power, alliances, players };
    }

    async function fetchDetailProxy(kid, signal) {
        const client = typeof getSupabase === 'function' ? getSupabase() : null;
        if (!client) throw new Error('no-proxy');
        const { data, error } = await client.functions.invoke(CFG.proxyFunction, {
            body: {
                action: 'detail',
                kid,
                allianceLimit: CFG.allianceLimit,
                playerLimit: CFG.topPlayersLimit
            }
        });
        if (error) throw error;
        if (!data) throw new Error('proxy-empty');
        let alliances = data.alliances || null;
        if (alliances && Array.isArray(alliances.entries)) alliances = alliances.entries;
        let players = [];
        if (Array.isArray(data.players) && data.players.length) {
            players = data.players;
        } else if (data.power && Array.isArray(data.power.top)) {
            players = data.power.top;
        }
        return {
            state: data.state || null,
            power: data.power || null,
            alliances: alliances,
            players: players.slice(0, CFG.topPlayersLimit)
        };
    }

    /** Fetch only the full power leaderboard via edge function (when direct CORS fails). */
    async function fetchPlayersProxy(kid) {
        const client = typeof getSupabase === 'function' ? getSupabase() : null;
        if (!client) return [];
        try {
            const { data, error } = await client.functions.invoke(CFG.proxyFunction, {
                body: { action: 'power-leaderboard', kid, limit: CFG.topPlayersLimit }
            });
            if (error || !data) return [];
            if (Array.isArray(data.entries)) return data.entries.slice(0, CFG.topPlayersLimit);
            if (Array.isArray(data.players)) return data.players.slice(0, CFG.topPlayersLimit);
            return [];
        } catch (err) {
            console.warn('SvS Enemies power-leaderboard proxy failed', err);
            return [];
        }
    }

    async function loadDetail(kid) {
        const key = Number(kid);
        if (!Number.isFinite(key)) return null;
        const cached = S.cache.get(key);
        if (cached && cached.loading) return cached;
        if (cached && cached.fetchedAt && Date.now() - cached.fetchedAt < CFG.cacheMs && !cached.error) {
            return cached;
        }

        const entry = { loading: true, error: null, state: null, power: null, alliances: null, players: [], fetchedAt: 0 };
        S.cache.set(key, entry);

        try {
            let payload = null;
            if (S.mode === 'proxy') {
                try {
                    payload = await fetchDetailProxy(key);
                } catch (_) {
                    payload = await fetchDetailDirect(key);
                    S.mode = 'direct';
                }
            } else {
                try {
                    payload = await fetchDetailDirect(key);
                    if (S.mode !== 'proxy') S.mode = 'direct';
                } catch (_) {
                    payload = await fetchDetailProxy(key);
                    S.mode = 'proxy';
                }
            }
            entry.loading = false;
            entry.fetchedAt = Date.now();
            entry.state = payload.state;
            entry.power = payload.power;
            entry.alliances = payload.alliances;
            entry.players = Array.isArray(payload.players) ? payload.players : (
                payload.power && Array.isArray(payload.power.top) ? payload.power.top : []
            );
            // Direct /power/leaderboard is often CORS-blocked; only ~5 come from kingdoms/.../power.
            // Enrich via edge function when the list is still short.
            if (entry.players.length < 10) {
                const more = await fetchPlayersProxy(key);
                if (more.length > entry.players.length) {
                    entry.players = more;
                    if (entry.power) {
                        entry.power = Object.assign({}, entry.power, { top: more });
                    }
                }
            }
            entry.error = (!payload.state && !payload.power && !payload.alliances && !(entry.players && entry.players.length))
                ? (typeof t === 'function' ? t('svs_enemies_load_partial') : 'Partial data only')
                : null;
        } catch (err) {
            console.error('SvS Enemies detail', key, err);
            entry.loading = false;
            entry.fetchedAt = Date.now();
            entry.error = typeof t === 'function' ? t('svs_enemies_load_failed') : 'Could not load State data';
        }
        S.cache.set(key, entry);
        return entry;
    }

    // ---------- UI helpers ----------
    function esc(v) {
        return typeof escapeHtml === 'function' ? escapeHtml(v) : String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function tr(key, fallback) {
        if (typeof t === 'function') {
            const v = t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    function renderCard(kid, data) {
        const isMine = kid === CFG.myState;
        const power = data && data.power;
        const state = data && data.state;
        const alliances = data && data.alliances;
        const loading = data && data.loading;
        const error = data && data.error;

        const players = power && Number.isFinite(Number(power.player_count))
            ? Number(power.player_count)
            : (state && Number.isFinite(Number(state.chiefs)) ? Number(state.chiefs) : null);
        const totalPower = power && Number.isFinite(Number(power.total_power))
            ? Number(power.total_power)
            : (state && Number.isFinite(Number(state.total_power)) ? Number(state.total_power) : null);
        const medianPower = power && Number.isFinite(Number(power.median_power))
            ? Number(power.median_power)
            : null;
        const maxPower = power && Number.isFinite(Number(power.max_power))
            ? Number(power.max_power)
            : null;
        const powerRank = power && Number.isFinite(Number(power.power_rank))
            ? Number(power.power_rank)
            : null;
        const rankedStates = power && Number.isFinite(Number(power.ranked_states))
            ? Number(power.ranked_states)
            : null;

        const king = state && state.king ? state.king : null;
        const kingName = king && (king.nick_name || king.name || king.uid)
            ? String(king.nick_name || king.name || king.uid)
            : null;

        let allianceList = [];
        if (Array.isArray(alliances)) allianceList = alliances;
        else if (alliances && Array.isArray(alliances.entries)) allianceList = alliances.entries;

        const topAlliancesHtml = allianceList.slice(0, CFG.allianceLimit).map((a, i) => {
            const abbr = esc(a.abbr || a.tag || a.alliance_tag || '—');
            const name = esc(a.name || a.alliance_name || '');
            const aid = Number(a.aid || a.id || a.alliance_id) || 0;
            const pw = Number(a.totalPower || a.total_power || a.power) || 0;
            const members = Number(a.members || a.member_count) || 0;
            const memberMax = Number(a.memberMax || a.member_max || a.max_members) || 0;
            const nameInner = `<span class="svs-en-tag">[${abbr}]</span> <span data-no-i18n>${name}</span>`;
            const nameCell = aid
                ? `<button type="button" class="svs-en-alliance-btn" data-aid="${aid}" onclick="openSvSAllianceDetail(${aid})">${nameInner}</button>`
                : nameInner;
            return `<tr>
                <td class="st-num">${i + 1}</td>
                <td>${nameCell}</td>
                <td class="st-num" title="${fmtFull(pw)}">${fmtCompact(pw)}</td>
                <td class="st-num">${members}${memberMax ? '/' + memberMax : ''}</td>
            </tr>`;
        }).join('');

        // Prefer dedicated leaderboard list from /power/leaderboard
        let topPlayers = [];
        if (data && Array.isArray(data.players) && data.players.length) {
            topPlayers = data.players.slice(0, CFG.topPlayersLimit);
        } else if (power && Array.isArray(power.top) && power.top.length) {
            topPlayers = power.top.slice(0, CFG.topPlayersLimit);
        }
        const topPlayersHtml = topPlayers.map((p) => {
            const rank = Number(p.rank) || 0;
            const uid = Number(p.uid) || 0;
            const nick = esc(String(p.nick_name || p.uid || ''));
            const pw = Number(p.power) || 0;
            const stove = Number.isFinite(Number(p.stove_lv)) ? Number(p.stove_lv) : '—';
            const jumpRaw = Number(p.last_jump_pct);
            const jump = Number.isFinite(jumpRaw)
                ? ((jumpRaw * 100).toFixed(1) + '%')
                : '—';
            const nameCell = uid
                ? `<span data-no-i18n>${nick}</span> <span class="svs-en-uid" title="Player ID">#${uid}</span>`
                : `<span data-no-i18n>${nick}</span>`;
            return `<tr>
                <td class="st-num">${rank}</td>
                <td>${nameCell}</td>
                <td class="st-num" title="${fmtFull(pw)}">${fmtCompact(pw)}</td>
                <td class="st-num">${stove}</td>
                <td class="st-num">${jump}</td>
            </tr>`;
        }).join('');

        let body = '';
        if (loading) {
            body = `<p class="svs-en-status">${esc(tr('svs_enemies_loading', 'Loading…'))}</p>`;
        } else if (error && !power && !state) {
            body = `<p class="svs-en-status svs-en-error">${esc(error)}</p>`;
        } else {
            const rankLabel = powerRank
                ? (rankedStates ? `#${fmtFull(powerRank)} / ${fmtFull(rankedStates)}` : `#${fmtFull(powerRank)}`)
                : '—';
            body = `
                <div class="svs-en-stats">
                    <div class="svs-en-stat"><span class="svs-en-stat-label">${esc(tr('svs_enemies_stat_rank', 'Power Rank'))}</span><strong>${rankLabel}</strong></div>
                    <div class="svs-en-stat"><span class="svs-en-stat-label">${esc(tr('svs_enemies_stat_players', 'Players'))}</span><strong title="${fmtFull(players)}">${fmtFull(players)}</strong></div>
                    <div class="svs-en-stat"><span class="svs-en-stat-label">${esc(tr('svs_enemies_stat_total', 'Total Power'))}</span><strong title="${fmtFull(totalPower)}">${fmtCompact(totalPower)}</strong></div>
                    <div class="svs-en-stat"><span class="svs-en-stat-label">${esc(tr('svs_enemies_stat_median', 'Median'))}</span><strong title="${fmtFull(medianPower)}">${fmtCompact(medianPower)}</strong></div>
                    <div class="svs-en-stat"><span class="svs-en-stat-label">${esc(tr('svs_enemies_stat_max', 'Max Power'))}</span><strong title="${fmtFull(maxPower)}">${fmtCompact(maxPower)}</strong></div>
                    ${kingName ? `<div class="svs-en-stat"><span class="svs-en-stat-label">${esc(tr('svs_enemies_stat_king', 'King'))}</span><strong data-no-i18n>${esc(kingName)}</strong></div>` : ''}
                </div>
                ${error ? `<p class="svs-en-status svs-en-warn">${esc(error)}</p>` : ''}
                ${topPlayersHtml ? `
                    <h4 class="svs-en-h">${esc(tr('svs_enemies_leaderboard', 'Leaderboard'))}
                        <span class="svs-en-h-meta">Top ${topPlayers.length}</span>
                    </h4>
                    <div class="svs-en-table-wrap svs-en-lb-wrap">
                        <table class="svs-en-table svs-en-lb-table">
                            <thead><tr>
                                <th class="st-num">#</th>
                                <th>${esc(tr('svs_enemies_col_name', 'Name'))}</th>
                                <th class="st-num">${esc(tr('svs_enemies_col_power', 'Power'))}</th>
                                <th class="st-num">${esc(tr('svs_enemies_col_furnace', 'Furnace'))}</th>
                                <th class="st-num">${esc(tr('svs_enemies_col_jump', 'Jump'))}</th>
                            </tr></thead>
                            <tbody>${topPlayersHtml}</tbody>
                        </table>
                    </div>` : `<p class="svs-en-status svs-en-warn">${esc(tr('svs_enemies_no_leaderboard', 'Leaderboard data unavailable'))}</p>`}
                ${topAlliancesHtml ? `
                    <h4 class="svs-en-h">${esc(tr('svs_enemies_top_alliances', 'Top Alliances'))}</h4>
                    <div class="svs-en-table-wrap">
                        <table class="svs-en-table">
                            <thead><tr>
                                <th class="st-num">#</th>
                                <th>${esc(tr('svs_enemies_col_alliance', 'Alliance'))}</th>
                                <th class="st-num">${esc(tr('svs_enemies_col_power', 'Power'))}</th>
                                <th class="st-num">${esc(tr('svs_enemies_col_members', 'Members'))}</th>
                            </tr></thead>
                            <tbody>${topAlliancesHtml}</tbody>
                        </table>
                    </div>` : ''}
            `;
        }

        return `
            <article class="svs-en-card${isMine ? ' is-mine' : ''}" data-kid="${kid}">
                <header class="svs-en-card-head">
                    <h3 class="svs-en-card-title">
                        ${esc(tr('svs_enemies_state_label', 'State'))} <span class="svs-en-kid">${kid}</span>
                        ${isMine ? `<span class="svs-en-badge">${esc(tr('svs_enemies_our_state', 'Our State'))}</span>` : ''}
                    </h3>
                </header>
                <div class="svs-en-card-body">${body}</div>
            </article>`;
    }

    async function renderEnemiesView() {
        const listEl = document.getElementById('svs-enemies-list');
        const emptyEl = document.getElementById('svs-enemies-empty');
        const metaEl = document.getElementById('svs-enemies-meta');
        if (!listEl) return;

        await refreshKidsConfig();
        const kids = getEnemyKids();

        if (!kids.length) {
            listEl.innerHTML = '';
            if (emptyEl) emptyEl.classList.remove('hidden');
            if (metaEl) metaEl.textContent = '';
            return;
        }
        if (emptyEl) emptyEl.classList.add('hidden');

        // Show skeleton cards first
        listEl.innerHTML = kids.map((kid) => renderCard(kid, { loading: true })).join('');
        if (metaEl) {
            metaEl.textContent = tr('svs_enemies_count', '{{n}} enemy State(s)').replace('{{n}}', String(kids.length));
        }

        // Load in parallel (capped concurrency)
        const concurrency = 3;
        let idx = 0;
        async function worker() {
            while (idx < kids.length) {
                const i = idx++;
                const kid = kids[i];
                const data = await loadDetail(kid);
                const card = listEl.querySelector(`.svs-en-card[data-kid="${kid}"]`);
                if (card) {
                    const wrap = document.createElement('div');
                    wrap.innerHTML = renderCard(kid, data);
                    card.replaceWith(wrap.firstElementChild);
                }
            }
        }
        await Promise.all(Array.from({ length: Math.min(concurrency, kids.length) }, () => worker()));
        S.loadedAt = Date.now();
        if (metaEl) {
            const when = new Date(S.loadedAt).toLocaleString();
            metaEl.textContent = tr('svs_enemies_count_updated', '{{n}} enemy State(s) · Updated {{when}}')
                .replace('{{n}}', String(kids.length))
                .replace('{{when}}', when);
        }
    }

    // ---------- View navigation ----------
    function showSvSEnemiesMenu() {
        const main = document.getElementById('main-menu-view');
        const minister = document.getElementById('minister-reservation-view');
        const enemies = document.getElementById('svs-enemies-view');
        if (main) main.classList.add('hidden');
        if (minister) minister.classList.add('hidden');
        if (enemies) enemies.classList.remove('hidden');
        renderEnemiesView();
    }

    function hideSvSEnemiesView() {
        const enemies = document.getElementById('svs-enemies-view');
        if (enemies) enemies.classList.add('hidden');
    }


    // ---------- Alliance detail modal ----------
    async function fetchAllianceDirect(aid, signal) {
        return fetchJson(`${CFG.apiBase}/alliances/${aid}/members`, signal);
    }

    async function fetchAllianceProxy(aid) {
        const client = typeof getSupabase === 'function' ? getSupabase() : null;
        if (!client) throw new Error('no-proxy');
        const { data, error } = await client.functions.invoke(CFG.proxyFunction, {
            body: { action: 'alliance', aid }
        });
        if (error) throw error;
        if (!data || (typeof data === 'object' && data.error && !data.aid && !data.abbr)) {
            throw new Error((data && data.error) || 'proxy-alliance-failed');
        }
        return data;
    }

    async function loadAllianceDetail(aid) {
        const key = Number(aid);
        if (!Number.isFinite(key)) return null;
        const cached = S.allianceCache.get(key);
        if (cached && cached.loading) return cached;
        if (cached && cached.fetchedAt && Date.now() - cached.fetchedAt < CFG.cacheMs && !cached.error) {
            return cached;
        }
        const entry = { loading: true, error: null, data: null, fetchedAt: 0 };
        S.allianceCache.set(key, entry);
        try {
            let data = null;
            if (S.mode === 'proxy') {
                try { data = await fetchAllianceProxy(key); }
                catch (_) { data = await fetchAllianceDirect(key); }
            } else {
                try {
                    data = await fetchAllianceDirect(key);
                    if (S.mode !== 'proxy') S.mode = 'direct';
                } catch (_) {
                    data = await fetchAllianceProxy(key);
                    S.mode = 'proxy';
                }
            }
            entry.loading = false;
            entry.fetchedAt = Date.now();
            entry.data = data;
            entry.error = null;
        } catch (err) {
            console.error('SvS Enemies alliance', key, err);
            entry.loading = false;
            entry.fetchedAt = Date.now();
            entry.error = tr('svs_enemies_alliance_load_failed', 'Could not load alliance detail');
        }
        S.allianceCache.set(key, entry);
        return entry;
    }

    function renderAllianceModalBody(aid, entry) {
        const bodyEl = document.getElementById('svs-alliance-detail-body');
        const titleEl = document.getElementById('svs-alliance-detail-title');
        if (!bodyEl) return;

        if (!entry || entry.loading) {
            if (titleEl) titleEl.textContent = tr('svs_enemies_alliance_loading', 'Loading alliance…');
            bodyEl.innerHTML = `<p class="svs-en-status">${esc(tr('svs_enemies_alliance_loading', 'Loading alliance…'))}</p>`;
            return;
        }
        if (entry.error && !entry.data) {
            if (titleEl) titleEl.textContent = tr('svs_enemies_alliance_title', 'Alliance Info');
            bodyEl.innerHTML = `<p class="svs-en-status svs-en-error">${esc(entry.error)}</p>`;
            return;
        }

        const d = entry.data || {};
        const abbr = esc(String(d.abbr || ''));
        const name = esc(String(d.name || ''));
        const members = Number(d.memberCount || d.derivedMemberCount || d.members) || 0;
        const memberMax = Number(d.memberMax) || 0;
        const power = Number(d.serverPower || d.derivedTotalPower || d.totalPower) || 0;
        const powerRank = Number(d.serverPowerRank || d.powerRank) || null;
        const rankedAll = Number(d.rankedAlliances) || null;
        const leaderUid = Number(d.leaderUid) || 0;
        const leaderName = esc(String(d.leaderName || ''));
        const lv = Number(d.lv) || 0;
        const minLv = Number(d.joinMinLevel) || 0;
        const minPow = Number(d.joinMinPower) || 0;
        const recruit = !!d.publicRecruit;
        const homeKid = Number(d.homeKid || d.kid) || null;
        const honor = Number(d.honorLevel) || null;
        const notice = d.notice ? String(d.notice) : '';
        const manifesto = d.manifesto ? String(d.manifesto) : '';

        const rankLabel = powerRank
            ? (rankedAll ? `#${fmtFull(powerRank)} / ${fmtFull(rankedAll)}` : `#${fmtFull(powerRank)}`)
            : '—';

        if (titleEl) {
            titleEl.innerHTML = abbr
                ? `<span class="svs-en-tag">[${abbr}]</span> <span data-no-i18n>${name}</span>`
                : (name || tr('svs_enemies_alliance_title', 'Alliance Info'));
        }

        // Member list (often empty on free/metered tier)
        let membersList = [];
        if (Array.isArray(d.members) && d.members.length) membersList = d.members;
        else if (Array.isArray(d.memberList) && d.memberList.length) membersList = d.memberList;
        else if (Array.isArray(d.players) && d.players.length) membersList = d.players;

        let membersHtml = '';
        if (membersList.length) {
            const rows = membersList.slice(0, 50).map((m, i) => {
                const nick = esc(String(m.nick_name || m.nickname || m.name || m.uid || ''));
                const uid = Number(m.uid || m.playerUid) || 0;
                const pw = Number(m.power || m.total_power) || 0;
                const stove = Number.isFinite(Number(m.stove_lv || m.stoveLv)) ? Number(m.stove_lv || m.stoveLv) : '—';
                return `<tr>
                    <td class="st-num">${i + 1}</td>
                    <td data-no-i18n>${nick}${uid ? ` <span class="svs-en-uid">#${uid}</span>` : ''}</td>
                    <td class="st-num" title="${fmtFull(pw)}">${fmtCompact(pw)}</td>
                    <td class="st-num">${stove}</td>
                </tr>`;
            }).join('');
            membersHtml = `
                <h4 class="svs-en-h">${esc(tr('svs_enemies_alliance_members', 'Members'))}
                    <span class="svs-en-h-meta">${membersList.length}</span>
                </h4>
                <div class="svs-en-table-wrap svs-en-lb-wrap">
                    <table class="svs-en-table">
                        <thead><tr>
                            <th class="st-num">#</th>
                            <th>${esc(tr('svs_enemies_col_name', 'Name'))}</th>
                            <th class="st-num">${esc(tr('svs_enemies_col_power', 'Power'))}</th>
                            <th class="st-num">${esc(tr('svs_enemies_col_furnace', 'Furnace'))}</th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
        }

        bodyEl.innerHTML = `
            ${homeKid ? `<p class="svs-en-alliance-sub">${esc(tr('svs_enemies_state_label', 'State'))} ${homeKid}</p>` : ''}
            <div class="svs-en-stats">
                <div class="svs-en-stat"><span class="svs-en-stat-label">${esc(tr('svs_enemies_col_power', 'Power'))}</span><strong title="${fmtFull(power)}">${fmtCompact(power)}</strong></div>
                <div class="svs-en-stat"><span class="svs-en-stat-label">${esc(tr('svs_enemies_stat_rank', 'Power Rank'))}</span><strong>${rankLabel}</strong></div>
                <div class="svs-en-stat"><span class="svs-en-stat-label">${esc(tr('svs_enemies_col_members', 'Members'))}</span><strong>${fmtFull(members)}${memberMax ? '/' + memberMax : ''}</strong></div>
                <div class="svs-en-stat"><span class="svs-en-stat-label">${esc(tr('svs_enemies_alliance_level', 'Alliance level'))}</span><strong>${lv || '—'}</strong></div>
                <div class="svs-en-stat"><span class="svs-en-stat-label">${esc(tr('svs_enemies_alliance_leader', 'Leader'))}</span><strong data-no-i18n>${leaderName || '—'}${leaderUid ? ` <span class="svs-en-uid">#${leaderUid}</span>` : ''}</strong></div>
                <div class="svs-en-stat"><span class="svs-en-stat-label">${esc(tr('svs_enemies_alliance_min_level', 'Min. level'))}</span><strong>${minLv}</strong></div>
                <div class="svs-en-stat"><span class="svs-en-stat-label">${esc(tr('svs_enemies_alliance_min_power', 'Min. power'))}</span><strong title="${fmtFull(minPow)}">${fmtCompact(minPow)}</strong></div>
                <div class="svs-en-stat"><span class="svs-en-stat-label">${esc(tr('svs_enemies_alliance_recruit', 'Recruitment'))}</span><strong>${esc(recruit ? tr('svs_enemies_recruit_open', 'Open') : tr('svs_enemies_recruit_closed', 'Closed'))}</strong></div>
                ${honor != null ? `<div class="svs-en-stat"><span class="svs-en-stat-label">${esc(tr('svs_enemies_alliance_honor', 'Honor'))}</span><strong>${honor}</strong></div>` : ''}
            </div>
            ${notice ? `<h4 class="svs-en-h">${esc(tr('svs_enemies_alliance_notice', 'Notice'))}</h4><pre class="svs-en-note" data-no-i18n>${esc(notice)}</pre>` : ''}
            ${manifesto ? `<h4 class="svs-en-h">${esc(tr('svs_enemies_alliance_manifesto', 'Manifesto'))}</h4><pre class="svs-en-note" data-no-i18n>${esc(manifesto)}</pre>` : ''}
            ${membersHtml}
            ${entry.error ? `<p class="svs-en-status svs-en-warn">${esc(entry.error)}</p>` : ''}
        `;
    }

    async function openSvSAllianceDetail(aid) {
        const key = Number(aid);
        if (!Number.isFinite(key)) return;
        const modal = document.getElementById('svs-alliance-detail-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        renderAllianceModalBody(key, { loading: true });
        const entry = await loadAllianceDetail(key);
        // Only update if modal still open for this flow
        if (!modal.classList.contains('hidden')) {
            renderAllianceModalBody(key, entry);
        }
    }

    function closeSvSAllianceDetail() {
        const modal = document.getElementById('svs-alliance-detail-modal');
        if (modal) modal.classList.add('hidden');
    }

    window.openSvSAllianceDetail = openSvSAllianceDetail;
    window.closeSvSAllianceDetail = closeSvSAllianceDetail;

    window.showSvSEnemiesMenu = showSvSEnemiesMenu;
    window.refreshSvSEnemiesView = function () {
        // Force reload (clear cache)
        S.cache.clear();
        renderEnemiesView();
    };

    // ---------- President Panel: configure enemy state numbers ----------
    function openSvSEnemiesSettingsModal() {
        if (typeof isAdmin !== 'undefined' && !isAdmin) return;
        if (typeof closePresidentPanelModal === 'function') closePresidentPanelModal();
        const modal = document.getElementById('svs-enemies-settings-modal');
        const input = document.getElementById('svs-enemies-kids-input');
        if (!modal || !input) return;
        input.value = kidsToString(S.kids.length ? S.kids : loadKidsFromLocal());
        modal.classList.remove('hidden');
        setTimeout(() => input.focus(), 50);
    }

    function closeSvSEnemiesSettingsModal() {
        const modal = document.getElementById('svs-enemies-settings-modal');
        if (modal) modal.classList.add('hidden');
    }

    async function saveSvSEnemiesSettings() {
        if (typeof isAdmin !== 'undefined' && !isAdmin) return;
        const input = document.getElementById('svs-enemies-kids-input');
        if (!input) return;
        const kids = parseKids(input.value);
        S.kids = kids;
        saveKidsLocal(kids);
        const btn = document.getElementById('svs-enemies-settings-save-btn');
        if (btn && typeof setButtonBusy === 'function') setButtonBusy(btn, true, tr('busy_saving', 'Saving…'));
        const okDb = await saveKidsToDb(kids);
        if (btn && typeof setButtonBusy === 'function') setButtonBusy(btn, false);
        if (typeof showToast === 'function') {
            showToast(
                okDb
                    ? tr('toast_svs_enemies_saved', 'Enemy States saved')
                    : tr('toast_svs_enemies_saved_local', 'Enemy States saved on this device (DB unavailable)'),
                okDb ? 'success' : 'warning'
            );
        }
        closeSvSEnemiesSettingsModal();
        // Refresh view if currently open
        const enemies = document.getElementById('svs-enemies-view');
        if (enemies && !enemies.classList.contains('hidden')) {
            S.cache.clear();
            renderEnemiesView();
        }
    }

    window.openSvSEnemiesSettingsModal = openSvSEnemiesSettingsModal;
    window.closeSvSEnemiesSettingsModal = closeSvSEnemiesSettingsModal;
    window.saveSvSEnemiesSettings = saveSvSEnemiesSettings;
    window.presidentPanelOpenSvSEnemies = openSvSEnemiesSettingsModal;

    // Init: load config early
    function init() {
        refreshKidsConfig().catch(() => {});
        // Realtime optional
        try {
            const client = typeof getSupabase === 'function' ? getSupabase() : null;
            if (client) {
                client
                    .channel('svs_enemies_settings_changes')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'svs_enemies_settings' }, () => {
                        refreshKidsConfig().then(() => {
                            const enemies = document.getElementById('svs-enemies-view');
                            if (enemies && !enemies.classList.contains('hidden')) {
                                S.cache.clear();
                                renderEnemiesView();
                            }
                        });
                    })
                    .subscribe();
            }
        } catch (_) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
