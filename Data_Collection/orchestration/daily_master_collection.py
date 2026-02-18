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
from datetime import datetime, timedelta
from pathlib import Path
import fcntl
from typing import Optional
import random

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
from Data_Collection.monitoring.daily_collection_report import DailyCollectionReporter
from Data_Collection.db.migrations import apply_migrations

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
        
        # GSC credentials paths (portfolio-wide)
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
            'thirtylines': {'success': 0, 'failed': 0, 'skipped': 0},
            'guest_card': {'success': 0, 'failed': 0, 'skipped': 0},
            'semrush_competitor': {'success': 0, 'failed': 0, 'skipped': 0},
            'errors': []
        }
        
        # Collection monitors (initialized in run method)
        self.monitors = {}
        # Track active collection records for recovery on failure
        self.collection_records = {}
        
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
            print('⚡ QUICK MODE: Full collection (GTMetrix disabled)')
        print()
        
    def _reset_results_for(self, source: str) -> None:
        if source in self.results:
            self.results[source]['success'] = 0
            self.results[source]['failed'] = 0
            self.results[source]['skipped'] = 0

    def _clear_errors_for(self, collector_name: str) -> None:
        self.results['errors'] = [
            e for e in self.results.get('errors', [])
            if e.get('collector') != collector_name
        ]

    def _backoff_sleep(self, attempt: int, base: float = 5.0) -> None:
        delay = base * (2 ** max(attempt - 1, 0)) + random.uniform(0, 2)
        time.sleep(delay)

    def _initialize_main_gsc_service(self):
        """Initialize GSC service with portfolio-wide Venterra credentials"""
        try:
            creds = None
            
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
            # Set a default timeout to prevent hangs
            try:
                service._http.timeout = 60
            except Exception:
                pass
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
            sys.path.insert(0, str(Path(__file__).parent.parent / 'collectors'))
            from gbp_collector import GoogleBusinessProfileCollector
            gbp_creds_path = self.base_dir / 'Portfolio_Monitoring' / 'credentials' / 'client_secret_gbp.json'
            gbp_token_path = self.base_dir / 'Portfolio_Monitoring' / 'credentials' / 'gbp_token.pickle'
            self.gbp_collector = GoogleBusinessProfileCollector(gbp_creds_path, gbp_token_path)
            print('✅')
        except Exception as e:
            print(f'⚠️  {str(e)[:50]}')
            self.gbp_collector = None
        
        print()
    
    def collect_ga4_data(self, properties, start_date=None, end_date=None, include_details: bool = True, collection_type: str = 'daily'):
        """Collect GA4 data for all properties with CollectionMonitor tracking"""
        print('=' * 80)
        print('📊 COLLECTING GA4 ANALYTICS DATA')
        print('=' * 80)
        print()
        
        # Create collection record in database for tracking
        collection_id = self._start_collection_record('ga4', len([p for p in properties if p.get('ga4_property_id')]), collection_type=collection_type)

        # Initialize CollectionMonitor for this collection
        monitor = CollectionMonitor(self.db_path, collection_id, 'ga4')
        self.monitors['ga4'] = monitor
        collection_started_at = datetime.now()
        
        # Date ranges - default to last 30 days to match PIB window
        if end_date is None:
            end_date = datetime.now() - timedelta(days=1)
        if start_date is None:
            start_date = end_date - timedelta(days=29)  # 30 days total
        
        print(f'📅 Date range: {start_date.strftime("%Y-%m-%d")} to {end_date.strftime("%Y-%m-%d")} (daily breakdown)')
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
                        Metric(name="newUsers"),
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
                        new_users = int(row.metric_values[3].value)
                        pageviews = int(row.metric_values[4].value)
                        avg_session_duration = float(row.metric_values[5].value)
                        bounce_rate = float(row.metric_values[6].value)
                        
                        # Store in database with actual date
                        self.db.insert_ga4_daily_metrics(
                            property_id=ga4_id,
                            metric_date=formatted_date,
                            data={
                                'sessions': sessions,
                                'engaged_sessions': engaged,
                                'total_users': users,
                                'new_users': new_users,
                                'pageviews': pageviews,
                                'avg_session_duration': avg_session_duration,
                                'bounce_rate': bounce_rate
                            },
                            collection_id=collection_id
                        )
                        days_collected += 1
                    
                    if include_details:
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
        
        # Finalize collection tracking
        collection_completed_at = datetime.now()
        monitor.finalize(collection_started_at, collection_completed_at)
        
        # Update collection status
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE data_collections
            SET status = ?,
                completed_at = ?,
                properties_collected = ?,
                properties_success = ?,
                properties_failed = ?,
                properties_skipped = ?
            WHERE collection_id = ?
        """, ('completed', collection_completed_at,
              self.results['ga4']['success'],
              self.results['ga4']['success'],
              self.results['ga4']['failed'],
              self.results['ga4']['skipped'],
              collection_id))
        conn.commit()
        conn.close()

    def _start_collection_record(self, data_source: str, properties_total: int, collection_type: str = 'daily') -> int:
        """Create a data_collections record and return collection_id."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO data_collections (
                collection_date, data_source, started_at, status, properties_total, collection_type
            ) VALUES (?, ?, ?, ?, ?, ?)
        """, (datetime.now().date(), data_source, datetime.now(), 'in_progress', properties_total, collection_type))
        collection_id = cursor.lastrowid
        conn.commit()
        conn.close()
        # Track for recovery
        self.collection_records[data_source] = (collection_id, properties_total)
        return collection_id

    def _finish_collection_record(self, collection_id: int, data_source: str, properties_total: int) -> None:
        """Finalize a data_collections record from self.results."""
        completed_at = datetime.now()
        notes = None
        source_key = data_source.lower().replace(' ', '_')
        errors = [
            e for e in self.results.get('errors', [])
            if e.get('collector', '').lower().replace(' ', '_') == source_key
        ]
        if errors:
            notes = "; ".join([f"{e.get('property')}: {e.get('error')}" for e in errors])
            if len(notes) > 900:
                notes = notes[:900] + "…"
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        # Ensure notes column exists (defensive schema guard)
        has_notes = False
        try:
            cursor.execute("PRAGMA table_info(data_collections)")
            cols = [row[1] for row in cursor.fetchall()]
            if "notes" not in cols:
                cursor.execute("ALTER TABLE data_collections ADD COLUMN notes TEXT")
            cursor.execute("PRAGMA table_info(data_collections)")
            cols = [row[1] for row in cursor.fetchall()]
            has_notes = "notes" in cols
        except sqlite3.OperationalError:
            # If table is locked or ALTER fails, continue without notes
            notes = None
            has_notes = False

        # Determine final status based on results
        success = self.results.get(data_source, {}).get('success', 0)
        failed = self.results.get(data_source, {}).get('failed', 0)
        skipped = self.results.get(data_source, {}).get('skipped', 0)
        final_status = 'completed'
        if success == 0 and (failed > 0 or skipped > 0):
            final_status = 'failed'

        if has_notes:
            cursor.execute("""
                UPDATE data_collections
                SET status = ?,
                    completed_at = ?,
                    properties_total = ?,
                    properties_collected = ?,
                    properties_success = ?,
                    properties_failed = ?,
                    properties_skipped = ?,
                    notes = ?
                WHERE collection_id = ?
            """, (
                final_status,
                completed_at,
                properties_total,
                success,
                success,
                failed,
                skipped,
                notes,
                collection_id
            ))
        else:
            cursor.execute("""
                UPDATE data_collections
                SET status = ?,
                    completed_at = ?,
                    properties_total = ?,
                    properties_collected = ?,
                    properties_success = ?,
                    properties_failed = ?,
                    properties_skipped = ?
                WHERE collection_id = ?
            """, (
                final_status,
                completed_at,
                properties_total,
                success,
                success,
                failed,
                skipped,
                collection_id
            ))
        conn.commit()
        conn.close()
        # Remove from recovery tracking
        if data_source in self.collection_records:
            self.collection_records.pop(data_source, None)

    def _finalize_any_open_collections(self) -> None:
        """Finalize any tracked collections still marked in_progress."""
        if not self.collection_records:
            return
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        for data_source, (collection_id, properties_total) in list(self.collection_records.items()):
            cursor.execute("SELECT status FROM data_collections WHERE collection_id = ?", (collection_id,))
            row = cursor.fetchone()
            if row and row[0] == 'in_progress':
                self._finish_collection_record(collection_id, data_source, properties_total)
        conn.close()

    def _mark_stale_collections_failed(self, stale_hours: int = 6) -> None:
        """Fail any in_progress collections older than stale_hours to keep audit trail accurate."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        # Ensure notes column exists (defensive schema guard)
        try:
            cursor.execute("PRAGMA table_info(data_collections)")
            cols = [row[1] for row in cursor.fetchall()]
            if "notes" not in cols:
                cursor.execute("ALTER TABLE data_collections ADD COLUMN notes TEXT")
                conn.commit()
        except sqlite3.OperationalError:
            pass

        cursor.execute("""
            UPDATE data_collections
            SET status = 'failed',
                completed_at = ?,
                notes = COALESCE(notes, '') || ?
            WHERE status = 'in_progress'
              AND started_at <= datetime('now', ?)
        """, (
            datetime.now(),
            ' [watchdog: auto-failed stale run]',
            f'-{stale_hours} hours'
        ))
        conn.commit()
        conn.close()

    def _acquire_run_lock(self) -> Optional[int]:
        """Prevent overlapping runs with a simple lock file."""
        lock_path = Path("/tmp/portfolio_collection.lock")
        lock_file = open(lock_path, "w")
        try:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            lock_file.write(str(os.getpid()))
            lock_file.flush()
            self._lock_file = lock_file
            return lock_file.fileno()
        except BlockingIOError:
            try:
                lock_file.close()
            except Exception:
                pass
            return None

    def _release_run_lock(self) -> None:
        lock_file = getattr(self, "_lock_file", None)
        if lock_file:
            try:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
                lock_file.close()
            except Exception:
                pass
    
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
            ).execute(num_retries=3)
            
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
    
    def collect_gsc_data(self, properties, start_date=None, end_date=None):
        """Collect GSC data for all properties"""
        print('=' * 80)
        print('🔍 COLLECTING GOOGLE SEARCH CONSOLE DATA')
        print('=' * 80)
        print()
        
        # Date ranges (GSC has 3-day delay confirmed)
        # Default: 30 days for daily metrics + queries to match PIB window
        if end_date is None:
            end_date = datetime.now() - timedelta(days=3)
        if start_date is None:
            start_date = end_date - timedelta(days=29)  # 30 days total
        
        print(f'📅 Date range: {start_date.strftime("%Y-%m-%d")} to {end_date.strftime("%Y-%m-%d")} (daily metrics + queries)')
        print()
        
        # Filter properties with GSC access
        gsc_properties = [p for p in properties 
                         if p.get('gsc_access') and p['gsc_access'] != 'none']
        
        print(f'Properties with GSC access: {len(gsc_properties)}/{len(properties)}')
        print()

        total_expected = len(gsc_properties)
        self.gsc_collection_id = self._start_collection_record('gsc', total_expected)
        self.gsc_collection_total = total_expected
        
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
                ).execute(num_retries=3)
                
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

        # Update collection record after run completes
        self._finish_collection_record(self.gsc_collection_id, 'gsc', self.gsc_collection_total)
    

    def collect_semrush_data(self, properties):
        """Collect SEMRush data for all properties"""
        print('=' * 80)
        print('📈 COLLECTING SEMRUSH DATA')
        print('=' * 80)
        print()
        
        import requests
        
        print(f'Properties to check: {len(properties)}')
        print()
        collection_id = self._start_collection_record('semrush', len(properties))
        
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
            if self.results['semrush']['success'] == 0:
                self.results['semrush']['failed'] = len(properties) or 1
                self.results['errors'].append({
                    'property': 'All Properties',
                    'collector': 'SEMRush',
                    'error': 'No SEMRush data collected'
                })
            self._finish_collection_record(collection_id, 'semrush', len(properties))
    
    def _get_recent_gsc_queries(self, property_id: str, days: int = 30):
        """Fetch recent GSC queries for a property to improve competitor comparison."""
        end_date = datetime.now().date() - timedelta(days=3)  # GSC lag
        start_date = end_date - timedelta(days=days - 1)
        queries = []
        with self.db.get_connection() as conn:
            cursor = conn.execute("""
                SELECT 
                    query,
                    AVG(average_position) as avg_position,
                    SUM(clicks) as clicks,
                    SUM(impressions) as impressions
                FROM gsc_queries
                WHERE property_id = ?
                  AND metric_date BETWEEN ? AND ?
                GROUP BY query
                ORDER BY clicks DESC
                LIMIT 100
            """, (property_id, start_date.isoformat(), end_date.isoformat()))
            for row in cursor.fetchall():
                queries.append({
                    'query': row[0],
                    'avg_position': row[1],
                    'clicks': row[2],
                    'impressions': row[3]
                })
        return queries
    
    def collect_semrush_competitor_snapshots(self, properties, max_properties: int = None):
        """Collect SEMRush competitor snapshots and store in DB (no live calls in PIB)."""
        print('=' * 80)
        print('📊 COLLECTING SEMRUSH COMPETITOR SNAPSHOTS')
        print('=' * 80)
        print()
    
        try:
            # Reuse existing SEMRush competitor analysis logic
            sys.path.insert(0, str(self.base_dir / 'Property_Intelligence_Brief'))
            from semrush_competitor_api import SEMRushCompetitorAPI
        except Exception as e:
            print(f'   ⚠️  SEMRush competitor API unavailable: {e}')
            self.results['semrush']['skipped'] += 1
            print()
            return
    
        semrush_api = SEMRushCompetitorAPI()
        snapshot_date = datetime.now().date().isoformat()
    
        processed = 0
        stored = 0
    
        for prop in properties:
            if max_properties and processed >= max_properties:
                break
    
            property_id = prop.get('ga4_property_id')
            if not property_id:
                continue
    
            full_url = prop.get('full_url', '')
            property_domain = prop.get('domain', '')
            if not property_domain and full_url:
                from urllib.parse import urlparse
                parsed = urlparse(full_url)
                property_domain = parsed.netloc.replace('www.', '')
    
            if not property_domain:
                continue
    
            # Get competitors for this property
            with self.db.get_connection() as conn:
                cursor = conn.execute("""
                    SELECT 
                        c.competitor_id,
                        c.competitor_name,
                        c.competitor_domain,
                        pc.competitor_rank,
                        pc.data_source
                    FROM property_competitors pc
                    JOIN competitors c ON pc.competitor_id = c.competitor_id
                    WHERE pc.property_id = ?
                    ORDER BY pc.competitor_rank
                    LIMIT 10
                """, (property_id,))
                competitors = cursor.fetchall()
    
            if not competitors:
                continue
    
            # Select primary competitor (first with domain)
            primary = None
            for row in competitors:
                if row[2]:
                    primary = row
                    break
            if not primary:
                primary = competitors[0]
    
            competitor_name = primary[1]
            competitor_domain = primary[2]
            competitor_rank = primary[3]
            data_source = primary[4]
    
            if not competitor_domain:
                continue
    
            print(f"- {prop.get('name')} vs {competitor_name} ({competitor_domain})")
            sys.stdout.flush()
    
            try:
                our_gsc_queries = self._get_recent_gsc_queries(property_id)
                analysis = semrush_api.get_competitor_analysis(
                    our_domain=property_domain,
                    competitor_domain=competitor_domain,
                    competitor_name=competitor_name,
                    our_gsc_queries=our_gsc_queries
                )
    
                self.db.insert_semrush_competitor_snapshot(
                    property_id=property_id,
                    competitor_domain=competitor_domain,
                    snapshot_date=snapshot_date,
                    analysis_json=json.dumps(analysis),
                    competitor_name=competitor_name,
                    competitor_rank=competitor_rank,
                    data_source=data_source
                )
                stored += 1
            except Exception as e:
                error_msg = str(e)[:100]
                print(f'   ❌ Error: {error_msg}')
                self.results['errors'].append({
                    'property': prop.get('name'),
                    'collector': 'SEMRush Competitor',
                    'error': error_msg
                })
    
            processed += 1
            time.sleep(0.2)
    
        print()
        print(f'SEMRush Competitor Snapshots: ✅ {stored} stored')
        print()
    
        # Track snapshot collection separately for auditing
        self.results.setdefault('semrush_competitor', {'success': 0, 'failed': 0, 'skipped': 0})
        self.results['semrush_competitor']['success'] = stored
        self.results['semrush_competitor']['failed'] = max(0, processed - stored)
        collection_id = self._start_collection_record('semrush_competitor', processed)
        self._finish_collection_record(collection_id, 'semrush_competitor', processed)
        
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
        collection_id = self._start_collection_record('gtmetrix', len(test_props))
        
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
        if self.results['gtmetrix']['success'] == 0:
            self.results['gtmetrix']['failed'] = len(test_props) or 1
            self.results['errors'].append({
                'property': 'All Properties',
                'collector': 'GTMetrix',
                'error': 'No GTMetrix data collected'
            })
        self._finish_collection_record(collection_id, 'gtmetrix', len(test_props))
        
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
            collection_id = self._start_collection_record('gbp_reviews', len(matched_properties))
            
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
            if self.results['gbp_reviews']['success'] == 0:
                self.results['gbp_reviews']['failed'] = len(matched_properties) or 1
                self.results['errors'].append({
                    'property': 'All Properties',
                    'collector': 'GBP Reviews',
                    'error': 'No GBP Reviews data collected'
                })
            self._finish_collection_record(collection_id, 'gbp_reviews', len(matched_properties))
            
        except Exception as e:
            print(f'❌ Error loading GBP mappings: {e}')
            self.results['gbp_reviews']['failed'] = 1
            print()
        
    def collect_gbp_insights(self, start_date=None, end_date=None):
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
            if end_date is None:
                end_date = date.today() - timedelta(days=2)
            if start_date is None:
                start_date = end_date  # Default to single day
            
            print(f'📅 Collecting data for: {start_date} to {end_date}')
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
            
            collection_id = self._start_collection_record('gbp_insights', len(matched_properties))

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
                        
                        # Parse metrics (by date)
                        metrics_by_date = {}
                        
                        multi_series = data.get('multiDailyMetricTimeSeries', [])
                        for series_group in multi_series:
                            daily_series_list = series_group.get('dailyMetricTimeSeries', [])
                            for daily_series in daily_series_list:
                                metric_type = daily_series.get('dailyMetric')
                                time_series = daily_series.get('timeSeries', {})
                                dated_values = time_series.get('datedValues', [])
                                
                                for dv in dated_values:
                                    dv_date = dv.get('date', {})
                                    if dv_date:
                                        date_key = f"{dv_date.get('year'):04d}-{dv_date.get('month'):02d}-{dv_date.get('day'):02d}"
                                    else:
                                        date_key = str(start_date)

                                    if date_key not in metrics_by_date:
                                        metrics_by_date[date_key] = {
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

                                    value = int(dv.get('value', 0)) if dv.get('value') else 0
                                    
                                    # Map metric to schema
                                    if metric_type == "BUSINESS_IMPRESSIONS_DESKTOP_MAPS":
                                        metrics_by_date[date_key]['maps_views_desktop'] += value
                                    elif metric_type == "BUSINESS_IMPRESSIONS_MOBILE_MAPS":
                                        metrics_by_date[date_key]['maps_views_mobile'] += value
                                    elif metric_type == "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH":
                                        metrics_by_date[date_key]['search_views_desktop'] += value
                                    elif metric_type == "BUSINESS_IMPRESSIONS_MOBILE_SEARCH":
                                        metrics_by_date[date_key]['search_views_mobile'] += value
                                    elif metric_type == "WEBSITE_CLICKS":
                                        metrics_by_date[date_key]['website_clicks'] += value
                                    elif metric_type == "CALL_CLICKS":
                                        metrics_by_date[date_key]['phone_calls'] += value
                                    elif metric_type == "BUSINESS_DIRECTION_REQUESTS":
                                        metrics_by_date[date_key]['direction_requests'] += value
                                    elif metric_type == "BUSINESS_FOOD_ORDERS":
                                        metrics_by_date[date_key]['food_orders'] += value
                                    elif metric_type == "BUSINESS_FOOD_MENU_CLICKS":
                                        metrics_by_date[date_key]['food_menu_clicks'] += value
                        
                        # Store in database (per-date)
                        conn = sqlite3.connect(self.db_path)
                        cursor = conn.cursor()

                        for date_key, metrics in metrics_by_date.items():
                            total_views = (metrics['maps_views_desktop'] + metrics['maps_views_mobile'] +
                                           metrics['search_views_desktop'] + metrics['search_views_mobile'])
                            total_actions = (metrics['website_clicks'] + metrics['phone_calls'] +
                                             metrics['direction_requests'])
                            action_rate = (total_actions / total_views) if total_views > 0 else 0

                            cursor.execute("""
                                INSERT OR REPLACE INTO gbp_daily_insights (
                                    property_id, gbp_location_id, account_id, metric_date,
                                    maps_views_desktop, maps_views_mobile,
                                    search_views_desktop, search_views_mobile, total_profile_views,
                                    website_clicks, phone_calls, direction_requests, total_actions, action_rate,
                                    food_orders, food_menu_clicks,
                                    collected_at, collection_id
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """, (
                                property_id,
                                location_id,
                                account_id,
                                date_key,
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
                                datetime.now().isoformat(),
                                collection_id
                            ))

                        conn.commit()
                        conn.close()

                        # Use end_date for summary message
                        total_views = sum(m['maps_views_desktop'] + m['maps_views_mobile'] + m['search_views_desktop'] + m['search_views_mobile'] for m in metrics_by_date.values())
                        total_actions = sum(m['website_clicks'] + m['phone_calls'] + m['direction_requests'] for m in metrics_by_date.values())
                        action_rate = (total_actions / total_views) if total_views > 0 else 0
                        print(f'   ✅ {total_views} views, {total_actions} actions ({action_rate*100:.1f}%)')
                        self.results['gbp_insights']['success'] += 1
                        
                    elif response.status_code == 403:
                        print(f'   ⚠️  Access denied (check API enabled)')
                        self.results['gbp_insights']['skipped'] += 1
                        self.results['errors'].append({
                            'property': prop_name,
                            'collector': 'GBP Insights',
                            'error': 'Access denied'
                        })
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
            if self.results['gbp_insights']['success'] == 0:
                self.results['gbp_insights']['failed'] = len(matched_properties) or 1
                self.results['errors'].append({
                    'property': 'All Properties',
                    'collector': 'GBP Insights',
                    'error': 'No GBP Insights data collected'
                })
            self._finish_collection_record(collection_id, 'gbp_insights', len(matched_properties))
            
        except Exception as e:
            print(f'❌ Error loading GBP mappings: {e}')
            self.results['gbp_insights']['failed'] = 1
            try:
                if 'collection_id' in locals():
                    self._finish_collection_record(collection_id, 'gbp_insights', len(matched_properties))
            except Exception:
                pass
            print()
        
    def collect_thirtylines_data(self):
        """Collect ThirtyLines availability data using the dedicated collector."""
        print('=' * 80)
        print('🏢 COLLECTING THIRTYLINES AVAILABILITY DATA')
        print('=' * 80)
        print()
        
        try:
            # Import ThirtyLines collector
            sys.path.insert(0, str(Path(__file__).parent.parent))
            from Data_Collection.collectors.thirtylines_collector import ThirtyLinesCollector
            
            # Create collector instance
            collector = ThirtyLinesCollector(self.db_path)
            properties_total = len(self.load_properties())
            collection_id = self._start_collection_record('thirtylines', properties_total)
            
            # Run collection for today
            from datetime import date
            results = collector.collect_all_properties(collection_date=date.today())
            
            # Aggregate results
            if results['properties_succeeded'] > 0:
                self.results['thirtylines']['success'] = results['properties_succeeded']
                self.results['thirtylines']['failed'] = results['properties_failed']
                print(f"   ✅ Collected {results['properties_succeeded']} properties")
                print(f"   📊 {results['total_floorplans']} floorplans, {results['total_units_available']} units available")
            else:
                print('   ⚠️  No ThirtyLines data collected')
                self.results['thirtylines']['failed'] = results['properties_failed']
                self.results['thirtylines']['skipped'] = properties_total
                self.results['errors'].append({
                    'property': 'All Properties',
                    'collector': 'ThirtyLines',
                    'error': 'No ThirtyLines data collected'
                })

            # Retry once if failed or zero success
            if self.results['thirtylines']['failed'] > 0 or self.results['thirtylines']['success'] == 0:
                print('🔁 Retrying ThirtyLines collection once...')
                self._backoff_sleep(1)
                retry_collector = ThirtyLinesCollector(self.db_path)
                retry_results = retry_collector.collect_all_properties(collection_date=date.today())
                if retry_results.get('properties_succeeded', 0) > self.results['thirtylines']['success']:
                    self.results['thirtylines']['success'] = retry_results['properties_succeeded']
                    self.results['thirtylines']['failed'] = retry_results['properties_failed']
                    print(f"   ✅ Retry collected {retry_results['properties_succeeded']} properties")
                else:
                    print('   ⚠️  Retry did not improve ThirtyLines results')
            
            print()
            print(f'ThirtyLines Summary: ✅ {self.results["thirtylines"]["success"]} | ⚠️  {self.results["thirtylines"]["skipped"]} | ❌ {self.results["thirtylines"]["failed"]}')
            print()
            self._finish_collection_record(collection_id, 'thirtylines', properties_total)
            
        except ImportError as e:
            print(f'   ⚠️  ThirtyLines collector not available: {e}')
            self.results['thirtylines']['skipped'] = 1
            print()
        except Exception as e:
            print(f'   ❌ Error collecting ThirtyLines data: {e}')
            traceback.print_exc()
            self.results['thirtylines']['failed'] = 1
            self.results['errors'].append({
                'property': 'All Properties',
                'collector': 'ThirtyLines',
                'error': str(e)[:100]
            })
            print()
        
    def collect_guest_card_data(self):
        """Collect Guest Card CSV metrics from OneDrive and archive processed files."""
        print('=' * 80)
        print('🗂️  COLLECTING GUEST CARD METRICS')
        print('=' * 80)
        print()

        try:
            collector = GuestCardCollector(self.db_path)
            pending_files = collector.get_pending_files()
            files_total = len(pending_files)

            if files_total == 0:
                print('   ⚠️  No guest card CSV files found (nothing to process)')
                self.results['guest_card']['skipped'] = 1
                print()
                return

            collection_id = self._start_collection_record('guest_card', files_total)
            result = collector.ingest_pending_files(collection_id=collection_id)

            self.results['guest_card']['success'] = result.files_processed
            self.results['guest_card']['failed'] = result.files_failed
            self.results['guest_card']['skipped'] = max(0, result.files_found - result.files_processed - result.files_failed)

            if result.files_processed > 0:
                print(f'   ✅ Processed files: {result.files_processed}')
                print(f'   📊 Rows upserted: {result.rows_upserted}')
                print(f'   📦 Archived to: {collector.archive_dir}')

            if result.files_failed > 0:
                for err in result.errors or []:
                    self.results['errors'].append({
                        'property': 'Guest Card CSV',
                        'collector': 'Guest Card',
                        'error': str(err)[:100]
                    })
                print(f'   ❌ Failed files: {result.files_failed}')

            print()
            print(f'Guest Card Summary: ✅ {self.results["guest_card"]["success"]} | ⚠️  {self.results["guest_card"]["skipped"]} | ❌ {self.results["guest_card"]["failed"]}')
            print()
            self._finish_collection_record(collection_id, 'guest_card', files_total)

        except Exception as e:
            print(f'   ❌ Error collecting Guest Card data: {e}')
            self.results['guest_card']['failed'] = 1
            self.results['errors'].append({
                'property': 'All Guest Card Files',
                'collector': 'Guest Card',
                'error': str(e)[:100]
            })
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
            properties_total = len(ads_collector.get_properties_with_google_ads())
            collection_id = self._start_collection_record('google_ads', properties_total)
            
            # Collect yesterday's data
            yesterday = datetime.now().date() - timedelta(days=1)
            ads_collector.run(start_date=yesterday, end_date=yesterday)
            
            # Aggregate results
            self.results['google_ads']['success'] = ads_collector.results['success']
            self.results['google_ads']['failed'] = ads_collector.results['failed']
            self.results['google_ads']['skipped'] = ads_collector.results['skipped']

            if self.results['google_ads']['success'] == 0 and self.results['google_ads']['failed'] == 0:
                self.results['google_ads']['failed'] = properties_total or 1
                self.results['errors'].append({
                    'property': 'All Properties',
                    'collector': 'Google Ads',
                    'error': 'No Google Ads data collected'
                })
            
            print()
            print(f'Google Ads Summary: ✅ {self.results["google_ads"]["success"]} | ⚠️  {self.results["google_ads"]["skipped"]} | ❌ {self.results["google_ads"]["failed"]}')
            print()
            total = self.results['google_ads']['success'] + self.results['google_ads']['failed'] + self.results['google_ads']['skipped']
            self._finish_collection_record(collection_id, 'google_ads', total)
            
        except ImportError as e:
            print(f'   ⚠️  Google Ads collector not available: {e}')
            self.results['google_ads']['skipped'] = 1
            print()
        except Exception as e:
            print(f'   ❌ Error collecting Google Ads data: {e}')
            self.results['google_ads']['failed'] = 1
            # Ensure collection record is closed if it was started
            if 'collection_id' in locals():
                total = self.results['google_ads']['success'] + self.results['google_ads']['failed'] + self.results['google_ads']['skipped']
                self._finish_collection_record(collection_id, 'google_ads', total)
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
                self.results['errors'].append({
                    'property': 'All Properties',
                    'collector': 'PSI',
                    'error': f'PSI exit code {result.returncode}'
                })
            
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
        print(f'  ThirtyLines:  ✅ {self.results["thirtylines"]["success"]} | ⚠️  {self.results["thirtylines"]["skipped"]} | ❌ {self.results["thirtylines"]["failed"]}')
        print(f'  Guest Card:   ✅ {self.results["guest_card"]["success"]} | ⚠️  {self.results["guest_card"]["skipped"]} | ❌ {self.results["guest_card"]["failed"]}')
        print()
        
        total_success = sum(self.results[cat]["success"] for cat in ['ga4', 'gsc', 'google_ads', 'psi', 'semrush', 'gtmetrix', 'gbp_reviews', 'gbp_insights', 'thirtylines', 'guest_card'])
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
        
    def run(self):
        """Main collection workflow"""
        try:
            # Prevent overlapping runs
            if self._acquire_run_lock() is None:
                print('⚠️  Another collection is already running. Exiting.')
                return 1

            # Apply schema migrations (safe no-ops if already applied)
            apply_migrations(self.db_path)

            # Watchdog: clean up any stale in-progress collections
            self._mark_stale_collections_failed()

            # Load properties
            properties = self.load_properties()
            properties_by_name = {p.get('name'): p for p in properties}

            # Initialize collectors (includes pre-flight credential check)
            self.initialize_collectors()

            # Collect GA4 data
            self.collect_ga4_data(properties)

            # Retry GA4 failures once
            ga4_failed_names = [e.get('property') for e in self.results.get('errors', []) if e.get('collector') == 'GA4']
            ga4_failed_props = [properties_by_name.get(n) for n in ga4_failed_names if properties_by_name.get(n)]
            if ga4_failed_props:
                print('🔁 Retrying GA4 failed properties...')
                self.collect_ga4_data(ga4_failed_props, collection_type='retry')

            # Small pause between collectors
            time.sleep(2)

            # Collect GSC data (main properties, excluding Cendana)
            self.collect_gsc_data(properties)

            # Retry GSC failures once
            gsc_failed_names = [e.get('property') for e in self.results.get('errors', []) if e.get('collector') == 'GSC']
            gsc_failed_props = [properties_by_name.get(n) for n in gsc_failed_names if properties_by_name.get(n)]
            if gsc_failed_props:
                print('🔁 Retrying GSC failed properties...')
                self.collect_gsc_data(gsc_failed_props)

            # Small pause
            time.sleep(2)
            
            # Small pause
            time.sleep(2)
            # Collect Google Ads data
            self.collect_google_ads_data()

            # Retry Google Ads once if no successes or failures present
            if (self.results['google_ads']['success'] == 0 and self.results['google_ads']['failed'] == 0) or self.results['google_ads']['failed'] > 0:
                print('🔁 Retrying Google Ads collection once...')
                self._backoff_sleep(1)
                self._reset_results_for('google_ads')
                self._clear_errors_for('Google Ads')
                self.collect_google_ads_data()
            
            # Small pause
            time.sleep(2)
            
            # Collect PSI data
            self.collect_psi_data()

            # Retry PSI once on failure
            if self.results['psi']['failed'] > 0 or self.results['psi']['success'] == 0:
                print('🔁 Retrying PSI collection once...')
                self._backoff_sleep(1)
                self._reset_results_for('psi')
                self._clear_errors_for('PSI')
                self.collect_psi_data()
            
            # Small pause
            time.sleep(2)
            
            # Collect GBP reviews (runs in both quick and full mode)
            self.collect_gbp_reviews()

            # Retry GBP reviews once on failure/zero success
            if self.results['gbp_reviews']['failed'] > 0 or self.results['gbp_reviews']['success'] == 0:
                print('🔁 Retrying GBP Reviews once...')
                self._backoff_sleep(1)
                self._reset_results_for('gbp_reviews')
                self._clear_errors_for('GBP Reviews')
                self.collect_gbp_reviews()
            
            # Small pause
            time.sleep(2)
            
            # Collect GBP insights (runs in both quick and full mode)
            self.collect_gbp_insights()

            # Retry GBP insights once on failure/zero success
            if self.results['gbp_insights']['failed'] > 0 or self.results['gbp_insights']['success'] == 0:
                print('🔁 Retrying GBP Insights once...')
                self._backoff_sleep(1)
                self._reset_results_for('gbp_insights')
                self._clear_errors_for('GBP Insights')
                self.collect_gbp_insights()
            
            # Small pause
            time.sleep(2)
            
            # Collect ThirtyLines data (runs in both quick and full mode)
            self.collect_thirtylines_data()

            # Collect Guest Card metrics (CSV ingest + archive)
            time.sleep(1)
            self.collect_guest_card_data()
            
            # Collect SEMRush data (runs in both quick and full mode)
            time.sleep(2)
            self.collect_semrush_data(properties)

            # Retry SEMRush failed properties once (if any)
            semrush_failed_names = [e.get('property') for e in self.results.get('errors', []) if e.get('collector') == 'SEMRush']
            semrush_failed_props = [properties_by_name.get(n) for n in semrush_failed_names if properties_by_name.get(n)]
            if semrush_failed_props:
                print('🔁 Retrying SEMRush failed properties...')
                self._backoff_sleep(1)
                self.collect_semrush_data(semrush_failed_props)
            
            # Collect SEMRush competitor snapshots (DB-backed PIB)
            self.collect_semrush_competitor_snapshots(properties)
            
            # Skip GTMetrix if flag set
            if not self.no_gtmetrix:
                # Small pause
                time.sleep(2)
                
                # Collect GTMetrix data
                self.collect_gtmetrix_data(properties)
                # Retry GTMetrix once on failure/zero success
                if self.results['gtmetrix']['failed'] > 0 or self.results['gtmetrix']['success'] == 0:
                    print('🔁 Retrying GTMetrix once...')
                    self._backoff_sleep(1)
                    self._reset_results_for('gtmetrix')
                    self._clear_errors_for('GTMetrix')
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

            # Guest Card metrics are collected for "today", so run a targeted
            # second pass for today's date and merge only guest-card anomalies.
            today = datetime.now().date()
            if today != yesterday:
                guest_today = self.anomaly_detector.detect_anomalies(today)
                guest_critical = [
                    a for a in guest_today.get('critical', [])
                    if str(a.get('metric', '')).startswith('guest_card_')
                ]
                guest_warnings = [
                    a for a in guest_today.get('warnings', [])
                    if str(a.get('metric', '')).startswith('guest_card_')
                ]
                if guest_critical or guest_warnings:
                    print(f'Guest Card anomalies for {today}: ❌ {len(guest_critical)} critical, ⚠️ {len(guest_warnings)} warnings')
                    anomalies['critical'].extend(guest_critical)
                    anomalies['warnings'].extend(guest_warnings)
            
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
            
            # PHASE 8: SEND DAILY COLLECTION REPORT
            print()
            print('=' * 80)
            print('📧 PHASE 8: DAILY COLLECTION SUMMARY REPORT')
            print('=' * 80)
            print()
            
            try:
                reporter = DailyCollectionReporter(test_mode=False)
                report_exit_code = reporter.run()
                
                if report_exit_code == 0:
                    print('✅ Daily collection report sent successfully')
                else:
                    print('⚠️  Daily report encountered issues (non-fatal)')
                    
            except Exception as e:
                print(f'❌ Daily report failed: {e}')
                print('   (Collection completed, but email report may not have been sent)')

            # Automatic requeue on critical validation failures
            if 'quality_result' in locals() and quality_result.returncode == 2:
                print()
                print('🔁 CRITICAL VALIDATION FAILURE: Re-queuing GA4/GSC/ThirtyLines/Guest Card once...')
                self._backoff_sleep(1)
                try:
                    self.collect_ga4_data(properties, collection_type='retry')
                    self.collect_gsc_data(properties)
                    self.collect_thirtylines_data()
                    self.collect_guest_card_data()
                except Exception as e:
                    print(f'⚠️  Re-queue attempt failed: {e}')
                try:
                    print('🔬 Re-running data quality validation after re-queue...')
                    quality_result = subprocess.run(
                        [sys.executable, str(quality_script)],
                        capture_output=True,
                        text=True,
                        timeout=120
                    )
                    print(quality_result.stdout)
                except Exception as e:
                    print(f'⚠️  Re-validation failed: {e}')
            
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
        finally:
            # Ensure any started collections are finalized for audit consistency
            self._finalize_any_open_collections()
            # Release run lock
            self._release_run_lock()
    

if __name__ == '__main__':
    test_mode = '--test' in sys.argv
    quick_mode = '--quick' in sys.argv
    no_gtmetrix = '--no-gtmetrix' in sys.argv
    collector = PortfolioDataCollector(test_mode=test_mode, quick_mode=quick_mode, no_gtmetrix=no_gtmetrix)
    sys.exit(collector.run())
