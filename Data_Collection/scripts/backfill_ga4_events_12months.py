#!/usr/bin/env python3
"""
GA4 Historical Event Backfill Script
=====================================
Backfills 12 months of GA4 event data to establish historical baseline.

This script safely fills gaps in the ga4_event_facts table without disrupting
the daily collection system. It checks for existing data and only collects
missing date ranges.

Purpose: Establish 12-month baseline for Heap launch comparison
Target Tables: ga4_event_facts, ga4_daily_metrics
Date Range: Last 12 months from today

Usage:
    # Backfill all properties (recommended - run overnight)
    python3 backfill_ga4_events_12months.py
    
    # Test with single property first
    python3 backfill_ga4_events_12months.py --property 445473253
    
    # Test with 3 properties
    python3 backfill_ga4_events_12months.py --test
    
    # Dry run (check what would be collected)
    python3 backfill_ga4_events_12months.py --dry-run
    
Options:
    --property ID     Backfill single property only
    --test            Test mode - only 3 properties
    --dry-run         Show what would be collected without writing to DB
    --start-date      Custom start date (YYYY-MM-DD, default: 12 months ago)
    --end-date        Custom end date (YYYY-MM-DD, default: yesterday)
"""

import sys
import os
import json
import argparse
import sqlite3
import time
from datetime import datetime, timedelta, date
from pathlib import Path
from collections import defaultdict

# Add paths
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from google.analytics.data_v1beta import BetaAnalyticsDataClient, RunReportRequest, DateRange, Metric, Dimension, Filter, FilterExpression
from google.oauth2 import service_account


class GA4HistoricalBackfill:
    """Backfills historical GA4 event data for baseline analysis."""
    
    def __init__(self, start_date=None, end_date=None, test_mode=False, 
                 dry_run=False, single_property_id=None):
        self.test_mode = test_mode
        self.dry_run = dry_run
        self.single_property_id = single_property_id
        self.start_time = datetime.now()
        
        # Date range
        self.end_date = end_date or (date.today() - timedelta(days=1))
        self.start_date = start_date or (self.end_date - timedelta(days=365))
        
        # Paths
        self.base_dir = Path(__file__).parent.parent.parent
        self.registry_path = self.base_dir / 'config' / 'venterra_properties_official.json'
        self.ga4_creds_path = Path('/Users/mark/Spotlight_Properties_Report/config/venterra-property-analytics-8e67b1bcc684.json')
        self.db_path = self.base_dir / 'data' / 'portfolio_analytics.db'
        
        # Results tracking
        self.results = {
            'properties_processed': 0,
            'properties_skipped': 0,
            'properties_failed': 0,
            'total_days_collected': 0,
            'total_events_inserted': 0,
            'gaps_filled': 0,
            'errors': []
        }
        
        # API rate limiting
        self.api_calls = 0
        self.api_calls_limit = 25000  # GA4 API limit per day
        
        print('=' * 80)
        print('📊 GA4 HISTORICAL EVENT BACKFILL')
        print('=' * 80)
        print(f'⏰ Started: {self.start_time.strftime("%Y-%m-%d %H:%M:%S")}')
        print(f'📅 Date Range: {self.start_date} to {self.end_date} ({(self.end_date - self.start_date).days + 1} days)')
        if self.test_mode:
            print('🧪 TEST MODE: Processing only 3 properties')
        if self.dry_run:
            print('🔍 DRY RUN: No data will be written to database')
        if self.single_property_id:
            print(f'🎯 SINGLE PROPERTY MODE: {self.single_property_id}')
        print()
    
    def load_properties(self):
        """Load property registry."""
        print('📋 Loading property registry...')
        
        with open(self.registry_path) as f:
            data = json.load(f)
            properties = data['properties']
        
        # Filter to properties with GA4 IDs
        ga4_properties = [p for p in properties if p.get('ga4_property_id')]
        
        # Filter by single property if specified
        if self.single_property_id:
            ga4_properties = [p for p in ga4_properties 
                            if p.get('ga4_property_id') == self.single_property_id]
            if not ga4_properties:
                print(f'❌ Property ID {self.single_property_id} not found in registry')
                sys.exit(1)
        
        # Test mode
        if self.test_mode:
            ga4_properties = ga4_properties[:3]
            print(f'✅ Loaded {len(ga4_properties)} test properties')
        else:
            print(f'✅ Loaded {len(ga4_properties)} properties with GA4 IDs')
        
        return ga4_properties
    
    def initialize_collectors(self):
        """Initialize GA4 client and database."""
        print('🔧 Initializing collectors...')
        
        # GA4
        print('  GA4 Analytics...', end=' ')
        sys.stdout.flush()
        credentials = service_account.Credentials.from_service_account_file(str(self.ga4_creds_path))
        self.ga4_client = BetaAnalyticsDataClient(credentials=credentials)
        print('✅')
        
        # Database
        if not self.dry_run:
            print('  Database Connection...', end=' ')
            sys.stdout.flush()
            self.db_conn = sqlite3.connect(str(self.db_path))
            self.db_conn.row_factory = sqlite3.Row
            print('✅')
        
        print()
    
    def get_existing_dates(self, property_id):
        """Check which dates already have data for this property."""
        if self.dry_run:
            return set()
        
        cursor = self.db_conn.cursor()
        cursor.execute("""
            SELECT DISTINCT event_date 
            FROM ga4_event_facts
            WHERE property_id = ?
                AND event_date BETWEEN ? AND ?
        """, (property_id, str(self.start_date), str(self.end_date)))
        
        existing = {row['event_date'] for row in cursor.fetchall()}
        return existing
    
    def identify_gaps(self, property_id):
        """Identify date gaps that need backfilling."""
        existing_dates = self.get_existing_dates(property_id)
        
        # Generate all dates in range
        all_dates = set()
        current = self.start_date
        while current <= self.end_date:
            all_dates.add(str(current))
            current += timedelta(days=1)
        
        # Find gaps
        missing_dates = sorted(all_dates - existing_dates)
        
        return missing_dates
    
    def backfill_property(self, prop):
        """Backfill historical data for a single property."""
        prop_name = prop.get('name') or prop.get('property_name')
        ga4_id = prop['ga4_property_id']
        
        print(f'  Property: {prop_name} (GA4: {ga4_id})')
        
        # Check for gaps
        missing_dates = self.identify_gaps(ga4_id)
        
        if not missing_dates:
            print(f'    ✅ No gaps - all dates from {self.start_date} to {self.end_date} already collected')
            self.results['properties_skipped'] += 1
            return
        
        print(f'    📊 Found {len(missing_dates)} days to backfill')
        
        if self.dry_run:
            print(f'    🔍 DRY RUN: Would collect {len(missing_dates)} days')
            print(f'       First missing: {missing_dates[0]}, Last missing: {missing_dates[-1]}')
            self.results['properties_skipped'] += 1
            self.results['gaps_filled'] += len(missing_dates)
            return
        
        # Group missing dates into continuous ranges to minimize API calls
        date_ranges = []
        range_start = None
        range_end = None
        
        for date_str in missing_dates:
            current_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            
            if range_start is None:
                range_start = current_date
                range_end = current_date
            elif (current_date - range_end).days == 1:
                range_end = current_date
            else:
                date_ranges.append((range_start, range_end))
                range_start = current_date
                range_end = current_date
        
        if range_start is not None:
            date_ranges.append((range_start, range_end))
        
        print(f'    📦 Collecting {len(date_ranges)} date range(s)')
        
        days_collected = 0
        events_inserted = 0
        
        try:
            for range_idx, (range_start, range_end) in enumerate(date_ranges, 1):
                days_in_range = (range_end - range_start).days + 1
                print(f'       Range {range_idx}/{len(date_ranges)}: {range_start} to {range_end} ({days_in_range} days)')
                
                # Check API rate limit
                if self.api_calls >= self.api_calls_limit:
                    print(f'    ⚠️  API rate limit approaching ({self.api_calls}/{self.api_calls_limit}), stopping for safety')
                    break
                
                # Query GA4 for this date range
                # We need: event counts by date and event name
                request = RunReportRequest(
                    property=f"properties/{ga4_id}",
                    date_ranges=[DateRange(
                        start_date=range_start.strftime('%Y-%m-%d'),
                        end_date=range_end.strftime('%Y-%m-%d')
                    )],
                    dimensions=[
                        Dimension(name="date"),
                        Dimension(name="eventName")
                    ],
                    metrics=[
                        Metric(name="eventCount")
                    ],
                    # Filter to key events only (reduce API overhead)
                    dimension_filter=FilterExpression(
                        filter=Filter(
                            field_name="eventName",
                            in_list_filter={
                                "values": [
                                    "session_start",
                                    "page_view",
                                    "form_start",
                                    "pricequote_click",
                                    "scheduletour_click",
                                    "phonecall",
                                    "applyonline_click",
                                    "form_submit",
                                    # Resi events
                                    "resi_price_quote",
                                    "resi_phone_click",
                                    "resi_application_start",
                                    "resi_get_directions",
                                    "resi_residence_pdf_download",
                                    "resi_apt_tour_click",
                                    "resi_3d_tour_view",
                                    "lease_magnet_submission"
                                ]
                            }
                        )
                    )
                )
                
                response = self.ga4_client.run_report(request)
                self.api_calls += 1
                
                if not response.rows:
                    print(f'          ⚠️  No data returned')
                    continue
                
                # Process and insert events
                cursor = self.db_conn.cursor()
                events_this_range = 0
                
                for row in response.rows:
                    date_str = row.dimension_values[0].value  # YYYYMMDD
                    event_date = f"{date_str[0:4]}-{date_str[4:6]}-{date_str[6:8]}"
                    event_name = row.dimension_values[1].value
                    event_count = int(row.metric_values[0].value or 0)
                    
                    if event_count > 0:
                        # Insert into ga4_event_facts
                        event_timestamp = int(datetime.strptime(event_date, '%Y-%m-%d').timestamp() * 1000000)
                        
                        cursor.execute("""
                            INSERT OR REPLACE INTO ga4_event_facts (
                                property_id,
                                property_name,
                                event_name,
                                event_date,
                                event_timestamp,
                                event_count,
                                collected_at
                            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        """, (
                            ga4_id,
                            prop_name,
                            event_name,
                            event_date,
                            event_timestamp,
                            event_count
                        ))
                        
                        events_this_range += 1
                
                self.db_conn.commit()
                events_inserted += events_this_range
                days_collected += days_in_range
                
                print(f'          ✅ {events_this_range} events inserted')
                
                # Rate limiting: sleep briefly between API calls
                time.sleep(0.1)
            
            print(f'    ✅ Backfilled {days_collected} days, {events_inserted} events inserted')
            self.results['properties_processed'] += 1
            self.results['total_days_collected'] += days_collected
            self.results['total_events_inserted'] += events_inserted
            self.results['gaps_filled'] += len(missing_dates)
            
        except Exception as e:
            error_msg = f"Failed to backfill {prop_name}: {str(e)}"
            print(f'    ❌ {error_msg}')
            self.results['properties_failed'] += 1
            self.results['errors'].append(error_msg)
    
    def run(self):
        """Run the backfill."""
        # Load properties
        properties = self.load_properties()
        
        if not properties:
            print('❌ No properties to backfill')
            return
        
        # Initialize
        self.initialize_collectors()
        
        # Backfill each property
        print('=' * 80)
        print(f'📊 BACKFILLING {len(properties)} PROPERTIES')
        print('=' * 80)
        print()
        
        for i, prop in enumerate(properties, 1):
            print(f'{i}/{len(properties)}.')
            self.backfill_property(prop)
            print()
            
            # Check API rate limit
            if self.api_calls >= self.api_calls_limit * 0.9:
                print(f'⚠️  Approaching API rate limit ({self.api_calls}/{self.api_calls_limit})')
                print('   Stopping backfill for safety. Run again tomorrow to continue.')
                break
        
        # Close database
        if not self.dry_run:
            self.db_conn.close()
        
        # Summary
        end_time = datetime.now()
        duration = (end_time - self.start_time).total_seconds()
        
        print('=' * 80)
        print('📊 BACKFILL SUMMARY')
        print('=' * 80)
        print(f'✅ Properties Processed: {self.results["properties_processed"]}')
        print(f'⏭️  Properties Skipped (no gaps): {self.results["properties_skipped"]}')
        print(f'❌ Properties Failed: {self.results["properties_failed"]}')
        print(f'📅 Total Days Backfilled: {self.results["total_days_collected"]:,}')
        print(f'📊 Total Events Inserted: {self.results["total_events_inserted"]:,}')
        print(f'🔧 Gaps Filled: {self.results["gaps_filled"]:,} days')
        print(f'🌐 API Calls Made: {self.api_calls:,}')
        print(f'⏱️  Duration: {duration:.1f} seconds ({duration/60:.1f} minutes)')
        print()
        
        if self.results['errors']:
            print('ERRORS:')
            for error in self.results['errors']:
                print(f'  - {error}')
            print()
        
        if self.dry_run:
            print('🔍 DRY RUN COMPLETE - No data was written to database')
        else:
            print('✅ Backfill complete')
        
        # Recommendations
        if self.api_calls >= self.api_calls_limit * 0.9:
            print()
            print('⚠️  RECOMMENDATION: API rate limit approaching')
            print('   Wait 24 hours before running again to avoid quota exhaustion')


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Backfill 12 months of GA4 event data for baseline analysis'
    )
    parser.add_argument(
        '--property',
        type=str,
        help='Backfill single property ID only'
    )
    parser.add_argument(
        '--test',
        action='store_true',
        help='Test mode - process only 3 properties'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Dry run - show what would be collected without writing to DB'
    )
    parser.add_argument(
        '--start-date',
        type=str,
        help='Custom start date (YYYY-MM-DD, default: 12 months ago)'
    )
    parser.add_argument(
        '--end-date',
        type=str,
        help='Custom end date (YYYY-MM-DD, default: yesterday)'
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
    
    # Run backfill
    backfill = GA4HistoricalBackfill(
        start_date=start_date,
        end_date=end_date,
        test_mode=args.test,
        dry_run=args.dry_run,
        single_property_id=args.property
    )
    
    backfill.run()


if __name__ == '__main__':
    main()
