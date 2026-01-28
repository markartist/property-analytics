#!/usr/bin/env python3
"""
Google Business Profile (GBP) Data Collector
=============================================
Collects performance metrics from Google Business Profile Performance API.

Features:
- OAuth2 authentication
- Daily metrics collection (impressions, clicks, calls, directions)
- Monthly search keyword impressions
- Support for multiple locations
- Rate limiting and error handling

API Documentation:
https://developers.google.com/my-business/reference/performance/rest

Required OAuth Scope:
https://www.googleapis.com/auth/business.manage
"""

import json
import pickle
import logging
import requests
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# OAuth2 scope for Business Profile
SCOPES = ['https://www.googleapis.com/auth/business.manage']


class GoogleBusinessProfileCollector:
    """Collects performance data from Google Business Profile API."""
    
    def __init__(self, credentials_path: Path, token_path: Path):
        """Initialize GBP collector.
        
        Args:
            credentials_path: Path to OAuth2 client secrets JSON
            token_path: Path to save/load OAuth2 token pickle
        """
        self.credentials_path = credentials_path
        self.token_path = token_path
        self.service = None
        self.creds = None  # Store credentials for direct API calls
        self._initialize_service()
    
    def _initialize_service(self) -> None:
        """Initialize GBP API service with OAuth2 authentication."""
        try:
            creds = None
            
            # Load saved token if exists
            if self.token_path.exists():
                try:
                    with open(self.token_path, 'rb') as token:
                        creds = pickle.load(token)
                    logger.info("Loaded saved OAuth2 token")
                except Exception as e:
                    logger.warning(f"Error loading saved token: {e}")
            
            # Refresh or get new credentials
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    try:
                        creds.refresh(Request())
                        logger.info("Refreshed OAuth2 token")
                    except Exception as e:
                        logger.warning(f"Error refreshing token: {e}")
                        creds = None
                
                if not creds:
                    if not self.credentials_path.exists():
                        raise FileNotFoundError(f"Credentials not found: {self.credentials_path}")
                    
                    logger.info("Starting OAuth2 flow...")
                    flow = InstalledAppFlow.from_client_secrets_file(
                        str(self.credentials_path),
                        SCOPES
                    )
                    creds = flow.run_local_server(port=0)
                    logger.info("OAuth2 authentication completed")
                
                # Save credentials
                try:
                    with open(self.token_path, 'wb') as token:
                        pickle.dump(creds, token)
                    logger.info("OAuth2 token saved")
                except Exception as e:
                    logger.warning(f"Error saving token: {e}")
            
            # Store credentials for direct API calls (reviews use v4 API)
            self.creds = creds
            
            # Build service
            # Note: Using mybusiness v4 for now, will migrate to businessprofileperformance v1
            self.service = build('businessprofileperformance', 'v1', credentials=creds)
            logger.info("GBP API service initialized")
            
        except Exception as e:
            logger.error(f"Failed to initialize GBP service: {e}")
            raise
    
    def list_accounts(self) -> List[Dict]:
        """List all accessible GBP accounts.
        
        Returns:
            List of account dictionaries with name and account info
        """
        try:
            # Note: Account listing is in the v4 API
            # For Performance API, you need to know the location name beforehand
            logger.warning("Account listing requires Google My Business API v4")
            return []
        except HttpError as e:
            logger.error(f"Error listing accounts: {e}")
            return []
    
    def fetch_daily_metrics(
        self,
        location_name: str,
        start_date: datetime,
        end_date: datetime,
        metrics: Optional[List[str]] = None
    ) -> Dict:
        """Fetch daily metrics for a location.
        
        Args:
            location_name: GBP location resource name (e.g., "locations/12345")
            start_date: Start date for metrics
            end_date: End date for metrics
            metrics: List of metric names to fetch. If None, fetches all common metrics
        
        Returns:
            Dictionary with metric data by date
        """
        if metrics is None:
            # Default metrics for apartment/property businesses
            metrics = [
                'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
                'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
                'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
                'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
                'BUSINESS_CONVERSATIONS',
                'BUSINESS_DIRECTION_REQUESTS',
                'CALL_CLICKS',
                'WEBSITE_CLICKS',
            ]
        
        try:
            # Format dates
            start_date_str = start_date.strftime('%Y-%m-%d')
            end_date_str = end_date.strftime('%Y-%m-%d')
            
            logger.info(f"Fetching metrics for {location_name} ({start_date_str} to {end_date_str})")
            
            # Call fetchMultiDailyMetricsTimeSeries
            request = self.service.locations().fetchMultiDailyMetricsTimeSeries(
                location=location_name,
                body={
                    'dailyMetrics': metrics,
                    'dailyRange': {
                        'startDate': {
                            'year': start_date.year,
                            'month': start_date.month,
                            'day': start_date.day
                        },
                        'endDate': {
                            'year': end_date.year,
                            'month': end_date.month,
                            'day': end_date.day
                        }
                    }
                }
            )
            
            response = request.execute()
            
            # Parse response
            metrics_data = self._parse_daily_metrics_response(response)
            logger.info(f"Successfully fetched {len(metrics_data)} days of data")
            
            return metrics_data
            
        except HttpError as e:
            logger.error(f"HTTP error fetching daily metrics: {e}")
            return {}
        except Exception as e:
            logger.error(f"Error fetching daily metrics: {e}")
            return {}
    
    def _parse_daily_metrics_response(self, response: Dict) -> Dict:
        """Parse fetchMultiDailyMetricsTimeSeries response.
        
        Args:
            response: API response dictionary
        
        Returns:
            Dictionary mapping date strings to metric values
        """
        result = {}
        
        # Response structure: { "multiDailyMetricTimeSeries": [...] }
        time_series_list = response.get('multiDailyMetricTimeSeries', [])
        
        for time_series in time_series_list:
            metric_name = time_series.get('dailyMetric', 'UNKNOWN')
            
            # Get data points
            data_points = time_series.get('timeSeries', {}).get('datedValues', [])
            
            for point in data_points:
                # Extract date
                date_obj = point.get('date', {})
                date_str = f"{date_obj.get('year')}-{date_obj.get('month'):02d}-{date_obj.get('day'):02d}"
                
                # Extract value
                value = point.get('value', 0)
                
                # Initialize date entry if needed
                if date_str not in result:
                    result[date_str] = {}
                
                # Store metric value (convert metric name to lowercase with underscores)
                metric_key = metric_name.lower()
                result[date_str][metric_key] = value
        
        return result
    
    def fetch_monthly_search_keywords(
        self,
        location_name: str,
        year: int,
        month: int
    ) -> List[Dict]:
        """Fetch monthly search keyword impressions.
        
        Args:
            location_name: GBP location resource name
            year: Year (e.g., 2024)
            month: Month (1-12)
        
        Returns:
            List of dictionaries with keyword and impressions
        """
        try:
            logger.info(f"Fetching search keywords for {location_name} ({year}-{month:02d})")
            
            # Call listSearchKeywordImpressionsMonthly
            request = self.service.locations().searchkeywords().impressions().monthly().list(
                parent=location_name,
                monthlyRange_startMonth_year=year,
                monthlyRange_startMonth_month=month,
                monthlyRange_endMonth_year=year,
                monthlyRange_endMonth_month=month,
                pageSize=100  # Max results per page
            )
            
            keywords = []
            
            while request is not None:
                response = request.execute()
                
                # Parse search keyword data
                for item in response.get('searchKeywordsCounts', []):
                    keyword = item.get('searchKeyword', '')
                    impressions = item.get('insightsValue', {}).get('value', 0)
                    
                    keywords.append({
                        'keyword': keyword,
                        'impressions': impressions
                    })
                
                # Get next page
                request = self.service.locations().searchkeywords().impressions().monthly().list_next(
                    request, response
                )
            
            logger.info(f"Fetched {len(keywords)} search keywords")
            return keywords
            
        except HttpError as e:
            logger.error(f"HTTP error fetching search keywords: {e}")
            return []
        except Exception as e:
            logger.error(f"Error fetching search keywords: {e}")
            return []
    
    def get_location_info(self, location_name: str) -> Optional[Dict]:
        """Get basic information about a location.
        
        Args:
            location_name: GBP location resource name
        
        Returns:
            Dictionary with location information, or None if error
        """
        try:
            # Note: This requires Google My Business API v4, not Performance API
            logger.warning("Location info requires Google My Business API v4")
            return None
        except Exception as e:
            logger.error(f"Error getting location info: {e}")
            return None
    
    def fetch_reviews(
        self,
        account_id: str,
        location_id: str,
        page_size: int = 50,
        order_by: str = "updateTime desc"
    ) -> List[Dict]:
        """Fetch reviews for a location using v4 API.
        
        Args:
            account_id: GBP account ID (numeric)
            location_id: GBP location ID (numeric)
            page_size: Number of reviews per page (max 50)
            order_by: Sort order - "updateTime desc", "rating desc", "rating"
        
        Returns:
            List of review dictionaries with full details
        """
        try:
            # Reviews are on the v4 API endpoint
            url = f"https://mybusiness.googleapis.com/v4/accounts/{account_id}/locations/{location_id}/reviews"
            
            params = {
                'pageSize': min(page_size, 50),  # API max is 50
                'orderBy': order_by
            }
            
            headers = {
                'Authorization': f'Bearer {self.creds.token}',
                'Content-Type': 'application/json'
            }
            
            all_reviews = []
            page_token = None
            
            logger.info(f"Fetching reviews for account {account_id}, location {location_id}")
            
            while True:
                if page_token:
                    params['pageToken'] = page_token
                
                response = requests.get(url, headers=headers, params=params)
                
                if response.status_code != 200:
                    logger.error(f"Error fetching reviews: {response.status_code} - {response.text}")
                    break
                
                data = response.json()
                
                # Get reviews from response
                reviews = data.get('reviews', [])
                all_reviews.extend(reviews)
                
                logger.info(f"Fetched {len(reviews)} reviews (total: {len(all_reviews)})")
                
                # Check for next page
                page_token = data.get('nextPageToken')
                if not page_token:
                    break
            
            logger.info(f"Successfully fetched {len(all_reviews)} total reviews")
            return all_reviews
            
        except Exception as e:
            logger.error(f"Error fetching reviews: {e}")
            return []
    
    @staticmethod
    def parse_review(review: Dict) -> Dict:
        """Parse a review from the API response into a clean dictionary.
        
        Args:
            review: Raw review dictionary from API
        
        Returns:
            Cleaned review dictionary with normalized fields
        """
        # Convert star rating from enum to numeric
        star_rating_map = {
            'FIVE': 5,
            'FOUR': 4,
            'THREE': 3,
            'TWO': 2,
            'ONE': 1
        }
        
        star_rating = review.get('starRating', 'ONE')
        star_rating_numeric = star_rating_map.get(star_rating, 1)
        
        # Extract reviewer info
        reviewer = review.get('reviewer', {})
        
        # Extract reply info
        review_reply = review.get('reviewReply', {})
        has_reply = bool(review_reply.get('comment'))
        
        return {
            'review_id': review.get('reviewId'),
            'review_name': review.get('name'),
            'star_rating': star_rating,
            'star_rating_numeric': star_rating_numeric,
            'comment': review.get('comment'),
            'reviewer_display_name': reviewer.get('displayName'),
            'reviewer_profile_photo_url': reviewer.get('profilePhotoUrl'),
            'reviewer_is_anonymous': reviewer.get('isAnonymous', False),
            'has_reply': has_reply,
            'reply_comment': review_reply.get('comment'),
            'reply_update_time': review_reply.get('updateTime'),
            'review_create_time': review.get('createTime'),
            'review_update_time': review.get('updateTime')
        }
    
    def collect_property_metrics(
        self,
        property_id: str,
        gbp_location_id: str,
        days_back: int = 30
    ) -> Tuple[Dict, List[Dict]]:
        """Collect all metrics for a property.
        
        Args:
            property_id: Internal property ID (GA4 ID)
            gbp_location_id: GBP location resource name
            days_back: Number of days to collect (default 30)
        
        Returns:
            Tuple of (daily_metrics_dict, search_keywords_list)
        """
        end_date = datetime.now() - timedelta(days=1)  # Yesterday
        start_date = end_date - timedelta(days=days_back - 1)
        
        # Fetch daily metrics
        daily_metrics = self.fetch_daily_metrics(
            location_name=gbp_location_id,
            start_date=start_date,
            end_date=end_date
        )
        
        # Fetch search keywords for current month
        now = datetime.now()
        search_keywords = self.fetch_monthly_search_keywords(
            location_name=gbp_location_id,
            year=now.year,
            month=now.month
        )
        
        return daily_metrics, search_keywords


# Example usage and testing
if __name__ == "__main__":
    print("=" * 80)
    print("GOOGLE BUSINESS PROFILE COLLECTOR - TEST MODE")
    print("=" * 80)
    print()
    
    # Example paths (update with actual paths)
    creds_path = Path("credentials/client_secret_gbp.json")
    token_path = Path("credentials/gbp_token.pickle")
    
    if not creds_path.exists():
        print(f"❌ Credentials not found at {creds_path}")
        print()
        print("Setup instructions:")
        print("1. Go to Google Cloud Console")
        print("2. Enable Business Profile Performance API")
        print("3. Create OAuth 2.0 credentials")
        print("4. Download as JSON and save to credentials/client_secret_gbp.json")
        exit(1)
    
    try:
        collector = GoogleBusinessProfileCollector(creds_path, token_path)
        print("✅ Collector initialized successfully")
        print()
        
        # Test with a location (you need to provide an actual location ID)
        test_location = "locations/YOUR_LOCATION_ID"
        print(f"📍 Testing with location: {test_location}")
        print()
        
        # Fetch last 7 days
        end_date = datetime.now() - timedelta(days=1)
        start_date = end_date - timedelta(days=6)
        
        metrics = collector.fetch_daily_metrics(test_location, start_date, end_date)
        
        if metrics:
            print(f"✅ Fetched {len(metrics)} days of metrics")
            for date_str, values in sorted(metrics.items()):
                print(f"  {date_str}: {values}")
        else:
            print("⚠️  No metrics returned")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
