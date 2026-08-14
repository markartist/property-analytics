# Calais Resi Edge Candidate

Cloudflare Worker candidate for the portfolio Resi edge stabilization system.

This Worker has live routes for `calaismidtownapartments.com/*` and
`www.calaismidtownapartments.com/*`. Desktop and subpage traffic proxies to the
native Kinsta/Resi site with cached/native GTM/gtag/Heap stripped so Cloudflare
Zaraz owns analytics. Mobile homepage traffic uses the standalone edge shell
pattern proven on TowneStone and The Vine.

Current candidate property:

- Calais Midtown (`TX4MI`)
- Origin: `https://calaismidtownapartments.com/`
- Bundled Calais AVIF assets; R2 write permission is still a promotion
  prerequisite for the portfolio package.

Useful paths:

- `/?edge_preview=1` - mobile static edge shell preview
- `/health` - JSON runtime health check
- `/manifest` - JSON property/asset contract used by the preview
- `/assets/<r2-key>` - bundled AVIF asset passthrough, falling back to private
  R2 object passthrough when available

Current route state:

- Live routes are managed in Cloudflare, not `wrangler.toml`
- Default live mode: desktop/subpage native pass-through with analytics cleanup
- Mobile homepage live mode: standalone edge shell with lazy native continuation
- Current full-package marker: `2026-08-07.calais-mobile-shell-preview-v25-high-score-restore`
- Mobile content sequence: promo/header, hero, sourced review row, welcome block,
  features block, then lazy native continuation
- Welcome block proof: native mobile sequence is copy, `See Available Homes`,
  Kingsley award badge; the welcome photo is hidden on mobile.
- Continuation proof: native iframe suppresses duplicate native `hero`,
  `welcome`, and `apartment_features` sections so scroll continues with the
  remaining native page content instead of repeating the shell-owned panels.
- Font note: explicit font preloads were tested in v20-v24 and did remove the
  Lighthouse network-dependency font chain, but repeated PSI runs dropped mobile
  performance into the mid-90s. v25 restores the high-score loading path; do not
  reintroduce font preloads without a subsetting or no-regression proof.
- Mobile hero review summary: linked `/reviews/` rating row sourced from the
  live official `property_rating` block; current Calais values are `4.0` and
  `258 Reviews`.
- Typography proof: Lato and Noto Serif are loaded from the live Calais theme
  font files; do not rely on browser fallback fonts for visual acceptance.
- Gate: `edge_preview=1`
- Analytics cleanup rollback: remove the two Worker routes or deploy a pass-through
  Worker version.
- Mobile shell rollback: set `EDGE_SHELL_ENABLED="false"` in `wrangler.toml` and
  redeploy.

Template notes:

- Property-specific inputs should stay in `PROPERTY`, `ASSET_KEYS`, and
  `ANALYTICS` in `worker.js` until these are externalized into manifest loading.
- `/health` must return `config.ok: true` before any property can be considered
  template-ready.
- Cache version bumps are required after rendered shell changes.

Credential note:

Use the repository's Keeper-backed Wrangler helper for all Cloudflare operations.
Do not introduce local credential files or ad hoc environment-token paths.
