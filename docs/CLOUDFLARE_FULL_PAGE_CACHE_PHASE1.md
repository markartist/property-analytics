# Cloudflare Full-Page Cache Rollout: Resi Pilots

## Goal

Use Cloudflare as the controlled HTML edge cache for the five Resi pilot domains while keeping Kinsta as the origin and origin-side cache host.

This rollout is intentionally narrow:

- Phase 1 only caches the homepage (`/`)
- Kinsta remains the origin and origin cache
- Kinsta Edge Caching for HTML should stay off for these pilot domains
- Cloudflare Cache Rules are the primary control layer
- Query-string normalization is deferred

## Current Pilot Baseline

As of April 8, 2026:

- All five pilot zones are on the Cloudflare `Free Website` plan
- No custom `http_request_cache_settings` entrypoint rulesets exist yet
- The daily audit shows `0.00%` warm-HIT coverage on the tested homepages
- Zone-level Cloudflare cache-hit ratios range from `38.70%` to `53.71%`
- Current zone settings already observed in the audit include:
  - `cache_level = aggressive`
  - `browser_cache_ttl = 14400`
  - `sort_query_string_for_cache = off`

## Rule Set Design

Phase 1 uses one zone-level Cache Rules entrypoint in `http_request_cache_settings` with two rules.

Cloudflare models cache eligibility and TTL in the same `set_cache_settings` action, so the “eligible HTML” and “TTL” requirements are implemented together in the second rule.

### Rule 1: Bypass Dynamic/Auth Traffic

Name:
`pilot_bypass_dynamic_and_authenticated`

Action:
`set_cache_settings`

Action parameters:

```json
{
  "cache": false
}
```

Expression template:

```cf
(
  (http.request.method ne "GET" and http.request.method ne "HEAD")
  or starts_with(http.request.uri.path, "/wp-admin")
  or starts_with(http.request.uri.path, "/wp-login")
  or starts_with(http.request.uri.path, "/wp-json")
  or http.request.uri.query contains "preview=true"
  or http.request.uri.query contains "preview_id="
  or http.request.uri.query contains "preview_nonce="
  or http.request.uri.query contains "customize_changeset_uuid="
  or http.request.uri.query contains "customize_messenger_channel="
  or http.request.uri.query contains "customize_autosaved="
  or http.request.uri.query contains "_wpnonce="
  or http.request.uri.query contains "s="
  or http.request.uri.query contains "elementor-preview="
  or http.request.uri.query contains "fl_builder"
  or http.cookie contains "wordpress_logged_in_"
  or http.cookie contains "wordpress_sec_"
  or http.cookie contains "wp-postpass_"
  or http.cookie contains "wordpress_test_cookie"
  or http.cookie contains "comment_author_"
  or http.cookie contains "PHPSESSID"
  or http.cookie contains "woocommerce_items_in_cart"
  or http.cookie contains "woocommerce_cart_hash"
  or http.cookie contains "wp_woocommerce_session_"
  or http.cookie contains "preview"
  or http.cookie contains "logged_in"
  or http.cookie contains "auth"
)
```

Expected synthetic behavior:

- Anonymous homepage requests should not hit this rule
- Logged-in/admin/preview/session traffic should bypass edge caching
- Cloudflare may show `CF-Cache-Status: DYNAMIC` for bypassed traffic, which is acceptable

### Rule 2: Cache Homepage HTML

Name:
`pilot_cache_homepage_html`

Action:
`set_cache_settings`

Action parameters:

```json
{
  "cache": true,
  "edge_ttl": {
    "mode": "override_origin",
    "default": 7200
  },
  "browser_ttl": {
    "mode": "respect_origin"
  }
}
```

Why `7200` seconds instead of `1800`:

- The desired rollout TTL is `1800` seconds
- The pilot zones are on Cloudflare Free
- The implementation config clamps the effective edge TTL to the plan minimum, which is currently `7200` seconds for Free

Expression template:

```cf
(
  http.host eq "example.com"
  and (http.request.method eq "GET" or http.request.method eq "HEAD")
  and http.request.uri.path eq "/"
  and not (http.request.uri.query contains "preview=true")
  and not (http.request.uri.query contains "preview_id=")
  and not (http.request.uri.query contains "preview_nonce=")
  and not (http.request.uri.query contains "customize_changeset_uuid=")
  and not (http.request.uri.query contains "customize_messenger_channel=")
  and not (http.request.uri.query contains "customize_autosaved=")
  and not (http.request.uri.query contains "_wpnonce=")
  and not (http.request.uri.query contains "s=")
  and not (http.request.uri.query contains "elementor-preview=")
  and not (http.request.uri.query contains "fl_builder")
  and not (http.cookie contains "wordpress_logged_in_")
  and not (http.cookie contains "wordpress_sec_")
  and not (http.cookie contains "wp-postpass_")
  and not (http.cookie contains "wordpress_test_cookie")
  and not (http.cookie contains "comment_author_")
  and not (http.cookie contains "PHPSESSID")
  and not (http.cookie contains "woocommerce_items_in_cart")
  and not (http.cookie contains "woocommerce_cart_hash")
  and not (http.cookie contains "wp_woocommerce_session_")
  and not (http.cookie contains "preview")
  and not (http.cookie contains "logged_in")
  and not (http.cookie contains "auth")
)
```

## Config and Tooling

Primary rollout config:

- [cloudflare_full_page_cache.yaml](/Users/mark/Property_Analytics/config/cloudflare_full_page_cache.yaml)

API tooling:

- [cache_rules_manager.py](/Users/mark/Property_Analytics/ops/cloudflare/cache_rules_manager.py)
- [apply_pilot_full_page_cache.py](/Users/mark/Property_Analytics/ops/cloudflare/apply_pilot_full_page_cache.py)
- [purge_cloudflare_cache.py](/Users/mark/Property_Analytics/ops/cloudflare/purge_cloudflare_cache.py)

## Applying the Rules

### Safe Dry Run

```bash
export CLOUDFLARE_API_TOKEN_FILE=/Users/mark/Downloads/Cloudflare_Cache_Audit_Token_3.txt
python3 /Users/mark/Property_Analytics/ops/cloudflare/apply_pilot_full_page_cache.py
```

This:

- resolves each pilot zone
- reads the current cache-rules entrypoint
- renders the homepage-only ruleset
- exports JSON snapshots under `outputs/cloudflare_full_page_cache/<timestamp>/`

### Live Apply

This requires a Cloudflare token with write access, at minimum `Cache Settings Write` and `Zone Read`.

```bash
export CLOUDFLARE_API_TOKEN='...write-capable token...'
python3 /Users/mark/Property_Analytics/ops/cloudflare/apply_pilot_full_page_cache.py --apply
```

If Cloudflare already has a cache-settings entrypoint that was not created by the Property Analytics rollout, the script will stop unless you explicitly pass `--allow-overwrite`.

### Dashboard Equivalent

For each pilot zone:

1. Confirm Kinsta Edge Caching for HTML is off in MyKinsta.
2. In Cloudflare, open `Caching` -> `Cache Rules`.
3. Add the bypass rule first.
4. Add the homepage cache rule second.
5. Use an edge TTL equal to the plan-supported minimum if Cloudflare rejects the requested TTL.
6. Leave browser TTL conservative.
7. Do not add query-string normalization in Phase 1.

## Validation Checklist

### Pre-apply

- Confirm the domain is active in Cloudflare
- Confirm Kinsta remains the origin
- Confirm Kinsta Edge Caching is off for the pilot domain
- Confirm no unexpected existing custom cache rules
- Snapshot current zone settings and ruleset state

### Phase 1 Release Gate

Use the existing Cloudflare audit collector:

```bash
export CLOUDFLARE_API_TOKEN_FILE=/Users/mark/Downloads/Cloudflare_Cache_Audit_Token_3.txt
python3 /Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_cache_audit.py \
  --config /Users/mark/Property_Analytics/config/cloudflare_cache_audit.yaml \
  --domain championsgreen-ga.com
```

Success signals:

- Homepage first request returns `MISS` or `EXPIRED`
- Homepage second request returns `HIT`
- Query-string homepage request still behaves correctly
- Logged-in/admin/preview requests return `BYPASS` or `DYNAMIC`
- Warm-cache TTFB is better than the current baseline
- No broken homepage rendering or WordPress/YOOtheme regressions

Failure signals:

- Homepage second request remains `MISS`, `BYPASS`, or `DYNAMIC`
- Logged-in or preview pages appear cacheable
- Wrong content appears across sessions
- Query-string variants behave unexpectedly
- Cache-hit ratio falls while homepage still does not warm

### Phase Sequence

1. Homepage only
2. Key marketing/property pages
3. Broader public path patterns
4. Query-string normalization after attribution review

## Purge Workflow

Manual during rollout:

1. Purge Cloudflare after a homepage content update or deployment
2. Keep Kinsta origin/site cache purges active
3. Re-run the synthetic audit after purge

Example targeted purge:

```bash
export CLOUDFLARE_API_TOKEN='...write-capable token...'
python3 /Users/mark/Property_Analytics/ops/cloudflare/purge_cloudflare_cache.py \
  --domain championsgreen-ga.com \
  --url https://championsgreen-ga.com/
```

Example full-zone purge:

```bash
export CLOUDFLARE_API_TOKEN='...write-capable token...'
python3 /Users/mark/Property_Analytics/ops/cloudflare/purge_cloudflare_cache.py \
  --domain championsgreen-ga.com \
  --purge-everything
```

## Expected `CF-Cache-Status` Behavior

- `MISS`: first eligible request populates cache
- `HIT`: warm eligible request served from Cloudflare cache
- `BYPASS`: Cloudflare intentionally skipped cache based on policy
- `DYNAMIC`: Cloudflare did not treat the response as cacheable in this path; this can also appear for bypassed/dynamic traffic

For this rollout, `HIT` on the second anonymous homepage request is the primary synthetic success marker.

## Known Limitations and Edge Cases

- The current pilot zones are on Cloudflare Free, so the edge TTL may need to be higher than the desired 10-30 minute rollout target.
- The current token available in this workspace is read-only. The apply and purge scripts are implemented, but live writes require a write-capable token.
- Phase 1 intentionally leaves query-string normalization out of scope to avoid premature attribution breakage.
- Some WordPress or YOOtheme editor flows may use additional cookies or parameters not yet listed; those can be added to the bypass config after observation.
- Kinsta can still emit origin headers such as `Cache-Control: public, max-age=0, s-maxage=86400`; Cloudflare rule eligibility should remain the primary control.
- Cloudflare may show `DYNAMIC` instead of `BYPASS` for requests that are correctly excluded from caching.
