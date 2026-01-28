#!/usr/bin/env python3
"""
Pre-Opening Performance Dashboard
==================================
Tracks interest metrics and readiness for new development properties before launch.

Analyzes:
- Website traffic trends (GA4)
- Search visibility (GSC)
- Site performance (PSI)
- Google Business Profile engagement (GBP)

Properties:
- Monteverde (San Antonio)
- The Vine Kyle Parkway (Austin)
- Sundara at Spring Cypress (Houston)
"""

import sqlite3
import json
from datetime import datetime, timedelta
from pathlib import Path

# Configuration
DB_PATH = 'data/portfolio_analytics.db'
OUTPUT_DIR = Path('reports/new_developments')
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Load registry for property details
with open('config/venterra_properties_official.json', 'r') as f:
    registry = json.load(f)

# Get new development properties
new_dev_props = [p for p in registry['properties'] if p.get('property_type') == 'new_development']

print("=" * 70)
print("PRE-OPENING PERFORMANCE DASHBOARD GENERATOR")
print("=" * 70)
print(f"\nAnalyzing {len(new_dev_props)} new development properties:")
for prop in new_dev_props:
    print(f"  - {prop['name']} ({prop.get('metro', 'Unknown')})")

# Connect to database
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Collect metrics for each property
property_data = []

for prop in new_dev_props:
    prop_id = prop['ga4_property_id']
    name = prop['name']
    
    data = {
        'name': name,
        'ga4_id': prop_id,
        'metro': prop.get('metro', 'Unknown'),
        'url': prop.get('full_url', ''),
        'domain': prop.get('search_domain', ''),
    }
    
    print(f"\n{'=' * 70}")
    print(f"Collecting data for: {name}")
    print(f"{'=' * 70}")
    
    # GA4 Metrics
    if prop_id != 'PENDING':
        cursor.execute("""
            SELECT 
                COUNT(*) as days,
                MIN(metric_date) as first_date,
                MAX(metric_date) as last_date,
                SUM(sessions) as total_sessions,
                SUM(total_users) as total_users,
                SUM(engaged_sessions) as engaged_sessions,
                SUM(pageviews) as pageviews,
                AVG(avg_session_duration) as avg_duration,
                AVG(bounce_rate) as avg_bounce_rate
            FROM ga4_daily_metrics
            WHERE property_id = ?
        """, (prop_id,))
        
        ga4 = cursor.fetchone()
        if ga4 and ga4[0]:
            data['ga4'] = {
                'days': ga4[0],
                'date_range': f"{ga4[1]} to {ga4[2]}",
                'sessions': ga4[3] or 0,
                'users': ga4[4] or 0,
                'engaged_sessions': ga4[5] or 0,
                'engagement_rate': round((ga4[5] / ga4[3] * 100), 1) if ga4[3] else 0,
                'pageviews': ga4[6] or 0,
                'avg_duration': round(ga4[7], 1) if ga4[7] else 0,
                'bounce_rate': round(ga4[8], 1) if ga4[8] else 0,
                'pages_per_session': round(ga4[6] / ga4[3], 2) if ga4[3] else 0
            }
            print(f"  GA4: {ga4[0]} days | {ga4[3]:,} sessions | {ga4[4]:,} users")
        else:
            data['ga4'] = None
            print(f"  GA4: No data")
    else:
        data['ga4'] = None
        print(f"  GA4: Pending (no property ID)")
    
    # GSC Metrics
    if prop_id != 'PENDING':
        cursor.execute("""
            SELECT 
                COUNT(*) as days,
                MIN(metric_date) as first_date,
                MAX(metric_date) as last_date,
                SUM(clicks) as total_clicks,
                SUM(impressions) as total_impressions,
                AVG(ctr) as avg_ctr,
                AVG(average_position) as avg_position
            FROM gsc_daily_metrics
            WHERE ga4_property_id = ?
        """, (prop_id,))
    else:
        # Sundara - use GSC URL
        gsc_url = f"sc-domain:{prop.get('search_domain', '')}"
        cursor.execute("""
            SELECT 
                COUNT(*) as days,
                MIN(metric_date) as first_date,
                MAX(metric_date) as last_date,
                SUM(clicks) as total_clicks,
                SUM(impressions) as total_impressions,
                AVG(ctr) as avg_ctr,
                AVG(average_position) as avg_position
            FROM gsc_daily_metrics
            WHERE property_id = ?
        """, (gsc_url,))
    
    gsc = cursor.fetchone()
    if gsc and gsc[0]:
        data['gsc'] = {
            'days': gsc[0],
            'date_range': f"{gsc[1]} to {gsc[2]}",
            'clicks': gsc[3] or 0,
            'impressions': gsc[4] or 0,
            'ctr': round(gsc[5] * 100, 2) if gsc[5] else 0,
            'avg_position': round(gsc[6], 1) if gsc[6] else 0
        }
        print(f"  GSC: {gsc[0]} days | {gsc[3]:,} clicks | {gsc[4]:,} impressions")
    else:
        data['gsc'] = None
        print(f"  GSC: No data")
    
    # PSI Metrics
    if prop_id != 'PENDING':
        cursor.execute("""
            SELECT 
                COUNT(DISTINCT metric_date) as days,
                AVG(CASE WHEN strategy = 'mobile' THEN performance_score END) as mobile_perf,
                AVG(CASE WHEN strategy = 'desktop' THEN performance_score END) as desktop_perf,
                AVG(CASE WHEN strategy = 'mobile' THEN lcp_value END) as mobile_lcp,
                AVG(CASE WHEN strategy = 'mobile' THEN cls_value END) as mobile_cls
            FROM pagespeed_metrics
            WHERE property_id = ?
        """, (prop_id,))
        
        psi = cursor.fetchone()
        if psi and psi[0]:
            data['psi'] = {
                'days': psi[0],
                'mobile_performance': round(psi[1]) if psi[1] else 0,
                'desktop_performance': round(psi[2]) if psi[2] else 0,
                'mobile_lcp': round(psi[3], 2) if psi[3] else 0,
                'mobile_cls': round(psi[4], 3) if psi[4] else 0
            }
            print(f"  PSI: {psi[0]} days | Mobile: {int(psi[1]) if psi[1] else 0}/100")
        else:
            data['psi'] = None
            print(f"  PSI: No data")
    else:
        data['psi'] = None
    
    # GBP Metrics
    if prop_id != 'PENDING':
        cursor.execute("""
            SELECT 
                COUNT(*) as days,
                SUM(website_clicks) as website_clicks,
                SUM(phone_calls) as phone_calls,
                SUM(direction_requests) as directions
            FROM gbp_daily_insights
            WHERE property_id = ?
        """, (prop_id,))
        
        gbp = cursor.fetchone()
        if gbp and gbp[0]:
            data['gbp'] = {
                'days': gbp[0],
                'website_clicks': gbp[1] or 0,
                'phone_calls': gbp[2] or 0,
                'directions': gbp[3] or 0,
                'total_actions': (gbp[1] or 0) + (gbp[2] or 0) + (gbp[3] or 0)
            }
            print(f"  GBP: {gbp[0]} days | {data['gbp']['total_actions']:,} total actions")
        else:
            data['gbp'] = None
            print(f"  GBP: No data")
    else:
        data['gbp'] = None
    
    property_data.append(data)

conn.close()

print(f"\n{'=' * 70}")
print("Data collection complete")
print(f"{'=' * 70}\n")

# Generate HTML Report
report_date = datetime.now().strftime('%Y-%m-%d')
html_file = OUTPUT_DIR / f'pre_opening_dashboard_{report_date}.html'

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pre-Opening Performance Dashboard - {report_date}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }}
        .header {{
            background: #15284B;
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }}
        .header h1 {{
            margin: 0 0 10px 0;
            font-size: 32px;
        }}
        .header .subtitle {{
            opacity: 0.9;
            font-size: 16px;
        }}
        .executive-summary {{
            background: white;
            padding: 25px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .executive-summary h2 {{
            margin-top: 0;
            color: #333;
            border-bottom: 3px solid #15284B;
            padding-bottom: 10px;
        }}
        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }}
        .summary-card {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #15284B;
        }}
        .summary-card .label {{
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .summary-card .value {{
            font-size: 28px;
            font-weight: bold;
            color: #333;
            margin: 5px 0;
        }}
        .summary-card .subvalue {{
            font-size: 14px;
            color: #888;
        }}
        .property-section {{
            background: white;
            padding: 25px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .property-section h2 {{
            margin-top: 0;
            color: #333;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }}
        .metro-badge {{
            background: #15284B;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: normal;
        }}
        .metrics-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }}
        .metric-box {{
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
        }}
        .metric-box h3 {{
            margin: 0 0 15px 0;
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .metric-row {{
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e0e0e0;
        }}
        .metric-row:last-child {{
            border-bottom: none;
        }}
        .metric-label {{
            color: #666;
        }}
        .metric-value {{
            font-weight: bold;
            color: #333;
        }}
        .status-badge {{
            display: inline-block;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
        }}
        .status-complete {{ background: #d4edda; color: #155724; }}
        .status-partial {{ background: #fff3cd; color: #856404; }}
        .status-pending {{ background: #f8d7da; color: #721c24; }}
        .comparative-table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }}
        .comparative-table th {{
            background: #15284B;
            color: white;
            padding: 12px;
            text-align: left;
        }}
        .comparative-table td {{
            padding: 12px;
            border-bottom: 1px solid #e0e0e0;
        }}
        .comparative-table tr:hover {{
            background: #f8f9fa;
        }}
        .note {{
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin-top: 20px;
            border-radius: 5px;
        }}
        .note strong {{
            color: #856404;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🏗️ Pre-Opening Performance Dashboard</h1>
        <div class="subtitle">New Development Properties | Generated {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</div>
    </div>

    <div class="executive-summary">
        <h2>Executive Summary</h2>
        <div class="summary-grid">
"""

# Calculate totals
total_sessions = sum(p['ga4']['sessions'] if p['ga4'] else 0 for p in property_data)
total_users = sum(p['ga4']['users'] if p['ga4'] else 0 for p in property_data)
total_clicks = sum(p['gsc']['clicks'] if p['gsc'] else 0 for p in property_data)
total_impressions = sum(p['gsc']['impressions'] if p['gsc'] else 0 for p in property_data)

html += f"""
            <div class="summary-card">
                <div class="label">Total Website Sessions</div>
                <div class="value">{total_sessions:,}</div>
                <div class="subvalue">Across all properties</div>
            </div>
            <div class="summary-card">
                <div class="label">Unique Visitors</div>
                <div class="value">{total_users:,}</div>
                <div class="subvalue">Cumulative reach</div>
            </div>
            <div class="summary-card">
                <div class="label">Search Clicks</div>
                <div class="value">{total_clicks:,}</div>
                <div class="subvalue">{total_impressions:,} impressions</div>
            </div>
            <div class="summary-card">
                <div class="label">Properties Tracked</div>
                <div class="value">{len(property_data)}</div>
                <div class="subvalue">New developments</div>
            </div>
        </div>
    </div>
"""

# Comparative Overview
html += """
    <div class="property-section">
        <h2>Comparative Overview</h2>
        <table class="comparative-table">
            <thead>
                <tr>
                    <th>Property</th>
                    <th>Metro</th>
                    <th>Sessions</th>
                    <th>Users</th>
                    <th>Search Clicks</th>
                    <th>Data Status</th>
                </tr>
            </thead>
            <tbody>
"""

for prop in property_data:
    ga4_sessions = prop['ga4']['sessions'] if prop['ga4'] else 0
    ga4_users = prop['ga4']['users'] if prop['ga4'] else 0
    gsc_clicks = prop['gsc']['clicks'] if prop['gsc'] else 0
    
    # Determine data completeness
    sources = sum([1 if prop['ga4'] else 0, 1 if prop['gsc'] else 0, 
                   1 if prop['psi'] else 0, 1 if prop['gbp'] else 0])
    
    if sources == 4:
        status = '<span class="status-badge status-complete">Complete</span>'
    elif sources >= 2:
        status = '<span class="status-badge status-partial">Partial</span>'
    else:
        status = '<span class="status-badge status-pending">Limited</span>'
    
    html += f"""
                <tr>
                    <td><strong>{prop['name']}</strong></td>
                    <td>{prop['metro']}</td>
                    <td>{ga4_sessions:,}</td>
                    <td>{ga4_users:,}</td>
                    <td>{gsc_clicks:,}</td>
                    <td>{status}</td>
                </tr>
    """

html += """
            </tbody>
        </table>
    </div>
"""

# Individual Property Sections
for prop in property_data:
    html += f"""
    <div class="property-section">
        <h2>{prop['name']} <span class="metro-badge">{prop['metro']}</span></h2>
        <div class="metrics-grid">
"""
    
    # GA4 Metrics
    if prop['ga4']:
        ga4 = prop['ga4']
        html += f"""
            <div class="metric-box">
                <h3>📊 Website Traffic ({ga4['days']} days)</h3>
                <div class="metric-row">
                    <span class="metric-label">Sessions</span>
                    <span class="metric-value">{ga4['sessions']:,}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Unique Users</span>
                    <span class="metric-value">{ga4['users']:,}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Engagement Rate</span>
                    <span class="metric-value">{ga4['engagement_rate']}%</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Avg. Session Duration</span>
                    <span class="metric-value">{ga4['avg_duration']}s</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Pages/Session</span>
                    <span class="metric-value">{ga4['pages_per_session']}</span>
                </div>
            </div>
"""
    else:
        html += """
            <div class="metric-box">
                <h3>📊 Website Traffic</h3>
                <div class="note">
                    <strong>No GA4 data available.</strong> Property ID pending.
                </div>
            </div>
"""
    
    # GSC Metrics
    if prop['gsc']:
        gsc = prop['gsc']
        html += f"""
            <div class="metric-box">
                <h3>🔍 Search Performance ({gsc['days']} days)</h3>
                <div class="metric-row">
                    <span class="metric-label">Clicks</span>
                    <span class="metric-value">{gsc['clicks']:,}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Impressions</span>
                    <span class="metric-value">{gsc['impressions']:,}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Click-Through Rate</span>
                    <span class="metric-value">{gsc['ctr']}%</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Avg. Position</span>
                    <span class="metric-value">{gsc['avg_position']}</span>
                </div>
            </div>
"""
    else:
        html += """
            <div class="metric-box">
                <h3>🔍 Search Performance</h3>
                <div class="note">
                    <strong>No GSC data available.</strong>
                </div>
            </div>
"""
    
    # PSI Metrics
    if prop['psi']:
        psi = prop['psi']
        html += f"""
            <div class="metric-box">
                <h3>⚡ Site Performance ({psi['days']} days)</h3>
                <div class="metric-row">
                    <span class="metric-label">Mobile Performance</span>
                    <span class="metric-value">{psi['mobile_performance']}/100</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Desktop Performance</span>
                    <span class="metric-value">{psi['desktop_performance']}/100</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">LCP (Mobile)</span>
                    <span class="metric-value">{psi['mobile_lcp']}s</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">CLS (Mobile)</span>
                    <span class="metric-value">{psi['mobile_cls']}</span>
                </div>
            </div>
"""
    else:
        html += """
            <div class="metric-box">
                <h3>⚡ Site Performance</h3>
                <div class="note">
                    <strong>Pending collection.</strong> Will be available in next daily run.
                </div>
            </div>
"""
    
    # GBP Metrics
    if prop['gbp']:
        gbp = prop['gbp']
        html += f"""
            <div class="metric-box">
                <h3>📍 Google Business Profile ({gbp['days']} days)</h3>
                <div class="metric-row">
                    <span class="metric-label">Website Clicks</span>
                    <span class="metric-value">{gbp['website_clicks']:,}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Phone Calls</span>
                    <span class="metric-value">{gbp['phone_calls']:,}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Direction Requests</span>
                    <span class="metric-value">{gbp['directions']:,}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Total Actions</span>
                    <span class="metric-value">{gbp['total_actions']:,}</span>
                </div>
            </div>
"""
    else:
        html += """
            <div class="metric-box">
                <h3>📍 Google Business Profile</h3>
                <div class="note">
                    <strong>Not configured</strong> or pending collection.
                </div>
            </div>
"""
    
    html += """
        </div>
    </div>
"""

# Footer with notes
html += """
    <div class="property-section">
        <h2>📝 Data Notes</h2>
        <ul style="line-height: 1.8;">
            <li><strong>Data Sources:</strong> Google Analytics 4 (GA4), Google Search Console (GSC), PageSpeed Insights (PSI), Google Business Profile (GBP)</li>
            <li><strong>Update Frequency:</strong> Automated daily collection at 5:00 AM</li>
            <li><strong>GSC Lag:</strong> Search Console data has a 3-day API delay</li>
            <li><strong>Pre-Opening Context:</strong> These properties are not yet operational; metrics track pre-launch interest and visibility</li>
            <li><strong>Missing Data:</strong> Some properties pending GA4 property ID or GBP configuration</li>
        </ul>
    </div>
    
    <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
        Generated by Portfolio Analytics System | """ + datetime.now().strftime('%Y-%m-%d %I:%M %p') + """
    </div>
</body>
</html>
"""

# Write HTML file
with open(html_file, 'w') as f:
    f.write(html)

print(f"✅ HTML report generated: {html_file}")
print(f"   File size: {html_file.stat().st_size:,} bytes")
print(f"\n{'=' * 70}")
print("REPORT COMPLETE")
print(f"{'=' * 70}")
