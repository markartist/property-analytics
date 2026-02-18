#!/usr/bin/env python3
"""
GA Historical Baseline Report Generator
========================================
Generates comprehensive 12-month baseline report for Heap launch comparison.

Features:
- Legacy sites only (excludes RESI sites)
- New Users metrics only
- 5 CTA types: Schedule Tour, Apply, Price Quote, Click to Call, Form Submit
- Engagement metrics
- UTM attribution analysis
- Property-level + Portfolio aggregation
- Excel output with 2 sheets

Usage:
    python3 generate_ga_baseline_report.py
    python3 generate_ga_baseline_report.py --start-date 2025-02-09 --end-date 2026-02-09
    python3 generate_ga_baseline_report.py --output-dir /path/to/output

Output:
    GA_Historical_Baseline_Report_YYYY-MM-DD.xlsx
    - Sheet 1: Property-Level Metrics
    - Sheet 2: Portfolio Summary
"""

import sys
import json
import sqlite3
import argparse
from datetime import datetime, timedelta, date
from pathlib import Path
import pandas as pd

# Add paths
sys.path.insert(0, str(Path(__file__).parent.parent.parent))


class GABaselineReportGenerator:
    """Generates GA Historical Baseline Report for legacy sites."""
    
    def __init__(self, start_date=None, end_date=None, output_dir=None):
        self.start_time = datetime.now()
        
        # Date range (default: 12 months)
        self.end_date = end_date or (date.today() - timedelta(days=1))
        self.start_date = start_date or (self.end_date - timedelta(days=365))
        
        # Paths
        self.base_dir = Path(__file__).parent.parent.parent
        self.registry_path = self.base_dir / 'config' / 'venterra_properties_official.json'
        self.db_path = self.base_dir / 'data' / 'portfolio_analytics.db'
        self.output_dir = Path(output_dir) if output_dir else self.base_dir / 'reports'
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Load registry to identify RESI sites
        with open(self.registry_path) as f:
            data = json.load(f)
            self.resi_property_ids = set(
                p['ga4_property_id'] 
                for p in data['properties'] 
                if p.get('site_type') == 'resi' and p.get('ga4_property_id')
            )
        
        print('=' * 80)
        print('📊 GA HISTORICAL BASELINE REPORT GENERATOR')
        print('=' * 80)
        print(f'⏰ Started: {self.start_time.strftime("%Y-%m-%d %H:%M:%S")}')
        print(f'📅 Date Range: {self.start_date} to {self.end_date}')
        print(f'🚫 Excluding {len(self.resi_property_ids)} RESI sites')
        print()
    
    def connect_db(self):
        """Connect to database."""
        print('🔧 Connecting to database...')
        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row
        print('✅ Connected\n')
    
    def get_property_list(self):
        """Get list of legacy properties (excluding RESI)."""
        print('📋 Loading property list...')
        
        # Get all properties with event data in the date range
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT DISTINCT 
                property_id,
                property_name
            FROM ga4_event_facts
            WHERE event_date BETWEEN ? AND ?
            ORDER BY property_name
        """, (str(self.start_date), str(self.end_date)))
        
        all_properties = [dict(row) for row in cursor.fetchall()]
        
        # Filter out RESI sites
        legacy_properties = [
            p for p in all_properties 
            if p['property_id'] not in self.resi_property_ids
        ]
        
        print(f'✅ Found {len(all_properties)} total properties')
        print(f'✅ Filtered to {len(legacy_properties)} legacy properties')
        print()
        
        return legacy_properties
    
    def calculate_property_metrics(self, property_id, property_name):
        """Calculate all baseline metrics for a single property."""
        cursor = self.conn.cursor()
        
        metrics = {
            'Property Name': property_name,
            'Property ID': property_id
        }
        
        # CTA Click Metrics (total counts over period)
        # Schedule a Tour
        cursor.execute("""
            SELECT SUM(event_count) as total
            FROM ga4_event_facts
            WHERE property_id = ?
              AND event_name = 'scheduletour_click'
              AND event_date BETWEEN ? AND ?
        """, (property_id, str(self.start_date), str(self.end_date)))
        metrics['Schedule Tour CTA Clicks'] = cursor.fetchone()['total'] or 0
        
        # Apply Online
        cursor.execute("""
            SELECT SUM(event_count) as total
            FROM ga4_event_facts
            WHERE property_id = ?
              AND event_name = 'applyonline_click'
              AND event_date BETWEEN ? AND ?
        """, (property_id, str(self.start_date), str(self.end_date)))
        metrics['Apply CTA Clicks'] = cursor.fetchone()['total'] or 0
        
        # Price Quote
        cursor.execute("""
            SELECT SUM(event_count) as total
            FROM ga4_event_facts
            WHERE property_id = ?
              AND event_name = 'pricequote_click'
              AND event_date BETWEEN ? AND ?
        """, (property_id, str(self.start_date), str(self.end_date)))
        metrics['Price Quote CTA Clicks'] = cursor.fetchone()['total'] or 0
        
        # Click to Call
        cursor.execute("""
            SELECT SUM(event_count) as total
            FROM ga4_event_facts
            WHERE property_id = ?
              AND event_name = 'phonecall'
              AND event_date BETWEEN ? AND ?
        """, (property_id, str(self.start_date), str(self.end_date)))
        metrics['Click to Call CTA Clicks'] = cursor.fetchone()['total'] or 0
        
        # Form Submit
        cursor.execute("""
            SELECT SUM(event_count) as total
            FROM ga4_event_facts
            WHERE property_id = ?
              AND event_name = 'form_submit'
              AND event_date BETWEEN ? AND ?
        """, (property_id, str(self.start_date), str(self.end_date)))
        metrics['Submit Form CTA Clicks'] = cursor.fetchone()['total'] or 0
        
        # Session/User metrics from ga4_daily_metrics
        cursor.execute("""
            SELECT 
                SUM(new_users) as total_new_users,
                SUM(sessions) as total_sessions,
                AVG(engagement_rate) as avg_engagement_rate
            FROM ga4_daily_metrics
            WHERE property_id = ?
              AND metric_date BETWEEN ? AND ?
        """, (property_id, str(self.start_date), str(self.end_date)))
        
        row = cursor.fetchone()
        metrics['New Users Total'] = row['total_new_users'] or 0
        metrics['Total Sessions'] = row['total_sessions'] or 0
        metrics['Avg Engagement Rate'] = round(row['avg_engagement_rate'] or 0, 4)
        
        # Calculate per-new-user rates
        new_users = metrics['New Users Total']
        if new_users > 0:
            metrics['Schedule Tour Rate per New User'] = round(metrics['Schedule Tour CTA Clicks'] / new_users, 4)
            metrics['Apply Rate per New User'] = round(metrics['Apply CTA Clicks'] / new_users, 4)
            metrics['Price Quote Rate per New User'] = round(metrics['Price Quote CTA Clicks'] / new_users, 4)
            metrics['Click to Call Rate per New User'] = round(metrics['Click to Call CTA Clicks'] / new_users, 4)
            metrics['Submit Form Rate per New User'] = round(metrics['Submit Form CTA Clicks'] / new_users, 4)
        else:
            metrics['Schedule Tour Rate per New User'] = 0
            metrics['Apply Rate per New User'] = 0
            metrics['Price Quote Rate per New User'] = 0
            metrics['Click to Call Rate per New User'] = 0
            metrics['Submit Form Rate per New User'] = 0
        
        return metrics
    
    def generate_property_level_report(self, properties):
        """Generate property-level metrics sheet."""
        print('📊 Generating property-level metrics...')
        
        property_data = []
        for i, prop in enumerate(properties, 1):
            if i % 10 == 0:
                print(f'   Processing {i}/{len(properties)} properties...')
            
            metrics = self.calculate_property_metrics(
                prop['property_id'],
                prop['property_name']
            )
            property_data.append(metrics)
        
        df = pd.DataFrame(property_data)
        
        print(f'✅ Completed {len(property_data)} properties')
        print()
        
        return df
    
    def generate_portfolio_summary(self, property_df):
        """Generate portfolio summary sheet."""
        print('📊 Generating portfolio summary...')
        
        # Aggregate metrics
        summary_data = []
        
        # Column groups
        count_columns = [
            'New Users Total',
            'Total Sessions',
            'Schedule Tour CTA Clicks',
            'Apply CTA Clicks',
            'Price Quote CTA Clicks',
            'Click to Call CTA Clicks',
            'Submit Form CTA Clicks'
        ]
        
        rate_columns = [
            'Avg Engagement Rate',
            'Schedule Tour Rate per New User',
            'Apply Rate per New User',
            'Price Quote Rate per New User',
            'Click to Call Rate per New User',
            'Submit Form Rate per New User'
        ]
        
        for col in count_columns:
            summary_data.append({
                'Metric': col,
                'Portfolio Total': property_df[col].sum(),
                'Portfolio Average': round(property_df[col].mean(), 2),
                'Portfolio Median': round(property_df[col].median(), 2),
                'Properties with Data': (property_df[col] > 0).sum()
            })
        
        for col in rate_columns:
            summary_data.append({
                'Metric': col,
                'Portfolio Total': '-',
                'Portfolio Average': round(property_df[col].mean(), 4),
                'Portfolio Median': round(property_df[col].median(), 4),
                'Properties with Data': (property_df[col] > 0).sum()
            })
        
        summary_df = pd.DataFrame(summary_data)
        
        print('✅ Portfolio summary complete')
        print()
        
        return summary_df
    
    def save_to_excel(self, property_df, summary_df):
        """Save both sheets to Excel file."""
        print('💾 Saving to Excel...')
        
        # Generate filename
        filename = f"GA_Historical_Baseline_Report_{self.start_date}_to_{self.end_date}.xlsx"
        filepath = self.output_dir / filename
        
        # Create Excel writer
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            # Sheet 1: Property-Level Metrics
            property_df.to_excel(
                writer,
                sheet_name='Property-Level Metrics',
                index=False
            )
            
            # Sheet 2: Portfolio Summary
            summary_df.to_excel(
                writer,
                sheet_name='Portfolio Summary',
                index=False
            )
        
        print(f'✅ Saved to: {filepath}')
        print()
        
        return filepath
    
    def run(self):
        """Generate the baseline report."""
        # Connect to database
        self.connect_db()
        
        # Get property list (legacy only)
        properties = self.get_property_list()
        
        if not properties:
            print('❌ No properties found')
            return
        
        # Generate property-level metrics
        property_df = self.generate_property_level_report(properties)
        
        # Generate portfolio summary
        summary_df = self.generate_portfolio_summary(property_df)
        
        # Save to Excel
        filepath = self.save_to_excel(property_df, summary_df)
        
        # Close database
        self.conn.close()
        
        # Summary
        end_time = datetime.now()
        duration = (end_time - self.start_time).total_seconds()
        
        print('=' * 80)
        print('📊 REPORT GENERATION SUMMARY')
        print('=' * 80)
        print(f'✅ Properties Analyzed: {len(properties)}')
        print(f'📅 Date Range: {self.start_date} to {self.end_date}')
        print(f'📁 Output File: {filepath}')
        print(f'⏱️  Duration: {duration:.1f} seconds')
        print()
        print('✅ Report generation complete')
        print()
        print('Next Steps:')
        print('  1. Open the Excel file to review property-level and portfolio metrics')
        print('  2. Use "Portfolio Summary" sheet for Heap comparison baseline')
        print('  3. Archive this report as pre-Heap baseline documentation')


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Generate GA Historical Baseline Report for Heap launch comparison'
    )
    parser.add_argument(
        '--start-date',
        type=str,
        help='Start date (YYYY-MM-DD, default: 12 months ago)'
    )
    parser.add_argument(
        '--end-date',
        type=str,
        help='End date (YYYY-MM-DD, default: yesterday)'
    )
    parser.add_argument(
        '--output-dir',
        type=str,
        help='Output directory for Excel file (default: reports/)'
    )
    
    return parser.parse_args()


def main():
    """Main entry point."""
    args = parse_args()
    
    # Parse dates
    start_date = None
    end_date = None
    
    if args.start_date:
        try:
            start_date = datetime.strptime(args.start_date, '%Y-%m-%d').date()
        except ValueError:
            print(f'❌ Invalid start date format: {args.start_date} (use YYYY-MM-DD)')
            sys.exit(1)
    
    if args.end_date:
        try:
            end_date = datetime.strptime(args.end_date, '%Y-%m-%d').date()
        except ValueError:
            print(f'❌ Invalid end date format: {args.end_date} (use YYYY-MM-DD)')
            sys.exit(1)
    
    # Generate report
    generator = GABaselineReportGenerator(
        start_date=start_date,
        end_date=end_date,
        output_dir=args.output_dir
    )
    
    generator.run()


if __name__ == '__main__':
    main()
