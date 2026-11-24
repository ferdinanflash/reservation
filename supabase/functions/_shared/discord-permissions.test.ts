import { effectiveChannelPermissions } from "./discord-permissions.ts";

const GUILD = "10000000000000001";
const BOT = "20000000000000002";
const ROLE = "30000000000000003";

Deno.test("allows channel send permissions granted by a bot role", () => {
  const result = effectiveChannelPermissions(
    GUILD, BOT,
    [{ id: GUILD, permissions: "0" }, { id: ROLE, permissions: String((1n << 10n) | (1n << 11n) | (1n << 14n)) }],
    { roles: [ROLE] },
    [],
  );
  if (!result.allowed) throw new Error("Expected bot role permissions to allow sending");
});

Deno.test("applies role channel denies after base role permissions", () => {
  const result = effectiveChannelPermissions(
    GUILD, BOT,
    [{ id: GUILD, permissions: "0" }, { id: ROLE, permissions: String((1n << 10n) | (1n << 11n) | (1n << 14n)) }],
    { roles: [ROLE] },
    [{ id: ROLE, type: 0, allow: "0", deny: String(1n << 11n) }],
  );
  if (result.allowed || !result.missing.includes("Send Messages")) {
    throw new Error("Expected channel role deny to remove Send Messages");
  }
});

Deno.test("applies bot member overwrite after role overwrites", () => {
  const result = effectiveChannelPermissions(
    GUILD, BOT,
    [{ id: GUILD, permissions: "0" }, { id: ROLE, permissions: String((1n << 10n) | (1n << 11n) | (1n << 14n)) }],
    { roles: [ROLE] },
    [
      { id: ROLE, type: 0, allow: "0", deny: String(1n << 11n) },
      { id: BOT, type: 1, allow: String(1n << 11n), deny: "0" },
    ],
  );
  if (!result.allowed) throw new Error("Expected bot member overwrite to restore Send Messages");
});

Deno.test("administrator permission bypasses channel permission overwrites", () => {
  const result = effectiveChannelPermissions(
    GUILD, BOT,
    [{ id: GUILD, permissions: String(1n << 3n) }],
    { roles: [] },
    [{ id: GUILD, type: 0, allow: "0", deny: String((1n << 10n) | (1n << 11n) | (1n << 14n)) }],
  );
  if (!result.allowed || !result.administrator) {
    throw new Error("Expected Administrator to bypass channel overwrites");
  }
});

Deno.test("everyone overwrite can grant missing channel permissions", () => {
  const needed = (1n << 10n) | (1n << 11n) | (1n << 14n);
  const result = effectiveChannelPermissions(
    GUILD, BOT,
    [{ id: GUILD, permissions: "0" }],
    { roles: [] },
    [{ id: GUILD, type: 0, allow: String(needed), deny: "0" }],
  );
  if (!result.allowed) throw new Error("Expected @everyone channel overwrite to grant required permissions");
});

Deno.test("reports all required permissions when the bot has no grants", () => {
  const result = effectiveChannelPermissions(
    GUILD, BOT,
    [{ id: GUILD, permissions: "0" }],
    { roles: [] },
    [],
  );
  const expected = ["View Channel", "Send Messages", "Embed Links"];
  if (result.allowed || expected.some((permission) => !result.missing.includes(permission))) {
    throw new Error("Expected all missing channel permissions to be reported");
  }
});
