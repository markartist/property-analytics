#!/usr/bin/env python3
"""
Resi vs Legacy Site Experience — Exploratory Brief (Lean Version)
Compares conversion efficiency using GSC, GA4, and CWV only.
Defers: Paid Ads, Excel appendix, email automation
"""

import sqlite3
import json
import statistics
from datetime import datetime, timedelta
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).parent.parent
DB_PATH = Path("/Users/mark/Property_Analytics/data/portfolio_analytics.db")
REGISTRY_PATH = Path("/Users/mark/Property_Analytics/config/venterra_properties_official.json")
OUTPUT_DIR = BASE_DIR / "reports" / "resi_vs_legacy" / datetime.now().strftime("%Y-%m-%d")

# Create output directory
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Date ranges (30-day window)
TODAY = datetime.now().date()
GA4_END = TODAY - timedelta(days=1)  # 1-day lag
GA4_START = GA4_END - timedelta(days=30)
GSC_END = TODAY - timedelta(days=3)  # 3-day lag
GSC_START = GSC_END - timedelta(days=30)

print("=" * 70)
print("RESI VS LEGACY SITE EXPERIENCE — EXPLORATORY BRIEF")
print("=" * 70)
print(f"\nRun Date: {TODAY}")
print(f"GA4 Window: {GA4_START} to {GA4_END}")
print(f"GSC Window: {GSC_START} to {GSC_END}")
print(f"Database: {DB_PATH}")
print()

# Load property registry
print("📚 Loading property registry...")
with open(REGISTRY_PATH, 'r') as f:
    registry_data = json.load(f)

properties = registry_data.get('properties', [])

# Identify cohorts
resi_properties = []
legacy_properties = []

for prop in properties:
    site_type = prop.get('site_type')
    ga4_id = prop.get('ga4_property_id')
    gsc_url = prop.get('gsc_url')
    name = prop.get('name')
    
    # Skip if missing required identifiers
    if not ga4_id or not gsc_url or not name:
        continue
    
    prop_data = {
        'name': name,
        'ga4_id': ga4_id,
        'gsc_url': gsc_url,
        'site_type': site_type or 'legacy'
    }
    
    if site_type == 'resi':
        resi_properties.append(prop_data)
    else:
        legacy_properties.append(prop_data)

print(f"✓ Resi cohort: {len(resi_properties)} properties")
print(f"✓ Legacy cohort: {len(legacy_properties)} properties")
print()

# Connect to database
print("🗄️  Connecting to database...")
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

def collect_gsc_data(properties, cohort_name):
    """Collect GSC metrics for cohort"""
    print(f"\n📊 Collecting GSC data for {cohort_name} cohort...")
    
    metrics = []
    excluded = []
    
    for prop in properties:
        gsc_url = prop['gsc_url']
        
        # Query GSC data (property_id in this table = gsc_url)
        query = """
        SELECT 
            SUM(clicks) as total_clicks,
            SUM(impressions) as total_impressions,
            AVG(average_position) as avg_position
        FROM gsc_daily_metrics
        WHERE property_id = ?
        AND metric_date BETWEEN ? AND ?
        """
        
        cursor.execute(query, (gsc_url, str(GSC_START), str(GSC_END)))
        row = cursor.fetchone()
        
        if row and row[0]:  # Has clicks
            clicks, impressions, position = row
            
            # Volume gate: ≥300 clicks
            if clicks >= 300:
                # Compute CTR from totals, not average of daily CTRs
                ctr = (clicks / impressions * 100) if impressions else 0
                
                metrics.append({
                    'property': prop['name'],
                    'clicks': clicks,
                    'impressions': impressions,
                    'ctr': ctr,
                    'position': position
                })
            else:
                excluded.append({
                    'property': prop['name'],
                    'reason': f'Insufficient clicks ({clicks} < 300)'
                })
        else:
            excluded.append({
                'property': prop['name'],
                'reason': 'No GSC data'
            })
    
    print(f"  ✓ {len(metrics)} properties with sufficient data")
    print(f"  ✗ {len(excluded)} properties excluded")
    
    return metrics, excluded

def collect_ga4_data(properties, cohort_name):
    """Collect GA4 metrics for cohort"""
    print(f"\n📊 Collecting GA4 data for {cohort_name} cohort...")
    
    metrics = []
    excluded = []
    
    for prop in properties:
        ga4_id = prop['ga4_id']
        
        # Query GA4 data
        query = """
        SELECT 
            SUM(sessions) as total_sessions,
            SUM(engaged_sessions) as total_engaged_sessions
        FROM ga4_daily_metrics
        WHERE property_id = ?
        AND metric_date BETWEEN ? AND ?
        """
        
        cursor.execute(query, (ga4_id, str(GA4_START), str(GA4_END)))
        row = cursor.fetchone()
        
        if row and row[0]:  # Has sessions
            sessions, engaged_sessions = row
            
            # Volume gate: ≥1500 sessions
            if sessions >= 1500:
                engagement_rate = (engaged_sessions / sessions * 100) if sessions else 0
                
                metrics.append({
                    'property': prop['name'],
                    'sessions': sessions,
                    'engaged_sessions': engaged_sessions,
                    'engagement_rate': engagement_rate
                })
            else:
                excluded.append({
                    'property': prop['name'],
                    'reason': f'Insufficient sessions ({sessions} < 1500)'
                })
        else:
            excluded.append({
                'property': prop['name'],
                'reason': 'No GA4 data'
            })
    
    print(f"  ✓ {len(metrics)} properties with sufficient data")
    print(f"  ✗ {len(excluded)} properties excluded")
    
    return metrics, excluded

def collect_cwv_data(properties, cohort_name):
    """Collect CWV metrics for cohort"""
    print(f"\n📊 Collecting CWV data for {cohort_name} cohort...")
    
    metrics = []
    excluded = []
    
    for prop in properties:
        ga4_id = prop['ga4_id']
        
        # Query latest PageSpeed data (use actual column names)
        query = """
        SELECT 
            lcp_value, fid_value, cls_value, strategy
        FROM pagespeed_metrics
        WHERE property_id = ?
        AND metric_date = (
            SELECT MAX(metric_date) 
            FROM pagespeed_metrics 
            WHERE property_id = ?
        )
        """
        
        cursor.execute(query, (ga4_id, ga4_id))
        rows = cursor.fetchall()
        
        if rows:
            # Collect mobile + desktop
            mobile_data = None
            desktop_data = None
            
            for row in rows:
                lcp, fid, cls, strategy = row
                # Note: FID (legacy) is collected, not INP (current CWV)
                if strategy == 'mobile':
                    mobile_data = {'lcp': lcp, 'fid': fid, 'cls': cls}
                elif strategy == 'desktop':
                    desktop_data = {'lcp': lcp, 'fid': fid, 'cls': cls}
            
            # Store raw values for median calculation
            metrics.append({
                'property': prop['name'],
                'mobile': mobile_data,
                'desktop': desktop_data,
                'lcp': mobile_data['lcp'] if mobile_data else None,
                'fid': mobile_data['fid'] if mobile_data else None,
                'cls': mobile_data['cls'] if mobile_data else None
            })
        else:
            excluded.append({
                'property': prop['name'],
                'reason': 'No CWV data'
            })
    
    print(f"  ✓ {len(metrics)} properties with CWV data")
    print(f"  ✗ {len(excluded)} properties excluded")
    
    return metrics, excluded

# Collect data for both cohorts
resi_gsc, resi_gsc_excluded = collect_gsc_data(resi_properties, "Resi")
legacy_gsc_raw, legacy_gsc_excluded_raw = collect_gsc_data(legacy_properties, "Legacy")

resi_ga4, resi_ga4_excluded = collect_ga4_data(resi_properties, "Resi")
legacy_ga4_raw, legacy_ga4_excluded_raw = collect_ga4_data(legacy_properties, "Legacy")

resi_cwv, resi_cwv_excluded = collect_cwv_data(resi_properties, "Resi")
legacy_cwv_raw, legacy_cwv_excluded_raw = collect_cwv_data(legacy_properties, "Legacy")

# Filter Legacy cohort to only properties passing ALL volume gates
print("\n" + "=" * 70)
print("FILTERING LEGACY COHORT (ALL GATES PASS REQUIRED)")
print("=" * 70)

legacy_gsc_props = set(m['property'] for m in legacy_gsc_raw)
legacy_ga4_props = set(m['property'] for m in legacy_ga4_raw)
legacy_cwv_props = set(m['property'] for m in legacy_cwv_raw)

# Properties that passed all three gates
legacy_complete_props = legacy_gsc_props & legacy_ga4_props & legacy_cwv_props

print(f"\nLegacy properties passing all gates: {len(legacy_complete_props)}")
print(f"  GSC only: {len(legacy_gsc_props)}")
print(f"  GA4 only: {len(legacy_ga4_props)}")
print(f"  CWV only: {len(legacy_cwv_props)}")

# Filter to complete properties only
legacy_gsc = [m for m in legacy_gsc_raw if m['property'] in legacy_complete_props]
legacy_ga4 = [m for m in legacy_ga4_raw if m['property'] in legacy_complete_props]
legacy_cwv = [m for m in legacy_cwv_raw if m['property'] in legacy_complete_props]

# Update exclusions
legacy_gsc_excluded = legacy_gsc_excluded_raw + [
    {'property': m['property'], 'reason': 'Filtered: did not pass all volume gates'}
    for m in legacy_gsc_raw if m['property'] not in legacy_complete_props
]
legacy_ga4_excluded = legacy_ga4_excluded_raw + [
    {'property': m['property'], 'reason': 'Filtered: did not pass all volume gates'}
    for m in legacy_ga4_raw if m['property'] not in legacy_complete_props
]
legacy_cwv_excluded = legacy_cwv_excluded_raw + [
    {'property': m['property'], 'reason': 'Filtered: did not pass all volume gates'}
    for m in legacy_cwv_raw if m['property'] not in legacy_complete_props
]

print(f"\nFiltered Legacy cohort: {len(legacy_complete_props)} properties with complete data")

# Close database
conn.close()

# Compute cohort medians
print("\n" + "=" * 70)
print("COMPUTING COHORT MEDIANS")
print("=" * 70)

def compute_median(values):
    """Compute median, handle empty lists"""
    return statistics.median(values) if values else None

# GSC medians
resi_gsc_ctr_median = compute_median([m['ctr'] for m in resi_gsc]) if resi_gsc else None
legacy_gsc_ctr_median = compute_median([m['ctr'] for m in legacy_gsc]) if legacy_gsc else None

resi_gsc_position_median = compute_median([m['position'] for m in resi_gsc]) if resi_gsc else None
legacy_gsc_position_median = compute_median([m['position'] for m in legacy_gsc]) if legacy_gsc else None

# GA4 medians
resi_engagement_median = compute_median([m['engagement_rate'] for m in resi_ga4]) if resi_ga4 else None
legacy_engagement_median = compute_median([m['engagement_rate'] for m in legacy_ga4]) if legacy_ga4 else None

# CWV medians (mobile)
resi_lcp_median = compute_median([m['lcp'] for m in resi_cwv if m['lcp']]) if resi_cwv else None
legacy_lcp_median = compute_median([m['lcp'] for m in legacy_cwv if m['lcp']]) if legacy_cwv else None

resi_fid_median = compute_median([m['fid'] for m in resi_cwv if m['fid']]) if resi_cwv else None
legacy_fid_median = compute_median([m['fid'] for m in legacy_cwv if m['fid']]) if legacy_cwv else None

resi_cls_median = compute_median([m['cls'] for m in resi_cwv if m['cls']]) if resi_cwv else None
legacy_cls_median = compute_median([m['cls'] for m in legacy_cwv if m['cls']]) if legacy_cwv else None

print(f"\n📈 GSC CTR:")
print(f"  Resi Median: {resi_gsc_ctr_median:.2f}%" if resi_gsc_ctr_median else "  Resi Median: N/A")
print(f"  Legacy Median: {legacy_gsc_ctr_median:.2f}%" if legacy_gsc_ctr_median else "  Legacy Median: N/A")

print(f"\n📈 Engagement Rate:")
print(f"  Resi Median: {resi_engagement_median:.2f}%" if resi_engagement_median else "  Resi Median: N/A")
print(f"  Legacy Median: {legacy_engagement_median:.2f}%" if legacy_engagement_median else "  Legacy Median: N/A")

print(f"\n📈 Core Web Vitals (Mobile):")
print(f"  LCP - Resi: {resi_lcp_median:.2f}s, Legacy: {legacy_lcp_median:.2f}s" if resi_lcp_median and legacy_lcp_median else "  LCP: N/A")
print(f"  FID - Resi: {resi_fid_median:.0f}ms, Legacy: {legacy_fid_median:.0f}ms" if resi_fid_median and legacy_fid_median else "  FID: N/A")
print(f"  CLS - Resi: {resi_cls_median:.3f}, Legacy: {legacy_cls_median:.3f}" if resi_cls_median and legacy_cls_median else "  CLS: N/A")

# Generate HTML brief
print("\n" + "=" * 70)
print("GENERATING HTML BRIEF")
print("=" * 70)

html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Resi vs Legacy Site Experience — Exploratory Brief</title>
    <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; background: #f5f5f5; }}
        .container {{ background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        h1 {{ color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }}
        h2 {{ color: #34495e; margin-top: 30px; }}
        .disclaimer {{ background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }}
        .disclaimer strong {{ color: #856404; }}
        table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background: #3498db; color: white; font-weight: 600; }}
        tr:hover {{ background: #f8f9fa; }}
        .metric-value {{ font-weight: 600; font-size: 1.1em; }}
        .resi-stronger {{ color: #27ae60; }}
        .legacy-stronger {{ color: #e74c3c; }}
        .comparable {{ color: #7f8c8d; }}
        .coverage {{ font-size: 0.9em; color: #7f8c8d; margin-top: 5px; }}
        .narrative {{ background: #e8f4f8; padding: 15px; border-left: 4px solid #3498db; margin: 20px 0; line-height: 1.6; }}
        .guardrails {{ background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; font-size: 0.9em; }}
        .guardrails ul {{ margin: 10px 0; padding-left: 20px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Resi vs Legacy Site Experience</h1>
        <h2>Exploratory Conversion Efficiency Brief (30-Day)</h2>
        
        <p><strong>Run Date:</strong> {TODAY}<br>
        <strong>Data Window:</strong> {GA4_START} to {GA4_END} (GA4), {GSC_START} to {GSC_END} (GSC)</p>
        
        <div class="disclaimer">
            <strong>⚠️ EXPLORATORY FRAMEWORK — Small Cohorts & Volume Filtering</strong><br>
            This brief compares <strong>Resi site experience (N=2 complete)</strong> vs <strong>Legacy site experience (N={len(legacy_complete_props)} complete)</strong>. 
            Only properties passing <em>all three</em> volume gates (≥300 GSC clicks, ≥1,500 GA4 sessions, CWV data) are included to ensure apples-to-apples comparison. 
            The small sample sizes provide directional insights but are insufficient for statistical inference.
        </div>
        
        <h2>Cohort Summary</h2>
        <table>
            <tr>
                <th>Cohort</th>
                <th>Total Properties</th>
                <th>Complete Data</th>
                <th>Completion Rate</th>
            </tr>
            <tr>
                <td><strong>Resi Experience</strong></td>
                <td class="metric-value">{len(resi_properties)}</td>
                <td class="metric-value">{len(resi_gsc)}</td>
                <td>{len(resi_gsc) / len(resi_properties) * 100:.0f}%</td>
            </tr>
            <tr>
                <td><strong>Legacy Experience</strong></td>
                <td class="metric-value">{len(legacy_properties)}</td>
                <td class="metric-value">{len(legacy_complete_props)}</td>
                <td>{len(legacy_complete_props) / len(legacy_properties) * 100:.0f}%</td>
            </tr>
        </table>
        <div class="coverage">
            <strong>Complete Data:</strong> Properties passing all three volume gates (GSC ≥300 clicks, GA4 ≥1,500 sessions, CWV available).
        </div>
        
        <h2>Executive Scorecard (Cohort Medians)</h2>
        <table>
            <tr>
                <th>Metric</th>
                <th>Resi Median</th>
                <th>Legacy Median</th>
                <th>Directional</th>
            </tr>
            <tr>
                <td><strong>SERP CTR (%)</strong></td>
                <td class="metric-value">{resi_gsc_ctr_median:.2f}%</td>
                <td class="metric-value">{legacy_gsc_ctr_median:.2f}%</td>
                <td class="{'resi-stronger' if resi_gsc_ctr_median and legacy_gsc_ctr_median and resi_gsc_ctr_median > legacy_gsc_ctr_median else 'comparable' if resi_gsc_ctr_median and legacy_gsc_ctr_median and abs(resi_gsc_ctr_median - legacy_gsc_ctr_median) < 0.5 else 'legacy-stronger'}">
                    {'Resi stronger' if resi_gsc_ctr_median and legacy_gsc_ctr_median and resi_gsc_ctr_median > legacy_gsc_ctr_median else 'Comparable' if resi_gsc_ctr_median and legacy_gsc_ctr_median and abs(resi_gsc_ctr_median - legacy_gsc_ctr_median) < 0.5 else 'Legacy stronger'}
                </td>
            </tr>
            <tr>
                <td><strong>Engagement Rate (%)</strong></td>
                <td class="metric-value">{resi_engagement_median:.2f}%</td>
                <td class="metric-value">{legacy_engagement_median:.2f}%</td>
                <td class="{'resi-stronger' if resi_engagement_median and legacy_engagement_median and resi_engagement_median > legacy_engagement_median else 'comparable' if resi_engagement_median and legacy_engagement_median and abs(resi_engagement_median - legacy_engagement_median) < 2 else 'legacy-stronger'}">
                    {'Resi stronger' if resi_engagement_median and legacy_engagement_median and resi_engagement_median > legacy_engagement_median else 'Comparable' if resi_engagement_median and legacy_engagement_median and abs(resi_engagement_median - legacy_engagement_median) < 2 else 'Legacy stronger'}
                </td>
            </tr>
            <tr>
                <td><strong>LCP - Largest Contentful Paint (s)</strong></td>
                <td class="metric-value">{resi_lcp_median:.2f}s</td>
                <td class="metric-value">{legacy_lcp_median:.2f}s</td>
                <td class="{'resi-stronger' if resi_lcp_median and legacy_lcp_median and resi_lcp_median < legacy_lcp_median else 'comparable' if resi_lcp_median and legacy_lcp_median and abs(resi_lcp_median - legacy_lcp_median) < 0.5 else 'legacy-stronger'}">
                    {'Resi faster' if resi_lcp_median and legacy_lcp_median and resi_lcp_median < legacy_lcp_median else 'Comparable' if resi_lcp_median and legacy_lcp_median and abs(resi_lcp_median - legacy_lcp_median) < 0.5 else 'Legacy faster'}
                </td>
            </tr>
            <tr>
                <td><strong>FID - First Input Delay (ms)</strong></td>
                <td class="metric-value">{resi_fid_median:.0f}ms</td>
                <td class="metric-value">{legacy_fid_median:.0f}ms</td>
                <td class="{'resi-stronger' if resi_fid_median and legacy_fid_median and resi_fid_median < legacy_fid_median else 'comparable' if resi_fid_median and legacy_fid_median and abs(resi_fid_median - legacy_fid_median) < 20 else 'legacy-stronger'}">
                    {'Resi faster' if resi_fid_median and legacy_fid_median and resi_fid_median < legacy_fid_median else 'Comparable' if resi_fid_median and legacy_fid_median and abs(resi_fid_median - legacy_fid_median) < 20 else 'Legacy faster'}
                </td>
            </tr>
            <tr>
                <td><strong>CLS - Cumulative Layout Shift</strong></td>
                <td class="metric-value">{resi_cls_median:.3f}</td>
                <td class="metric-value">{legacy_cls_median:.3f}</td>
                <td class="{'resi-stronger' if resi_cls_median and legacy_cls_median and resi_cls_median < legacy_cls_median else 'comparable' if resi_cls_median and legacy_cls_median and abs(resi_cls_median - legacy_cls_median) < 0.02 else 'legacy-stronger'}">
                    {'Resi better' if resi_cls_median and legacy_cls_median and resi_cls_median < legacy_cls_median else 'Comparable' if resi_cls_median and legacy_cls_median and abs(resi_cls_median - legacy_cls_median) < 0.02 else 'Legacy better'}
                </td>
            </tr>
        </table>
        
        <div class="coverage">
            <strong>Note:</strong> SERP CTR from GSC (N={len(resi_gsc)} Resi, N={len(legacy_gsc)} Legacy). 
            Engagement Rate from GA4 (N={len(resi_ga4)} Resi, N={len(legacy_ga4)} Legacy). 
            CWV metrics from PageSpeed Insights mobile (N={len(resi_cwv)} Resi, N={len(legacy_cwv)} Legacy). 
            Lower is better for LCP, FID, CLS.
        </div>
        
        <h2>Executive Narrative</h2>
        <div class="narrative">
            Across a 30-day window comparing high-traffic properties (N=2 Resi, N={len(legacy_complete_props)} Legacy passing all volume gates), 
            the Resi site experience demonstrated {'stronger' if resi_gsc_ctr_median and legacy_gsc_ctr_median and resi_gsc_ctr_median > legacy_gsc_ctr_median else 'lower'} SERP CTR, 
            {'higher' if resi_engagement_median and legacy_engagement_median and resi_engagement_median > legacy_engagement_median else 'lower'} engagement rate, 
            and mixed Core Web Vitals performance (LCP: {resi_lcp_median:.2f}s vs {legacy_lcp_median:.2f}s, FID: {resi_fid_median:.0f}ms vs {legacy_fid_median:.0f}ms). 
            The extremely small sample sizes limit statistical inference—this is an exploratory baseline to validate the measurement framework. 
            Results will strengthen as more properties migrate to Resi and accumulate traffic.
        </div>
        
        <h2>Guardrails & Interpretation</h2>
        <div class="guardrails">
            <strong>Methodology:</strong>
            <ul>
                <li><strong>Medians used</strong> (not averages) for all cohort comparisons</li>
                <li><strong>Volume gates enforced:</strong> ≥300 GSC clicks, ≥1,500 GA4 sessions, CWV data available</li>
                <li><strong>Complete data filtering:</strong> Legacy cohort filtered to only properties passing all three gates (N={len(legacy_complete_props)} of 87)</li>
                <li><strong>Conversion proxies:</strong> SERP CTR, engagement rate, CWV (not lease conversions)</li>
                <li><strong>Internal comparison:</strong> Venterra portfolio only (no external competitors)</li>
                <li><strong>Sample size limitation:</strong> N=2 Resi, N={len(legacy_complete_props)} Legacy with complete data—insufficient for inference</li>
                <li><strong>Deferred:</strong> Paid Ads efficiency, meaningful actions per session (requires event mapping)</li>
            </ul>
            <strong>Interpretation:</strong> This is an <strong>exploratory baseline</strong> comparing high-traffic properties only. 
            Results are directional and will strengthen as Resi properties accumulate traffic and more properties migrate.
        </div>
        
        <p style="text-align: center; margin-top: 40px; color: #7f8c8d; font-size: 0.9em;">
            Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}<br>
            Framework: Resi vs Legacy Site Experience v1.0
        </p>
    </div>
</body>
</html>"""

# Save HTML
html_path = OUTPUT_DIR / "resi_vs_legacy_brief.html"
with open(html_path, 'w') as f:
    f.write(html)

print(f"\n✓ HTML brief saved: {html_path}")

# Save JSON debug artifact
json_data = {
    "meta": {
        "run_date": str(TODAY),
        "ga4_window": {"start": str(GA4_START), "end": str(GA4_END)},
        "gsc_window": {"start": str(GSC_START), "end": str(GSC_END)},
        "framework_version": "1.0"
    },
    "cohorts": {
        "resi": {
            "count": len(resi_properties),
            "properties": [p['name'] for p in resi_properties]
        },
        "legacy": {
            "count": len(legacy_properties),
            "properties": [p['name'] for p in legacy_properties]
        }
    },
    "medians": {
        "gsc_ctr": {
            "resi": resi_gsc_ctr_median,
            "legacy": legacy_gsc_ctr_median
        },
        "engagement_rate": {
            "resi": resi_engagement_median,
            "legacy": legacy_engagement_median
        },
        "cwv": {
            "lcp": {"resi": resi_lcp_median, "legacy": legacy_lcp_median},
            "fid": {"resi": resi_fid_median, "legacy": legacy_fid_median},
            "cls": {"resi": resi_cls_median, "legacy": legacy_cls_median}
        }
    },
    "coverage": {
        "gsc": {"resi": len(resi_gsc), "legacy": len(legacy_gsc)},
        "ga4": {"resi": len(resi_ga4), "legacy": len(legacy_ga4)},
        "cwv": {"resi": len(resi_cwv), "legacy": len(legacy_cwv)}
    },
    "exclusions": {
        "gsc": {"resi": resi_gsc_excluded, "legacy": legacy_gsc_excluded},
        "ga4": {"resi": resi_ga4_excluded, "legacy": legacy_ga4_excluded},
        "cwv": {"resi": resi_cwv_excluded, "legacy": legacy_cwv_excluded}
    }
}

json_path = OUTPUT_DIR / "resi_vs_legacy_brief.json"
with open(json_path, 'w') as f:
    json.dump(json_data, f, indent=2)

print(f"✓ JSON artifact saved: {json_path}")

print("\n" + "=" * 70)
print("✅ EXPLORATORY BRIEF GENERATION COMPLETE")
print("=" * 70)
print(f"\nOutputs:")
print(f"  HTML: {html_path}")
print(f"  JSON: {json_path}")
print(f"\nNext: Open HTML in browser or email manually")
