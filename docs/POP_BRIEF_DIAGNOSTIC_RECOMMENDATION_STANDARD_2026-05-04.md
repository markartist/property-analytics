# POP Brief Diagnostic Recommendation Standard

Status: Draft v1
Date: 2026-05-04
Owner: MarketingOps / Property Analytics
Scope: POP Brief, Captain Brief, watchlist recovery plans, and property-level Captain diagnostics

## Purpose

This standard defines how POP Brief and Captain outputs diagnose a struggling property and recommend fixes.

The required posture is not dashboard summarization. The required posture is a sourced operating diagnosis:

- what changed
- why it likely changed
- what should happen next
- who owns the work
- how success will be proven
- which source supports the recommendation

This standard does not change locked PIB generation or rendering behavior.

## Meeting Source

This standard incorporates stakeholder feedback from:

- `/Users/mark/Downloads/Watchlist Organization - Plan - Mark's Agents.docx`
- Meeting date: 2026-05-04
- Core request: give the team a watchlist/spotlight plan that explains what needs to happen over the next 30 days, why the system recommends it, and which data source proves it.

## Governing Principle

The Captain starts closest to revenue and moves upstream only when evidence requires it.

Every diagnostic read must first determine whether the property is constrained by:

- demand
- conversion
- rentable product
- pricing / concession posture
- reputation / experience
- operations / staffing / task execution
- source quality
- peer-family evidence

The Captain should not recommend spend, pricing, copy, or operational action until the primary constraint and confidence level are named.

## Diagnostic Sequence

### 1. Establish Recovery Math

The read must quantify the gap before proposing fixes.

Required questions:

- What is the current occupancy / exposure posture?
- What target threshold is the property trying to reach?
- How many move-ins or exposure reductions are needed?
- At current conversion rates, how many guest cards, visits, and applications are required?
- Is that volume realistic in the next 30 days?

If the needed volume is unrealistic, the brief must say so plainly and recommend a blended recovery plan instead of a traffic-only plan.

Example read shape:

> The property needs 18 move-ins in 30 days. At current guest-card-to-move-in conversion, that would require 420 guest cards, or 2.3x current T30 demand. Traffic alone is unlikely to solve this; conversion and floorplan/pricing action are required.

### 2. Diagnose The Funnel

The Captain must locate the first meaningful breakdown:

- guest cards / leads
- visits
- applications
- leases
- move-ins
- cancellations / denials

The funnel read should compare property performance to regional and portfolio benchmarks where available.

Raw numbers are not enough. The brief must tell the operator whether the number is normal for the region, weak versus portfolio, or meaningfully deteriorating versus the prior window.

### 3. Diagnose Floorplan And Unit Exposure

The Captain must identify whether the recovery problem is broad or concentrated.

Required questions:

- Which bedrooms, floorplans, or unit types drive exposure?
- Are the exposed units ready, upcoming, stale, or blocked?
- What is the median vacant age and are extreme stale units skewing the read?
- Is there market demand for the exposed floorplans?
- Should marketing stop promoting scarce floorplans and focus on exposed inventory?
- Can the action happen at floorplan level, or is unit-level action unavailable?

The recommendation should be floorplan-specific whenever the evidence supports it.

### 4. Diagnose Pricing And Concession Fit

Pricing recommendations require evidence gates.

Required questions:

- Did rents or concessions change in the last 30, 60, or 90 days?
- Did pricing move against the exposed floorplan problem?
- How do effective rents compare against comps?
- Are applications or leases dropping after visits?
- Would a lower effective rent be more useful than more traffic?

The Captain should flag suspicious price increases when inventory says that same unit type is the problem.

### 5. Diagnose Traffic And Source Mix

Traffic recommendations must be tied to source economics.

Required questions:

- Which sources produce guest cards, visits, applications, leases, and move-ins?
- What is cost per guest card, application, lease, and move-in by source?
- Which sources are spending without producing downstream outcomes?
- Is Google spend active, paused, stale, or inefficient?
- What advertising contracts or packages are currently in place?
- Do comments in the monthly advertising spreadsheet change the interpretation of spend?

The Captain should not recommend more spend unless it can explain why the additional spend should produce the needed downstream outcome.

### 6. Diagnose Competitive Visibility

Competitive package reads are directional unless verified through a source/API/login.

Required Apartments.com / ADC checks:

- our package status where available
- competitor visible package indicators
- premium placement clues
- thumbnail / preview size clues
- special-banner visibility
- Matterport / video / media capacity clues
- Apartments.com rating and recent review posture

The Captain must preserve confidence notes because competitors may not use every feature included in a package.

### 7. Diagnose Website, Content, And Media

The Captain must evaluate whether public presentation is helping or hurting conversion.

Required questions:

- Are the images good enough for the product being sold?
- Are interior and exterior photos representing the property with equal quality?
- Are Matterports, videos, and key floorplan media present?
- Does on-page copy reflect the actual selling points?
- Are urgent web-copy or page-structure changes available today?
- Are unique selling propositions clear, local, and relevant?

Website recommendations should include exact copy or page-section actions when possible.

Website content recommendations must choose a posture before prescribing copy:

- `Tighten` when the page is too broad, duplicated, or diluted
- `Split` when one homepage is carrying secondary intents that need distinct child pages
- `Clarify` when metadata, headings, internal links, or first-viewport copy do not cleanly match leasing intent
- `Expand` when the page is thin and needs more proof, pricing context, floorplan differentiation, or original local detail
- `Leave mostly alone` when the page is structurally sound and the constraint is elsewhere

The Captain should not default to “add more copy.” A one-page property site can lose clarity when homepage copy tries to cover homepage, FAQs, neighborhood, commute, employer, inventory, amenities, reviews, team, furnished, and short-term intents on the same document. When that risk appears, recommend a tighter homepage and distinct child pages with unique title tags, H1s, meta descriptions, and descriptive internal links.

Minimum website content output when evidence is available:

- current page role and primary leasing intent
- title tag recommendation
- meta description recommendation
- one true H1 recommendation
- H2/section structure recommendation
- hero/first-viewport copy recommendation
- sections to shorten, remove, or move
- child-page recommendations only when the offering/content is real enough to support a unique page
- fact-block recommendations for address, unit types, pricing range, pet policy, amenities, and nearby landmarks

### 8. Diagnose Reputation And Resident Experience

Reputation should inform revenue risk, not become a vanity-score discussion.

Required questions:

- What do the latest reviews say?
- Are bad recent reviews likely to suppress visits or applications?
- Is rating/review count/review recency weak versus competitors?
- Are response gaps the issue, or is the issue actual resident/prospect experience?
- Do Kingsley move-in satisfaction, curb appeal, communication, or problem-resolution signals explain leasing friction?
- Do SmartDesk tickets show unresolved operational friction?

The brief should avoid front-facing reliance on proprietary Reputation.com score labels. Use the underlying review facts and themes.

### 9. Diagnose Operations And People Constraints

The Captain must check whether the site can execute the plan.

Required questions:

- Are make-readies below the expected threshold?
- Are vacant units being held too long?
- Are hold-time settings creating a mismatch between demand and available units?
- Is the property short-staffed or missing a key role?
- Are there disabled account / staffing alerts?
- Are Anyone Home or Liv tasks past due, unassigned, or not being worked?
- Are closing ratios weak at the property or individual level?

People and task-execution recommendations should be validated with Sales/Operations owners before becoming external directives.

### 10. Diagnose Peer-Family Help

The portfolio is a family. A Captain should not treat a lagging property as an island when sibling properties can provide useful proof.

Required questions:

- Which same-region or same-family peers are performing better on the lagging constraint?
- What makes those peers valid comparisons?
- What are they doing better?
- Which tactic can the lagging property borrow?
- What proof metric will show whether the borrowed tactic worked?

Peer evidence is advisory. A peer can suggest a tactic, but the subject property's Data Pond facts decide whether the tactic applies.

## Recommendation Contract

Every recommendation must carry:

- `constraint`: the primary issue being addressed
- `action`: what should happen
- `owner_role`: who owns it
- `due_date`: when it should happen
- `expected_lift`: quantified if possible, directional if not
- `evidence`: source name, source date, and relevant metric or observation
- `confidence`: high, medium, low, or insufficient
- `proof_check`: how the next cycle will know whether it worked
- `do_not_do`: optional guardrail when a tempting action should be avoided

Recommendations without evidence, owner, and proof path are not brief-ready.

## Confidence Rules

Use `high` confidence when:

- Data Pond source-of-record facts support the diagnosis
- regional or portfolio benchmark confirms the signal
- recent source windows agree
- the action directly addresses the measured constraint

Use `medium` confidence when:

- evidence is directional but not complete
- source windows differ but point the same way
- market or competitor evidence is advisory

Use `low` confidence when:

- source coverage is stale or partial
- inference depends on public scraping or indirect signals
- human validation is needed before action

Use `insufficient` when:

- the system cannot distinguish between traffic, pricing, conversion, inventory, or operations
- source conflict could change the recommendation
- a required source lane is missing

## Do-Not-Recommend Gates

The Captain should explicitly withhold or qualify recommendations when needed.

Common gates:

- Do not recommend more spend if conversion is the primary constraint.
- Do not recommend an Apartments.com upgrade if recent rating/reviews would make the paid exposure inefficient.
- Do not recommend pricing action without comp or floorplan evidence.
- Do not promote scarce floorplans when the exposure problem is concentrated elsewhere.
- Do not recommend broad concessions when only one unit type needs help.
- Do not publish a staffing or individual performance claim without human validation.
- Do not hide missing source lanes behind polished narrative.

## Output Artifacts

The same read model should produce two artifacts.

### Internal Captain Diagnostic

Audience: MarketingOps, analysts, and reviewers.

Includes:

- full recovery math
- source freshness
- source conflicts
- confidence notes
- diagnostic branches considered
- rejected or gated recommendations
- evidence detail

### Property Action Plan

Audience: site, regional, and property operations teams.

Includes:

- the short diagnosis
- the actions to take
- owner and due date
- expected outcome
- proof check

The action plan should be concise enough to send after human review.

## Monthly And Weekly Cadence

Default cadence:

- one full marketing plan per month
- weekly update on progress, completed work, blocked work, and early performance movement
- critical/spotlight exceptions may require faster review

Weekly updates should not recreate the whole plan unless the diagnosis materially changes.

## Brief-Ready Section Order

The preferred POP/Captain structure for watchlist properties:

1. Executive Read
2. Recovery Math
3. Primary Constraint
4. Funnel Diagnosis
5. Floorplan / Unit Exposure
6. Pricing / Concession Read
7. Source / Spend Read
8. Competitive Visibility
9. Website / Content / Media
10. Reputation / Resident Experience
11. Operations / People Constraints
12. Peer Family Help
13. Action Plan
14. Evidence And Confidence Notes
15. Open Questions / Review Gates

## Implementation Notes

This standard should be implemented through the POP Brief grounding core and Captain read model before final artifact rendering.

Near-term implementation order:

1. Add diagnostic read-model fields for recovery math, primary constraint, confidence, and do-not-recommend gates.
2. Teach support lanes to produce constraint-specific evidence rather than generic summaries.
3. Add peer-family comparison reads for Spotlight and Critical properties.
4. Generate the internal diagnostic first.
5. Generate the concise property action plan from approved diagnostic actions.
6. Preserve every accepted recommendation in Captain memory with expected lift and proof check.
