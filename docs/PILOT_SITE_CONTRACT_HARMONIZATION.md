## Pilot Site Contract Harmonization

Purpose: promote known pilot-site structure into a shared contract so EVS, site audit, and GSC URL inspection use the same page model.

### Problem

The repo had multiple partial truths:

- EVS / BrowserStack knew broad navigation patterns and could discover interior pages dynamically.
- The Python site audit crawler used sitemap discovery only for `site_type == "resi"`, otherwise it fell back to a legacy 3-page set.
- GSC URL Inspection seeded only homepage, reviews, and gallery unless additional URLs were discovered later.

That caused useful existing knowledge to be underused and led to repeated re-derivation.

### First Harmonization Slice

The five live pilot properties now carry explicit site-contract metadata in the canonical registry:

- `site_type: "resi"`
- `known_page_paths`

Current pilot `known_page_paths`:

- `/`
- `/apartments/`
- `/features/`
- `/amenities/`
- `/gallery/`
- `/neighborhood/`
- `/faqs/`
- `/reviews/`
- `/contact/`
- `/specials`
- `/about/`

These paths were taken from the live site navigation structure observed on the pilot properties.

### Source of Truth

Canonical Python-side source:

- [`config/venterra_properties_official.json`](/Users/mark/Property_Analytics/config/venterra_properties_official.json)

Aligned EVS pilot definitions:

- [`evs/config/pilot-properties.json`](/Users/mark/Property_Analytics/evs/config/pilot-properties.json)
- [`apps/api/src/evs/pilot-properties.ts`](/Users/mark/Property_Analytics/apps/api/src/evs/pilot-properties.ts)

Shared EVS schema now recognizes:

- `site_type`
- `known_page_paths`

in [`packages/shared/src/evs-schemas.ts`](/Users/mark/Property_Analytics/packages/shared/src/evs-schemas.ts)

### Consumers Updated

Site audit crawler:

- Uses `known_page_paths` first
- Falls back to sitemap discovery for `resi`
- Falls back to legacy 3-page behavior only when no richer contract exists

File:

- [`scripts/site_audit/crawler.py`](/Users/mark/Property_Analytics/scripts/site_audit/crawler.py)

GSC URL inspection targeting:

- Seeds inspection targets from `known_page_paths` when present
- Falls back to homepage/reviews/gallery only for older properties without a contract

File:

- [`Data_Collection/orchestration/daily_master_collection.py`](/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py)

### Next Recommended Slice

1. Move EVS selector-pattern defaults and known page paths into one shared site-contract file or generator.
2. Add optional labels per page path, not just URLs.
3. Teach EVS request generation to derive `target_pages` from the same contract.
4. Add contract validation so pilot definitions and registry entries cannot drift.
