# Changelog — Paid Media Performance Workbook

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.2] - 2026-01-23

### Added
- **Spend_Breakdown worksheet** for marketing operations transparency
  - One row per property × spend subtype (209 total rows)
  - 7 columns: Property Name, Category, Subtype, Spend ($), Spend (%), Spend Rank, Description
  - Granular classification of unclassified/generic spend into subtypes:
    - Brand (contains property name)
    - Competitor (matches known competitor list)
    - Local Generic (geographic + apartment keywords)
    - Other Generic (fallback)
  - Spend Rank (1-5) shows highest to lowest spend subtypes within each property

### Changed
- Generator script now produces two worksheets in single workbook
- Updated contract to v1.2 with Spend_Breakdown column definitions
- Updated README with dual-worksheet usage guidance for different audiences

### Technical
- Added `classify_unclassified_keyword()` function for subtype classification
- Modified data collection to track spend in `subtypes` dictionary
- Created `generate_spend_breakdown_worksheet()` function
- Updated main() to generate both worksheets in sequence

### Documentation
- Contract updated to v1.2 with complete Spend_Breakdown specification
- README updated with "When to use each worksheet" guidance
- Session memory created: `SESSION_MEMORY_PAID_MEDIA_WORKBOOK_2026-01-23.md`

---

## [1.1] - 2026-01-23

### Added
- **Market/Region Source** column to track data provenance
  - Values: "Registry", "Registry (Partial)", "Placeholder", "Mapping Table"
  - Makes incomplete data transparent and executive-safe
- Placeholder values "TBD (Coming Soon)" for missing Market/Region fields

### Changed
- All 91 properties now show Market/Region columns (with placeholders where needed)
- Updated contract to document placeholder strategy

### Rationale
- Builds filtering/rollup infrastructure now while awaiting authoritative mapping
- Prevents confusion about missing vs incomplete data
- Executive-safe presentation of work-in-progress fields

---

## [1.0] - 2026-01-22

### Added
- Initial implementation of Paid Media Performance Workbook
- Single worksheet: **Paid_Media_Overview**
  - One row per property (91 properties)
  - 22 columns covering:
    - Property context (name, market, region)
    - Spend overview (total, classified, generic)
    - Targeting distribution (floor plans targeted, % spend per floor plan)
    - Performance (clicks, CPC, conversions, cost per conversion)
    - Inventory context (occupancy, units available, % by floor plan)
    - Alignment signal (Aligned/Partially Aligned/Not Targeted)
    - Data quality (Market/Region Source)
- Rolling 30-day window from run date
- Deterministic floor plan classification (Studio, 1BR, 2BR) using regex patterns
- Alignment logic based on classified spend % and floor plan distribution deltas
- Excel formatting: currency, percentages, frozen header row

### Fixed
- Property registry loading: Changed from `canonical_name` to `name` field (resolved empty data rows)
- Availability matching: Changed from feed_id-based to property name-based matching (resolved missing availability)
- Occupancy percentages: Removed `*100` multiplication since Excel percentage format handles it (resolved >100% values)

### Data Sources
- Google Ads API (Customer ID: 9089267423)
- Property registry (`venterra_properties_official.json`)
- Availability feed (`https://online.venterraliving.com/encasa-external/ThirtyLines`)

### Documentation
- Created contract: `docs/PAID_MEDIA_WORKBOOK_CONTRACT.md`
- Created README: `README.md`
- Created project structure with `scripts/`, `outputs/`, `docs/` directories

### Technical
- Generator script: `scripts/generate_paid_media_workbook.py`
- Dependencies: `google-ads`, `openpyxl`, `requests`
- Runtime: ~30-60 seconds for 91 properties, 6,156 keyword rows

---

## Legend

- **Added:** New features
- **Changed:** Changes to existing functionality
- **Fixed:** Bug fixes
- **Removed:** Removed features
- **Technical:** Implementation details
- **Documentation:** Documentation updates

---

**Current Version:** 1.2  
**Last Updated:** January 23, 2026
