# Focus Report — Quick Start

## Generate & Send Report (One Command)
```bash
cd /Users/mark/Property_Analytics/focus_report/scripts
python3 send_focus_report_email.py
```

## Generate Only (No Email)
```bash
python3 generate_focus_report.py
```

## View Latest Report
```bash
open ../reports/focus_report/$(ls -t ../reports/focus_report/ | head -1)/focus_report.html
```

## Update Focus Properties List
Edit: `config/focus_properties.yml`

```yaml
focus_properties:
  - Property Name One
  - Property Name Two
  - Property Name Three
```

Property names must match `/Users/mark/Property_Analytics/config/venterra_properties_official.json`

## What This Report Shows

**Current Focus Set:** 23 properties

For each Focus property:
- **Status:** 🔴 Red / 🟡 Yellow / 🟢 Green
- **KPIs:** Sessions, Organic Clicks, CTR, Avg Position (all WoW)
- **Insight:** One-sentence summary
- **Watch Flag:** Optional alert (if triggered)

## Key Files

- **Contract:** `docs/FOCUS_REPORT_CONTRACT.md` (defines all rules)
- **Config:** `config/focus_properties.yml` (property list)
- **Generator:** `scripts/generate_focus_report.py`
- **Sender:** `scripts/send_focus_report_email.py`
- **Archives:** `reports/focus_report/YYYY-MM-DD/`

## Data Sources

- **GA4:** Sessions (1-day lag)
- **GSC:** Clicks, CTR, Position (3-day lag)
- **DB:** `/Users/mark/Property_Analytics/data/portfolio_analytics.db`

## Differences from Other Reports

| Feature | Focus Report | Portfolio Pulse | Spotlight |
|---------|--------------|-----------------|-----------|
| Properties | Curated list | All 91 | Monthly selection |
| Cadence | Weekly | Daily | Weekly |
| Format | HTML email | HTML email | CSV to OneDrive |
| Focus | Status board | Movers/shakers | Deep metrics |
| Output | Always all | Top/bottom only | All selected |

## Troubleshooting

**No data for property?**  
Check property name matches registry exactly.

**Email fails?**  
Verify `REPORT_PASSWORD_FILE` env var is set.

**Want different properties?**  
Edit `config/focus_properties.yml` only.

---

**Full docs:** See `README.md`  
**Contract:** See `docs/FOCUS_REPORT_CONTRACT.md`  
**Support:** mlaufhutte@venterraliving.com
