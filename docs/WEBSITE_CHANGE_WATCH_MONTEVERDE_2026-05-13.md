# Monteverde Website Change Watch

Status: Active baseline lane
Date: 2026-05-13
Owner: MarketingOps / Data Pond / Site Content Creator / EVS
Property: Monteverde (`TX4MV`)
Domain: `https://monteverdesatx.com/`

## Canonical Name

This lane is canonical as **Monteverde Website Change Watch**.

Prior or adjacent labels, including “Monteverde Monitoring,” “Monteverde SEO
monitor,” “vendor SEO baseline,” and “Monteverde watch,” should resolve back to
this lane and should not create separate monitor/report/workflow families.

Primary references:

- `ATLAS_WORKING_MEMORY.md`
- `docs/WEBSITE_CHANGE_WATCH_MONTEVERDE_2026-05-13.md`

## Monitored Sites

- Primary site: `https://monteverdesatx.com/`
- Blog subdomain: `https://blog.monteverdesatx.com/`

## Purpose

Monteverde is being monitored while an external AI SEO vendor has edit access.
The goal is to preserve the original public website state, detect every visible
content or SEO-facing change, and connect those changes to web and SEO
performance movement.

This is not a PIB lane and does not alter canonical PIB generators, templates,
or senders.

## Canonical Extension Points

- Property identity resolves through `Data_Collection/utils/property_identity.py`
  and `config/property_identity_matrix.json`.
- Public content inventory extends the Site Content Creator / Specs direction.
- SEO and performance monitoring reads from Data Pond sources already used by
  Captain website routines: GA4, GSC, PSI, GTMetrix, DataForSEO, GBP, Google Ads,
  and unit availability where present.
- Experience validation should extend EVS / BrowserStack for deeper rendering,
  CTA, and form checks.

## Product Direction

This Monteverde watch is the seed pattern for a future portfolio-grade Website
Change Watch capability. The important design decision is that this should not
become a standalone SEO tool. It should become a governed monitoring layer that
feeds existing systems:

- **Site Content Creator:** show current vs original page/section copy,
  editable text inventory, approved copy, vendor changes, and rollback text.
- **Data Pond:** store normalized immutable snapshots, diff events, metric
  baselines, and post-change impact windows as queryable evidence.
- **Captain Website Routine:** convert material content, SEO, schema, speed, and
  indexability changes into watch items and recommendations with source links.
- **EVS / BrowserStack:** validate high-risk changes on desktop/mobile, especially
  CTAs, forms, floor-plan journeys, navigation, and rendered layout.
- **Watchtower / Control Plane:** surface freshness, failed runs, high-severity
  changes, cache posture, and missing backend audit coverage.
- **Specs:** map page sections and metadata expectations to governed structural
  contracts instead of relying only on heuristic text extraction.

The future portfolio version should keep three separate concepts:

- **Baseline:** immutable original state before vendor or experiment work begins.
- **Diff:** every observed change, classified by field, page, severity, and source.
- **Impact:** delayed performance/search/conversion movement after the change,
  with GSC and GA4 lag handled explicitly.

## Future Integration Backlog

- Add a durable Data Pond table family for website snapshots, fields, diffs,
  watch runs, and backend-audit attachments.
- Add a reusable property list config so the runner can monitor any governed
  property resolved through the identity matrix.
- Add authenticated WordPress/WP Engine evidence ingestion when access exists:
  revisions, activity logs, page builder payloads, SEO Framework fields, plugin
  changes, redirects, and backup references.
- Add Site Content Creator UI panels for baseline vs current content and
  field-level diffs.
- Add EVS post-change validation requests when high-severity diffs touch CTAs,
  forms, floor-plan pages, navigation, schema, or scripts.
- Add alert routing for high-risk changes such as `noindex`, off-domain
  canonicals, removed schema, deleted sections, changed lead paths, and cache or
  performance degradation.
- Add an impact report window that compares pre/post GA4, GSC, PSI, GTMetrix,
  DataForSEO, GBP, and conversion signals after enough lag has elapsed.
- Preserve the approved artifact rule: this lane may inform PIB, Captain, POP
  Brief, Watchlist, or Spotlight outputs, but it must not create a parallel
  report family or mutate locked PIB behavior.

## Current Implementation

- Configuration: `config/website_change_watch_properties.json`
- Baseline and monitor runner: `scripts/monitor_monteverde_website_watch.py`
- Artifact root: `reports/website_change_watch/monteverde/`

Each run writes:

- raw page HTML for every sitemap URL
- normalized page snapshots with titles, meta, canonicals, robots, headings,
  text blocks, links, CTAs, images/alt text, forms, JSON-LD, custom schema
  scripts, script/style sources, headers, status codes, and hashes
- `robots.txt` and sitemap evidence
- latest Data Pond metrics summary
- a Markdown executive/operator baseline report
- machine-readable diff events against the prior run when one exists

## Active Automation

An hourly Codex automation named `monteverde-website-change-watch` runs the
current monitor from `/Users/mark/Property_Analytics` and reviews the latest
report/diff artifacts for high- and medium-severity changes.

## Monitoring Contract

The watch should treat these as high-risk changes:

- `noindex` or `nofollow` introduced on public pages
- canonical URLs changed away from the page/domain
- title or meta description removed
- JSON-LD/schema removed or invalid JSON-LD introduced
- primary CTA, phone, floor-plan, apply, tour, or contact links changed
- sitemap removes homepage, floor plans, amenities, neighborhood, FAQ, contact,
  gallery, or blog pages
- page status becomes `4xx` or `5xx`
- large visible-text deletion without an approved change note
- tracking, GTM, plugin, theme, or vendor script changes
- performance, GSC, or ranking degradation after the change window

## Manual Run

```bash
python3 scripts/monitor_monteverde_website_watch.py --property Monteverde
```

Optional:

```bash
python3 scripts/monitor_monteverde_website_watch.py --property Monteverde --no-compare
```

## Backend Coverage Caveat

The current lane is public and Data Pond based. It can detect backend changes
that alter rendered HTML, public metadata, schema, sitemaps, robots, headers,
public WordPress REST fields, or performance/search metrics.

For full backend accountability, add one of:

- WordPress application-password read access for pages/posts/revisions/options
- a WordPress activity-log export
- WP Engine backup/export evidence
- SEO Framework metadata export
- YOOtheme builder export or authenticated page JSON

Those should feed this same watch lane rather than creating a parallel system.
