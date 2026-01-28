#!/usr/bin/env python3
"""
Daily Portfolio Health Report Generator v2.1
============================================

Portfolio state-focused diagnostic report showing:
1. Current portfolio statistics and averages with trends
2. Score distribution across all properties with deltas
3. Top/bottom performers with day-over-day changes
4. Complete PageSpeed Insights metrics with color indicators

Author: Mark Laufhutte / Atlas
Date: 2026-01-27
Version: 2.1
"""

import sys
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

# Add utils to path
sys.path.insert(0, str(Path(__file__).parent / "utils"))
from report_builder import ReportBuilder, KPITile, Section

# Configuration
DB_PATH = Path(__file__).parent / "data" / "portfolio_analytics.db"
OUTPUT_DIR = Path(__file__).parent / "reports" / "daily_health"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class PortfolioHealthReport:
    """Portfolio-focused health report generator"""
    
    def __init__(self, report_date: datetime):
        self.report_date = report_date
        self.date_str = report_date.strftime("%Y-%m-%d")
        
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row
        
        # Portfolio stats
        self.stats = {}
        self.distribution = {}
        self.worst_performers = []
        self.best_performers = []
        self.trends = {}
        
    def _get_portfolio_stats(self):
        """Get portfolio-wide statistics"""
        
        # Get latest date first
        latest_date = self.conn.execute("""
            SELECT MAX(metric_date) FROM pagespeed_metrics WHERE strategy='mobile'
        """).fetchone()[0]
        
        # Get previous date for comparison
        prev_date = self.conn.execute("""
            SELECT MAX(metric_date) 
            FROM pagespeed_metrics 
            WHERE strategy='mobile' AND metric_date < ?
        """, (latest_date,)).fetchone()[0]
        
        # PageSpeed stats (current)
        ps_stats = self.conn.execute("""
            SELECT 
                COUNT(*) as total_properties,
                ROUND(AVG(performance_score), 1) as avg_mobile_score,
                MIN(performance_score) as min_score,
                MAX(performance_score) as max_score,
                ROUND(AVG(lcp_value), 0) as avg_lcp_ms,
                ROUND(AVG(cls_value), 3) as avg_cls,
                ROUND(AVG(fid_value), 0) as avg_fid_ms,
                COUNT(CASE WHEN performance_score < 50 THEN 1 END) as poor_count,
                COUNT(CASE WHEN performance_score >= 50 AND performance_score < 90 THEN 1 END) as needs_improvement_count,
                COUNT(CASE WHEN performance_score >= 90 THEN 1 END) as good_count,
                ? as latest_date
            FROM pagespeed_metrics 
            WHERE strategy='mobile' 
            AND metric_date = ?
        """, (latest_date, latest_date)).fetchone()
        
        self.stats['pagespeed'] = dict(ps_stats)
        
        # Get previous day stats for trends
        if prev_date:
            ps_prev = self.conn.execute("""
                SELECT 
                    ROUND(AVG(performance_score), 1) as avg_mobile_score,
                    ROUND(AVG(lcp_value), 0) as avg_lcp_ms,
                    ROUND(AVG(cls_value), 3) as avg_cls,
                    COUNT(CASE WHEN performance_score < 50 THEN 1 END) as poor_count,
                    COUNT(CASE WHEN performance_score >= 50 AND performance_score < 90 THEN 1 END) as needs_improvement_count,
                    COUNT(CASE WHEN performance_score >= 90 THEN 1 END) as good_count
                FROM pagespeed_metrics 
                WHERE strategy='mobile' 
                AND metric_date = ?
            """, (prev_date,)).fetchone()
            
            if ps_prev:
                prev_dict = dict(ps_prev)
                self.trends = {
                    'has_data': True,
                    'prev_date': prev_date,
                    'score_delta': self.stats['pagespeed']['avg_mobile_score'] - prev_dict['avg_mobile_score'],
                    'lcp_delta': self.stats['pagespeed']['avg_lcp_ms'] - prev_dict['avg_lcp_ms'],
                    'cls_delta': self.stats['pagespeed']['avg_cls'] - prev_dict['avg_cls'],
                    'poor_delta': self.stats['pagespeed']['poor_count'] - prev_dict['poor_count'],
                    'needs_improvement_delta': self.stats['pagespeed']['needs_improvement_count'] - prev_dict['needs_improvement_count'],
                    'good_delta': self.stats['pagespeed']['good_count'] - prev_dict['good_count']
                }
            else:
                self.trends = {'has_data': False}
        else:
            self.trends = {'has_data': False}
        
        # Get worst performers with trends
        worst = self.conn.execute(f"""
            SELECT 
                COALESCE(p.property_name, 'Property ' || pm_curr.property_id) as property_name,
                pm_curr.performance_score,
                pm_curr.accessibility_score,
                pm_curr.best_practices_score,
                pm_curr.seo_score,
                pm_curr.lcp_value,
                pm_curr.cls_value,
                pm_curr.fid_value,
                pm_curr.fcp_value,
                pm_curr.ttfb_value,
                pm_curr.speed_index,
                pm_curr.time_to_interactive,
                pm_curr.total_blocking_time,
                pm_prev.performance_score as prev_score,
                pm_prev.lcp_value as prev_lcp
            FROM pagespeed_metrics pm_curr
            LEFT JOIN property_metadata p ON pm_curr.property_id = p.property_id
            LEFT JOIN pagespeed_metrics pm_prev ON pm_curr.property_id = pm_prev.property_id 
                AND pm_prev.strategy = 'mobile' 
                AND pm_prev.metric_date = '{prev_date if prev_date else latest_date}'
            WHERE pm_curr.strategy='mobile'
            AND pm_curr.metric_date = '{latest_date}'
            AND pm_curr.performance_score IS NOT NULL
            ORDER BY pm_curr.performance_score ASC
            LIMIT 10
        """).fetchall()
        
        self.worst_performers = [dict(row) for row in worst]
        
        # Get best performers with trends
        best = self.conn.execute(f"""
            SELECT 
                COALESCE(p.property_name, 'Property ' || pm_curr.property_id) as property_name,
                pm_curr.performance_score,
                pm_curr.accessibility_score,
                pm_curr.best_practices_score,
                pm_curr.seo_score,
                pm_curr.lcp_value,
                pm_curr.cls_value,
                pm_curr.fid_value,
                pm_curr.fcp_value,
                pm_curr.ttfb_value,
                pm_curr.speed_index,
                pm_curr.time_to_interactive,
                pm_curr.total_blocking_time,
                pm_prev.performance_score as prev_score,
                pm_prev.lcp_value as prev_lcp
            FROM pagespeed_metrics pm_curr
            LEFT JOIN property_metadata p ON pm_curr.property_id = p.property_id
            LEFT JOIN pagespeed_metrics pm_prev ON pm_curr.property_id = pm_prev.property_id 
                AND pm_prev.strategy = 'mobile' 
                AND pm_prev.metric_date = '{prev_date if prev_date else latest_date}'
            WHERE pm_curr.strategy='mobile'
            AND pm_curr.metric_date = '{latest_date}'
            AND pm_curr.performance_score IS NOT NULL
            ORDER BY pm_curr.performance_score DESC
            LIMIT 10
        """).fetchall()
        
        self.best_performers = [dict(row) for row in best]
    
    def _format_trend(self, delta, invert=False, decimals=1, suffix='', show_sign=False) -> str:
        """Format trend indicator with color coding
        
        Args:
            delta: The numeric change
            invert: If True, negative delta is good (e.g. LCP decrease is good)
            decimals: Number of decimal places
            suffix: Unit suffix (e.g. 's', 'ms')
            show_sign: Always show +/- sign
        """
        if delta is None or delta == 0:
            return ''
        
        # Determine if change is positive
        is_improvement = (delta < 0) if invert else (delta > 0)
        color = '#28a745' if is_improvement else '#dc3545'
        arrow = '↓' if delta < 0 else '↑'
        
        # Format the value
        if show_sign:
            value_str = f"{delta:+.{decimals}f}"
        else:
            value_str = f"{abs(delta):.{decimals}f}"
        
        return f' <span style="font-size: 14px; color: {color}; margin-left: 8px;">{arrow}{value_str}{suffix}</span>'
    
    def _generate_portfolio_overview(self) -> str:
        """Generate portfolio overview section"""
        
        ps = self.stats['pagespeed']
        
        # Determine overall health color
        avg_score = ps['avg_mobile_score'] or 0
        if avg_score >= 90:
            health_color = "#28a745"
            health_text = "EXCELLENT"
        elif avg_score >= 75:
            health_color = "#ffc107"
            health_text = "GOOD"
        elif avg_score >= 50:
            health_color = "#fd7e14"
            health_text = "NEEDS IMPROVEMENT"
        else:
            health_color = "#dc3545"
            health_text = "POOR"
        
        html = f"""
        <div style="margin-bottom: 30px;">
            <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 6px; margin-bottom: 20px;">
                <div style="font-size: 16px; font-weight: 600; color: {health_color}; margin-bottom: 10px;">
                    Portfolio Average: {ps['avg_mobile_score']} ({health_text})
                    {self._format_trend(self.trends.get('score_delta'), invert=False) if self.trends.get('has_data') else ''}
                </div>
                <div style="font-size: 13px; color: #6c757d;">
                    {ps['total_properties']} properties analyzed | Latest data: {ps['latest_date']}
                    {f" | vs. {self.trends['prev_date']}" if self.trends.get('has_data') else ''}
                </div>
            </div>
            
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 25px;">
                <tr>
                    <td style="width: 32%; vertical-align: top;">
                        <div style="padding: 20px; background: white; border: 1px solid #e9ecef; border-radius: 6px; text-align: center;">
                            <div style="font-size: 11px; color: #868e96; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; font-weight: 600;">Mobile Score Range</div>
                            <div style="font-size: 28px; font-weight: 700; color: #333; margin: 8px 0;">{ps['min_score']} - {ps['max_score']}</div>
                            <div style="font-size: 12px; color: #6c757d; margin-top: 5px;">Min to Max</div>
                        </div>
                    </td>
                    <td style="width: 2%;"></td>
                    <td style="width: 32%; vertical-align: top;">
                        <div style="padding: 20px; background: white; border: 1px solid #e9ecef; border-radius: 6px; text-align: center;">
                            <div style="font-size: 11px; color: #868e96; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; font-weight: 600;">Avg LCP (Mobile)</div>
                            <div style="font-size: 28px; font-weight: 700; color: {'#dc3545' if ps['avg_lcp_ms'] > 2.5 else '#ffc107' if ps['avg_lcp_ms'] > 1.8 else '#28a745'}; margin: 8px 0;">
                                {ps['avg_lcp_ms']:.1f}s
                                {self._format_trend(self.trends.get('lcp_delta'), invert=True, decimals=1, suffix='s') if self.trends.get('has_data') else ''}
                            </div>
                            <div style="font-size: 12px; color: #6c757d; margin-top: 5px;">Target: &lt;2.5s</div>
                        </div>
                    </td>
                    <td style="width: 2%;"></td>
                    <td style="width: 32%; vertical-align: top;">
                        <div style="padding: 20px; background: white; border: 1px solid #e9ecef; border-radius: 6px; text-align: center;">
                            <div style="font-size: 11px; color: #868e96; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; font-weight: 600;">Avg CLS</div>
                            <div style="font-size: 28px; font-weight: 700; color: {'#dc3545' if ps['avg_cls'] > 0.25 else '#ffc107' if ps['avg_cls'] > 0.1 else '#28a745'}; margin: 8px 0;">
                                {ps['avg_cls']:.3f}
                                {self._format_trend(self.trends.get('cls_delta'), invert=True, decimals=3) if self.trends.get('has_data') else ''}
                            </div>
                            <div style="font-size: 12px; color: #6c757d; margin-top: 5px;">Target: &lt;0.1</div>
                        </div>
                    </td>
                </tr>
            </table>
            
            <div style="background: white; border: 1px solid #e9ecef; border-radius: 6px; padding: 20px;">
                <div style="font-size: 14px; font-weight: 600; margin-bottom: 15px;">Score Distribution</div>
                <table style="width: 100%;">
                    <tr>
                        <td style="width: 33%; text-align: center; padding: 15px; background: #f8d7da; border-radius: 4px;">
                            <div style="font-size: 32px; font-weight: 700; color: #dc3545;">
                                {ps['poor_count']}
                                {self._format_trend(self.trends.get('poor_delta'), invert=True, show_sign=True) if self.trends.get('has_data') else ''}
                            </div>
                            <div style="font-size: 12px; color: #721c24; margin-top: 5px; font-weight: 600;">POOR (&lt;50)</div>
                        </td>
                        <td style="width: 2%;"></td>
                        <td style="width: 33%; text-align: center; padding: 15px; background: #fff3cd; border-radius: 4px;">
                            <div style="font-size: 32px; font-weight: 700; color: #fd7e14;">
                                {ps['needs_improvement_count']}
                                {self._format_trend(self.trends.get('needs_improvement_delta'), invert=True, show_sign=True) if self.trends.get('has_data') else ''}
                            </div>
                            <div style="font-size: 12px; color: #856404; margin-top: 5px; font-weight: 600;">NEEDS IMPROVEMENT (50-89)</div>
                        </td>
                        <td style="width: 2%;"></td>
                        <td style="width: 33%; text-align: center; padding: 15px; background: #d4edda; border-radius: 4px;">
                            <div style="font-size: 32px; font-weight: 700; color: #28a745;">
                                {ps['good_count']}
                                {self._format_trend(self.trends.get('good_delta'), invert=False, show_sign=True) if self.trends.get('has_data') else ''}
                            </div>
                            <div style="font-size: 12px; color: #155724; margin-top: 5px; font-weight: 600;">GOOD (90+)</div>
                        </td>
                    </tr>
                </table>
            </div>
        </div>
        """
        
        return html
    
    def _generate_performers_section(self) -> str:
        """Generate worst/best performers section"""
        
        html = '<div style="margin-bottom: 30px;">'
        
        # Worst performers
        if self.worst_performers:
            html += """
            <div style="margin-bottom: 25px;">
                <h3 style="font-size: 15px; color: #dc3545; margin: 0 0 15px 0; font-weight: 600;">
                    ⚠️ Bottom 10 Performers (Immediate Attention Needed)
                </h3>
            """
            
            for prop in self.worst_performers:
                # Color coding functions
                def score_color(score):
                    if not score: return '#999'
                    if score >= 90: return '#28a745'
                    if score >= 50: return '#ffc107'
                    return '#dc3545'
                
                def lcp_color(lcp):
                    if lcp <= 2.5: return '#28a745'
                    if lcp <= 4.0: return '#ffc107'
                    return '#dc3545'
                
                def cls_color(cls):
                    if cls <= 0.1: return '#28a745'
                    if cls <= 0.25: return '#ffc107'
                    return '#dc3545'
                
                def fid_color(fid):
                    if fid <= 100: return '#28a745'
                    if fid <= 300: return '#ffc107'
                    return '#dc3545'
                
                def fcp_color(fcp):
                    if fcp <= 1.8: return '#28a745'
                    if fcp <= 3.0: return '#ffc107'
                    return '#dc3545'
                
                def ttfb_color(ttfb):
                    if ttfb <= 800: return '#28a745'
                    if ttfb <= 1800: return '#ffc107'
                    return '#dc3545'
                
                def si_color(si):
                    if si <= 3.4: return '#28a745'
                    if si <= 5.8: return '#ffc107'
                    return '#dc3545'
                
                def tti_color(tti):
                    if tti <= 3.8: return '#28a745'
                    if tti <= 7.3: return '#ffc107'
                    return '#dc3545'
                
                def tbt_color(tbt):
                    if tbt <= 200: return '#28a745'
                    if tbt <= 600: return '#ffc107'
                    return '#dc3545'
                
                # Calculate property trends
                score_trend = ''
                lcp_trend = ''
                if prop.get('prev_score') is not None:
                    score_delta = prop['performance_score'] - prop['prev_score']
                    if score_delta != 0:
                        score_trend = self._format_trend(score_delta, invert=False)
                if prop.get('prev_lcp') is not None:
                    lcp_delta = prop['lcp_value'] - prop['prev_lcp']
                    if lcp_delta != 0:
                        lcp_trend = self._format_trend(lcp_delta, invert=True, decimals=1, suffix='s')
                
                html += f"""
                <div style="padding: 12px; background: #fff; border-left: 4px solid #dc3545; margin-bottom: 12px; border-radius: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #333; font-size: 14px; margin-bottom: 8px;">
                                {prop['property_name']}
                                {score_trend}
                            </div>
                            <table style="width: 100%; font-size: 11px;">
                                <tr>
                                    <td style="padding: 2px 8px 2px 0;"><strong>Perf:</strong> <span style="color: {score_color(prop['performance_score'])};">{prop['performance_score']}</span></td>
                                    <td style="padding: 2px 8px 2px 0;"><strong>A11y:</strong> <span style="color: {score_color(prop['accessibility_score'])};">{prop['accessibility_score'] or 'N/A'}</span></td>
                                    <td style="padding: 2px 8px 2px 0;"><strong>BP:</strong> <span style="color: {score_color(prop['best_practices_score'])};">{prop['best_practices_score'] or 'N/A'}</span></td>
                                    <td style="padding: 2px 0;"><strong>SEO:</strong> <span style="color: {score_color(prop['seo_score'])};">{prop['seo_score'] or 'N/A'}</span></td>
                                </tr>
                                <tr>
                                    <td style="padding: 2px 8px 2px 0;"><strong>LCP:</strong> <span style="color: {lcp_color(prop['lcp_value'])};">{prop['lcp_value']:.1f}s</span>{lcp_trend}</td>
                                    <td style="padding: 2px 8px 2px 0;"><strong>CLS:</strong> <span style="color: {cls_color(prop['cls_value'])};">{prop['cls_value']:.3f}</span></td>
                                    <td style="padding: 2px 8px 2px 0;"><strong>FID:</strong> <span style="color: {fid_color(prop['fid_value'])};">{prop['fid_value']:.0f}ms</span></td>
                                    <td style="padding: 2px 0;"><strong>FCP:</strong> <span style="color: {fcp_color(prop['fcp_value'])};">{prop['fcp_value']:.1f}s</span></td>
                                </tr>
                                <tr>
                                    <td style="padding: 2px 8px 2px 0;"><strong>TTFB:</strong> <span style="color: {ttfb_color(prop['ttfb_value'])};">{prop['ttfb_value']:.0f}ms</span></td>
                                    <td style="padding: 2px 8px 2px 0;"><strong>SI:</strong> <span style="color: {si_color(prop['speed_index'])};">{prop['speed_index']:.1f}s</span></td>
                                    <td style="padding: 2px 8px 2px 0;"><strong>TTI:</strong> <span style="color: {tti_color(prop['time_to_interactive'])};">{prop['time_to_interactive']:.1f}s</span></td>
                                    <td style="padding: 2px 0;"><strong>TBT:</strong> <span style="color: {tbt_color(prop['total_blocking_time'])};">{prop['total_blocking_time']:.0f}ms</span></td>
                                </tr>
                            </table>
                        </div>
                        <div style="font-size: 32px; font-weight: 700; color: #dc3545; margin-left: 15px;">
                            {prop['performance_score']}
                        </div>
                    </div>
                </div>
                """
            
            html += "</div>"
        
        # Best performers
        if self.best_performers:
            html += """
            <div style="margin-bottom: 25px;">
                <h3 style="font-size: 15px; color: #28a745; margin: 0 0 15px 0; font-weight: 600;">
                    ✅ Top 10 Performers (Benchmark Examples)
                </h3>
            """
            
            for prop in self.best_performers:
                # Color coding functions
                def score_color(score):
                    if not score: return '#999'
                    if score >= 90: return '#28a745'
                    if score >= 50: return '#ffc107'
                    return '#dc3545'
                
                def lcp_color(lcp):
                    if lcp <= 2.5: return '#28a745'
                    if lcp <= 4.0: return '#ffc107'
                    return '#dc3545'
                
                def cls_color(cls):
                    if cls <= 0.1: return '#28a745'
                    if cls <= 0.25: return '#ffc107'
                    return '#dc3545'
                
                def fid_color(fid):
                    if fid <= 100: return '#28a745'
                    if fid <= 300: return '#ffc107'
                    return '#dc3545'
                
                def fcp_color(fcp):
                    if fcp <= 1.8: return '#28a745'
                    if fcp <= 3.0: return '#ffc107'
                    return '#dc3545'
                
                def ttfb_color(ttfb):
                    if ttfb <= 800: return '#28a745'
                    if ttfb <= 1800: return '#ffc107'
                    return '#dc3545'
                
                def si_color(si):
                    if si <= 3.4: return '#28a745'
                    if si <= 5.8: return '#ffc107'
                    return '#dc3545'
                
                def tti_color(tti):
                    if tti <= 3.8: return '#28a745'
                    if tti <= 7.3: return '#ffc107'
                    return '#dc3545'
                
                def tbt_color(tbt):
                    if tbt <= 200: return '#28a745'
                    if tbt <= 600: return '#ffc107'
                    return '#dc3545'
                
                # Calculate property trends
                score_trend = ''
                lcp_trend = ''
                if prop.get('prev_score') is not None:
                    score_delta = prop['performance_score'] - prop['prev_score']
                    if score_delta != 0:
                        score_trend = self._format_trend(score_delta, invert=False)
                if prop.get('prev_lcp') is not None:
                    lcp_delta = prop['lcp_value'] - prop['prev_lcp']
                    if lcp_delta != 0:
                        lcp_trend = self._format_trend(lcp_delta, invert=True, decimals=1, suffix='s')
                
                html += f"""
                <div style="padding: 12px; background: #fff; border-left: 4px solid #28a745; margin-bottom: 12px; border-radius: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #333; font-size: 14px; margin-bottom: 8px;">
                                {prop['property_name']}
                                {score_trend}
                            </div>
                            <table style="width: 100%; font-size: 11px;">
                                <tr>
                                    <td style="padding: 2px 8px 2px 0;"><strong>Perf:</strong> <span style="color: {score_color(prop['performance_score'])};">{prop['performance_score']}</span></td>
                                    <td style="padding: 2px 8px 2px 0;"><strong>A11y:</strong> <span style="color: {score_color(prop['accessibility_score'])};">{prop['accessibility_score'] or 'N/A'}</span></td>
                                    <td style="padding: 2px 8px 2px 0;"><strong>BP:</strong> <span style="color: {score_color(prop['best_practices_score'])};">{prop['best_practices_score'] or 'N/A'}</span></td>
                                    <td style="padding: 2px 0;"><strong>SEO:</strong> <span style="color: {score_color(prop['seo_score'])};">{prop['seo_score'] or 'N/A'}</span></td>
                                </tr>
                                <tr>
                                    <td style="padding: 2px 8px 2px 0;"><strong>LCP:</strong> <span style="color: {lcp_color(prop['lcp_value'])};">{prop['lcp_value']:.1f}s</span>{lcp_trend}</td>
                                    <td style="padding: 2px 8px 2px 0;"><strong>CLS:</strong> <span style="color: {cls_color(prop['cls_value'])};">{prop['cls_value']:.3f}</span></td>
                                    <td style="padding: 2px 8px 2px 0;"><strong>FID:</strong> <span style="color: {fid_color(prop['fid_value'])};">{prop['fid_value']:.0f}ms</span></td>
                                    <td style="padding: 2px 0;"><strong>FCP:</strong> <span style="color: {fcp_color(prop['fcp_value'])};">{prop['fcp_value']:.1f}s</span></td>
                                </tr>
                                <tr>
                                    <td style="padding: 2px 8px 2px 0;"><strong>TTFB:</strong> <span style="color: {ttfb_color(prop['ttfb_value'])};">{prop['ttfb_value']:.0f}ms</span></td>
                                    <td style="padding: 2px 8px 2px 0;"><strong>SI:</strong> <span style="color: {si_color(prop['speed_index'])};">{prop['speed_index']:.1f}s</span></td>
                                    <td style="padding: 2px 8px 2px 0;"><strong>TTI:</strong> <span style="color: {tti_color(prop['time_to_interactive'])};">{prop['time_to_interactive']:.1f}s</span></td>
                                    <td style="padding: 2px 0;"><strong>TBT:</strong> <span style="color: {tbt_color(prop['total_blocking_time'])};">{prop['total_blocking_time']:.0f}ms</span></td>
                                </tr>
                            </table>
                        </div>
                        <div style="font-size: 32px; font-weight: 700; color: #28a745; margin-left: 15px;">
                            {prop['performance_score']}
                        </div>
                    </div>
                </div>
                """
            
            html += "</div>"
        
        html += '</div>'
        return html
    
    def generate(self) -> str:
        """Generate complete report"""
        
        print("Collecting portfolio data...")
        self._get_portfolio_stats()
        
        print("Building report...")
        builder = ReportBuilder(
            title="Portfolio Health Daily",
            subtitle="Portfolio State & Performance Overview",
            version="2.0",
            date_range=self.date_str
        )
        
        # Portfolio Overview
        overview_html = self._generate_portfolio_overview()
        builder.add_section(Section(
            title="Portfolio Overview",
            content=overview_html,
            status="action_needed" if self.stats['pagespeed']['avg_mobile_score'] < 75 else "healthy",
            description=f"Current state of {self.stats['pagespeed']['total_properties']} properties"
        ))
        
        # Top/Bottom Performers
        performers_html = self._generate_performers_section()
        builder.add_section(Section(
            title="Individual Property Performance",
            content=performers_html,
            status="action_needed",
            description="Properties requiring immediate attention and benchmark examples"
        ))
        
        # Generate HTML
        html = builder.generate()
        
        # Save report
        output_file = OUTPUT_DIR / f"Portfolio_Health_Daily_{self.date_str}.html"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html)
        
        print(f"\n✅ Daily Portfolio Health Report generated:")
        print(f"   {output_file}")
        print(f"\n📊 Portfolio Summary:")
        print(f"   Total Properties: {self.stats['pagespeed']['total_properties']}")
        print(f"   Average Score: {self.stats['pagespeed']['avg_mobile_score']}")
        print(f"   Poor: {self.stats['pagespeed']['poor_count']}")
        print(f"   Needs Improvement: {self.stats['pagespeed']['needs_improvement_count']}")
        print(f"   Good: {self.stats['pagespeed']['good_count']}")
        print(f"   Avg LCP: {self.stats['pagespeed']['avg_lcp_ms']:.1f}s")
        
        return str(output_file)
    
    def __del__(self):
        if hasattr(self, 'conn'):
            self.conn.close()


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate Daily Portfolio Health Report v2")
    parser.add_argument('--date', help='Report date (YYYY-MM-DD), defaults to today')
    
    args = parser.parse_args()
    
    # Determine report date
    if args.date:
        report_date = datetime.strptime(args.date, "%Y-%m-%d")
    else:
        report_date = datetime.now()
    
    print("=" * 70)
    print("DAILY PORTFOLIO HEALTH REPORT v2.0")
    print("=" * 70)
    print(f"\nReport Date: {report_date.strftime('%Y-%m-%d')}\n")
    
    # Generate report
    reporter = PortfolioHealthReport(report_date)
    output_file = reporter.generate()
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
