# Calais Comparator Checklist

Use `Calais Midtown` as the reference implementation and compare it first against:

- `The District Universal Boulevard`
- `The Harrison`

Purpose:

- identify what is structurally different about the strongest-looking pilot site
- separate true discoverability issues from attribution or measurement issues
- produce a concise, defensible findings list for SEO, dev, and analytics owners

## Scope

Run the comparison at four layers:

1. Search/indexation
2. Crawlability/internal linking
3. Template/rendered HTML
4. Measurement/attribution

## Priority Order

1. `Calais Midtown` vs `The District Universal Boulevard`
2. `Calais Midtown` vs `The Harrison`

If a difference appears in both weak sites but not in Calais, treat it as high-confidence signal.

## Comparison Matrix

Use this table format for findings:

| Signal | Calais | District | Harrison | Material Difference | Owner |
|---|---|---|---|---|---|
| Canonical target |  |  |  |  |  |
| Indexable pages |  |  |  |  |  |
| Sitemap inclusion |  |  |  |  |  |
| Avg click depth |  |  |  |  |  |
| Referrer preservation |  |  |  |  |  |
| Organic GSC clicks |  |  |  |  |  |
| Organic analytics share |  |  |  |  |  |

## 1. Search / Indexation

Check these first in Google Search Console and rendered HTML.

### Required checks

- Indexed page count by property
- Submitted sitemap URLs vs indexed URLs
- Excluded/discovered-not-indexed URLs
- Canonical selected by Google vs canonical declared on page
- Query/page impression loss concentrated to specific templates

### Questions to answer

- Does Calais have materially more indexed URLs than District/Harrison?
- Are District/Harrison losing impressions on key property/floorplan/location URLs while Calais is stable?
- Is Google choosing a different canonical than the page declares on weak properties?

### Evidence to capture

- GSC coverage screenshots or exports
- page-level clicks/impressions before and after pilot launch
- canonical mismatch examples

## 2. Crawlability / Internal Linking

Run a crawl on all three properties with the same crawler settings.

### Required checks

- Total crawlable URLs
- Non-200 status URLs
- Redirect chains
- Orphaned URLs
- Internal inlinks to key landing pages
- Click depth for:
  - homepage
  - floorplans
  - specials/promotions
  - neighborhood/location
  - contact / conversion pages

### Questions to answer

- Does Calais have shallower click depth to important pages?
- Do District/Harrison have more redirect hops?
- Are key pages orphaned or weakly linked on District/Harrison?

### Evidence to capture

- crawl exports
- top orphan list
- click-depth comparison for equivalent URLs

## 3. Template / Rendered HTML Diff

Compare equivalent page types between Calais and the weak sites.

### Page types

- homepage
- main property landing page
- floorplan listing
- individual floorplan page
- specials/promotions page
- location/neighborhood page
- contact/guest-card entry page

### Required checks

- `<title>`
- meta description
- canonical tag
- robots meta
- hreflang if present
- structured data
- primary nav links
- footer links
- internal “related” modules
- presence of plain anchor links vs JS-only navigation

### Questions to answer

- Does Calais output cleaner canonicals?
- Are District/Harrison missing links or schema blocks that Calais has?
- Are weak sites relying on JS navigation where Calais has crawlable anchors?

### Evidence to capture

- rendered HTML snapshots
- side-by-side diffs of critical head tags
- screenshots of nav/footer/module differences

## 4. Measurement / Attribution

This is parallel to SEO and must be checked immediately, not after.

### Required checks

- Organic sessions/users by property
- Direct and Referral changes over the same period
- Landing-page mix by source
- Referrer preservation through routing
- Consent/banner impact on attribution
- Heap vs GSC directionality by property

### Questions to answer

- Is Calais stable in both GSC and analytics?
- Are District/Harrison dropping in GSC, or only in analytics?
- Is “lost organic” reappearing as Direct or Referral on weak properties?

### Evidence to capture

- source/medium trend export
- landing-page by source export
- side-by-side GSC vs analytics trend chart

## High-Confidence Patterns To Look For

If any of these show up, escalate quickly:

- Calais canonical points to self; weak sites canonicalize elsewhere
- Calais key pages are in sitemap; weak-site equivalents are not
- Calais has stronger internal links to floorplans/location pages
- District/Harrison have more orphaned URLs or deeper click depth
- GSC is stable for Calais but down for District/Harrison
- Analytics organic is down while Direct/Referral rises on weak sites

## Deliverable Format

Produce two outputs:

1. Executive summary

- 3 to 5 bullets
- state whether the issue looks like discoverability, measurement, or both

2. Findings table

- one row per confirmed difference
- include owner:
  - `SEO`
  - `Web Dev`
  - `Analytics`

## Suggested Owners

- Canonicals / robots / sitemap: `SEO` + `Web Dev`
- Internal linking / templates / JS routing: `Web Dev`
- Referrer preservation / source logic / Heap tagging: `Analytics`

## Recommended First Pass

If time is limited, do this minimum set:

1. GSC page-level comparison for Calais, District, Harrison
2. Rendered canonical/robots check on homepage + floorplan + location page
3. Crawl click depth and orphan check
4. Organic vs Direct/Referral comparison in analytics

If Calais is clean and both weak sites fail the same checks, that is enough to prioritize remediation.
