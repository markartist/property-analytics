# GBP Naming Discrepancy Report Canon

**Status:** Active Ad Hoc Control  
**Canonical Date:** February 11, 2026  
**Owner:** Property Analytics

---

## Purpose

Define the canonical process and findings for identifying naming mismatches between:

1. **ThirtyLines property names** (source of truth)
2. **Google Business Profile listing names** (actual public listing title)

This report exists to protect brand consistency, local SEO consistency, and listing governance.

---

## Canonical Finding (Baseline)

- **Total properties analyzed:** 93
- **Exact matches:** 70 (75.3%)
- **Discrepancies:** 23 (24.7%)
- **Primary issue pattern:** Missing `"Apartments"` suffix (19 of 23 discrepancies)

Interpretation:
- Most issues are naming standard drift, not location mapping failures.

---

## Canonical Inputs

- **Source mapping file:** `/Users/mark/Property_Analytics/Portfolio_Monitoring/data/all_properties_gbp_matched.json`
- **Source-of-truth names:** `properties.property_name` in `/Users/mark/Property_Analytics/data/portfolio_analytics.db`

Required fields:
- `property_name` (ThirtyLines canonical name)
- `gbp_title` (actual GBP listing title)
- `account_id`
- `location_id`

---

## Canonical Tooling

- **Primary script:** `/Users/mark/Property_Analytics/AdHoc_Reports/listing_consistency_test/generate_gbp_discrepancy_report.py`
- **Working directory:** `/Users/mark/Property_Analytics/AdHoc_Reports/listing_consistency_test/`

Command:

```bash
python3 /Users/mark/Property_Analytics/AdHoc_Reports/listing_consistency_test/generate_gbp_discrepancy_report.py
```

---

## Canonical Outputs

Generated under:
- `/Users/mark/Property_Analytics/AdHoc_Reports/listing_consistency_test/output/`

Output set:
1. **PIB-style email summary** (via SES sender stack)
2. **Excel discrepancy workbook** with:
   - property details
   - discrepancy type
   - GBP `account_id`
   - GBP `location_id`

---

## Operational Use

Primary use cases:
- One-time correction campaign for current discrepancies
- Quarterly regression check for naming drift

Recommended action order:
1. Fix simple `"Apartments"` suffix discrepancies first
2. Fix wording mismatches second
3. Re-run report after updates to verify closure

---

## Scope Notes

- This control validates naming consistency only.
- It does not validate GBP category quality, hours, reviews, or profile completeness.
- It is currently positioned as **ad hoc / periodic governance**, not a daily blocking control.

---

## Change Control

When updating this canon:
1. Update finding counts and date.
2. Keep script and data source paths current.
3. Record any change in standard naming policy (for example, mandatory `"Apartments"` suffix policy).
