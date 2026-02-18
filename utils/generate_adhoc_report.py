#!/usr/bin/env python3
"""
Ad-Hoc Report Generator CLI
============================

Command-line tool for generating custom styled reports on-the-fly.
Uses PIB v1.9 styling framework.

Usage:
    # From Python dict/JSON
    python3 generate_adhoc_report.py --data report_data.json --output report.html
    
    # From example template
    python3 generate_adhoc_report.py --example traffic_summary --output report.html

Author: Mark Laufhutte
Version: 1.0.0
Date: 2026-01-26
"""

import argparse
import json
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.report_builder import (
    ReportBuilder, 
    KPITile, 
    Section,
    create_side_by_side_layout,
    create_data_table,
    create_metric_card
)


def load_data_from_json(filepath: str) -> dict:
    """Load report data from JSON file"""
    with open(filepath, 'r') as f:
        return json.load(f)


def build_report_from_data(data: dict) -> ReportBuilder:
    """Build report from structured data dict"""
    
    # Create builder with metadata
    builder = ReportBuilder(
        title=data.get('title', 'Ad-Hoc Report'),
        subtitle=data.get('subtitle'),
        version=data.get('version', '1.0.0'),
        date_range=data.get('date_range')
    )
    
    # Add KPI tiles (single row or multiple rows)
    if 'kpi_rows' in data:
        for row in data['kpi_rows']:
            tiles = []
            for tile_data in row.get('tiles', []):
                tiles.append(KPITile(
                    label=tile_data['label'],
                    value=tile_data['value'],
                    sublabel=tile_data.get('sublabel'),
                    trend=tile_data.get('trend'),
                    comparison=tile_data.get('comparison'),
                    percentile=tile_data.get('percentile'),
                    is_primary=tile_data.get('is_primary', False),
                    grade=tile_data.get('grade'),
                    grade_label=tile_data.get('grade_label')
                ))
            builder.add_kpi_tiles(tiles, columns=row.get('columns', 3))
    elif 'kpi_tiles' in data:
        tiles = []
        for tile_data in data['kpi_tiles']:
            tiles.append(KPITile(
                label=tile_data['label'],
                value=tile_data['value'],
                sublabel=tile_data.get('sublabel'),
                trend=tile_data.get('trend'),
                comparison=tile_data.get('comparison'),
                percentile=tile_data.get('percentile'),
                is_primary=tile_data.get('is_primary', False),
                grade=tile_data.get('grade'),
                grade_label=tile_data.get('grade_label')
            ))
        builder.add_kpi_tiles(tiles, columns=data.get('kpi_columns', 3))
    
    # Add sections if present
    if 'sections' in data:
        for section_data in data['sections']:
            builder.add_section(Section(
                title=section_data['title'],
                content=section_data['content'],
                status=section_data.get('status', 'healthy'),
                description=section_data.get('description')
            ))
    
    return builder


def generate_example_report(example_name: str) -> ReportBuilder:
    """Generate example reports to demonstrate capabilities"""
    
    if example_name == "traffic_summary":
        # Example: Traffic Summary Report
        builder = ReportBuilder(
            title="Weekly Traffic Summary",
            subtitle="Performance Analysis",
            version="1.0.0",
            date_range="01/19/2026 to 01/26/2026"
        )
        
        # Add KPI tiles
        builder.add_kpi_tiles([
            KPITile(
                label="Total Sessions",
                value="12,456",
                trend="+15.3%",
                comparison="vs prior week: 10,811",
                is_primary=True
            ),
            KPITile(
                label="Conversion Rate",
                value="3.2%",
                trend="+0.4%",
                comparison="Portfolio avg: 2.8%",
                percentile="72nd percentile"
            ),
            KPITile(
                label="Avg Position",
                value="18.4",
                trend="-2.1",
                sublabel="Lower is better",
                comparison="vs portfolio: 22.9"
            )
        ], columns=3)
        
        # Add traffic analysis section
        traffic_table = create_data_table(
            headers=["Source", "Sessions", "Change", "% Total"],
            rows=[
                ["Organic Search", "5,234", "+18%", "42%"],
                ["Direct", "3,456", "+12%", "28%"],
                ["Paid Search", "2,123", "+8%", "17%"],
                ["Social", "1,643", "+22%", "13%"]
            ]
        )
        
        builder.add_section(Section(
            title="Traffic Sources",
            status="healthy",
            description="Channel-level traffic breakdown showing week-over-week growth",
            content=f'''
                <p style="font-size: 15px; color: #495057; margin-bottom: 15px;">
                    All traffic channels showed positive growth this week, with Social leading at +22%.
                </p>
                {traffic_table}
            '''
        ))
        
        return builder
    
    elif example_name == "comparison":
        # Example: Side-by-side comparison report
        builder = ReportBuilder(
            title="Property Comparison",
            subtitle="Performance Benchmarking",
            version="1.0.0"
        )
        
        builder.add_kpi_tiles([
            KPITile(
                label="Property A",
                value="A+",
                grade="A+",
                grade_label="Excellent"
            ),
            KPITile(
                label="Property B",
                value="B",
                grade="B",
                grade_label="Good"
            ),
            KPITile(
                label="Property C",
                value="C",
                grade="C",
                grade_label="Fair"
            )
        ], columns=3)
        
        # Create side-by-side comparison
        left_content = '''
            <div style="text-align: center; margin-bottom: 15px;">
                <div style="font-size: 12px; color: #6c757d; margin-bottom: 8px;">Property A</div>
                <div style="font-size: 32px; font-weight: 700; color: #28a745;">8,456</div>
                <div style="font-size: 12px; color: #6c757d; margin-top: 5px;">Sessions</div>
            </div>
        '''
        
        left_content += create_metric_card("Conversion Rate", "4.2%", "📈", ">3.0%")
        left_content += create_metric_card("Avg Position", "12.3", "🔍", "<15.0")
        
        right_content = '''
            <div style="text-align: center; margin-bottom: 15px;">
                <div style="font-size: 12px; color: #6c757d; margin-bottom: 8px;">Property B</div>
                <div style="font-size: 32px; font-weight: 700; color: #ffc107;">6,234</div>
                <div style="font-size: 12px; color: #6c757d; margin-top: 5px;">Sessions</div>
            </div>
        '''
        
        right_content += create_metric_card("Conversion Rate", "2.8%", "📊", ">3.0%")
        right_content += create_metric_card("Avg Position", "19.7", "🔍", "<15.0")
        
        comparison_html = create_side_by_side_layout(left_content, right_content)
        
        builder.add_section(Section(
            title="Side-by-Side Metrics",
            status="watch",
            description="Detailed performance comparison across key metrics",
            content=comparison_html
        ))
        
        return builder
    
    elif example_name == "dashboard":
        # Example: Executive dashboard
        builder = ReportBuilder(
            title="Executive Dashboard",
            subtitle="Portfolio Overview",
            version="1.0.0"
        )
        
        builder.add_kpi_tiles([
            KPITile(
                label="Portfolio Sessions",
                value="234,567",
                trend="+8.2%",
                is_primary=True
            ),
            KPITile(
                label="Avg CIR",
                value="3.4%",
                comparison="Target: 3.0%"
            )
        ], columns=2)
        
        # Top performers table
        top_performers = create_data_table(
            headers=["Property", "Sessions", "WoW Change", "Status"],
            rows=[
                ["Property A", "12,456", "+22%", "🟢"],
                ["Property B", "11,234", "+18%", "🟢"],
                ["Property C", "10,987", "+15%", "🟢"],
                ["Property D", "9,876", "-8%", "🔴"],
                ["Property E", "8,765", "-12%", "🔴"]
            ]
        )
        
        builder.add_section(Section(
            title="Top Movers",
            status="healthy",
            description="Properties with largest week-over-week changes",
            content=f'''
                <p style="font-size: 15px; color: #495057; margin-bottom: 15px;">
                    Three properties showed strong growth, while two declined.
                </p>
                {top_performers}
            '''
        ))
        
        return builder
    
    else:
        raise ValueError(f"Unknown example: {example_name}. Available: traffic_summary, comparison, dashboard")


def main():
    parser = argparse.ArgumentParser(
        description='Generate ad-hoc reports with PIB v1.9 styling',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate from JSON data file
  python3 generate_adhoc_report.py --data mydata.json --output report.html
  
  # Generate example report
  python3 generate_adhoc_report.py --example traffic_summary --output traffic.html
  
Available examples:
  - traffic_summary: Weekly traffic analysis with KPI tiles and data table
  - comparison: Side-by-side property comparison with grades
  - dashboard: Executive dashboard with top movers table
        """
    )
    
    parser.add_argument(
        '--data',
        type=str,
        help='Path to JSON file with report data'
    )
    
    parser.add_argument(
        '--example',
        type=str,
        choices=['traffic_summary', 'comparison', 'dashboard'],
        help='Generate example report (traffic_summary, comparison, or dashboard)'
    )
    
    parser.add_argument(
        '--output',
        type=str,
        required=True,
        help='Output HTML file path'
    )
    
    args = parser.parse_args()
    
    # Validate input
    if not args.data and not args.example:
        parser.error("Must provide either --data or --example")
    
    if args.data and args.example:
        parser.error("Cannot use both --data and --example")
    
    try:
        # Build report
        if args.data:
            print(f"Loading data from: {args.data}")
            data = load_data_from_json(args.data)
            builder = build_report_from_data(data)
        else:
            print(f"Generating example: {args.example}")
            builder = generate_example_report(args.example)
        
        # Generate and save HTML
        print(f"Generating report...")
        builder.save(args.output)
        print(f"✓ Report saved to: {args.output}")
        
        # Print size info
        file_size = Path(args.output).stat().st_size
        print(f"  File size: {file_size:,} bytes")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
