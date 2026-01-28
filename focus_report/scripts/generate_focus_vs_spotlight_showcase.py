#!/usr/bin/env python3
"""
Focus vs Spotlight Comparative Showcase
========================================
One-off executive showcase with Core Web Vitals integration.

Usage:
    python3 generate_focus_vs_spotlight_showcase.py [--pagespeed-api-key KEY]
"""

import sys
import json
import os
import time
import requests
import base64
import io
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from statistics import median
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# Add parent directory to path for master database helper
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from utils.master_db import get_master_db_connection


class FocusVsSpotlightShowcase:
    """Generates comparative showcase with CWV integration"""
    
    # Cohort definitions (authoritative)
    FOCUS_COHORT = [
        "Botanic",
        "Camber Ridge",
        "CoHo",
        "Oakleaf",
        "Spring Branch",
        "Stonecreek",
        "Thomas Glen"
    ]
    
    SPOTLIGHT_COHORT = [
        "Avasa at 1604",
        "Anatole Daytona",
        "Apex",
        "Belterra",
        "Calais Midtown",
        "Cane Island",
        "Canton Mill Lofts",
        "Elation",
        "Fairways",
        "Grand Harbor",
        "Grove West",
        "Luma Headwaters",
        "Mayfield",
        "Northbridge",
        "Townhomes",
        "Trevesta"
    ]
    
    # CWV thresholds (standard)
    CWV_THRESHOLDS = {
        'lcp': {'good': 2500, 'ni': 4000},      # ms
        'inp': {'good': 200, 'ni': 500},         # ms
        'cls': {'good': 0.1, 'ni': 0.25}         # ratio
    }
    
    def __init__(self, pagespeed_api_key: Optional[str] = None):
        self.today = datetime.now().date()
        self.conn = None
        
        # PageSpeed API setup
        self.pagespeed_api_key = pagespeed_api_key or os.getenv('PAGESPEED_API_KEY')
        self.cwv_cache = {}  # Simple in-memory cache for this run
        
        # Load property registry
        self.property_registry = self._load_property_registry()
        
        # Resolve cohorts
        self.focus_resolved, self.focus_failed = self._resolve_cohort(self.FOCUS_COHORT, "Focus")
        self.spotlight_resolved, self.spotlight_failed = self._resolve_cohort(self.SPOTLIGHT_COHORT, "Spotlight")
        
        # Calculate date windows (same as Focus Report)
        self.current_week_end = self.today - timedelta(days=1)  # GA4: 1-day lag
        self.current_week_start = self.current_week_end - timedelta(days=6)
        self.prior_week_end = self.current_week_start - timedelta(days=1)
        self.prior_week_start = self.prior_week_end - timedelta(days=6)
        
        # GSC has 3-day lag
        self.gsc_current_week_end = self.today - timedelta(days=3)
        self.gsc_current_week_start = self.gsc_current_week_end - timedelta(days=6)
        self.gsc_prior_week_end = self.gsc_current_week_start - timedelta(days=1)
        self.gsc_prior_week_start = self.gsc_prior_week_end - timedelta(days=6)
    
    def _load_property_registry(self) -> Dict:
        """Load property registry for ID mapping"""
        registry_path = Path(__file__).parent.parent.parent / 'config' / 'venterra_properties_official.json'
        with open(registry_path, 'r') as f:
            data = json.load(f)
        
        # Build lookup by name (exact match only)
        registry = {}
        for prop in data['properties']:
            name = prop['name']
            registry[name] = {
                'ga4_property_id': prop.get('ga4_property_id'),
                'gsc_url': prop.get('gsc_url', ''),
                'full_url': prop.get('full_url', '')
            }
        return registry
    
    def _resolve_cohort(self, cohort_names: List[str], cohort_label: str) -> Tuple[List[str], List[Tuple[str, str]]]:
        """
        Resolve cohort property names to canonical registry names
        
        Returns: (resolved_names, failed_resolutions)
        """
        resolved = []
        failed = []
        
        name_mapping = {
            # Focus cohort mappings
            "Botanic": "Botanic Luxury",
            "Oakleaf": "The Villages at Oakleaf",
            "Spring Branch": "Avasa Spring Branch",
            "Stonecreek": "Stonecreek Ranch",
            "Thomas Glen": "The Reserves of Thomas Glen",
            # Spotlight cohort mappings
            "Anatole Daytona": "The Anatole",  # Using The Anatole as primary
            "Apex": "Apex West Midtown",
            "Elation": "Elation at Grandway West",
            "Fairways": "Fairways at South Shore",
            "Grand Harbor": "The Cape at Grand Harbor",
            "Grove West": "Avasa Grove West",
            "Mayfield": "Mission Mayfield Downs",
            "Northbridge": "Northbridge at Millenia Lake",
            "Townhomes": "Townhomes at Lake Park",
            "Trevesta": "Trevesta Place"
        }
        
        for name in cohort_names:
            # Try exact match first
            if name in self.property_registry:
                resolved.append(name)
            # Try mapping
            elif name in name_mapping and name_mapping[name] in self.property_registry:
                resolved.append(name_mapping[name])
            else:
                failed.append((name, f"No registry match for '{name}'"))
        
        return resolved, failed
    
    def _get_property_kpis(self, property_name: str) -> Dict:
        """Get KPIs for a single property (sessions, clicks, CTR, position, device mix, traffic sources)"""
        ga4_id = self.property_registry.get(property_name, {}).get('ga4_property_id')
        gsc_url = self.property_registry.get(property_name, {}).get('gsc_url')
        
        result = {
            'sessions_current': 0, 'sessions_prior': 0, 'sessions_wow_pct': 0,
            'clicks_current': 0, 'clicks_prior': 0, 'clicks_wow_pct': 0,
            'ctr_current': 0, 'ctr_prior': 0, 'ctr_wow_delta': 0,
            'position_current': 0, 'position_prior': 0, 'position_wow_delta': 0,
            'mobile_pct': 0, 'engagement_rate': 0, 'top_channel': 'Unknown', 'top_channel_pct': 0,
            'sessions_sparkline': []
        }
        
        # Get GA4 sessions
        if ga4_id:
            cursor = self.conn.execute("""
                SELECT SUM(sessions) FROM ga4_daily_metrics
                WHERE property_id = ? AND metric_date BETWEEN ? AND ?
            """, (ga4_id, self.current_week_start.isoformat(), self.current_week_end.isoformat()))
            sessions_current = cursor.fetchone()[0] or 0
            
            cursor = self.conn.execute("""
                SELECT SUM(sessions) FROM ga4_daily_metrics
                WHERE property_id = ? AND metric_date BETWEEN ? AND ?
            """, (ga4_id, self.prior_week_start.isoformat(), self.prior_week_end.isoformat()))
            sessions_prior = cursor.fetchone()[0] or 0
            
            result['sessions_current'] = sessions_current
            result['sessions_prior'] = sessions_prior
            if sessions_prior > 0:
                result['sessions_wow_pct'] = ((sessions_current - sessions_prior) / sessions_prior * 100)
        
        # Get GSC metrics
        if gsc_url:
            cursor = self.conn.execute("""
                SELECT SUM(clicks), AVG(ctr), AVG(average_position)
                FROM gsc_daily_metrics
                WHERE property_id = ? AND metric_date BETWEEN ? AND ?
            """, (gsc_url, self.gsc_current_week_start.isoformat(), self.gsc_current_week_end.isoformat()))
            current = cursor.fetchone()
            
            cursor = self.conn.execute("""
                SELECT SUM(clicks), AVG(ctr), AVG(average_position)
                FROM gsc_daily_metrics
                WHERE property_id = ? AND metric_date BETWEEN ? AND ?
            """, (gsc_url, self.gsc_prior_week_start.isoformat(), self.gsc_prior_week_end.isoformat()))
            prior = cursor.fetchone()
            
            clicks_current = current[0] or 0
            ctr_current = current[1] or 0
            position_current = current[2] or 0
            
            clicks_prior = prior[0] or 0
            ctr_prior = prior[1] or 0
            position_prior = prior[2] or 0
            
            result['clicks_current'] = clicks_current
            result['clicks_prior'] = clicks_prior
            if clicks_prior > 0:
                result['clicks_wow_pct'] = ((clicks_current - clicks_prior) / clicks_prior * 100)
            
            result['ctr_current'] = ctr_current
            result['ctr_prior'] = ctr_prior
            result['ctr_wow_delta'] = ctr_current - ctr_prior
            
            result['position_current'] = position_current
            result['position_prior'] = position_prior
            result['position_wow_delta'] = position_current - position_prior
        
        # Get device breakdown (current week)
        if ga4_id:
            cursor = self.conn.execute("""
                SELECT device_category, SUM(sessions) as sessions, AVG(engagement_rate) as eng_rate
                FROM ga4_device_metrics
                WHERE property_id = ? AND metric_date BETWEEN ? AND ?
                GROUP BY device_category
            """, (ga4_id, self.current_week_start.isoformat(), self.current_week_end.isoformat()))
            
            device_data = cursor.fetchall()
            total_sessions = sum(row[1] for row in device_data)
            mobile_sessions = sum(row[1] for row in device_data if row[0] == 'mobile')
            avg_engagement = sum(row[1] * row[2] for row in device_data if row[2]) / total_sessions if total_sessions > 0 else 0
            
            result['mobile_pct'] = (mobile_sessions / total_sessions * 100) if total_sessions > 0 else 0
            result['engagement_rate'] = avg_engagement
        
        # Get top traffic channel (current week)
        if ga4_id:
            cursor = self.conn.execute("""
                SELECT channel_group, SUM(sessions) as sessions
                FROM ga4_traffic_sources
                WHERE property_id = ? AND metric_date BETWEEN ? AND ?
                GROUP BY channel_group
                ORDER BY sessions DESC
                LIMIT 1
            """, (ga4_id, self.current_week_start.isoformat(), self.current_week_end.isoformat()))
            
            top_channel = cursor.fetchone()
            if top_channel:
                channel_sessions = top_channel[1]
                result['top_channel'] = top_channel[0]
                result['top_channel_pct'] = (channel_sessions / result['sessions_current'] * 100) if result['sessions_current'] > 0 else 0
        
        # Get 7-day sessions sparkline (current week)
        if ga4_id:
            cursor = self.conn.execute("""
                SELECT metric_date, sessions
                FROM ga4_daily_metrics
                WHERE property_id = ? AND metric_date BETWEEN ? AND ?
                ORDER BY metric_date ASC
            """, (ga4_id, self.current_week_start.isoformat(), self.current_week_end.isoformat()))
            
            sparkline_data = cursor.fetchall()
            result['sessions_sparkline'] = [row[1] for row in sparkline_data]
        
        return result
    
    def _fetch_cwv_data(self, property_name: str) -> Dict:
        """
        Fetch Core Web Vitals from pagespeed_metrics table in database
        
        Returns dict with lcp_p75, inp_p75, cls_p75, or 'unavailable' with reason
        """
        # Check cache
        if property_name in self.cwv_cache:
            return self.cwv_cache[property_name]
        
        # Get property GA4 ID (used as property_id in pagespeed_metrics)
        ga4_id = self.property_registry.get(property_name, {}).get('ga4_property_id')
        
        if not ga4_id:
            result = {'available': False, 'reason': 'No GA4 ID in registry'}
            self.cwv_cache[property_name] = result
            return result
        
        try:
            # Query latest mobile PageSpeed data (mobile is primary for CWV)
            cursor = self.conn.execute("""
                SELECT lcp_value, fid_value, cls_value, performance_score
                FROM pagespeed_metrics
                WHERE property_id = ? AND strategy = 'mobile'
                ORDER BY metric_date DESC
                LIMIT 1
            """, (ga4_id,))
            
            row = cursor.fetchone()
            
            if not row:
                result = {'available': False, 'reason': 'No PageSpeed data in database'}
                self.cwv_cache[property_name] = result
                return result
            
            lcp_value, fid_value, cls_value, perf_score = row
            
            # Convert to p75 format (using available values)
            # Note: DB stores lab data, not CrUX p75, but provides good approximation
            # LCP is in seconds, convert to ms
            lcp_ms = (lcp_value * 1000) if lcp_value else None
            
            # FID is already in ms
            fid_ms = fid_value if fid_value else None
            
            # INP not collected in current schema, use None
            inp_ms = None
            
            result = {
                'available': True,
                'lcp_p75': lcp_ms,
                'fid_p75': fid_ms,
                'inp_p75': inp_ms,  # Not available in current schema
                'cls_p75': cls_value,
                'performance_score': perf_score
            }
            
            self.cwv_cache[property_name] = result
            return result
            
        except Exception as e:
            result = {'available': False, 'reason': f'Database query error: {str(e)}'}
            self.cwv_cache[property_name] = result
            return result
    
    def _classify_cwv_metric(self, value: float, metric_type: str) -> str:
        """Classify CWV metric as Good/NI/Poor"""
        if value is None:
            return 'Unknown'
        
        thresholds = self.CWV_THRESHOLDS[metric_type]
        if value <= thresholds['good']:
            return 'Good'
        elif value <= thresholds['ni']:
            return 'NI'
        else:
            return 'Poor'
    
    def _compute_cwv_status(self, cwv_data: Dict) -> str:
        """Compute overall CWV status (Pass/Review)"""
        if not cwv_data.get('available'):
            return 'N/A'
        
        lcp_class = self._classify_cwv_metric(cwv_data.get('lcp_p75'), 'lcp')
        cls_class = self._classify_cwv_metric(cwv_data.get('cls_p75'), 'cls')
        
        # Only consider available metrics (LCP and CLS)
        # INP not available in current schema
        available_classes = [lcp_class, cls_class]
        valid_classes = [c for c in available_classes if c != 'Unknown']
        
        if not valid_classes:
            return 'N/A'
        
        if all(c == 'Good' for c in valid_classes):
            return 'Pass'
        else:
            return 'Review'
    
    def _determine_status(self, kpis: Dict) -> str:
        """Determine property status (red/yellow/green) based on KPIs
        
        Uses same rules as Focus Report:
        - Red: Critical performance issues
        - Yellow: Warning signs
        - Green: Default (performing well)
        """
        sessions_pct = kpis.get('sessions_wow_pct', 0)
        sessions_current = kpis.get('sessions_current', 0)
        clicks_pct = kpis.get('clicks_wow_pct', 0)
        ctr_delta = kpis.get('ctr_wow_delta', 0)
        clicks_current = kpis.get('clicks_current', 0)
        position_delta = kpis.get('position_wow_delta', 0)
        
        # Red triggers (critical)
        if sessions_pct <= -15 and sessions_current < 100:
            return 'red'
        if clicks_pct <= -20:
            return 'red'
        if ctr_delta <= -1.0 and clicks_current > 50:
            return 'red'
        if position_delta >= 3.0:
            return 'red'
        
        # Yellow triggers (warning)
        if -15 < sessions_pct <= -10:
            return 'yellow'
        if -20 < clicks_pct <= -10:
            return 'yellow'
        if -1.0 < ctr_delta <= -0.5:
            return 'yellow'
        if 1.5 <= position_delta < 3.0:
            return 'yellow'
        
        return 'green'
    
    def _generate_sparkline(self, values: list, delta_pct: float) -> str:
        """Generate matplotlib PNG sparkline (inline base64)"""
        if not values or len(values) < 2:
            return ''
        
        # Determine color based on delta
        min_val = min(values)
        max_val = max(values)
        
        if max_val == min_val:
            color = '#9ca3af'  # Gray for flat
        elif delta_pct > 0:
            color = '#16a34a'  # Green for positive
        else:
            color = '#dc2626'  # Red for negative
        
        # Create matplotlib figure
        fig, ax = plt.subplots(figsize=(0.8, 0.25), dpi=100)  # 80x25 pixels
        fig.patch.set_alpha(0)  # Transparent
        ax.set_axis_off()
        
        # Plot sparkline
        ax.plot(values, color=color, linewidth=1.5)
        ax.set_xlim(0, len(values) - 1)
        
        # Set y-limits with padding
        if max_val > min_val:
            padding = (max_val - min_val) * 0.1
            ax.set_ylim(min_val - padding, max_val + padding)
        
        # Remove margins
        plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
        
        # Save to bytes buffer
        buf = io.BytesIO()
        plt.savefig(buf, format='png', transparent=True, bbox_inches='tight', pad_inches=0)
        plt.close(fig)
        
        # Encode to base64
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        
        return f'<img src="data:image/png;base64,{img_base64}" width="80" height="25" style="display: inline-block; margin-left: 4px; vertical-align: middle;" alt="Trend"/>'
    
    def _render_hotlist_card(self, prop: Dict, status_color: str, status_emoji: str) -> str:
        """Render a single property card in Focus report style with CWV"""
        kpis = prop['kpis']
        cwv = prop['cwv']
        
        # Format KPIs with color coding
        def format_kpi_delta(delta, is_percentage=True, higher_is_better=True):
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
            
            return f'<span style="color: {color};">{delta_str}</span>'
        
        # Generate sparkline for sessions
        sparkline_html = self._generate_sparkline(kpis.get('sessions_sparkline', []), kpis['sessions_wow_pct'])
        
        sessions_html = f"{int(kpis['sessions_current']):,} sessions {format_kpi_delta(kpis['sessions_wow_pct'], True, True)} {sparkline_html}"
        clicks_html = f"{int(kpis['clicks_current']):,} clicks {format_kpi_delta(kpis['clicks_wow_pct'], True, True)}"
        ctr_html = f"{kpis['ctr_current']:.1f}% CTR {format_kpi_delta(kpis['ctr_wow_delta'], False, True)}"
        
        # Position: lower is better
        position_delta = kpis['position_wow_delta']
        position_html = f"Pos {kpis['position_current']:.1f} {format_kpi_delta(position_delta, False, False)}"
        
        # CWV block - show all three Core Web Vitals
        if cwv.get('available'):
            lcp_class = self._classify_cwv_metric(cwv.get('lcp_p75'), 'lcp')
            fid_class = self._classify_cwv_metric(cwv.get('fid_p75'), 'inp')  # Use INP thresholds for FID
            cls_class = self._classify_cwv_metric(cwv.get('cls_p75'), 'cls')
            
            cwv_colors = {'Good': '#16a34a', 'NI': '#f59e0b', 'Poor': '#dc2626', 'Unknown': '#6c757d'}
            
            metrics_html = []
            if cwv.get('lcp_p75'):
                metrics_html.append(f'LCP: <span style="color: {cwv_colors[lcp_class]};">{cwv["lcp_p75"]:.0f}ms</span>')
            if cwv.get('fid_p75'):
                metrics_html.append(f'FID: <span style="color: {cwv_colors[fid_class]};">{cwv["fid_p75"]:.0f}ms</span>')
            if cwv.get('cls_p75') is not None:
                metrics_html.append(f'CLS: <span style="color: {cwv_colors[cls_class]};">{cwv["cls_p75"]:.3f}</span>')
            
            cwv_html = f'<div style="font-size: 10px; color: #6c757d; margin-top: 6px;">⚡ {" • ".join(metrics_html)}</div>'
        else:
            cwv_html = ''
        
        # Cohort badge
        cohort_color = '#667eea' if prop['cohort'] == 'Focus' else '#f59e0b'
        cohort_badge = f'<span style="background: {cohort_color}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: 600;">{prop["cohort"]}</span>'
        
        # Additional insights: Mobile %, Engagement, Top Channel
        mobile_pct = kpis.get('mobile_pct', 0)
        engagement_rate = kpis.get('engagement_rate', 0)
        top_channel = kpis.get('top_channel', 'Unknown')
        top_channel_pct = kpis.get('top_channel_pct', 0)
        
        # Mobile % visual bar
        mobile_bar_width = min(100, max(0, mobile_pct))
        mobile_color = '#667eea' if mobile_pct > 50 else '#6c757d'
        mobile_html = f'''
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #f0f0f0;">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 10px; margin-bottom: 4px;">
                <span style="color: #6c757d;">📱 Mobile:</span>
                <div style="flex: 1; background: #f0f0f0; height: 6px; border-radius: 3px; overflow: hidden;">
                    <div style="background: {mobile_color}; width: {mobile_bar_width}%; height: 100%;"></div>
                </div>
                <span style="font-weight: 600; color: {mobile_color};">{mobile_pct:.0f}%</span>
            </div>
        </div>
        '''
        
        # Engagement rate with color coding
        if engagement_rate >= 0.6:
            eng_color = '#16a34a'
            eng_icon = '💚'
        elif engagement_rate >= 0.4:
            eng_color = '#f59e0b'
            eng_icon = '💛'
        else:
            eng_color = '#dc2626'
            eng_icon = '🔴'
        
        # Top channel with icon
        channel_icons = {
            'Organic Search': '🔍',
            'Paid Search': '💰',
            'Direct': '🔗',
            'Referral': '↗️',
            'Organic Social': '👥',
            'Paid Social': '📱',
            'Email': '📧',
            'Display': '🖼️'
        }
        channel_icon = channel_icons.get(top_channel, '📊')
        
        insights_html = f'''
        <div style="display: flex; gap: 12px; margin-top: 6px; font-size: 10px; color: #6c757d;">
            <div><span style="color: {eng_color};">{eng_icon} {engagement_rate*100:.0f}%</span> engaged</div>
            <div>{channel_icon} <span style="font-weight: 600;">{top_channel}</span> {top_channel_pct:.0f}%</div>
        </div>
        '''
        
        return f"""
        <div style="background: #ffffff; border-left: 4px solid {status_color}; padding: 14px; margin-bottom: 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <h4 style="margin: 0; font-size: 13px; font-weight: 600; color: #212529;">{prop['property_name']}</h4>
                {cohort_badge}
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 4px; font-size: 11px; color: #495057;">
                <div>{sessions_html}</div>
                <div>{clicks_html}</div>
                <div>{ctr_html}</div>
                <div>{position_html}</div>
            </div>
            {cwv_html}
            {mobile_html}
            {insights_html}
        </div>
        """
    
    def generate_showcase_payload(self) -> Dict:
        """Generate complete showcase payload"""
        
        self.conn = get_master_db_connection()
        
        # Collect KPIs for all properties
        focus_kpis = []
        spotlight_kpis = []
        
        focus_properties_data = []
        spotlight_properties_data = []
        
        print(f"\nCollecting data for {len(self.focus_resolved)} Focus properties...")
        for prop_name in self.focus_resolved:
            kpis = self._get_property_kpis(prop_name)
            # Only include if has valid data (volume gate)
            if kpis['sessions_current'] > 0:
                focus_kpis.append(kpis)
            
            cwv_data = self._fetch_cwv_data(prop_name)
            cwv_status = self._compute_cwv_status(cwv_data)
            
            focus_properties_data.append({
                'property_name': prop_name,
                'kpis': kpis,
                'cwv': cwv_data,
                'cwv_status': cwv_status
            })
        
        print(f"\nCollecting data for {len(self.spotlight_resolved)} Spotlight properties...")
        for prop_name in self.spotlight_resolved:
            kpis = self._get_property_kpis(prop_name)
            if kpis['sessions_current'] > 0:
                spotlight_kpis.append(kpis)
            
            cwv_data = self._fetch_cwv_data(prop_name)
            cwv_status = self._compute_cwv_status(cwv_data)
            
            spotlight_properties_data.append({
                'property_name': prop_name,
                'kpis': kpis,
                'cwv': cwv_data,
                'cwv_status': cwv_status
            })
        
        self.conn.close()
        
        # Calculate median KPIs per cohort
        focus_medians = self._calculate_cohort_medians(focus_kpis, focus_properties_data)
        spotlight_medians = self._calculate_cohort_medians(spotlight_kpis, spotlight_properties_data)
        
        # Generate comparative signals
        comparative_signals = self._generate_comparative_signals(focus_medians, spotlight_medians)
        
        # Generate narrative
        narrative = self._generate_executive_narrative(focus_medians, spotlight_medians, comparative_signals)
        
        return {
            'showcase_version': '1.0',
            'generated_at': datetime.now().isoformat(),
            'report_date': self.today.isoformat(),
            'cohorts': {
                'focus': {
                    'requested': self.FOCUS_COHORT,
                    'resolved': self.focus_resolved,
                    'failed': self.focus_failed,
                    'count': len(self.focus_resolved)
                },
                'spotlight': {
                    'requested': self.SPOTLIGHT_COHORT,
                    'resolved': self.spotlight_resolved,
                    'failed': self.spotlight_failed,
                    'count': len(self.spotlight_resolved)
                }
            },
            'scorecard': {
                'focus_medians': focus_medians,
                'spotlight_medians': spotlight_medians,
                'comparative_signals': comparative_signals
            },
            'narrative': narrative,
            'properties': {
                'focus': focus_properties_data,
                'spotlight': spotlight_properties_data
            },
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
            }
        }
    
    def _calculate_cohort_medians(self, kpis_list: List[Dict], properties_data: List[Dict]) -> Dict:
        """Calculate median KPIs and CWV for a cohort"""
        medians = {}
        
        # KPI medians (only properties with valid data)
        if kpis_list:
            medians['sessions_wow_pct'] = median([k['sessions_wow_pct'] for k in kpis_list])
            medians['clicks_wow_pct'] = median([k['clicks_wow_pct'] for k in kpis_list if k['clicks_current'] > 0])
            medians['ctr_wow_delta'] = median([k['ctr_wow_delta'] for k in kpis_list if k['ctr_current'] > 0])
            medians['position_wow_delta'] = median([k['position_wow_delta'] for k in kpis_list if k['position_current'] > 0])
        else:
            medians['sessions_wow_pct'] = 0
            medians['clicks_wow_pct'] = 0
            medians['ctr_wow_delta'] = 0
            medians['position_wow_delta'] = 0
        
        # CWV medians (only properties with valid CWV)
        cwv_lcp = [p['cwv']['lcp_p75'] for p in properties_data if p['cwv'].get('available') and p['cwv'].get('lcp_p75') is not None]
        cwv_inp = [p['cwv']['inp_p75'] for p in properties_data if p['cwv'].get('available') and p['cwv'].get('inp_p75') is not None]
        cwv_cls = [p['cwv']['cls_p75'] for p in properties_data if p['cwv'].get('available') and p['cwv'].get('cls_p75') is not None]
        
        medians['lcp_p75'] = median(cwv_lcp) if cwv_lcp else None
        medians['inp_p75'] = median(cwv_inp) if cwv_inp else None
        medians['cls_p75'] = median(cwv_cls) if cwv_cls else None
        
        return medians
    
    def _generate_comparative_signals(self, focus: Dict, spotlight: Dict) -> Dict:
        """Generate deterministic comparative signals"""
        signals = {}
        
        # Sessions
        if abs(focus['sessions_wow_pct'] - spotlight['sessions_wow_pct']) < 2:
            signals['sessions'] = 'Comparable'
        elif focus['sessions_wow_pct'] > spotlight['sessions_wow_pct']:
            signals['sessions'] = 'Focus stronger'
        else:
            signals['sessions'] = 'Spotlight stronger'
        
        # Clicks
        if abs(focus['clicks_wow_pct'] - spotlight['clicks_wow_pct']) < 2:
            signals['clicks'] = 'Comparable'
        elif focus['clicks_wow_pct'] > spotlight['clicks_wow_pct']:
            signals['clicks'] = 'Focus stronger'
        else:
            signals['clicks'] = 'Spotlight stronger'
        
        # CTR (positive delta = improvement)
        if abs(focus['ctr_wow_delta'] - spotlight['ctr_wow_delta']) < 0.2:
            signals['ctr'] = 'Comparable'
        elif focus['ctr_wow_delta'] > spotlight['ctr_wow_delta']:
            signals['ctr'] = 'Focus stronger'
        else:
            signals['ctr'] = 'Spotlight stronger'
        
        # Position (negative delta = improvement)
        if abs(focus['position_wow_delta'] - spotlight['position_wow_delta']) < 0.5:
            signals['position'] = 'Comparable'
        elif focus['position_wow_delta'] < spotlight['position_wow_delta']:
            signals['position'] = 'Focus stronger'
        else:
            signals['position'] = 'Spotlight stronger'
        
        # CWV (lower is better for LCP/INP, CLS)
        if focus['lcp_p75'] and spotlight['lcp_p75']:
            if abs(focus['lcp_p75'] - spotlight['lcp_p75']) < 200:
                signals['lcp'] = 'Comparable'
            elif focus['lcp_p75'] < spotlight['lcp_p75']:
                signals['lcp'] = 'Focus stronger'
            else:
                signals['lcp'] = 'Spotlight stronger'
        else:
            signals['lcp'] = 'Insufficient data'
        
        if focus['inp_p75'] and spotlight['inp_p75']:
            if abs(focus['inp_p75'] - spotlight['inp_p75']) < 50:
                signals['inp'] = 'Comparable'
            elif focus['inp_p75'] < spotlight['inp_p75']:
                signals['inp'] = 'Focus stronger'
            else:
                signals['inp'] = 'Spotlight stronger'
        else:
            signals['inp'] = 'Insufficient data'
        
        if focus['cls_p75'] and spotlight['cls_p75']:
            if abs(focus['cls_p75'] - spotlight['cls_p75']) < 0.02:
                signals['cls'] = 'Comparable'
            elif focus['cls_p75'] < spotlight['cls_p75']:
                signals['cls'] = 'Focus stronger'
            else:
                signals['cls'] = 'Spotlight stronger'
        else:
            signals['cls'] = 'Insufficient data'
        
        return signals
    
    def _generate_executive_narrative(self, focus: Dict, spotlight: Dict, signals: Dict) -> str:
        """Generate deterministic 2-3 sentence narrative"""
        sentences = []
        
        # Sentence 1: Demand
        if signals['sessions'] == 'Focus stronger' and signals['clicks'] == 'Focus stronger':
            sentences.append(f"Focus properties showed stronger demand momentum, with median session growth of {focus['sessions_wow_pct']:+.1f}% vs Spotlight's {spotlight['sessions_wow_pct']:+.1f}%, and clicks {focus['clicks_wow_pct']:+.1f}% vs {spotlight['clicks_wow_pct']:+.1f}%.")
        elif signals['sessions'] == 'Spotlight stronger' and signals['clicks'] == 'Spotlight stronger':
            sentences.append(f"Spotlight properties exhibited stronger demand, with median session growth of {spotlight['sessions_wow_pct']:+.1f}% vs Focus's {focus['sessions_wow_pct']:+.1f}%, and clicks {spotlight['clicks_wow_pct']:+.1f}% vs {focus['clicks_wow_pct']:+.1f}%.")
        else:
            sentences.append(f"Demand signals diverged: Focus sessions {focus['sessions_wow_pct']:+.1f}%, Spotlight {spotlight['sessions_wow_pct']:+.1f}%; organic clicks followed mixed patterns.")
        
        # Sentence 2: Search efficiency
        if signals['ctr'] == 'Focus stronger' or signals['position'] == 'Focus stronger':
            sentences.append(f"Focus maintained better search positioning with a median CTR shift of {focus['ctr_wow_delta']:+.2f}pp and position change of {focus['position_wow_delta']:+.1f}.")
        elif signals['ctr'] == 'Spotlight stronger' or signals['position'] == 'Spotlight stronger':
            sentences.append(f"Spotlight demonstrated superior search efficiency, with CTR movement of {spotlight['ctr_wow_delta']:+.2f}pp and position trending {spotlight['position_wow_delta']:+.1f}.")
        else:
            sentences.append("Search positioning metrics remained comparable across both cohorts.")
        
        # Sentence 3: CWV (optional, only if material difference)
        if focus['lcp_p75'] and spotlight['lcp_p75']:
            lcp_diff_pct = abs(focus['lcp_p75'] - spotlight['lcp_p75']) / min(focus['lcp_p75'], spotlight['lcp_p75']) * 100
            if lcp_diff_pct > 15:  # Material difference threshold
                if signals['lcp'] == 'Focus stronger':
                    sentences.append(f"Core Web Vitals favor Focus with materially faster LCP (median {focus['lcp_p75']:.0f}ms vs {spotlight['lcp_p75']:.0f}ms).")
                elif signals['lcp'] == 'Spotlight stronger':
                    sentences.append(f"Spotlight properties show better site health with LCP of {spotlight['lcp_p75']:.0f}ms vs Focus's {focus['lcp_p75']:.0f}ms.")
        
        return " ".join(sentences)
    
    def render_html(self, payload: Dict) -> str:
        """Render HTML showcase in 'The Hotlist' format"""
        
        report_date = datetime.fromisoformat(payload['report_date']).strftime('%B %d, %Y')
        
        # Scorecard HTML
        focus_m = payload['scorecard']['focus_medians']
        spotlight_m = payload['scorecard']['spotlight_medians']
        signals = payload['scorecard']['comparative_signals']
        
        scorecard_html = f"""
        <div style="background: #ffffff; padding: 20px; margin-bottom: 20px; border-radius: 4px; border: 2px solid #667eea;">
            <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #212529;">Executive Scorecard — Focus vs Spotlight</h2>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                    <tr style="border-bottom: 2px solid #e9ecef;">
                        <th style="text-align: left; padding: 8px; font-weight: 600;">Metric</th>
                        <th style="text-align: right; padding: 8px; font-weight: 600;">Focus (Median WoW)</th>
                        <th style="text-align: right; padding: 8px; font-weight: 600;">Spotlight (Median WoW)</th>
                        <th style="text-align: center; padding: 8px; font-weight: 600;">Relative Signal</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom: 1px solid #f1f3f5;">
                        <td style="padding: 8px;">Sessions</td>
                        <td style="padding: 8px; text-align: right;">{focus_m['sessions_wow_pct']:+.1f}%</td>
                        <td style="padding: 8px; text-align: right;">{spotlight_m['sessions_wow_pct']:+.1f}%</td>
                        <td style="padding: 8px; text-align: center; font-weight: 600; color: #667eea;">{signals['sessions']}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f3f5;">
                        <td style="padding: 8px;">Organic Clicks</td>
                        <td style="padding: 8px; text-align: right;">{focus_m['clicks_wow_pct']:+.1f}%</td>
                        <td style="padding: 8px; text-align: right;">{spotlight_m['clicks_wow_pct']:+.1f}%</td>
                        <td style="padding: 8px; text-align: center; font-weight: 600; color: #667eea;">{signals['clicks']}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f3f5;">
                        <td style="padding: 8px;">CTR</td>
                        <td style="padding: 8px; text-align: right;">{focus_m['ctr_wow_delta']:+.2f}pp</td>
                        <td style="padding: 8px; text-align: right;">{spotlight_m['ctr_wow_delta']:+.2f}pp</td>
                        <td style="padding: 8px; text-align: center; font-weight: 600; color: #667eea;">{signals['ctr']}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f3f5;">
                        <td style="padding: 8px;">Avg Position</td>
                        <td style="padding: 8px; text-align: right;">{focus_m['position_wow_delta']:+.1f}</td>
                        <td style="padding: 8px; text-align: right;">{spotlight_m['position_wow_delta']:+.1f}</td>
                        <td style="padding: 8px; text-align: center; font-weight: 600; color: #667eea;">{signals['position']}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f3f5; background: #f8f9fa;">
                        <td style="padding: 8px; font-weight: 600;">LCP p75 (ms)</td>
                        <td style="padding: 8px; text-align: right;">{f"{focus_m['lcp_p75']:.0f}" if focus_m['lcp_p75'] is not None else 'N/A'}</td>
                        <td style="padding: 8px; text-align: right;">{f"{spotlight_m['lcp_p75']:.0f}" if spotlight_m['lcp_p75'] is not None else 'N/A'}</td>
                        <td style="padding: 8px; text-align: center; font-weight: 600; color: #667eea;">{signals['lcp']}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f3f5; background: #f8f9fa;">
                        <td style="padding: 8px; font-weight: 600;">INP p75 (ms)</td>
                        <td style="padding: 8px; text-align: right;">{f"{focus_m['inp_p75']:.0f}" if focus_m['inp_p75'] is not None else 'N/A'}</td>
                        <td style="padding: 8px; text-align: right;">{f"{spotlight_m['inp_p75']:.0f}" if spotlight_m['inp_p75'] is not None else 'N/A'}</td>
                        <td style="padding: 8px; text-align: center; font-weight: 600; color: #667eea;">{signals['inp']}</td>
                    </tr>
                    <tr style="background: #f8f9fa;">
                        <td style="padding: 8px; font-weight: 600;">CLS p75</td>
                        <td style="padding: 8px; text-align: right;">{f"{focus_m['cls_p75']:.3f}" if focus_m['cls_p75'] is not None else 'N/A'}</td>
                        <td style="padding: 8px; text-align: right;">{f"{spotlight_m['cls_p75']:.3f}" if spotlight_m['cls_p75'] is not None else 'N/A'}</td>
                        <td style="padding: 8px; text-align: center; font-weight: 600; color: #667eea;">{signals['cls']}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        """
        
        # Narrative HTML
        narrative_html = f"""
        <div style="background: #f8f9fa; padding: 16px; margin-bottom: 24px; border-radius: 4px; border-left: 4px solid #667eea;">
            <h3 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #212529;">Executive Summary</h3>
            <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #495057;">{payload['narrative']}</p>
        </div>
        """
        
        # Property cards (both cohorts)
        def render_property_card(prop: Dict) -> str:
            kpis = prop['kpis']
            cwv = prop['cwv']
            
            # CWV block
            if cwv.get('available'):
                lcp_class = self._classify_cwv_metric(cwv.get('lcp_p75'), 'lcp')
                cls_class = self._classify_cwv_metric(cwv.get('cls_p75'), 'cls')
                
                cwv_colors = {'Good': '#16a34a', 'NI': '#f59e0b', 'Poor': '#dc2626', 'Unknown': '#6c757d'}
                
                # Build metric displays (only show available metrics)
                metrics_html = []
                if cwv.get('lcp_p75'):
                    metrics_html.append(f'<span>LCP: <span style="color: {cwv_colors[lcp_class]}; font-weight: 600;">{cwv["lcp_p75"]:.0f}ms ({lcp_class})</span></span>')
                if cwv.get('cls_p75') is not None:
                    metrics_html.append(f'<span>CLS: <span style="color: {cwv_colors[cls_class]}; font-weight: 600;">{cwv["cls_p75"]:.3f} ({cls_class})</span></span>')
                
                cwv_html = f"""
                <div style="background: #f8f9fa; padding: 8px; margin-top: 8px; border-radius: 3px; font-size: 10px;">
                    <div style="font-weight: 600; margin-bottom: 4px;">Core Web Vitals ({prop['cwv_status']})</div>
                    <div style="display: flex; justify-content: space-around;">
                        {' '.join(metrics_html)}
                    </div>
                </div>
                """
            else:
                cwv_html = f"""
                <div style="background: #f8f9fa; padding: 8px; margin-top: 8px; border-radius: 3px; font-size: 10px; color: #6c757d;">
                    <div style="font-weight: 600;">Core Web Vitals: Not available</div>
                    <div style="font-size: 9px;">{cwv.get('reason', 'Unknown reason')}</div>
                </div>
                """
            
            return f"""
            <div style="background: #ffffff; padding: 12px; margin-bottom: 10px; border-radius: 4px; border: 1px solid #e9ecef;">
                <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #212529;">{prop['property_name']}</h4>
                <div style="font-size: 11px; color: #495057; line-height: 1.5;">
                    Sessions: {int(kpis['sessions_current']):,} ({kpis['sessions_wow_pct']:+.1f}%)<br>
                    Clicks: {int(kpis['clicks_current']):,} ({kpis['clicks_wow_pct']:+.1f}%)<br>
                    CTR: {kpis['ctr_current']:.1f}% ({kpis['ctr_wow_delta']:+.2f}pp)<br>
                    Position: {kpis['position_current']:.1f} ({kpis['position_wow_delta']:+.1f})
                </div>
                {cwv_html}
            </div>
            """
        
        focus_cards_html = ''.join([render_property_card(p) for p in payload['properties']['focus']])
        spotlight_cards_html = ''.join([render_property_card(p) for p in payload['properties']['spotlight']])
        
        # Combine all properties and add status for grouping
        all_properties = []
        for prop in payload['properties']['focus']:
            prop_with_status = prop.copy()
            prop_with_status['status'] = self._determine_status(prop['kpis'])
            prop_with_status['cohort'] = 'Focus'
            all_properties.append(prop_with_status)
        for prop in payload['properties']['spotlight']:
            prop_with_status = prop.copy()
            prop_with_status['status'] = self._determine_status(prop['kpis'])
            prop_with_status['cohort'] = 'Spotlight'
            all_properties.append(prop_with_status)
        
        # Group by status
        red_properties = [p for p in all_properties if p['status'] == 'red']
        yellow_properties = [p for p in all_properties if p['status'] == 'yellow']
        green_properties = [p for p in all_properties if p['status'] == 'green']
        
        # Render property sections
        def render_status_section(properties, status_label, status_color, emoji):
            if not properties:
                return ''
            
            cards = ''
            for prop in properties:
                cards += self._render_hotlist_card(prop, status_color, emoji)
            
            return f"""
            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: {status_color};">{emoji} {status_label} ({len(properties)})</h3>
                {cards}
            </div>
            """
        
        red_section = render_status_section(red_properties, 'Requires Attention', '#dc2626', '🔴')
        yellow_section = render_status_section(yellow_properties, 'Monitor', '#f59e0b', '🟡')
        green_section = render_status_section(green_properties, 'Performing Well', '#16a34a', '🟢')
        
        # Venterra logo (base64 embedded)
        logo_base64 = "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"
        
        # Build full HTML
        html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>The Hotlist 🔥 — {report_date}</title>
</head>
<body style="margin: 0; padding: 16px; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
    
    <div style="max-width: 900px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: #15284B; padding: 32px 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">🔥 The Hotlist 🔥</h1>
            <h2 style="margin: 8px 0 0 0; font-size: 16px; font-weight: 500; color: #ffffff;">Focus + Spotlight Properties</h2>
            <p style="margin: 6px 0 0 0; font-size: 12px; color: #ffffff;">{report_date}</p>
            <p style="margin: 4px 0 0 0; font-size: 10px; color: rgba(255,255,255,0.7);">All % changes are Week-over-Week</p>
        </div>
        
        <!-- Property Cards by Status -->
        <div style="padding: 24px;">
            {red_section}
            {yellow_section}
            {green_section}
        </div>
        
        <!-- Executive Scorecard -->
        <div style="padding: 0 24px 24px 24px;">
            <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #212529; border-bottom: 2px solid #ff6b6b; padding-bottom: 8px;">📊 Executive Scorecard</h2>
            
            {scorecard_html}
            
            {narrative_html}
        </div>
        
        <!-- Footer -->
        <div style="padding: 16px; background-color: #f8f9fa; text-align: center; border-top: 1px solid #e9ecef;">
            <p style="margin: 0; font-size: 9px; color: #6c757d;">
                The Hotlist 🔥 v1.0 • Venterra Living<br>
                {len(all_properties)} Properties • Focus + Spotlight Combined<br>
                C/O WebOps - Mark Laufhutte
            </p>
        </div>
        
    </div>
    
</body>
</html>"""
        
        return html
    
    def save_showcase(self, payload: Dict, html: str, output_dir: Optional[str] = None):
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
        json_path = dated_dir / 'focus_vs_spotlight_showcase.json'
        with open(json_path, 'w') as f:
            json.dump(payload, f, indent=2)
        
        # Write HTML
        html_path = dated_dir / 'focus_vs_spotlight_showcase.html'
        with open(html_path, 'w') as f:
            f.write(html)
        
        print(f"\n✅ Focus vs Spotlight Showcase generated successfully!")
        print(f"   JSON: {json_path}")
        print(f"   HTML: {html_path}")
        
        return str(html_path), str(json_path)


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate Focus vs Spotlight Showcase')
    parser.add_argument('--pagespeed-api-key', help='PageSpeed Insights API key (or set PAGESPEED_API_KEY env var)')
    parser.add_argument('--output-dir', help='Output directory for reports')
    args = parser.parse_args()
    
    generator = FocusVsSpotlightShowcase(pagespeed_api_key=args.pagespeed_api_key)
    
    print("\n=== Focus vs Spotlight Comparative Showcase ===")
    print(f"Focus cohort: {len(generator.focus_resolved)} properties resolved")
    if generator.focus_failed:
        print(f"  Failed to resolve: {[f[0] for f in generator.focus_failed]}")
    
    print(f"Spotlight cohort: {len(generator.spotlight_resolved)} properties resolved")
    if generator.spotlight_failed:
        print(f"  Failed to resolve: {[f[0] for f in generator.spotlight_failed]}")
    
    payload = generator.generate_showcase_payload()
    html = generator.render_html(payload)
    generator.save_showcase(payload, html, output_dir=args.output_dir)


if __name__ == '__main__':
    main()
