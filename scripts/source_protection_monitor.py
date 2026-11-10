#!/usr/bin/env python3
"""Search public GitHub code for distinctive 3475 source fingerprints.

Requires CODE_SEARCH_TOKEN. Matches are investigative leads, not proof.
"""
from __future__ import annotations
import json, os, sys, urllib.error, urllib.parse, urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / "config/source-fingerprints.json").read_text(encoding="utf-8"))
OWNER, REPO = CONFIG["owner"], CONFIG["repository"]
TOKEN = os.environ.get("CODE_SEARCH_TOKEN", "").strip()
ISSUE_TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
API = "https://api.github.com"
BASE_HEADERS = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "3475-Source-Protection-Monitor",
}

def request_json(url, method="GET", payload=None, token=None):
    headers = dict(BASE_HEADERS)
    auth = token or TOKEN
    if auth:
        headers["Authorization"] = "Bearer " + auth
    data = json.dumps(payload).encode() if payload is not None else None
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as response:
        raw = response.read()
        return json.loads(raw.decode("utf-8")) if raw else {}

def main():
    if not TOKEN:
        print("ERROR: CODE_SEARCH_TOKEN is missing. Follow docs/SOURCE_PROTECTION_MONITOR.md.")
        return 2

    hits = defaultdict(lambda: {"fingerprints": set(), "matches": set(), "fork": False})
    errors = []
    for fp in CONFIG["fingerprints"]:
        query = urllib.parse.quote(fp["query"] + " in:file")
        try:
            result = request_json(f"{API}/search/code?q={query}&per_page=100")
            for item in result.get("items", []):
                repo = item.get("repository", {})
                name = repo.get("full_name", "")
                if not name or name.lower() == f"{OWNER}/{REPO}".lower():
                    continue
                entry = hits[name]
                entry["fingerprints"].add(fp["id"])
                entry["matches"].add((item.get("path", ""), item.get("html_url", "")))
                entry["fork"] = bool(repo.get("fork", False))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")[:400]
            errors.append(f"{fp['id']}: HTTP {exc.code} — {detail}")
        except Exception as exc:
            errors.append(f"{fp['id']}: {type(exc).__name__}: {exc}")

    candidates = [(name, data) for name, data in hits.items() if len(data["fingerprints"]) >= 2]
    candidates.sort(key=lambda item: (-len(item[1]["fingerprints"]), item[0].lower()))
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "# 3475 Source Protection Monitor", "",
        f"- Scan time: {now}",
        f"- Source: https://github.com/{OWNER}/{REPO}",
        f"- Fingerprints searched: {len(CONFIG['fingerprints'])}",
        f"- Candidate repositories (2+ distinct fingerprints): {len(candidates)}", "",
        "> Matches are leads for manual review, not proof of copying or infringement.", ""
    ]
    if candidates:
        lines += ["## Repositories requiring review", ""]
        for name, data in candidates:
            lines += [
                f"### [{name}](https://github.com/{name})",
                f"- Matched fingerprints: {len(data['fingerprints'])}",
                f"- Fork reported by GitHub: {'Yes' if data['fork'] else 'No'}",
                "- Fingerprints: " + ", ".join(sorted(data["fingerprints"])),
                "- Matching files:"
            ]
            lines += [f"  - [{path}]({url})" if url else f"  - {path}" for path, url in sorted(data["matches"])]
            lines.append("")
    else:
        lines += ["## No multi-fingerprint candidates found", "",
                  "No external repository matched at least two distinct fingerprints.", ""]
    if errors:
        lines += ["## Search errors / incomplete checks", ""]
        lines += [f"- {error}" for error in errors]
        lines += ["", "An incomplete scan is not a clean scan.", ""]

    report = ROOT / "source-protection-report.md"
    report.write_text("\n".join(lines), encoding="utf-8")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as handle:
            handle.write("\n".join(lines) + "\n")

    if candidates and ISSUE_TOKEN:
        title = "[Source Monitor] Potential 3475 code reuse detected"
        try:
            existing = request_json(f"{API}/repos/{OWNER}/{REPO}/issues?state=open&per_page=100", token=ISSUE_TOKEN)
            if not any(x.get("title") == title and "pull_request" not in x for x in existing):
                request_json(f"{API}/repos/{OWNER}/{REPO}/issues", method="POST",
                             payload={"title": title, "body": "\n".join(lines) + "\n\nReview manually before drawing conclusions."},
                             token=ISSUE_TOKEN)
        except Exception as exc:
            print(f"WARNING: could not create alert issue: {exc}")

    print(f"Scan complete: {len(candidates)} candidate repositories; {len(errors)} search errors.")
    return 1 if errors else 0

if __name__ == "__main__":
    sys.exit(main())
