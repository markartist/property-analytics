# Resi Edge WordPress Control Path Bypass

Status: Required launch-package rule
Date: 08/14/2026
Owner: WebOps

## Purpose

This document explains the WordPress login/admin bypass required for Resi Edge Workers.

Read this before modifying any property Worker, canonical Resi Edge Worker, or launch-package Worker that sits in front of a WordPress/Resi origin.

## What Broke On Calais

Calais Midtown reported a WordPress cookie blocking issue at:

`https://calaismidtownapartments.com/wp-login.php`

The native origin sent the required WordPress login test cookie:

`Set-Cookie: wordpress_test_cookie=WP%20Cookie%20check`

The public vanity-domain response did not send that cookie.

The reason was the Calais Worker catch-all route. `/wp-login.php` fell through to the same native HTML cleanup path used for public marketing pages. That path strips `Set-Cookie` for performance and cache hygiene, which is correct for public pages but wrong for WordPress control paths.

Result: WordPress could not confirm cookie support and surfaced a cookie blocking message.

## Required Rule

Public marketing pages may use edge optimization:

- mobile shell/topper rendering
- native HTML cleanup
- analytics cleanup
- duplicate script stripping
- asset rewriting
- `Set-Cookie` stripping
- cache policy changes

WordPress control paths must not use those optimization paths.

They must pass to origin transparently with:

- native `Set-Cookie` headers preserved
- native redirects preserved
- native status codes preserved
- no edge shell/topper markers
- no HTML rewriting
- no analytics injection
- no edge cookie stripping
- no Cloudflare cache hit behavior

## Required Transparent Paths

Every Resi Edge Worker must bypass public-page optimization for:

- `/wp-login.php`
- `/wp-admin`
- `/wp-admin/*`
- `/wp-json`
- `/wp-json/*`
- `/xmlrpc.php`
- `/wp-cron.php`
- `/wp-comments-post.php`

Every non-`GET`/`HEAD` request should also use transparent pass-through unless Mark explicitly approves a current-task exception and the exception has proof.

## Required Worker Ordering

The bypass must run before:

- homepage shell/topper routing
- desktop native HTML rewriting
- continuation rendering
- analytics cleanup
- `Set-Cookie` deletion
- cache rewrites

It may run after internal edge-only routes such as health, same-origin edge assets, and `llms.txt`.

## Canonical Pattern

Use this shape in Workers that fetch the same public host as origin:

```js
function isWordPressControlRequest(request, url) {
  if (request.method !== "GET" && request.method !== "HEAD") return true;

  return (
    url.pathname === "/wp-login.php" ||
    url.pathname === "/xmlrpc.php" ||
    url.pathname === "/wp-cron.php" ||
    url.pathname === "/wp-comments-post.php" ||
    url.pathname === "/wp-admin" ||
    url.pathname.startsWith("/wp-admin/") ||
    url.pathname === "/wp-json" ||
    url.pathname.startsWith("/wp-json/")
  );
}

function fetchOriginTransparent(request) {
  return fetch(new Request(request, { redirect: "manual" }), {
    cf: { cacheEverything: false, cacheTtl: 0 },
  });
}

if (isTargetHost(url) && isWordPressControlRequest(request, url)) {
  return fetchOriginTransparent(request);
}
```

For property-specific Workers that build a separate native-origin request, use the same path test but route to a transparent native-origin request with `redirect: "manual"` and `cf: { cacheEverything: false, cacheTtl: 0 }`.

## Why Manual Redirect Matters

`/wp-admin/` normally redirects unauthenticated users to `/wp-login.php`.

If the Worker follows that redirect internally, it can turn native `302` behavior into a cleaned `200` login page. That hides WordPress behavior from the browser and can break auth flows.

Use `redirect: "manual"` for control-path bypasses so the browser receives the same redirect WordPress intended.

## Do Not Do This

Do not “fix” login by only allowing `Set-Cookie` through the cleaner.

That still leaves login/admin pages exposed to:

- HTML rewriting
- analytics injection
- changed status codes
- followed redirects
- shell markers
- cache policy drift

The correct fix is a full transparent bypass.

## Calais Implementation

Live Calais Worker:

`/Users/mark/Property_Analytics/ops/cloudflare/calais-resi-edge-candidate/worker.js`

Calais now uses:

- `isWordPressControlRequest`
- `passThroughNativeTransparent`
- `redirect: "manual"`
- `cf: { cacheEverything: false, cacheTtl: 0 }`

The bypass is called before the native continuation and homepage shell branches.

Deployed Worker version:

`0c01be6d-7935-4bd6-a163-a6ffaf4c83e5`

## Canonical Launch Package Implementation

Canonical launch Worker:

`/Users/mark/Property_Analytics/ops/cloudflare/resi-edge-canonical-worker/worker.js`

The same bypass rule has been added there so future generated property Workers inherit the behavior.

## Required Post-Change Proof

Run these checks after modifying or deploying a Worker.

### Login Cookie

```bash
curl -sS -D - -o /tmp/wp-login.html https://PROPERTY_DOMAIN/wp-login.php \
  | awk 'BEGIN{IGNORECASE=1} /^HTTP\// || /^content-type:/ || /^cache-control:/ || /^cf-cache-status:/ || /^set-cookie:/ || /^x-vtr/ || /^server-timing:/ {print}'
```

Pass criteria:

- `Set-Cookie` includes `wordpress_test_cookie`
- `cf-cache-status` is not a cache hit
- response has no edge shell/topper/native-clean marker

### Admin Redirect

```bash
curl -sS -D - -o /tmp/wp-admin.html https://PROPERTY_DOMAIN/wp-admin/ \
  | awk 'BEGIN{IGNORECASE=1} /^HTTP\// || /^location:/ || /^cache-control:/ || /^cf-cache-status:/ || /^set-cookie:/ || /^x-vtr/ || /^server-timing:/ {print}'
```

Pass criteria:

- unauthenticated request preserves native WordPress redirect behavior, usually `302`
- response is not a cleaned `200`
- response has no edge shell/topper/native-clean marker

### REST API

```bash
curl -sS -D - -o /tmp/wp-json.json https://PROPERTY_DOMAIN/wp-json/ \
  | awk 'BEGIN{IGNORECASE=1} /^HTTP\// || /^content-type:/ || /^cache-control:/ || /^cf-cache-status:/ || /^set-cookie:/ || /^x-vtr/ || /^server-timing:/ {print}'
```

Pass criteria:

- response remains native JSON
- response has no edge shell/topper/native-clean marker

### Public Homepage Still Optimized

```bash
curl -sS -D - -o /tmp/home-mobile.html \
  -A 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' \
  https://PROPERTY_DOMAIN/ \
  | awk 'BEGIN{IGNORECASE=1} /^HTTP\// || /^content-type:/ || /^cache-control:/ || /^x-vtr/ || /^server-timing:/ {print}'
```

Pass criteria:

- public homepage still shows the expected Resi Edge shell/topper marker
- control-path bypass did not disable public optimization

## Validation Commands

Run the relevant commands after code changes:

```bash
node --check /Users/mark/Property_Analytics/ops/cloudflare/calais-resi-edge-candidate/worker.js
node --check /Users/mark/Property_Analytics/ops/cloudflare/resi-edge-canonical-worker/worker.js
node /Users/mark/Property_Analytics/scripts/validate_resi_edge_package_static.mjs --manifest /Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/championsgreen-ga-com.manifest.json
bash /Users/mark/Property_Analytics/scripts/check_pib_guardrails.sh
bash /Users/mark/Property_Analytics/scripts/check_context_discipline.sh
```

Use Keeper-backed Wrangler auth for any deploy:

`/Users/mark/Property_Analytics/apps/api/scripts/wrangler_auth.py`

Do not create local credential files or ad hoc token paths.

## Future Worker Modification Checklist

Before modifying any existing Worker:

- Find every path that deletes `Set-Cookie`.
- Find every path that rewrites HTML.
- Find every path that follows redirects.
- Confirm WordPress control paths bypass all of those paths.
- Confirm non-`GET`/`HEAD` requests bypass all public optimization unless explicitly approved.
- Prove `/wp-login.php`, `/wp-admin/`, `/wp-json/`, and mobile homepage after deploy.

This is now part of the Resi Edge launch package contract.
