# Property Analytics Memory Index

**Purpose:** Central index for all first-class documentation in the Property Analytics system.  
**Last Updated:** January 4, 2026

---

## Active Projects

### Portfolio Pulse (Production)
**Status:** Operational  
**Authority Level:** Contract-Governed  
**Location:** `/Users/mark/Property_Analytics/Portfolio_Monitoring/`

#### Core Documentation
- **Contract (Authoritative):** `docs/PORTFOLIO_PULSE_CONTRACT.md`
- **Quick Start Guide:** `README_PORTFOLIO_PULSE.md`
- **Signal Logic:** `docs/PORTFOLIO_PULSE_SIGNAL_LOGIC.md`
- **Layout Rules:** `docs/PORTFOLIO_PULSE_LAYOUT.md`
- **Operational Runbook:** `docs/PORTFOLIO_PULSE_RUNBOOK.md`

#### Purpose
Daily email report showing week-over-week performance trends across 91 Venterra properties. Delivers top 5 improving/declining properties per metric (Sessions, Clicks, CTR, Position).

#### Key Characteristics
- **Cadence:** Daily at 8:00 AM
- **Data Sources:** GA4 (sessions), GSC (clicks, CTR, position)
- **Time Window:** 7-day rolling periods (current vs. prior week)
- **Delivery:** HTML email + OneDrive archive
- **Selection:** Deterministic, objective ranking (no human discretion)

#### Related Systems
- **Portfolio Dashboard:** Interactive diagnostic tool (escalation path from Pulse)
- **Property Registry:** `/Users/mark/Property_Analytics/config/venterra_properties_official.json`
- **Database:** `/Users/mark/Property_Analytics/data/portfolio_analytics.db`

---

## Documentation Standards

### First-Class Documents
Documents that are:
1. **Authoritative** — Single source of truth for their domain
2. **Versioned** — Include version history and change control
3. **Maintained** — Updated as system evolves
4. **Discoverable** — Indexed in this file

### Contract-Level Documents
- Portfolio Pulse Contract
- (Future: CIR Contract, Insights Contract)

**Change Control:** Require formal revision process, stakeholder approval, semantic versioning.

### Supporting Documents
- Quick start guides (README files)
- Technical specifications (signal logic, layout rules)
- Operational runbooks

**Change Control:** Living documents, updated as needed, no formal approval required.

---

## File Locations

### Documentation Root
`/Users/mark/Property_Analytics/Portfolio_Monitoring/docs/`

### Memory System
`/Users/mark/Property_Analytics/memory/`

### Credentials
`/Users/mark/Property_Analytics/credentials/`

### Configuration
`/Users/mark/Property_Analytics/config/`

### Data
`/Users/mark/Property_Analytics/data/`

---

## Cross-References

### Portfolio Pulse → Dashboard
When properties appear in Pulse requiring investigation, escalate to:
- Location: `/Users/mark/Property_Analytics/Portfolio_Dashboard/`
- Purpose: Root cause analysis, historical trends, keyword/page-level data

### Portfolio Pulse → Database
Single source of truth for all metrics:
- Path: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- Schema: `ga4_daily_metrics`, `gsc_daily_metrics`
- Retention: 14 days rolling

### Portfolio Pulse → Property Registry
Canonical property list and mapping:
- Path: `/Users/mark/Property_Analytics/config/venterra_properties_official.json`
- Contains: GA4 property IDs, GSC URLs, property names

---

## Document Retrieval

### By Audience

**Marketing / SEO Team:**
- Start with: `README_PORTFOLIO_PULSE.md`
- Next: `docs/PORTFOLIO_PULSE_CONTRACT.md` (sections 1-6 only)

**WebOps / Technical Team:**
- Start with: `docs/PORTFOLIO_PULSE_RUNBOOK.md`
- Reference: `docs/PORTFOLIO_PULSE_SIGNAL_LOGIC.md` for ranking questions

**Designers / Developers:**
- Start with: `docs/PORTFOLIO_PULSE_LAYOUT.md`
- Reference: `docs/PORTFOLIO_PULSE_CONTRACT.md` (section 4 for display rules)

**Data Analysts:**
- Start with: `docs/PORTFOLIO_PULSE_SIGNAL_LOGIC.md`
- Reference: `docs/PORTFOLIO_PULSE_CONTRACT.md` (section 3 for metric definitions)

### By Question Type

**"How do I read the Pulse report?"**
→ `README_PORTFOLIO_PULSE.md`

**"Why did property X appear in Pulse?"**
→ `docs/PORTFOLIO_PULSE_SIGNAL_LOGIC.md`

**"Can we change the layout/design?"**
→ `docs/PORTFOLIO_PULSE_LAYOUT.md`

**"The job failed — how do I fix it?"**
→ `docs/PORTFOLIO_PULSE_RUNBOOK.md`

**"What are the rules for modifying Pulse?"**
→ `docs/PORTFOLIO_PULSE_CONTRACT.md` (section 8: Change Control)

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-04 | M. Laufhutte | Initial index with Portfolio Pulse baseline |

---

**Maintenance Notes:**
- Update this index when new first-class projects are added
- Cross-reference related systems
- Keep audience-based retrieval paths current
