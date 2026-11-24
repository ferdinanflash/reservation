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
