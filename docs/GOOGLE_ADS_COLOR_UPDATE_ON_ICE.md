# Google Ads Color Update Plan (On Ice)

## Status

Paused as of 2026-03-24.

Reason:
- Google Ads API allows reading responsive display ad `main_color` and `accent_color`.
- Google Ads API does not allow updating those color fields in place on existing ads.
- Leigh may choose to have the vendor create entirely new ads instead.

## Confirmed Finding

We validated the update path directly against the Google Ads API and received an error stating that `ad.responsive_display_ad.main_color` cannot be modified by an `UPDATE` operation.

Practical meaning:
- Existing responsive display ad colors can be inspected.
- Existing responsive display ad colors cannot be patched in place.
- Any color change would require a replacement-ad workflow rather than a direct edit.

## If We Revisit This Later

Recommended approach:
1. Confirm the exact ads in scope and final HEX values.
2. Export a baseline snapshot of current ad IDs, colors, and statuses.
3. Create replacement responsive display ads with the new colors.
4. Leave current ads active while replacements go through Google review.
5. Verify replacements are approved and eligible to serve.
6. Pause old ads only after replacements are ready.
7. Produce an audit of old ad IDs, new ad IDs, colors applied, and final statuses.

## Stakeholder Guidance

If we handle this internally, stakeholder effort should be minimal beyond approval and final color confirmation.

If the vendor creates all-new ads, this internal replacement workflow is not needed.

## Related Files

- `/Users/mark/Property_Analytics/Portfolio_Dashboard/scripts/google_ads_asset_editor.py`
- `/Users/mark/Property_Analytics/docs/GOOGLE_ADS_URL_MIGRATION_PROJECT.md`
- `/Users/mark/Property_Analytics/ops/google_ads_attribution_live/responsive_display_colors_20260304.csv`
