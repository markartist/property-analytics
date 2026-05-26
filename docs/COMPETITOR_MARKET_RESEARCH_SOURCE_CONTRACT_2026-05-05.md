# Competitor Market Research Source Contract

**Date:** 2026-05-05
**Status:** Active planning / first source route
**Owner:** Data Collection + Data Pond + Captain's Log

## Purpose

Competitor research is a governed advisory evidence layer for POP Brief and Captain Brief recovery work. It answers:

- what nearby competitors are advertising
- what rent ranges, availability, and specials are publicly visible
- what differentiators or weak spots should shape pricing, advertising, web copy, and leasing scripts
- which facts are verified, directional, conflicting, stale, or missing

This route exists because competitor facts change quickly. Captain recommendations must not rely on memory, assumptions, or unsourced market lore.

## Source Authority

Competitor market research is advisory. It can support pricing, concession, ad-copy, web-copy, reputation, media, and package-visibility recommendations, but it does not override Venterra operating truth.

Use source labels:

- `confirmed`: directly visible in the cited source on the captured date
- `directional`: useful but not enough to make a hard recommendation alone
- `conflict`: two or more sources disagree
- `missing`: the source needed for a recommendation is unavailable or not captured

No rent, special, rating, package claim, or competitor USP should appear in a report without a source URL and captured date.

## Tables

- `competitor_market_research_snapshots`: one property/market research packet by snapshot date
- `competitor_market_research_observations`: row-level sourced claims for each competitor and evidence category

Observation categories include:

- `subject_position`
- `rent`
- `special`
- `availability`
- `usp`
- `media`
- `package_visibility`
- `reputation`
- `source_gap`

## Current Inputs

Initial manual-research source files live under:

- `/Users/mark/Property_Analytics/Data_Collection/manual_sources/competitor_market_research/`

The first packet is The Pointe Bentonville / Bentonville, AR and uses official property pages and public listing pages captured on 2026-05-05.

## Required Report Logic

Every competitor slice must show:

1. **Comp Set Confidence:** which competitors were included, why, and what source identified them.
2. **Rent / Value Position:** rent range and square-footage comparison where visible.
3. **Specials / Concessions:** exact public concession language, source, and whether it conflicts across sources.
4. **USP Comparison:** what each competitor is selling that a prospect can see before contacting leasing.
5. **Media / Package Visibility:** visible 3D tours, videos, special banners, premium placement clues, and photo depth when available.
6. **Reputation Context:** local competitor reputation from Reputation.com and GBP/listing evidence where captured.
7. **Recommendation Gate:** clear `recommend`, `do_not_recommend`, or `needs_research` posture.
8. **Evidence Ledger:** source URL, source type, captured date, and confidence for every claim.

## Prohibited Behavior

- Do not infer a competitor's current rent from old screenshots, memory, or a non-current report.
- Do not claim a concession is active unless the cited source visibly says so on the captured date.
- Do not decide pricing versus advertising without naming the source basis and the unresolved source gaps.
- Do not treat SERP `people also search` competitors as operating comps without labeling that limitation.

## Captain Use

Captains should use this evidence to:

- decide whether pricing, concession, web copy, or advertising is the more likely lever
- identify copy proof points that should be promoted or rebutted
- flag stale/missing market intelligence as a blocker
- explain why competitor evidence is `confirmed`, `directional`, or `needs_research`

Captains should not spend external API credits directly. Data Collection gathers competitor evidence; Captain consumes mirrored source rows.
