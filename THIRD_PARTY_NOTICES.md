# Third-Party Notices

This file records third-party software and assets identified during a source-tree review of the State 3475 / Reservation repository.

**Audit date:** 2026-11-18  
**Repository:** https://github.com/ferdinanflash/reservation  
**Project license:** See [LICENSE](./LICENSE) and [LICENSE_ID.md](./LICENSE_ID.md). The project's proprietary license applies only to original project materials; third-party materials remain under their respective licenses.

> This is a best-effort inventory based on the files and dependency manifests present in this repository. It is not a legal opinion or a complete software bill of materials (SBOM). The repository does not currently include lockfiles for all runtimes, and some remotely served assets use floating versions. Transitive dependency versions and licenses therefore require a separate resolved-dependency scan before this list can be treated as exhaustive.

## 1. Third-party software

| Component | Version / reference | Where used | License | Notes |
|---|---|---|---|---|
| Supabase JavaScript client (`@supabase/supabase-js`) | CDN URL `@2` (major range; exact version is not pinned) | `index.html`, `live/index.html` | MIT | Served from jsDelivr. The CDN URL can resolve to a newer v2 release over time. |
| `md5` | `2.3.0` | `supabase/functions/redeem-giftcode/index.ts` | BSD-3-Clause | Imported using `npm:md5@2.3.0`. |
| `web-push` | `3.6.7` | `supabase/functions/send-announcement/index.ts`, `supabase/functions/send-push-notification/index.ts` | MPL-2.0 | Imported using `npm:web-push@3.6.7`. This is a file-level copyleft license, not MIT or GPL. Review the MPL terms if modifying or redistributing covered source files. |
| Model Context Protocol TypeScript SDK (`@modelcontextprotocol/sdk`) | `1.12.1` | `tools/codebase-memory-mcp/package.json` | MIT | Development/local codebase-memory MCP tool. |
| `zod` | `3.25.28` | `tools/codebase-memory-mcp/package.json` | MIT | Runtime dependency of the local MCP tool. |
| `@types/node` | `22.15.30` | `tools/codebase-memory-mcp/package.json` | MIT | Development dependency; TypeScript definitions. |
| `tsx` | `4.19.4` | `tools/codebase-memory-mcp/package.json` | MIT | Development dependency / TypeScript execution. |
| `typescript` | `5.8.3` | `tools/codebase-memory-mcp/package.json` | Apache-2.0 | Development dependency / compiler. |

The package metadata for the above components identifies the listed SPDX licenses. Where practical, include the original package license text when distributing a bundled copy of the relevant package; this repository currently consumes most of these packages through package/CDN or runtime dependency resolution rather than vendoring their source.

### Important MPL-2.0 notice: web-push

The two Edge Functions listed above import `web-push@3.6.7`, whose package metadata declares **MPL-2.0**. MPL-2.0 is not GPL and does not automatically relicense the whole Reservation project. Its obligations can apply to modifications of MPL-covered files when those files are distributed. Keep the upstream copyright and license notices with any redistributed copy of the library, and review the MPL-2.0 text before distributing modified library files.

Upstream license: https://github.com/web-push-libs/web-push/blob/master/LICENSE

## 2. Font assets

| Asset | Where used | Identified license | Notes |
|---|---|---|---|
| `fonts/creepster-halloween.woff2` (Creepster font family) | `style.css` | SIL Open Font License 1.1 (OFL-1.1), based on the identified Google Fonts family | The repository contains the font binary but no accompanying OFL text or font provenance record. Confirm that this exact binary was obtained from the official Creepster release, then add the matching OFL license text and attribution/Reserved Font Name information if applicable. |

Font family information: https://fonts.google.com/specimen/Creepster  
OFL text: https://openfontlicense.org/

## 3. Inline graphics, icons, and images

- The language flags in `style.css` are embedded as inline SVG data URIs. No external icon package was identified for these flags in the inspected stylesheet.
- The Discord mark in `index.html` is embedded as inline SVG path data. It is a third-party brand/logo asset; follow Discord's brand guidelines and do not imply endorsement.
- `icon-src.svg`, `images/check.svg`, and the repository's banner/background/image files are present as local assets. Their original authorship and source licenses could not be established from the inspected source tree. Do not assume they are covered by the project's proprietary license; record the source and license for each asset or replace it with an original/appropriately licensed asset.
- System fonts such as Segoe UI, Tahoma, Georgia, Times New Roman, and Courier New are referenced as local operating-system font stacks; no font files for those families were found in the repository during this review.

## 4. Services and APIs (not bundled libraries)

The source references services and APIs including Supabase, Discord, Whiteout Survival gift-code endpoints, and WoS Atlas. These are service/API integrations, not evidence that their server-side software is bundled into this repository. Their API terms, trademarks, game content, and service terms are separate from the open-source software licenses listed above.

## 5. GPL / copyleft findings

- No direct GPL-licensed dependency or GPL import was identified in the inspected source files and the checked-in dependency manifest.
- The identified copyleft dependency is `web-push@3.6.7` under **MPL-2.0**.
- This finding does **not** prove that no GPL code exists anywhere in the full dependency closure: the repository has no lockfile for the MCP npm dependencies or the Deno/npm imports, and the Supabase CDN dependency is not pinned to an exact patch version.
- No dependency was identified as AGPL or LGPL in the reviewed direct dependency declarations.

## 6. Audit limitations and follow-up

To complete a release-grade audit:

1. Generate and commit resolved lockfiles for the Node/MCP tool and Deno/Supabase Edge Functions (where supported).
2. Run a license scanner against the fully resolved dependency trees, including all transitive dependencies, and review any `UNKNOWN`, dual-licensed, or copyleft results.
3. Pin the Supabase JS CDN dependency to an exact version and scan that resolved package tree.
4. Verify the provenance of every local font, SVG, icon, and image; add the applicable license/attribution files or replace assets without clear rights.
5. Add the full OFL-1.1 text for the exact Creepster font binary if its official provenance is confirmed.
6. Re-run this inventory whenever dependencies or third-party assets change.

---

This notice is informational. It does not grant additional rights to the Reservation project's original proprietary source code and does not replace the license terms supplied by each third-party author.
