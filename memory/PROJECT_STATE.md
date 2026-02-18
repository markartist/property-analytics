# Property Analytics Project State

**Purpose:** Track production status and health of all active projects.  
**Last Updated:** February 12, 2026

---

## Production Systems

### Portfolio Pulse
**Status:** 🟢 Operational  
**Version:** 1.0  
**Authority:** Contract-Governed

#### Health Indicators
- **Data Collection:** ✅ Running (7:00 AM daily)
- **Email Delivery:** ✅ Running (8:00 AM daily)
- **Last Successful Run:** January 3, 2026
- **Exit Codes:** 0 (both jobs)

#### Key Metrics
- **Properties Covered:** 91/91 (GA4), 90/91 (GSC)
- **Email Recipients:** 1 (mlaufhutte@venterraliving.com)
- **Database Size:** ~50-100 MB
- **Log Volume:** ~500 MB (30-day retention)

#### Recent Changes
- **2026-01-04:** Documentation baseline established (Contract v1.0)
- **2025-12-29:** Fixed credential authentication (migrated to file-based)
- **2025-12-21:** Launched production (week-over-week comparison model)

#### Known Issues
1. **Monteverde GSC 403:** Permanent (permission issue at property level)
2. **GSC 3-Day Lag:** Permanent (Google API limitation)

#### Upcoming Work
- None scheduled (system stable)

---

### GBP Naming Discrepancy Report
**Status:** 🟢 Operational (Ad Hoc / Governance)  
**Version:** 1.0  
**Authority:** Canonical Operational Reference

#### Health Indicators
- **Data Source:** ✅ Available (`all_properties_gbp_matched.json`)
- **Report Generator:** ✅ Implemented (`generate_gbp_discrepancy_report.py`)
- **Email Delivery:** ✅ Implemented (PIB-style + Excel attachment)
- **Baseline Run:** February 11, 2026

#### Key Metrics
- **Properties Covered:** 93
- **Exact Matches:** 70 (75.3%)
- **Discrepancies:** 23 (24.7%)
- **Primary Pattern:** Missing `"Apartments"` suffix (19 properties)

#### Recent Changes
- **2026-02-11:** Built discrepancy generator and report outputs
- **2026-02-12:** Added canonical documentation and memory indexing

#### Known Issues
1. **Naming Standard Ambiguity:** Not all properties currently enforce consistent suffix conventions
2. **Mode:** Ad hoc execution (not yet scheduled)

#### Upcoming Work
- Quarterly re-run and closure verification after GBP listing updates

---

## Documentation Status

### Portfolio Pulse Documentation Set
**Status:** ✅ Complete (v1.0)  
**Last Updated:** January 4, 2026

#### Files Created
1. `docs/PORTFOLIO_PULSE_CONTRACT.md` — Authoritative specification (358 lines)
2. `README_PORTFOLIO_PULSE.md` — Quick start guide (179 lines)
3. `docs/PORTFOLIO_PULSE_SIGNAL_LOGIC.md` — Signal methodology (470 lines)
4. `docs/PORTFOLIO_PULSE_LAYOUT.md` — Visual rules (505 lines)
5. `docs/PORTFOLIO_PULSE_RUNBOOK.md` — Operations guide (640 lines)
6. `memory/MEMORY_INDEX.md` — Documentation index (152 lines)
7. `memory/PROJECT_STATE.md` — This file

#### Total Documentation
~2,300 lines across 7 files (complete Atlas execution plan)

#### Governance
- **Contract:** Versioned, requires formal revision
- **Supporting Docs:** Living documents, updated as needed
- **Memory System:** Central index for retrieval

---

## System Dependencies

### Data Sources
| Source | Status | Coverage | Credentials |
|--------|--------|----------|-------------|
| GA4 API | ✅ Operational | 91/91 properties | Service account JSON |
| GSC API | ✅ Operational | 90/91 properties | OAuth token (auto-refresh) |

### Infrastructure
| Component | Status | Location | Notes |
|-----------|--------|----------|-------|
| macOS launchd | ✅ Running | User LaunchAgents | Survives reboots |
| SQLite DB | ✅ Healthy | `/Users/mark/Property_Analytics/data/` | 14-day retention |
| OneDrive Sync | ✅ Active | `~/OneDrive - Venterra Realty (Canada) Inc/` | Manual verification required |
| Office 365 SMTP | ✅ Connected | smtp.office365.com:587 | App password in file |

### Credentials
| Credential | Type | Location | Permissions | Expiry |
|------------|------|----------|-------------|--------|
| Microsoft App Password | File | `credentials/Microsoft_Key.txt` | 600 | None (app password) |
| GSC OAuth Token | File | `credentials/token.json` | Auto-managed | Refresh monthly |
| GA4 Service Account | JSON | `config/*.json` | 600 | None (service account) |

---

## Monitoring & Alerts

### Daily Checks (Automated)
- ✅ Job exit codes (via launchctl)
- ✅ Log file creation
- ✅ OneDrive archive creation

### Daily Checks (Manual - 5 min)
- Email receipt verification
- Log review for errors
- Database size check

### Weekly Checks (Manual - 15 min)
- Data completeness verification (14 days)
- Log disk usage
- Property count validation

### Monthly Checks (Manual - 30 min)
- OAuth token refresh verification
- Spot-check property values vs. GA4 UI
- Archive old logs
- Review persistent outliers

### Alert Thresholds
| Metric | Threshold | Action |
|--------|-----------|--------|
| Job exit code | != 0 | Investigate immediately |
| Email not received | > 15 min past 8 AM | Check logs, manual re-send |
| Database size | > 200 MB | Investigate data retention |
| Log volume | > 1 GB | Rotate/archive logs |

---

## Handoff Readiness

### Documentation Coverage
- ✅ **Purpose & Audience** — Clear stakeholder mapping
- ✅ **Technical Specifications** — Complete signal logic
- ✅ **Operational Procedures** — Full runbook
- ✅ **Failure Recovery** — Documented scenarios
- ✅ **Change Control** — Governance process defined

### Knowledge Transfer Requirements
1. **System Access:**
   - [ ] Database access verified
   - [ ] OneDrive access verified
   - [ ] Email inbox access verified
   - [ ] Credential access (via 1Password or secure transfer)

2. **Technical Proficiency:**
   - [ ] Python 3 basics
   - [ ] SQLite query fundamentals
   - [ ] macOS launchd familiarity
   - [ ] SMTP troubleshooting basics

3. **Domain Knowledge:**
   - [ ] GA4 metrics understanding
   - [ ] GSC metrics understanding
   - [ ] Property portfolio awareness

### Handoff Checklist
See `docs/PORTFOLIO_PULSE_RUNBOOK.md` (Section 9) for complete checklist.

---

## Version Control

### Git Status
- **Repository:** `/Users/mark/Property_Analytics/Portfolio_Monitoring`
- **Branch:** main
- **Last Commit:** (pending — documentation baseline)

### Recommended Commit
```bash
cd /Users/mark/Property_Analytics/Portfolio_Monitoring
git add docs/ README_PORTFOLIO_PULSE.md
git add ../memory/
git commit -m "Add Portfolio Pulse contract and supporting documentation (v1.0)

- PORTFOLIO_PULSE_CONTRACT.md: Authoritative specification
- README_PORTFOLIO_PULSE.md: Quick start for non-technical users
- PORTFOLIO_PULSE_SIGNAL_LOGIC.md: Ranking methodology
- PORTFOLIO_PULSE_LAYOUT.md: Visual rules and constraints
- PORTFOLIO_PULSE_RUNBOOK.md: Operational procedures
- MEMORY_INDEX.md: Documentation index
- PROJECT_STATE.md: Production status tracking

All docs establish Portfolio Pulse as first-class, contract-governed project."
```

---

## Future Projects (Placeholder)

### Portfolio Dashboard
**Status:** 🟡 Planning  
**Purpose:** Interactive diagnostic tool for root cause analysis

### Competitive Intelligence Reports (CIR)
**Status:** 🔴 Not Started  
**Purpose:** Market positioning and competitive analysis

### Executive Insights
**Status:** 🔴 Not Started  
**Purpose:** High-level strategic summaries for C-suite

---

## Change Log

| Date | Project | Change | Impact |
|------|---------|--------|--------|
| 2026-02-12 | GBP Naming Discrepancy Report | Canon doc + memory registration | Makes governance report discoverable and durable |
| 2026-01-04 | Portfolio Pulse | Documentation baseline (v1.0) | Complete governance framework |
| 2025-12-29 | Portfolio Pulse | Credential fix (file-based) | Resolved email authentication failures |
| 2025-12-21 | Portfolio Pulse | Production launch | Daily automated reporting begins |
| 2025-12-19 | Portfolio Pulse | Initial prototype | Week-over-week model validated |

---

**Maintenance Notes:**
- Update health indicators after major incidents
- Track version changes in Change Log
- Add new projects as they reach production
- Keep handoff readiness current
