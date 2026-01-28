#!/usr/bin/env python3
"""
Daily Portfolio Health Report Generator
========================================

Technical diagnostic report for internal monitoring.
PIB-style layout, signal-heavy content, automated daily at 9 AM.

Purpose: Early warning system for portfolio issues.
Audience: Engineers, web ops, analytics stakeholders.

Usage:
    python3 generate_daily_portfolio_health.py [--date YYYY-MM-DD] [--dry-run]

Output: 
    /Users/mark/Property_Analytics/reports/daily_health/Portfolio_Health_Daily_YYYY-MM-DD.html

Author: Mark Laufhutte / Atlas
Date: 2026-01-27
"""

import sys
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple, Optional

# Add utils to path
sys.path.insert(0, str(Path(__file__).parent / "utils"))
from report_builder import ReportBuilder, KPITile, Section, create_side_by_side_layout


# Configuration
DB_PATH = Path(__file__).parent / "data" / "portfolio_analytics.db"
OUTPUT_DIR = Path(__file__).parent / "reports" / "daily_health"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class DailyHealthReport:
    """Daily Portfolio Health Report Generator"""
    
    def __init__(self, report_date: datetime):
        self.report_date = report_date
        self.date_str = report_date.strftime("%Y-%m-%d")
        self.yesterday_str = (report_date - timedelta(days=1)).strftime("%Y-%m-%d")
        self.week_ago_str = (report_date - timedelta(days=7)).strftime("%Y-%m-%d")
        
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row
        
        # Data collection status
        self.data_status = self._check_data_sources()
        
        # Alert buckets
        self.high_alerts = []
        self.medium_alerts = []
        self.low_alerts = []
        
        # Watchlists
        self.cwv_failing = []
        self.cwv_at_risk = []
        self.lcp_severe = []
        self.lcp_elevated = []
        
        # SEO hygiene issues
        self.seo_exceptions = []
        
    def _check_data_sources(self) -> Dict[str, Dict]:
        """Check freshness and availability of data sources"""
        status = {}
        
        # Check PageSpeed (collected daily, check last 7 days for any data)
        ps_check = self.conn.execute("""
            SELECT 
                COUNT(DISTINCT property_id) as props,
                MAX(metric_date) as latest_date,
                COUNT(*) as total_rows
            FROM pagespeed_metrics
            WHERE metric_date >= date('now', '-7 days')
        """).fetchone()
        
        # Check if latest collection is recent (within 3 days since collection is daily)
        latest_date = ps_check['latest_date']
        days_old = None
        if latest_date:
            from datetime import datetime
            latest = datetime.strptime(latest_date, '%Y-%m-%d')
            days_old = (datetime.now() - latest).days
        
        status['pagespeed'] = {
            'available': ps_check['props'] > 0,
            'properties': ps_check['props'],
            'latest': ps_check['latest_date'],
            'days_old': days_old,
            'status': 'OK' if ps_check['props'] > 80 and days_old <= 2 else 'PARTIAL' if ps_check['props'] > 0 else 'FAILED'
        }
        
        # Check GSC (collected daily, check last 7 days for any data)
        gsc_check = self.conn.execute("""
            SELECT 
                COUNT(DISTINCT property_id) as props,
                MAX(metric_date) as latest_date
            FROM gsc_daily_metrics
            WHERE metric_date >= date('now', '-7 days')
        """).fetchone()
        
        # Check if latest collection is recent
        latest_date = gsc_check['latest_date']
        days_old = None
        if latest_date:
            from datetime import datetime
            latest = datetime.strptime(latest_date, '%Y-%m-%d')
            days_old = (datetime.now() - latest).days
        
        status['gsc'] = {
            'available': gsc_check['props'] > 0,
            'properties': gsc_check['props'],
            'latest': gsc_check['latest_date'],
            'days_old': days_old,
            'status': 'OK' if gsc_check['props'] > 80 and days_old <= 2 else 'PARTIAL' if gsc_check['props'] > 0 else 'FAILED'
        }
        
        # Check GA4 (collected daily, check last 7 days for any data)  
        ga4_check = self.conn.execute("""
            SELECT 
                COUNT(DISTINCT property_id) as props,
                MAX(metric_date) as latest_date
            FROM ga4_daily_metrics
            WHERE metric_date >= date('now', '-7 days')
        """).fetchone()
        
        # Check if latest collection is recent
        latest_date = ga4_check['latest_date']
        days_old = None
        if latest_date:
            from datetime import datetime
            latest = datetime.strptime(latest_date, '%Y-%m-%d')
            days_old = (datetime.now() - latest).days
        
        status['ga4'] = {
            'available': ga4_check['props'] > 0,
            'properties': ga4_check['props'],
            'latest': ga4_check['latest_date'],
            'days_old': days_old,
            'status': 'OK' if ga4_check['props'] > 80 and days_old <= 2 else 'PARTIAL' if ga4_check['props'] > 0 else 'FAILED'
        }
        
        return status
    
    def _get_cwv_alerts(self):
        """Find CWV threshold crossings and regressions"""
        
        
        # Note: This query currently won't return results because field CWV scores
        # are not yet in the database. Leaving query structure for future enhancement.
        # For now, use lab data thresholds as proxy.
        
        # CWV at risk (needs improvement + lab data concerns)
        at_risk = self.conn.execute("""
            SELECT 
                p.canonical_name,
                pm.lcp_value,
                pm.cls_value,
                pm.fid_value,
                pm.performance_score as mobile_score,
                pm.metric_date
            FROM pagespeed_metrics pm
            JOIN properties p ON pm.property_id = p.property_id
            WHERE pm.metric_date >= date('now', '-7 days')
            AND pm.strategy = 'mobile'
            AND pm.performance_score < 90
            AND pm.performance_score IS NOT NULL
            ORDER BY pm.performance_score ASC, p.canonical_name
        """).fetchall()
        
        for row in at_risk:
            concerns = []
            if row['lcp_value'] and row['lcp_value'] > 2500:
                concerns.append(f"LCP {row['lcp_value']/1000:.1f}s")
            if row['cls_value'] and row['cls_value'] > 0.1:
                concerns.append(f"CLS {row['cls_value']:.3f}")
            if row['fid_value'] and row['fid_value'] > 100:
                concerns.append(f"FID {row['fid_value']:.0f}ms")
            
            if concerns:
                self.cwv_at_risk.append({
                    'property': row['property_name'],
                    'concerns': ', '.join(concerns),
                    'mobile_score': row['mobile_score'],
                    'date': row['metric_date']
                })
        
        # LCP risk bands
        lcp_bands = self.conn.execute("""
            SELECT 
                p.canonical_name,
                pm.lcp_value,
                pm.performance_score as mobile_score,
                pm.metric_date
            FROM pagespeed_metrics pm
            JOIN properties p ON pm.property_id = p.property_id
            WHERE pm.metric_date >= date('now', '-7 days')
            AND pm.strategy = 'mobile'
            AND pm.lcp_value IS NOT NULL
            ORDER BY pm.lcp_value DESC, p.canonical_name
        """).fetchall()
        
        for row in lcp_bands:
            lcp_ms = row['lcp_value']
            lcp_s = lcp_ms / 1000
            
            if lcp_ms > 4000:  # Severe
                self.lcp_severe.append({
                    'property': row['property_name'],
                    'lcp': f"{lcp_s:.1f}s",
                    'mobile_score': row['mobile_score']
                })
            elif lcp_ms > 2500:  # Elevated
                self.lcp_elevated.append({
                    'property': row['property_name'],
                    'lcp': f"{lcp_s:.1f}s",
                    'mobile_score': row['mobile_score']
                })
    
    def _generate_summary_section(self) -> str:
        """Generate header summary with KPI tiles"""
        
        # Count issues
        critical_count = len(self.cwv_failing)
        at_risk_count = len(self.cwv_at_risk)
        seo_issues = len(self.seo_exceptions)
        
        # Overall status
        if critical_count > 10:
            status_text = "⚠️ Multiple Critical Issues"
            status_color = "#dc3545"
        elif critical_count > 0:
            status_text = f"⚠️ {critical_count} Critical Issue{'s' if critical_count != 1 else ''}"
            status_color = "#ffc107"
        else:
            status_text = "✅ No Critical Issues"
            status_color = "#28a745"
        
        # Data sources status
        ps_status = self.data_status['pagespeed']['status']
        gsc_status = self.data_status['gsc']['status']
        ga4_status = self.data_status['ga4']['status']
        
        sources_html = f"""
        <div style="font-size: 12px; color: #6c757d; margin: 15px 0;">
            <strong>Data Sources:</strong>
            PageSpeed: <span style="color: {'#28a745' if ps_status == 'OK' else '#ffc107' if ps_status == 'PARTIAL' else '#dc3545'};">{ps_status}</span> ({self.data_status['pagespeed']['properties']} props) |
            GSC: <span style="color: {'#28a745' if gsc_status == 'OK' else '#ffc107' if gsc_status == 'PARTIAL' else '#dc3545'};">{gsc_status}</span> ({self.data_status['gsc']['properties']} props) |
            GA4: <span style="color: {'#28a745' if ga4_status == 'OK' else '#ffc107' if ga4_status == 'PARTIAL' else '#dc3545'};">{ga4_status}</span> ({self.data_status['ga4']['properties']} props)
        </div>
        """
        
        summary_html = f"""
        <div style="text-align: center; margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 6px;">
            <div style="font-size: 16px; font-weight: 600; color: {status_color}; margin-bottom: 10px;">
                {status_text}
            </div>
            {sources_html}
        </div>
        """
        
        return summary_html
    
    def _generate_cwv_watchlist_section(self) -> str:
        """Generate CWV watchlist section"""
        
        if not self.cwv_failing and not self.cwv_at_risk and not self.lcp_severe and not self.lcp_elevated:
            return """
            <div style="padding: 20px; text-align: center; color: #28a745; font-weight: 600;">
                ✅ All properties within acceptable CWV thresholds
            </div>
            """
        
        html = ""
        
        # CWV Failing
        if self.cwv_failing:
            html += """
            <div style="margin-bottom: 25px;">
                <h3 style="font-size: 15px; color: #dc3545; margin: 0 0 15px 0; font-weight: 600;">
                    🔴 CWV Failing (Field Data)
                </h3>
            """
            
            for item in self.cwv_failing:
                html += f"""
                <div style="padding: 12px; background: #fff; border-left: 4px solid #dc3545; margin-bottom: 10px; border-radius: 4px;">
                    <div style="font-weight: 600; color: #333;">{item['property']}</div>
                    <div style="font-size: 12px; color: #6c757d; margin-top: 4px;">
                        Failing: {item['metrics']} | Mobile Score: {item['mobile_score']}
                    </div>
                </div>
                """
            
            html += "</div>"
        
        # CWV At Risk
        if self.cwv_at_risk:
            html += """
            <div style="margin-bottom: 25px;">
                <h3 style="font-size: 15px; color: #ffc107; margin: 0 0 15px 0; font-weight: 600;">
                    🟡 CWV At Risk (Lab Data Concerns)
                </h3>
            """
            
            for item in self.cwv_at_risk[:10]:  # Limit to top 10
                html += f"""
                <div style="padding: 12px; background: #fff; border-left: 4px solid #ffc107; margin-bottom: 10px; border-radius: 4px;">
                    <div style="font-weight: 600; color: #333;">{item['property']}</div>
                    <div style="font-size: 12px; color: #6c757d; margin-top: 4px;">
                        {item['concerns']} | Mobile Score: {item['mobile_score']}
                    </div>
                </div>
                """
            
            if len(self.cwv_at_risk) > 10:
                html += f"""
                <div style="font-size: 12px; color: #6c757d; font-style: italic; text-align: center;">
                    + {len(self.cwv_at_risk) - 10} more properties at risk
                </div>
                """
            
            html += "</div>"
        
        # LCP Risk Bands
        if self.lcp_severe or self.lcp_elevated:
            html += """
            <div style="margin-bottom: 25px;">
                <h3 style="font-size: 15px; color: #333; margin: 0 0 15px 0; font-weight: 600;">
                    Mobile LCP Risk Bands
                </h3>
            """
            
            if self.lcp_severe:
                html += '<div style="margin-bottom: 15px;"><strong style="color: #dc3545;">Severe (&gt;4.0s):</strong><br>'
                for item in self.lcp_severe[:5]:
                    html += f'<span style="font-size: 13px; color: #6c757d;">{item["property"]}: {item["lcp"]}</span><br>'
                if len(self.lcp_severe) > 5:
                    html += f'<span style="font-size: 12px; color: #6c757d; font-style: italic;">+ {len(self.lcp_severe) - 5} more</span>'
                html += '</div>'
            
            if self.lcp_elevated:
                html += '<div style="margin-bottom: 15px;"><strong style="color: #ffc107;">Elevated (2.5-4.0s):</strong><br>'
                for item in self.lcp_elevated[:5]:
                    html += f'<span style="font-size: 13px; color: #6c757d;">{item["property"]}: {item["lcp"]}</span><br>'
                if len(self.lcp_elevated) > 5:
                    html += f'<span style="font-size: 12px; color: #6c757d; font-style: italic;">+ {len(self.lcp_elevated) - 5} more</span>'
                html += '</div>'
            
            html += "</div>"
        
        return html
    
    def _generate_suggested_actions(self) -> str:
        """Generate prioritized action list"""
        
        actions = []
        
        # Priority 1: Failing CWV
        if self.cwv_failing:
            top_failures = self.cwv_failing[:3]
            props = ', '.join([item['property'] for item in top_failures])
            actions.append({
                'priority': 1,
                'action': f"Investigate CWV failures on {props}",
                'reason': f"{len(self.cwv_failing)} properties failing field CWV - immediate SEO ranking risk"
            })
        
        # Priority 2: LCP severe
        if self.lcp_severe:
            actions.append({
                'priority': 2,
                'action': f"Optimize LCP for {len(self.lcp_severe)} properties with severe mobile LCP (>4.0s)",
                'reason': "High risk of CWV failure when field data accumulates"
            })
        
        # Priority 3: At-risk properties
        if self.cwv_at_risk:
            actions.append({
                'priority': 3,
                'action': f"Monitor {len(self.cwv_at_risk)} at-risk properties",
                'reason': "Lab data shows performance concerns but no field failures yet"
            })
        
        # Priority 4: Data collection issues
        failing_sources = [
            name for name, status in self.data_status.items()
            if status['status'] != 'OK'
        ]
        if failing_sources:
            actions.append({
                'priority': 4,
                'action': f"Investigate data collection failures: {', '.join(failing_sources)}",
                'reason': f"Incomplete monitoring coverage - {', '.join(failing_sources)} not collecting normally"
            })
        
        if not actions:
            return """
            <div style="padding: 20px; text-align: center; color: #28a745; font-weight: 600;">
                ✅ No immediate actions required - portfolio is healthy
            </div>
            """
        
        html = '<div style="padding: 20px; background: #fff; border-radius: 6px;">'
        
        for i, action in enumerate(actions, 1):
            priority_color = {1: '#dc3545', 2: '#fd7e14', 3: '#ffc107', 4: '#17a2b8'}.get(action['priority'], '#6c757d')
            
            html += f"""
            <div style="margin-bottom: 20px; padding: 15px; border-left: 4px solid {priority_color}; background: #f8f9fa;">
                <div style="font-weight: 600; color: {priority_color}; font-size: 14px; margin-bottom: 5px;">
                    Priority {action['priority']}: {action['action']}
                </div>
                <div style="font-size: 13px; color: #6c757d;">
                    {action['reason']}
                </div>
            </div>
            """
        
        html += '</div>'
        return html
    
    def generate(self) -> str:
        """Generate complete report"""
        
        # Collect data
        self._get_cwv_alerts()
        
        # Build report
        builder = ReportBuilder(
            title="Portfolio Health Daily",
            subtitle="Technical Diagnostics & Early Warning System",
            version="1.0",
            date_range=self.date_str
        )
        
        # Summary section
        summary_html = self._generate_summary_section()
        builder.add_section(Section(
            title="Summary",
            content=summary_html,
            status="healthy" if len(self.cwv_failing) == 0 else "action_needed",
            description="Current portfolio health status and data collection overview"
        ))
        
        # CWV Watchlist
        cwv_html = self._generate_cwv_watchlist_section()
        builder.add_section(Section(
            title="Core Web Vitals Watchlist",
            content=cwv_html,
            status="action_needed" if self.cwv_failing else "watch" if self.cwv_at_risk else "healthy",
            description="Properties failing or at risk of failing Google's Core Web Vitals assessment"
        ))
        
        # Suggested Actions
        actions_html = self._generate_suggested_actions()
        builder.add_section(Section(
            title="Suggested Actions (Prioritized)",
            content=actions_html,
            status="action_needed" if self.cwv_failing else "healthy",
            description="Risk-ranked actions for today"
        ))
        
        # Generate HTML
        html = builder.generate()
        
        # Save report
        output_file = OUTPUT_DIR / f"Portfolio_Health_Daily_{self.date_str}.html"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html)
        
        print(f"\n✅ Daily Portfolio Health Report generated:")
        print(f"   {output_file}")
        print(f"\n📊 Summary:")
        print(f"   Critical Issues: {len(self.cwv_failing)}")
        print(f"   At Risk: {len(self.cwv_at_risk)}")
        print(f"   LCP Severe: {len(self.lcp_severe)}")
        print(f"   LCP Elevated: {len(self.lcp_elevated)}")
        
        return str(output_file)
    
    def __del__(self):
        if hasattr(self, 'conn'):
            self.conn.close()


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate Daily Portfolio Health Report")
    parser.add_argument('--date', help='Report date (YYYY-MM-DD), defaults to today')
    parser.add_argument('--dry-run', action='store_true', help='Preview without generating')
    
    args = parser.parse_args()
    
    # Determine report date
    if args.date:
        report_date = datetime.strptime(args.date, "%Y-%m-%d")
    else:
        report_date = datetime.now()
    
    print("=" * 70)
    print("DAILY PORTFOLIO HEALTH REPORT GENERATOR")
    print("=" * 70)
    print(f"\nReport Date: {report_date.strftime('%Y-%m-%d')}")
    
    if args.dry_run:
        print("\n🔍 DRY RUN MODE - Would generate report\n")
        return 0
    
    # Generate report
    reporter = DailyHealthReport(report_date)
    output_file = reporter.generate()
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
