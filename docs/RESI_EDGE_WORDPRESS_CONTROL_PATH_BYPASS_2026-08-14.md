# Resi Edge WordPress Control Path Bypass

Status: Required launch-package rule
Date: 08/14/2026
Owner: WebOps

## Purpose

Read this before modifying any Resi Edge Worker that sits in front of a WordPress/Resi origin.

The rule is simple: public marketing pages may be optimized at the edge; WordPress login, admin, API/control paths, and non-`GET`/`HEAD` requests must pass through transparently.

## Calais Failure

Calais Midtown reported a WordPress cookie blocking issue at:

`https://calaismidtownapartments.com/wp-login.php`

The native origin sent WordPress's required login test cookie:

`Set-Cookie: wordpress_test_cookie=WP%20Cookie%20check`

The public vanity-domain response did not.

Root cause: the Calais Worker catch-all route sent `/wp-login.php` through the public native HTML cleanup path. That path strips `Set-Cookie` for marketing-page performance and cache hygiene. That is valid for public pages, but invalid for WordPress control paths.

## Required Bypass Paths

Bypass public-page optimization for:

- `/wp-login.php`
- `/wp-admin`
- `/wp-admin/*`
- `/wp-json`
- `/wp-json/*`
- `/xmlrpc.php`
- `/wp-cron.php`
- `/wp-comments-post.php`
- all non-`GET`/`HEAD` requests unless a current-task exception is explicitly approved and proved

## Bypass Requirements

Control paths must preserve:

- native `Set-Cookie` headers
- native redirects
- native status codes
- native content type
- native no-cache/no-store posture

Control paths must not receive:

- shell/topper rendering
- native HTML cleanup
- analytics injection
- duplicate script stripping
- cache rewrites
- `Set-Cookie` deletion
- Worker-followed redirects

## Required Routing Order

Run the bypass before:

- homepage shell/topper routing
- desktop native HTML rewriting
- continuation rendering
- analytics cleanup
- `Set-Cookie` deletion
- cache rewrites

It may run after internal edge-only routes such as health, same-origin edge assets, and `llms.txt`.

## Canonical Worker Pattern

For Workers fetching the same public host as origin:

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

For property-specific Workers that build a separate native-origin request, use the same path test and route to the native origin with `redirect: "manual"` and `cf: { cacheEverything: false, cacheTtl: 0 }`.

## Why Manual Redirect Matters

`/wp-admin/` normally redirects unauthenticated users to `/wp-login.php`.

If the Worker follows that redirect internally, it can turn native `302` behavior into a cleaned `200` login page. That hides WordPress behavior from the browser and can break auth flows.

Use `redirect: "manual"` so the browser receives the same redirect WordPress intended.

## Do Not Half-Fix This

Do not fix login by only allowing `Set-Cookie` through the cleaner.

That still leaves login/admin exposed to HTML rewriting, analytics injection, changed status codes, followed redirects, shell markers, and cache policy drift.

The correct fix is a full transparent bypass.

## Current Implementations

Calais legacy Worker:

`/Users/mark/Property_Analytics/ops/cloudflare/calais-resi-edge-candidate/worker.js`

Canonical launch Worker:

`/Users/mark/Property_Analytics/ops/cloudflare/resi-edge-canonical-worker/worker.js`

Calais deployed Worker version:

`0c01be6d-7935-4bd6-a163-a6ffaf4c83e5`

## Required Post-Change Proof

Login cookie:

```bash
curl -sS -D - -o /tmp/wp-login.html https://PROPERTY_DOMAIN/wp-login.php \
  | awk 'BEGIN{IGNORECASE=1} /^HTTP\// || /^content-type:/ || /^cache-control:/ || /^cf-cache-status:/ || /^set-cookie:/ || /^x-vtr/ || /^server-timing:/ {print}'
```

Pass criteria:

- `Set-Cookie` includes `wordpress_test_cookie`
- response has no shell/topper/native-clean marker
- `cf-cache-status` is not a cache hit

Admin redirect:

```bash
curl -sS -D - -o /tmp/wp-admin.html https://PROPERTY_DOMAIN/wp-admin/ \
  | awk 'BEGIN{IGNORECASE=1} /^HTTP\// || /^location:/ || /^cache-control:/ || /^cf-cache-status:/ || /^set-cookie:/ || /^x-vtr/ || /^server-timing:/ {print}'
```

Pass criteria:

- unauthenticated request preserves native WordPress redirect behavior, usually `302`
- response is not a cleaned `200`
- response has no shell/topper/native-clean marker

REST API:

```bash
curl -sS -D - -o /tmp/wp-json.json https://PROPERTY_DOMAIN/wp-json/ \
  | awk 'BEGIN{IGNORECASE=1} /^HTTP\// || /^content-type:/ || /^cache-control:/ || /^cf-cache-status:/ || /^set-cookie:/ || /^x-vtr/ || /^server-timing:/ {print}'
```

Pass criteria:

- response remains native JSON
- response has no shell/topper/native-clean marker

Public homepage:

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
