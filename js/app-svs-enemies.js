// ================= SVS ENEMIES =================
// Main-menu page that shows live WoS Atlas info for enemy States configured
// by the President (President Panel → SvS Enemies Settings).
// Data source: public wosatlas.com/api/v1 (same as TAL State Tracker).
// Browser tries the public endpoints first; Supabase edge function
// `wosatlas-states` is the fallback (also uses public site endpoints).

(function () {
    'use strict';

    const CFG = {
        // Public site API — no key required (same base TAL uses successfully).
        // Do NOT point this at api.wosatlas.com; that host always needs a key.
        apiBase: 'https://wosatlas.com/api/v1',
        proxyFunction: 'wosatlas-states',
        sourceUrl: 'https://wosatlas.com/states/',
        myState: 3475,
        cacheMs: 5 * 60 * 1000,
        // Server cache older than this triggers a background refresh (edge fn throttles too).
        cacheRefreshAfterMs: 15 * 60 * 1000,
        allianceLimit: 10,
        topPlayersLimit: 100,
        storageKey: 'svs_enemies_kids',
        labelStorageKey: 'svs_enemies_menu_label', // 'svs' | 'tal' — display name only
        maxEnemies: 20,
        // Prefer browser-direct public API first (works on TAL); proxy is fallback.
        preferProxy: false,
        // Queue loading so WoS Atlas / edge function is not hit with many
        // parallel State requests (rate-limit / block risk).
        // concurrency 1 = strict queue; delayMs = pause between States.
        loadConcurrency: 1,
        loadDelayMs: 600,
        // Within one State, member lists from top alliances also queue.
        memberFetchConcurrency: 2,
        memberFetchDelayMs: 250,
        // Auto-retry failed State loads (502 / public API / rate-limit, etc.)
        // until data looks usable or attempts are exhausted.
        retryMax: 6,
        retryBaseMs: 800,
        retryMaxMs: 8000,
        // SvS match history (wosnerds open data, states 3001–3500)
        historyUrl: 'https://data.wosnerds.com/data/svs-history/svs-history-3001-3500.json',
        historyCacheMs: 30 * 60 * 1000
    };

    const nfCompact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
    const nfFull = new Intl.NumberFormat(undefined);

    const fmtCompact = (n) => (Number.isFinite(n) ? nfCompact.format(n) : '—');
    const fmtFull = (n) => (Number.isFinite(n) ? nfFull.format(n) : '—');

    const S = {
        kids: [],
        menuLabel: 'svs', // 'svs' | 'tal' — main-menu button text only
        mode: null, // 'direct' | 'proxy'
        cache: new Map(), // kid -> { fetchedAt, state, power, alliances, players, error, loading }
        allianceCache: new Map(), // aid -> { fetchedAt, data, error, loading }
        history: null, // full svs-data-per-state map
        historyFetchedAt: 0,
        historyError: null,
        historyLoading: null, // Promise while in flight
        availableDates: [], // sorted desc, only from configured enemy states
        selectedDates: new Set(), // dates to show
        loadedAt: 0,
        // Bumps on each renderEnemiesView / leave so in-flight queue can stop.
        loadGen: 0
    };

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms || 0)));
    }

    /** Run async jobs with limited concurrency + optional delay between starts. */
    async function runQueue(items, worker, opts) {
        const list = Array.isArray(items) ? items : [];
        if (!list.length) return [];
        const concurrency = Math.max(1, Math.min((opts && opts.concurrency) || 1, list.length));
        const delayMs = Math.max(0, (opts && opts.delayMs) || 0);
        const shouldStop = (opts && opts.shouldStop) || (() => false);
        const onProgress = (opts && opts.onProgress) || null;
        let idx = 0;
        let done = 0;
        const results = new Array(list.length);

        async function runOne() {
            while (idx < list.length) {
                if (shouldStop()) return;
                const i = idx++;
                const startedAt = Date.now();
                try {
                    results[i] = await worker(list[i], i);
                } catch (err) {
                    results[i] = { error: err };
                }
                done++;
                if (onProgress) {
                    try { onProgress(done, list.length, list[i], results[i]); } catch (_) {}
                }
                if (shouldStop()) return;
                // Pace the next start from this worker (not after the last item).
                if (idx < list.length && delayMs > 0) {
                    const wait = delayMs - (Date.now() - startedAt);
                    if (wait > 0) await sleep(wait);
                }
            }
        }

        await Promise.all(Array.from({ length: concurrency }, () => runOne()));
        return results;
    }

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

    function normalizeMenuLabel(v) {
        return String(v || '').toLowerCase() === 'tal' ? 'tal' : 'svs';
    }

    function loadMenuLabelLocal() {
        try {
            return normalizeMenuLabel(localStorage.getItem(CFG.labelStorageKey));
        } catch (_) {
            return 'svs';
        }
    }

    function saveMenuLabelLocal(label) {
        try {
            localStorage.setItem(CFG.labelStorageKey, normalizeMenuLabel(label));
        } catch (_) {}
    }

    function menuLabelText(label) {
        const mode = normalizeMenuLabel(label);
        if (mode === 'tal') {
            return tr('link_tal_enemies', 'TAL Enemies');
        }
        return tr('link_svs_enemies', 'SvS Enemies');
    }

    function applyMenuLabel(label) {
        S.menuLabel = normalizeMenuLabel(label);
        const el = document.getElementById('svs-enemies-menu-label');
        if (el) el.textContent = menuLabelText(S.menuLabel);
        // Keep radio in settings modal in sync if open
        const svsRadio = document.getElementById('svs-enemies-label-svs');
        const talRadio = document.getElementById('svs-enemies-label-tal');
        if (svsRadio) svsRadio.checked = S.menuLabel === 'svs';
        if (talRadio) talRadio.checked = S.menuLabel === 'tal';
    }

    async function loadKidsFromDb() {
        const client = typeof getSupabase === 'function' ? getSupabase() : null;
        if (!client) return null;
        try {
            // menu_label is optional (added later); select * so older schemas still work
            const { data, error } = await client
                .from('svs_enemies_settings')
                .select('*')
                .eq('id', 'main')
                .maybeSingle();
            if (error) throw error;
            if (!data) return null;
            const kids = typeof data.enemy_kids === 'string' ? parseKids(data.enemy_kids) : [];
            if (data.menu_label != null) {
                applyMenuLabel(data.menu_label);
                saveMenuLabelLocal(data.menu_label);
            }
            return kids;
        } catch (err) {
            console.warn('SvS Enemies: could not load settings from DB', err);
        }
        return null;
    }

    async function saveKidsToDb(kids, menuLabel) {
        const client = typeof getSupabase === 'function' ? getSupabase() : null;
        if (!client) return false;
        const payload = {
            id: 'main',
            enemy_kids: kidsToString(kids),
            updated_at: new Date().toISOString()
        };
        if (menuLabel != null) payload.menu_label = normalizeMenuLabel(menuLabel);
        try {
            const { error } = await client
                .from('svs_enemies_settings')
                .upsert(payload);
            if (error) throw error;
            return true;
        } catch (err) {
            // Older DB without menu_label column: retry without it
            if (menuLabel != null) {
                try {
                    const { error } = await client
                        .from('svs_enemies_settings')
                        .upsert({
                            id: 'main',
                            enemy_kids: kidsToString(kids),
                            updated_at: new Date().toISOString()
                        });
                    if (!error) return true;
                } catch (_) { /* fall through */ }
            }
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
        // Local label as fallback / until DB responds
        if (!document.getElementById('svs-enemies-menu-label') || !S.menuLabel) {
            applyMenuLabel(loadMenuLabelLocal());
        } else if (S.menuLabel === 'svs' || S.menuLabel === 'tal') {
            applyMenuLabel(S.menuLabel);
        } else {
            applyMenuLabel(loadMenuLabelLocal());
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

    // ---- President / King nickname (same strategy as TAL State Tracker) ----
    // states/{kid} and server.roles often only have role:"king" + uid, no name.
    // Resolution order:
    //   1) Already on king object (nick_name / name)
    //   2) Match uid in loaded top-players / leaderboard list
    //   3) Public GET https://wosatlas.com/api/v1/players/{uid}
    //   4) Edge function action:"player" (API key path)
    function pickNameFromPlayerList(players, uid) {
        const id = String(uid || '');
        if (!id || !Array.isArray(players)) return null;
        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            if (!p) continue;
            if (String(p.uid || p.playerUid || p.fid || '') !== id) continue;
            const n = p.nick_name || p.nickname || p.nickName || p.name || null;
            if (n) return String(n);
        }
        return null;
    }

    function playerPayloadName(p) {
        if (!p || typeof p !== 'object' || p.error) return null;
        const n = p.name || p.nick_name || p.nickname || p.nickName || null;
        return n ? String(n) : null;
    }

    async function resolvePlayerName(uid, signal) {
        const id = String(uid == null ? '' : uid).trim();
        if (!id) return null;

        // Public site API — no API key; works for single-player lookup
        try {
            const p = await fetchJson(
                'https://wosatlas.com/api/v1/players/' + encodeURIComponent(id),
                signal
            );
            const n = playerPayloadName(p);
            if (n) return n;
        } catch (err) {
            if (err && err.name === 'AbortError') throw err;
        }

        // Edge function (holds API key for api.wosatlas.com)
        try {
            const client = typeof getSupabase === 'function' ? getSupabase() : null;
            if (!client) return null;
            const { data, error } = await client.functions.invoke(CFG.proxyFunction, {
                body: { action: 'player', uid: id }
            });
            if (error || !data) return null;
            const p = Array.isArray(data.players) ? data.players[0] : (data.player || data);
            const n = playerPayloadName(p);
            if (n) return n;
        } catch (err) {
            if (err && err.name === 'AbortError') throw err;
        }
        return null;
    }

    async function enrichKingName(state, players, signal) {
        if (!state) return state;
        // Some payloads nest king under state.king; others only expose roles[]
        let king = state.king ? Object.assign({}, state.king) : null;
        if (!king && Array.isArray(state.roles)) {
            const role = state.roles.find(function (r) {
                return r && (r.role === 'king' || r.role === 'president');
            });
            if (role && role.uid) king = { uid: role.uid };
        }
        if (!king) return state;

        const uid = king.uid || king.playerUid || king.id;
        if (!uid) return state;

        let name = king.nick_name || king.name || null;
        if (!name) name = pickNameFromPlayerList(players, uid);
        if (!name) name = await resolvePlayerName(uid, signal);

        if (name) {
            king.nick_name = name;
            king.name = name;
        }
        king.uid = uid;
        return Object.assign({}, state, { king: king });
    }

    function mapAllianceRow(a) {
        const held = (a && a.held_members) || {};
        return {
            aid: Number(a.alliance_id),
            abbr: a.tag || '',
            name: a.name || '',
            members: Number(a.member_count) || 0,
            memberMax: Number(a.max_members) || 0,
            totalPower: Number(a.power) || 0,
            maxPower: Number(held.power_max) || 0,
            publicRecruit: !!a.public_recruit
        };
    }

    async function fetchDetailDirect(kid, signal) {
        // Public site endpoints used by TAL State Tracker (no API key).
        const base = CFG.apiBase;
        const results = await Promise.allSettled([
            fetchJson(`${base}/servers/${kid}`, signal),
            (async () => {
                const out = [];
                const seen = new Set();
                let cursor = null;
                for (let page = 0; page < 5 && out.length < 50; page++) {
                    const qs = cursor
                        ? `?sort=power&limit=50&cursor=${encodeURIComponent(cursor)}`
                        : '?sort=power&limit=50';
                    const data = await fetchJson(`${base}/servers/${kid}/alliances${qs}`, signal);
                    const items = (data && Array.isArray(data.items)) ? data.items
                        : Array.isArray(data) ? data : [];
                    let added = 0;
                    for (const a of items) {
                        const id = String(a && a.alliance_id != null ? a.alliance_id : '');
                        if (!id || seen.has(id)) continue;
                        seen.add(id);
                        out.push(a);
                        added++;
                    }
                    if (!added) break;
                    cursor = (data && typeof data.next === 'string' && data.next) ? data.next : null;
                    if (!cursor) break;
                }
                return out;
            })()
        ]);
        const server = results[0].status === 'fulfilled' ? results[0].value : null;
        const allianceItems = results[1].status === 'fulfilled' ? results[1].value : null;
        if (!server && !(allianceItems && allianceItems.length)) throw new Error('direct-detail-failed');

        // Top players: merge members of strongest alliances (queued, not all at once).
        let top = [];
        if (allianceItems && allianceItems.length) {
            const aids = allianceItems.slice(0, 8).map((a) => a.alliance_id);
            const lists = await runQueue(
                aids,
                async (aid) => fetchAllianceMembersDirect(aid, signal),
                {
                    concurrency: CFG.memberFetchConcurrency,
                    delayMs: CFG.memberFetchDelayMs
                }
            );
            const seen = new Set();
            const merged = [];
            for (const list of lists) {
                if (!list || list.error || !Array.isArray(list)) continue;
                for (const m of list) {
                    const id = String(m && m.uid != null ? m.uid : '');
                    if (!id || seen.has(id)) continue;
                    seen.add(id);
                    merged.push(m);
                }
            }
            merged.sort((a, b) => (Number(b.power) || 0) - (Number(a.power) || 0));
            top = merged.slice(0, CFG.topPlayersLimit).map(mapMemberRow);
        }

        const rollup = (server && server.rollup) || {};
        const kingRole = server && Array.isArray(server.roles)
            ? server.roles.find((r) => r && (r.role === 'king' || r.role === 'president'))
            : null;
        let kingObj = null;
        if (kingRole && kingRole.uid) {
            const nm = await resolvePlayerName(kingRole.uid, signal);
            kingObj = { uid: kingRole.uid, name: nm || null, nick_name: nm || null };
        }
        const state = server ? {
            server_id: server.server_id,
            chiefs: Number(rollup.players) || null,
            total_power: Number(rollup.player_power) || null,
            king: kingObj
        } : null;
        const power = server ? {
            player_count: Number(rollup.players) || null,
            total_power: Number(rollup.player_power) || null,
            recorded_at: rollup.refreshed_at || null,
            top: top
        } : null;
        const alliances = allianceItems
            ? allianceItems.slice(0, CFG.allianceLimit).map(mapAllianceRow)
            : null;
        return { state, power, alliances, players: top };
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
        if (error) {
            // FunctionsHttpError / FunctionsRelayError often carry a context status
            const status = error.context && error.context.status;
            let detail = '';
            try {
                if (error.context && typeof error.context.json === 'function') {
                    const body = await error.context.json();
                    detail = (body && (body.message || body.error)) ? String(body.message || body.error) : '';
                }
            } catch (_) { /* body not JSON */ }
            const msg = (detail || error.message || '') + (status ? ' status-' + status : '');
            const e = new Error(msg || 'proxy-error');
            e.status = status;
            e.detail = detail;
            throw e;
        }
        if (!data) throw new Error('proxy-empty');
        if (data.error) {
            const e = new Error(String(data.message || data.error));
            if (/401|INVALID_API_KEY|upstream-401/i.test(String(data.error))) e.status = 401;
            throw e;
        }
        let alliances = data.alliances || null;
        if (alliances && Array.isArray(alliances.entries)) alliances = alliances.entries;
        let players = [];
        if (Array.isArray(data.players) && data.players.length) {
            players = data.players;
        } else if (data.power && Array.isArray(data.power.top)) {
            players = data.power.top;
        }
        // Treat fully empty payload as failure so loadDetail can surface the error.
        if (!data.state && !data.power && !alliances && !players.length) {
            throw new Error('proxy-empty');
        }
        return {
            state: data.state || null,
            power: data.power || null,
            alliances: alliances,
            players: players.slice(0, CFG.topPlayersLimit)
        };
    }

    // ---------- Server-side cache (table svs_enemy_cache) ----------
    // Filled by edge function action "refresh" at a throttled rate, so browsers
    // no longer hit wosatlas.com themselves (avoids rate limiting).
    function normalizeDetailData(data) {
        let alliances = data.alliances || null;
        if (alliances && Array.isArray(alliances.entries)) alliances = alliances.entries;
        let players = [];
        if (Array.isArray(data.players) && data.players.length) players = data.players;
        else if (data.power && Array.isArray(data.power.top)) players = data.power.top;
        return {
            state: data.state || null,
            power: data.power || null,
            alliances: alliances,
            players: players.slice(0, CFG.topPlayersLimit)
        };
    }

    async function readCacheRow(kid) {
        const client = typeof getSupabase === 'function' ? getSupabase() : null;
        if (!client) return null;
        const { data, error } = await client
            .from('svs_enemy_cache')
            .select('payload,fetched_at')
            .eq('kid', kid)
            .maybeSingle();
        if (error || !data || !data.payload) return null;
        const fetchedAt = Date.parse(data.fetched_at) || 0;
        return { payload: data.payload, fetchedAt: fetchedAt, ageMs: Date.now() - fetchedAt };
    }

    /** Ask the edge function to refresh one State (it throttles per State itself). */
    async function requestCacheRefresh(kid) {
        const client = typeof getSupabase === 'function' ? getSupabase() : null;
        if (!client) return false;
        try {
            const { data, error } = await client.functions.invoke(CFG.proxyFunction, {
                body: { action: 'refresh', kids: [kid] }
            });
            if (error || !data) return false;
            const r = Array.isArray(data.results) ? data.results[0] : null;
            return !!(r && r.status === 'ok');
        } catch (_) {
            return false;
        }
    }

    /** Returns { payload, fetchedAt } from the cache, refreshing in the background when old. */
    async function fetchDetailCache(kid) {
        let row = null;
        try { row = await readCacheRow(kid); } catch (_) { row = null; }
        if (row) {
            if (row.ageMs > CFG.cacheRefreshAfterMs) requestCacheRefresh(kid); // fire and forget
            return row;
        }
        // Nothing cached yet (first ever load): fetch it once, then read again.
        if (await requestCacheRefresh(kid)) {
            try { row = await readCacheRow(kid); } catch (_) { row = null; }
        }
        return row;
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
            // 1) Server-side cache first (no upstream call from this browser).
            let cacheRow = null;
            try { cacheRow = await fetchDetailCache(key); } catch (_) { cacheRow = null; }
            if (cacheRow && cacheRow.payload) {
                payload = normalizeDetailData(cacheRow.payload);
                entry.cachedAt = cacheRow.fetchedAt;
                S.mode = 'cache';
            }
            // 2) Fallback: old behaviour (direct public API, then proxy).
            // Same order as TAL: public direct first, proxy only as fallback.
            // Stick with whichever mode already worked this session.
            const tryProxyFirst = CFG.preferProxy || S.mode === 'proxy';
            if (payload) {
                // served from cache
            } else if (tryProxyFirst) {
                try {
                    payload = await fetchDetailProxy(key);
                    S.mode = 'proxy';
                } catch (proxyErr) {
                    console.warn('SvS Enemies proxy failed, trying direct', proxyErr);
                    try {
                        payload = await fetchDetailDirect(key);
                        S.mode = 'direct';
                    } catch (directErr) {
                        throw proxyErr;
                    }
                }
            } else {
                try {
                    payload = await fetchDetailDirect(key);
                    S.mode = 'direct';
                } catch (directErr) {
                    console.warn('SvS Enemies direct failed, trying proxy', directErr);
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
            // Enrich player list via edge function when still short.
            if (entry.players.length < 10) {
                const more = await fetchPlayersProxy(key);
                if (more.length > entry.players.length) {
                    entry.players = more;
                    if (entry.power) {
                        entry.power = Object.assign({}, entry.power, { top: more });
                    }
                }
            }
            // King/President often has uid only — resolve nickname (TAL logic)
            try {
                const playerPool = (entry.players && entry.players.length)
                    ? entry.players
                    : (entry.power && Array.isArray(entry.power.top) ? entry.power.top : []);
                // signal optional — loadDetail has no AbortController of its own
                entry.state = await enrichKingName(entry.state, playerPool, undefined);
            } catch (e) {
                if (e && e.name === 'AbortError') throw e;
            }
            entry.error = (!payload.state && !payload.power && !payload.alliances && !(entry.players && entry.players.length))
                ? (typeof t === 'function' ? t('svs_enemies_load_partial') : 'Partial data only')
                : null;
            if (!entry.error) saveStale(key, entry);
        } catch (err) {
            console.error('SvS Enemies detail', key, err);
            entry.loading = false;
            entry.fetchedAt = Date.now();
            const msg = (err && err.message) ? String(err.message) : '';
            const base = typeof t === 'function' ? t('svs_enemies_load_failed') : 'Could not load State data';
            let hint = '';
            if (/401|INVALID_API_KEY|upstream-401|API key/i.test(msg) || (err && err.status === 401)) {
                hint = 'API key WoS Atlas belum diset / ditolak (cek secret WOSATLAS_API_KEY di Supabase)';
            } else if (err && err.status === 404) {
                hint = 'Edge function wosatlas-states belum di-deploy';
            } else if (msg) {
                hint = msg;
            }
            entry.error = hint ? base + ' — ' + hint : base;
            // Fall back to the last good snapshot so the card is not empty.
            const stale = loadStale(key);
            if (stale) {
                entry.state = stale.state;
                entry.power = stale.power;
                entry.alliances = stale.alliances;
                entry.players = stale.players || [];
                entry.stale = true;
                entry.error = tr('svs_enemies_stale', 'Live data unavailable — showing saved data from {{when}}')
                    .replace('{{when}}', new Date(stale.savedAt).toLocaleString());
            }
        }
        S.cache.set(key, entry);
        return entry;
    }

    // ---------- Last-good snapshot (localStorage) ----------
    const STALE_PREFIX = 'svs_enemy_snapshot_';
    function saveStale(kid, entry) {
        try {
            localStorage.setItem(STALE_PREFIX + kid, JSON.stringify({
                savedAt: Date.now(),
                state: entry.state, power: entry.power,
                alliances: entry.alliances, players: entry.players
            }));
        } catch (_) { /* quota / private mode */ }
    }
    function loadStale(kid) {
        try {
            const raw = localStorage.getItem(STALE_PREFIX + kid);
            return raw ? JSON.parse(raw) : null;
        } catch (_) { return null; }
    }

    function detailLooksOk(entry) {
        if (!entry || entry.error) return false;
        if (entry.loading) return false;
        const hasAlliances = Array.isArray(entry.alliances) && entry.alliances.length > 0;
        const hasPlayers = Array.isArray(entry.players) && entry.players.length > 0;
        const hasPower = entry.power && (
            Number(entry.power.total_power) > 0
            || (Array.isArray(entry.power.top) && entry.power.top.length > 0)
        );
        const hasState = entry.state && (
            entry.state.server_id != null
            || entry.state.chiefs != null
            || entry.state.total_power != null
            || entry.state.king
        );
        return !!(hasAlliances || hasPlayers || hasPower || hasState);
    }

    function isRetriableDetailFailure(entry, err) {
        if (err && err.name === 'AbortError') return false;
        if (!entry) return true;
        if (entry.error) {
            const msg = String(entry.error);
            // Permanent config problems — still retry a few times in case
            // upstream was briefly down, but message is the same either way.
            if (/not configured|invalid kid/i.test(msg)) return false;
            return true;
        }
        return !detailLooksOk(entry);
    }

    /** Load one State and retry with backoff until data is OK or max attempts. */
    async function loadDetailWithRetry(kid, opts) {
        const maxAttempts = Math.max(1, (opts && opts.maxAttempts) || CFG.retryMax || 1);
        const baseMs = Math.max(200, (opts && opts.baseMs) || CFG.retryBaseMs || 800);
        const maxMs = Math.max(baseMs, (opts && opts.maxMs) || CFG.retryMaxMs || 8000);
        const shouldStop = (opts && opts.shouldStop) || (() => false);
        const onAttempt = (opts && opts.onAttempt) || null;
        let last = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            if (shouldStop()) return last;
            // Drop failed cache so the next loadDetail actually re-fetches.
            if (attempt > 1) {
                const key = Number(kid);
                const prev = S.cache.get(key);
                if (prev && (prev.error || !detailLooksOk(prev))) {
                    S.cache.delete(key);
                }
            }
            if (onAttempt) {
                try { onAttempt(attempt, maxAttempts); } catch (_) {}
            }
            last = await loadDetail(kid);
            if (shouldStop()) return last;
            if (detailLooksOk(last)) return last;
            if (!isRetriableDetailFailure(last) || attempt >= maxAttempts) return last;

            // Exponential backoff + small jitter: 0.8s, 1.6s, 3.2s… capped.
            const exp = Math.min(maxMs, baseMs * Math.pow(2, attempt - 1));
            const jitter = Math.floor(Math.random() * 200);
            await sleep(exp + jitter);
        }
        return last;
    }


    // ---------- SvS Record (match history) ----------
    async function loadSvSHistory() {
        if (S.history && Date.now() - S.historyFetchedAt < CFG.historyCacheMs) {
            return S.history;
        }
        if (S.historyLoading) return S.historyLoading;
        S.historyLoading = (async () => {
            try {
                const res = await fetch(CFG.historyUrl, {
                    headers: { accept: 'application/json, text/plain, */*' },
                    credentials: 'omit',
                    mode: 'cors'
                });
                if (!res.ok) throw new Error('http-' + res.status);
                const json = await res.json();
                const map = (json && json['svs-data-per-state']) || json || {};
                S.history = map;
                S.historyFetchedAt = Date.now();
                S.historyError = null;
                return map;
            } catch (err) {
                console.error('SvS Record history', err);
                S.historyError = tr('svs_enemies_record_load_failed', 'Could not load SvS Record');
                // keep stale cache if any
                if (!S.history) S.history = {};
                return S.history;
            } finally {
                S.historyLoading = null;
            }
        })();
        return S.historyLoading;
    }

    function getStateMatchMap(kid) {
        const map = S.history || {};
        return map[String(kid)] || map[Number(kid)] || null;
    }

    function getStateRecordRows(kid, onlySelected) {
        const entry = getStateMatchMap(kid);
        if (!entry || typeof entry !== 'object') return [];
        let dates = Object.keys(entry);
        if (onlySelected) {
            dates = dates.filter((d) => S.selectedDates.has(d));
        }
        const rows = dates.map((date) => {
            const m = entry[date] || {};
            return {
                date,
                wonPrep: !!m['won-prep'],
                wonCastle: !!m['won-castle'],
                hadMatch: m['had-svs-match'] !== false,
                opp: Number(m['opposition-state']) || null
            };
        });
        rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        return rows;
    }

    /** Dates that appear in history for the President-configured enemy States only. */
    function collectDatesForEnemyKids(kids) {
        const set = new Set();
        const map = S.history || {};
        (kids || []).forEach((kid) => {
            const entry = map[String(kid)] || map[Number(kid)];
            if (!entry || typeof entry !== 'object') return;
            Object.keys(entry).forEach((d) => set.add(d));
        });
        return Array.from(set).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    }

    function resultBadge(won) {
        if (won) {
            return `<span class="svs-en-result is-win">${esc(tr('svs_enemies_record_win', 'Win'))}</span>`;
        }
        return `<span class="svs-en-result is-loss">${esc(tr('svs_enemies_record_loss', 'Loss'))}</span>`;
    }

    function matrixCellHtml(match) {
        if (!match) {
            return `<span class="svs-en-matrix-empty">${esc(tr('svs_enemies_record_no_data', 'No Data'))}</span>`;
        }
        const prep = match.wonPrep
            ? `<span class="svs-en-matrix-line is-win">${esc(tr('svs_enemies_record_prep', 'Prep'))}: ${esc(tr('svs_enemies_record_yes', 'Yes'))}</span>`
            : `<span class="svs-en-matrix-line is-loss">${esc(tr('svs_enemies_record_prep', 'Prep'))}: ${esc(tr('svs_enemies_record_no', 'No'))}</span>`;
        const castle = match.wonCastle
            ? `<span class="svs-en-matrix-line is-win">${esc(tr('svs_enemies_record_castle', 'Castle'))}: ${esc(tr('svs_enemies_record_yes', 'Yes'))}</span>`
            : `<span class="svs-en-matrix-line is-loss">${esc(tr('svs_enemies_record_castle', 'Castle'))}: ${esc(tr('svs_enemies_record_no', 'No'))}</span>`;
        const opp = match.opp != null
            ? `<span class="svs-en-matrix-line">${esc(tr('svs_enemies_record_opp', 'Opposition'))}: ${match.opp}</span>`
            : '';
        return `${prep}${castle}${opp}`;
    }

    function renderDateFilterUI() {
        const list = document.getElementById('svs-enemies-date-list');
        const panel = document.getElementById('svs-enemies-record-panel');
        if (!list) return;
        if (!S.availableDates.length) {
            list.innerHTML = `<p class="svs-en-status">${esc(tr('svs_enemies_record_no_dates', 'No match dates found for these States.'))}</p>`;
            if (panel) panel.classList.toggle('hidden', !getEnemyKids().length);
            return;
        }
        list.innerHTML = S.availableDates.map((d) => {
            const checked = S.selectedDates.has(d) ? ' checked' : '';
            return `<label class="svs-en-date-chip">
                <input type="checkbox" data-date="${esc(d)}"${checked} onchange="svsEnemiesToggleDate('${esc(d)}', this.checked)">
                <span>${esc(d)}</span>
            </label>`;
        }).join('');
        if (panel) panel.classList.remove('hidden');
    }

    function renderRecordMatrix(kids) {
        const head = document.getElementById('svs-enemies-matrix-head');
        const body = document.getElementById('svs-enemies-matrix-body');
        const wrap = document.getElementById('svs-enemies-record-matrix-wrap');
        if (!head || !body) return;

        const dates = S.availableDates.filter((d) => S.selectedDates.has(d));
        if (!kids.length || !dates.length) {
            head.innerHTML = '';
            body.innerHTML = `<tr><td class="svs-en-status">${esc(tr('svs_enemies_record_select_dates', 'Select at least one date to show the record table.'))}</td></tr>`;
            return;
        }

        head.innerHTML = `<tr>
            <th>${esc(tr('svs_enemies_state_label', 'State'))}</th>
            ${dates.map((d) => `<th>${esc(d)}</th>`).join('')}
        </tr>`;

        body.innerHTML = kids.map((kid) => {
            const entry = getStateMatchMap(kid) || {};
            const cells = dates.map((d) => {
                const m = entry[d];
                if (!m) {
                    return `<td class="svs-en-matrix-cell">${matrixCellHtml(null)}</td>`;
                }
                const row = {
                    wonPrep: !!m['won-prep'],
                    wonCastle: !!m['won-castle'],
                    opp: Number(m['opposition-state']) || null
                };
                const cls = (row.wonPrep || row.wonCastle) ? ' has-win' : ' has-loss';
                return `<td class="svs-en-matrix-cell${cls}">${matrixCellHtml(row)}</td>`;
            }).join('');
            return `<tr>
                <th scope="row" class="svs-en-matrix-state">${esc(tr('svs_enemies_state_label', 'State'))} ${kid}</th>
                ${cells}
            </tr>`;
        }).join('');
    }

    function rebuildRecordFiltersAndMatrix() {
        const kids = getEnemyKids();
        S.availableDates = collectDatesForEnemyKids(kids);
        // Default: all dates selected. Later: keep only still-valid selected dates.
        if (!S.selectedDates.size) {
            S.selectedDates = new Set(S.availableDates);
        } else {
            const next = new Set();
            S.availableDates.forEach((d) => {
                if (S.selectedDates.has(d)) next.add(d);
            });
            S.selectedDates = next.size ? next : new Set(S.availableDates);
        }
        renderDateFilterUI();
        renderRecordMatrix(kids);
        // Re-render per-card record sections without full reload
        const listEl = document.getElementById('svs-enemies-list');
        if (listEl) {
            listEl.querySelectorAll('.svs-en-card[data-kid]').forEach((card) => {
                const kid = Number(card.getAttribute('data-kid'));
                const slot = card.querySelector('.svs-en-record-slot');
                if (slot && Number.isFinite(kid)) {
                    slot.innerHTML = renderSvSRecordSection(kid);
                }
            });
        }
    }

    function svsEnemiesToggleDate(date, checked) {
        if (checked) S.selectedDates.add(date);
        else S.selectedDates.delete(date);
        renderRecordMatrix(getEnemyKids());
        const listEl = document.getElementById('svs-enemies-list');
        if (listEl) {
            listEl.querySelectorAll('.svs-en-card[data-kid]').forEach((card) => {
                const kid = Number(card.getAttribute('data-kid'));
                const slot = card.querySelector('.svs-en-record-slot');
                if (slot && Number.isFinite(kid)) slot.innerHTML = renderSvSRecordSection(kid);
            });
        }
        // sync checkbox UI state is already from user click
        const panel = document.getElementById('svs-enemies-record-panel');
        if (panel) panel.classList.remove('hidden');
    }

    function svsEnemiesSelectAllDates() {
        S.selectedDates = new Set(S.availableDates);
        renderDateFilterUI();
        renderRecordMatrix(getEnemyKids());
        const listEl = document.getElementById('svs-enemies-list');
        if (listEl) {
            listEl.querySelectorAll('.svs-en-card[data-kid]').forEach((card) => {
                const kid = Number(card.getAttribute('data-kid'));
                const slot = card.querySelector('.svs-en-record-slot');
                if (slot && Number.isFinite(kid)) slot.innerHTML = renderSvSRecordSection(kid);
            });
        }
    }

    function svsEnemiesClearAllDates() {
        S.selectedDates = new Set();
        renderDateFilterUI();
        renderRecordMatrix(getEnemyKids());
        const listEl = document.getElementById('svs-enemies-list');
        if (listEl) {
            listEl.querySelectorAll('.svs-en-card[data-kid]').forEach((card) => {
                const kid = Number(card.getAttribute('data-kid'));
                const slot = card.querySelector('.svs-en-record-slot');
                if (slot && Number.isFinite(kid)) slot.innerHTML = renderSvSRecordSection(kid);
            });
        }
    }

    window.svsEnemiesToggleDate = svsEnemiesToggleDate;
    window.svsEnemiesSelectAllDates = svsEnemiesSelectAllDates;
    window.svsEnemiesClearAllDates = svsEnemiesClearAllDates;

    function renderSvSRecordSection(kid) {
        if (S.historyError && !S.history) {
            return `<div class="svs-en-record-slot"><h4 class="svs-en-h">${esc(tr('svs_enemies_record_title', 'SvS Record'))}</h4>
                <p class="svs-en-status svs-en-error">${esc(S.historyError)}</p></div>`;
        }
        const rows = getStateRecordRows(kid, true);
        if (!rows.length) {
            return `<div class="svs-en-record-slot"><h4 class="svs-en-h">${esc(tr('svs_enemies_record_title', 'SvS Record'))}</h4>
                <p class="svs-en-status">${esc(tr('svs_enemies_record_empty', 'No match history for this State yet.'))}</p></div>`;
        }
        let prepW = 0, prepL = 0, casW = 0, casL = 0;
        rows.forEach((r) => {
            if (!r.hadMatch) return;
            if (r.wonPrep) prepW++; else prepL++;
            if (r.wonCastle) casW++; else casL++;
        });
        const body = rows.map((r) => {
            const opp = r.opp != null ? String(r.opp) : '—';
            return `<tr>
                <td>${esc(r.date)}</td>
                <td class="st-num">${esc(opp)}</td>
                <td>${resultBadge(r.wonPrep)}</td>
                <td>${resultBadge(r.wonCastle)}</td>
            </tr>`;
        }).join('');
        return `
            <div class="svs-en-record-slot">
            <h4 class="svs-en-h">${esc(tr('svs_enemies_record_title', 'SvS Record'))}
                <span class="svs-en-h-meta">${rows.length}</span>
            </h4>
            <div class="svs-en-record-summary">
                <span>${esc(tr('svs_enemies_record_prep', 'Prep'))}: <strong class="svs-en-win-text">${prepW}</strong>–<strong class="svs-en-loss-text">${prepL}</strong></span>
                <span>${esc(tr('svs_enemies_record_castle', 'Castle'))}: <strong class="svs-en-win-text">${casW}</strong>–<strong class="svs-en-loss-text">${casL}</strong></span>
            </div>
            <div class="svs-en-table-wrap svs-en-lb-wrap">
                <table class="svs-en-table">
                    <thead><tr>
                        <th>${esc(tr('svs_enemies_record_date', 'Date'))}</th>
                        <th class="st-num">${esc(tr('svs_enemies_record_vs', 'vs State'))}</th>
                        <th>${esc(tr('svs_enemies_record_prep', 'Prep'))}</th>
                        <th>${esc(tr('svs_enemies_record_castle', 'Castle'))}</th>
                    </tr></thead>
                    <tbody>${body}</tbody>
                </table>
            </div>
            </div>`;
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
        const kingUid = king && (king.uid || king.playerUid) ? String(king.uid || king.playerUid) : '';
        const kingNick = king ? String(king.nick_name || king.name || '').trim() : '';
        // Prefer nickname; fall back to uid only if name still missing
        const kingName = kingNick || kingUid || null;
        const kingDisplay = kingNick
            ? (kingUid ? kingNick + ' · #' + kingUid : kingNick)
            : (kingUid ? '#' + kingUid : null);

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
            body = `<p class="svs-en-status">${esc(error || tr('svs_enemies_loading', 'Loading…'))}</p>`;
        } else if (error && !power && !state) {
            // Live data failed, but SvS Record (wosnerds) is independent — keep showing it.
            body = `
                <p class="svs-en-status svs-en-error">${esc(error)}</p>
                <button type="button" class="svs-en-retry" data-retry-kid="${kid}">${esc(tr('svs_enemies_retry_btn', 'Retry'))}</button>
                ${renderSvSRecordSection(kid)}`;
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
                    ${kingDisplay ? `<div class="svs-en-stat"><span class="svs-en-stat-label">${esc(tr('svs_enemies_stat_king', 'President'))}</span><strong data-no-i18n>${esc(kingDisplay)}</strong></div>` : ''}
                </div>
                ${error ? `<p class="svs-en-status svs-en-warn">${esc(error)}</p>` : ''}
                ${data && data.cachedAt ? `<p class="svs-en-status svs-en-cached">${esc(tr('svs_enemies_data_as_of', 'Data as of {{when}}').replace('{{when}}', new Date(data.cachedAt).toLocaleString()))}</p>` : ''}
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
                ${renderSvSRecordSection(kid)}
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

    /** Reload a single State card in place (used by 2nd pass and the Retry button). */
    async function retryOneCard(kid, gen) {
        const listEl = document.getElementById('svs-enemies-list');
        if (!listEl) return;
        const swap = (data) => {
            const card = listEl.querySelector(`.svs-en-card[data-kid="${kid}"]`);
            if (!card) return;
            const wrap = document.createElement('div');
            wrap.innerHTML = renderCard(Number(kid), data);
            if (wrap.firstElementChild) card.replaceWith(wrap.firstElementChild);
        };
        swap({ loading: true });
        const data = await loadDetailWithRetry(kid, {
            shouldStop: () => gen != null && gen !== S.loadGen
        });
        if (gen != null && gen !== S.loadGen) return;
        swap(data);
    }

    document.addEventListener('click', (ev) => {
        const btn = ev.target && ev.target.closest && ev.target.closest('[data-retry-kid]');
        if (!btn) return;
        const kid = Number(btn.getAttribute('data-retry-kid'));
        if (!Number.isFinite(kid)) return;
        btn.disabled = true;
        S.cache.delete(kid);
        retryOneCard(kid, null);
    });

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
            const panel = document.getElementById('svs-enemies-record-panel');
            if (panel) panel.classList.add('hidden');
            return;
        }
        if (emptyEl) emptyEl.classList.add('hidden');

        // Show skeleton cards first
        listEl.innerHTML = kids.map((kid) => renderCard(kid, { loading: true })).join('');
        if (metaEl) {
            metaEl.textContent = tr('svs_enemies_count', '{{n}} enemy State(s)').replace('{{n}}', String(kids.length));
        }

        // SvS Record dataset — only dates/matches for President-configured enemy States
        await loadSvSHistory();
        rebuildRecordFiltersAndMatrix();

        // Queue State loads (sequential by default + delay) to avoid API blocks.
        const gen = ++S.loadGen;
        const total = kids.length;
        if (metaEl) {
            metaEl.textContent = tr('svs_enemies_loading_queue', 'Loading {{done}}/{{total}}…')
                .replace('{{done}}', '0')
                .replace('{{total}}', String(total));
        }

        await runQueue(
            kids,
            async (kid) => {
                if (gen !== S.loadGen) return null;
                const data = await loadDetailWithRetry(kid, {
                    shouldStop: () => gen !== S.loadGen,
                    onAttempt: (attempt, maxAttempts) => {
                        if (gen !== S.loadGen) return;
                        const card = listEl.querySelector(`.svs-en-card[data-kid="${kid}"]`);
                        if (!card) return;
                        if (attempt === 1) return; // first try keeps the normal skeleton
                        const wrap = document.createElement('div');
                        wrap.innerHTML = renderCard(kid, {
                            loading: true,
                            error: tr('svs_enemies_retrying', 'Retrying {{attempt}}/{{max}}…')
                                .replace('{{attempt}}', String(attempt))
                                .replace('{{max}}', String(maxAttempts))
                        });
                        if (wrap.firstElementChild) card.replaceWith(wrap.firstElementChild);
                    }
                });
                if (gen !== S.loadGen) return data;
                const card = listEl.querySelector(`.svs-en-card[data-kid="${kid}"]`);
                if (card) {
                    const wrap = document.createElement('div');
                    wrap.innerHTML = renderCard(kid, data);
                    if (wrap.firstElementChild) card.replaceWith(wrap.firstElementChild);
                }
                return data;
            },
            {
                concurrency: total > 1 ? CFG.loadConcurrency : 1,
                delayMs: total > 1 ? CFG.loadDelayMs : 0,
                shouldStop: () => gen !== S.loadGen,
                onProgress: (done, n) => {
                    if (gen !== S.loadGen || !metaEl) return;
                    if (done < n) {
                        metaEl.textContent = tr('svs_enemies_loading_queue', 'Loading {{done}}/{{total}}…')
                            .replace('{{done}}', String(done))
                            .replace('{{total}}', String(n));
                    }
                }
            }
        );

        // Second pass: States that failed during the burst are often just rate-limited.
        // Cool down, then retry only those, one at a time.
        if (gen === S.loadGen) {
            const failed = kids.filter((k) => {
                const e = S.cache.get(Number(k));
                return !e || e.error;
            });
            if (failed.length) {
                await sleep(4000);
                for (const kid of failed) {
                    if (gen !== S.loadGen) return;
                    S.cache.delete(Number(kid));
                    await retryOneCard(kid, gen);
                    await sleep(CFG.loadDelayMs);
                }
            }
        }

        if (gen !== S.loadGen) return;
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
        // Cancel any in-flight State load queue
        S.loadGen++;
        const enemies = document.getElementById('svs-enemies-view');
        if (enemies) enemies.classList.add('hidden');
    }


    // ---------- Alliance detail modal ----------
    // Same strategy as TAL State Tracker: public site first, then proxy.
    // alliance_id = "<serverId><6-digit seq>" e.g. 1199000147 → kid 1199.
    function mapMemberRow(m) {
        if (!m || typeof m !== 'object') return m;
        return {
            rank: m.rank || 0,
            uid: m.uid ?? null,
            nick_name: m.name || m.nick_name || m.nickname || m.nickName || null,
            power: Number(m.power) || 0,
            stove_lv: m.hq_level ?? m.stove_lv ?? m.stove ?? m.lv ?? null,
            lv: m.hq_level ?? m.lv ?? null,
            x: m.x ?? null,
            y: m.y ?? null,
            alliance_tag: m.alliance_tag || null
        };
    }

    async function fetchAllianceMembersDirect(aid, signal) {
        const out = [];
        const seen = new Set();
        let cursor = null;
        for (let page = 0; page < 10 && out.length < 300; page++) {
            const qs = cursor
                ? `?limit=200&cursor=${encodeURIComponent(cursor)}`
                : '?limit=200';
            const data = await fetchJson(`${CFG.apiBase}/alliances/${aid}/members${qs}`, signal);
            const items = (data && Array.isArray(data.items)) ? data.items
                : (data && Array.isArray(data.members)) ? data.members
                : Array.isArray(data) ? data : [];
            let added = 0;
            for (const m of items) {
                const id = String(m && m.uid != null ? m.uid : '');
                if (!id || seen.has(id)) continue;
                seen.add(id);
                out.push(m);
                added++;
            }
            if (!added) break;
            cursor = (data && typeof data.next === 'string' && data.next) ? data.next : null;
            if (!cursor) break;
        }
        return out;
    }

    async function fetchAllianceDirect(aid, signal) {
        // Meta from state alliance list + full member roster (TAL approach).
        const kid = Math.floor(Number(aid) / 1000000);
        const [listRes, memRes] = await Promise.allSettled([
            (async () => {
                if (!Number.isFinite(kid) || kid < 1) return [];
                const out = [];
                const seen = new Set();
                let cursor = null;
                for (let page = 0; page < 25 && out.length < 400; page++) {
                    const qs = cursor
                        ? `?sort=power&limit=50&cursor=${encodeURIComponent(cursor)}`
                        : '?sort=power&limit=50';
                    const data = await fetchJson(`${CFG.apiBase}/servers/${kid}/alliances${qs}`, signal);
                    const items = (data && Array.isArray(data.items)) ? data.items
                        : Array.isArray(data) ? data : [];
                    let added = 0;
                    for (const a of items) {
                        const id = String(a && a.alliance_id != null ? a.alliance_id : '');
                        if (!id || seen.has(id)) continue;
                        seen.add(id);
                        out.push(a);
                        added++;
                    }
                    if (!added) break;
                    cursor = (data && typeof data.next === 'string' && data.next) ? data.next : null;
                    if (!cursor) break;
                }
                return out;
            })(),
            fetchAllianceMembersDirect(aid, signal)
        ]);
        const list = listRes.status === 'fulfilled' ? listRes.value : [];
        const membersRaw = memRes.status === 'fulfilled' ? memRes.value : [];
        const a = list.find((x) => Number(x.alliance_id) === Number(aid));
        if (!a && !membersRaw.length) throw new Error('direct-alliance-failed');
        const src = a || {};
        const members = membersRaw.map(mapMemberRow);
        members.sort((x, y) => (Number(y.power) || 0) - (Number(x.power) || 0));
        members.forEach((m, i) => { m.rank = i + 1; });
        return {
            aid: Number(aid),
            abbr: src.tag || (members[0] && members[0].alliance_tag) || '',
            name: src.name || '',
            memberCount: src.member_count != null ? src.member_count : members.length,
            memberMax: src.max_members,
            serverPower: src.power,
            totalPower: src.power,
            leaderUid: src.leader_uid,
            leaderName: src.leader_name,
            lv: src.alliance_level,
            joinMinLevel: src.join_min_level,
            joinMinPower: src.join_min_power,
            publicRecruit: !!src.public_recruit,
            homeKid: Number(src.home_server_id) || kid || null,
            honorLevel: src.honor_level,
            members: members,
            memberList: members,
            players: members,
            source: 'public-site'
        };
    }

    function alliancePayloadUsable(data) {
        if (!data || typeof data !== 'object') return false;
        if (data.error && !data.aid && !data.abbr && !data.name
            && !(Array.isArray(data.members) && data.members.length)
            && !(Array.isArray(data.memberList) && data.memberList.length)
            && !(Array.isArray(data.players) && data.players.length)
            && !(Array.isArray(data.items) && data.items.length)) {
            return false;
        }
        return true;
    }

    async function fetchAllianceProxy(aid) {
        const client = typeof getSupabase === 'function' ? getSupabase() : null;
        if (!client) throw new Error('no-proxy');
        const { data, error } = await client.functions.invoke(CFG.proxyFunction, {
            body: { action: 'alliance', aid }
        });
        if (error) {
            // Surface edge-function body message when available
            let detail = '';
            try {
                if (error.context && typeof error.context.json === 'function') {
                    const body = await error.context.json();
                    detail = (body && (body.message || body.error)) ? String(body.message || body.error) : '';
                }
            } catch (_) { /* ignore */ }
            throw new Error(detail || error.message || 'proxy-alliance-failed');
        }
        if (!alliancePayloadUsable(data)) {
            throw new Error((data && (data.message || data.error)) || 'proxy-alliance-failed');
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
            // Same order as TAL: public direct first, proxy only as fallback.
            try {
                data = await fetchAllianceDirect(key);
                S.mode = 'direct';
            } catch (directErr) {
                if (directErr && directErr.name === 'AbortError') throw directErr;
                console.warn('SvS Enemies alliance direct failed, trying proxy', directErr);
                try {
                    data = await fetchAllianceProxy(key);
                    S.mode = 'proxy';
                } catch (proxyErr) {
                    if (proxyErr && proxyErr.name === 'AbortError') throw proxyErr;
                    throw directErr;
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
            const msg = (err && err.message) ? String(err.message) : '';
            const base = tr('svs_enemies_alliance_load_failed', 'Could not load alliance detail');
            entry.error = msg && msg !== 'proxy-alliance-failed' && msg !== 'direct-alliance-failed'
                ? base + ' — ' + msg
                : base;
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
        S.history = null;
        S.historyFetchedAt = 0;
        S.historyError = null;
        S.availableDates = [];
        S.selectedDates = new Set();
        renderEnemiesView();
    };

    // ---------- President Panel: configure enemy state numbers ----------
    function readMenuLabelFromForm() {
        const tal = document.getElementById('svs-enemies-label-tal');
        if (tal && tal.checked) return 'tal';
        return 'svs';
    }

    function openSvSEnemiesSettingsModal() {
        if (typeof isAdmin !== 'undefined' && !isAdmin) return;
        if (typeof closePresidentPanelModal === 'function') closePresidentPanelModal();
        const modal = document.getElementById('svs-enemies-settings-modal');
        const input = document.getElementById('svs-enemies-kids-input');
        if (!modal || !input) return;
        input.value = kidsToString(S.kids.length ? S.kids : loadKidsFromLocal());
        applyMenuLabel(S.menuLabel || loadMenuLabelLocal());
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
        const menuLabel = readMenuLabelFromForm();
        S.kids = kids;
        saveKidsLocal(kids);
        saveMenuLabelLocal(menuLabel);
        applyMenuLabel(menuLabel);
        const btn = document.getElementById('svs-enemies-settings-save-btn');
        if (btn && typeof setButtonBusy === 'function') setButtonBusy(btn, true, tr('busy_saving', 'Saving…'));
        const okDb = await saveKidsToDb(kids, menuLabel);
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
        applyMenuLabel(loadMenuLabelLocal());
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
