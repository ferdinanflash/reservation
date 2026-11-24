// Resolve effective bot permissions for a Discord text/announcement channel.
// Uses Discord's guild roles, bot membership and channel overwrites; no message is sent.
const API = "https://discord.com/api/v10";
const VIEW_CHANNEL = 1n << 10n;
const SEND_MESSAGES = 1n << 11n;
const EMBED_LINKS = 1n << 14n;
const MENTION_EVERYONE = 1n << 17n;
const ADMINISTRATOR = 1n << 3n;

function has(bits: bigint, permission: bigint) { return (bits & permission) === permission; }

export function effectiveChannelPermissions(
  guildId: string,
  botUserId: string,
  roles: Array<{ id: string; permissions: string }>,
  member: { roles?: string[] },
  overwrites: Array<{ id: string; type: number; allow: string; deny: string }>,
) {
  const roleIds = new Set([guildId, ...(member.roles ?? [])]);
  let permissions = 0n;
  for (const role of roles) {
    if (roleIds.has(String(role.id))) permissions |= BigInt(role.permissions || "0");
  }
  const missing: string[] = [];
  if (has(permissions, ADMINISTRATOR)) {
    return { allowed: true, missing, permissions: permissions.toString(), administrator: true };
  }

  const everyone = overwrites.find((item) => item.type === 0 && item.id === guildId);
  if (everyone) permissions = (permissions & ~BigInt(everyone.deny || "0")) | BigInt(everyone.allow || "0");

  let roleDeny = 0n, roleAllow = 0n;
  for (const overwrite of overwrites) {
    if (overwrite.type !== 0 || overwrite.id === guildId || !roleIds.has(overwrite.id)) continue;
    roleDeny |= BigInt(overwrite.deny || "0");
    roleAllow |= BigInt(overwrite.allow || "0");
  }
  permissions = (permissions & ~roleDeny) | roleAllow;

  const memberOverwrite = overwrites.find((item) => item.type === 1 && item.id === botUserId);
  if (memberOverwrite) {
    permissions = (permissions & ~BigInt(memberOverwrite.deny || "0")) | BigInt(memberOverwrite.allow || "0");
  }

  if (!has(permissions, VIEW_CHANNEL)) missing.push("View Channel");
  if (!has(permissions, SEND_MESSAGES)) missing.push("Send Messages");
  if (!has(permissions, EMBED_LINKS)) missing.push("Embed Links");
  return { allowed: missing.length === 0, missing, permissions: permissions.toString(), administrator: false };
}

export async function checkDiscordChannelPermissions(
  token: string,
  guildId: string,
  channelId: string,
  requireMentionEveryone = false,
) {
  const headers = { Authorization: `Bot ${token}` };
  const get = async (path: string) => {
    const response = await fetch(`${API}${path}`, { headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`discord_${response.status}`);
    return data;
  };
  const [bot, guild, channel] = await Promise.all([
    get("/users/@me"),
    get(`/guilds/${guildId}/roles`),
    get(`/channels/${channelId}`),
  ]);
  if (String(channel.guild_id ?? "") !== guildId) {
    return { allowed: false, missing: ["Channel belongs to another server"] };
  }
  const member = await get(`/guilds/${guildId}/members/${bot.id}`);
  const result = effectiveChannelPermissions(
    guildId, String(bot.id), Array.isArray(guild) ? guild : [], member,
    Array.isArray(channel.permission_overwrites) ? channel.permission_overwrites : [],
  );
  if (requireMentionEveryone && !result.administrator && !has(BigInt(result.permissions ?? "0"), MENTION_EVERYONE)) {
    result.missing.push("Mention @everyone, @here, and All Roles");
    result.allowed = false;
  }
  return result;
}
