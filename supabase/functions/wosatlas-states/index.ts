// Supabase Edge Function: wosatlas-states
// Proxy for State Tracker / SvS Enemies.
// api.wosatlas.com now requires an API key (401 without it). The browser
// must NOT hold the key — this function reads WOSATLAS_API_KEY from secrets
// and forwards it upstream.
//
// Setup:
//   supabase secrets set WOSATLAS_API_KEY=your_key_here
//   supabase functions deploy wosatlas-states
//
// Actions (body.action):
//   "summary" (default) — list States
//   "detail" — state + kingdom power + alliance leaderboard + player leaderboard
//     body: { kid, allianceLimit?, playerLimit? }
//   "power-leaderboard" — /power/leaderboard?kid=&limit=
//     body: { kid, limit? }
//   "alliance" — /alliances/{aid}/members
//   "player" — /players/{uid}
//   "player-extra" — /players/{uid}/power|arena|history
//   "player-search" — /players/search?playerName=

const API = 'https://api.wosatlas.com/v1';
const CACHE_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 400;
const UA = '3475.web.id SvS Enemies / State Tracker';
const API_KEY = (Deno.env.get('WOSATLAS_API_KEY') || '').trim();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const cache = new Map<string, { at: number; body: string }>();

function json(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonObj(obj: unknown, status = 200) {
  return json(JSON.stringify(obj), status);
}

function cacheGet(key: string): string | null {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.body;
  return null;
}

function cacheSet(key: string, body: string) {
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), body });
}

function upstreamHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    accept: 'application/json',
    'user-agent': UA,
  };
  if (API_KEY) {
    // WoS Atlas accepts several common forms; send both to be safe.
    h['X-Api-Key'] = API_KEY;
    h['Authorization'] = `Bearer ${API_KEY}`;
  }
  return h;
}

async function upstreamGet(url: string): Promise<{ ok: true; body: string } | { ok: false; status: number }> {
  const res = await fetch(url, {
    headers: upstreamHeaders(),
  });
  if (!res.ok) return { ok: false, status: res.status };
  const body = await res.text();
  JSON.parse(body);
  return { ok: true, body };
}

async function handleSummary(input: Record<string, unknown>) {
  const limit = Math.min(Math.max(Math.trunc(Number(input.limit)) || 50, 1), 50);
  const offset = Math.min(Math.max(Math.trunc(Number(input.offset)) || 0, 0), 100000);
  const desc = input.desc === false ? 'false' : 'true';
  const key = `summary:${limit}:${offset}:${desc}`;
  const hit = cacheGet(key);
  if (hit) return json(hit);
  const qs = new URLSearchParams({
    sort: 'chiefs',
    desc,
    limit: String(limit),
    offset: String(offset),
  });
  const up = await upstreamGet(`${API}/states/summary?${qs}`);
  if (!up.ok) return jsonObj({ error: 'upstream-' + up.status }, 502);
  cacheSet(key, up.body);
  return json(up.body);
}

// Public site (no API key) — same source TAL State Tracker uses.
const SITE = 'https://wosatlas.com/api/v1';

async function siteGet(path: string): Promise<any | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${SITE}${path}`, {
        headers: {
          accept: 'application/json, text/plain, */*',
          'user-agent': UA,
          'accept-language': 'en-US,en;q=0.9',
        },
      });
      if (res.ok) {
        const text = await res.text();
        try { return JSON.parse(text); } catch (_) { return null; }
      }
      // retry on rate-limit / upstream errors
      if (res.status !== 429 && res.status < 500) return null;
    } catch (_) { /* retry */ }
    await new Promise((r) => setTimeout(r, 300 + attempt * 200));
  }
  return null;
}

async function siteGetPaged(
  path: string,
  idOf: (it: any) => string,
  maxItems: number,
  maxPages = 30,
): Promise<any[] | null> {
  const sep = path.includes('?') ? '&' : '?';
  const seen = new Set<string>();
  const out: any[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < maxPages && out.length < maxItems; page++) {
    const url = cursor ? `${path}${sep}cursor=${encodeURIComponent(cursor)}` : path;
    const data = await siteGet(url);
    if (!data) return out.length ? out : null;
    const items: any[] = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : [];
    let added = 0;
    for (const it of items) {
      const id = idOf(it);
      if (!seen.has(id)) { seen.add(id); out.push(it); added++; }
    }
    if (!added) break;
    const next = data && typeof data.next === 'string' && data.next ? data.next : null;
    cursor = next;
    if (!cursor) break;
  }
  return out.slice(0, maxItems);
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapPublicMember(m: any, i: number) {
  return {
    rank: i + 1,
    uid: m.uid ?? null,
    nick_name: m.name ?? m.nick_name ?? m.nickname ?? null,
    power: Number(m.power) || 0,
    stove_lv: m.hq_level ?? m.stove_lv ?? m.stove ?? null,
    lv: m.hq_level ?? m.lv ?? null,
    alliance_tag: m.alliance_tag ?? null,
  };
}

async function fetchServer(kid: number) {
  return await siteGet(`/servers/${kid}`);
}

async function fetchServerAlliances(kid: number, limit: number): Promise<any[] | null> {
  const key = `alliances:${kid}:${limit}`;
  const hit = cacheGet(key);
  if (hit) {
    try { return JSON.parse(hit); } catch (_) { /* ignore */ }
  }
  const items = await siteGetPaged(
    `/servers/${kid}/alliances?sort=power&limit=${Math.min(Math.max(limit, 1), 50)}`,
    (a) => String(a.alliance_id),
    Math.max(limit, 50),
    20,
  );
  if (items) cacheSet(key, JSON.stringify(items));
  return items;
}

async function fetchAllianceMembers(aid: number): Promise<any[]> {
  const key = `members:${aid}`;
  const hit = cacheGet(key);
  if (hit) {
    try { return JSON.parse(hit); } catch (_) { /* ignore */ }
  }
  const items = (await siteGetPaged(
    `/alliances/${aid}/members?limit=200`,
    (m) => String(m.uid),
    300,
    12,
  )) || [];
  cacheSet(key, JSON.stringify(items));
  return items;
}

// Build player leaderboard from strongest alliances (TAL approach).
const PLAYER_SOURCE_ALLIANCES = 12;

async function fetchServerPlayers(kid: number, limit: number): Promise<any[]> {
  const key = `players:${kid}:${limit}`;
  const hit = cacheGet(key);
  if (hit) {
    try { return JSON.parse(hit); } catch (_) { /* ignore */ }
  }
  const alliances = (await fetchServerAlliances(kid, 50)) || [];
  const lists = await Promise.all(
    alliances.slice(0, PLAYER_SOURCE_ALLIANCES).map((a: any) =>
      fetchAllianceMembers(Number(a.alliance_id)).catch(() => [] as any[]),
    ),
  );
  const seen = new Set<string>();
  const merged: any[] = [];
  for (const m of lists.flat()) {
    const uid = String(m.uid ?? '');
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    merged.push(m);
  }
  merged.sort((a, b) => (num(b.power) ?? 0) - (num(a.power) ?? 0));
  const out = merged.slice(0, limit).map(mapPublicMember);
  cacheSet(key, JSON.stringify(out));
  return out;
}

/** Primary detail path — public site, same as TAL (works without API key). */
async function detailFromPublicSite(kid: number, allianceLimit: number, playerLimit: number) {
  const [server, allianceItems, players] = await Promise.all([
    fetchServer(kid),
    fetchServerAlliances(kid, allianceLimit),
    fetchServerPlayers(kid, playerLimit),
  ]);

  if (!server && !allianceItems && !(players && players.length)) {
    return null;
  }

  const rollup = (server && server.rollup) || {};
  const king = server && Array.isArray(server.roles)
    ? server.roles.find((r: any) => r && (r.role === 'king' || r.role === 'president'))
    : null;

  const totalPower = num(rollup.player_power);
  const playerCount = num(rollup.players);

  let kingObj: { uid: any; nick_name: string | null; name: string | null } | null = null;
  if (king && king.uid) {
    let nick: string | null = null;
    const fromPlayers = (players || []).find((p: any) => String(p.uid) === String(king.uid));
    if (fromPlayers && fromPlayers.nick_name) nick = String(fromPlayers.nick_name);
    if (!nick) {
      try {
        const p = await siteGet(`/players/${king.uid}`);
        if (p && (p.name || p.nick_name)) nick = String(p.name || p.nick_name);
      } catch (_) { /* ignore */ }
    }
    kingObj = { uid: king.uid, nick_name: nick, name: nick };
  }

  const state = server
    ? {
        server_id: server.server_id ?? String(kid),
        chiefs: playerCount,
        total_power: totalPower,
        alliance_count: num(rollup.alliances),
        king: kingObj,
        refreshed_at: rollup.refreshed_at ?? null,
        roles: server.roles || null,
      }
    : null;

  const power = server
    ? { player_count: playerCount, total_power: totalPower, top: players || [] }
    : (players && players.length ? { top: players } : null);

  const alliances = allianceItems
    ? {
        entries: allianceItems.slice(0, allianceLimit).map((a: any) => ({
          ...a,
          aid: Number(a.alliance_id),
          abbr: a.tag,
          members: a.member_count,
          memberMax: a.max_members,
          totalPower: a.power,
          maxPower: a.held_members ? a.held_members.power_max : 0,
          publicRecruit: !!a.public_recruit,
          name: a.name,
        })),
      }
    : null;

  return {
    state,
    power,
    alliances,
    players: players || [],
    kid,
    source: 'public-site',
  };
}

async function handleDetail(input: Record<string, unknown>) {
  const kid = Math.trunc(Number(input.kid));
  if (!Number.isFinite(kid) || kid < 1 || kid > 99999) {
    return jsonObj({ error: 'bad-kid' }, 400);
  }
  const allianceLimit = Math.min(Math.max(Math.trunc(Number(input.allianceLimit)) || 15, 1), 50);
  const playerLimit = Math.min(Math.max(Math.trunc(Number(input.playerLimit)) || 100, 1), 100);
  const key = `detail:${kid}:${allianceLimit}:${playerLimit}`;
  const hit = cacheGet(key);
  if (hit) return json(hit);

  // Always try public site first (works without WOSATLAS_API_KEY) — same as TAL.
  try {
    const pub = await detailFromPublicSite(kid, allianceLimit, playerLimit);
    if (pub && (pub.state || pub.power || pub.alliances || (pub.players && pub.players.length))) {
      const payload = JSON.stringify(pub);
      cacheSet(key, payload);
      return json(payload);
    }
  } catch (e) {
    console.error('detailFromPublicSite error', e);
  }

  // Optional: keyed api.wosatlas.com if secret is set and public path failed
  if (API_KEY) {
    try {
      const urls = [
        `${API}/states/${kid}`,
        `${API}/kingdoms/${kid}/power`,
        `${API}/alliances/leaderboard?limit=${allianceLimit}&kid=${kid}`,
        `${API}/power/leaderboard?kid=${kid}&limit=${playerLimit}`,
      ];
      const results = await Promise.all(
        urls.map(async (url) => {
          try { return await upstreamGet(url); }
          catch (_) { return { ok: false as const, status: 0 }; }
        }),
      );
      const parse = (r: { ok: true; body: string } | { ok: false; status: number }) => {
        if (!r.ok) return null;
        try { return JSON.parse(r.body); } catch (_) { return null; }
      };
      const state = parse(results[0]);
      let power = parse(results[1]);
      let alliances = parse(results[2]);
      const leaderboard = parse(results[3]);
      let players: any[] = [];
      if (leaderboard && Array.isArray(leaderboard.entries)) players = leaderboard.entries;
      else if (power && Array.isArray(power.top)) players = power.top;
      if (power && players.length) power = { ...power, top: players };
      if (state || power || alliances || players.length) {
        const payload = JSON.stringify({ state, power, alliances, players, kid, source: 'api' });
        cacheSet(key, payload);
        return json(payload);
      }
    } catch (e) {
      console.error('keyed API detail error', e);
    }
  }

  return jsonObj({
    error: 'upstream-failed',
    message: 'Could not load State from wosatlas.com public API'
      + (API_KEY ? ' or api.wosatlas.com.' : ' (no WOSATLAS_API_KEY set).'),
  }, 502);
}

async function handlePowerLeaderboard(input: Record<string, unknown>) {
  const kid = Math.trunc(Number(input.kid));
  if (!Number.isFinite(kid) || kid < 1 || kid > 99999) {
    return jsonObj({ error: 'bad-kid' }, 400);
  }
  const limit = Math.min(Math.max(Math.trunc(Number(input.limit)) || 100, 1), 100);
  const key = `power-lb:${kid}:${limit}`;
  const hit = cacheGet(key);
  if (hit) return json(hit);
  // Public path (no API key needed)
  const entries = await fetchServerPlayers(kid, limit);
  if (entries.length) {
    const body = JSON.stringify({ entries, players: entries, kid, source: 'public-site' });
    cacheSet(key, body);
    return json(body);
  }
  if (API_KEY) {
    const up = await upstreamGet(`${API}/power/leaderboard?kid=${kid}&limit=${limit}`);
    if (up.ok) {
      cacheSet(key, up.body);
      return json(up.body);
    }
  }
  return jsonObj({ error: 'upstream-failed' }, 502);
}

async function handleAlliance(input: Record<string, unknown>) {
  const aid = Math.trunc(Number(input.aid));
  if (!Number.isFinite(aid) || aid < 1) return jsonObj({ error: 'bad-aid' }, 400);
  const key = `alliance:${aid}`;
  const hit = cacheGet(key);
  if (hit) return json(hit);

  // TAL logic: alliance_id = "<serverId><6-digit seq>" e.g. 3369000011
  // Meta comes from /servers/{kid}/alliances; members from /alliances/{aid}/members (paged).
  const pub = await allianceFromPublicSite(aid);
  if (pub) {
    const body = JSON.stringify(pub);
    cacheSet(key, body);
    return json(body);
  }

  // Optional keyed API last resort
  if (API_KEY) {
    const up = await upstreamGet(`${API}/alliances/${aid}/members`);
    if (up.ok) {
      try {
        const raw = JSON.parse(up.body);
        let membersList: any[] = [];
        if (Array.isArray(raw.members)) membersList = raw.members;
        else if (Array.isArray(raw.items)) membersList = raw.items;
        else if (Array.isArray(raw)) membersList = raw;
        const members = membersList.map(mapPublicMember);
        const body = JSON.stringify({
          aid,
          abbr: raw.abbr || raw.tag || '',
          name: raw.name || '',
          memberCount: members.length,
          members,
          memberList: members,
          players: members,
          source: 'api',
        });
        cacheSet(key, body);
        return json(body);
      } catch (_) { /* fall through */ }
    }
  }

  return jsonObj({
    error: 'alliance-not-found',
    message: 'Could not load alliance from public WoS Atlas (and API key path also failed).',
  }, 502);
}

async function allianceFromPublicSite(aid: number) {
  // Derive state id from alliance id (TAL convention)
  const kid = Math.trunc(aid / 1_000_000);

  // 1) Alliance meta from the state's alliance list (paged)
  let meta: any = null;
  if (kid >= 1) {
    const items = await siteGetPaged(
      `/servers/${kid}/alliances?sort=power&limit=50`,
      (a) => String(a.alliance_id),
      400,
      25,
    );
    if (items) {
      meta = items.find((x: any) => Number(x.alliance_id) === aid) || null;
    }
  }

  // 2) Members (paged) — public API uses `name` not `nick_name`
  const memberItems = await siteGetPaged(
    `/alliances/${aid}/members?limit=200`,
    (m) => String(m.uid),
    300,
    15,
  );

  if (!meta && !(memberItems && memberItems.length)) return null;

  const members = (memberItems || []).map(mapPublicMember);
  members.sort((a, b) => (Number(b.power) || 0) - (Number(a.power) || 0));
  // re-rank after sort
  members.forEach((m, i) => { m.rank = i + 1; });

  const a = meta || {};
  return {
    aid,
    abbr: a.tag || (members[0] && members[0].alliance_tag) || '',
    name: a.name || '',
    memberCount: a.member_count ?? members.length,
    memberMax: a.max_members ?? 0,
    serverPower: a.power ?? members.reduce((s, m) => s + (Number(m.power) || 0), 0),
    totalPower: a.power ?? null,
    leaderUid: a.leader_uid ?? (members[0] && members[0].uid) ?? 0,
    leaderName: a.leader_name ?? (members[0] && members[0].nick_name) ?? '',
    lv: a.alliance_level ?? 0,
    joinMinLevel: a.join_min_level ?? 0,
    joinMinPower: a.join_min_power ?? 0,
    publicRecruit: !!a.public_recruit,
    homeKid: Number(a.home_server_id) || kid || null,
    honorLevel: a.honor_level ?? null,
    notice: a.notice || '',
    manifesto: a.manifesto || '',
    members,
    memberList: members,
    players: members,
    source: 'public-site',
  };
}

async function handlePlayer(input: Record<string, unknown>) {
  const uid = Math.trunc(Number(input.uid));
  if (!Number.isFinite(uid) || uid < 1) return jsonObj({ error: 'bad-uid' }, 400);
  const key = `player:${uid}`;
  const hit = cacheGet(key);
  if (hit) return json(hit);
  const up = await upstreamGet(`${API}/players/${uid}`);
  if (!up.ok) return jsonObj({ error: 'upstream-' + up.status }, 502);
  cacheSet(key, up.body);
  return json(up.body);
}

const PLAYER_EXTRA_PATHS: Record<string, string> = {
  power: 'power',
  arena: 'arena',
  history: 'history?limit=200',
};

async function handlePlayerExtra(input: Record<string, unknown>) {
  const uid = Math.trunc(Number(input.uid));
  if (!Number.isFinite(uid) || uid < 1) return jsonObj({ error: 'bad-uid' }, 400);
  const kind = typeof input.kind === 'string' ? input.kind : '';
  const path = PLAYER_EXTRA_PATHS[kind];
  if (!path) return jsonObj({ error: 'bad-kind' }, 400);
  const key = `player-extra:${uid}:${kind}`;
  const hit = cacheGet(key);
  if (hit) return json(hit);
  const up = await upstreamGet(`${API}/players/${uid}/${path}`);
  if (!up.ok) return jsonObj({ error: 'upstream-' + up.status }, 502);
  cacheSet(key, up.body);
  return json(up.body);
}

async function handlePlayerSearch(input: Record<string, unknown>) {
  const query = typeof input.query === 'string' ? input.query.trim() : String(input.query ?? '').trim();
  if (!query || query.length > 64) return jsonObj({ error: 'bad-query' }, 400);
  const key = `player-search:${query}`;
  const hit = cacheGet(key);
  if (hit) return json(hit);
  const qs = new URLSearchParams({ playerName: query });
  const up = await upstreamGet(`${API}/players/search?${qs}`);
  if (!up.ok) return jsonObj({ error: 'upstream-' + up.status }, 502);
  cacheSet(key, up.body);
  return json(up.body);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonObj({ error: 'method-not-allowed' }, 405);
  let input: Record<string, unknown> = {};
  try {
    input = await req.json();
  } catch (_) {
    // empty body -> defaults
  }
  const action = typeof input.action === 'string' ? input.action : 'summary';
  try {
    if (action === 'detail') return await handleDetail(input);
    if (action === 'power-leaderboard') return await handlePowerLeaderboard(input);
    if (action === 'alliance') return await handleAlliance(input);
    if (action === 'player') return await handlePlayer(input);
    if (action === 'player-extra') return await handlePlayerExtra(input);
    if (action === 'player-search') return await handlePlayerSearch(input);
    return await handleSummary(input);
  } catch (_) {
    return jsonObj({ error: 'upstream-failed' }, 502);
  }
});
