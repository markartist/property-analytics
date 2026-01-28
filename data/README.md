# Shared Data Directory

**Purpose:** Centralized storage for portfolio analytics data shared across projects.

---

## Structure

### `portfolio_analytics.db`
**Canonical shared database** for Portfolio Monitoring (pipeline) and Portfolio Dashboard (UI).

- **Schema Owner:** Portfolio_Monitoring
- **Writers:** Portfolio_Monitoring collection scripts
- **Readers:** Portfolio_Dashboard, Portfolio_Monitoring reports
- **Format:** SQLite 3

**Tables:**
- `properties` - Property registry
- `ga4_daily_metrics` - Daily aggregated GA4 metrics
- `ga4_event_facts` - Event-level facts (raw, uninterpreted)
- `gsc_daily_metrics` - Daily Google Search Console metrics
- `data_collections` - Collection run tracking
- Additional tables per schema

---

## Configuration

Both projects support the `PORTFOLIO_ANALYTICS_DB_PATH` environment variable:

```bash
# Use shared database (default)
export PORTFOLIO_ANALYTICS_DB_PATH=/Users/mark/Property_Analytics/data/portfolio_analytics.db

# Or use custom location
export PORTFOLIO_ANALYTICS_DB_PATH=/path/to/custom.db
```

If unset, both projects default to the canonical shared path above.

---

## Project Responsibilities

### Portfolio_Monitoring (Pipeline)
- **Role:** Data collection and schema management
- **Writes:** Yes (via collection scripts)
- **Schema Ownership:** Owns and maintains database schema
- **Location:** `/Users/mark/Property_Analytics/Portfolio_Monitoring`

### Portfolio_Dashboard (UI)
- **Role:** Read-only data visualization
- **Writes:** No (read-only access)
- **Schema Ownership:** None (consumes schema from Monitoring)
- **Location:** `/Users/mark/Property_Analytics/Portfolio_Dashboard`

---

## Usage

### Running Data Collection (Monitoring)
```bash
cd /Users/mark/Property_Analytics/Portfolio_Monitoring

# Collect GA4 events
python3 scripts/collect_ga4_events.py --days 30

# Daily metrics collection
python3 collect_daily_data.py --quick
```

### Running Dashboard (UI)
```bash
cd /Users/mark/Property_Analytics/Portfolio_Dashboard

# Launch Streamlit dashboard
streamlit run app.py
```

---

## Notes

- **No secrets stored here** - Credentials managed via environment variables
- **Database is SQLite** - File-based, no server required
- **Backups recommended** - Consider periodic backups of `portfolio_analytics.db`
- **Schema migrations** - Managed by Portfolio_Monitoring project

---

**Last Updated:** 2025-12-22
