# Copy Change Monitoring Source Contract

Date: 2026-05-18
Owner: MarketingOps / Data Pond / Site Content Creator
Status: Active local source route

## Purpose

Copy Change Monitoring is the governed local tracking route for permanent website copy, title, meta, FAQ, and CTA changes. It keeps the executive `Copy Change Impact Brief` readable while storing the underlying measurement evidence locally.

This is not a new PIB renderer and it does not change locked PIB behavior.

## Source Authority

Data Pond is authoritative for:

- copy-change waves
- property/page interventions
- publish timestamps and first full post-change days
- local observation rows
- GSC, GA4, GSC query, and future DataForSEO/PSI/EVS evidence tied to the intervention

Site Content Creator is authoritative for:

- section-level old copy and proposed copy
- title/meta/H1/FAQ/CTA rewrite state when managed through the content workspace
- Specs section identity and page-section context

Website Change Watch is authoritative for:

- public baseline snapshots
- field-level diffs
- high-risk public-site change detection

DataForSEO is advisory for:

- keyword/ranking/SERP environment validation
- on-page evidence
- search demand and competitive context

Captain and Watchtower consume the monitoring output for progress, follow-up, and action awareness.

Captain consultation is required before a meaningful copy-change approval, because the property Captain should know the property best. Captain handoff is also required when a property is added to an active copy-change wave or when the tracked fields materially change. The consultation/handoff should tell the property Captain, Navigator, and Logkeeper:

- which property/page changed
- publish timestamp and first full post-change day
- changed fields, target queries, and hypothesis
- what the Captain should remember
- which proof sources will confirm the effect

If Captain runtime/watch tables are available in the operating environment, create or update the Captain watch/action item there. If they are not available locally, write a local handoff note under `reports/captains_log/copy_change_alerts/` and reference it in the next Captain/Commodore read.

## Local Tables

The local SQLite database at `/Users/mark/Property_Analytics/data/portfolio_analytics.db` now carries:

- `copy_change_waves`
- `copy_change_interventions`
- `copy_change_observations`

The tables are created by:

- `/Users/mark/Property_Analytics/Data_Collection/utils/copy_change_monitoring.py`

The current daily report reads and writes through:

- `/Users/mark/Property_Analytics/scripts/send_copy_change_impact_brief.py`

New interventions are registered through:

- `/Users/mark/Property_Analytics/scripts/register_copy_change_intervention.py`

## Concepts

### Wave

A batch of changes with a shared operational context.

Examples:

- `copy_wave_2026_04_17`
- `copy_wave_2026_05_18`

### Intervention

One property/page/change inside a wave.

Required fields:

- governed property identity
- page URL
- publish timestamp
- first full post-change day
- changed fields
- target queries or intents where known
- hypothesis
- confounds where known

### Observation

One local metric row tied to an intervention, observation date, window, source, scope, and metric.

Current stored scopes:

- `gsc/property_aggregate`
- `ga4/organic_search_property_aggregate`
- `gsc_queries/query_cohort:brand`
- `gsc_queries/query_cohort:local_non_brand`
- `gsc_queries/query_cohort:amenity_floorplan`
- `gsc_queries/query_cohort:non_brand_other`

## Active Seed

The existing April 17, 2026 copy-change cohort is seeded into the registry as:

- `copy_wave_2026_04_17`

Tracked seeded interventions:

- Fairways at South Shore
- Townhomes at Lake Park
- The Pointe Bentonville
- Elation at Grandway West
- The Anatole
- Forest View

## Measurement Rules

- If a change is published during the day, the first full post-change day is the next day.
- Pre-window comparison ends the day before the publish day.
- GSC and GA4 lag independently, so the report keeps source-specific post-change depth.
- T7, T14, and T30 are read per intervention, not globally.
- The executive email stays summary-level. Local tables hold the detail.

## Adding A New Change

Example:

```bash
python3 scripts/register_copy_change_intervention.py \
  --wave-id copy_wave_2026_05_18 \
  --wave-name "May 18, 2026 Copy Changes" \
  --change-date 2026-05-18 \
  --property "Forest View" \
  --publish-timestamp "2026-05-18T15:00:00-05:00" \
  --changed-fields "title,meta,h1,hero,romance,faq" \
  --target-queries "apartments in katy tx,pet friendly apartments katy tx" \
  --hypothesis "Improve non-brand organic discovery and organic lead quality."
```

Then generate the report:

```bash
python3 scripts/send_copy_change_impact_brief.py --no-send
```

Then consult and alert the Captain:

1. Consult the property Captain before approval/publish when the change is still editable.
2. Create or update the Captain watch/action item when Captain runtime tables are available.
3. Otherwise, create a local Captain handoff note under `reports/captains_log/copy_change_alerts/`.
4. The handoff must identify the first full post-change day, changed fields, target queries, and follow-up proof windows.

## Integration Boundaries

- Permanent CMS/site copy changes use this source route.
- True A/B tests or edge-served variants remain under Edge Experimentation.
- Website Change Watch should feed public baseline/diff evidence into this lane when available.
- Site Content Creator should remain the editing and approval workspace for section-level copy.
- PIB may consume conclusions, but this capability must not mutate canonical PIB generator, template, or sender files.
