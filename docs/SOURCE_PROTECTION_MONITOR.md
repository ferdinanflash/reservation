# 3475 Source Protection Monitor

Automated daily searches for distinctive code fingerprints from
[3475.web.id](https://3475.web.id) and
[ferdinanflash/reservation](https://github.com/ferdinanflash/reservation).

## What it does

- Searches GitHub's public code index for five distinctive source fingerprints.
- Groups matches by external repository.
- Flags a review candidate only when at least **two different fingerprints**
  appear in the same external repository.
- Writes a Markdown report and uploads it as a workflow artifact (90-day retention).
- Opens one GitHub issue when candidates are found; an existing open alert is
  reused to avoid duplicate issues.
- Runs daily at 03:17 UTC (10:17 WIB) and can also be started manually.

## One-time setup

GitHub requires authentication for code search.

1. Create a GitHub personal access token for code search. GitHub's fine-grained
   token documentation lists the Search code endpoint as requiring no repository
   permissions; the token is still required to search across public repositories.
   Prefer a fine-grained token. Avoid granting write access.
2. In this repository, open **Settings → Secrets and variables → Actions**.
3. Add a repository secret named **CODE_SEARCH_TOKEN** containing that token.
4. Ensure GitHub Actions are enabled.
5. Open **Actions → 3475 Source Protection Monitor → Run workflow** to test it.

GitHub limits authenticated code-search requests to 10 per minute; this workflow
makes five fingerprint queries per run. See the [GitHub search API documentation](https://docs.github.com/en/rest/search/search).

The workflow's built-in GITHUB_TOKEN opens an issue in this repository when
potential matches are found. Its permissions are limited to contents: read
and issues: write. Never paste a token into source files or commit it.

## Reading results

- Open the workflow run under **Actions**.
- Read the job summary for the current scan.
- Download the 3475-source-protection-report artifact for the full report.
- If at least two independent fingerprints match one repository, an issue titled
  [Source Monitor] Potential 3475 code reuse detected is opened.

A single fingerprint is intentionally not enough to trigger an alert. Common
code, copied comments, and the ownership watermark alone can produce false
positives. Review the linked files and repository history before taking action.

## Fingerprints

The monitored signatures are maintained in
[config/source-fingerprints.json](../config/source-fingerprints.json).
Update them when distinctive project functionality changes. Prefer uncommon
function names, configuration keys, and code phrases over generic markup,
library names, or boilerplate.

## Important limitations

- This searches GitHub's indexed **public code** only. Private repositories,
  unindexed repositories, other hosting services, and heavily rewritten copies
  may not appear.
- GitHub code search may return incomplete results, rate-limit requests, or
  change indexing behavior. A scan with search errors is marked incomplete.
- GitHub does not reveal who cloned or downloaded a public repository.
- A match is an investigative lead, not proof of an ownership violation.
  Verify context, dates, repository history, and third-party license obligations
  before contacting anyone or filing a takedown request.
- This tool does not block copying or modify the live 3475 website.
