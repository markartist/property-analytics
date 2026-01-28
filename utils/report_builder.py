#!/usr/bin/env python3
"""
Ad-Hoc Report Builder with PIB v1.9 Styling
===========================================

Flexible HTML report generator using Property Intelligence Brief v1.9 visual styling.
Provides reusable components for building custom reports on-the-fly.

Usage:
    from utils.report_builder import ReportBuilder, KPITile, Section
    
    builder = ReportBuilder(title="Custom Report", subtitle="Property Analysis")
    
    # Add top KPI tiles
    builder.add_kpi_tiles([
        KPITile(label="Total Sessions", value="12,456", trend="+15%", is_primary=True),
        KPITile(label="Conversion Rate", value="3.2%", comparison="vs avg: 2.8%")
    ])
    
    # Add custom section
    builder.add_section(
        Section(
            title="Traffic Analysis",
            status="healthy",  # healthy, watch, action_needed
            content="<p>Custom HTML content here</p>"
        )
    )
    
    # Generate HTML
    html = builder.generate()

Author: Mark Laufhutte
Version: 1.0.0
Date: 2026-01-26
"""

from typing import List, Dict, Optional, Literal
from datetime import datetime
import base64


# Venterra logo as base64 data URI (from PIB v1.9)
VENTERRA_LOGO_BASE64 = "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"


class StatusTag:
    """Status tag types for section headers"""
    HEALTHY = "healthy"
    WATCH = "watch"
    ACTION_NEEDED = "action_needed"
    
    @staticmethod
    def get_style(status: str) -> Dict[str, str]:
        """Get CSS styles for status badge"""
        styles = {
            "healthy": {"background": "#28a745", "color": "#ffffff"},
            "watch": {"background": "#ffc107", "color": "#1a1a1a"},
            "action_needed": {"background": "#dc3545", "color": "#ffffff"}
        }
        return styles.get(status, styles["healthy"])
    
    @staticmethod
    def get_label(status: str) -> str:
        """Get display label for status"""
        labels = {
            "healthy": "Healthy",
            "watch": "Watch",
            "action_needed": "Action Needed"
        }
        return labels.get(status, "Healthy")


class KPITile:
    """Data class for KPI tile component"""
    
    def __init__(
        self,
        label: str,
        value: str,
        sublabel: Optional[str] = None,
        trend: Optional[str] = None,
        comparison: Optional[str] = None,
        percentile: Optional[str] = None,
        is_primary: bool = False,
        grade: Optional[str] = None,  # For letter grades like "A+", "F"
        grade_label: Optional[str] = None,  # Like "Excellent", "Poor"
        trend_inverse: bool = False  # True if lower values are better (e.g. LCP, CLS)
    ):
        self.label = label
        self.value = value
        self.sublabel = sublabel
        self.trend = trend
        self.comparison = comparison
        self.percentile = percentile
        self.is_primary = is_primary
        self.grade = grade
        self.grade_label = grade_label
        self.trend_inverse = trend_inverse
        
    def to_html(self) -> str:
        """Generate HTML for KPI tile"""
        # Determine color based on trend/comparison
        value_color = "#1a1a1a"  # Default
        if self.grade:
            # Color based on grade
            if self.grade.startswith("A"):
                value_color = "#28a745"
            elif self.grade.startswith("F"):
                value_color = "#dc3545"
            elif self.grade.startswith("D"):
                value_color = "#ffc107"
        elif self.trend:
            if "+" in self.trend:
                value_color = "#28a745"
            elif "-" in self.trend:
                value_color = "#dc3545"
        
        # Determine comparison color
        comparison_color = "#868e96"
        if self.comparison:
            if "vs" in self.comparison.lower():
                # Parse comparison to determine color
                if any(word in self.comparison.lower() for word in ["below", "worse", "lower"]):
                    comparison_color = "#dc3545"
                elif any(word in self.comparison.lower() for word in ["above", "better", "higher"]):
                    comparison_color = "#28a745"
        
        # Border style
        border_style = "2px solid #0066cc" if self.is_primary else "1px solid #e9ecef"
        bg_color = "#f8f9ff" if self.is_primary else "white"
        label_color = "#0066cc" if self.is_primary else "#868e96"
        
        # Build HTML
        html = f'''
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; background: {bg_color}; border: {border_style}; border-radius: 6px;">
                <tr>
                    <td style="padding: 20px; text-align: center;">
                        <div style="font-size: 11px; color: {label_color}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; font-weight: 600;">{self.label}</div>
        '''
        
        if self.grade:
            # Letter grade display
            html += f'''<div style="font-size: 48px; font-weight: 700; color: {value_color}; margin: 8px 0; line-height: 1;">{self.grade}</div>'''
            if self.grade_label:
                html += f'''<div style="font-size: 13px; color: {value_color}; margin-top: 8px; font-weight: 600;">{self.grade_label}</div>'''
        else:
            # Numeric value display
            html += f'''<div style="font-size: 36px; font-weight: 700; color: {value_color}; margin: 8px 0; line-height: 1;">{self.value}</div>'''
        
        if self.trend:
            # Determine trend color
            if self.trend_inverse:
                # For inverse metrics (lower is better): down arrow = green, up = red
                trend_color = "#28a745" if "↓" in self.trend else "#dc3545"
            else:
                # For normal metrics (higher is better): up arrow = green, down = red
                trend_color = "#28a745" if "↑" in self.trend else "#dc3545"
            html += f'''<div style="font-size: 14px; color: {trend_color}; margin-top: 6px; font-weight: 600;">{self.trend}</div>'''
        
        if self.sublabel:
            html += f'''<div style="font-size: 11px; color: #868e96; margin-top: 8px; font-style: italic;">{self.sublabel}</div>'''
        
        if self.comparison:
            html += f'''<div style="font-size: 13px; margin-top: 10px; font-weight: 600; color: {comparison_color};">{self.comparison}</div>'''
        
        if self.percentile:
            html += f'''<div style="font-size: 11px; color: #868e96; margin-top: 8px; font-style: italic;">{self.percentile}</div>'''
        
        html += '''
                    </td>
                </tr>
            </table>
        '''
        
        return html


class Section:
    """Data class for report section with header and content"""
    
    def __init__(
        self,
        title: str,
        content: str,
        status: Literal["healthy", "watch", "action_needed"] = "healthy",
        description: Optional[str] = None
    ):
        self.title = title
        self.content = content
        self.status = status
        self.description = description
        
    def to_html(self) -> str:
        """Generate HTML for section"""
        status_style = StatusTag.get_style(self.status)
        status_label = StatusTag.get_label(self.status)
        
        html = f'''
        <!-- Section Header -->
        <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin: 40px 0 0 0;">
            <tr>
                <td style="background: #15284B; padding: 15px 20px; border-radius: 6px 6px 0 0;">
                    <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                        <tr>
                            <td style="vertical-align: middle;">
                                <h2 style="font-size: 18px; color: #ffffff; margin: 0; font-weight: 600;">{self.title}</h2>
                            </td>
                            <td style="vertical-align: middle; text-align: right; white-space: nowrap;">
                                <span style="background: {status_style["background"]}; color: {status_style["color"]}; padding: 6px 14px; border-radius: 4px; font-size: 12px; font-weight: 600; display: inline-block;">{status_label}</span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        '''
        
        if self.description:
            html += f'''
            <tr>
                <td style="background: #f8f9fa; padding: 12px 20px; border-radius: 0 0 6px 6px; margin-bottom: 20px;">
                    <p style="font-size: 13px; color: #6c757d; margin: 0; font-style: italic;">{self.description}</p>
                </td>
            </tr>
            '''
        
        html += '''
        </table>
        
        <!-- Section Content -->
        '''
        html += self.content
        
        return html


class ReportBuilder:
    """Main report builder class"""
    
    def __init__(
        self,
        title: str,
        subtitle: Optional[str] = None,
        version: str = "1.0.0",
        date_range: Optional[str] = None
    ):
        self.title = title
        self.subtitle = subtitle
        self.version = version
        self.date_range = date_range or datetime.now().strftime("%m/%d/%Y")
        self.sections = []
        self.top_kpi_tiles = []
        
    def add_kpi_tiles(self, tiles: List[KPITile], columns: int = 3) -> 'ReportBuilder':
        """Add row of KPI tiles to top of report"""
        self.top_kpi_tiles.append((tiles, columns))
        return self
        
    def add_section(self, section: Section) -> 'ReportBuilder':
        """Add a section to the report"""
        self.sections.append(section)
        return self
        
    def generate(self) -> str:
        """Generate complete HTML report"""
        
        # Start HTML document
        html = f'''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{self.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f5f5f5;">
    <table cellpadding="0" cellspacing="0" border="0" style="max-width: 720px; width: 100%; margin: 0 auto; background-color: #ffffff; padding: 30px 40px 40px 40px; border-radius: 8px;">
        <tr>
            <td>
                <!-- Venterra Logo -->
        <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin: 0 0 20px 0; text-align: center;">
            <tr>
                <td style="padding: 0; text-align: center;">
                    <img src="data:image/png;base64,{VENTERRA_LOGO_BASE64}" alt="Venterra" style="height: 15px; width: auto; display: inline-block; border: 0;">
                </td>
            </tr>
        </table>
        
                <!-- Header -->
                <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e9ecef; padding-bottom: 20px;">
                    <tr>
                        <td>
        '''
        
        html += f'''
                            <div style="font-size: 32px; color: #495057; margin: 10px 0; font-weight: 700;">{self.title}</div>
        '''
        
        if self.subtitle:
            html += f'''<div style="font-size: 16px; color: #0066cc; margin: 10px 0 15px 0; font-weight: 600; letter-spacing: 0.3px; text-transform: uppercase;">{self.subtitle}</div>'''
        
        html += f'''
                            <div style="font-size: 11px; color: #adb5bd; margin: 10px 0;">v{self.version}</div>
                        </td>
                    </tr>
                </table>
        '''
        
        # Add KPI tiles
        for tiles, columns in self.top_kpi_tiles:
            html += self._generate_kpi_row(tiles, columns)
        
        # Add sections
        for section in self.sections:
            html += section.to_html()
        
        # Close HTML
        html += '''
            </td>
        </tr>
    </table>
</body>
</html>
'''
        
        return html
    
    def _generate_kpi_row(self, tiles: List[KPITile], columns: int) -> str:
        """Generate HTML for a row of KPI tiles"""
        # Calculate column width
        gap_pct = 2
        col_width = (100 - (gap_pct * (columns - 1))) // columns
        
        html = '''
                <!-- KPI Tiles -->
                <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin: 25px 0;">
                    <tr>
        '''
        
        for i, tile in enumerate(tiles):
            html += f'''
                        <td style="width: {col_width}%; vertical-align: top;">
                            {tile.to_html()}
                        </td>
            '''
            
            # Add gap between tiles (but not after last one)
            if i < len(tiles) - 1:
                html += f'''<td style="width: {gap_pct}%;"></td>'''
        
        html += '''
                    </tr>
                </table>
        '''
        
        return html
    
    def save(self, filepath: str) -> str:
        """Generate and save HTML report to file"""
        html = self.generate()
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html)
        return filepath


# Helper functions for common patterns

def create_side_by_side_layout(left_content: str, right_content: str, gap_pct: int = 4) -> str:
    """Create side-by-side layout (like Mobile/Desktop PageSpeed)"""
    col_width = (100 - gap_pct) // 2
    
    return f'''
    <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin: 0 0 25px 0;">
        <tr>
            <td style="width: {col_width}%; vertical-align: top; background: #f8f9fa; padding: 20px; border-radius: 6px;">
                {left_content}
            </td>
            <td style="width: {gap_pct}%;"></td>
            <td style="width: {col_width}%; vertical-align: top; background: #f8f9fa; padding: 20px; border-radius: 6px;">
                {right_content}
            </td>
        </tr>
    </table>
    '''


def create_data_table(headers: List[str], rows: List[List[str]]) -> str:
    """Create styled data table"""
    html = '''
    <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin: 15px 0;">
        <thead>
            <tr>
    '''
    
    for header in headers:
        html += f'''
                <th style="text-align: left; padding: 12px; background: #f8f9fa; border-bottom: 2px solid #dee2e6; font-size: 12px; color: #6c757d; font-weight: 600; text-transform: uppercase;">{header}</th>
        '''
    
    html += '''
            </tr>
        </thead>
        <tbody>
    '''
    
    for row in rows:
        html += '<tr>'
        for cell in row:
            html += f'''
                <td style="padding: 12px; border-bottom: 1px solid #e9ecef; font-size: 13px; color: #495057;">{cell}</td>
            '''
        html += '</tr>'
    
    html += '''
        </tbody>
    </table>
    '''
    
    return html


def create_metric_card(label: str, value: str, emoji: str = "", goal: str = "") -> str:
    """Create single metric display card"""
    goal_text = f' <span style="font-size: 11px; color: #868e96;">(Goal: {goal})</span>' if goal else ""
    
    return f'''
    <div style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
        <div style="font-size: 13px; color: #495057; margin-bottom: 2px;">{emoji} <strong>{label}:</strong> {value}{goal_text}</div>
    </div>
    '''


if __name__ == "__main__":
    # Example usage
    print("Report Builder v1.0.0 - Ready for ad-hoc report generation")
    print("\nImport this module to create custom reports:")
    print("  from utils.report_builder import ReportBuilder, KPITile, Section")
