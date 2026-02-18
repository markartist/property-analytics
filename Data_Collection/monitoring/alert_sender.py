#!/usr/bin/env python3
"""
Data Collection Alert Email System
===================================
Sends email alerts for missing or stale data in portfolio analytics.

Usage:
    python3 send_data_alerts.py [--test]
"""

import sys
import os
import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

# Import from unified structure
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from Data_Collection.utils.email_sender import EmailSender


class DataAlertEmailer:
    """Sends email alerts for data collection issues."""
    
    def __init__(self, test_mode=False):
        self.test_mode = test_mode
        self.base_dir = Path(__file__).parent.parent.parent  # Property_Analytics root
        self.db_path = self.base_dir / 'data' / 'portfolio_analytics.db'
        self.registry_path = self.base_dir / 'config' / 'venterra_properties_official.json'
        
        # Load property registry
        with open(self.registry_path) as f:
            registry = json.load(f)
            self.properties = {p.get('ga4_property_id', p['name']): p['name'] 
                             for p in registry['properties']}
        
        self.recipient = 'mlaufhutte@venterraliving.com'
        
        # Create unified email sender
        if not test_mode:
            self.email_sender = EmailSender(verbose=False)
        
        if test_mode:
            print("🧪 TEST MODE: Email preview only (no actual send)")
    
    def check_collection_failures(self):
        """
        Check if recent collection jobs failed.
        
        Returns:
            dict: Collection failures by source
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Check for collection job failures in last 3 days
        three_days_ago = (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d')
        
        failures = {}
        
        try:
            # Check data_collections table for failed jobs
            cursor.execute("""
                SELECT 
                    data_source,
                    started_at,
                    status,
                    error_message,
                    properties_total,
                    properties_failed
                FROM data_collections
                WHERE DATE(started_at) >= ?
                AND (status = 'failed' OR properties_failed > properties_total * 0.2)
                ORDER BY started_at DESC
            """, (three_days_ago,))
            
            for row in cursor.fetchall():
                source, started, status, error, total, failed = row
                
                if source not in failures:
                    failures[source] = []
                
                failures[source].append({
                    'timestamp': started,
                    'status': status,
                    'error': error,
                    'properties_total': total,
                    'properties_failed': failed
                })
        except sqlite3.OperationalError:
            # Table might not exist in older databases
            pass
        
        conn.close()
        return failures
    
    def check_data_freshness(self):
        """
        Check data freshness for all collectors.
        
        Returns:
            dict: Issues found by data source
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        two_days_ago = (datetime.now() - timedelta(days=2)).strftime('%Y-%m-%d')
        
        # GSC has 3-day data delay (confirmed by API testing), so expect data from 3 days ago
        gsc_expected = (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d')
        gsc_stale_threshold = (datetime.now() - timedelta(days=5)).strftime('%Y-%m-%d')
        
        issues = {
            'ga4': {'missing': [], 'stale': []},
            'gsc': {'missing': [], 'stale': []},
            'google_ads': {'missing': [], 'stale': []},
            'psi': {'missing': [], 'stale': []},
            'semrush': {'missing': [], 'stale': []},
            'gbp_reviews': {'missing': [], 'stale': []},
            'gbp_insights': {'missing': [], 'stale': []},
            'gtmetrix': {'missing': [], 'stale': []},
            'thirtylines': {'missing': [], 'stale': []}
        }
        
        # Check GA4 data
        cursor.execute("""
            SELECT property_id, MAX(metric_date) as last_date
            FROM ga4_daily_metrics
            GROUP BY property_id
        """)
        ga4_data = {row[0]: row[1] for row in cursor.fetchall()}
        
        for prop_id, prop_name in self.properties.items():
            if prop_id in ga4_data:
                last_date = ga4_data[prop_id]
                if last_date < yesterday:
                    if last_date < two_days_ago:
                        issues['ga4']['stale'].append((prop_name, last_date))
                    else:
                        issues['ga4']['missing'].append((prop_name, last_date))
            else:
                issues['ga4']['missing'].append((prop_name, 'Never'))
        
        # Check GSC data - map URLs to property names from registry
        cursor.execute("""
            SELECT gsc_site_url, MAX(metric_date) as last_date
            FROM gsc_daily_metrics
            GROUP BY gsc_site_url
        """)
        gsc_data = {row[0]: row[1] for row in cursor.fetchall()}
        
        # Build URL to property name mapping from registry
        with open(self.registry_path) as f:
            registry = json.load(f)
            url_to_property = {}
            for p in registry['properties']:
                if p.get('gsc_url'):
                    # Add exact match
                    url_to_property[p['gsc_url']] = p['name']
                    # Also add normalized versions (with/without trailing slash)
                    normalized = p['gsc_url'].rstrip('/')
                    url_to_property[normalized] = p['name']
                    url_to_property[normalized + '/'] = p['name']
        
        for url, last_date in gsc_data.items():
            # Get actual property name from registry, fallback to URL parsing
            prop_name = url_to_property.get(url)
            if not prop_name:
                # Try normalized URL (remove trailing slash)
                normalized_url = url.rstrip('/')
                prop_name = url_to_property.get(normalized_url)
            
            if not prop_name:
                # Fallback: extract from URL
                prop_name = url.replace('sc-domain:', '').replace('https://', '').replace('www.', '').split('/')[0]
            
            # GSC has 2-3 day delay, so only flag if older than expected
            if last_date < gsc_expected:
                if last_date < gsc_stale_threshold:
                    issues['gsc']['stale'].append((prop_name, last_date))
                else:
                    issues['gsc']['missing'].append((prop_name, last_date))
        
        # Check Google Ads data
        cursor.execute("""
            SELECT property_id, MAX(metric_date) as last_date
            FROM google_ads_campaigns
            GROUP BY property_id
        """)
        ads_data = {row[0]: row[1] for row in cursor.fetchall()}
        
        for prop_id, prop_name in self.properties.items():
            if prop_id in ads_data:
                last_date = ads_data[prop_id]
                if last_date < yesterday:
                    if last_date < two_days_ago:
                        issues['google_ads']['stale'].append((prop_name, last_date))
                    else:
                        issues['google_ads']['missing'].append((prop_name, last_date))
        
        # Check PSI data (if table exists)
        try:
            cursor.execute("""
                SELECT url, MAX(test_date) as last_date
                FROM psi_performance_scores
                GROUP BY url
            """)
            psi_data = {row[0]: row[1] for row in cursor.fetchall()}
            
            # PSI is less frequent, so only flag if > 7 days old
            week_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
            for url, last_date in psi_data.items():
                if last_date < week_ago:
                    prop_name = url.replace('https://', '').replace('www.', '').split('.')[0]
                    issues['psi']['stale'].append((prop_name, last_date))
        except sqlite3.OperationalError:
            # Table doesn't exist yet
            pass
        
        # Check GBP Reviews data
        try:
            cursor.execute("""
                SELECT property_id, MAX(DATE(collected_at)) as last_collection
                FROM gbp_reviews
                GROUP BY property_id
            """)
            gbp_review_data = {row[0]: row[1] for row in cursor.fetchall()}
            
            # GBP reviews should be collected daily
            three_days_ago = (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d')
            for prop_id, last_collection in gbp_review_data.items():
                if last_collection < yesterday:
                    prop_name = self.properties.get(prop_id, prop_id)
                    if last_collection < three_days_ago:
                        issues['gbp_reviews']['stale'].append((prop_name, last_collection))
                    else:
                        issues['gbp_reviews']['missing'].append((prop_name, last_collection))
        except sqlite3.OperationalError:
            pass
        
        # Check GBP Insights data
        try:
            cursor.execute("""
                SELECT property_id, MAX(metric_date) as last_date
                FROM gbp_daily_insights
                GROUP BY property_id
            """)
            gbp_insights_data = {row[0]: row[1] for row in cursor.fetchall()}
            
            # GBP insights should be daily, with 2-day lag like GSC
            gbp_expected = (datetime.now() - timedelta(days=2)).strftime('%Y-%m-%d')
            for prop_id, last_date in gbp_insights_data.items():
                if last_date < gbp_expected:
                    prop_name = self.properties.get(prop_id, prop_id)
                    if last_date < two_days_ago:
                        issues['gbp_insights']['stale'].append((prop_name, last_date))
                    else:
                        issues['gbp_insights']['missing'].append((prop_name, last_date))
        except sqlite3.OperationalError:
            pass
        
        # Check GTMetrix data
        try:
            cursor.execute("""
                SELECT property_id, MAX(metric_date) as last_date
                FROM gtmetrix_metrics
                GROUP BY property_id
            """)
            gtmetrix_data = {row[0]: row[1] for row in cursor.fetchall()}
            
            # GTMetrix runs less frequently (weekly/monthly), only flag if > 30 days
            month_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
            for prop_id, last_date in gtmetrix_data.items():
                if last_date < month_ago:
                    prop_name = self.properties.get(prop_id, prop_id)
                    issues['gtmetrix']['stale'].append((prop_name, last_date))
        except sqlite3.OperationalError:
            pass
        
        # Check ThirtyLines data
        try:
            cursor.execute("""
                SELECT property_id, MAX(DATE(updated_at)) as last_update
                FROM property_floorplans
                GROUP BY property_id
            """)
            thirtylines_data = {row[0]: row[1] for row in cursor.fetchall()}
            
            # ThirtyLines should update daily
            for prop_id, last_update in thirtylines_data.items():
                if last_update < yesterday:
                    prop_name = self.properties.get(prop_id, prop_id)
                    if last_update < two_days_ago:
                        issues['thirtylines']['stale'].append((prop_name, last_update))
                    else:
                        issues['thirtylines']['missing'].append((prop_name, last_update))
        except sqlite3.OperationalError:
            pass
        
        conn.close()
        
        # Filter out issues with no problems
        issues = {k: v for k, v in issues.items() 
                 if v['missing'] or v['stale']}
        
        return issues
    
    def build_alert_html(self, issues, collection_failures=None):
        """Build HTML email body for data alerts."""
        
        # Count total issues
        total_missing = sum(len(v['missing']) for v in issues.values())
        total_stale = sum(len(v['stale']) for v in issues.values())
        collection_failure_count = len(collection_failures) if collection_failures else 0
        
        if total_missing == 0 and total_stale == 0 and collection_failure_count == 0:
            return self._build_all_clear_html()
        
        # Collection failures are CRITICAL
        if collection_failure_count > 0:
            severity = "🔴 CRITICAL"
        elif total_missing > 10 or total_stale > 10:
            severity = "🔴 CRITICAL"
        else:
            severity = "⚠️ WARNING"
        
        html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }}
        .header {{ background: #15284B; color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; }}
        .header h1 {{ margin: 0; font-size: 24px; }}
        .header .subtitle {{ opacity: 0.9; margin-top: 8px; font-size: 14px; }}
        .severity {{ display: inline-block; padding: 6px 12px; background: #ff4444; color: white; border-radius: 4px; font-weight: bold; margin-top: 10px; }}
        .warning {{ background: #ffaa00; }}
        .summary {{ background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #667eea; }}
        .summary-stat {{ display: inline-block; margin-right: 30px; }}
        .summary-stat .number {{ font-size: 32px; font-weight: bold; color: #667eea; }}
        .summary-stat .label {{ color: #666; font-size: 14px; }}
        .critical {{ background: #fff5f5; border-left: 4px solid #ff4444; padding: 20px; border-radius: 8px; margin-bottom: 20px; }}
        .critical h3 {{ color: #ff4444; margin-top: 0; }}
        .failure-item {{ background: white; border: 1px solid #ffdddd; padding: 10px; margin: 10px 0; border-radius: 4px; }}
        .source-section {{ background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 20px; }}
        .source-section h2 {{ margin-top: 0; color: #667eea; font-size: 18px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }}
        .issue-list {{ list-style: none; padding: 0; }}
        .issue-list li {{ padding: 10px; margin: 5px 0; background: #f8f9fa; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; }}
        .issue-list li.missing {{ border-left: 4px solid #ff4444; }}
        .issue-list li.stale {{ border-left: 4px solid #ffaa00; }}
        .property-name {{ font-weight: 600; }}
        .last-date {{ color: #666; font-size: 13px; }}
        .badge {{ display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: bold; }}
        .badge-missing {{ background: #ff4444; color: white; }}
        .badge-stale {{ background: #ffaa00; color: white; }}
        .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Data Collection Alert</h1>
        <div class="subtitle">Portfolio Analytics Monitoring · {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</div>
        <span class="severity {'warning' if 'WARNING' in severity else ''}">{severity}</span>
    </div>
    
    <div class="summary">
        <div class="summary-stat">
            <div class="number">{collection_failure_count}</div>
            <div class="label">Collection Failures</div>
        </div>
        <div class="summary-stat">
            <div class="number">{total_missing}</div>
            <div class="label">Missing Yesterday</div>
        </div>
        <div class="summary-stat">
            <div class="number">{total_stale}</div>
            <div class="label">Stale (>2 days)</div>
        </div>
    </div>
"""
        
        # Add collection failures section if any
        if collection_failures:
            html += """
    <div class="critical">
        <h3>🔴 CRITICAL: Collection Job Failures Detected</h3>
        <p style="color: #666; margin-bottom: 15px;">The following data collection jobs have failed in the last 3 days. This is a <strong>system-level failure</strong>, not just missing data.</p>
"""
            
            for source, failures in collection_failures.items():
                html += f"""        <div class="failure-item">
            <strong>{source.upper()}</strong><br>
"""
                for failure in failures:
                    timestamp = failure['timestamp']
                    status = failure['status']
                    error = failure['error'] or 'No error message'
                    total = failure['properties_total'] or 0
                    failed = failure['properties_failed'] or 0
                    
                    html += f"""            <div style="margin: 5px 0; padding-left: 10px; border-left: 2px solid #ff4444;">
                <span style="color: #999; font-size: 12px;">{timestamp}</span><br>
                Status: <span style="color: #ff4444; font-weight: bold;">{status}</span> 
                ({failed}/{total} properties failed)<br>
                <span style="color: #666; font-size: 13px;">{error[:200]}</span>
            </div>
"""
                html += """        </div>
"""
            
            html += """        <p style="margin-top: 15px; padding: 10px; background: #fff; border-left: 3px solid #ff4444;">
            <strong>⚠️ Action Required:</strong> Collection system is not running properly. Check logs immediately:
            <code>/Users/mark/Property_Analytics/Portfolio_Monitoring/logs/collection_stdout.log</code>
        </p>
    </div>
"""
        
        # Add sections for each data source with issues
        source_names = {
            'ga4': '📊 Google Analytics 4',
            'gsc': '🔍 Google Search Console',
            'google_ads': '📢 Google Ads',
            'psi': '⚡ PageSpeed Insights',
            'semrush': '📈 SEMRush',
            'gbp_reviews': '⭐ Google Business Profile Reviews',
            'gbp_insights': '📍 Google Business Profile Insights',
            'gtmetrix': '⚡ GTMetrix Performance',
            'thirtylines': '🏢 ThirtyLines Availability'
        }
        
        for source, data in issues.items():
            if not data['missing'] and not data['stale']:
                continue
            
            html += f"""
    <div class="source-section">
        <h2>{source_names.get(source, source.upper())}</h2>
"""
            
            if data['missing']:
                html += """        <h3 style="color: #ff4444; font-size: 14px; margin-top: 0;">Missing Yesterday's Data</h3>
        <ul class="issue-list">
"""
                for prop_name, last_date in sorted(data['missing']):
                    html += f"""            <li class="missing">
                <span class="property-name">{prop_name}</span>
                <span><span class="last-date">Last: {last_date}</span> <span class="badge badge-missing">MISSING</span></span>
            </li>
"""
                html += """        </ul>
"""
            
            if data['stale']:
                html += """        <h3 style="color: #ffaa00; font-size: 14px; margin-top: 15px;">Stale Data (>2 days old)</h3>
        <ul class="issue-list">
"""
                for prop_name, last_date in sorted(data['stale']):
                    days_old = (datetime.now().date() - datetime.strptime(last_date, '%Y-%m-%d').date()).days
                    html += f"""            <li class="stale">
                <span class="property-name">{prop_name}</span>
                <span><span class="last-date">Last: {last_date} ({days_old} days ago)</span> <span class="badge badge-stale">STALE</span></span>
            </li>
"""
                html += """        </ul>
"""
            
            html += """    </div>
"""
        
        html += f"""
    <div class="footer">
        <strong>Recommended Actions:</strong>
        <ul style="margin-top: 10px;">
            <li>Check collector logs: <code>/Users/mark/Property_Analytics/logs/</code></li>
            <li>Run manual collection: <code>cd /Users/mark/Property_Analytics/Portfolio_Monitoring && python3 collect_daily_data.py</code></li>
            <li>Verify API credentials and quotas</li>
        </ul>
        <p style="margin-top: 15px;">Database: <code>{self.db_path}</code></p>
    </div>
</body>
</html>"""
        
        return html
    
    def _build_all_clear_html(self):
        """Build HTML for all-clear status."""
        return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }}
        .header {{ background: #15284B; color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; text-align: center; }}
        .header h1 {{ margin: 0; font-size: 24px; }}
        .header .subtitle {{ opacity: 0.9; margin-top: 8px; font-size: 14px; }}
        .message {{ background: #f8f9fa; padding: 30px; border-radius: 8px; text-align: center; font-size: 18px; }}
        .checkmark {{ font-size: 64px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>✅ All Systems Operational</h1>
        <div class="subtitle">Portfolio Analytics Monitoring · {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</div>
    </div>
    
    <div class="message">
        <div class="checkmark">✅</div>
        <p><strong>All data collectors are up-to-date!</strong></p>
        <p style="color: #666; font-size: 14px;">No missing or stale data detected for any properties.</p>
    </div>
</body>
</html>"""
    
    def send_alert_email(self, issues, collection_failures=None):
        """Send alert email via Gmail SMTP."""
        
        # Build email
        html_body = self.build_alert_html(issues, collection_failures)
        
        # Determine subject based on severity
        total_issues = sum(len(v['missing']) + len(v['stale']) for v in issues.values())
        collection_failure_count = len(collection_failures) if collection_failures else 0
        
        if collection_failure_count > 0:
            subject = f"🔴 CRITICAL: Collection System Failure ({collection_failure_count} jobs failed)"
        elif total_issues == 0:
            subject = "✅ Data Collection Status: All Clear"
        elif total_issues > 20:
            subject = f"🔴 CRITICAL: {total_issues} Data Collection Issues Detected"
        else:
            subject = f"⚠️ Data Collection Alert: {total_issues} Issues Found"
        
        # Plain text fallback
        plain_text = f"""Data Collection Alert

Total Issues: {total_issues}

Please view this email in an HTML-capable client for full details.

Report generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        
        if self.test_mode:
            print("\n" + "="*80)
            print("📧 EMAIL PREVIEW (Test Mode)")
            print("="*80)
            print(f"To: {self.recipient}")
            print(f"Subject: {subject}")
            print("\n[HTML body would be sent - preview saved to /tmp/alert_preview.html]")
            
            # Save preview
            with open('/tmp/alert_preview.html', 'w') as f:
                f.write(html_body)
            print("Preview saved to: /tmp/alert_preview.html")
            return True
        
        # Send email via unified sender
        try:
            self.email_sender.send_email(
                subject=subject,
                html_body=html_body,
                plain_text=plain_text,
                recipients=[self.recipient],
                reply_to='mlaufhutte@venterraliving.com'
            )
            
            print(f"✅ Alert email sent to {self.recipient}")
            print(f"   Subject: {subject}")
            return True
            
        except Exception as e:
            print(f"❌ Email send failed: {e}")
            return False
    
    def run(self):
        """Main execution: check data and send alerts if needed."""
        print("="*80)
        print("📊 DATA COLLECTION MONITORING")
        print("="*80)
        print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        # Check collection job failures FIRST
        print("Checking collection job status...")
        collection_failures = self.check_collection_failures()
        
        if collection_failures:
            print(f"🔴 CRITICAL: Found {len(collection_failures)} data sources with collection failures!")
            for source, failures in collection_failures.items():
                print(f"   {source.upper()}: {len(failures)} failed job(s) in last 3 days")
        else:
            print("✅ No collection job failures detected")
        
        print()
        
        # Check data freshness
        print("Checking data freshness...")
        issues = self.check_data_freshness()
        
        total_issues = sum(len(v['missing']) + len(v['stale']) for v in issues.values())
        
        if total_issues == 0:
            print("✅ All data sources are up-to-date!")
        else:
            print(f"⚠️  Found {total_issues} data freshness issues across {len(issues)} data sources")
            for source, data in issues.items():
                missing = len(data['missing'])
                stale = len(data['stale'])
                if missing or stale:
                    print(f"   {source.upper()}: {missing} missing, {stale} stale")
        
        print()
        
        # Send alert email
        print("Sending alert email...")
        success = self.send_alert_email(issues, collection_failures)
        
        print()
        print("="*80)
        
        return 0 if success else 1


def main():
    test_mode = '--test' in sys.argv
    
    alerter = DataAlertEmailer(test_mode=test_mode)
    sys.exit(alerter.run())


if __name__ == '__main__':
    main()
