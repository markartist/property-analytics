# BI Metric Key

Source-of-truth acronym key for BI-driven tracker metrics.

These definitions are taken from the BI host workbook structure and must be treated literally.
No BI values should ever be inferred, backfilled, or approximated.

| Code | Meaning | Notes |
| --- | --- | --- |
| `GC/AU` | Guest Cards per Available Unit | Volume metric used in `Total` and `Website Conversion` views. |
| `PQ/GC` | Price Quotes per Guest Card | Website Conversion funnel metric. |
| `ST/GC` | Schedule a Tour per Guest Card | Distinct from `V/GC`. |
| `V/GC` | Visits per Guest Card | Literal visits metric from BI. |
| `A/GC` | Completed Applications per Guest Card | Application conversion metric. |
| `C2C/GC` | Click to Call per Guest Card | Phone conversion metric. |
| `CFrm/GC` | Contact Form per Guest Card | Contact form conversion metric. |
| `L/GC` | Leases per Guest Card | Available in trailing windows only; the current BI workbook does not provide `Yesterday` columns. |
| `M/GC` | Move-ins per Guest Card | Available in trailing windows only; the current BI workbook does not provide `Yesterday` columns. |

## Important interpretation rules

- `ST/GC` is **Schedule a Tour**
- `V/GC` is **Visit**
- They are not interchangeable

## Current source caveats

- The BI workbook does not currently populate every metric for every window and pair.
- Missing values in the tracker should remain blank and be treated as source gaps.
- If a value is not in the host BI file, we should request it from the BI owners rather than fabricate it.
