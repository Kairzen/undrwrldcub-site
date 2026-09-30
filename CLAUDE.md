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
- `src/data/riftbound-events.json` is the single source for the Riftbound schedule.
- Free tiers only; never commit secrets.
- Commit as Wes Sanford <undrwrldcub@gmail.com> (set in this clone's git config).

## Layout
- `src/pages/` home, pathfinder, riftbound, lorcana, workshop, parks
- `src/layouts/Base.astro` shared layout
- `public/riftbound/` retailer images
- `wrangler.jsonc` Worker config (static assets from `./dist`)
