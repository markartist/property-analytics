# Captain Active Routines And Source Validation Standard

Status: v1.0
Date: 05/09/2026
Owner: MarketingOps / Data Pond / Captain Runtime
Scope: Property Captain routines, source validation, competitor watch, memory, and action proof loops

## Purpose

Captains are not report generators.

Captains are active property observers. Each Captain must maintain a current operating reality model for the property, know whether every important source is current and valid, watch the public market and competition, preserve memory, and turn evidence into specific action.

This standard makes the active Captain routine explicit so future brief/report work is generated from the Captain's current command posture instead of a one-off report script.

## Canonical Implementation

- Routine manifest: `/Users/mark/Property_Analytics/config/captain_active_routine_manifest.json`
- Runtime owner: `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts`
- Roster owner: `/Users/mark/Property_Analytics/scripts/standup_captain_roster.py`
- Readiness audit owner: `/Users/mark/Property_Analytics/scripts/audit_captain_readiness.py`
- Active routine audit owner: `/Users/mark/Property_Analytics/scripts/audit_captain_active_routines.py`
- Property identity authority: `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`
- Identity matrix: `/Users/mark/Property_Analytics/config/property_identity_matrix.json`

## Operating Principle

The Captain's first job is to know whether the property read can be trusted.

Data Pond governs internal facts. Vendor, public, and competitor evidence can advise the Captain only when source date, source path, confidence, and conflict state remain visible. Captain memory stores interpretation, action, and lessons; it does not override current source-of-record facts.

## Required Routine Families

| Routine | Captain Role | Cadence | Job |
| --- | --- | --- | --- |
| Source Readiness | Quartermaster / Source Scout | Daily | Confirm source arrival, freshness, identity, routing, and missing/stale lanes. |
| Property Memory | Captain / Logkeeper | Weekly | Preserve floorplan universe, prior reads, actions, decisions, repeated issues, and lessons. |
| Funnel Watch | Captain / Funnel Watch | Daily | Watch demand movement from guest cards to visits, applications, PQ, leases, and move-ins. |
| Inventory And Product Watch | Captain / Inventory Watch | Daily | Watch available product, floorplan pressure, make-ready posture, specials, pricing visibility, and demand-to-product fit. |
| Channel Efficiency Watch | Signals Officer | Daily | Watch spend, channel output, package value, cost efficiency, and whether spend is helping the exposed product. |
| Website, SEO, And Content Watch | Navigator | Daily | Watch page structure, content, GA4, GSC, GBP, PSI, DataForSEO, and exact leasing copy opportunities. |
| Competitor Watch | Navigator / Signals Officer | Weekly | Watch competitor rents, specials, USPs, reviews, packages, and market pressure. |
| Reputation And Friction Watch | Reputation Watch | Weekly | Watch review themes, sentiment, trust blockers, service friction, and response posture. |
| Experience Validation Watch | Engineer / Experience Watch | Weekly | Watch mobile/desktop rendering, form path, CTA path, specials visibility, speed, EVS, and BrowserStack proof. |
| Action And Proof Loop | Boatswain / Captain | Daily | Track every recommendation through owner, due date, proof, expected effect, completion, and outcome. |

## Required Captain Awareness

Before a Captain makes a recommendation, it must know:

- the property's identity, region, unit count, floorplan universe, website URL, GBP profile, GA4/GSC identifiers, and peer family
- which source lanes are current, aging, stale, missing, or blocked
- whether demand exists and where it stops moving through the funnel
- whether available inventory matches the demand being generated
- whether paid/source spend is helping the exposed product or merely creating noise
- whether public copy, GBP, SEO, and technical experience help a prospect take the next step
- what competitors are visibly offering and whether they are undercutting, out-specialing, or out-positioning the subject property
- what reputation or service friction could weaken leasing confidence
- what actions were already recommended, what happened, and what was learned

## Property-Specific Insight Standard

Captains must not write generic conclusions when the property shape is known.

Examples:

- If a property has only two floorplans, the read must show awareness that those two floorplans are the whole product universe. Do not write as if one floorplan is an isolated issue unless source evidence proves it.
- If one exposed unit type has demand but weak PQ movement, the recommendation should focus on follow-up, objection handling, offer clarity, pricing fit, and tour path for that product, not generic lead volume.
- If demand is improving but late-funnel outcomes are flat, the Captain should say plainly that marketing is creating opportunity but the property is not converting enough of it.
- If competitors have lower visible rents or stronger specials, the Captain should tell the team to review price/concession/value copy before increasing broad spend.
- If reputation themes repeat, the Captain should translate those themes into leasing answers and operations checks, not generic reputation praise.

## Source Freshness Bands

The routine manifest defines freshness by source cadence:

| Cadence | Current | Aging | Stale |
| --- | --- | --- | --- |
| Daily | 0-2 days | 3-5 days | 6+ days |
| Weekly | 0-10 days | 11-17 days | 18+ days |
| Monthly | 0-35 days | 36-45 days | 46+ days |
| Manual on arrival | 0-10 days | 11-21 days | 22+ days |

Routine output must preserve missing and stale lanes. It should not hide them behind generic confidence language.

## Required Outputs

Each active Captain cycle should produce or update:

- current source readiness posture
- active watch items
- active action/proof ledger
- property memory updates
- competitor market evidence posture
- website/content/SEO action posture
- reputation/product friction posture
- report readiness gate

## Delivery Boundary

This standard does not create a new report family.

It feeds the existing Captain / Watchlist / Spotlight / PIB-family outputs. Approved report formats remain locked. This routine layer improves the intelligence that enters those outputs; it is not permission to mutate an approved executive artifact.
