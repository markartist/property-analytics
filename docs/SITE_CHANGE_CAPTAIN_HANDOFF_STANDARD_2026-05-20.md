# Site Change Captain Consultation And Handoff Standard

Status: Active SOP
Date: 2026-05-20
Owner: MarketingOps / Data Pond / Site Content Creator / Captain Runtime

## Purpose

Any material change to a property website changes the Captain's operating reality model. The Captain should not discover site changes indirectly through later performance movement, and should not be treated as a passive recipient after the decision is already made.

This standard requires Captain consultation before meaningful public-site changes and Captain handoff after publish so property memory, Navigator watch, proof loops, and future briefs stay current.

## Operating Principle

The Captain should know the property best.

Before site copy, metadata, CTA, routing, offer, reputation, floorplan, neighborhood, or conversion-path changes are finalized, the property Captain should be consulted as the property-memory owner. The Captain's job is to reconcile the proposed change against:

- current operating facts
- known inventory/floorplan pressure
- prior recommendations and failed attempts
- reputation and resident-friction themes
- source/channel behavior
- market and competitor context
- Specs and live-site reality
- open actions, blockers, and proof loops

The Captain does not replace human approval or Data Pond truth. The Captain provides the property-specific read that should inform the change before it goes live.

## Trigger

Create a Captain consultation before approval, and a Captain handoff after publish, when any property site change affects:

- title, meta, OG/Twitter metadata, canonicals, robots, schema, or indexability
- hero, H1, upper copy, primary romance copy, FAQ, reviews/reputation copy, offer/specials copy, or neighborhood/location copy
- CTAs, phone links, tour/apply/quote paths, forms, source tracking, DNI, or conversion routing
- floorplan/unit/pricing/specials display, availability visibility, or package/value presentation
- navigation, page structure, templates, page sections, render behavior, mobile layout, speed/CWV-sensitive elements, or media modules
- GBP/social/site channel content that is meant to support the same leasing message

Minor typo fixes that do not change meaning can be logged in the editing system without a Captain handoff. If the change could affect prospect understanding, search visibility, conversion behavior, routing, or reputation posture, the Captain should be engaged.

## Required Handoff

## Required Pre-Change Consultation

Before approval/publish, the consultation should ask the Captain:

- Does this change match the property's current recovery or leasing priority?
- Does it address the correct floorplans, audiences, objections, and conversion paths?
- Does it conflict with current Data Pond facts, availability, pricing, concessions, reviews, or known operations issues?
- Does it preserve what has already been learned from prior site/content/source actions?
- What proof should be checked after publish?
- Should Navigator, Engineer/Experience Watch, Signals, Reputation Watch, or Boatswain own follow-up?

The answer can be lightweight, but it must be captured or referenced so the Captain's recommendation is not lost.

## Required Post-Change Handoff

The handoff after publish must include:

- property identity: property code, canonical name, page URL
- change type and changed fields
- publish timestamp and first full post-change day
- old vs new summary, or a link to the source artifact
- reason/hypothesis for the change
- target queries, audiences, floorplans, offers, or conversion paths affected
- what the Captain should remember
- proof sources and first check dates
- known risks, stale tags, validation gaps, or follow-up cleanup

## Captain Responsibilities

The property Captain should:

- participate before meaningful changes are approved
- update Captain memory with what changed and why
- assign Navigator follow-up for content, SEO, metadata, schema, and Specs alignment
- assign Engineer/Experience Watch follow-up when rendering, forms, CTAs, mobile, or tracking could be affected
- assign Signals/Funnel Watch follow-up when paid, source, organic, or lead-routing behavior may move
- reconcile the change against current Data Pond facts and prior Captain expectations
- preserve the result for the next Captain Brief, Watchlist read, PIB-family read, or Commodore update

## Proof Windows

Default proof expectations:

- same day: live source/render verification, metadata/schema/CTA/path check
- first full post-change day: mark the clean measurement start
- T7: early GSC/GA4 directional read where source freshness allows
- T14: stronger read for query and organic behavior
- T30: normal impact read for content/search changes

If the change affects conversion routing, forms, tracking, phone/DNI, or Apply/Tour/Quote paths, do not wait for T7. Run EVS, BrowserStack, or equivalent validation as soon as practical.

## Implementation Route

Use the most specific governed lane:

- Copy/title/meta/FAQ/content changes: Copy Change Monitoring plus Captain handoff.
- Public baseline/diff detection: Website Change Watch plus Captain handoff.
- Site Content Creator approved rewrites: Site Content Creator work item plus Captain handoff.
- Edge or A/B experiments: Edge Experimentation governance plus Captain handoff.
- Form/CTA/tracking changes: EVS / Experience Watch plus Captain handoff.

If Captain runtime/watch tables are available in the operating environment, create or update the Captain watch/action item there. If not, write a local handoff note under:

- `/Users/mark/Property_Analytics/reports/captains_log/copy_change_alerts/`

## Boundary

This is an operating-memory and proof-loop SOP. It does not create a new report family, does not replace Site Content Creator, and does not mutate locked PIB behavior.
