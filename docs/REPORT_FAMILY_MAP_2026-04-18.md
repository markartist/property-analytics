# Report Family Map

Status: Draft v1
Date: 2026-04-18
Owner: MarketingOps / Property Analytics

## Purpose

Give the platform one fast, enterprise-readable map of what each major report family is for.

## Families

### PIB / POP Brief Family

Outcome:

- portfolio and property briefing

Members:

- PIB
- PIB Site Evaluation
- POP Brief
- Spotlight
- Captain's Brief vNext
- Watchlist Decision Output

Current PIB Site Evaluation standard:

- `/Users/mark/Property_Analytics/docs/PIB_SITE_EVALUATION_STANDARD_2026-05-20.md`

Current PIB section catalog / builder standard:

- `/Users/mark/Property_Analytics/docs/PIB_SECTION_CATALOG_AND_BUILDER_STANDARD_2026-05-22.md`
- `/Users/mark/Property_Analytics/config/pib_section_catalog.json`

Current Captain's Brief vNext memo:

- `/Users/mark/Property_Analytics/docs/CAPTAINS_BRIEF_VNEXT_REPORT_MEMO_2026-05-06.md`

Current Watchlist Decision Output standard:

- `/Users/mark/Property_Analytics/docs/WATCHLIST_DECISION_OUTPUT_STANDARD_V1_0_2026-05-06.md`

Canonical owner:

- PIB / POP Brief family through The Pond

Boundary:

- Captain's Brief vNext is a Captain's Log recovery report and must not mutate locked canonical PIB generator/template/sender files.
- PIB Site Evaluation is the approved executive intro inside property-level canonical PIB v2.2.0 when Data Pond / DataForSEO / BI evidence exists. It must not create a parallel PIB renderer or replace the approved PIB artifact.
- PIB section selection is an approved planning direction for a future self-serve PIB Builder. Section selection must operate through stable section ids and the canonical PIB family rather than a parallel app-side renderer.

### Structured Retrieval Family

Outcome:

- machine-readable property data layer for downstream diagnostic agents

Members:

- VP property retrieval JSON
- internal property diagnostic JSON

Canonical owner:

- Data Collection / Data Pond read models

Current VP contract memo:

- `/Users/mark/Property_Analytics/docs/VP_PROPERTY_RETRIEVAL_JSON_CONTRACT_2026-05-06.md`

Boundary:

- This family retrieves and structures facts. It is not a presentation report family and should not carry report prose or Captain recommendations.

### Daily / Operational Summary Family

Outcome:

- daily operational awareness and issue surfacing

Canonical owner:

- Watchtower + Data Collection

Examples:

- Morning summary and daily operational alerts
- Watchtower operator posture

### Search and Local Insight Family

Outcome:

- search, local presence, and reputation interpretation

Canonical owner:

- Search Intelligence + GBP Posts + GSC surfaces in the Pond

### Pilot / Specialized Families

Outcome:

- pilot and temporary specialized oversight

Accepted specialization:

- `pilot_control_cwv`
- `pilot_roundup`

These are valid, but they do not own the canonical enterprise briefing model.
