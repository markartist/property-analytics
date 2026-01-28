#!/usr/bin/env python3
"""
Focus Report Generator v0.1
============================
Generates executive Focus Report for curated property list.

Contract: docs/FOCUS_REPORT_CONTRACT.md v0.1

Usage:
    python3 generate_focus_report.py [--output-dir PATH] [--config PATH]
"""

import sys
import json
import yaml
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple, Optional

# Add parent directory to path for db_helper
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'Portfolio_Monitoring'))
from src.db.db_helper import connect_db


class FocusReportGenerator:
    """Generates Focus Report from canonical database"""
    
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path or str(Path(__file__).parent.parent / 'config' / 'focus_properties.yml')
        self.today = datetime.now().date()
        self.conn = None
        
        # Load Focus properties
        self.focus_properties = self._load_focus_properties()
        
        # Load property registry for ID mapping
        self.property_registry = self._load_property_registry()
        
        # Calculate date windows (WoW comparison)
        self.current_week_end = self.today - timedelta(days=1)  # GA4: 1-day lag
        self.current_week_start = self.current_week_end - timedelta(days=6)
        self.prior_week_end = self.current_week_start - timedelta(days=1)
        self.prior_week_start = self.prior_week_end - timedelta(days=6)
        
        # GSC has 3-day lag
        self.gsc_current_week_end = self.today - timedelta(days=3)
        self.gsc_current_week_start = self.gsc_current_week_end - timedelta(days=6)
        self.gsc_prior_week_end = self.gsc_current_week_start - timedelta(days=1)
        self.gsc_prior_week_start = self.gsc_prior_week_end - timedelta(days=6)
    
    def _load_focus_properties(self) -> List[str]:
        """Load Focus properties from YAML config"""
        with open(self.config_path, 'r') as f:
            config = yaml.safe_load(f)
        return config['focus_properties']
    
    def _load_property_registry(self) -> Dict:
        """Load property registry for ID mapping"""
        registry_path = Path(__file__).parent.parent.parent / 'config' / 'venterra_properties_official.json'
        with open(registry_path, 'r') as f:
            data = json.load(f)
        
        # Build lookup by name
        registry = {}
        for prop in data['properties']:
            name = prop['name']
            registry[name] = {
                'ga4_property_id': prop.get('ga4_property_id'),
                'gsc_url': prop.get('gsc_url', '')  # Keep trailing slash for DB lookup
            }
        return registry
    
    def _get_sessions_data(self, property_name: str) -> Tuple[float, float, float]:
        """Get current and prior week sessions for a property"""
        ga4_id = self.property_registry.get(property_name, {}).get('ga4_property_id')
        if not ga4_id:
            return 0.0, 0.0, 0.0
        
        # Current week
        cursor = self.conn.execute("""
            SELECT SUM(sessions) as total
            FROM ga4_daily_metrics
            WHERE property_id = ?
              AND metric_date BETWEEN ? AND ?
        """, (ga4_id, self.current_week_start.isoformat(), self.current_week_end.isoformat()))
        current = cursor.fetchone()[0] or 0.0
        
        # Prior week
        cursor = self.conn.execute("""
            SELECT SUM(sessions) as total
            FROM ga4_daily_metrics
            WHERE property_id = ?
              AND metric_date BETWEEN ? AND ?
        """, (ga4_id, self.prior_week_start.isoformat(), self.prior_week_end.isoformat()))
        prior = cursor.fetchone()[0] or 0.0
        
        # Calculate WoW %
        wow_pct = ((current - prior) / prior * 100) if prior > 0 else 0.0
        
        return current, prior, wow_pct
    
    def _get_gsc_data(self, property_name: str) -> Dict:
        """Get GSC metrics (clicks, CTR, position) for a property"""
        gsc_url = self.property_registry.get(property_name, {}).get('gsc_url')
        if not gsc_url:
            return {
                'clicks_current': 0.0, 'clicks_prior': 0.0, 'clicks_wow_pct': 0.0,
                'ctr_current': 0.0, 'ctr_prior': 0.0, 'ctr_wow_delta': 0.0,
                'position_current': 0.0, 'position_prior': 0.0, 'position_wow_delta': 0.0,
                'impressions_current': 0.0, 'impressions_prior': 0.0
            }
        
        # Current week
        cursor = self.conn.execute("""
            SELECT 
                SUM(clicks) as total_clicks,
                SUM(impressions) as total_impressions,
                AVG(ctr) as avg_ctr,
                AVG(average_position) as avg_position
            FROM gsc_daily_metrics
            WHERE property_id = ?
              AND metric_date BETWEEN ? AND ?
        """, (gsc_url, self.gsc_current_week_start.isoformat(), self.gsc_current_week_end.isoformat()))
        current = cursor.fetchone()
        clicks_current = current[0] or 0.0
        impressions_current = current[1] or 0.0
        ctr_current = current[2] or 0.0
        position_current = current[3] or 0.0
        
        # Prior week
        cursor = self.conn.execute("""
            SELECT 
                SUM(clicks) as total_clicks,
                SUM(impressions) as total_impressions,
                AVG(ctr) as avg_ctr,
                AVG(average_position) as avg_position
            FROM gsc_daily_metrics
            WHERE property_id = ?
              AND metric_date BETWEEN ? AND ?
        """, (gsc_url, self.gsc_prior_week_start.isoformat(), self.gsc_prior_week_end.isoformat()))
        prior = cursor.fetchone()
        clicks_prior = prior[0] or 0.0
        impressions_prior = prior[1] or 0.0
        ctr_prior = prior[2] or 0.0
        position_prior = prior[3] or 0.0
        
        # Calculate deltas
        clicks_wow_pct = ((clicks_current - clicks_prior) / clicks_prior * 100) if clicks_prior > 0 else 0.0
        ctr_wow_delta = ctr_current - ctr_prior  # Absolute change in percentage points
        position_wow_delta = position_current - position_prior  # Negative = improvement
        
        return {
            'clicks_current': clicks_current,
            'clicks_prior': clicks_prior,
            'clicks_wow_pct': clicks_wow_pct,
            'ctr_current': ctr_current,
            'ctr_prior': ctr_prior,
            'ctr_wow_delta': ctr_wow_delta,
            'position_current': position_current,
            'position_prior': position_prior,
            'position_wow_delta': position_wow_delta,
            'impressions_current': impressions_current,
            'impressions_prior': impressions_prior
        }
    
    def _determine_status(self, sessions_wow_pct: float, sessions_current: float,
                         clicks_wow_pct: float, clicks_current: float,
                         ctr_wow_delta: float, position_wow_delta: float) -> Tuple[str, str]:
        """
        Determine property status (red/yellow/green) based on contract rules
        
        Returns: (status, trigger_rule)
        """
        # Red triggers (priority 1)
        if sessions_wow_pct <= -15 and sessions_current < 100:
            return 'red', 'Sessions declined ≥15% WoW AND <100 absolute'
        if clicks_wow_pct <= -20:
            return 'red', 'Organic Clicks declined ≥20% WoW'
        if ctr_wow_delta <= -1.0 and clicks_current > 50:
            return 'red', 'CTR declined ≥1.0pp WoW AND clicks >50'
        if position_wow_delta >= 3.0:
            return 'red', 'Position worsened ≥3.0 positions WoW'
        
        # Yellow triggers (priority 2)
        if -15 < sessions_wow_pct <= -10:
            return 'yellow', 'Sessions declined 10-14.9% WoW'
        if -20 < clicks_wow_pct <= -10:
            return 'yellow', 'Organic Clicks declined 10-19.9% WoW'
        if -1.0 < ctr_wow_delta <= -0.5:
            return 'yellow', 'CTR declined 0.5-0.99pp WoW'
        if 1.5 <= position_wow_delta < 3.0:
            return 'yellow', 'Position worsened 1.5-2.9 positions WoW'
        
        # Mixed signals (yellow)
        if (sessions_wow_pct >= 15 and clicks_wow_pct <= -10) or \
           (clicks_wow_pct >= 15 and sessions_wow_pct <= -10):
            return 'yellow', 'Mixed signals: one metric +15%, another -10%'
        
        # Green (default)
        return 'green', 'No red or yellow triggers'
    
    def _generate_insight_line(self, property_name: str, sessions_wow_pct: float,
                               clicks_wow_pct: float, ctr_wow_delta: float,
                               position_wow_delta: float) -> Tuple[str, str]:
        """
        Generate deterministic insight line based on contract rules
        
        Returns: (insight_text, source)
        """
        # Priority 1: Acceleration (would need historical data for consecutive weeks)
        # For now, check single-week threshold
        if (sessions_wow_pct >= 20 or clicks_wow_pct >= 20):
            return "Strong growth momentum this week", "template:acceleration"
        
        # Priority 2: Divergence
        if (sessions_wow_pct >= 10 and clicks_wow_pct <= -10):
            return "Traffic divergence: sessions up, clicks down", "template:divergence"
        if (clicks_wow_pct >= 10 and sessions_wow_pct <= -10):
            return "Traffic divergence: clicks up, sessions down", "template:divergence"
        
        # Priority 3: Concentration
        if ctr_wow_delta >= 0.5 or position_wow_delta <= -1.5:
            return "Search visibility strengthening (CTR/Position gains)", "template:concentration"
        
        # Priority 4: Stable (default)
        return "Steady performance, no significant changes", "template:stable"
    
    def _determine_watch_flag(self, ctr_wow_delta: float, position_wow_delta: float,
                              impressions_wow_pct: float, sessions_wow_pct: float,
                              clicks_wow_pct: float) -> Optional[Tuple[str, str]]:
        """
        Determine watch flag based on contract triggers
        
        Returns: (flag_name, trigger_condition) or None
        """
        # Priority order for flags
        
        # 1. CTR erosion (would need 2+ week history - simplified for now)
        if ctr_wow_delta <= -0.5:
            return "CTR erosion", "CTR declined ≥0.5pp WoW"
        
        # 2. Ranking slip with volume
        if position_wow_delta >= 1.5 and impressions_wow_pct >= 10:
            return "Ranking slip with volume", "Position worsened ≥1.5 AND impressions +10%"
        
        # 3. Demand softness
        if sessions_wow_pct <= -10 and clicks_wow_pct <= -10:
            return "Demand softness", "Sessions AND Clicks both declined ≥10% WoW"
        
        # 4. Low engagement signal (would need engagement_rate data)
        # Skipping for now as engagement_rate may not be available
        
        return None
    
    def generate_report_payload(self) -> Dict:
        """Generate full JSON payload for Focus Report"""
        
        self.conn = connect_db()
        
        properties_data = []
        
        for prop_name in self.focus_properties:
            # Get metrics
            sessions_current, sessions_prior, sessions_wow_pct = self._get_sessions_data(prop_name)
            gsc = self._get_gsc_data(prop_name)
            
            # Calculate impressions WoW %
            impressions_wow_pct = 0.0
            if gsc['impressions_prior'] > 0:
                impressions_wow_pct = ((gsc['impressions_current'] - gsc['impressions_prior']) / 
                                       gsc['impressions_prior'] * 100)
            
            # Determine status
            status, status_rule = self._determine_status(
                sessions_wow_pct, sessions_current,
                gsc['clicks_wow_pct'], gsc['clicks_current'],
                gsc['ctr_wow_delta'], gsc['position_wow_delta']
            )
            
            # Generate insight
            insight_text, insight_source = self._generate_insight_line(
                prop_name, sessions_wow_pct, gsc['clicks_wow_pct'],
                gsc['ctr_wow_delta'], gsc['position_wow_delta']
            )
            
            # Determine watch flag
            watch_flag = self._determine_watch_flag(
                gsc['ctr_wow_delta'], gsc['position_wow_delta'],
                impressions_wow_pct, sessions_wow_pct, gsc['clicks_wow_pct']
            )
            
            properties_data.append({
                'property_name': prop_name,
                'status': status,
                'status_rule': status_rule,
                'kpis': {
                    'sessions': {
                        'current': sessions_current,
                        'prior': sessions_prior,
                        'wow_pct': sessions_wow_pct
                    },
                    'clicks': {
                        'current': gsc['clicks_current'],
                        'prior': gsc['clicks_prior'],
                        'wow_pct': gsc['clicks_wow_pct']
                    },
                    'ctr': {
                        'current': gsc['ctr_current'],
                        'prior': gsc['ctr_prior'],
                        'wow_delta': gsc['ctr_wow_delta']
                    },
                    'position': {
                        'current': gsc['position_current'],
                        'prior': gsc['position_prior'],
                        'wow_delta': gsc['position_wow_delta']
                    }
                },
                'insight': {
                    'text': insight_text,
                    'source': insight_source
                },
                'watch_flag': {
                    'flag': watch_flag[0] if watch_flag else None,
                    'trigger': watch_flag[1] if watch_flag else None
                }
            })
        
        self.conn.close()
        
        # Sort: Red → Yellow → Green, then alphabetical
        status_order = {'red': 0, 'yellow': 1, 'green': 2}
        properties_data.sort(key=lambda x: (status_order[x['status']], x['property_name']))
        
        return {
            'report_version': '0.1',
            'generated_at': datetime.now().isoformat(),
            'report_date': self.today.isoformat(),
            'data_windows': {
                'ga4': {
                    'current_week_start': self.current_week_start.isoformat(),
                    'current_week_end': self.current_week_end.isoformat(),
                    'prior_week_start': self.prior_week_start.isoformat(),
                    'prior_week_end': self.prior_week_end.isoformat(),
                    'lag_days': 1
                },
                'gsc': {
                    'current_week_start': self.gsc_current_week_start.isoformat(),
                    'current_week_end': self.gsc_current_week_end.isoformat(),
                    'prior_week_start': self.gsc_prior_week_start.isoformat(),
                    'prior_week_end': self.gsc_prior_week_end.isoformat(),
                    'lag_days': 3
                }
            },
            'focus_properties_count': len(self.focus_properties),
            'properties': properties_data
        }
    
    def render_html(self, payload: Dict) -> str:
        """Render Outlook-safe HTML report from payload"""
        
        report_date = datetime.fromisoformat(payload['report_date']).strftime('%B %d, %Y')
        
        # Build property cards
        property_cards = []
        for prop in payload['properties']:
            status_colors = {
                'red': '#dc2626',
                'yellow': '#f59e0b',
                'green': '#16a34a'
            }
            status_icons = {
                'red': '🔴',
                'yellow': '🟡',
                'green': '🟢'
            }
            status_labels = {
                'red': 'Requires Attention',
                'yellow': 'Monitor',
                'green': 'Performing Well'
            }
            
            status = prop['status']
            status_color = status_colors[status]
            status_icon = status_icons[status]
            status_label = status_labels[status]
            
            kpis = prop['kpis']
            
            # Format KPIs with color coding
            def format_kpi(value, delta, is_percentage=True, higher_is_better=True):
                """Format KPI with color based on performance"""
                if is_percentage:
                    threshold = 2.0
                    delta_str = f"{delta:+.1f}%"
                else:
                    threshold = 0.2
                    delta_str = f"{delta:+.1f}"
                
                if abs(delta) < threshold:
                    color = '#6c757d'  # Gray for neutral
                elif (higher_is_better and delta > 0) or (not higher_is_better and delta < 0):
                    color = '#16a34a'  # Green for good
                else:
                    color = '#dc2626'  # Red for bad
                
                return f'<span style="color: {color};">({delta_str})</span>'
            
            sessions_html = f"{int(kpis['sessions']['current']):,} sessions {format_kpi(kpis['sessions']['current'], kpis['sessions']['wow_pct'], True, True)}"
            clicks_html = f"{int(kpis['clicks']['current']):,} clicks {format_kpi(kpis['clicks']['current'], kpis['clicks']['wow_pct'], True, True)}"
            ctr_html = f"{kpis['ctr']['current']:.1f}% CTR {format_kpi(kpis['ctr']['current'], kpis['ctr']['wow_delta'], False, True)}"
            
            # Position: lower is better (negative delta = improvement)
            position_delta_display = kpis['position']['wow_delta']
            if abs(position_delta_display) < 0.2:
                position_color = '#6c757d'
            elif position_delta_display < 0:
                position_color = '#16a34a'  # Improved
            else:
                position_color = '#dc2626'  # Worsened
            position_html = f"Pos {kpis['position']['current']:.1f} <span style=\"color: {position_color};\">{position_delta_display:+.1f}</span>"
            
            # Watch flag
            watch_flag_html = ''
            if prop['watch_flag']['flag']:
                watch_flag_html = f'<div style="font-size: 9px; color: #9ca3af; margin-top: 6px;">⚠️ Watch: {prop["watch_flag"]["flag"]}</div>'
            
            card = f"""
            <div style="background: #ffffff; border-left: 4px solid {status_color}; padding: 16px; margin-bottom: 12px; border-radius: 4px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #212529;">{prop['property_name']}</h3>
                    <span style="font-size: 11px; color: {status_color}; font-weight: 600;">{status_icon} {status_label}</span>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; font-size: 11px; color: #495057;">
                    <div>{sessions_html}</div>
                    <div>{clicks_html}</div>
                    <div>{ctr_html}</div>
                    <div>{position_html}</div>
                </div>
                
                <div style="font-size: 11px; color: #212529; font-style: italic; border-top: 1px solid #e9ecef; padding-top: 8px;">
                    💡 {prop['insight']['text']}
                </div>
                {watch_flag_html}
            </div>
            """
            property_cards.append(card)
        
        property_cards_html = '\n'.join(property_cards)
        
        # Build full HTML
        html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Focus Report - {report_date}</title>
    <style>
        @media (prefers-color-scheme: dark) {{
            .email-body {{ background-color: #1a1a1a !important; }}
            .email-container {{ background-color: #2d2d2d !important; }}
        }}
    </style>
</head>
<body class="email-body" style="margin: 0; padding: 16px; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
    
    <div class="email-container" style="max-width: 800px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #000000;">🎯 Venterra Living</h1>
            <h2 style="margin: 6px 0 0 0; font-size: 18px; font-weight: 500; color: #000000;">Focus Report</h2>
            <p style="margin: 6px 0 0 0; font-size: 12px; color: #000000;">{report_date}</p>
            <p style="margin: 3px 0 0 0; font-size: 10px; color: #000000;">Week-over-Week Performance</p>
        </div>
        
        <!-- Property Cards -->
        <div style="padding: 20px;">
            {property_cards_html}
        </div>
        
        <!-- Footer -->
        <div style="padding: 16px; background-color: #f8f9fa; text-align: center; border-top: 1px solid #e9ecef;">
            <p style="margin: 0; font-size: 9px; color: #6c757d;">
                Focus Report v0.1 • Venterra Living<br>
                {payload['focus_properties_count']} Focus Properties<br>
                C/O WebOps - Mark Laufhutte
            </p>
        </div>
        
    </div>
    
</body>
</html>"""
        
        return html
    
    def save_report(self, payload: Dict, html: str, output_dir: Optional[str] = None):
        """Save JSON payload and HTML to dated folder"""
        if not output_dir:
            output_dir = Path(__file__).parent.parent / 'reports' / 'focus_report'
        else:
            output_dir = Path(output_dir)
        
        # Create dated folder
        report_date = datetime.fromisoformat(payload['report_date']).strftime('%Y-%m-%d')
        dated_dir = output_dir / report_date
        dated_dir.mkdir(parents=True, exist_ok=True)
        
        # Write JSON
        json_path = dated_dir / 'focus_report.json'
        with open(json_path, 'w') as f:
            json.dump(payload, f, indent=2)
        
        # Write HTML
        html_path = dated_dir / 'focus_report.html'
        with open(html_path, 'w') as f:
            f.write(html)
        
        print(f"✅ Focus Report generated successfully!")
        print(f"   JSON: {json_path}")
        print(f"   HTML: {html_path}")
        
        return str(html_path), str(json_path)


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate Focus Report')
    parser.add_argument('--output-dir', help='Output directory for reports')
    parser.add_argument('--config', help='Path to focus_properties.yml')
    args = parser.parse_args()
    
    generator = FocusReportGenerator(config_path=args.config)
    payload = generator.generate_report_payload()
    html = generator.render_html(payload)
    generator.save_report(payload, html, output_dir=args.output_dir)


if __name__ == '__main__':
    main()
