# Competitor Data Summary

**Date**: January 29, 2026  
**Status**: ✅ Imported and Ready for Analysis  
**Source**: AptIQ Combined Market Surveys

---

## Overview

Successfully imported competitive intelligence data from AptIQ market surveys into the Property Analytics database. This data enables competitive analysis, benchmarking, and "why they're winning" insights for PIB reports.

## Data Coverage

### Import Statistics

- **Source File**: `_AptIQ_Combined_Market_Surveys.xlsx`
- **Total Competitors**: 541 unique competitor properties
- **Total Mappings**: 596 property-competitor relationships
- **Venterra Properties Covered**: 83 out of 91 (91% coverage)
- **Average Competitors per Property**: 7.2

### Coverage by Region

| Region | Properties | Total Competitors | Avg per Property |
|--------|-----------|-------------------|------------------|
| Houston, TX | 23 | 158 | 7.2 |
| Florida | 16 | 149 | 10.1 |
| Atlanta, GA | 13 | 90 | 7.2 |
| Dallas, TX | 9 | 58 | 6.7 |
| San Antonio, TX | 6 | 37 | 6.8 |
| Kentucky | 5 | 34 | 6.9 |
| Oklahoma | 4 | 20 | 5.7 |
| Other Regions | 7 | 50 | 7.1 |

### Top Properties by Competitor Count

| Property | Region | Competitors |
|----------|--------|-------------|
| District | Florida | 15 |
| Grove West | Florida | 13 |
| Tomoka | Florida | 12 |
| Luma Headwaters | Florida | 11 |
| Luminary | Florida | 11 |
| Cane Island | Florida | 10 |
| Northbridge | Florida | 10 |
| West 46th | Nashville, TN | 10 |
| Highpark | Houston, TX | 10 |
| 1604 | San Antonio, TX | 10 |

---

## Database Schema

### Tables Created

#### 1. `competitors` Table
Master list of all competitor properties.

```sql
CREATE TABLE competitors (
    competitor_id INTEGER PRIMARY KEY AUTOINCREMENT,
    competitor_name TEXT NOT NULL UNIQUE,
    competitor_domain TEXT,           -- To be added later
    competitor_url TEXT,              -- To be added later
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

#### 2. `property_competitors` Table
Mapping between Venterra properties and their competitors.

```sql
CREATE TABLE property_competitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id TEXT NOT NULL,
    competitor_id INTEGER NOT NULL,
    competitor_rank INTEGER,          -- 1 = top competitor
    data_source TEXT DEFAULT 'AptIQ',
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(property_id),
    FOREIGN KEY (competitor_id) REFERENCES competitors(competitor_id),
    UNIQUE(property_id, competitor_id)
)
```

---

## Usage Examples

### Get All Competitors for a Property

```sql
-- By Encasa short name
SELECT 
    c.competitor_name,
    pc.competitor_rank
FROM property_competitors pc
JOIN properties p ON pc.property_id = p.property_id
JOIN competitors c ON pc.competitor_id = c.competitor_id
WHERE p.encasa_short_name = 'Apex'
ORDER BY pc.competitor_rank;
```

### Get Properties Competing with a Specific Competitor

```sql
SELECT 
    p.encasa_short_name,
    p.property_name,
    p.encasa_region,
    pc.competitor_rank
FROM property_competitors pc
JOIN properties p ON pc.property_id = p.property_id
JOIN competitors c ON pc.competitor_id = c.competitor_id
WHERE c.competitor_name = 'Avana Westside'
ORDER BY p.encasa_short_name;
```

### Top 3 Competitors by Property

```sql
SELECT 
    p.encasa_short_name,
    p.encasa_region,
    c.competitor_name,
    pc.competitor_rank
FROM property_competitors pc
JOIN properties p ON pc.property_id = p.property_id
JOIN competitors c ON pc.competitor_id = c.competitor_id
WHERE pc.competitor_rank <= 3
ORDER BY p.encasa_short_name, pc.competitor_rank;
```

### Competitor Overlap (Properties with Same Competitors)

```sql
SELECT 
    c.competitor_name,
    COUNT(DISTINCT pc.property_id) as property_count,
    GROUP_CONCAT(DISTINCT p.encasa_short_name) as properties
FROM property_competitors pc
JOIN properties p ON pc.property_id = p.property_id
JOIN competitors c ON pc.competitor_id = c.competitor_id
GROUP BY c.competitor_id
HAVING COUNT(DISTINCT pc.property_id) > 1
ORDER BY property_count DESC
LIMIT 10;
```

---

## Sample Competitor Mappings

### Apex West Midtown (Atlanta, GA)
1. Avana Westside
2. The Mill at Westside
3. Walton Westside
4. Cottonwood Westside
5. Berkeley Heights
6. 935M by ARIUM

### Avasa at 1604 (San Antonio, TX)
1. Alta Rolling Oaks
2. Brio at Lookout
3. Loretto at Creekside
4. Citadel at Lookout
5. The Atlantic Mira Loma
6. US 1604
7. Caliza at the Loop
8. Hartwin Bulverde
9. Alamar
10. Tradehouse at Bulverde Marketplace

### The District Universal Boulevard (Florida)
1-15 competitors (top market in terms of competitor count)

---

## Next Steps

### Phase 1: URL/Domain Enrichment ⏳
Add competitor URLs and domains to enable:
- SEMRush organic keyword analysis
- PageSpeed comparison
- Traffic estimation
- Backlink analysis

**Options**:
1. Manual entry for top competitors (top 3 per property)
2. Web scraping from apartment listing sites
3. Google search automation
4. Third-party data enrichment services

### Phase 2: SEMRush Integration ⏳
Build competitor metrics collector to fetch:
- Organic keywords
- Traffic estimates
- Domain authority
- Common keywords with our properties
- Keyword gaps

**Table to create**: `competitor_metrics`

### Phase 3: PIB Integration ⏳
Add competitive intelligence section to Property Intelligence Brief:
- Top 3 competitors by property
- "Why they're winning" analysis based on SEMRush data
- Keyword gaps and opportunities
- Traffic comparison

### Phase 4: Competitive Benchmarking Dashboard 🎯
Long-term goal: Create dashboard showing:
- Our position vs competitors
- Market share by keyword
- Performance trends vs competition
- Regional competitive landscape

---

## Data Quality Notes

### Complete Data
- ✅ Competitor names
- ✅ Competitor rankings (1-15)
- ✅ Property-competitor relationships
- ✅ Regional distribution

### Missing Data (To Be Added)
- ⏳ Competitor URLs/domains
- ⏳ Competitor contact information
- ⏳ Competitor property details (units, rent, etc.)
- ⏳ SEMRush metrics
- ⏳ Performance benchmarks

### Properties Without Competitors (8 properties)
Likely reasons:
- Not in AptIQ market surveys
- New properties not yet surveyed
- Independent/unique markets

**List**: Can be queried with:
```sql
SELECT encasa_short_name, property_name, encasa_region
FROM properties p
WHERE NOT EXISTS (
    SELECT 1 FROM property_competitors pc 
    WHERE pc.property_id = p.property_id
)
ORDER BY encasa_region, encasa_short_name;
```

---

## Integration Points

### Current Systems That Can Use This Data

1. **Property Intelligence Brief (PIB)**
   - Add competitor section
   - Show top 3 competitors
   - Comparative metrics when URLs added

2. **Data Collection System**
   - Future: Competitor metrics collector
   - Track competitor changes over time
   - Alert on new competitors

3. **Paid Media Workbook**
   - Identify competing properties in ad auctions
   - Competitive keyword analysis
   - Budget allocation insights

4. **ThirtyLines Unit Availability**
   - Compare pricing vs competitors (when competitor pricing added)
   - Unit availability benchmarking
   - Leasing velocity comparison

---

## Maintenance

### Updating Competitor Data

When AptIQ data is refreshed:

1. Export new market survey data
2. Run extraction script (see competitor import code)
3. Use `INSERT OR IGNORE` to add new competitors
4. Update `competitor_rank` if rankings changed

### Adding Competitor URLs

```sql
UPDATE competitors 
SET competitor_url = ?,
    competitor_domain = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE competitor_name = ?;
```

### Removing Outdated Competitors

```sql
-- Mark as inactive rather than delete (preserves history)
ALTER TABLE competitors ADD COLUMN active BOOLEAN DEFAULT 1;

UPDATE competitors 
SET active = 0, updated_at = CURRENT_TIMESTAMP
WHERE competitor_name = ?;
```

---

## Technical Notes

### Indexes Created
- `idx_property_competitors_property` - Fast lookup by property
- `idx_property_competitors_competitor` - Fast lookup by competitor
- Property name and competitor name uniqueness enforced

### Data Source Attribution
All mappings tagged with `data_source = 'AptIQ'` to track origin

### Property Name Matching
- Primary: Exact match on `property_name`
- Fallback: Match on `encasa_short_name`
- Fuzzy: Substring matching for close matches
- **7 mappings skipped** due to no property match (likely renamed or not in our system)

---

## Files

- **Source Excel**: `/Users/mark/Property_Analytics/Data_Collection/config/_AptIQ_Combined_Market_Surveys.xlsx`
- **Extracted CSV**: `/Users/mark/Property_Analytics/Data_Collection/config/competitor_mappings_extracted.csv`
- **Database**: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- **Tables**: `competitors`, `property_competitors`

---

## Contact

**System Owner**: Property Analytics Platform  
**Database**: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`  
**Documentation**: This file  
**Last Updated**: January 29, 2026

---

## Summary

✅ **541 competitors** imported  
✅ **596 property-competitor relationships** established  
✅ **83 Venterra properties** (91% coverage) have competitor data  
✅ **Ready for URL enrichment** and SEMRush integration  
✅ **Database schema** designed for extensibility  

**Next Priority**: Add competitor URLs to enable SEMRush competitive analysis.
