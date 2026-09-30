# undrwrldcub.com

Personal landing site for UndrwrldCub — live at **https://undrwrldcub.com**.

Built with [Astro](https://astro.build) on the [undrwrldcub platform](https://github.com/Kairzen/undrwrldcub-platform); hosted on Cloudflare Workers (static assets, Worker `undrwrldcub-home`, custom domains undrwrldcub.com and www.undrwrldcub.com). No deviations from the platform baseline.

- `src/pages/` — home, pathfinder, riftbound, lorcana, workshop, parks.
- `src/data/riftbound-events.json` — the Riftbound schedule (one object per event); rendered at build time on `/riftbound/`.
- `src/layouts/Base.astro` — uses `BrandHead` from `@undrwrldcub/brand` (fonts, tokens, icons, meta).
- `public/brand/` — generated at build time from `@undrwrldcub/brand`; not committed.
- `public/riftbound/` — Riot/UVS Radiance retailer images.
- `platform.json` — deliberate deviations from the platform baseline (none today); `.github/workflows/platform.yml` runs the drift check.

Build: `npm ci && npm run build` → `dist/`. Deploy: Cloudflare Workers Builds on every push to `main` (build `npm run build`, deploy `npx wrangler deploy`, config in `wrangler.jsonc`).

Fan pages are unofficial; game names belong to their publishers.
