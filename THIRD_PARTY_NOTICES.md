# Third-Party Notices

This file records third-party software, libraries, fonts, and external assets identified in the **State 3475 — Whiteout Survival Management Portal** (`ferdinanflash/reservation`).

**Last updated:** 2026-11-18  
**Project license:** See [LICENSE](./LICENSE) and [LICENSE_ID.md](./LICENSE_ID.md). The project's proprietary license applies exclusively to original materials created by the Owner; all third-party components remain subject to their respective licenses.

> This is a best-effort inventory based on a source-tree review. It is not a legal opinion or a complete software bill of materials (SBOM). The repository does not include lockfiles for all runtimes, and some remotely served assets use floating versions. Transitive dependency versions and licenses therefore require a separate resolved-dependency scan before this list can be treated as exhaustive.

---

## 1. Third-Party Software & Libraries

| Component | Version / Reference | Location | License | Notes |
|---|---|---|---|---|
| `@supabase/supabase-js` | `@2` (CDN major tag; unpinned patch version) | `index.html`, `live/index.html` | MIT | Loaded via jsDelivr CDN. Exact resolved version may vary over time unless pinned. |
| `md5` | `2.3.0` | `supabase/functions/redeem-giftcode/index.ts` | BSD-3-Clause | Imported via `npm:md5@2.3.0`. |
| `web-push` | `3.6.7` | `supabase/functions/send-announcement/index.ts`, `supabase/functions/send-push-notification/index.ts` | MPL-2.0 | Imported via `npm:web-push@3.6.7` (unmodified library usage). |
| `@modelcontextprotocol/sdk` | `1.12.1` | `tools/codebase-memory-mcp/package.json` | MIT | Local development MCP tooling. |
| `zod` | `3.25.28` | `tools/codebase-memory-mcp/package.json` | MIT | Local development MCP tooling. |
| `@types/node` | `22.15.30` | `tools/codebase-memory-mcp/package.json` | MIT | Development TypeScript definitions. |
| `tsx` | `4.19.4` | `tools/codebase-memory-mcp/package.json` | MIT | Development TypeScript runner. |
| `typescript` | `5.8.3` | `tools/codebase-memory-mcp/package.json` | Apache-2.0 | Development TypeScript compiler. |

The listed licenses are based on the package metadata for the identified direct dependencies. This table does not represent a complete inventory of transitive dependencies.

### Notice Regarding `web-push` (MPL-2.0)

This project uses `web-push@3.6.7`, licensed under the **Mozilla Public License 2.0 (MPL-2.0)**. The library is used as an unmodified dependency. MPL-2.0 obligations apply to MPL-covered files and may include source-code availability and notice requirements when distributing covered software. Use of this library does not, by itself, place unrelated proprietary application source code under MPL-2.0.

Full license text: [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/)

### Scope of Dependency Review (GPL / Copyleft)

No direct GPL-licensed dependencies were identified in the inspected source files and package manifests. However, this is not a guarantee that no GPL-licensed code exists in the complete transitive dependency tree or externally loaded resources, such as unpinned CDN scripts. No direct AGPL- or LGPL-licensed dependency was identified in the reviewed declarations either.

---

## 2. Fonts

| Asset | Location | License | Copyright & Attribution |
|---|---|---|---|
| `fonts/creepster-halloween.woff2` | `style.css` | SIL Open Font License 1.1 (OFL-1.1) | Copyright (c) 2011, Font Diner, Inc, with Reserved Font Names "Creepster". See the repository copy of the [Creepster OFL license](./fonts/Creepster-OFL.txt). |

The repository already contains the accompanying OFL text at [fonts/Creepster-OFL.txt](./fonts/Creepster-OFL.txt). Its copyright notice is reproduced as present in that license file; it identifies **Font Diner, Inc** and the Reserved Font Name **"Creepster"**. The exact binary's provenance should still be retained/verified against the original font source.

System fallback font stacks (such as Segoe UI, Tahoma, Georgia, Times New Roman, and Courier New) rely on the end user's operating system and are not bundled in this repository.

---

## 3. Graphics, Brand Marks & External Services

- **Project Graphics & Assets:** Original UI graphics and SVG assets created specifically for this project are owned by the Owner and covered by the project's proprietary license. Third-party images, icons, and other visual assets remain subject to their respective licenses. Asset provenance and licensing should be verified individually.
- **Third-Party Trademarks & Brand Assets:**
  - The Discord logo mark (`index.html`) is the property of Discord Inc. and is used for community integration purposes in accordance with [Discord Brand Guidelines](https://discord.com/branding). Its use does not imply endorsement.
  - Any game-related terms, icons, or visual references associated with *Whiteout Survival* remain subject to the applicable rights and trademarks of Century Games.
- **External APIs & Services:** Integrations with Supabase, Discord, Whiteout Survival endpoints, and WoS Atlas are governed by each respective provider's terms and policies. These integrations do not mean the providers' server-side software is bundled in this repository.

---

## 4. Audit Limitations & Follow-up

For a more complete release-grade audit:

1. Generate and commit resolved lockfiles for the Node/MCP tool and Deno/Supabase Edge Functions, where supported.
2. Run a license scanner against fully resolved dependency trees, including transitive dependencies, and review any `UNKNOWN`, dual-licensed, or copyleft results.
3. Consider pinning the Supabase JS CDN dependency to an exact version after confirming the version currently in use.
4. Verify the provenance of every local font, SVG, icon, and image; add applicable license/attribution files or replace assets without clear rights.
5. Re-run this inventory whenever dependencies or third-party assets change.

---

This notice is provided for informational and compliance purposes. It does not grant any additional rights to the proprietary source code of this repository and does not replace the license terms supplied by each third-party author.
