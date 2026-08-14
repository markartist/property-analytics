# Cendana Native Optimizer

Preview-gated native optimization lane for Cendana District West.

This Worker does not use the Resi topper. It keeps the native Resi v1 / WordPress / YOOtheme page and applies narrow first-view optimizations:

- optimized same-origin hero derivatives
- early hero preload
- delayed GTM bootstrap with a `gtag` queue stub
- first-party script `defer`
- Resi runtime delay
- WordPress emoji probe removal
- public HTTPS `og:image` correction

Current preview:

- `https://edge-preview.cendanalife.com/?edge_native_preview=1`
- Worker marker: `2026-08-04.cendana-native-wpengine-origin-v6-forwarded-client-ip`

Live status:

- Public `https://cendanalife.com/` is intentionally restored to DNS-only WP Engine service.
- The Worker custom domain is active only on `edge-preview.cendanalife.com`.
- Do not attach `cendanalife.com` as a Worker custom domain or proxied CNAME Worker route without a guarded rollback. Multiple apex attempts on 08/04/2026 proved the first blocker: bundled Worker assets can serve briefly or directly, but homepage origin fetch returns Cloudflare Error 1000 when the Worker targets a Cloudflare-backed WP Engine origin and Cloudflare Orange-to-Orange support is unavailable on this zone from the current account/API path. A proxied CNAME plus route test initially passed during propagation, then settled into Error 1000 and was rolled back.
- A later WP Engine environment-origin test found `cendana.wpengine.com` can serve the site when it receives `Host: cendanalife.com`, but live Worker route testing triggered the Resi Website Management Firewall with `403 Blocked because of Malicious Activities`.
- WP Engine Support guidance requires WP Engine to clear the firewall block, allow Cloudflare proxy ranges, and enable real-client header interpretation before the next live route attempt.
- The Worker now sends an explicit proxy header contract to WP Engine origin requests: `Host: cendanalife.com`, `X-Forwarded-Host: cendanalife.com`, `X-Forwarded-Proto: https`, and trusted client IP from Cloudflare's `CF-Connecting-IP` into `X-Forwarded-For`, `X-Real-IP`, and `True-Client-IP`.

Current safe rollback DNS shape:

- `cendanalife.com` A `141.193.213.10`, DNS-only
- `www.cendanalife.com` CNAME `cendanalife.com`, DNS-only

Live enablement requirement:

- WP Engine must clear the current Resi Website Management Firewall block and confirm that the environment accepts Cloudflare Worker/reverse-proxy traffic for `Host: cendanalife.com`.
- WP Engine should allow Cloudflare's published edge proxy ranges for this site/environment and interpret `X-Forwarded-For` or `True-Client-IP` as the real visitor IP only from those trusted proxy ranges.
- Do not retry live apex route activation until WP Engine confirms the allowlist/header-interpretation change.
