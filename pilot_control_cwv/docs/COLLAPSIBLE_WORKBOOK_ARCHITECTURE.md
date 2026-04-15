# Collapsible Workbook Architecture

## Goal

Design the pilot KPI workbook so it works in two modes at once:

- executive scan when sections are collapsed
- analyst review when sections are expanded

The workbook should open in a clean summary state, with the option to expand
each KPI group into the full property-level chart set.

## Recommended Excel Pattern

Use Excel row grouping / outlining as the "drawer" mechanism.

This is the most practical implementation because it:

- works natively in Excel and Outlook-attached workbooks
- does not depend on macros or custom UI
- survives daily regeneration
- gives users familiar `+/-` controls on the left margin

## Section Structure

Each KPI group should be rendered as one summary block followed by grouped
detail rows.

### Summary Block

The summary block is always visible and should contain:

- KPI group title
- one aggregate chart
- pilot average line
- sister average line
- baseline line
- floor line when the KPI uses a floor
- a compact value box on the right

Recommended right-side summary values:

- `Pilot Avg`
- `Sister Avg`
- `Pilot BL`
- `Sister BL` or shared `Baseline`

### Detail Block

The detail block sits directly under the summary block and is grouped/collapsed
by default.

Each detail block contains the five pilot/sister pair charts:

- Calais Midtown vs Avasa Spring Branch
- Champions Green vs Axial Buckhead
- The District Universal Boulevard vs Northbridge at Millenia Lake
- The Harrison vs The Whitney
- Ventana vs Park on Wurzbach

## Visual Layout

The workbook should read top to bottom like a report, not a dashboard.

Recommended rhythm for each KPI section:

1. section title row
2. aggregate summary chart row
3. grouped detail rows
4. one spacer row

### Summary Chart Style

Keep the summary chart visually similar to the approved pair charts:

- pilot line: `#4473D0`
- sister line: `#7CCAC2`
- baseline: subtle gray
- floor: subtle light red
- no chart box outline
- no legend
- dates on chart axis

The summary chart should be wider than the detail charts and slightly flatter.

### Detail Chart Style

The detail charts should preserve the current approved treatment:

- left-aligned chart area
- right-side numeric callouts
- percent formatting for rate metrics
- colored pair names

## Aggregation Rules

### Recommended Default

Use simple averages for the summary row first.

That means:

- pilot summary line = average of the five pilot property values per day
- sister summary line = average of the five sister property values per day

Why this is the best starting point:

- easiest to explain
- easiest to audit
- consistent across CWV, BI, and Heap sections
- avoids adding unit-weighting logic before stakeholders ask for it

### Optional Later Upgrade

If leadership wants a more portfolio-like view later, add a weighted mode:

- weight by unit count

This should be treated as a later enhancement, not the starting behavior.

## KPI Group List

The collapsible pattern should apply to these groups:

1. `Core Web Vitals - PSI`
2. `Core Web Vitals - GTMetrix`
3. `Organic Traffic as a % of Unique Users`
4. `High Intent User Rate`
5. `Lead (Guest Card) to Available Unit Rate`
6. `Website Sales Funnel - Price Quote`
7. `Website Sales Funnel - Visits (Schedule a Tour)`
8. `Website Sales Funnel - Completed Applications`
9. `Website Funnel Conversions - Click to Call / Phone`
10. `Website Funnel Conversions - Contact Form`

## Data Presentation Rules

### Numeric Formatting

Use percentages for ratio metrics:

- Organic Traffic as a % of Unique Users
- High Intent User Rate
- Lead (Guest Card) to Available Unit Rate
- Price Quote
- Schedule a Tour
- Completed Applications
- Click to Call / Phone
- Contact Form

Keep scores as raw values:

- PSI
- GTMetrix

### Pending Data

If a source is not current for the report date:

- keep the last available line
- annotate the summary row clearly
- do not fabricate same-day values

Recommended note style:

- `Latest Heap available: 3/31 | 4/1 pending`

## Open / Closed States

### Default Open State

Open the workbook in collapsed mode for all KPI groups.

This gives the first viewer:

- one chart per KPI group
- a high-level report they can scan quickly

### Expanded State

When a user expands a section, they should see:

- the five pair charts immediately below the summary row
- no duplicated headers
- no extra spacer rows inside the grouped detail

## Why This Is Better Than Showing Everything

This pattern solves the current tension between density and readability:

- summary rows reduce vertical sprawl
- details remain available without opening a separate file
- leaders get quick signal
- analysts still have proof and drilldown

It also makes the email and workbook align better:

- email = curated summary view
- workbook = collapsible summary plus details

## Suggested Build Order

1. implement the collapsible summary/detail pattern for `Core Web Vitals - PSI`
2. repeat for `Core Web Vitals - GTMetrix`
3. apply the same structure to one BI section
4. verify row grouping behaves cleanly in Excel
5. roll the pattern out to the remaining KPI groups

## Recommendation

Use this collapsible structure as the production workbook direction.

It keeps the workbook executive-friendly without throwing away the property-level
evidence that makes the report credible.
