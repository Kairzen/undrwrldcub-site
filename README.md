# undrwrldcub.com

Personal landing site for UndrwrldCub — live at **https://undrwrldcub.com**.

Built with [Astro](https://astro.build); hosted on Cloudflare Pages (same setup as [wow-forever-wiki](https://github.com/Kairzen/wow-forever-wiki)).

- `src/pages/` — home, pathfinder, riftbound, lorcana, workshop, parks.
- `src/data/riftbound-events.json` — the Riftbound schedule (one object per event); rendered at build time on `/riftbound/`.
- `src/layouts/Base.astro` — shared head, self-hosted fonts (Cinzel, Inter, Barlow Semi Condensed, IBM Plex Mono).
- `public/brand/`, `public/riftbound/` — octopus brand assets and Riot/UVS Radiance retailer images.

Build: `npm ci && npm run build` → `dist/` (Cloudflare Pages: build command `npm run build`, output `dist`).

Fan pages are unofficial; game names belong to their publishers.
