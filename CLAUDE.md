# undrwrldcub.com -- Claude instructions

Wess's personal landing site, live at https://undrwrldcub.com. Astro, static, built on the undrwrldcub
platform (`@undrwrldcub/brand`, pinned in package.json). Each hobby on the landing page may get its own site
repo later; they all share the platform baseline.

## Commands
Node 22 in CI per `.nvmrc`; newer Node works locally.
```
npm ci
npm run dev        # http://localhost:4321
npm run build      # -> dist/
```

## How changes ship
- Push to `main` = production. Cloudflare Workers Builds deploys the Worker `undrwrldcub-home`
  (custom domains undrwrldcub.com, www.undrwrldcub.com).
- The Platform workflow runs the drift check on pushes and PRs; use a branch + PR for bigger changes.
- Workflow files (`.github/workflows/`) can be edited and pushed from this clone.

## Rules
- Stay on the platform baseline: dependencies only `astro` and `@undrwrldcub/brand`, build script exactly
  `astro build`. Any difference needs a deviation in `platform.json` (rule, why, decided date) -- ask Wess first.
- Brand assets come from `@undrwrldcub/brand` (`BrandHead` in `src/layouts/Base.astro`); `public/brand/` is
  generated at build time and never committed. Change fonts, tokens or icons in the platform repo, not here.
- `src/data/riftbound-events.json` is the single source for the Big Deck Energy (local store) schedule.
- `src/data/riftbound-calendar.json` is the single source for the Riot-wide calendar ("Across the Rift"):
  drawings, releases, Pre-Rift/Skirmish windows, premier events. The workflow `riftbound-d1.yml` validates it
  and loads its rows into Cloudflare D1 `riftbound` (table `rb_calendar`, visibility='public') on push to main;
  needs repo secret CLOUDFLARE_API_TOKEN (D1 edit). Organizer deadlines are private: they live only in D1
  (visibility='private'), never in this public repo. Validate locally with `node scripts/riftbound-d1.mjs --check`.
  The scheduled "Riftbound drawing & event watch" edits this file.
- `src/data/riftbound-news.json` is the single source for the "Riftbound news" section: newest first, fields
  id, category (announcement, organized_play, rules, judge, product, event_report), title, published, optional
  effective_date, source, summary, optional judge_note, url. `url` must be the article or video itself (never a
  home page or channel; validation fails otherwise). Items with a judge_note also show under the Judge filter.
  The same workflow loads it into D1 `riftbound` table `rb_news` (replaced in full). The Riftbound page speaks as a
  collector and player (since 2026-10-29 Wess no longer judges or runs play at Big Deck Energy): judge notes are
  general rules guidance, never store policy or "we rule". The watch adds items; drop ones older than ~90 days.
- `src/data/riftbound-rules.json` feeds the "Judge's corner": current rules documents with dates,
  the Constructed and 2v2 ban lists, and the judge-test link. Site-only (validated, not loaded into D1).
- Free tiers only; never commit secrets.
- Commit as Wes Sanford <undrwrldcub@gmail.com> (set in this clone's git config).

## Layout
- `src/pages/` home, pathfinder, riftbound, lorcana, workshop, parks
- `src/layouts/Base.astro` shared layout
- `public/riftbound/` retailer images
- `wrangler.jsonc` Worker config (static assets from `./dist`)
