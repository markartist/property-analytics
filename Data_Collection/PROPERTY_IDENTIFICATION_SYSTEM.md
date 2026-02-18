# Property Identification System

**Date**: January 29, 2026  
**Status**: ✅ Complete and Validated  
**Purpose**: Centralized property identification across all internal systems

---

## Overview

The Property Analytics platform now has a **unified property identification system** that maps properties across multiple internal systems and external data sources. This eliminates the confusion that previously existed with inconsistent property IDs.

## Problem Solved

**Previous Issue**: Properties were identified differently across systems:
- GA4 used numeric property IDs (e.g., `378403365`)
- ThirtyLines feed used property codes (e.g., `GA4AX`)
- Encasa system used short names (e.g., `Apex`)
- Various reports used full property names with inconsistent spelling

This caused:
- ❌ Mapping errors between systems
- ❌ Duplicate data for the same property
- ❌ Manual lookup needed to match properties
- ❌ Inconsistent reporting

## Solution: Central Property Metadata

All property identification data is now stored in the `property_metadata` table in the unified database:

**Database**: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`  
**Table**: `property_metadata`

### Key Fields

| Field | Description | Example | Source |
|-------|-------------|---------|--------|
| `property_id` | **Primary Key** - GA4 Property ID | `378403365` | Google Analytics 4 |
| `property_name` | Full canonical property name | `Apex West Midtown` | Official registry |
| `thirtylines_id` | Property code (ThirtyLines/Reports) | `GA4AX` | Venterra Property Codes Matrix |
| `encasa_short_name` | Short name used in Encasa system | `Apex` | Venterra Property Codes Matrix |
| `company_id` | Internal company identifier | `1096` | Venterra Property Codes Matrix |
| `encasa_region` | Market/region classification | `Atlanta, GA` | Venterra Property Codes Matrix |

### Coverage Statistics

- **Total Properties**: 91 operational properties
- **With ThirtyLines ID**: 91/91 (100%)
- **With Encasa Short Name**: 91/91 (100%)
- **With Encasa Region**: 91/91 (100%)
- **With Company ID**: 91/91 (100%)

✅ **Perfect mapping across all systems**

---

## Data Sources

### 1. Official Property Registry
**File**: `/Users/mark/Property_Analytics/config/venterra_properties_official.json`
- Primary source for property names and GA4 IDs
- 93 properties total (91 operational + 2 new developments)
- Used as primary key: GA4 Property ID

### 2. Venterra Property Codes Matrix
**File**: `/Users/mark/Property_Analytics/Data_Collection/config/Venterra_Property_Names_Codes_Matrix.xlsx`
- Source for ThirtyLines codes, Encasa short names, company IDs, regions
- 91 operational properties (excludes new developments)
- Official internal system mapping

### 3. ThirtyLines Feed
**API**: `https://online.venterraliving.com/encasa-external/ThirtyLines`
- Unit availability and floorplan data
- Uses property codes (e.g., `GA4AX`) as identifiers
- Mapped to GA4 IDs via `thirtylines_id` field

---

## Regional Distribution

| Encasa Region | Property Count |
|---------------|----------------|
| Houston, TX | 25 |
| Florida | 19 |
| Atlanta, GA | 13 |
| Dallas, TX | 9 |
| San Antonio, TX | 7 |
| Kentucky | 6 |
| Oklahoma | 4 |
| Raleigh, NC | 2 |
| Savannah, GA | 1 |
| Nashville, TN | 1 |
| Killeen | 1 |
| Kansas City | 1 |
| Austin, TX | 1 |
| Arkansas | 1 |

**Total**: 91 properties across 14 regions

---

## Usage Examples

### Find Property by Any Identifier

```sql
-- By GA4 Property ID (primary key)
SELECT * FROM property_metadata WHERE property_id = '378403365';

-- By ThirtyLines code
SELECT * FROM property_metadata WHERE thirtylines_id = 'GA4AX';

-- By Encasa short name
SELECT * FROM property_metadata WHERE encasa_short_name = 'Apex';

-- By full property name
SELECT * FROM property_metadata WHERE property_name LIKE '%Apex%';

-- By Company ID
SELECT * FROM property_metadata WHERE company_id = 1096;
```

### Get All Properties in a Region

```sql
SELECT 
    encasa_short_name,
    property_name,
    thirtylines_id,
    company_id
FROM property_metadata
WHERE encasa_region = 'Atlanta, GA'
ORDER BY encasa_short_name;
```

### Join with Performance Data

```sql
SELECT 
    pm.encasa_short_name,
    pm.encasa_region,
    gd.sessions,
    gd.conversions
FROM property_metadata pm
JOIN ga4_daily_metrics gd ON pm.property_id = gd.property_id
WHERE gd.metric_date = DATE('now', '-1 day')
ORDER BY gd.sessions DESC;
```

### Join with ThirtyLines Unit Availability

```sql
SELECT 
    pm.encasa_short_name,
    pm.property_name,
    pf.floorplan_name,
    ua.units_available_now,
    pf.rent_from,
    pf.rent_to
FROM property_metadata pm
JOIN property_floorplans pf ON pm.property_id = pf.property_id
JOIN unit_availability ua ON pf.id = ua.floorplan_id
WHERE ua.snapshot_date = DATE('now', '-1 day')
ORDER BY pm.encasa_region, pm.encasa_short_name;
```

---

## Sample Properties with Complete Metadata

| Short Name | Code | Co. ID | Region | Property Name |
|------------|------|--------|--------|---------------|
| Apex | GA4AX | 1096 | Atlanta, GA | Apex West Midtown |
| Monteverde | TX4MV | 1177 | San Antonio, TX | Monteverde |
| Pointe | AR4PB | 1185 | Arkansas | The Pointe Bentonville |
| Cane Island | FL4CI | 1178 | Florida | Cane Island |
| CoHo | GA4CH | 1123 | Atlanta, GA | CoHo |
| Mayfield | TX4MF | 1167 | Dallas, TX | Mission Mayfield Downs |
| Lakeland | FL4RL | 1164 | Florida | The Retreat at Lakeland |
| Riverbend | TX4RB | 1149 | Houston, TX | Riverbend |

---

## Best Practices

### ✅ DO

1. **Always use GA4 Property ID as primary key** when storing data
2. **Use `thirtylines_id`** when working with ThirtyLines API or property codes
3. **Use `encasa_short_name`** when displaying to internal users familiar with Encasa
4. **Use `encasa_region`** for regional analysis and grouping
5. **Join via `property_metadata` table** to translate between identifier types

### ❌ DON'T

1. **Don't hard-code property name mappings** - always reference `property_metadata`
2. **Don't assume property names are unique** - use IDs instead
3. **Don't create separate mapping files** - use the centralized table
4. **Don't manually maintain property lists** - they're now auto-synced from official sources

---

## Maintenance

### Updating Property Metadata

When new properties are added or information changes:

1. **Update official registry**: `/Users/mark/Property_Analytics/config/venterra_properties_official.json`
2. **Update property codes matrix**: `/Users/mark/Property_Analytics/Data_Collection/config/Venterra_Property_Names_Codes_Matrix.xlsx`
3. **Run sync script** (if needed) or manually update `property_metadata` table

### Validation Queries

```sql
-- Check for properties missing ThirtyLines IDs
SELECT property_id, property_name 
FROM property_metadata 
WHERE thirtylines_id IS NULL;

-- Check for properties missing Encasa metadata
SELECT property_id, property_name
FROM property_metadata
WHERE encasa_short_name IS NULL 
   OR encasa_region IS NULL;

-- Check for duplicate ThirtyLines codes
SELECT thirtylines_id, COUNT(*) as count
FROM property_metadata
WHERE thirtylines_id IS NOT NULL
GROUP BY thirtylines_id
HAVING COUNT(*) > 1;

-- Verify all 91 properties have complete metadata
SELECT 
    COUNT(*) as total,
    COUNT(thirtylines_id) as with_code,
    COUNT(encasa_short_name) as with_short_name,
    COUNT(encasa_region) as with_region,
    COUNT(company_id) as with_company_id
FROM property_metadata;
```

---

## Integration Points

### Current Systems Using Property Metadata

1. **Data_Collection System**
   - GA4 Collector: Uses `property_id` (GA4 Property ID)
   - ThirtyLines Collector: Uses `thirtylines_id` to map to `property_id`
   - All collectors store data using `property_id` as foreign key

2. **Property Intelligence Brief (PIB)**
   - Looks up properties by name or code
   - Uses `encasa_short_name` for display
   - Groups by `encasa_region` for regional reports

3. **Paid Media Workbook**
   - Maps Google Ads campaigns to properties
   - Uses `property_id` for joins with GA4 data

4. **Future Systems**
   - All new reports should use `property_metadata` as the source of truth
   - Use `property_id` as the primary key for all data storage
   - Display using `encasa_short_name` or `property_name` as appropriate

---

## Technical Notes

### Database Schema

```sql
-- property_metadata table structure
CREATE TABLE property_metadata (
    property_id TEXT PRIMARY KEY,           -- GA4 Property ID
    property_name TEXT NOT NULL,
    thirtylines_id TEXT,                    -- Property code (e.g., GA4AX)
    encasa_short_name TEXT,                 -- Short name (e.g., Apex)
    company_id INTEGER,                     -- Internal company ID
    encasa_region TEXT,                     -- Market/region
    -- ... other fields ...
);

-- Indexes for fast lookup
CREATE INDEX idx_thirtylines_id ON property_metadata(thirtylines_id);
CREATE INDEX idx_encasa_short_name ON property_metadata(encasa_short_name);
CREATE INDEX idx_encasa_region ON property_metadata(encasa_region);
```

### Import History

- **2026-01-27**: Initial property metadata table created
- **2026-01-29**: Added `thirtylines_id` field, mapped all 91 properties
- **2026-01-29**: Added `encasa_region` field from Property Codes Matrix
- **2026-01-29**: Added `encasa_short_name` and `company_id` fields

---

## Benefits

### ✅ Consistency
- Single source of truth for all property identifiers
- No more confusion between systems

### ✅ Accuracy
- Automated mapping eliminates manual errors
- 100% coverage validation

### ✅ Flexibility
- Easy to add new identifier types (e.g., CRM IDs, lease system IDs)
- Can join any dataset using appropriate identifier

### ✅ Maintainability
- Update in one place, reflected everywhere
- Clear ownership of mapping data

### ✅ Regional Analysis
- Group properties by Encasa region
- Compare performance across markets

---

## Contact

**System Owner**: Property Analytics Platform  
**Database**: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`  
**Documentation**: This file  
**Last Updated**: January 29, 2026
