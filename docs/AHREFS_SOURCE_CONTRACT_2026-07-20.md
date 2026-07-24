# Ahrefs Source Contract

Owner: MarketingOps / Data Pond / WebOps
Status: Active advisory source, first daily-safe implementation
Date: 07/20/2026

## Purpose

Ahrefs is a governed advisory source for portfolio SEO, technical site health, domain authority, backlink context, Ahrefs Web Analytics, and Ahrefs-hosted GSC Insights.

It complements, but does not replace:

- GA4 for official web traffic and engagement facts
- GSC for Google-owned search performance facts
- GBP for local listing and review facts
- PageSpeed / CrUX for performance diagnostics
- DataForSEO for structured SERP, OnPage, keyword, business-profile, and AI visibility evidence
- Cloudflare analytics for edge-delivery facts
- Data Pond operating and leasing sources for internal business truth

## Credential Posture

Ahrefs credentials are Keeper-first.

- Keeper record: `aHrefs API Key`
- Preferred env var: `KSM_AHREFS_API_KEY_NOTATION`
- Current default notation: `keeper://xbIaayyCqMfrzVFjRei5hA/field/password`
- Transitional fallback only: `AHREFS_API_KEY`

Agents and automations must not create a local Ahrefs credential file or print the raw API key.

## Canonical Implementation

- Auth helper: `/Users/mark/Property_Analytics/utils/ahrefs_auth.py`
- Collector: `/Users/mark/Property_Analytics/Data_Collection/collectors/ahrefs_collector.py`
- Project admin: `/Users/mark/Property_Analytics/scripts/ahrefs_project_admin.py`
- Competitor admin: `/Users/mark/Property_Analytics/scripts/ahrefs_competitor_admin.py`
- Config: `/Users/mark/Property_Analytics/config/ahrefs.yaml`
- Local Data Pond tables: `/Users/mark/Property_Analytics/apps/api/migrations/0060_create_ahrefs_tables.sql`
- Daily orchestration: `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`

## Daily-Safe Endpoints

The default daily collector uses only endpoints Ahrefs documents as free:

- `GET /subscription-info/limits-and-usage`
- `GET /management/projects`
- `GET /site-audit/projects`
- `GET /web-analytics/stats`
- `GET /gsc/performance-history`
- `GET /public/domain-rating-free`

The daily collector stores normalized fields plus raw JSON payloads so future reporting can audit the source response without re-calling Ahrefs.

## Stored Tables

- `ahrefs_subscription_usage_snapshots`
- `ahrefs_projects`
- `ahrefs_site_audit_project_health`
- `ahrefs_web_analytics_daily`
- `ahrefs_gsc_daily_summary`
- `ahrefs_domain_rating_snapshots`

## Property Identity

Ahrefs projects must resolve property identity through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py` and `/Users/mark/Property_Analytics/config/property_identity_matrix.json`.

When an Ahrefs project target or name does not resolve:

- store the source row with null `property_id`
- preserve the Ahrefs project id, project name, and target URL
- add missing identifiers to the governed matrix generation path before relying on property-scoped reporting
- do not add a local Ahrefs-only property map

## Project Administration

Ahrefs project creation is supported through `/Users/mark/Property_Analytics/scripts/ahrefs_project_admin.py`.

The script:

- reads desired projects from the governed property identity matrix
- fetches the live Ahrefs project roster through `GET /management/projects`
- writes a dry-run plan under `/Users/mark/Property_Analytics/reports/ahrefs_admin/`
- creates only missing exact target matches when run with `--apply --confirm CREATE_AHREFS_PROJECTS`
- defaults new projects to `access=shared`
- uses `protocol=https, mode=prefix` for `venterraliving.com/apartments/...` property pages
- uses `protocol=both, mode=subdomains` for standalone property domains
- reports exact-target project-name mismatches against the `{Property Name} ({Property Code})` convention
- reports likely legacy standalone-domain projects that should receive canonical `venterraliving.com/apartments/...` prefix projects when the matrix target differs
- reports current standalone property projects that should not receive a future prefix project until the governed identity matrix `website_url` moves to that prefix
- reports review-only live Ahrefs projects that do not resolve cleanly through the governed matrix

Agents must review the dry-run plan before apply, especially when existing Ahrefs projects use standalone domains that differ from the identity matrix `website_url`.

As of 07/20/2026, Ahrefs documents `POST /v3/management/projects` as supporting project creation and `PATCH /v3/management/update-project` as supporting access changes only. Project name, target URL, protocol, and mode edits are therefore treated as manual/UI reconciliation or future API work, not automated mutations from this script.

## Competitor Administration

Ahrefs project competitors are administered through `/Users/mark/Property_Analytics/scripts/ahrefs_competitor_admin.py`.

The script:

- reads canonical Ahrefs projects from local `ahrefs_projects`
- matches those projects back to the governed property identity matrix by exact normalized target
- reads local competitor sets from `property_competitors` joined to `competitors`
- resolves `property_competitors.property_id` through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`
- writes a dry-run plan under `/Users/mark/Property_Analytics/reports/ahrefs_admin/`
- calls Ahrefs `GET /v3/management/project-competitors` before every mutation
- adds only missing competitors when run with `--apply --confirm ADD_AHREFS_COMPETITORS`
- sends root competitor targets as `mode=subdomains`
- sends path competitor targets as `mode=prefix`
- skips blank/malformed competitor URLs, duplicate targets for the same property, and exact self-targets

As of 07/20/2026, the follow-up read after the approved competitor apply reported 640 current Ahrefs competitors, 0 remaining additions, 0 Ahrefs read errors, and 0 unresolved property-identity competitor links.

Artifacts:

- Apply: `/Users/mark/Property_Analytics/reports/ahrefs_admin/ahrefs_competitor_apply_20260720T212939Z.json`
- Confirmation dry-run: `/Users/mark/Property_Analytics/reports/ahrefs_admin/ahrefs_competitor_plan_20260720T213015Z.json`

Remaining local competitor URL gaps as of 07/20/2026:

- Clearwater Heights (`KY4CH`)
- French Place (`TX4FR`)
- Monteverde (`TX4MV`)
- Sundara at Spring Cypress (`521906919`)
- The Vine Kyle Parkway (`TX4EK`)
- Town Station Lofts (`NC4CH`)
- Villas Continental (`FL4VC`)

Add or correct the missing competitor URLs in the governed local competitor tables before running another Ahrefs competitor apply.

## Manual Site Audit Crawl Starts

Ahrefs Site Audit crawl starts are not currently supported by the documented public API. The public Site Audit API is read-oriented for project health, issues, page content, and page explorer data. Live 07/20/2026 probes returned `405` for `POST /site-audit/projects` and `404` for likely crawl-start endpoint shapes.

When Mark explicitly authorizes manual crawl kickoff:

- use the authenticated Ahrefs web UI
- open each target project at `/site-audit/{project_id}/project-history`
- click `Run crawl` when the button is present
- treat `Starting`, `Stop crawl`, existing project history, or final `Completed` status as already handled
- write a run artifact under `/Users/mark/Property_Analytics/reports/ahrefs_admin/`
- verify through `GET /site-audit/projects`
- refresh local `ahrefs_site_audit_project_health` through the canonical collector normalizer/upsert path

07/20/2026 run artifact: `/Users/mark/Property_Analytics/reports/ahrefs_admin/ahrefs_site_audit_manual_crawl_start_20260720T205336Z.json`. Final status reported 105 projects, 105 `Completed`, 105 crawl dates, and 0 no-crawl projects.

## Charged Endpoint Rule

Charged Ahrefs endpoints are not part of the default daily collector. This includes Site Explorer, Keywords Explorer, Rank Tracker, Brand Radar, Batch Analysis, SERP Overview, and other unit-consuming API calls.

Before enabling charged endpoints:

1. define the business question and output consumer
2. estimate request count and unit cost
3. set a cadence and project/property scope
4. add storage schema and QA thresholds
5. document the endpoint in this contract or a dated addendum

## First-Pass Uses

- portfolio project roster and coverage tracking
- technical SEO/site-audit health monitoring
- daily Ahrefs Web Analytics availability and summary stats
- daily Ahrefs GSC Insights availability and summary stats
- domain authority snapshots with required Ahrefs attribution when surfaced externally
- readiness checks for property website launches and migrations

## Current Known Limitations

As of the initial connection on 07/20/2026:

- the account has an Enterprise yearly subscription and a 2,000,000 workspace-unit limit
- free endpoint testing left API usage at 0 units
- after the approved 07/20/2026 rollout, 105 Ahrefs projects exist and all 93 governed identity-matrix property projects have canonical project coverage
- Rank Tracker keyword count is 0 across the current project set
- no Social Media channels are connected
- Ahrefs GSC Insights returned current-window data for only one project in the initial probe
- some Ahrefs project targets do not yet resolve through the property identity matrix
- name/target reconciliation for pre-existing standalone and pilot projects remains manual/UI or future API work because the public update endpoint documents access updates only

## Validation

Required checks after source changes:

- `python3 -m py_compile utils/ahrefs_auth.py Data_Collection/collectors/ahrefs_collector.py Data_Collection/orchestration/daily_master_collection.py Data_Collection/utils/source_freshness_policy.py`
- `python3 -m py_compile scripts/ahrefs_project_admin.py`
- `python3 -m py_compile scripts/ahrefs_competitor_admin.py`
- `bash scripts/check_property_identity_governance.sh`
- `bash scripts/check_pib_guardrails.sh`
- `bash scripts/check_context_discipline.sh`
