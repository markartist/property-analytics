# Briefing Family Architecture

Status: Draft v1
Date: 2026-04-18
Owner: MarketingOps / Property Analytics

## Purpose

Define the governed architecture for the platform’s briefing family so PIB, POP Brief, and Spotlight stop behaving like loosely related adjacent systems.

This architecture does **not** change locked PIB generation or rendering behavior.

## Governing Rule

There is one reporting family, not three competing briefing systems.

That family has distinct members with distinct roles:

- PIB = canonical property intelligence brief engine
- POP Brief = structured property-operations performance brief system
- Spotlight = specialized, imported, rotating executive attention report

## Family Roles

### 1. PIB

Canonical role:

- protected canonical property intelligence briefing engine

Primary home:

- `/Users/mark/Property_Analytics/Property_Intelligence_Brief/`
- `/Users/mark/Property_Analytics/apps/web/src/app/pib/`

What PIB owns:

- canonical property intelligence brief generation
- protected rendering and delivery standards
- governed property-brief output for the core PIB lane

What PIB must not become:

- a catch-all family for every other briefing use case
- a place where adjacent brief systems silently fork the locked renderer

### 2. POP Brief

Canonical role:

- structured operations performance briefing system

Primary home:

- `/Users/mark/Property_Analytics/POP_Brief/`

What POP Brief owns:

- controlled operational performance briefing workflows
- weekly and rolling-window property/community and portfolio operational context
- imported adjacent architecture that remains part of the broader briefing family

What POP Brief must not become:

- a shadow replacement for locked PIB
- a hidden parallel product surface with overlapping executive-brief ownership

### 3. Spotlight

Canonical role:

- specialized rotating executive-attention report

Primary home:

- `/Users/mark/Property_Analytics/Spotlight_Properties_Report/`

What Spotlight owns:

- selected-property spotlighting
- specialized imported reporting cadence
- executive focus and rotating attention workflows

What Spotlight must not become:

- the canonical report family shell
- the default place to define briefing architecture

## Pond Representation

The Pond should present the family this way:

- `PIB / POP Brief family` is the canonical briefing outcome
- PIB routes remain the primary governed human surface in the app today
- POP Brief remains a known and governed adjacent system
- Spotlight remains specialized and acceptable while the family is organized

## Enterprise Disposition

### Keep

- locked PIB engine and guarded rendering path
- POP Brief architecture pack
- Spotlight specialized reporting lane

### Consolidate

- family discoverability
- family naming and entry model
- executive understanding of which brief is for which purpose

### Do Not Duplicate

- no new parallel “brief builder” or “executive summary” systems for the same audience/outcome
- no new PIB-style renderer outside canonical PIB without explicit approval

## Recommended User-Facing Family Model

### Pond framing

- `POP Brief` = performance/ops briefing lane
- `PIB Builder` = route into canonical PIB generation and views
- `Spotlight` = specialized executive spotlight lane, known but subordinate to the family model

### Role of Dock

Dock should remain the canonical discoverability layer for this family.

## Next Moves

1. keep PIB protected and unchanged unless explicit approval is given
2. keep POP Brief known and governed, but subordinate to one family architecture
3. keep Spotlight specialized and discoverable, but not a competing canonical owner
4. continue surfacing the family through Pond-native navigation rather than through scattered repo-local entry points
