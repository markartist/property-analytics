#!/usr/bin/env python3
"""
Google Search Console Data Collector

Collects SEO performance metrics from Google Search Console API including:
- Click-through rates and impressions
- Average search positions
- Core Web Vitals data
- Mobile usability issues
- Coverage and indexing status

Integrates with the Spotlight Properties pipeline for comprehensive SEO analysis.

Author: Spotlight Properties System
Date: October 2025
"""

import os
import sys
import json
import time
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from google.oauth2 import service_account
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import pickle
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from utils.keeper_file_materializer import materialize_keeper_file


class GoogleSearchConsoleCollector:
    """Collects SEO performance data from Google Search Console API"""

    def __init__(self):
        """Initialize the GSC collector with authentication"""
        # No caching needed for daily scheduled collection

        # Setup logging
        self.setup_logging()

        # Initialize GSC service
        self.service = self._initialize_gsc_service()

        # Date ranges for data collection
        self.today = datetime.now().date()
        self.t7_start = self.today - timedelta(days=7)  # 7 days ago
        self.t7_end = self.today - timedelta(days=1)    # Yesterday
        self.t30_start = self.today - timedelta(days=30) # 30 days ago
        self.t30_end = self.today - timedelta(days=8)   # 8 days ago

    def setup_logging(self):
        """Setup logging for GSC operations"""
        log_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'logs')
        os.makedirs(log_dir, exist_ok=True)

        log_file = os.path.join(log_dir, 'gsc_collector.log')

        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler(sys.stdout)
            ]
        )

        self.logger = logging.getLogger(__name__)

    def _initialize_gsc_service(self):
        """Initialize Google Search Console API service"""

        try:
            credentials = None

            # Try OAuth credentials first
            oauth_creds_path = materialize_keeper_file(
                uid_env_var='KSM_GSC_CLIENT_SECRET_UID',
                fallback_path=os.path.join(
                    os.path.dirname(__file__),
                    '..',
                    '..',
                    'config',
                    'client_secret_911627664995-s8derelblr6nfpf7hg8di7bs338jica5.apps.googleusercontent.com.json',
                ),
            )
            token_path = materialize_keeper_file(
                uid_env_var='KSM_GSC_TOKEN_UID',
                fallback_path=os.path.join(os.path.dirname(__file__), '..', '..', 'config', 'gsc_token.pickle'),
            )

            if Path(oauth_creds_path).exists():
                credentials = self._get_oauth_credentials(str(oauth_creds_path), str(token_path))
                if credentials:
                    self.logger.info("✅ Using OAuth credentials for GSC API")

            # Fallback to service account credentials
            if not credentials:
                credentials_paths = [
                    os.path.join(os.path.dirname(__file__), '..', '..', 'config', 'gsc_credentials.json'),
                    os.path.join(os.path.dirname(__file__), '..', '..', 'config', 'service_account.json'),
                    os.path.join(os.path.dirname(__file__), '..', 'collectors', 'ga4_analytics', 'service_account.json')
                ]

                credentials_file = None
                for path in credentials_paths:
                    if os.path.exists(path):
                        credentials_file = path
                        break

                if credentials_file:
                    # Load service account credentials
                    credentials = service_account.Credentials.from_service_account_file(
                        credentials_file,
                        scopes=['https://www.googleapis.com/auth/webmasters']
                    )
                    self.logger.info("✅ Using service account credentials for GSC API")

            if not credentials:
                self.logger.warning("No GSC credentials found. GSC data collection will be skipped.")
                return None

            # Build GSC service
            service = build('searchconsole', 'v1', credentials=credentials)

            self.logger.info("✅ Google Search Console service initialized successfully")
            return service

        except Exception as e:
            self.logger.error(f"❌ Failed to initialize GSC service: {e}")
            return None

    def _get_oauth_credentials(self, credentials_path: str, token_path: str):
        """Get OAuth credentials with automatic refresh"""

        SCOPES = ['https://www.googleapis.com/auth/webmasters']

        creds = None

        # Check if we have a saved token
        if os.path.exists(token_path):
            try:
                with open(token_path, 'rb') as token:
                    creds = pickle.load(token)
            except Exception as e:
                self.logger.warning(f"Error loading saved token: {e}")

        # If there are no valid credentials, get new ones
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                try:
                    creds.refresh(Request())
                    self.logger.info("🔄 Refreshed OAuth token")
                except Exception as e:
                    self.logger.warning(f"Error refreshing token: {e}")
                    creds = None

            if not creds:
                try:
                    flow = InstalledAppFlow.from_client_secrets_file(
                        credentials_path, SCOPES)
                    creds = flow.run_local_server(port=0)
                    self.logger.info("🔐 New OAuth authentication completed")
                except Exception as e:
                    self.logger.error(f"OAuth flow failed: {e}")
                    return None

            # Save the credentials for the next run
            try:
                with open(token_path, 'wb') as token:
                    pickle.dump(creds, token)
                self.logger.info("💾 OAuth token saved")
            except Exception as e:
                self.logger.warning(f"Error saving token: {e}")

        return creds

    def get_property_gsc_url(self, property_name: str) -> Optional[str]:
        """Get the GSC property URL from configuration"""

        try:
            config_path = os.path.join(os.path.dirname(__file__), '..', '..', 'config', 'spotlight_properties.json')

            with open(config_path, 'r') as f:
                properties_config = json.load(f)

            spotlight_properties = properties_config.get('spotlight_properties', {})
            property_config = spotlight_properties.get(property_name, {})
            gsc_url = property_config.get('gsc_url')

            if not gsc_url:
                # Try to derive from full_url - use the specific URL for granular data
                full_url = property_config.get('full_url', '')
                if full_url:
                    # Use the full URL as GSC property for property-specific data
                    if full_url.startswith('https://'):
                        # Preserve the exact URL format - GSC needs exact matches
                        gsc_url = full_url

            return gsc_url

        except Exception as e:
            self.logger.error(f"Failed to get GSC URL for {property_name}: {e}")
            return None

    def collect_search_analytics(self, gsc_url: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Collect comprehensive search analytics data for a specific date range"""

        if not self.service:
            return {}

        try:
            # Collect overall data
            overall_request = {
                'startDate': start_date.strftime('%Y-%m-%d'),
                'endDate': end_date.strftime('%Y-%m-%d'),
                'dimensions': ['date'],
                'searchType': 'web',
                'aggregationType': 'auto'
            }

            overall_response = self.service.searchanalytics().query(
                siteUrl=gsc_url,
                body=overall_request
            ).execute()

            # Collect device breakdown data
            device_request = {
                'startDate': start_date.strftime('%Y-%m-%d'),
                'endDate': end_date.strftime('%Y-%m-%d'),
                'dimensions': ['device'],
                'searchType': 'web',
                'aggregationType': 'auto'
            }

            device_response = self.service.searchanalytics().query(
                siteUrl=gsc_url,
                body=device_request
            ).execute()

            # Collect top queries data
            queries_request = {
                'startDate': start_date.strftime('%Y-%m-%d'),
                'endDate': end_date.strftime('%Y-%m-%d'),
                'dimensions': ['query'],
                'searchType': 'web',
                'aggregationType': 'auto',
                'rowLimit': 10  # Top 10 queries
            }

            queries_response = self.service.searchanalytics().query(
                siteUrl=gsc_url,
                body=queries_request
            ).execute()

            # Process overall data
            overall_rows = overall_response.get('rows', [])
            if not overall_rows:
                return self._get_empty_search_analytics()

            total_clicks = sum(row.get('clicks', 0) for row in overall_rows)
            total_impressions = sum(row.get('impressions', 0) for row in overall_rows)
            avg_ctr = sum(row.get('ctr', 0) for row in overall_rows) / len(overall_rows) if overall_rows else 0
            avg_position = sum(row.get('position', 0) for row in overall_rows) / len(overall_rows) if overall_rows else 0

            # Process device data
            device_data = {}
            for row in device_response.get('rows', []):
                device = row['keys'][0]
                device_data[device] = {
                    'clicks': row.get('clicks', 0),
                    'impressions': row.get('impressions', 0),
                    'ctr': row.get('ctr', 0) * 100,
                    'position': round(row.get('position', 0), 1)
                }

            # Process top queries
            top_queries = []
            for row in queries_response.get('rows', []):
                query = row['keys'][0]
                top_queries.append({
                    'query': query,
                    'clicks': row.get('clicks', 0),
                    'impressions': row.get('impressions', 0),
                    'ctr': row.get('ctr', 0) * 100,
                    'position': round(row.get('position', 0), 1)
                })

            return {
                'clicks': total_clicks,
                'impressions': total_impressions,
                'ctr': avg_ctr * 100,
                'position': round(avg_position, 1),
                'device_breakdown': device_data,
                'top_queries': top_queries
            }

        except HttpError as e:
            self.logger.error(f"GSC API error for {gsc_url}: {e}")
            return self._get_empty_search_analytics()
        except Exception as e:
            self.logger.error(f"Unexpected error collecting GSC data for {gsc_url}: {e}")
            return self._get_empty_search_analytics()

    def _get_empty_search_analytics(self) -> Dict[str, Any]:
        """Return empty search analytics structure"""
        return {
            'clicks': 0,
            'impressions': 0,
            'ctr': 0.0,
            'position': 0.0,
            'device_breakdown': {},
            'top_queries': []
        }

    def collect_core_web_vitals(self, gsc_url: str) -> Dict[str, Any]:
        """Collect Core Web Vitals data"""

        if not self.service:
            return {}

        try:
            # Get Core Web Vitals data (last 30 days)
            response = self.service.sites().get(siteUrl=gsc_url).execute()

            # Note: Core Web Vitals data requires different API endpoints
            # For now, return placeholder structure
            return {
                'lcp_good': 0,
                'lcp_needs_improvement': 0,
                'lcp_poor': 0,
                'fid_good': 0,
                'fid_needs_improvement': 0,
                'fid_poor': 0,
                'cls_good': 0,
                'cls_needs_improvement': 0,
                'cls_poor': 0
            }

        except Exception as e:
            self.logger.warning(f"Core Web Vitals data not available for {gsc_url}: {e}")
            return {}

    def get_gsc_property_data(self, property_name: str) -> Dict[str, Any]:
        """Get comprehensive GSC data for a property"""

        # Check cache first
        cached_data = self.cache.get_cached_data(property_name, "gsc")

        if cached_data:
            self.logger.info(f"Using cached GSC data for {property_name}")
            return cached_data

        # Get GSC URL for property
        gsc_url = self.get_property_gsc_url(property_name)

        if not gsc_url:
            self.logger.warning(f"No GSC URL configured for {property_name}")
            return self._get_default_gsc_data()

        self.logger.info(f"🔍 Collecting GSC data for {property_name} ({gsc_url})")

        try:
            # Collect T7 data (last 7 days)
            t7_data = self.collect_search_analytics(gsc_url, self.t7_start, self.t7_end)

            # Collect T30 data (previous 7 days, 30 days ago)
            t30_data = self.collect_search_analytics(gsc_url, self.t30_start, self.t30_end)

            # Collect Core Web Vitals
            cwv_data = self.collect_core_web_vitals(gsc_url)

            # Calculate deltas
            clicks_delta = self._calculate_percentage_change(
                t7_data.get('clicks', 0),
                t30_data.get('clicks', 0)
            )

            impressions_delta = self._calculate_percentage_change(
                t7_data.get('impressions', 0),
                t30_data.get('impressions', 0)
            )

            ctr_delta = self._calculate_absolute_change(
                t7_data.get('ctr', 0),
                t30_data.get('ctr', 0)
            )

            position_delta = self._calculate_absolute_change(
                t7_data.get('position', 0),
                t30_data.get('position', 0)
            )

            # Calculate mobile vs desktop metrics
            mobile_data = t7_data.get('device_breakdown', {}).get('mobile', {})
            desktop_data = t7_data.get('device_breakdown', {}).get('desktop', {})

            # Compile comprehensive data
            gsc_data = {
                # Current period (T7)
                't7_clicks': t7_data.get('clicks', 0),
                't7_impressions': t7_data.get('impressions', 0),
                't7_ctr': t7_data.get('ctr', 0),
                't7_position': t7_data.get('position', 0),

                # Comparison period (T30)
                't30_clicks': t30_data.get('clicks', 0),
                't30_impressions': t30_data.get('impressions', 0),
                't30_ctr': t30_data.get('ctr', 0),
                't30_position': t30_data.get('position', 0),

                # Deltas
                'clicks_delta': clicks_delta,
                'impressions_delta': impressions_delta,
                'ctr_delta': ctr_delta,
                'position_delta': position_delta,

                # Device breakdown (T7)
                'mobile_clicks': mobile_data.get('clicks', 0),
                'mobile_impressions': mobile_data.get('impressions', 0),
                'mobile_ctr': mobile_data.get('ctr', 0),
                'mobile_position': mobile_data.get('position', 0),
                'desktop_clicks': desktop_data.get('clicks', 0),
                'desktop_impressions': desktop_data.get('impressions', 0),
                'desktop_ctr': desktop_data.get('ctr', 0),
                'desktop_position': desktop_data.get('position', 0),

                # Mobile traffic percentage
                'mobile_percentage': round(
                    (mobile_data.get('clicks', 0) / max(t7_data.get('clicks', 1), 1)) * 100, 1
                ),

                # Top performing queries
                'top_queries': t7_data.get('top_queries', [])[:5],  # Top 5 queries

                # Core Web Vitals
                'core_web_vitals': cwv_data,

                # Metadata
                '_source': 'gsc_api',
                '_collected_at': datetime.now().isoformat(),
                '_gsc_url': gsc_url
            }

            # Cache the data
            self.cache.store_data(property_name, gsc_data, "gsc")

            self.logger.info(f"✅ GSC data collected for {property_name}: "
                           f"{t7_data.get('clicks', 0)} clicks, "
                           f"{t7_data.get('impressions', 0)} impressions, "
                           f"{t7_data.get('ctr', 0):.1f}% CTR")

            return gsc_data

        except Exception as e:
            self.logger.error(f"Failed to collect GSC data for {property_name}: {e}")
            return self._get_default_gsc_data()

    def _calculate_percentage_change(self, current: float, previous: float) -> float:
        """Calculate percentage change between two values"""
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return round(((current - previous) / previous) * 100, 1)

    def _calculate_absolute_change(self, current: float, previous: float) -> float:
        """Calculate absolute change between two values"""
        return round(current - previous, 2)

    def _get_default_gsc_data(self) -> Dict[str, Any]:
        """Return default GSC data structure when collection fails"""
        return {
            't7_clicks': 0,
            't7_impressions': 0,
            't7_ctr': 0.0,
            't7_position': 0.0,
            't30_clicks': 0,
            't30_impressions': 0,
            't30_ctr': 0.0,
            't30_position': 0.0,
            'clicks_delta': 0.0,
            'impressions_delta': 0.0,
            'ctr_delta': 0.0,
            'position_delta': 0.0,
            'mobile_clicks': 0,
            'mobile_impressions': 0,
            'mobile_ctr': 0.0,
            'mobile_position': 0.0,
            'desktop_clicks': 0,
            'desktop_impressions': 0,
            'desktop_ctr': 0.0,
            'desktop_position': 0.0,
            'mobile_percentage': 0.0,
            'top_queries': [],
            'core_web_vitals': {},
            '_source': 'default_gsc_data',
            '_collected_at': datetime.now().isoformat()
        }

    def collect_all_properties_data(self) -> Dict[str, Dict[str, Any]]:
        """Collect GSC data for all configured properties"""

        if not self.service:
            self.logger.warning("GSC service not available - skipping GSC collection")
            return {}

        self.logger.info("🚀 Starting Google Search Console data collection")

        # Load properties configuration
        try:
            config_path = os.path.join(os.path.dirname(__file__), '..', '..', 'config', 'spotlight_properties.json')

            with open(config_path, 'r') as f:
                properties_config = json.load(f)

        except Exception as e:
            self.logger.error(f"Failed to load properties configuration: {e}")
            return {}

        gsc_data = {}
        successful_collections = 0

        spotlight_properties = properties_config.get('spotlight_properties', {})

        for property_name, config in spotlight_properties.items():
            if not config.get('active', True):
                continue

            try:
                property_gsc_data = self.get_gsc_property_data(property_name)
                gsc_data[property_name] = property_gsc_data

                if property_gsc_data.get('_source') == 'gsc_api':
                    successful_collections += 1

            except Exception as e:
                self.logger.error(f"Failed to collect GSC data for {property_name}: {e}")
                gsc_data[property_name] = self._get_default_gsc_data()

        self.logger.info(f"✅ GSC collection completed: {successful_collections}/{len(gsc_data)} properties with fresh data")

        return gsc_data


def main():
    """Test the GSC collector"""
    collector = GoogleSearchConsoleCollector()

    # Test with a single property
    test_property = "Apex West Midtown"  # Replace with actual property name

    print(f"🧪 Testing GSC data collection for: {test_property}")

    data = collector.get_gsc_property_data(test_property)

    print("📊 GSC Data Results:")
    print(json.dumps(data, indent=2))


if __name__ == "__main__":
    main()
