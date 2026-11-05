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
  try {
    const res = await fetch(`${SITE}${path}`, {
      headers: { accept: 'application/json', 'user-agent': UA },
    });
    if (!res.ok) return null;
    return JSON.parse(await res.text());
  } catch (_) {
    return null;
  }
}

/** Build detail payload from public wosatlas.com endpoints (no API key). */
async function detailFromPublicSite(kid: number, allianceLimit: number, playerLimit: number) {
  const server = await siteGet(`/servers/${kid}`);
  if (!server) return null;

  const rollup = server.rollup || {};
  const playerCount = Number(rollup.players) || null;
  const totalPower = Number(rollup.player_power) || null;

  let kingObj: { uid: any; nick_name: string | null; name: string | null } | null = null;
  const role = Array.isArray(server.roles)
    ? server.roles.find((r: any) => r && (r.role === 'king' || r.role === 'president'))
    : null;
  if (role && role.uid) {
    let nick: string | null = null;
    try {
      const p = await siteGet(`/players/${role.uid}`);
      if (p && (p.name || p.nick_name)) nick = String(p.name || p.nick_name);
    } catch (_) { /* ignore */ }
    kingObj = { uid: role.uid, nick_name: nick, name: nick };
  }

  let allianceItems: any[] = [];
  try {
    const raw = await siteGet(`/servers/${kid}/alliances?sort=power&limit=${allianceLimit}`);
    if (raw && Array.isArray(raw.items)) allianceItems = raw.items;
    else if (Array.isArray(raw)) allianceItems = raw;
  } catch (_) { /* ignore */ }

  const players: any[] = [];
  const seen = new Set<string>();
  for (const a of allianceItems.slice(0, 8)) {
    const aid = a.alliance_id || a.aid || a.id;
    if (!aid) continue;
    try {
      const mem = await siteGet(`/alliances/${aid}/members`);
      const list = (mem && Array.isArray(mem.items)) ? mem.items
        : (mem && Array.isArray(mem.members)) ? mem.members
        : Array.isArray(mem) ? mem : [];
      for (const m of list) {
        const uid = String(m.uid || m.playerUid || '');
        if (!uid || seen.has(uid)) continue;
        seen.add(uid);
        players.push({
          uid: m.uid,
          nick_name: m.nick_name || m.nickname || m.name || null,
          power: m.power || 0,
          stove_lv: m.stove_lv || m.stove || null,
          rank: players.length + 1,
        });
      }
    } catch (_) { /* ignore */ }
  }
  players.sort((a, b) => (Number(b.power) || 0) - (Number(a.power) || 0));
  const topPlayers = players.slice(0, playerLimit).map((p, i) => ({ ...p, rank: i + 1 }));

  if (kingObj && kingObj.uid && !kingObj.nick_name) {
    const hit = topPlayers.find((p) => String(p.uid) === String(kingObj!.uid));
    if (hit && hit.nick_name) {
      kingObj.nick_name = String(hit.nick_name);
      kingObj.name = kingObj.nick_name;
    }
  }

  const state = {
    server_id: server.server_id ?? String(kid),
    chiefs: playerCount,
    total_power: totalPower,
    alliance_count: Number(rollup.alliances) || allianceItems.length || null,
    king: kingObj,
    refreshed_at: rollup.refreshed_at ?? null,
    roles: server.roles || null,
  };
  const power = {
    player_count: playerCount,
    total_power: totalPower,
    top: topPlayers,
  };
  const alliances = {
    entries: allianceItems.slice(0, allianceLimit).map((a: any) => ({
      ...a,
      aid: Number(a.alliance_id || a.aid || a.id) || 0,
      abbr: a.tag || a.abbr,
      members: a.member_count || a.members,
      memberMax: a.max_members || a.memberMax,
      totalPower: a.power || a.total_power || a.totalPower,
    })),
  };
  return { state, power, alliances, players: topPlayers, kid, source: 'public-site' };
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

  let state: any = null;
  let power: any = null;
  let alliances: any = null;
  let players: any[] = [];
  let results: Array<{ ok: true; body: string } | { ok: false; status: number }> = [];

  if (API_KEY) {
    const urls = [
      `${API}/states/${kid}`,
      `${API}/kingdoms/${kid}/power`,
      `${API}/alliances/leaderboard?limit=${allianceLimit}&kid=${kid}`,
      `${API}/power/leaderboard?kid=${kid}&limit=${playerLimit}`,
    ];
    results = await Promise.all(
      urls.map(async (url) => {
        try {
          return await upstreamGet(url);
        } catch (_) {
          return { ok: false as const, status: 0 };
        }
      }),
    );

    const parse = (r: { ok: true; body: string } | { ok: false; status: number }) => {
      if (!r.ok) return null;
      try {
        return JSON.parse(r.body);
      } catch (_) {
        return null;
      }
    };

    state = parse(results[0]);
    power = parse(results[1]);
    alliances = parse(results[2]);
    const leaderboard = parse(results[3]);

    if (leaderboard && Array.isArray(leaderboard.entries) && leaderboard.entries.length) {
      players = leaderboard.entries;
    } else if (power && Array.isArray(power.top) && power.top.length) {
      players = power.top;
    }
  }

  // Public-site fallback when no API key, or keyed API returned nothing useful
  if (!state && !power && !alliances && !players.length) {
    const pub = await detailFromPublicSite(kid, allianceLimit, playerLimit);
    if (pub) {
      const payload = JSON.stringify(pub);
      cacheSet(key, payload);
      return json(payload);
    }
    const statuses = results.map((r) => (r.ok ? 200 : r.status));
    const any401 = statuses.some((s) => s === 401);
    if (any401 || !API_KEY) {
      return jsonObj({
        error: 'upstream-401',
        message: API_KEY
          ? 'WoS Atlas rejected the API key (invalid or revoked).'
          : 'WOSATLAS_API_KEY secret is not set, and public-site fallback also failed.',
      }, 502);
    }
    return jsonObj({ error: 'upstream-failed', statuses }, 502);
  }

  let powerOut = power;
  if (power && players.length) {
    powerOut = { ...power, top: players };
  }

  if (state && typeof state === 'object') {
    let kingUid: any = null;
    let existingName: string | null = null;

    if (state.king && typeof state.king === 'object') {
      kingUid = state.king.uid || state.king.playerUid || state.king.id || null;
      existingName = state.king.nick_name || state.king.name || null;
    }
    if (!kingUid && Array.isArray(state.roles)) {
      const role = state.roles.find(
        (r: any) => r && (r.role === 'king' || r.role === 'president'),
      );
      if (role) kingUid = role.uid || role.playerUid || null;
    }

    if (!kingUid) {
      try {
        const server = await siteGet(`/servers/${kid}`);
        if (server && Array.isArray(server.roles)) {
          const role = server.roles.find(
            (r: any) => r && (r.role === 'king' || r.role === 'president'),
          );
          if (role) kingUid = role.uid || role.playerUid || null;
        }
      } catch (_) { /* ignore */ }
    }

    if (kingUid) {
      let nick: string | null = existingName ? String(existingName) : null;

      if (!nick && players.length) {
        const hit = players.find(
          (p: any) => p && String(p.uid || p.playerUid || '') === String(kingUid),
        );
        if (hit) {
          nick = hit.nick_name || hit.nickname || hit.nickName || hit.name || null;
          if (nick) nick = String(nick);
        }
      }

      if (!nick) {
        try {
          if (API_KEY) {
            const up = await upstreamGet(`${API}/players/${kingUid}`);
            if (up.ok) {
              const p = JSON.parse(up.body);
              nick = (p && (p.name || p.nick_name || p.nickname)) ? String(p.name || p.nick_name || p.nickname) : null;
            }
          }
          if (!nick) {
            const p = await siteGet(`/players/${kingUid}`);
            if (p && (p.name || p.nick_name)) nick = String(p.name || p.nick_name);
          }
        } catch (_) { /* ignore */ }
      }

      state = {
        ...state,
        king: {
          uid: kingUid,
          nick_name: nick,
          name: nick,
        },
      };
    }
  }

  const payload = JSON.stringify({
    state,
    power: powerOut,
    alliances,
    players,
    kid,
  });
  cacheSet(key, payload);
  return json(payload);
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
  const up = await upstreamGet(`${API}/power/leaderboard?kid=${kid}&limit=${limit}`);
  if (!up.ok) return jsonObj({ error: 'upstream-' + up.status }, 502);
  cacheSet(key, up.body);
  return json(up.body);
}

async function handleAlliance(input: Record<string, unknown>) {
  const aid = Math.trunc(Number(input.aid));
  if (!Number.isFinite(aid) || aid < 1) return jsonObj({ error: 'bad-aid' }, 400);
  const key = `alliance:${aid}`;
  const hit = cacheGet(key);
  if (hit) return json(hit);

  // --- Keyed API path ---
  if (API_KEY) {
    // Prefer full alliance object if available; members is always useful.
    const [infoUp, memUp] = await Promise.all([
      upstreamGet(`${API}/alliances/${aid}`).catch(() => ({ ok: false as const, status: 0 })),
      upstreamGet(`${API}/alliances/${aid}/members`).catch(() => ({ ok: false as const, status: 0 })),
    ]);
    let info: any = null;
    let membersRaw: any = null;
    if (infoUp.ok) {
      try { info = JSON.parse(infoUp.body); } catch (_) { /* ignore */ }
    }
    if (memUp.ok) {
      try { membersRaw = JSON.parse(memUp.body); } catch (_) { /* ignore */ }
    }

    let membersList: any[] = [];
    if (membersRaw) {
      if (Array.isArray(membersRaw.members)) membersList = membersRaw.members;
      else if (Array.isArray(membersRaw.items)) membersList = membersRaw.items;
      else if (Array.isArray(membersRaw)) membersList = membersRaw;
      else if (Array.isArray(membersRaw.entries)) membersList = membersRaw.entries;
    }

    if (info || membersList.length) {
      const payload = normalizeAlliancePayload(aid, info, membersList, membersRaw);
      const body = JSON.stringify(payload);
      cacheSet(key, body);
      return json(body);
    }
  }

  // --- Public site fallback (no API key / keyed path failed) ---
  const pub = await allianceFromPublicSite(aid);
  if (pub) {
    const body = JSON.stringify(pub);
    cacheSet(key, body);
    return json(body);
  }

  return jsonObj({
    error: 'upstream-failed',
    message: API_KEY
      ? 'Could not load alliance from WoS Atlas API.'
      : 'Could not load alliance (no API key; public-site fallback failed).',
  }, 502);
}

function normalizeAlliancePayload(aid: number, info: any, membersList: any[], membersRaw?: any) {
  const src = info || membersRaw || {};
  const members = membersList.map((m: any, i: number) => ({
    uid: m.uid || m.playerUid || m.id,
    nick_name: m.nick_name || m.nickname || m.name || null,
    power: m.power || m.total_power || 0,
    stove_lv: m.stove_lv || m.stoveLv || m.stove || null,
    rank: m.rank || i + 1,
  }));
  members.sort((a, b) => (Number(b.power) || 0) - (Number(a.power) || 0));

  return {
    aid,
    abbr: src.abbr || src.tag || src.alliance_tag || '',
    name: src.name || src.alliance_name || '',
    memberCount: Number(src.memberCount || src.member_count || src.members || members.length) || members.length,
    memberMax: Number(src.memberMax || src.max_members || src.member_max) || 0,
    serverPower: Number(src.serverPower || src.total_power || src.power || src.totalPower) || 0,
    totalPower: Number(src.totalPower || src.total_power || src.power || src.serverPower) || 0,
    serverPowerRank: Number(src.serverPowerRank || src.power_rank || src.powerRank) || null,
    powerRank: Number(src.powerRank || src.power_rank || src.serverPowerRank) || null,
    rankedAlliances: Number(src.rankedAlliances || src.ranked_alliances) || null,
    leaderUid: Number(src.leaderUid || src.leader_uid || src.owner_uid) || 0,
    leaderName: src.leaderName || src.leader_name || src.owner_name || '',
    lv: Number(src.lv || src.level || src.alliance_level) || 0,
    joinMinLevel: Number(src.joinMinLevel || src.join_min_level || src.min_level) || 0,
    joinMinPower: Number(src.joinMinPower || src.join_min_power || src.min_power) || 0,
    publicRecruit: !!(src.publicRecruit || src.public_recruit),
    homeKid: Number(src.homeKid || src.kid || src.server_id) || null,
    honorLevel: Number(src.honorLevel || src.honor_level) || null,
    notice: src.notice || '',
    manifesto: src.manifesto || '',
    members,
    memberList: members,
    players: members,
    source: info ? 'api' : 'api-members',
  };
}

async function allianceFromPublicSite(aid: number) {
  // Public site: members list is the reliable endpoint.
  const mem = await siteGet(`/alliances/${aid}/members`);
  let membersList: any[] = [];
  if (mem) {
    if (Array.isArray(mem.items)) membersList = mem.items;
    else if (Array.isArray(mem.members)) membersList = mem.members;
    else if (Array.isArray(mem)) membersList = mem;
  }

  // Try alliance meta if exposed
  let info: any = null;
  try {
    info = await siteGet(`/alliances/${aid}`);
  } catch (_) { /* ignore */ }

  // Some public responses put alliance fields on the members payload root
  if (!info && mem && typeof mem === 'object' && !Array.isArray(mem)) {
    if (mem.tag || mem.abbr || mem.name || mem.alliance_name) info = mem;
  }

  if (!info && !membersList.length) return null;

  const payload = normalizeAlliancePayload(aid, info, membersList, mem);
  payload.source = 'public-site';

  // Derive power/count from members when meta missing
  if (!payload.serverPower && membersList.length) {
    payload.serverPower = membersList.reduce((s: number, m: any) => s + (Number(m.power) || 0), 0);
    payload.totalPower = payload.serverPower;
  }
  if (!payload.memberCount) payload.memberCount = membersList.length;

  // Leader: first by power if not provided
  if (!payload.leaderUid && payload.members && payload.members.length) {
    const top = payload.members[0];
    payload.leaderUid = Number(top.uid) || 0;
    payload.leaderName = top.nick_name || '';
  }

  return payload;
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
