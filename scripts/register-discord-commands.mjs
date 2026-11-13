#!/usr/bin/env node
/*
 * 3475 SOURCE OWNERSHIP
 * Copyright (c) 2026 Ferdinan | https://3475.web.id
 * Proprietary source code. All rights reserved. Unauthorized reuse is prohibited.
 *
 * Register the 3475 /redeem slash command.
 * Required: DISCORD_BOT_TOKEN
 * Optional: DISCORD_APPLICATION_ID, DISCORD_GUILD_ID
 */

const token = process.env.DISCORD_BOT_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID || "1570932450849333450";
const guildId = process.env.DISCORD_GUILD_ID;

if (!token) {
  console.error("Missing DISCORD_BOT_TOKEN. Set it locally; never commit the token.");
  process.exit(1);
}

const command = {
  name: "redeem",
  description: "Redeem gift codes for a player or an entire alliance",
  options: [
    {
      type: 1,
      name: "single",
      description: "Redeem a gift code for one Player ID",
      options: [
        {
          type: 3,
          name: "fid",
          description: "Whiteout Survival Player ID (FID)",
          required: true,
          min_length: 4,
          max_length: 20,
        },
        {
          type: 3,
          name: "code",
          description: "Gift Code",
          required: true,
          min_length: 1,
          max_length: 40,
        },
      ],
    },
    {
      type: 1,
      name: "alliance",
      description: "Redeem a gift code for all members of an alliance",
      options: [
        {
          type: 3,
          name: "alliance",
          description: "Choose the alliance",
          required: true,
          choices: ["ARX", "IDN", "ZXC", "VNX", "CAT"].map((code) => ({ name: code, value: code })),
        },
        {
          type: 3,
          name: "code",
          description: "Gift Code",
          required: true,
          min_length: 1,
          max_length: 40,
        },
      ],
    },
  ],
};

const endpoint = guildId
  ? `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`
  : `https://discord.com/api/v10/applications/${applicationId}/commands`;

const response = await fetch(endpoint, {
  method: "PUT",
  headers: {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify([command]),
});

const body = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error("Discord command registration failed:", response.status, body);
  process.exit(1);
}
console.log(`Registered /redeem with single and alliance subcommands for application ${applicationId}.`);
console.log(guildId ? `Guild scope: ${guildId}` : "Global scope: command propagation can take some time.");
