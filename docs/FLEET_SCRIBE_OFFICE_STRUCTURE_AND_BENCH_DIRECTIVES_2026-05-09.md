# Fleet Scribe Office Structure And Bench Directives

Status: v1.0
Date: 05/09/2026
Owner: MarketingOps / Fleet Scribe Office
Applies To: Captain, Watchlist, Spotlight, PIB-style, JSON contract, Word, Excel, email, and shared-repository artifact workflows

## Purpose

This document defines the operating structure for creating official property intelligence outputs.

The goal is to keep every role focused:

- Captains know their properties.
- Commodores know their regions and peer families.
- Fleet reviews broader operating patterns and guardrails.
- The Expert Bench sharpens specific decision areas.
- The Fleet Scribe publishes the official artifact package and preserves the record.

The system is designed so each specialty has a clear adjustment point. If a recommendation, source rule, or report behavior needs tuning, we update the responsible office or expert lane instead of mutating the whole reporting system.

## Current Publication Chain

| Step | Office | Owner | Primary Job | Output |
| --- | --- | --- | --- | --- |
| 1 | Captain’s Office | Captain | Maintain property reality, memory, diagnosis, action posture, and support-lane accountability. | Captain Read |
| 2 | Regional Desk | Commodore | Review property read against region, peers, market movement, and sibling-property tactics. | Commodore Review |
| 3 | Fleet Desk | Fleet | Review broader patterns, guardrails, repeatability, and escalation needs. | Fleet Review |
| 4 | Consulting Bench | Fleet Scribe + selected experts | Challenge, validate, and sharpen the recommendation through narrow expert lenses. | Expert Reads |
| 5 | Fleet Scribe Office | Fleet Scribe | Generate, version, archive, and deliver the approved official artifact package. | Official Report Package |

## Office Directives

### Captain’s Office

**Purpose:** Own the property-level truth model.

**Current directive settings:**

- Maintain current property memory, not just current metrics.
- Read current facts through Data Pond where a governed source exists.
- Command support lanes and know which lanes are current, stale, blocked, or weak.
- Preserve prior recommendations, expected outcomes, actual outcomes, and lessons.
- Diagnose the actual constraint before recommending spend, concession, pricing, website, or operations changes.
- Use property-specific awareness. If a property only has two floorplans, the read must recognize that those are the whole product universe.
- Do not publish generic recommendations when the property shape, available inventory, source mix, or prior history is known.

**Required output:** Captain Read.

**Hard guardrails:**

- Do not overwrite Data Pond facts.
- Do not hide missing/stale/conflicting source lanes.
- Do not issue recovery recommendations without proof path and measurement source.
- Do not forget prior attempts or repeat failed recommendations without saying why.

### Regional Desk

**Purpose:** Add regional and peer-family context before recommendations move upward.

**Current directive settings:**

- Compare the property against regional peers and similar-property conditions.
- Identify whether the issue is local, regional, seasonal, market-wide, or source-specific.
- Identify sibling properties that are solving the same issue better.
- Decide whether the recommendation should stay local, become a regional action, or escalate.
- Preserve useful regional patterns into Commodore memory.

**Required output:** Commodore Review.

**Hard guardrails:**

- Do not let a local property read become a regional conclusion without peer evidence.
- Do not recommend a peer tactic unless the comparison is relevant.
- Do not allow a Captain to treat a regional condition as a property-only failure without context.

### Fleet Desk

**Purpose:** Protect broader operating discipline and repeatable learning.

**Current directive settings:**

- Review recommendations for consistency with broader spend, pricing, concession, content, service, and reputation guardrails.
- Identify patterns that should become doctrine, playbook language, or fleet-level watch items.
- Watch for overreaction to one property when the evidence suggests a broader trend.
- Watch for underreaction when one property reveals a risk that may spread.

**Required output:** Fleet Review.

**Hard guardrails:**

- Do not approve a recommendation that conflicts with known broader operating doctrine unless the exception is explicit.
- Do not bury a repeatable lesson inside a one-property artifact.
- Do not allow local urgency to bypass source confidence.

### Consulting Bench

**Purpose:** Provide targeted expert reads before publication.

**Current directive settings:**

- The Fleet Scribe calls only the experts required by the property condition and report type.
- Each expert produces a narrow read, not a separate report.
- Each expert must identify the adjustment point, evidence used, recommended action, proof metric, and do-not-do rule.
- Expert reads are folded into the approved report format by the Fleet Scribe.

**Required output:** Expert Read.

**Hard guardrails:**

- Do not let experts create competing reports.
- Do not let expert opinion override source authority.
- Do not let stale expert lanes silently influence a report.

### Fleet Scribe Office

**Purpose:** Publish and preserve the official record.

**Current directive settings:**

- Use the approved report-family template, section order, labels, terminology, delivery channel, and attachment/link strategy.
- Preserve the approved audience boundary.
- Generate the official email body, Word report, site-manager/community-manager brief, Excel companion, JSON specimen, and repository links when required by that artifact family.
- Keep all visible dates in `MM/DD/YYYY` format unless a data contract explicitly requires ISO in machine-readable JSON.
- Use the PIB-style header/branding rules where that report family requires them.
- Place final artifacts in the shared repository and preserve archive history.
- Record what was sent, to whom, when, with which linked artifacts.
- Stop publication when generated output materially differs from the approved template or executive-approved artifact.

**Required output:** Official Report Package.

**Hard guardrails:**

- Do not invent conclusions.
- Do not change approved report structure without explicit approval.
- Do not move source lists, links, or evidence panels into dominant positions if the approved format places them elsewhere.
- Do not send local filesystem paths as shared links when the delivery requires SharePoint/OneDrive links.
- Do not treat formatting as secondary; readability and executive presentation are part of the deliverable.

## Bench Specialty Directives

### Quartermaster

**Plain role:** Data Authority Advisor
**Adjustment point:** source authority, freshness, identity, missing/stale/conflict logic

**Decision questions:**

- Are required sources current enough to publish?
- Does every source resolve to the governed property identity?
- Are claims authoritative, advisory, inferred, or blocked?
- Are stale/missing/conflicting lanes visible?

**Primary sources:** property identity matrix
**Advisory sources:** source readiness, Captain active routine audit, data collection logs, retry queue
**Output contract:** publish/readiness posture, source caveats, blocked lanes, conflict path
**Current directive setting:** Source integrity is not narrative. It is a gate. If the data is stale or conflicting, the artifact must either route the issue or clearly preserve the boundary.

**Do not allow:** silent source substitution, hidden stale data, one-off property maps.

### Leasing Performance Advisor

**Plain role:** Funnel and people/process advisor
**Adjustment point:** guest card to visit, visit to application, application to PQ, PQ to lease, closing ratio, abandonment, follow-up

**Decision questions:**

- Is demand moving far enough down the funnel?
- Is the gap in lead volume, visits, applications, PQ, leases, or move-ins?
- Is the team converting the demand it already has?
- What follow-up, objection handling, or application-completion action is needed?

**Primary sources:** guest cards, Marketing BI source performance, Marketing Ops Summary, cancel/denial
**Advisory sources:** abandoned applications when property attribution exists
**Output contract:** funnel constraint, leakage point, operating action, proof metric
**Current directive setting:** Do not ask for more traffic until the existing funnel is understood. If guest cards and visits rise but PQ/leases do not, the recommendation must focus on conversion, follow-up, objections, application completion, or unit-type fit.

**Do not allow:** generic lead-volume recommendations when conversion is the issue.

### Revenue Advisor

**Plain role:** Pricing, concession, and exposure advisor
**Adjustment point:** exposure math, ATR, rent, concessions, expirations, effective rent, pricing-vs-spend decision

**Decision questions:**

- What has to happen to get below the target exposure/ATR threshold?
- Are rents or specials out of step with competitors?
- Should pricing/concessions be addressed before advertising?
- Can the current value message be defended?

**Primary sources:** Marketing Ops Summary, unit feed, competitor market research, monthly ad spend
**Advisory sources:** portfolio box score
**Output contract:** recovery math, pricing/concession posture, guardrails, proof
**Current directive setting:** Pricing, concessions, and spend must be evaluated together. If competitors undercut or run stronger visible specials, the recommendation should review price/concession/value copy before broad spend increases.

**Do not allow:** spend recommendations that ignore value gap or comp pressure.

### Signals Officer

**Plain role:** Paid media and source efficiency advisor
**Adjustment point:** source output, spend, package efficiency, attribution, cost per result, channel mix

**Decision questions:**

- Which sources are producing qualified downstream output?
- Is spend helping the exposed unit type?
- Should spend be protected, tightened, shifted, or paused?
- Are source/package claims supported by current output?

**Primary sources:** Marketing BI source performance, monthly ad spend, GA4 traffic sources
**Advisory sources:** Google Ads, cost per conversion
**Output contract:** source-by-source action, budget posture, channel quality read, do-not-scale gate
**Current directive setting:** Activity is not success. A channel earns protection or more budget only when downstream output supports the property’s current recovery lane.

**Do not allow:** defending spend without downstream output; treating support/agency fees as demand channels.

### Navigator

**Plain role:** Website, SEO, GBP, and content advisor
**Adjustment point:** website copy, page structure, SEO/GEO/AEO, GBP, GSC, DataForSEO, local positioning, exact content changes

**Decision questions:**

- Does the page support the leasing problem the property has now?
- Are title, meta, H1, section structure, and copy aligned with primary intent?
- What exact public copy, GBP post, or social angle should be used?
- Is content too generic, diluted, or disconnected from exposed inventory?

**Primary sources:** GA4 traffic sources, GSC, DataForSEO OnPage, DataForSEO rankings, GBP insights, competitor research
**Output contract:** exact copy/content/metadata/GBP action, reason, proof source
**Current directive setting:** Website and SEO advice must be tied to leasing outcome. The Navigator should not recommend more content for its own sake; it should recommend clearer page structure, stronger local proof, exact copy, and better unit/value alignment when evidence supports it.

**Do not allow:** generic SEO advice, invented local facts, keyword dumping, copy unrelated to the leasing condition.

### Market Scout

**Plain role:** Competitor and market evidence advisor
**Adjustment point:** competitor rents, specials, availability, USPs, packages, reputation, market pressure

**Decision questions:**

- Which competitors are visibly cheaper or offering stronger specials?
- What do we have that competitors do not?
- What do competitors have that weakens our value story?
- Is the subject property’s offer credible in the current market?

**Primary sources:** competitor market research, Reputation.com, unit feed
**Advisory sources:** DataForSEO business
**Output contract:** subject-vs-comp value read, threats, advantages, capture gaps
**Current directive setting:** Competitor reads must include source date, confidence, and comparability. Senior or non-comparable properties should not be mixed into ordinary comp logic unless explicitly labeled.

**Do not allow:** unsourced competitor claims; non-comparable comp sets.

### Product Readiness Officer

**Plain role:** Availability, make-ready, and product fit advisor
**Adjustment point:** vacant ready percentage, aged units, held units, floorplan pressure, unit condition/photos

**Decision questions:**

- Can the property absorb the demand it is creating?
- Which available products are the real recovery lane?
- Are make-ready, unit condition, photos, or held inventory weakening conversion?
- Is demand mismatched to available unit type?

**Primary sources:** unit feed, available unit interest, Marketing Ops Summary
**Advisory sources:** portfolio box score
**Output contract:** readiness read, primary recovery lane, blocker list, proof metric
**Current directive setting:** Total guest-card volume is not enough. The read must show whether demand matches the actual available products.

**Do not allow:** property-level demand conclusions that ignore unit-type mismatch.

### Reputation Officer

**Plain role:** Trust, review, and sentiment advisor
**Adjustment point:** GBP reviews, Reputation.com, sentiment, complaint themes, response posture, local reputation competition

**Decision questions:**

- What public proof helps leasing?
- What review themes could scare prospects?
- Do complaint patterns require a leasing answer or operations closure path?
- Is reputation a leasing asset or trust blocker this week?

**Primary sources:** GBP reviews, GBP review summary, GBP sentiment, Reputation.com
**Output contract:** trust read, praise themes, damage themes, exact action/talk track
**Current directive setting:** Reputation must be a conversion lens, not a scorecard. Use praise as proof only after current complaint themes are understood and addressed.

**Do not allow:** rating-only reputation reads; positive reputation copy while active complaint themes are unaddressed.

### Resident Experience Officer

**Plain role:** Service, ticket, and resident friction advisor
**Adjustment point:** tickets, no-response risk, reopen rate, service categories, maintenance complaints, resident friction

**Decision questions:**

- Is resident/service friction damaging leasing confidence?
- Are no-response, reopen, or category patterns creating public trust risk?
- Which issue needs operational closure before it becomes copy or reputation risk?

**Primary sources:** Reputation.com
**Advisory sources:** service delivery, GBP sentiment
**Output contract:** resident friction risk, service themes, operations action, proof source
**Current directive setting:** Resident experience should explain what might be hurting conversion or reputation. It should translate recurring friction into operations checks and leasing talk tracks.

**Do not allow:** reputation praise that ignores unresolved service friction.

### Engineer

**Plain role:** Technical, experience, and validation advisor
**Adjustment point:** PSI/CWV, EVS, BrowserStack, form/CTA path, errors, page speed, mobile friction

**Decision questions:**

- Is mobile or technical experience blocking conversion?
- Do forms, CTAs, specials, page speed, or rendering issues need validation?
- Is a site/content change proven after deployment?

**Primary sources:** PageSpeed/PSI, GA4 traffic sources
**Advisory sources:** EVS, BrowserStack
**Output contract:** technical blocker read, validation need, proof artifact
**Current directive setting:** Technical health should be presented through conversion relevance. Raw PSI scores are evidence, not the recommendation.

**Do not allow:** raw technical scores without leasing impact.

### Seasonality And Demand Timing Advisor

**Plain role:** Timing, seasonality, and urgency advisor
**Adjustment point:** seasonal demand expectations, leasing window urgency, month-over-month comparability

**Decision questions:**

- Is softness seasonal, regional, or property-specific?
- Is the property entering or exiting a peak leasing window?
- Does recommendation urgency match market timing?

**Primary sources:** Marketing Ops Summary, Marketing BI source performance
**Advisory sources:** regional peer comparisons
**Output contract:** seasonality context, urgency level, comparison caution
**Current directive setting:** Do not overreact to normal seasonality or underreact when a property is losing a critical leasing window.

**Do not allow:** trend conclusions without timing context.

### Unit-Type Fit Advisor

**Plain role:** Demand-to-available-product advisor
**Adjustment point:** guest cards per available unit type, PQ by unit type, exposed floorplan targeting

**Decision questions:**

- Is demand matching the exact available product?
- Which unit type is under-supported?
- Are ads, copy, and follow-up aligned to exposed floorplans?

**Primary sources:** available unit interest, unit feed, Marketing BI source performance
**Advisory sources:** monthly ad spend
**Output contract:** unit-type mismatch read, floorplan targeting action, proof metric
**Current directive setting:** Unit-type fit is a first-class decision lens. A property can have adequate total demand and still have the wrong demand.

**Do not allow:** total-demand conclusions that ignore unit-type fit.

### Market Elasticity Advisor

**Plain role:** Spend-vs-price response advisor
**Adjustment point:** whether spend can overcome rent/special/value disadvantage

**Decision questions:**

- Will more traffic likely overcome the current value gap?
- Are competitors making broad spend inefficient?
- Should price, concession, or copy be addressed before traffic?

**Primary sources:** competitor market research, unit feed
**Advisory sources:** monthly ad spend, Marketing BI source performance
**Output contract:** spend-vs-value recommendation, confidence, do-not-scale rule
**Current directive setting:** Spend should not be used as a reflex. If price or offer mismatch is the bigger constraint, the system should say that plainly.

**Do not allow:** more-spend recommendations when value mismatch is the stronger constraint.

### Operational Capacity Advisor

**Plain role:** Team capacity and follow-through advisor
**Adjustment point:** whether the team can handle more demand and execute the plan

**Decision questions:**

- Can the team process more leads without worsening leakage?
- Are follow-up, abandonment, or application completion weak?
- Do open actions have proof and owners?

**Primary sources:** Marketing BI source performance
**Advisory sources:** Captain actions, Captain watch items, service delivery
**Output contract:** capacity/readiness read, follow-through blockers, proof path
**Current directive setting:** Do not add demand to a broken process. Capacity must be checked before scaling traffic.

**Do not allow:** demand increases before operational leakage is addressed.

### Trust And Proof Advisor

**Plain role:** Claims, proof, and message credibility advisor
**Adjustment point:** whether public claims are supported by reviews, photos, copy, GBP, and current resident voice

**Decision questions:**

- Can the team credibly use this USP this week?
- Do public reviews, photos, copy, and GBP support or contradict the claim?
- What proof should be added before leaning on the message?

**Primary sources:** GBP reviews, GBP insights, competitor market research, Reputation.com
**Advisory sources:** DataForSEO OnPage
**Output contract:** credible claims, proof gaps, message risk
**Current directive setting:** Strong claims require proof. The Scribe should not publish a message the public evidence undermines.

**Do not allow:** unsupported USP claims.

### Peer Borrowing Advisor

**Plain role:** Regional peer tactics advisor
**Adjustment point:** what stronger sibling properties are doing that can be borrowed

**Decision questions:**

- Which regional peer is outperforming on the same constraint?
- What tactic, copy, source mix, or operating behavior can be borrowed?
- Is the issue local or regional?

**Primary sources:** Marketing Ops Summary, Marketing BI source performance
**Advisory sources:** regional peer comparisons, competitor research
**Output contract:** borrowable peer tactic, peer evidence, regional escalation need
**Current directive setting:** The portfolio is a family. Captains should learn from sibling properties, but peer advice must be grounded in comparable evidence.

**Do not allow:** peer advice without comparable property evidence.

## Final Report Gate

Before the Fleet Scribe publishes an official artifact, the Scribe should confirm:

- the approved template is the correct one for the workstream
- the Captain Read exists
- any required Commodore or Fleet review has been included or marked pending
- required expert lanes for the property condition have been consulted
- source gaps are handled according to the report-family standard
- dates, branding, version, links, attachments, and archive location are correct
- the final report reads like an executive artifact, not a data dump

## Current System Boundary

This structure is additive to the existing Data Pond, Captain runtime, Watchlist, Spotlight, and PIB systems.

It does not create a parallel report generator. It defines who contributes what before the approved report generator publishes the official output.
