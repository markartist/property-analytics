# DataForSEO SERP Source Contract

Date: 2026-04-28
Owner: Data Pond + Search Intelligence + Captain's Log

## Purpose

DataForSEO is the governed live SERP evidence route for Spotlight, Captain's Log,
and Search Intelligence. It is not a replacement for GSC, GA4, Ads, or the
Marketing BI packet. It answers a different question: what Google is showing now
for a selected property and keyword set.

For Captain's Log use, DataForSEO is part of the Navigator evidence stack. It
must be interpreted alongside Specs, live HTML/content evidence, GSC, GA4, GBP,
reviews, and property memory. DataForSEO can show the symptom; Specs and the
Captain's Log help decide the exact fix.

## Source Authority

- DataForSEO is authoritative for live SERP composition, ranking position, result
  type, visible competitor/aggregator domains, and local-pack presence at the
  requested location/device/depth.
- GSC remains authoritative for owned search impressions, clicks, CTR, and
  average position from Google's Search Console data.
- GA4 remains authoritative for on-site behavior after traffic arrives.
- Google Ads remains authoritative for paid media spend, keywords, clicks, and
  conversions.
- Data Pond property identity is authoritative for property code, GA4 id, GSC
  URL, app community id, and aliases.

## Local Storage

Schema migration:

- `/Users/mark/Property_Analytics/apps/api/migrations/0032_create_dataforseo_serp_tables.sql`

Remote D1 migration:

- `/Users/mark/Property_Analytics/infra/migrations/019_create_dataforseo_serp_tables.sql`

Tables:

- `dataforseo_serp_runs`: one API task per property / keyword / location /
  device / day, including cost, status, raw evidence path, and source identity.
- `dataforseo_serp_results`: normalized result rows from each SERP task,
  including type, rank, domain, title, URL, description, target-domain flags, and
  raw item JSON.
- `dataforseo_property_keyword_rankings`: Captain-friendly read model with one
  row per property / keyword / location / device / day, including best target
  rank, result type, target URL, local-pack flags, result count, and cost.

Additional enrichment schema:

- `/Users/mark/Property_Analytics/apps/api/migrations/0033_create_dataforseo_enrichment_tables.sql`
- `/Users/mark/Property_Analytics/infra/migrations/020_create_dataforseo_enrichment_tables.sql`

Additional enrichment tables:

- `dataforseo_keyword_metrics`: Google Ads keyword demand, CPC, competition, and
  monthly-search context.
- `dataforseo_labs_ranked_keywords`: DataForSEO Labs ranked keyword discovery
  for a target domain/page.
- `dataforseo_onpage_page_snapshots`: OnPage Instant Pages page-quality and
  technical/content checks.
- `dataforseo_business_profiles`: live Google business profile facts from
  Business Data.
- `dataforseo_ai_visibility_probes`: AI Optimization prompt/response visibility
  probes.

The future Captain Navigator Dossier should also retain backlink detail and LLM
Mentions evidence, because the 04/29/2026 AR4PB trial proved both lanes are
useful for authority and AI-visibility reads.

## Collector

Collector path:

- `/Users/mark/Property_Analytics/Data_Collection/utils/dataforseo_serp_ingest.py`

Deep trial runner:

- `/Users/mark/Property_Analytics/scripts/run_dataforseo_spotlight_deep_trial.py`

Credential source:

- Keeper record: `DataForSEO API Credentials`
- Helper: `/Users/mark/Property_Analytics/utils/dataforseo_auth.py`

Default run:

```bash
python3 Data_Collection/utils/dataforseo_serp_ingest.py --max-keywords-per-property 1
```

By default, the collector uses the active April 2026 Spotlight configuration:

- `/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/monthly_spotlight_properties_2026-04.json`

## Initial April Spotlight Load

Initial live run date: 2026-04-28

- Properties: 23
- SERP tasks stored: 23
- Normalized SERP result rows: 574
- Property keyword rankings with target found: 17
- Total DataForSEO cost: $0.0805
- Raw evidence path:
  `/Users/mark/Property_Analytics/reports/dataforseo/2026-04-28/dataforseo_serp_2026-04-28_751483f3f1859f994dbe7a295905b97e.json`

Location enrichment:

- On 2026-04-28, the local `properties` table was backfilled to 93/93
  city/state coverage using `config/gbp_location_names.json` for city and
  property-code / Encasa-region / Spotlight-registry evidence for state.
- The property identity matrix now carries `city` and `state`, and
  `resolve_property_identity()` exposes those fields to DataForSEO and Captain
  workflows.
- The collector now generates local-market keyword candidates such as
  `apartments in Bentonville AR`, `Bentonville apartments`,
  `luxury apartments Bentonville AR`, and
  `pet friendly apartments Bentonville AR` when city/state are available.

## Deep Trial Note

On 2026-04-28, a deep trial for `AR4PB` / The Pointe Bentonville proved Keyword
Data, DataForSEO Labs, OnPage, Business Data, and AI Optimization as usable
enrichment lanes for the Captain's Brief/Log. Backlinks returned subscription
access denied, and subsequent paid calls returned `40200 Payment Required` after
trial credit exhaustion.

Report:

- `/Users/mark/Property_Analytics/reports/dataforseo/deep_trial/2026-04-28/AR4PB/dataforseo_deep_trial_report.md`

## Backlinks and LLM Mentions Trial Note

On 04/29/2026, Backlinks and LLM Mentions trial subscriptions were active for
AR4PB / The Pointe Bentonville. The focused Captain fact-finding run proved a
portfolio-ready Navigator Dossier pattern:

- SERP and keyword position
- keyword demand, CPC, and competition
- OnPage title/meta/H1/content/link/image checks
- Google Business Profile/entity facts
- backlink summary and backlink/referring-domain detail
- direct AI response probing
- LLM Mentions topic memory
- Specs-to-live-site action recommendations

The focused test cost approximately `$0.5245`. That makes a monthly
portfolio-wide Navigator read plausible, with weekly deep reads reserved for
recovery/watchlist properties.

Fact-finding report:

- `/Users/mark/Property_Analytics/reports/dataforseo/fact_finding/2026-04-29/AR4PB/pointe_dataforseo_captain_fact_finding_2026-04-29.md`
