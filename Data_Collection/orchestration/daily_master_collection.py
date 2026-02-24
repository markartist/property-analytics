#!/usr/bin/env python3
"""
Unified Portfolio Daily Data Collection
========================================
Collects GA4 and GSC data for all Venterra properties and stores in SQLite database.

Part of the unified Data_Collection system.

Usage:
    python3 daily_master_collection.py [--test] [--quick]
    
Options:
    --test     Run in test mode (only 3 properties)
    --quick    Quick mode - GA4 + GSC only (skip SEMRush/GTMetrix for daily runs)
"""

import sys
import os
import json
import time
import sqlite3
import traceback
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

# Add Data_Collection to path for clean imports
_data_collection_root = str(Path(__file__).parent.parent.parent)
sys.path.insert(0, _data_collection_root)

# Clean imports from unified Data_Collection structure
from Data_Collection.db.database_manager import DatabaseManager
from Data_Collection.monitoring.collection_monitor import CollectionMonitor, CollectionAlerter
from Data_Collection.monitoring.credential_monitor import CredentialMonitor
from Data_Collection.monitoring.anomaly_detector import AnomalyDetector
from Data_Collection.utils.preflight import validate_preflight, record_job_run
from Data_Collection.collectors.gbp_collector import GoogleBusinessProfileCollector
from Data_Collection.collectors.gsc_collector import GoogleSearchConsoleCollector
from Data_Collection.collectors.guest_card_collector import GuestCardCollector
from Data_Collection.monitoring.alert_sender import DataAlertEmailer

# Preflight validation
validate_preflight(__file__)

# Google API imports
from google.analytics.data_v1beta import BetaAnalyticsDataClient, RunReportRequest, DateRange, Metric, Dimension
from google.oauth2 import service_account
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
import pickle


class PortfolioDataCollector:
    """Orchestrates daily data collection for all portfolio properties"""
    
    def __init__(self, test_mode=False, quick_mode=False, no_gtmetrix=False):
        self.test_mode = test_mode
        self.quick_mode = quick_mode
        self.no_gtmetrix = no_gtmetrix
        self.start_time = datetime.now()
        
        # Paths
        self.base_dir = Path(__file__).parent.parent.parent  # Property_Analytics root
        self.registry_path = self.base_dir / 'config' / 'venterra_properties_official.json'
        self.ga4_creds_path = Path('/Users/mark/Spotlight_Properties_Report/config/venterra-property-analytics-8e67b1bcc684.json')
        # CANONICAL DATABASE - single source of truth for all collectors
        self.db_path = Path('/Users/mark/Property_Analytics/data/portfolio_analytics.db')
        
        # GSC credentials paths - SEPARATE for main properties vs Cendana
        self.main_gsc_creds_path = self.base_dir / 'credentials' / 'client_secret.json'
        self.main_gsc_token_path = self.base_dir / 'credentials' / 'gsc_token_main.pickle'
        
        # Results tracking
        self.results = {
            'ga4': {'success': 0, 'failed': 0, 'skipped': 0},
            'gsc': {'success': 0, 'failed': 0, 'skipped': 0},
            'google_ads': {'success': 0, 'failed': 0, 'skipped': 0},
            'psi': {'success': 0, 'failed': 0, 'skipped': 0},
            'semrush': {'success': 0, 'failed': 0, 'skipped': 0},
            'gtmetrix': {'success': 0, 'failed': 0, 'skipped': 0},
            'gbp_reviews': {'success': 0, 'failed': 0, 'skipped': 0},
            'gbp_insights': {'success': 0, 'failed': 0, 'skipped': 0},
            'guest_card': {'success': 0, 'failed': 0, 'skipped': 0},
            'd1_mirror': {'success': 0, 'failed': 0, 'skipped': 0},
            'errors': []
        }
        
        # Collection monitors (initialized in run method)
        self.monitors = {}
        
        # Credential monitor
        self.credential_monitor = None
        
        # Anomaly detector
        self.anomaly_detector = None
        
        # Credential warnings from pre-flight check
        self.credential_warnings = []
        
        print('=' * 80)
        print('📊 PORTFOLIO DAILY DATA COLLECTION')
        print('=' * 80)
        print(f'⏰ Started: {self.start_time.strftime("%Y-%m-%d %H:%M:%S")}')
        if self.test_mode:
            print('🧪 TEST MODE: Collecting only 3 properties')
        if self.quick_mode:
            print('⚡ QUICK MODE: GA4 + GSC only (daily collection)')
        print()
        
    def _initialize_main_gsc_service(self):
        """Initialize GSC service with main Venterra credentials (not Cendana)"""
        try:
            creds = None
            # In unattended launchd runs we must never trigger browser-based OAuth.
            interactive_oauth_allowed = (
                os.getenv('DISABLE_INTERACTIVE_OAUTH', '').lower() not in ('1', 'true', 'yes')
                and sys.stdin.isatty()
                and sys.stdout.isatty()
            )
            
            # Check if we have a saved token
            if self.main_gsc_token_path.exists():
                try:
                    with open(self.main_gsc_token_path, 'rb') as token:
                        creds = pickle.load(token)
                except Exception as e:
                    print(f'\n   ⚠️  Error loading saved token: {e}')
            
            # If there are no valid credentials, get new ones
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    try:
                        creds.refresh(Request())
                        print('\n   🔄 Refreshed OAuth token')
                    except Exception as e:
                        print(f'\n   ⚠️  Error refreshing token: {e}')
                        creds = None
                
                if not creds:
                    if not self.main_gsc_creds_path.exists():
                        print(f'\n   ❌ GSC credentials not found at {self.main_gsc_creds_path}')
                        return None

                    if not interactive_oauth_allowed:
                        print('\n   ❌ Interactive OAuth disabled (non-interactive runtime).')
                        print('   ❌ GSC token could not be refreshed automatically; skipping GSC initialization.')
                        return None

                    try:
                        print('\n   🔐 Starting OAuth authentication for main GSC access...')
                        flow = InstalledAppFlow.from_client_secrets_file(
                            str(self.main_gsc_creds_path),
                            ['https://www.googleapis.com/auth/webmasters.readonly']
                        )
                        creds = flow.run_local_server(port=0)
                        print('   ✅ OAuth authentication completed')
                    except Exception as e:
                        print(f'   ❌ OAuth flow failed: {e}')
                        return None
                
                # Save the credentials for the next run
                try:
                    with open(self.main_gsc_token_path, 'wb') as token:
                        pickle.dump(creds, token)
                    print('   💾 OAuth token saved')
                except Exception as e:
                    print(f'   ⚠️  Error saving token: {e}')
            
            # Build GSC service
            service = build('searchconsole', 'v1', credentials=creds)
            return service
            
        except Exception as e:
            print(f'\n   ❌ Failed to initialize GSC service: {e}')
            return None
    
    def load_properties(self):
        """Load property registry"""
        print('📋 Loading property registry...')
        
        with open(self.registry_path) as f:
            data = json.load(f)
            properties = data['properties']
        
        if self.test_mode:
            # Get first 3 with GA4 IDs
            test_props = [p for p in properties if p.get('ga4_property_id')][:3]
            print(f'✅ Loaded {len(test_props)} test properties')
            return test_props
        else:
            print(f'✅ Loaded {len(properties)} properties')
            return properties
    
    def initialize_collectors(self):
        """Initialize GA4 and GSC collectors"""
        print('\n🔧 Initializing data collectors...')
        
        # Credential Monitor - Run pre-flight checks FIRST
        print('  Credential Monitor (Pre-Flight Check)...', end=' ')
        sys.stdout.flush()
        self.credential_monitor = CredentialMonitor(
            ga4_creds_path=self.ga4_creds_path,
            gsc_token_path=self.main_gsc_token_path
        )
        ready, warnings = self.credential_monitor.pre_flight_check()
        if not ready:
            print('❌')
            print('\n⚠️  PRE-FLIGHT CHECK FAILED - credentials not ready')
            raise RuntimeError('Credential pre-flight check failed. Cannot proceed with collection.')
        elif warnings:
            print('⚠️')
            self.credential_warnings = warnings
        else:
            print('✅')
        
        # GA4
        print('  GA4 Analytics...', end=' ')
        sys.stdout.flush()
        credentials = service_account.Credentials.from_service_account_file(str(self.ga4_creds_path))
        self.ga4_client = BetaAnalyticsDataClient(credentials=credentials)
        print('✅')
        
        # GSC - Initialize with main Venterra credentials
        print('  Google Search Console (Main)...', end=' ')
        sys.stdout.flush()
        self.gsc_service = self._initialize_main_gsc_service()
        if self.gsc_service:
            print('✅')
        else:
            print('⚠️  Failed to initialize')
        
        # Database
        print('  Database Manager...', end=' ')
        sys.stdout.flush()
        self.db = DatabaseManager(self.db_path)
        print('✅')
        
        # Anomaly Detector
        print('  Anomaly Detector...', end=' ')
        sys.stdout.flush()
        self.anomaly_detector = AnomalyDetector(self.db)
        print('✅')
        
        # SEMRush
        print('  SEMRush API...', end=' ')
        sys.stdout.flush()
        semrush_key_path = self.base_dir / 'Spotlight_Properties_Report' / 'config' / 'semrush_api_key.txt'
        with open(semrush_key_path) as f:
            self.semrush_api_key = f.read().strip()
        print('✅')
        
        # GTMetrix
        print('  GTMetrix API...', end=' ')
        sys.stdout.flush()
        gtmetrix_key_path = self.base_dir / 'Spotlight_Properties_Report' / 'config' / 'GTMetrix_API_Key.txt'
        with open(gtmetrix_key_path) as f:
            self.gtmetrix_api_key = f.read().strip()
        print('✅')
        
        # GBP Collector
        print('  GBP Reviews Collector...', end=' ')
        sys.stdout.flush()
        try:
            sys.path.insert(0, str(Path(__file__).parent / 'src' / 'collectors'))
            from gbp_collector import GoogleBusinessProfileCollector
            gbp_creds_path = self.base_dir / 'Portfolio_Monitoring' / 'credentials' / 'client_secret_gbp.json'
            gbp_token_path = self.base_dir / 'Portfolio_Monitoring' / 'credentials' / 'gbp_token.pickle'
            self.gbp_collector = GoogleBusinessProfileCollector(gbp_creds_path, gbp_token_path)
            print('✅')
        except Exception as e:
            print(f'⚠️  {str(e)[:50]}')
            self.gbp_collector = None
        
        print()
    
    def collect_ga4_data(self, properties):
        """Collect GA4 data for all properties"""
        print('=' * 80)
        print('📊 COLLECTING GA4 ANALYTICS DATA')
        print('=' * 80)
        print()
        
        # Date ranges - collect last 30 days to match GSC and provide full month of data
        end_date = datetime.now() - timedelta(days=1)
        start_date = end_date - timedelta(days=29)  # 30 days total
        
        print(f'📅 Date range: {start_date.strftime("%Y-%m-%d")} to {end_date.strftime("%Y-%m-%d")} (30 days with daily breakdown)')
        print()
        
        # Filter properties with GA4 IDs
        ga4_properties = [p for p in properties if p.get('ga4_property_id')]
        
        print(f'Properties with GA4 IDs: {len(ga4_properties)}/{len(properties)}')
        print()
        
        for i, prop in enumerate(ga4_properties, 1):
            prop_name = prop['name']
            ga4_id = prop['ga4_property_id']
            
            print(f'{i}/{len(ga4_properties)}. {prop_name} (GA4: {ga4_id})')
            sys.stdout.flush()
            
            try:
                request = RunReportRequest(
                    property=f"properties/{ga4_id}",
                    dimensions=[Dimension(name="date")],  # CRITICAL: Get data broken down by date
                    date_ranges=[DateRange(
                        start_date=start_date.strftime('%Y-%m-%d'),
                        end_date=end_date.strftime('%Y-%m-%d')
                    )],
                    metrics=[
                        Metric(name="sessions"),
                        Metric(name="engagedSessions"),
                        Metric(name="totalUsers"),
                        Metric(name="screenPageViews"),
                        Metric(name="averageSessionDuration"),
                        Metric(name="bounceRate")
                    ]
                )
                
                response = self.ga4_client.run_report(request)
                
                if response.rows:
                    # Process each day separately
                    days_collected = 0
                    for row in response.rows:
                        # Get the date from dimension value (format: YYYYMMDD)
                        date_str = row.dimension_values[0].value
                        formatted_date = f"{date_str[0:4]}-{date_str[4:6]}-{date_str[6:8]}"
                        
                        sessions = int(row.metric_values[0].value)
                        engaged = int(row.metric_values[1].value)
                        users = int(row.metric_values[2].value)
                        pageviews = int(row.metric_values[3].value)
                        avg_session_duration = float(row.metric_values[4].value)
                        bounce_rate = float(row.metric_values[5].value)
                        
                        # Store in database with actual date
                        self.db.insert_ga4_daily_metrics(
                            property_id=ga4_id,
                            metric_date=formatted_date,
                            data={
                                'sessions': sessions,
                                'engaged_sessions': engaged,
                                'total_users': users,
                                'pageviews': pageviews,
                                'avg_session_duration': avg_session_duration,
                                'bounce_rate': bounce_rate
                            }
                        )
                        days_collected += 1
                    
                    # SECOND REQUEST: Get traffic source breakdown (Organic Search, Direct, etc.)
                    traffic_request = RunReportRequest(
                        property=f"properties/{ga4_id}",
                        dimensions=[
                            Dimension(name="date"),
                            Dimension(name="sessionDefaultChannelGrouping")
                        ],
                        date_ranges=[DateRange(
                            start_date=start_date.strftime('%Y-%m-%d'),
                            end_date=end_date.strftime('%Y-%m-%d')
                        )],
                        metrics=[
                            Metric(name="sessions"),
                            Metric(name="engagedSessions"),
                            Metric(name="conversions"),
                            Metric(name="engagementRate"),
                            Metric(name="bounceRate")
                        ]
                    )
                    
                    traffic_response = self.ga4_client.run_report(traffic_request)
                    
                    if traffic_response.rows:
                        for row in traffic_response.rows:
                            date_str = row.dimension_values[0].value
                            formatted_date = f"{date_str[0:4]}-{date_str[4:6]}-{date_str[6:8]}"
                            channel = row.dimension_values[1].value
                            
                            traffic_sessions = int(row.metric_values[0].value)
                            traffic_engaged = int(row.metric_values[1].value)
                            traffic_conversions = int(row.metric_values[2].value)
                            traffic_engagement_rate = float(row.metric_values[3].value)
                            traffic_bounce_rate = float(row.metric_values[4].value)
                            
                            # Store traffic source data
                            self.db.insert_ga4_traffic_source(
                                property_id=ga4_id,
                                metric_date=formatted_date,
                                channel_group=channel,
                                data={
                                    'sessions': traffic_sessions,
                                    'engaged_sessions': traffic_engaged,
                                    'conversions': traffic_conversions,
                                    'engagement_rate': traffic_engagement_rate,
                                    'bounce_rate': traffic_bounce_rate
                                }
                            )
                    
                    # THIRD REQUEST: Get device breakdown (mobile, desktop, tablet)
                    device_request = RunReportRequest(
                        property=f"properties/{ga4_id}",
                        dimensions=[
                            Dimension(name="date"),
                            Dimension(name="deviceCategory")
                        ],
                        date_ranges=[DateRange(
                            start_date=start_date.strftime('%Y-%m-%d'),
                            end_date=end_date.strftime('%Y-%m-%d')
                        )],
                        metrics=[
                            Metric(name="sessions"),
                            Metric(name="engagedSessions"),
                            Metric(name="conversions"),
                            Metric(name="engagementRate"),
                            Metric(name="bounceRate")
                        ]
                    )
                    
                    device_response = self.ga4_client.run_report(device_request)
                    
                    if device_response.rows:
                        for row in device_response.rows:
                            date_str = row.dimension_values[0].value
                            formatted_date = f"{date_str[0:4]}-{date_str[4:6]}-{date_str[6:8]}"
                            device = row.dimension_values[1].value
                            
                            device_sessions = int(row.metric_values[0].value)
                            device_engaged = int(row.metric_values[1].value)
                            device_conversions = int(row.metric_values[2].value)
                            device_engagement_rate = float(row.metric_values[3].value)
                            device_bounce_rate = float(row.metric_values[4].value)
                            
                            # Store device data
                            self.db.insert_ga4_device_metrics(
                                property_id=ga4_id,
                                metric_date=formatted_date,
                                device_category=device,
                                data={
                                    'sessions': device_sessions,
                                    'engaged_sessions': device_engaged,
                                    'conversions': device_conversions,
                                    'engagement_rate': device_engagement_rate,
                                    'bounce_rate': device_bounce_rate
                                }
                            )
                    
                    print(f'   ✅ Collected {days_collected} days + traffic + devices')
                    self.results['ga4']['success'] += 1
                else:
                    print(f'   ⚠️  No data')
                    self.results['ga4']['skipped'] += 1
                    
            except Exception as e:
                error_msg = str(e)[:100]
                print(f'   ❌ Error: {error_msg}')
                self.results['ga4']['failed'] += 1
                self.results['errors'].append({
                    'property': prop_name,
                    'collector': 'GA4',
                    'error': error_msg
                })
            
            # Small delay to avoid rate limits
            time.sleep(0.1)
        
        print()
        print(f'GA4 Summary: ✅ {self.results["ga4"]["success"]} | ⚠️  {self.results["ga4"]["skipped"]} | ❌ {self.results["ga4"]["failed"]}')
        print()
    
    def _collect_gsc_queries(self, prop, gsc_url, start_date, end_date):
        """Collect query-level data for a single property (30-day window)"""
        try:
            ga4_id = prop.get('ga4_property_id', '')
            
            # Request query-level data with date dimension
            # GSC API limit is 25,000 rows per request
            response = self.gsc_service.searchanalytics().query(
                siteUrl=gsc_url,
                body={
                    'startDate': start_date.strftime('%Y-%m-%d'),
                    'endDate': end_date.strftime('%Y-%m-%d'),
                    'dimensions': ['date', 'query'],
                    'rowLimit': 5000  # 30 days * ~150 queries = ~4500 rows typical
                }
            ).execute()
            
            rows = response.get('rows', [])
            
            if not rows:
                return 0
            
            queries_inserted = 0
            
            for row in rows:
                date_str = row['keys'][0]  # First dimension: date
                query = row['keys'][1]     # Second dimension: query
                clicks = row.get('clicks', 0)
                impressions = row.get('impressions', 0)
                ctr = row.get('ctr', 0)
                position = row.get('position', 0)
                
                # Insert into gsc_queries table
                self.db.insert_gsc_query(
                    property_id=ga4_id,  # Using GA4 ID for consistency
                    metric_date=date_str,
                    query=query,
                    clicks=clicks,
                    impressions=impressions,
                    ctr=ctr,
                    position=position,
                    gsc_site_url=gsc_url,
                    ga4_property_id=ga4_id
                )
                queries_inserted += 1
            
            if queries_inserted > 0:
                print(f'      🔑 + {queries_inserted} query records')
            
            return queries_inserted
            
        except Exception as e:
            # Don't fail the whole collection if queries fail
            print(f'      ⚠️  Query collection failed: {str(e)[:80]}')
            return 0
    
    def collect_gsc_data(self, properties):
        """Collect GSC data for all properties (excluding Cendana)"""
        print('=' * 80)
        print('🔍 COLLECTING GOOGLE SEARCH CONSOLE DATA')
        print('=' * 80)
        print()
        
        # Date ranges (GSC has 3-day delay confirmed)
        # Collect 30 days for both daily metrics and queries to match PIB default window
        end_date = datetime.now() - timedelta(days=3)
        start_date = end_date - timedelta(days=29)  # 30 days total
        
        print(f'📅 Date range: {start_date.strftime("%Y-%m-%d")} to {end_date.strftime("%Y-%m-%d")} (30 days for daily metrics + queries)')
        print()
        
        # Filter properties with GSC access, EXCLUDING Cendana (collected separately)
        gsc_properties = [p for p in properties 
                         if p.get('gsc_access') and p['gsc_access'] != 'none'
                         and p['name'] != 'Cendana District West']
        
        print(f'Properties with GSC access: {len(gsc_properties)}/{len(properties)}')
        print()
        
        for i, prop in enumerate(gsc_properties, 1):
            prop_name = prop['name']
            gsc_url = prop['gsc_url']
            
            print(f'{i}/{len(gsc_properties)}. {prop_name}')
            sys.stdout.flush()
            
            try:
                if not self.gsc_service:
                    print(f'   ⚠️  GSC service not available')
                    self.results['gsc']['skipped'] += 1
                    continue
                
                response = self.gsc_service.searchanalytics().query(
                    siteUrl=gsc_url,
                    body={
                        'startDate': start_date.strftime('%Y-%m-%d'),
                        'endDate': end_date.strftime('%Y-%m-%d'),
                        'dimensions': ['date']
                    }
                ).execute()
                
                rows = response.get('rows', [])
                
                if rows:
                    # Process each day separately
                    days_collected = 0
                    for row in rows:
                        # Get date from keys (format: YYYY-MM-DD)
                        date_str = row.get('keys', [''])[0]
                        clicks = row.get('clicks', 0)
                        impressions = row.get('impressions', 0)
                        ctr = row.get('ctr', 0) * 100  # Convert to percentage
                        position = row.get('position', 0)
                        
                        # Store in database with actual date
                        self.db.insert_gsc_daily_metrics(
                            property_id=gsc_url,
                            metric_date=date_str,
                            data={
                                'clicks': clicks,
                                'impressions': impressions,
                                'ctr': ctr,
                                'position': position
                            }
                        )
                        days_collected += 1
                    
                    print(f'   ✅ Collected {days_collected} days')
                    self.results['gsc']['success'] += 1
                    
                    # Also collect query-level data for this property (same 30-day window)
                    self._collect_gsc_queries(prop, gsc_url, start_date, end_date)
                else:
                    print(f'   ⚠️  No data')
                    self.results['gsc']['skipped'] += 1
                    
            except Exception as e:
                error_msg = str(e)[:100]
                print(f'   ❌ Error: {error_msg}')
                self.results['gsc']['failed'] += 1
                self.results['errors'].append({
                    'property': prop_name,
                    'collector': 'GSC',
                    'error': error_msg
                })
            
            # Delay to avoid rate limits
            time.sleep(0.5)
        
        print()
        print(f'GSC Summary (Main): ✅ {self.results["gsc"]["success"]} | ⚠️  {self.results["gsc"]["skipped"]} | ❌ {self.results["gsc"]["failed"]}')
        print()
    
    def collect_cendana_gsc_data(self, properties):
        """Collect GSC data for Cendana District West with dedicated credentials"""
        print('=' * 80)
        print('🔍 COLLECTING GSC DATA - CENDANA (Separate Credentials)')
        print('=' * 80)
        print()
        
        # Find Cendana property
        cendana_prop = None
        for p in properties:
            if p['name'] == 'Cendana District West':
                cendana_prop = p
                break
        
        if not cendana_prop:
            print('⚠️  Cendana District West not found in registry')
            print()
            return
        
        # Date ranges (GSC has 3-day delay)
        end_date = datetime.now() - timedelta(days=3)
        start_date = end_date - timedelta(days=13)  # 14 days total
        
        print(f'📅 Date range: {start_date.strftime("%Y-%m-%d")} to {end_date.strftime("%Y-%m-%d")} (14 days with daily breakdown)')
        print()
        
        try:
            # Initialize Cendana-specific GSC collector with separate credentials
            # The existing gsc_token.pickle in Spotlight_Properties_Report/config is for Cendana
            print('🔧 Initializing Cendana GSC collector...')
            from collectors.gsc_collector import GoogleSearchConsoleCollector
            cendana_gsc_collector = GoogleSearchConsoleCollector(cache_hours=0)
            
            if not cendana_gsc_collector.service:
                print('   ❌ Failed to initialize Cendana GSC service')
                self.results['gsc']['failed'] += 1
                return
            
            print('   ✅ Cendana GSC service initialized')
            print()
            
            # Collect data for Cendana
            gsc_url = cendana_prop['gsc_url']
            prop_name = cendana_prop['name']
            ga4_id = cendana_prop.get('ga4_property_id', '')
            
            print(f'1/1. {prop_name}')
            print(f'     GSC URL: {gsc_url}')
            sys.stdout.flush()
            
            response = cendana_gsc_collector.service.searchanalytics().query(
                siteUrl=gsc_url,
                body={
                    'startDate': start_date.strftime('%Y-%m-%d'),
                    'endDate': end_date.strftime('%Y-%m-%d'),
                    'dimensions': ['date']
                }
            ).execute()
            
            rows = response.get('rows', [])
            
            if rows:
                # Process each day separately
                days_collected = 0
                for row in rows:
                    # Get date from keys (format: YYYY-MM-DD)
                    date_str = row.get('keys', [''])[0]
                    clicks = row.get('clicks', 0)
                    impressions = row.get('impressions', 0)
                    ctr = row.get('ctr', 0) * 100  # Convert to percentage
                    position = row.get('position', 0)
                    
                    # Store in database with actual date
                    self.db.insert_gsc_daily_metrics(
                        property_id=gsc_url,
                        metric_date=date_str,
                        data={
                            'clicks': clicks,
                            'impressions': impressions,
                            'ctr': ctr,
                            'position': position
                        }
                    )
                    days_collected += 1
                
                print(f'   ✅ Collected {days_collected} days')
                self.results['gsc']['success'] += 1
            else:
                print(f'   ⚠️  No data')
                self.results['gsc']['skipped'] += 1
        
        except Exception as e:
            error_msg = str(e)[:100]
            print(f'   ❌ Error: {error_msg}')
            self.results['gsc']['failed'] += 1
            self.results['errors'].append({
                'property': 'Cendana District West',
                'collector': 'GSC',
                'error': error_msg
            })
        
        print()
        print(f'GSC Summary (Cendana): ✅ {self.results["gsc"]["success"]} total')
        print()
    
    def collect_semrush_data(self, properties):
        """Collect SEMRush data for all properties"""
        print('=' * 80)
        print('📈 COLLECTING SEMRUSH DATA')
        print('=' * 80)
        print()
        
        import requests
        
        print(f'Properties to check: {len(properties)}')
        print()
        
        for i, prop in enumerate(properties, 1):
            prop_name = prop['name']
            domain = prop['domain']
            full_url = prop['full_url']
            
            print(f'{i}/{len(properties)}. {prop_name} ({domain})')
            sys.stdout.flush()
            
            try:
                # Extract domain for SEMrush (remove https:// and trailing slash)
                semrush_url = full_url.replace('https://', '').replace('http://', '').rstrip('/')
                
                # Get domain organic keywords (matches Spotlight implementation)
                url = 'https://api.semrush.com/'
                params = {
                    'type': 'domain_organic',
                    'key': self.semrush_api_key,
                    'display_limit': 50,
                    'domain': semrush_url,
                    'database': 'us'
                }
                
                response = requests.get(url, params=params, timeout=10)
                
                if response.status_code == 200:
                    lines = response.text.strip().split('\n')
                    if len(lines) > 1:  # Has data beyond header
                        # Parse keywords and calculate metrics
                        keyword_count = len(lines) - 1
                        top_3 = 0
                        top_10 = 0
                        top_100 = 0
                        total_traffic = 0
                        
                        for line in lines[1:]:  # Skip header
                            fields = line.split(';')
                            if len(fields) >= 5:
                                try:
                                    position = int(fields[1])
                                    traffic = int(fields[4]) if fields[4] else 0
                                    
                                    if position <= 3:
                                        top_3 += 1
                                    if position <= 10:
                                        top_10 += 1
                                    if position <= 100:
                                        top_100 += 1
                                    
                                    total_traffic += traffic
                                except (ValueError, IndexError):
                                    continue
                        
                        # Store in database
                        today = datetime.now().date().isoformat()
                        ga4_id = prop.get('ga4_property_id', domain)
                        
                        self.db.insert_semrush_domain_metrics(
                            property_id=ga4_id,
                            metric_date=today,
                            data={
                                'organic_keywords_count': keyword_count,
                                'organic_keywords_top_3': top_3,
                                'organic_keywords_top_10': top_10,
                                'organic_keywords_top_100': top_100,
                                'organic_traffic_estimate': total_traffic
                            }
                        )
                        
                        print(f'   ✅ Keywords: {keyword_count}, Top 10: {top_10}, Traffic: {total_traffic}')
                        self.results['semrush']['success'] += 1
                    else:
                        print(f'   ⚠️  No data')
                        self.results['semrush']['skipped'] += 1
                else:
                    print(f'   ❌ HTTP {response.status_code}')
                    self.results['semrush']['failed'] += 1
                    
            except Exception as e:
                error_msg = str(e)[:100]
                print(f'   ❌ Error: {error_msg}')
                self.results['semrush']['failed'] += 1
                self.results['errors'].append({
                    'property': prop_name,
                    'collector': 'SEMRush',
                    'error': error_msg
                })
            
            # Rate limit delay
            time.sleep(0.5)
        
        print()
        print(f'SEMRush Summary: ✅ {self.results["semrush"]["success"]} | ⚠️  {self.results["semrush"]["skipped"]} | ❌ {self.results["semrush"]["failed"]}')
        print()
    
    def collect_gtmetrix_data(self, properties):
        """Collect GTMetrix data for all properties"""
        print('=' * 80)
        print('⚡ COLLECTING GTMETRIX PERFORMANCE DATA')
        print('=' * 80)
        print()
        
        import requests
        from requests.auth import HTTPBasicAuth
        
        # Limit to first 10 in test mode, or sample in full mode
        if self.test_mode:
            test_props = properties[:3]
            print(f'🧪 Testing on {len(test_props)} properties')
        else:
            # Sample 20 properties to avoid using all credits
            test_props = properties[::5]  # Every 5th property
            print(f'📊 Sampling {len(test_props)} properties (every 5th)')
        print()
        
        for i, prop in enumerate(test_props, 1):
            prop_name = prop['name']
            url = prop['full_url']
            
            print(f'{i}/{len(test_props)}. {prop_name}')
            sys.stdout.flush()
            
            try:
                # Start test with proper format (matches Spotlight implementation)
                response = requests.post(
                    'https://gtmetrix.com/api/2.0/tests',
                    auth=HTTPBasicAuth(self.gtmetrix_api_key, ''),
                    headers={'Content-Type': 'application/vnd.api+json'},
                    json={
                        'data': {
                            'type': 'test',
                            'attributes': {
                                'url': url,
                                'location': '2',  # Vancouver, Canada
                                'browser': '1'    # Chrome Desktop
                            }
                        }
                    },
                    timeout=30
                )
                
                # GTMetrix returns 202 for successful test creation
                if response.status_code == 202:
                    test_id = response.json()['data']['id']
                    
                    # Wait for test to complete (simple poll)
                    for _ in range(12):  # Max 60 seconds
                        time.sleep(5)
                        status_response = requests.get(
                            f'https://gtmetrix.com/api/2.0/tests/{test_id}',
                            auth=HTTPBasicAuth(self.gtmetrix_api_key, ''),
                            timeout=10
                        )
                        
                        if status_response.status_code == 303:
                            # Test completed - get report from Location header
                            report_url = status_response.headers.get('Location')
                            if report_url and not report_url.startswith('http'):
                                report_url = f'https://gtmetrix.com/api/2.0{report_url}'
                            
                            if report_url:
                                report_response = requests.get(
                                    report_url,
                                    auth=HTTPBasicAuth(self.gtmetrix_api_key, ''),
                                    timeout=30
                                )
                                if report_response.status_code == 200:
                                    test_data = report_response.json()['data']
                                    attrs = test_data.get('attributes', {})
                                    perf_score = attrs.get('pagespeed_score', 0)
                                    page_load = attrs.get('onload_time', 0) / 1000
                                    print(f'   ✅ Score: {perf_score:.0f} | Load: {page_load:.2f}s')
                                    self.results['gtmetrix']['success'] += 1
                                    break
                        elif status_response.status_code == 200:
                            # Check if it's the final report (type: "report")
                            test_data = status_response.json().get('data', {})
                            if test_data.get('type') == 'report':
                                attrs = test_data.get('attributes', {})
                                perf_score = attrs.get('pagespeed_score', 0)
                                page_load = attrs.get('onload_time', 0) / 1000
                                print(f'   ✅ Score: {perf_score:.0f} | Load: {page_load:.2f}s')
                                self.results['gtmetrix']['success'] += 1
                                break
                    else:
                        print(f'   ⚠️  Timeout')
                        self.results['gtmetrix']['skipped'] += 1
                else:
                    print(f'   ❌ HTTP {response.status_code}')
                    self.results['gtmetrix']['failed'] += 1
                    
            except Exception as e:
                error_msg = str(e)[:100]
                print(f'   ❌ Error: {error_msg}')
                self.results['gtmetrix']['failed'] += 1
                self.results['errors'].append({
                    'property': prop_name,
                    'collector': 'GTMetrix',
                    'error': error_msg
                })
        
        print()
        print(f'GTMetrix Summary: ✅ {self.results["gtmetrix"]["success"]} | ⚠️  {self.results["gtmetrix"]["skipped"]} | ❌ {self.results["gtmetrix"]["failed"]}')
        print()
    
    def collect_gbp_reviews(self):
        """Collect GBP reviews for all properties with GBP location IDs."""
        print('=' * 80)
        print('⭐ COLLECTING GOOGLE BUSINESS PROFILE REVIEWS')
        print('=' * 80)
        print()
        
        if not self.gbp_collector:
            print('⚠️  GBP collector not initialized - skipping')
            self.results['gbp_reviews']['skipped'] = 1
            print()
            return
        
        # Load property-to-GBP mappings
        mapping_file = self.base_dir / 'Portfolio_Monitoring' / 'data' / 'all_properties_gbp_matched.json'
        
        if not mapping_file.exists():
            print(f'⚠️  GBP mapping file not found: {mapping_file}')
            print('   Run match_all_properties_to_gbp.py first')
            self.results['gbp_reviews']['skipped'] = 1
            print()
            return
        
        try:
            with open(mapping_file) as f:
                mapping_data = json.load(f)
            
            matched_properties = mapping_data.get('matched', [])
            print(f'Properties with GBP locations: {len(matched_properties)}')
            print()
            
            # Process each property
            for i, prop in enumerate(matched_properties, 1):
                prop_name = prop['property_name']
                account_id = prop['account_id']
                location_id = prop['location_id']
                property_id = prop.get('property_id', 'N/A')  # May be N/A if not in DB yet
                
                print(f'{i}/{len(matched_properties)}. {prop_name}')
                sys.stdout.flush()
                
                try:
                    # Fetch reviews using v4 API
                    reviews = self.gbp_collector.fetch_reviews(
                        account_id=account_id,
                        location_id=location_id
                    )
                    
                    if reviews:
                        # Parse and store reviews
                        parsed_reviews = []
                        for review in reviews:
                            parsed = self.gbp_collector.parse_review(review)
                            parsed_reviews.append(parsed)
                        
                        # Store in database (INSERT OR IGNORE handles duplicates)
                        stored_count = self.db.insert_gbp_reviews_batch(
                            reviews=parsed_reviews,
                            property_id=property_id,
                            gbp_location_id=location_id
                        )
                        
                        if stored_count > 0:
                            print(f'   ✅ Found {len(reviews)} reviews, stored {stored_count} new')
                        else:
                            print(f'   ✅ Found {len(reviews)} reviews (all already in DB)')
                        
                        self.results['gbp_reviews']['success'] += 1
                    else:
                        print(f'   ⚠️  No reviews found')
                        self.results['gbp_reviews']['skipped'] += 1
                    
                except Exception as e:
                    error_msg = str(e)[:100]
                    print(f'   ❌ Error: {error_msg}')
                    self.results['gbp_reviews']['failed'] += 1
                    self.results['errors'].append({
                        'property': prop_name,
                        'collector': 'GBP Reviews',
                        'error': error_msg
                    })
                
                # Rate limit delay
                time.sleep(0.3)
            
            print()
            print(f'GBP Reviews Summary: ✅ {self.results["gbp_reviews"]["success"]} | ⚠️  {self.results["gbp_reviews"]["skipped"]} | ❌ {self.results["gbp_reviews"]["failed"]}')
            print()
            
        except Exception as e:
            print(f'❌ Error loading GBP mappings: {e}')
            self.results['gbp_reviews']['failed'] = 1
            print()
    
    def collect_gbp_insights(self):
        """Collect GBP insights (profile views, actions) using Business Profile Performance API."""
        print('=' * 80)
        print('📊 COLLECTING GOOGLE BUSINESS PROFILE INSIGHTS')
        print('=' * 80)
        print()
        
        # Load GBP credentials
        gbp_creds_path = self.base_dir / 'Portfolio_Monitoring' / 'credentials' / 'client_secret_gbp.json'
        gbp_token_path = self.base_dir / 'Portfolio_Monitoring' / 'credentials' / 'gbp_token.pickle'
        
        if not gbp_creds_path.exists() or not gbp_token_path.exists():
            print('⚠️  GBP credentials not found - skipping')
            self.results['gbp_insights']['skipped'] = 1
            print()
            return
        
        # Load token
        try:
            import pickle
            from google.auth.transport.requests import Request, AuthorizedSession
            
            with open(gbp_token_path, 'rb') as token:
                creds = pickle.load(token)
            
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                else:
                    print('⚠️  GBP token expired and cannot refresh - skipping')
                    self.results['gbp_insights']['skipped'] = 1
                    print()
                    return
            
            authed_session = AuthorizedSession(creds)
            print('✅ GBP API authenticated')
            print()
            
        except Exception as e:
            print(f'⚠️  Error authenticating GBP API: {e}')
            self.results['gbp_insights']['skipped'] = 1
            print()
            return
        
        # Load property-to-GBP mappings
        mapping_file = self.base_dir / 'Portfolio_Monitoring' / 'data' / 'all_properties_gbp_matched.json'
        
        if not mapping_file.exists():
            print(f'⚠️  GBP mapping file not found: {mapping_file}')
            self.results['gbp_insights']['skipped'] = 1
            print()
            return
        
        try:
            with open(mapping_file) as f:
                mapping_data = json.load(f)
            
            matched_properties = mapping_data.get('matched', [])
            print(f'Properties with GBP locations: {len(matched_properties)}')
            print()
            
            # Calculate date range (GBP has 2-day lag like GSC)
            from datetime import date, timedelta
            end_date = date.today() - timedelta(days=2)
            start_date = end_date  # Collect only yesterday
            
            print(f'📅 Collecting data for: {start_date}')
            print()
            
            # All core GBP metrics
            all_metrics = [
                # Profile Views (4 metrics)
                "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
                "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
                "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
                "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
                # Customer Actions (5 metrics)
                "WEBSITE_CLICKS",
                "CALL_CLICKS",
                "BUSINESS_DIRECTION_REQUESTS",
                "BUSINESS_FOOD_ORDERS",
                "BUSINESS_FOOD_MENU_CLICKS",
            ]
            
            # Process each property
            for i, prop in enumerate(matched_properties, 1):
                prop_name = prop['property_name']
                account_id = prop['account_id']
                location_id = prop['location_id']
                property_id = prop.get('property_id', 'N/A')
                
                print(f'{i}/{len(matched_properties)}. {prop_name}')
                sys.stdout.flush()
                
                try:
                    # Build API request
                    bpp_url = f"https://businessprofileperformance.googleapis.com/v1/locations/{location_id}:fetchMultiDailyMetricsTimeSeries"
                    
                    params = {}
                    for metric in all_metrics:
                        if 'dailyMetrics' not in params:
                            params['dailyMetrics'] = []
                        params['dailyMetrics'].append(metric)
                    
                    params['dailyRange.startDate.year'] = start_date.year
                    params['dailyRange.startDate.month'] = start_date.month
                    params['dailyRange.startDate.day'] = start_date.day
                    params['dailyRange.endDate.year'] = end_date.year
                    params['dailyRange.endDate.month'] = end_date.month
                    params['dailyRange.endDate.day'] = end_date.day
                    
                    # Make API request
                    response = authed_session.get(bpp_url, params=params, timeout=30)
                    
                    if response.status_code == 200:
                        data = response.json()
                        
                        # Parse metrics
                        metrics = {
                            'maps_views_desktop': 0,
                            'maps_views_mobile': 0,
                            'search_views_desktop': 0,
                            'search_views_mobile': 0,
                            'website_clicks': 0,
                            'phone_calls': 0,
                            'direction_requests': 0,
                            'food_orders': 0,
                            'food_menu_clicks': 0,
                        }
                        
                        multi_series = data.get('multiDailyMetricTimeSeries', [])
                        for series_group in multi_series:
                            daily_series_list = series_group.get('dailyMetricTimeSeries', [])
                            for daily_series in daily_series_list:
                                metric_type = daily_series.get('dailyMetric')
                                time_series = daily_series.get('timeSeries', {})
                                dated_values = time_series.get('datedValues', [])
                                
                                for dv in dated_values:
                                    value = int(dv.get('value', 0)) if dv.get('value') else 0
                                    
                                    # Map metric to schema
                                    if metric_type == "BUSINESS_IMPRESSIONS_DESKTOP_MAPS":
                                        metrics['maps_views_desktop'] += value
                                    elif metric_type == "BUSINESS_IMPRESSIONS_MOBILE_MAPS":
                                        metrics['maps_views_mobile'] += value
                                    elif metric_type == "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH":
                                        metrics['search_views_desktop'] += value
                                    elif metric_type == "BUSINESS_IMPRESSIONS_MOBILE_SEARCH":
                                        metrics['search_views_mobile'] += value
                                    elif metric_type == "WEBSITE_CLICKS":
                                        metrics['website_clicks'] += value
                                    elif metric_type == "CALL_CLICKS":
                                        metrics['phone_calls'] += value
                                    elif metric_type == "BUSINESS_DIRECTION_REQUESTS":
                                        metrics['direction_requests'] += value
                                    elif metric_type == "BUSINESS_FOOD_ORDERS":
                                        metrics['food_orders'] += value
                                    elif metric_type == "BUSINESS_FOOD_MENU_CLICKS":
                                        metrics['food_menu_clicks'] += value
                        
                        # Calculate totals
                        total_views = (metrics['maps_views_desktop'] + metrics['maps_views_mobile'] + 
                                       metrics['search_views_desktop'] + metrics['search_views_mobile'])
                        total_actions = (metrics['website_clicks'] + metrics['phone_calls'] + 
                                         metrics['direction_requests'])
                        action_rate = (total_actions / total_views) if total_views > 0 else 0
                        
                        # Store in database
                        conn = sqlite3.connect(self.db_path)
                        cursor = conn.cursor()
                        
                        cursor.execute("""
                            INSERT OR REPLACE INTO gbp_daily_insights (
                                property_id, gbp_location_id, account_id, metric_date,
                                maps_views_desktop, maps_views_mobile,
                                search_views_desktop, search_views_mobile, total_profile_views,
                                website_clicks, phone_calls, direction_requests, total_actions, action_rate,
                                food_orders, food_menu_clicks,
                                collected_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            property_id,
                            location_id,
                            account_id,
                            str(start_date),
                            metrics['maps_views_desktop'],
                            metrics['maps_views_mobile'],
                            metrics['search_views_desktop'],
                            metrics['search_views_mobile'],
                            total_views,
                            metrics['website_clicks'],
                            metrics['phone_calls'],
                            metrics['direction_requests'],
                            total_actions,
                            action_rate,
                            metrics['food_orders'],
                            metrics['food_menu_clicks'],
                            datetime.now().isoformat()
                        ))
                        
                        conn.commit()
                        conn.close()
                        
                        print(f'   ✅ {total_views} views, {total_actions} actions ({action_rate*100:.1f}%)')
                        self.results['gbp_insights']['success'] += 1
                        
                    elif response.status_code == 403:
                        print(f'   ⚠️  Access denied (check API enabled)')
                        self.results['gbp_insights']['skipped'] += 1
                    else:
                        print(f'   ❌ API error {response.status_code}')
                        self.results['gbp_insights']['failed'] += 1
                    
                except Exception as e:
                    error_msg = str(e)[:100]
                    print(f'   ❌ Error: {error_msg}')
                    self.results['gbp_insights']['failed'] += 1
                    self.results['errors'].append({
                        'property': prop_name,
                        'collector': 'GBP Insights',
                        'error': error_msg
                    })
                
                # Rate limit delay
                time.sleep(0.3)
            
            print()
            print(f'GBP Insights Summary: ✅ {self.results["gbp_insights"]["success"]} | ⚠️  {self.results["gbp_insights"]["skipped"]} | ❌ {self.results["gbp_insights"]["failed"]}')
            print()
            
        except Exception as e:
            print(f'❌ Error loading GBP mappings: {e}')
            self.results['gbp_insights']['failed'] = 1
            print()
    
    def collect_google_ads_data(self):
        """Collect Google Ads campaign data using the dedicated collector."""
        print('=' * 80)
        print('📢 COLLECTING GOOGLE ADS DATA')
        print('=' * 80)
        print()
        
        try:
            # Import the Google Ads collector
            sys.path.insert(0, str(self.base_dir / 'Portfolio_Dashboard' / 'scripts'))
            from collect_google_ads_data import GoogleAdsCollector
            
            # Create collector (not in test mode even if parent is)
            ads_collector = GoogleAdsCollector(test_mode=False)
            
            # Collect yesterday's data
            yesterday = datetime.now().date() - timedelta(days=1)
            ads_collector.run(start_date=yesterday, end_date=yesterday)
            
            # Aggregate results
            self.results['google_ads']['success'] = ads_collector.results['success']
            self.results['google_ads']['failed'] = ads_collector.results['failed']
            self.results['google_ads']['skipped'] = ads_collector.results['skipped']
            
            print()
            print(f'Google Ads Summary: ✅ {self.results["google_ads"]["success"]} | ⚠️  {self.results["google_ads"]["skipped"]} | ❌ {self.results["google_ads"]["failed"]}')
            print()
            
        except ImportError as e:
            print(f'   ⚠️  Google Ads collector not available: {e}')
            self.results['google_ads']['skipped'] = 1
            print()
        except Exception as e:
            print(f'   ❌ Error collecting Google Ads data: {e}')
            self.results['google_ads']['failed'] = 1
            self.results['errors'].append({
                'property': 'All Properties',
                'collector': 'Google Ads',
                'error': str(e)[:100]
            })
            print()
    
    def collect_psi_data(self):
        """Collect PageSpeed Insights data by calling the PSI collector."""
        print('=' * 80)
        print('⚡ COLLECTING PAGESPEED INSIGHTS DATA')
        print('=' * 80)
        print()
        
        try:
            # Run PSI collector as subprocess with streaming output
            import subprocess
            psi_script = self.base_dir / 'Portfolio_Dashboard' / 'scripts' / 'collect_daily_psi.py'
            
            # Stream output directly (don't buffer with capture_output=True)
            result = subprocess.run(
                [sys.executable, str(psi_script)],
                timeout=1800  # 30 minute timeout (parallel collection ~15-20 min)
            )
            
            # Check exit code
            if result.returncode == 0:
                self.results['psi']['success'] = 1
                print('   ✅ PSI collection completed')
            else:
                print(f'   ⚠️  PSI returned exit code {result.returncode}')
                self.results['psi']['failed'] = 1
            
            print()
            
        except subprocess.TimeoutExpired:
            print('   ❌ PSI collection timed out after 30 minutes')
            self.results['psi']['failed'] = 1
            print()
        except Exception as e:
            print(f'   ❌ Error running PSI collector: {e}')
            self.results['psi']['failed'] = 1
            self.results['errors'].append({
                'property': 'All Properties',
                'collector': 'PSI',
                'error': str(e)[:100]
            })
            print()

    def collect_guest_card_data(self):
        """Collect Guest Card CSV data from OneDrive source and archive processed files."""
        print('=' * 80)
        print('🗂️  COLLECTING GUEST CARD METRICS')
        print('=' * 80)
        print()

        try:
            collector = GuestCardCollector(db_path=self.db_path)
            result = collector.ingest_pending_files(collection_id=None)

            if result.files_found == 0:
                print('   ⚠️  No guest card CSV files found (nothing to process)')
                self.results['guest_card']['skipped'] = 1
                print()
                return

            self.results['guest_card']['success'] = result.files_processed
            self.results['guest_card']['failed'] = result.files_failed
            self.results['guest_card']['skipped'] = max(
                0, result.files_found - result.files_processed - result.files_failed
            )

            print(f'   📄 Files found: {result.files_found}')
            print(f'   ✅ Files processed: {result.files_processed}')
            print(f'   🔢 Rows upserted: {result.rows_upserted}')
            if result.files_failed:
                print(f'   ❌ Failed files: {result.files_failed}')

            for err in result.errors:
                self.results['errors'].append({
                    'property': 'Guest Card CSV',
                    'collector': 'Guest Card',
                    'error': err[:100]
                })

            print()
            print(f'Guest Card Summary: ✅ {self.results["guest_card"]["success"]} | ⚠️  {self.results["guest_card"]["skipped"]} | ❌ {self.results["guest_card"]["failed"]}')
            print()

        except Exception as e:
            print(f'   ❌ Error collecting Guest Card data: {e}')
            self.results['guest_card']['failed'] = 1
            self.results['errors'].append({
                'property': 'All Properties',
                'collector': 'Guest Card',
                'error': str(e)[:100]
            })
            print()
    
    def print_final_summary(self):
        """Print final collection summary"""
        duration = datetime.now() - self.start_time
        
        print('=' * 80)
        print('✅ COLLECTION COMPLETE')
        print('=' * 80)
        print()
        print(f'⏱️  Duration: {duration.seconds // 60}m {duration.seconds % 60}s')
        print()
        print('Results:')
        print(f'  GA4:          ✅ {self.results["ga4"]["success"]} | ⚠️  {self.results["ga4"]["skipped"]} | ❌ {self.results["ga4"]["failed"]}')
        print(f'  GSC:          ✅ {self.results["gsc"]["success"]} | ⚠️  {self.results["gsc"]["skipped"]} | ❌ {self.results["gsc"]["failed"]}')
        print(f'  Google Ads:   ✅ {self.results["google_ads"]["success"]} | ⚠️  {self.results["google_ads"]["skipped"]} | ❌ {self.results["google_ads"]["failed"]}')
        print(f'  PSI:          ✅ {self.results["psi"]["success"]} | ⚠️  {self.results["psi"]["skipped"]} | ❌ {self.results["psi"]["failed"]}')
        print(f'  SEMRush:      ✅ {self.results["semrush"]["success"]} | ⚠️  {self.results["semrush"]["skipped"]} | ❌ {self.results["semrush"]["failed"]}')
        print(f'  GTMetrix:     ✅ {self.results["gtmetrix"]["success"]} | ⚠️  {self.results["gtmetrix"]["skipped"]} | ❌ {self.results["gtmetrix"]["failed"]}')
        print(f'  GBP Reviews:  ✅ {self.results["gbp_reviews"]["success"]} | ⚠️  {self.results["gbp_reviews"]["skipped"]} | ❌ {self.results["gbp_reviews"]["failed"]}')
        print(f'  GBP Insights: ✅ {self.results["gbp_insights"]["success"]} | ⚠️  {self.results["gbp_insights"]["skipped"]} | ❌ {self.results["gbp_insights"]["failed"]}')
        print(f'  Guest Card:   ✅ {self.results["guest_card"]["success"]} | ⚠️  {self.results["guest_card"]["skipped"]} | ❌ {self.results["guest_card"]["failed"]}')
        print(f'  D1 Mirror:    ✅ {self.results["d1_mirror"]["success"]} | ⚠️  {self.results["d1_mirror"]["skipped"]} | ❌ {self.results["d1_mirror"]["failed"]}')
        print()
        
        total_success = sum(
            self.results[cat]["success"]
            for cat in [
                'ga4',
                'gsc',
                'google_ads',
                'psi',
                'semrush',
                'gtmetrix',
                'gbp_reviews',
                'gbp_insights',
                'guest_card',
                'd1_mirror'
            ]
        )
        print(f'Total successful collections: {total_success}')
        
        if self.results['errors']:
            print()
            print(f'⚠️  Errors ({len(self.results["errors"])}):', )
            for error in self.results['errors'][:10]:  # Show first 10
                print(f'  - {error["property"]} ({error["collector"]}): {error["error"][:60]}...')
            if len(self.results['errors']) > 10:
                print(f'  ... and {len(self.results["errors"]) - 10} more')
        
        print()
        print(f'📊 Database: {self.db_path}')
        print('=' * 80)

    def sync_d1_mirror(self):
        """Run deterministic D1 mirror sync after local collection + validation."""
        print()
        print('=' * 80)
        print('☁️  PHASE 9: D1 MIRROR SYNC')
        print('=' * 80)
        print()

        try:
            d1_script = self.base_dir / 'apps' / 'api' / 'scripts' / 'd1_mirror_sync.py'
            if not d1_script.exists():
                print(f'❌ D1 mirror script not found: {d1_script}')
                self.results['d1_mirror']['failed'] = 1
                self.results['errors'].append({
                    'property': 'All Properties',
                    'collector': 'D1 Mirror',
                    'error': 'd1_mirror_sync.py missing'
                })
                return

            # Keep daily mirror aligned to the most recent common Friday.
            result = subprocess.run(
                [sys.executable, str(d1_script)],
                timeout=2700  # 45 min
            )

            if result.returncode == 0:
                self.results['d1_mirror']['success'] = 1
                print('✅ D1 mirror sync completed successfully')
            else:
                self.results['d1_mirror']['failed'] = 1
                print(f'❌ D1 mirror sync failed (exit code {result.returncode})')
                self.results['errors'].append({
                    'property': 'All Properties',
                    'collector': 'D1 Mirror',
                    'error': f'd1_mirror_sync.py exited {result.returncode}'
                })

        except subprocess.TimeoutExpired:
            self.results['d1_mirror']['failed'] = 1
            print('❌ D1 mirror sync timed out after 45 minutes')
            self.results['errors'].append({
                'property': 'All Properties',
                'collector': 'D1 Mirror',
                'error': 'D1 mirror sync timed out'
            })
        except Exception as e:
            self.results['d1_mirror']['failed'] = 1
            print(f'❌ Error running D1 mirror sync: {e}')
            self.results['errors'].append({
                'property': 'All Properties',
                'collector': 'D1 Mirror',
                'error': str(e)[:100]
            })
    
    def run(self):
        """Main collection workflow"""
        try:
            # Load properties
            properties = self.load_properties()
            
            # Initialize collectors (includes pre-flight credential check)
            self.initialize_collectors()
            
            # Collect GA4 data
            self.collect_ga4_data(properties)
            
            # Small pause between collectors
            time.sleep(2)
            
            # Collect GSC data (main properties, excluding Cendana)
            self.collect_gsc_data(properties)
            
            # Small pause
            time.sleep(2)
            
            # Collect Cendana GSC data with separate credentials
            self.collect_cendana_gsc_data(properties)
            
            # Small pause
            time.sleep(2)
            
            # Collect Google Ads data
            self.collect_google_ads_data()
            
            # Small pause
            time.sleep(2)
            
            # Collect PSI data
            self.collect_psi_data()
            
            # Small pause
            time.sleep(2)
            
            # Collect GBP reviews (runs in both quick and full mode)
            self.collect_gbp_reviews()
            
            # Small pause
            time.sleep(2)
            
            # Collect GBP insights (runs in both quick and full mode)
            self.collect_gbp_insights()

            # Small pause
            time.sleep(2)

            # Collect Guest Card CSV (runs in both quick and full mode)
            self.collect_guest_card_data()
            
            # Skip SEMRush and GTMetrix in quick mode
            if not self.quick_mode:
                # Small pause
                time.sleep(2)
                
                # Collect SEMRush data
                self.collect_semrush_data(properties)
                
                # Skip GTMetrix if flag set
                if not self.no_gtmetrix:
                    # Small pause
                    time.sleep(2)
                    
                    # Collect GTMetrix data
                    self.collect_gtmetrix_data(properties)
            
            # Run anomaly detection after collection completes
            print()
            print('=' * 80)
            print('🔍 RUNNING ANOMALY DETECTION')
            print('=' * 80)
            print()
            
            # Use yesterday's date for anomaly detection
            yesterday = (datetime.now() - timedelta(days=1)).date()
            
            # Calculate baselines for yesterday
            print(f'Calculating baselines for {yesterday}...')
            baselines_calculated = self.anomaly_detector.calculate_baselines(yesterday)
            print(f'✅ Calculated baselines for {baselines_calculated} properties')
            print()
            
            # Detect anomalies
            print(f'Detecting anomalies for {yesterday}...')
            anomalies = self.anomaly_detector.detect_anomalies(yesterday)
            
            if anomalies['critical']:
                print(f'❌ Found {len(anomalies["critical"])} critical anomalies')
            if anomalies['warnings']:
                print(f'⚠️  Found {len(anomalies["warnings"])} warnings')
            if not anomalies['critical'] and not anomalies['warnings']:
                print('✅ No anomalies detected')
            
            print()
            
            # Print summary
            self.print_final_summary()
            
            # Phase 6: Registry Completeness Validation
            print()
            print('=' * 80)
            print('🔍 PHASE 6: REGISTRY COMPLETENESS VALIDATION')
            print('=' * 80)
            print()
            
            try:
                import subprocess
                import json
                
                # Prepare collection summary for validator
                duration = datetime.now() - self.start_time
                collection_summary = {
                    'duration_seconds': duration.seconds,
                    'results': self.results,
                    'timestamp': self.start_time.strftime('%Y-%m-%d %H:%M:%S')
                }
                
                # Prepare monitoring data
                monitoring_data = {
                    'credential_warnings': self.credential_warnings,
                    'anomalies': anomalies  # Contains 'critical' and 'warnings' lists
                }
                
                validation_script = Path(__file__).parent / 'validate_registry_completeness.py'
                result = subprocess.run(
                    [sys.executable, str(validation_script)],
                    capture_output=True,
                    text=True,
                    timeout=60,
                    env={
                        **os.environ,
                        'COLLECTION_SUMMARY': json.dumps(collection_summary),
                        'MONITORING_DATA': json.dumps(monitoring_data)
                    }
                )
                
                # Print validation output
                print(result.stdout)
                
                if result.returncode != 0:
                    print('⚠️  Registry validation found issues - check output above')
                    print('   These issues have been logged to registry_validation_failures table')
                else:
                    print('✅ Registry validation passed - all properties collecting data')
                    
            except subprocess.TimeoutExpired:
                print('❌ Registry validation timed out')
            except Exception as e:
                print(f'❌ Registry validation failed: {e}')
            
            # Phase 7: Enhanced Data Quality Validation
            print()
            print('=' * 80)
            print('🔬 PHASE 7: ENHANCED DATA QUALITY VALIDATION')
            print('=' * 80)
            print()
            
            try:
                quality_script = Path(__file__).parent / 'validate_data_quality.py'
                quality_result = subprocess.run(
                    [sys.executable, str(quality_script)],
                    capture_output=True,
                    text=True,
                    timeout=120  # Longer timeout for comprehensive checks
                )
                
                # Print quality validation output
                print(quality_result.stdout)
                
                if quality_result.returncode != 0:
                    print('ℹ️  Data quality checks found issues - see details above')
                    print('   (Some issues like query impression mismatches are expected)')
                else:
                    print('✅ All data quality checks passed')
                    
            except subprocess.TimeoutExpired:
                print('❌ Data quality validation timed out')
            except Exception as e:
                print(f'⚠️  Data quality validation error: {e}')

            # Phase 9: D1 mirror sync (post-validation source-of-truth push)
            self.sync_d1_mirror()

            # PHASE 10: SEND DATA INTEGRITY ALERTS
            print()
            print('=' * 80)
            print('📧 PHASE 10: DATA INTEGRITY MONITORING & ALERTS')
            print('=' * 80)
            print()
            
            try:
                alerter = DataAlertEmailer(test_mode=False)
                alert_exit_code = alerter.run()
                
                if alert_exit_code == 0:
                    print('✅ Alert system completed successfully')
                else:
                    print('⚠️  Alert system encountered issues (non-fatal)')
                    
            except Exception as e:
                print(f'❌ Alert system failed: {e}')
                print('   (Collection completed, but email alerts may not have been sent)')
            
            return 0
            
        except KeyboardInterrupt:
            print('\n\n⚠️  Collection interrupted by user')
            self.print_final_summary()
            return 1
        except Exception as e:
            print(f'\n\n❌ Fatal error: {e}')
            import traceback
            traceback.print_exc()
            return 1


if __name__ == '__main__':
    test_mode = '--test' in sys.argv
    quick_mode = '--quick' in sys.argv
    no_gtmetrix = '--no-gtmetrix' in sys.argv
    collector = PortfolioDataCollector(test_mode=test_mode, quick_mode=quick_mode, no_gtmetrix=no_gtmetrix)
    sys.exit(collector.run())
