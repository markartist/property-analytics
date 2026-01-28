#!/usr/bin/env python3
"""
Weekly Portfolio Progress Report Generator v1.0
===============================================

Weekly roundup showing optimization progress over 7 days:
1. Week-over-week portfolio improvements
2. Top gainers and losers
3. Progress toward targets
4. Key achievements and concerns

Author: Mark Laufhutte / Atlas
Date: 2026-01-27
Version: 1.0
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
OUTPUT_DIR = Path(__file__).parent / "reports" / "weekly_progress"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class WeeklyProgressReport:
    """Weekly portfolio progress report generator"""
    
    def __init__(self, report_date: datetime):
        self.report_date = report_date
        self.date_str = report_date.strftime("%Y-%m-%d")
        # Calculate start of week (previous Monday, not current day)
        # If today is Monday, go back to previous Monday (7 days)
        # Otherwise go back to most recent Monday
        days_since_monday = report_date.weekday()
        if days_since_monday == 0:
            # Today is Monday, use previous Monday
            self.week_start = report_date - timedelta(days=7)
        else:
            # Use most recent Monday
            self.week_start = report_date - timedelta(days=days_since_monday)
        
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row
        
        # Stats
        self.current_stats = {}
        self.week_ago_stats = {}
        self.top_gainers = []
        self.top_losers = []
        self.moved_up_category = []
        self.moved_down_category = []
        
    def _get_stats_for_date(self, target_date):
        """Get portfolio stats for a specific date"""
        stats = self.conn.execute("""
            SELECT 
                COUNT(*) as total_properties,
                ROUND(AVG(performance_score), 1) as avg_mobile_score,
                MIN(performance_score) as min_score,
                MAX(performance_score) as max_score,
                ROUND(AVG(lcp_value), 2) as avg_lcp,
                ROUND(AVG(cls_value), 3) as avg_cls,
                ROUND(AVG(fid_value), 1) as avg_fid,
                COUNT(CASE WHEN performance_score < 50 THEN 1 END) as poor_count,
                COUNT(CASE WHEN performance_score >= 50 AND performance_score < 90 THEN 1 END) as needs_improvement_count,
                COUNT(CASE WHEN performance_score >= 90 THEN 1 END) as good_count
            FROM pagespeed_metrics 
            WHERE strategy='mobile' 
            AND metric_date = (
                SELECT MAX(metric_date) 
                FROM pagespeed_metrics 
                WHERE strategy='mobile' 
                AND metric_date <= ?
            )
        """, (target_date,)).fetchone()
        
        return dict(stats) if stats else None
    
    def _get_portfolio_stats(self):
        """Get current and week-ago portfolio statistics"""
        
        # Current stats (latest date)
        latest_date = self.conn.execute("""
            SELECT MAX(metric_date) FROM pagespeed_metrics WHERE strategy='mobile'
        """).fetchone()[0]
        
        self.current_stats = self._get_stats_for_date(latest_date)
        self.current_stats['date'] = latest_date
        
        # Week ago stats
        week_ago_date = self.conn.execute("""
            SELECT MAX(metric_date) 
            FROM pagespeed_metrics 
            WHERE strategy='mobile' 
            AND metric_date <= date(?, '-7 days')
        """, (latest_date,)).fetchone()[0]
        
        if week_ago_date:
            self.week_ago_stats = self._get_stats_for_date(week_ago_date)
            self.week_ago_stats['date'] = week_ago_date
        
        # Get property-level changes
        if week_ago_date:
            changes = self.conn.execute(f"""
                SELECT 
                    COALESCE(p.property_name, 'Property ' || curr.property_id) as property_name,
                    curr.performance_score as current_score,
                    prev.performance_score as prev_score,
                    curr.performance_score - prev.performance_score as score_change,
                    curr.lcp_value as current_lcp,
                    prev.lcp_value as prev_lcp,
                    curr.lcp_value - prev.lcp_value as lcp_change,
                    CASE 
                        WHEN curr.performance_score < 50 THEN 'Poor'
                        WHEN curr.performance_score < 90 THEN 'Needs Improvement'
                        ELSE 'Good'
                    END as current_category,
                    CASE 
                        WHEN prev.performance_score < 50 THEN 'Poor'
                        WHEN prev.performance_score < 90 THEN 'Needs Improvement'
                        ELSE 'Good'
                    END as prev_category
                FROM pagespeed_metrics curr
                LEFT JOIN property_metadata p ON curr.property_id = p.property_id
                INNER JOIN pagespeed_metrics prev 
                    ON curr.property_id = prev.property_id 
                    AND prev.strategy = 'mobile'
                    AND prev.metric_date = '{week_ago_date}'
                WHERE curr.strategy = 'mobile'
                AND curr.metric_date = '{latest_date}'
                AND curr.performance_score IS NOT NULL
                AND prev.performance_score IS NOT NULL
                ORDER BY score_change DESC
            """).fetchall()
            
            changes_list = [dict(row) for row in changes]
            
            # Top gainers (most improvement)
            self.top_gainers = [c for c in changes_list if c['score_change'] > 0][:10]
            
            # Top losers (most regression)
            self.top_losers = [c for c in changes_list if c['score_change'] < 0][-10:]
            self.top_losers.reverse()
            
            # Category movers
            self.moved_up_category = [c for c in changes_list 
                                     if c['current_category'] != c['prev_category']
                                     and (
                                         (c['prev_category'] == 'Poor' and c['current_category'] in ['Needs Improvement', 'Good'])
                                         or (c['prev_category'] == 'Needs Improvement' and c['current_category'] == 'Good')
                                     )]
            
            self.moved_down_category = [c for c in changes_list 
                                       if c['current_category'] != c['prev_category']
                                       and (
                                           (c['prev_category'] == 'Good' and c['current_category'] in ['Needs Improvement', 'Poor'])
                                           or (c['prev_category'] == 'Needs Improvement' and c['current_category'] == 'Poor')
                                       )]
    
    def _format_delta(self, value, invert=False, decimals=1, suffix='', size='16px'):
        """Format delta with color coding"""
        if value is None or value == 0:
            return '<span style="color: #999;">—</span>'
        
        is_improvement = (value < 0) if invert else (value > 0)
        color = '#28a745' if is_improvement else '#dc3545'
        arrow = '↓' if value < 0 else '↑'
        
        return f'<span style="color: {color}; font-size: {size}; font-weight: 600;">{arrow}{abs(value):.{decimals}f}{suffix}</span>'
    
    def _generate_executive_summary(self) -> str:
        """Generate executive summary section"""
        
        curr = self.current_stats
        prev = self.week_ago_stats
        
        if not prev:
            return '<div style="padding: 20px; background: #fff3cd; border-radius: 6px; margin-bottom: 20px;">Insufficient historical data for week-over-week comparison.</div>'
        
        # Calculate deltas (handle NULL values)
        score_delta = (curr['avg_mobile_score'] or 0) - (prev['avg_mobile_score'] or 0)
        lcp_delta = (curr['avg_lcp'] or 0) - (prev['avg_lcp'] or 0) if curr['avg_lcp'] and prev['avg_lcp'] else None
        cls_delta = (curr['avg_cls'] or 0) - (prev['avg_cls'] or 0) if curr['avg_cls'] and prev['avg_cls'] else None
        poor_delta = (curr['poor_count'] or 0) - (prev['poor_count'] or 0)
        good_delta = (curr['good_count'] or 0) - (prev['good_count'] or 0)
        
        # Determine overall trend
        if score_delta >= 2:
            trend_color = '#28a745'
            trend_text = '📈 Strong Progress'
        elif score_delta > 0:
            trend_color = '#28a745'
            trend_text = '📈 Improving'
        elif score_delta == 0:
            trend_color = '#6c757d'
            trend_text = '➡️ Stable'
        elif score_delta >= -2:
            trend_color = '#dc3545'
            trend_text = '📉 Slight Decline'
        else:
            trend_color = '#dc3545'
            trend_text = '📉 Declining'
        
        html = f"""
        <div style="margin-bottom: 30px;">
            
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 25px;">
                <tr>
                    <td style="width: 24%; vertical-align: top; padding-right: 1%;">
                        <div style="padding: 20px; background: white; border: 2px solid #e9ecef; border-radius: 8px; text-align: center; height: 140px;">
                            <div style="font-size: 11px; color: #868e96; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; font-weight: 600;">Portfolio Average</div>
                            <div style="font-size: 36px; font-weight: 700; color: #333; margin: 10px 0;">
                                {curr['avg_mobile_score']}
                            </div>
                            <div style="font-size: 14px; color: #6c757d; margin-top: 8px;">
                                {self._format_delta(score_delta, invert=False, decimals=1, size='14px')}
                                <span style="color: #999; font-size: 12px;">vs last week</span>
                            </div>
                        </div>
                    </td>
                    <td style="width: 24%; vertical-align: top; padding-right: 1%;">
                        <div style="padding: 20px; background: white; border: 2px solid #e9ecef; border-radius: 8px; text-align: center; height: 140px;">
                            <div style="font-size: 11px; color: #868e96; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; font-weight: 600;">Avg LCP</div>
                            <div style="font-size: 36px; font-weight: 700; color: {'#dc3545' if curr['avg_lcp'] > 2.5 else '#ffc107' if curr['avg_lcp'] > 1.8 else '#28a745'}; margin: 10px 0;">
                                {curr['avg_lcp']:.1f}s
                            </div>
                            <div style="font-size: 14px; color: #6c757d; margin-top: 8px;">
                                {self._format_delta(lcp_delta, invert=True, decimals=1, suffix='s', size='14px')}
                                <span style="color: #999; font-size: 12px;">vs last week</span>
                            </div>
                        </div>
                    </td>
                    <td style="width: 24%; vertical-align: top; padding-right: 1%;">
                        <div style="padding: 20px; background: white; border: 2px solid #e9ecef; border-radius: 8px; text-align: center; height: 140px;">
                            <div style="font-size: 11px; color: #868e96; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; font-weight: 600;">Avg CLS</div>
                            <div style="font-size: 36px; font-weight: 700; color: {'#dc3545' if curr['avg_cls'] > 0.25 else '#ffc107' if curr['avg_cls'] > 0.1 else '#28a745'}; margin: 10px 0;">
                                {curr['avg_cls']:.3f}
                            </div>
                            <div style="font-size: 14px; color: #6c757d; margin-top: 8px;">
                                {self._format_delta(cls_delta, invert=True, decimals=3, size='14px')}
                                <span style="color: #999; font-size: 12px;">vs last week</span>
                            </div>
                        </div>
                    </td>
                    <td style="width: 24%; vertical-align: top;">
                        <div style="padding: 20px; background: white; border: 2px solid #e9ecef; border-radius: 8px; text-align: center; height: 140px;">
                            <div style="font-size: 11px; color: #868e96; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; font-weight: 600;">Good Sites (90+)</div>
                            <div style="font-size: 36px; font-weight: 700; color: #28a745; margin: 10px 0;">
                                {curr['good_count']}
                            </div>
                            <div style="font-size: 14px; color: #6c757d; margin-top: 8px;">
                                {self._format_delta(good_delta, invert=False, decimals=0, size='14px')}
                                <span style="color: #999; font-size: 12px;">vs last week</span>
                            </div>
                        </div>
                    </td>
                </tr>
            </table>
        </div>
        """
        
        return html
    
    def _generate_top_gainers(self) -> str:
        """Generate top gainers section"""
        if not self.top_gainers:
            return '<div style="padding: 20px; background: #f8f9fa; border-radius: 6px; text-align: center; color: #6c757d;">No improvements detected this week.</div>'
        
        html = '<div style="background: white; border: 1px solid #e9ecef; border-radius: 6px; padding: 20px;">'
        
        for i, prop in enumerate(self.top_gainers[:5], 1):
            medal = '🥇' if i == 1 else '🥈' if i == 2 else '🥉' if i == 3 else f'{i}.'
            
            html += f"""
            <div style="padding: 15px; background: #d4edda; border-left: 4px solid #28a745; margin-bottom: 12px; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <div style="font-size: 18px; margin-bottom: 4px;">{medal}</div>
                        <div style="font-weight: 600; color: #333; font-size: 15px; margin-bottom: 6px;">{prop['property_name']}</div>
                        <div style="font-size: 13px; color: #155724;">
                            Score: {prop['prev_score']} → {prop['current_score']} 
                            <span style="color: #28a745; font-weight: 600;">(+{prop['score_change']})</span>
                            {' | LCP: ' + f"{prop['prev_lcp']:.1f}s → {prop['current_lcp']:.1f}s" if prop['lcp_change'] != 0 else ''}
                        </div>
                    </div>
                </div>
            </div>
            """
        
        html += '</div>'
        return html
    
    def _generate_concerns(self) -> str:
        """Generate concerns section"""
        if not self.top_losers:
            return '<div style="padding: 20px; background: #f8f9fa; border-radius: 6px; text-align: center; color: #6c757d;">No regressions detected this week.</div>'
        
        html = '<div style="background: white; border: 1px solid #e9ecef; border-radius: 6px; padding: 20px;">'
        
        for prop in self.top_losers[:5]:
            html += f"""
            <div style="padding: 15px; background: #f8d7da; border-left: 4px solid #dc3545; margin-bottom: 12px; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #333; font-size: 15px; margin-bottom: 6px;">{prop['property_name']}</div>
                        <div style="font-size: 13px; color: #721c24;">
                            Score: {prop['prev_score']} → {prop['current_score']} 
                            <span style="color: #dc3545; font-weight: 600;">({prop['score_change']})</span>
                            {' | LCP: ' + f"{prop['prev_lcp']:.1f}s → {prop['current_lcp']:.1f}s" if prop['lcp_change'] != 0 else ''}
                        </div>
                    </div>
                </div>
            </div>
            """
        
        html += '</div>'
        return html
    
    def _generate_category_moves(self) -> str:
        """Generate category movement section"""
        html = '<div style="background: white; border: 1px solid #e9ecef; border-radius: 6px; padding: 20px;">'
        
        if self.moved_up_category:
            html += '<div style="margin-bottom: 20px;"><div style="font-weight: 600; color: #28a745; margin-bottom: 12px; font-size: 15px;">✅ Moved Up</div>'
            for prop in self.moved_up_category:
                html += f"""
                <div style="padding: 10px; background: #d4edda; border-radius: 4px; margin-bottom: 8px; font-size: 13px;">
                    <strong>{prop['property_name']}</strong>: {prop['prev_category']} → {prop['current_category']} (Score: {prop['current_score']})
                </div>
                """
            html += '</div>'
        
        if self.moved_down_category:
            html += '<div><div style="font-weight: 600; color: #dc3545; margin-bottom: 12px; font-size: 15px;">⚠️ Moved Down</div>'
            for prop in self.moved_down_category:
                html += f"""
                <div style="padding: 10px; background: #f8d7da; border-radius: 4px; margin-bottom: 8px; font-size: 13px;">
                    <strong>{prop['property_name']}</strong>: {prop['prev_category']} → {prop['current_category']} (Score: {prop['current_score']})
                </div>
                """
            html += '</div>'
        
        if not self.moved_up_category and not self.moved_down_category:
            html += '<div style="text-align: center; color: #6c757d; padding: 20px;">No properties changed performance categories this week.</div>'
        
        html += '</div>'
        return html
    
    def generate(self):
        """Generate the complete weekly progress report"""
        
        print("=" * 70)
        print("WEEKLY PORTFOLIO PROGRESS REPORT")
        print("=" * 70)
        print(f"\nReport Period: {self.week_start.strftime('%Y-%m-%d')} to {self.date_str}\n")
        print("Collecting portfolio data...")
        
        self._get_portfolio_stats()
        
        print("Building report...")
        
        # Build HTML report
        report_title = "Weekly Portfolio Progress Report"
        
        builder = ReportBuilder(
            title=report_title,
            subtitle=f"Week of {self.week_start.strftime('%B %d, %Y')}"
        )
        
        # Executive Summary
        builder.add_section(Section("Executive Summary", self._generate_executive_summary()))
        
        # Top Gainers
        builder.add_section(Section("🏆 Top Performers This Week", self._generate_top_gainers()))
        
        # Category Movements
        builder.add_section(Section("📊 Category Changes", self._generate_category_moves()))
        
        # Concerns
        if self.top_losers:
            builder.add_section(Section("⚠️ Properties Needing Attention", self._generate_concerns()))
        
        # Save report
        output_file = OUTPUT_DIR / f"Weekly_Progress_{self.week_start.strftime('%Y-%m-%d')}_to_{self.date_str}.html"
        builder.save(output_file)
        
        print(f"\n✅ Weekly Progress Report generated:")
        print(f"   {output_file}")
        
        if self.week_ago_stats:
            print(f"\n📊 Week Summary:")
            print(f"   Portfolio Average: {self.current_stats['avg_mobile_score']} (was {self.week_ago_stats['avg_mobile_score']})")
            print(f"   Properties Improved: {len(self.top_gainers)}")
            print(f"   Properties Declined: {len(self.top_losers)}")
            print(f"   Good Sites (90+): {self.current_stats['good_count']} (was {self.week_ago_stats['good_count']})")
        
        self.conn.close()
        return output_file


def main():
    report_date = datetime.now()
    report = WeeklyProgressReport(report_date)
    report.generate()


if __name__ == "__main__":
    main()
