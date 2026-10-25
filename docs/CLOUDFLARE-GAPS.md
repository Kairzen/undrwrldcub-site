# Cloudflare gaps: findings and proposed fixes (2026-10-25)

Read-only audit of the two Cloudflare accounts as they relate to this site and its sibling repos.
Nothing in Cloudflare or on any `main` branch was changed while producing this document.
Commands are Windows PowerShell 5.1; run them from the repo named in each section.

Accounts in this document: **gmail account** = `undrwrldcub@gmail.com` (hosts this site, `forever-wiki`, D1 `riftbound` /
`pf2econtent` / `wowforever`); **undrwrldcub.com account** = `wess@undrwrldcub.com` (hosts `wessanford-*` and D1 `records-*`).

---

## 1. `undrwrldcub.com` is deployed twice (Pages project + Worker)

### Findings
- The Cloudflare API lists the custom domains `undrwrldcub.com` and `www.undrwrldcub.com` as attached to Worker
  **`undrwrldcub-home`** (production). The Pages project **`undrwrldcub-site`** owns only `undrwrldcub-site.pages.dev`.
- So the Worker serves the live site. The `wrangler.jsonc` comment "the apex custom domain is added in a second step,
  after it is removed from the old Pages project" is stale: that step was done. `README.md` and `CLAUDE.md` are already correct.
- The Pages project is still git-connected (production branch `main`, previews on every branch, PR comments on) and
  built the last five pushes, most recently 2026-10-25 20:15 UTC. It costs nothing but doubles every build and keeps
  a second public copy of the site at `undrwrldcub-site.pages.dev`.
- Precedent: `wow-forever-wiki` went through the same move; its Pages project is already gone (`wrangler pages project list`
  shows only `undrwrldcub-site`).
- Side effect: the GitHub repo description still says "(Astro, Cloudflare Pages)".

### Recommendation
Keep the Worker. Retire the Pages project.

### Steps (needs approval)
1. Cloudflare, gmail account (wrangler is already logged in as it):
   ```powershell
   cd D:\Source\undrwrldcub-site
   npx wrangler pages project list
   npx wrangler pages project delete undrwrldcub-site
   ```
   The delete prompts for confirmation. Deleting the project removes the Pages Git connection, the
   `undrwrldcub-site.pages.dev` hostname and the "Cloudflare Pages" status on future PRs. It does not touch the Worker,
   DNS, or the zone.
2. Repo, on a branch + PR: replace the stale line-3 comment in `wrangler.jsonc` with
   `// Custom domains undrwrldcub.com and www.undrwrldcub.com are attached to this Worker (dashboard).`
   (same PR as item 2 below).
3. GitHub metadata:
   ```powershell
   gh repo edit Kairzen/undrwrldcub-site --description "undrwrldcub.com - personal landing site (Astro, Cloudflare Workers)"
   ```
4. Verify: `https://undrwrldcub.com/` still answers 200; `https://undrwrldcub-site.pages.dev/` stops resolving within minutes.

---

## 2. Workers Builds for `undrwrldcub-home` fail on every non-main branch

### Findings
- Failing checks: "Workers Builds: undrwrldcub-home" on the head commits of PRs #3, #4 and #5. PRs #1 and #2 predate the
  Workers Builds connection (they carry only the "Cloudflare Pages" check). Main builds succeed (Worker last modified
  2026-10-25 20:16 UTC, right after PR #5 merged).
- Cause: for non-production branches Workers Builds runs the **preview command**, default `npx wrangler preview`
  (Worker Previews). Wrangler refuses to run it unless the config has a `previews` block. The message, present in
  wrangler 4.152.0's source, is:
  > Your Wrangler configuration is missing a `previews` block to run this command.

  `wrangler.jsonc` here has no such block.
- Proof by sibling: `wow-forever-wiki` (Worker created one minute after `undrwrldcub-home`, same session) failed the
  same way on PR #23, fixed it in PR #24 (2026-10-02) by adding `"previews": {}`, and every branch build since (PRs #25,
  #58, #59) succeeds with a preview URL under `/previews/<branch>/`.
- Not the cause: `workers_dev: false` (PR #3). The API shows `previews_enabled: true` for this Worker, so preview URLs
  are allowed; the build fails before it gets that far. PR #5 changed only `.github/` files and still failed.
- The dashboard build log would confirm this but needs a signed-in session; I could not read it.

### Recommendation
Option A (recommended): add the empty `previews` block, as the wiki did. Branch builds then deploy a preview and PRs get
a preview URL. The PR that adds it is its own test.
Option B: stop branch builds instead. Dashboard: Workers & Pages > `undrwrldcub-home` > Settings > Build > Branch
control > untick "Enable Preview Builds". No repo change; PRs lose the check entirely.

### Steps for option A (needs approval)
On a branch + PR in this repo, `wrangler.jsonc` becomes:
```jsonc
// Cloudflare Workers static assets (platform baseline host). No Worker script: files only.
// Deployed by Workers Builds: build `npm run build`, deploy `npx wrangler deploy`.
// Custom domains undrwrldcub.com and www.undrwrldcub.com are attached to this Worker (dashboard).
{
  "name": "undrwrldcub-home",
  "compatibility_date": "2026-09-01",
  // The site is served only from its custom domains: no undrwrldcub-home.<subdomain>.workers.dev duplicate.
  "workers_dev": false,
  // Preview URLs stay on for branch and PR builds (set explicitly: the default follows workers_dev).
  "preview_urls": true,
  "assets": {
    "directory": "./dist",
    "not_found_handling": "404-page",
    "html_handling": "auto-trailing-slash"
  },
  // Branch and PR builds run `npx wrangler preview`, which requires this block (it may stay empty).
  "previews": {}
}
```
Verify: the PR's "Workers Builds: undrwrldcub-home" check goes green and links a preview URL; after merge, main still
deploys. The platform drift check does not inspect `wrangler.jsonc` beyond the host, so no deviation is needed.

---

## 3. Worker `undrwrldcub-platform` in the undrwrldcub.com account

### Findings
- The Worker was created 2026-10-16 21:45 UTC by connecting `Kairzen/undrwrldcub-platform` to Workers Builds. It still
  holds the stock "Hello world" script, has never been redeployed, has no custom domain, and workers.dev / preview
  URLs are off. Nothing points at it.
- The repo is the `@undrwrldcub/brand` npm package plus reusable GitHub workflows (drift check, lock sync, release) and
  a site template. It has no `wrangler.jsonc` and nothing to serve. `npx wrangler deploy --dry-run` in the repo fails with
  "Could not detect a directory containing static files", which is why PR #1's build failed and why every push to `main`
  will fail too.
- It also sits in the wrong account: everything else undrwrldcub lives in the gmail account.

### Recommendation
Not wanted. Disconnect the build and delete the Worker.

### Steps (needs approval)
1. Delete the Worker (deleting it removes its Workers Builds configuration too). Wrangler's OAuth login covers both
   accounts, so point it at the undrwrldcub.com account for this one command:
   ```powershell
   cd D:\Source\undrwrldcub-platform
   $env:CLOUDFLARE_ACCOUNT_ID = "<undrwrldcub.com account id>"
   npx wrangler delete --name undrwrldcub-platform
   Remove-Item Env:CLOUDFLARE_ACCOUNT_ID
   ```
2. Stop GitHub offering the repo to Cloudflare again: github.com > Settings > Applications > "Cloudflare Workers and
   Pages" > Configure > Repository access > remove `undrwrldcub-platform` (keep `undrwrldcub-site`, `wow-forever-wiki`).
3. Verify: the Worker is gone from Workers & Pages in that account; the next push to the repo's `main` posts no
   Cloudflare check.

### If the Worker is wanted after all
The only thing in the repo worth hosting is the brand kit (`assets/`). Minimal config, to be added at the repo root
and connected in the gmail account with a `brand.undrwrldcub.com` custom domain added in the dashboard:
```jsonc
{
  "name": "undrwrldcub-platform",
  "compatibility_date": "2026-09-01",
  "workers_dev": false,
  "preview_urls": false,
  "assets": { "directory": "./assets", "not_found_handling": "none" }
}
```
Build command in Workers Builds would be empty (nothing to build), deploy `npx wrangler deploy`.

---

## 4. Inventory: `wessanford-dev`, `wessanford-com`, D1 `records-a`..`records-e`

| Resource | Account | What it is | Owned by |
|---|---|---|---|
| Worker `wessanford-dev` | undrwrldcub.com | Static site for `wessanford.dev` + `www` (custom domains attached) | GitHub repo `Kairzen/wessanford-sites`, `sites/dev/wrangler.jsonc`; deployed by its own GitHub Actions workflow with a per-Worker token. **Not cloned under D:\Source.** |
| Worker `wessanford-com` | undrwrldcub.com | Static site for `wessanford.com` + `www` | Same repo, `sites/com/wrangler.jsonc` |
| D1 `records-a`..`records-d` | undrwrldcub.com | Private personal records databases (legal, finance, health, disability project), paired with R2 buckets `files-a`..`files-d` | `D:\Source\local-llm-mcp\tools\r2load\` (`r2load.py`, `monthly_sync.py`); `records-c` also by `D:\Source\disability2026\HealthData-Local\sync_health_data.py`; helper scripts in `D:\AI\setup\mssql2d1\` |
| D1 `records-e` | undrwrldcub.com | Pet records (created 2026-10-22) | **Unowned.** No script or doc in D:\Source or D:\AI references it, and Wes does not know what created it (2026-10-25). Left alone. |

Both `wessanford-*` Workers are where their repo's README says they should be (its security model requires the
undrwrldcub.com account), so no action. Two housekeeping points:
- Several docs and scripts call the `records-*` account the "personal account" while the id is the undrwrldcub.com
  account (`disability2026/README.md`, `HealthData-Local/sync_health_data.py`, `local-llm-mcp/WATCHLIST.md`). Suggest
  one naming convention ("gmail account" / "undrwrldcub.com account") so future sessions do not aim a token at the
  wrong account.
- If `wessanford-sites` is worked on locally, clone it next to the others:
  ```powershell
  git clone https://github.com/Kairzen/wessanford-sites D:\Source\wessanford-sites
  ```

---

## Status (2026-10-25)
- Item 2: PR opened, https://github.com/Kairzen/undrwrldcub-site/pull/6. Its "Workers Builds: undrwrldcub-home" check passed with a preview URL: the first non-main build to succeed, confirming the cause.
- Item 4: doc-wording PRs opened: https://github.com/Kairzen/disability2026/pull/3 and https://github.com/Kairzen/local-llm-mcp/pull/2; `records-e` recorded as unowned.
- Item 1: DONE 2026-10-25 21:10 UTC. Pages project `undrwrldcub-site` deleted with wrangler; `undrwrldcub-site.pages.dev` no longer answers; undrwrldcub.com and www still 200. GitHub description updated to "Cloudflare Workers".
- Item 3: Worker `undrwrldcub-platform` DELETED 2026-10-25 ~21:35 UTC in the dashboard (Claude in Chrome, Wes signed in as wess@undrwrldcub.com); the API now lists only `wessanford-dev` and `wessanford-com` in that account. GitHub App: the Cloudflare Workers and Pages app is installed with "All repositories" access, so there was no per-repo entry to remove; Wes chose to leave it as is (2026-10-25). With the Worker gone, nothing builds that repo.
  Earlier attempt, kept for the record: NOT possible by wrangler. The undrwrldcub@gmail.com login is "Administrator Read Only" in the undrwrldcub.com account, so both `wrangler delete` and the API refused ("No access to the specified resource"). Wes deletes it in the dashboard signed in as wess@undrwrldcub.com: Workers & Pages > `undrwrldcub-platform` > Settings > scroll to Delete. (GitHub App access left on "All repositories" by decision.)

## Decisions requested
1. Delete Pages project `undrwrldcub-site` and fix the repo description.
2. Branch builds: option A (add `previews` block, PR here) or option B (turn off preview builds in the dashboard).
3. Delete Worker `undrwrldcub-platform` and remove the repo from the Cloudflare GitHub App.
4. Rename "personal account" to "undrwrldcub.com account" in the three docs listed (small PRs in `disability2026` and
   `local-llm-mcp`), and confirm whether `records-e` has an owner you know of.
