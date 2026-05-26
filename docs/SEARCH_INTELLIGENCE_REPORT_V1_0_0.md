# Search Intelligence Report v1.0.0

**Date:** 2026-04-14
**Status:** Active versioned Data Pond report
**Scope:** Single-property search intelligence brief

## Purpose

This report packages keyword performance, competitor keyword gaps, market head terms, and paid/organic alignment into a PIB-style brief for one selected property.

It is intentionally separate from locked PIB generation and rendering.

## Canonical Paths

- API route: `/Users/mark/Property_Analytics/apps/api/src/routes/search-intelligence.ts`
- Web builder: `/Users/mark/Property_Analytics/apps/web/src/app/analysis/search-intelligence/page.tsx`
- Client helper: `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`

## Inputs

- `communities`
- `semrush_keyword_rankings`
- `gsc_queries`
- `google_ads_keywords`
- `property_competitors`
- `competitors`
- live SEMrush `domain_organic` pulls via Worker secret `SEMRUSH_API_KEY`

## Deployment Notes

- The API Worker requires `SEMRUSH_API_KEY` at runtime or the route will fail closed with a config error.
- Keeper is the source of truth for that secret in this repo.
- Canonical notation:
  - `KSM_PROFILE=marketingops`
  - `KSM_SEMRUSH_API_KEY_NOTATION=keeper://q1dizD20qVFSS1ZCYoRPEw/field/password`
- Preferred Worker injection path:
  - `bash /Users/mark/Property_Analytics/scripts/zero_trust_worker_secret_cutover.sh --apply`

## Outputs

- PIB-style HTML preview in Data Pond
- HTML attachment
- Markdown attachment
- JSON attachment
- optional email send to a provided recipient

## UX Model

- single-property selector from the community list
- optional email recipient
- generate preview
- download HTML, Markdown, or JSON
- send through the app email flow

## Version Notes

### v1.0.0

- first app-native Search Intelligence report
- app/API implementation rather than local-script-only workflow
- fixed single-property workflow to match the requested operating model
- uses live SEMrush plus local warehouse context
