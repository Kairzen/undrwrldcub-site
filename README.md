# undrwrldcub.com

Personal landing site for UndrwrldCub — live at **https://undrwrldcub.com**.

Built with [Astro](https://astro.build) on the [undrwrldcub platform](https://github.com/Kairzen/undrwrldcub-platform); hosted on Cloudflare Pages (a recorded deviation, see `platform.json`).

- `src/pages/` — home, pathfinder, riftbound, lorcana, workshop, parks.
- `src/data/riftbound-events.json` — the Riftbound schedule (one object per event); rendered at build time on `/riftbound/`.
- `src/layouts/Base.astro` — uses `BrandHead` from `@undrwrldcub/brand` (fonts, tokens, icons, meta).
- `public/brand/` — generated at build time from `@undrwrldcub/brand`; not committed.
- `public/riftbound/` — Riot/UVS Radiance retailer images.
- `platform.json` — deliberate deviations from the platform baseline; `.github/workflows/platform.yml` runs the drift check.

Build: `npm ci && npm run build` → `dist/` (Cloudflare Pages: build command `npm run build`, output `dist`).

Fan pages are unofficial; game names belong to their publishers.
