# Focus Report — Project Memory

**System:** Venterra Living Focus Report  
**Location:** `/Users/mark/Property_Analytics/focus_report/`  
**Status:** ✅ Production, Active  
**Contract Version:** v0.1  
**Last Execution:** 2026-01-21 11:34 UTC (emailed)

---

## Current State

### Focus Property Set
**Count:** 23 properties (expanded from 5 on 2026-01-21)

**Complete List:**
1. Botanic Luxury
2. Camber Ridge
3. CoHo
4. The Villages at Oakleaf
5. Avasa Spring Branch
6. Stonecreek Ranch
7. The Reserves of Thomas Glen
8. Avasa at 1604
9. The Anatole
10. Apex West Midtown
11. Belterra
12. Calais Midtown
13. Cane Island
14. Canton Mill Lofts
15. Elation at Grandway West
16. Fairways at South Shore
17. The Cape at Grand Harbor
18. Avasa Grove West
19. Luma Headwaters
20. Mission Mayfield Downs
21. Northbridge at Millenia Lake
22. Townhomes at Lake Park
23. Trevesta Place

**Configuration:** `config/focus_properties.yml`

### Latest Report Status (2026-01-21)

**Status Distribution:**
- 🔴 Red (Requires Attention): 9 properties
- 🟡 Yellow (Monitor): 4 properties
- 🟢 Green (Performing Well): 10 properties

**Watch Flags Triggered:**
- CTR erosion: 3 properties
- Demand softness: 2 properties

**Data Freshness:**
- GA4: Through 2026-01-20 (1-day lag)
- GSC: Through 2026-01-18 (3-day lag)
- Database: 90 GA4 properties, 91 GSC properties
- Report Windows: GA4 (Jan 14-20), GSC (Jan 12-18)

### Archives
```
reports/focus_report/
├── 2026-01-20/  (5 properties)  - Initial release
├── 2026-01-21/  (23 properties) - Expanded set, emailed
```

---

## System Architecture

### Data Flow
1. **Source:** Portfolio Pulse daily collection (5:00 AM)
2. **Database:** `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
3. **Tables:** `ga4_daily_metrics`, `gsc_daily_metrics`, `insights`
4. **Generator:** `scripts/generate_focus_report.py`
5. **Email:** `scripts/send_focus_report_email.py`
6. **Archive:** `reports/focus_report/YYYY-MM-DD/`

### Shared Dependencies
- `Portfolio_Monitoring/src/db/db_helper.py` - Database connection
- `Portfolio_Dashboard/utils/preflight.py` - Credential validation
- Property registry: `/Users/mark/Property_Analytics/config/venterra_properties_official.json`

### No Dependencies On
- ❌ Portfolio Pulse (read-only DB access)
- ❌ Dashboard
- ❌ Spotlight Properties Report
- ❌ Property Intelligence Brief

All systems are independent siblings.

---

## Contract Guarantees (v0.1)

### Fixed KPI Strip (Order Matters)
1. Sessions (WoW %)
2. Organic Clicks (WoW %)
3. CTR (WoW Δ in percentage points)
4. Avg Position (WoW Δ, negative = improvement)

### Deterministic Status Rules
**Red Triggers (any of):**
- Sessions ≤-15% WoW AND <100 absolute
- Clicks ≤-20% WoW
- CTR ≤-1.0pp WoW AND clicks >50
- Position ≥+3.0 WoW

**Yellow Triggers (any of, no Red):**
- Sessions -10% to -14.9% WoW
- Clicks -10% to -19.9% WoW
- CTR -0.5pp to -0.99pp WoW
- Position +1.5 to +2.9 WoW
- Mixed signals: one metric +15%, another -10%

**Green:** Default (no Red/Yellow triggers)

### Insight Line Priority
1. Acceleration: Sessions OR Clicks ≥+20% WoW
2. Divergence: Sessions/Clicks opposite directions by ≥10%
3. Concentration: CTR ≥+0.5pp OR Position ≤-1.5
4. Stable: Default

### Watch Flags (Optional, Priority Order)
1. CTR erosion: ≤-0.5pp WoW
2. Ranking slip with volume: Position ≥+1.5 AND impressions ≥+10%
3. Demand softness: Sessions AND Clicks both ≤-10% WoW

### Data Lag (Non-Negotiable)
- GA4: 1-day lag (yesterday)
- GSC: 3-day lag (T-3)
- WoW: 7-day rolling windows

---

## Operations

### Standard Workflow
```bash
# Weekly execution (typically Monday)
cd /Users/mark/Property_Analytics/focus_report/scripts
python3 send_focus_report_email.py
```

### Email Configuration
**Environment Variables:**
- `REPORT_SENDER_EMAIL`: mlaufhutte@venterraliving.com
- `REPORT_RECIPIENT_EMAIL`: mlaufhutte@venterraliving.com
- `REPORT_PASSWORD_FILE`: /Users/mark/Property_Analytics/credentials/email_password.txt

**Subject Format:** "Venterra Living Focus Report — [Date]"

### Update Focus List
1. Edit `config/focus_properties.yml`
2. Use exact names from property registry
3. Regenerate report
4. No code changes required

---

## Version History

### v0.1.1 (2026-01-21)
- **Change:** Configuration expansion
- **Properties:** 5 → 23
- **Mapping Applied:** All short names resolved to canonical registry names
- **Code Changes:** None
- **Contract Changes:** None
- **Status:** ✅ Emailed, archived

### v0.1 (2026-01-20)
- **Change:** Initial release
- **Properties:** 5 (test set)
- **Architecture:** Contract-driven, deterministic
- **Status:** ✅ Tested, archived

---

## Known Properties

### All 23 Focus Properties Successfully Resolved
Every property name in `focus_properties.yml` maps to an exact match in the canonical registry. No fuzzy matching, no aliases, no failures.

**Verified Resolution Examples:**
- "Botanic Luxury" → 378... (GA4), https://...botanic-luxury/ (GSC)
- "The Villages at Oakleaf" → 378702944 (GA4), https://...oakleaf/ (GSC)
- "Avasa Spring Branch" → ... (GA4), https://...spring-branch/ (GSC)

### Data Availability
- **GA4:** All 23 properties have complete 7-day data in report window
- **GSC:** All 23 properties have complete 7-day data in report window
- **No Gaps:** Database verified with 90 daily GA4 records, 91 daily GSC records

---

## Change Control

### What Can Be Changed Without Contract Update
✅ Focus property list (add/remove properties)  
✅ Email recipients  
✅ Report cadence/schedule  
✅ Archive retention (currently infinite)

### What Requires Contract Update
❌ KPI definitions or order  
❌ Status rule thresholds  
❌ Insight prioritization logic  
❌ Watch flag triggers  
❌ Data lag policies  
❌ UX/layout (pagination, filtering, etc.)

---

## Integration Points

### Reads From
- Portfolio Pulse canonical database (read-only)
- Property registry (shared, read-only)
- Email credentials (shared with Portfolio Pulse)

### Writes To
- Focus Report archives (exclusive, dated folders)
- Email (via Office 365 SMTP)

### Does Not Touch
- Portfolio Pulse code
- Portfolio Pulse database tables
- Other reporting systems
- Shared library internals

---

## Success Criteria

### Report Generation
✅ All Focus properties appear in every report  
✅ Deterministic sorting: Red → Yellow → Green → Alphabetical  
✅ KPI strip always shows all 4 metrics  
✅ Outlook-compatible HTML  
✅ JSON debug payload included  
✅ Dated archive created  

### Email Delivery
✅ Sent to configured recipients  
✅ Subject includes date  
✅ HTML renders in Outlook 365  
✅ Dark mode supported  
✅ Mobile responsive  

### Data Accuracy
✅ Database queries match report windows  
✅ WoW calculations correct  
✅ Status rules applied deterministically  
✅ No stale data (respects lag policies)  

---

## Future Considerations

### Potential Expansions (Require Planning)
- Automated weekly scheduling via launchd
- SharePoint archiving (like Spotlight)
- Property count >50 (may need pagination per contract review)
- Historical trend comparison (multi-week)

### Explicitly Out of Scope
- Real-time data (always uses completed windows)
- Subjective assessments
- Manual overrides
- Alert notifications
- Competitive benchmarking

---

## Support & Contacts

**System Owner:** Mark Laufhutte (WebOps)  
**Email:** mlaufhutte@venterraliving.com  
**Contract Authority:** WebOps only  
**Change Approval:** Required for any contract modifications

**Documentation:**
- Contract: `docs/FOCUS_REPORT_CONTRACT.md`
- README: `README.md`
- Quick Start: `QUICKSTART.md`
- Expansion Log: `EXPANSION_2026-01-21.md`

---

**Last Updated:** 2026-01-21  
**Next Review:** Weekly (with each report generation)  
**Status:** ✅ Production Ready, Active Use
