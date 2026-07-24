# Portfolio Resi Edge Prototype

Query-gated Cloudflare Worker for the portfolio Resi edge stabilization system.

This Worker is routed to `championsgreen-ga.com/*`, but the mobile edge shell is
only active when the request includes `?edge_preview=1`. Ungated traffic proxies
to the native Kinsta/Resi site unchanged. The same Worker also runs on
`workers.dev` and reads optimized assets from the private `resi-edge-assets` R2
bucket.

Current prototype property:

- Champions Green (`GA4CG`)
- Origin: `https://championsgreen-ga.com/`
- R2 keys: `resi-edge-assets/GA4CG/...`

Useful paths:

- `/?edge_preview=1` - mobile static edge shell preview on the live hostname
- `/health` - JSON runtime health check
- `/manifest` - JSON property/asset contract used by the preview
- `/assets/<r2-key>` - private R2 object passthrough with cache headers

Current live route:

- `championsgreen-ga.com/*`
- Gate: `edge_preview=1`
- Rollback: set `EDGE_SHELL_ENABLED="false"` in `wrangler.toml` and redeploy, or
  remove the route and redeploy.

Template notes:

- Property-specific inputs should stay in `PROPERTY`, `ASSET_KEYS`, and
  `ANALYTICS` in `worker.js` until these are externalized into manifest loading.
- `/health` must return `config.ok: true` before any property can be considered
  template-ready.
- Cache version bumps are required after rendered shell changes.

Credential note:

Use the Keeper custom field notation for Wrangler R2 operations:

`keeper://3eLgyrNIvR_N_Bl809aAcg/custom_field/Token Value`

Do not use the Keeper password field for Wrangler. That field is the R2 S3
secret key, not the Cloudflare API token.
