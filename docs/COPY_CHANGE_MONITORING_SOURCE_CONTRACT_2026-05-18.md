# Copy Change Monitoring Source Contract

Date: 2026-05-18
Owner: MarketingOps / Data Pond / Site Content Creator
Status: Active local source route

## Purpose

Copy Change Monitoring is the governed local tracking route for permanent website copy, title, meta, FAQ, and CTA changes. It keeps the executive `Copy Change Impact Brief` readable while storing the underlying measurement evidence locally.

This is not a new PIB renderer and it does not change locked PIB behavior.

Named recurring recovery workflow: `Copy Change Recovery Lane`.

The Recovery Lane is documented in `/Users/mark/Property_Analytics/docs/COPY_CHANGE_RECOVERY_LANE_2026-06-10.md`. Use it when the daily Copy Change Impact Brief identifies Act Now / worst-performing copy-change properties that need a rank-focused rewrite, live verification, Pond registration, Captain handoff, and a test report/email before the next daily cycle.

## Approved Email Template

Current approved daily email presentation: `Copy Change Impact Brief v1.3`.

Current daily scope rule as of 2026-07-01: the default email property filter follows the current active monthly Spotlight roster plus explicitly retained action exceptions. Historical copy-change interventions remain in the local registry and JSON history, but graduated non-Spotlight properties should not stay in the daily executive cards unless they are intentionally retained for investigation or recovery.

Template v1.3 requirements:

- Keep the daily email as an at-a-glance executive read while writing full evidence to JSON artifacts and `copy_change_observations`.
- Replace raw top status cards with decision cards: Act Now, Promising, Watch, and Too Early.
- Include an Executive Read block naming the properties that need action, the promising properties, watch-only properties, and the most common performance driver.
- Render each property as an at-a-glance pulse card: property name, post-change start/source depth, change note, status pill, decision read, and compact metrics strip.
- Place the status pill below the change note and above the metrics strip.
- Add one compact decision read per property: action label, confidence label, short driver, next recommendation, and watch/confound flags.
- Keep the compact metrics strip as four chips: Since Change, T7, T14, and T30.
- Render GSC and GA4 values on separate lines inside each metrics chip; do not use pipes in the chip values or chip notes.
- Show milestone metrics only when the full shared window is live. Otherwise show `Pending` and `Awaiting full window`.
- Render only one visible card per property. If more than one active intervention exists for a property, the email keeps the latest active intervention while preserving older interventions and observations in the local registry/history.
- Resolve requested property filters through the governed property identity matrix so common aliases such as `Elation`, `The Pointe at Bentonville`, and `Anatole - Daytona` match their registered interventions.
- Use local supporting evidence to keep recommendations reliable: GSC query cohorts, GA4 Organic Search, unit availability/specials, Google Ads data freshness, and DataForSEO on-page checks where available.
- Store per-property decision metadata in the generated JSON under `decision`, including action, confidence, driver, recommendation, watch flags, query signal, and supporting context.
- If another collector temporarily holds the SQLite write lock, still generate and send the v1.3 brief from latest readable canonical data; record `write_limited` and `write_warnings` in the JSON when optional registry/observation writes are skipped.

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
- `copy_wave_2026_06_10_act_now_rank_revisions`

Recovery Lane wave names should use:

`Copy Change Recovery Lane - <date/context>`

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
- The executive email stays at-a-glance. It shows compact property pulse rows with a smaller critical metrics strip and one decision read; local JSON artifacts and observation tables hold the detail.
- Immature milestone periods must not show partial counts or imply a clean read before enough shared post-change history exists. Milestone labels appear only when that period is live; otherwise the email uses a plain pending note.

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
