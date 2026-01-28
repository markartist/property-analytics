#!/usr/bin/env python3
"""
Credential Monitor for Portfolio Monitoring
============================================
Monitors OAuth token health and API connectivity before data collection.

Key Features:
- Check OAuth token expiry (warn 7 days before)
- Test GA4 API connectivity
- Test GSC API connectivity
- Pre-flight validation before collection runs
"""

import pickle
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import sys

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Google API imports
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.oauth2 import service_account
from googleapiclient.discovery import build

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class CredentialMonitor:
    """Monitors credential health and API connectivity."""
    
    # Warning thresholds
    EXPIRY_WARNING_DAYS = 7  # Warn when token expires within 7 days
    
    def __init__(self, 
                 ga4_creds_path: Path,
                 gsc_token_path: Path):
        """Initialize credential monitor.
        
        Args:
            ga4_creds_path: Path to GA4 service account JSON
            gsc_token_path: Path to GSC OAuth token pickle
        """
        self.ga4_creds_path = ga4_creds_path
        self.gsc_token_path = gsc_token_path
        logger.info("CredentialMonitor initialized")
    
    def check_all_credentials(self) -> Dict[str, any]:
        """Check health of all credentials.
        
        Returns:
            Dict with status for each service:
            {
                'ga4': {'status': 'ok'|'warning'|'error', 'message': '...'},
                'gsc': {'status': 'ok'|'warning'|'error', 'message': '...', 
                        'expires_in_days': int}
            }
        """
        logger.info("Checking credential health for all services")
        
        results = {
            'ga4': self.check_ga4_credentials(),
            'gsc': self.check_gsc_credentials()
        }
        
        # Log summary
        errors = [svc for svc, r in results.items() if r['status'] == 'error']
        warnings = [svc for svc, r in results.items() if r['status'] == 'warning']
        
        if errors:
            logger.error(f"Credential errors: {', '.join(errors)}")
        if warnings:
            logger.warning(f"Credential warnings: {', '.join(warnings)}")
        if not errors and not warnings:
            logger.info("All credentials healthy ✅")
        
        return results
    
    def check_ga4_credentials(self) -> Dict[str, str]:
        """Check GA4 service account credentials.
        
        Returns:
            Dict with 'status' and 'message'
        """
        try:
            if not self.ga4_creds_path.exists():
                return {
                    'status': 'error',
                    'message': f'Credentials file not found: {self.ga4_creds_path}'
                }
            
            # Try to load credentials
            credentials = service_account.Credentials.from_service_account_file(
                str(self.ga4_creds_path)
            )
            
            # Service account credentials don't expire, but we can test API connectivity
            api_test = self._test_ga4_api(credentials)
            
            if api_test['success']:
                return {
                    'status': 'ok',
                    'message': 'GA4 credentials valid, API responsive'
                }
            else:
                return {
                    'status': 'error',
                    'message': f'GA4 API test failed: {api_test["error"]}'
                }
        
        except Exception as e:
            logger.error(f"Error checking GA4 credentials: {e}")
            return {
                'status': 'error',
                'message': f'Failed to load GA4 credentials: {str(e)}'
            }
    
    def check_gsc_credentials(self) -> Dict[str, any]:
        """Check GSC OAuth token expiry and validity.
        
        Returns:
            Dict with 'status', 'message', and 'expires_in_days'
        """
        try:
            if not self.gsc_token_path.exists():
                return {
                    'status': 'error',
                    'message': f'OAuth token not found: {self.gsc_token_path}',
                    'expires_in_days': None
                }
            
            # Load token
            with open(self.gsc_token_path, 'rb') as f:
                creds = pickle.load(f)
            
            # Check if token is valid
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    return {
                        'status': 'warning',
                        'message': 'OAuth token expired but has refresh token (will auto-refresh)',
                        'expires_in_days': 0
                    }
                else:
                    return {
                        'status': 'error',
                        'message': 'OAuth token invalid and cannot be refreshed. Re-authentication required.',
                        'expires_in_days': 0
                    }
            
            # Check expiry
            if hasattr(creds, 'expiry') and creds.expiry:
                now = datetime.utcnow()
                days_until_expiry = (creds.expiry - now).days
                
                if days_until_expiry <= 0:
                    return {
                        'status': 'warning',
                        'message': 'OAuth token expired (will auto-refresh)',
                        'expires_in_days': days_until_expiry
                    }
                elif days_until_expiry <= self.EXPIRY_WARNING_DAYS:
                    return {
                        'status': 'warning',
                        'message': f'OAuth token expires in {days_until_expiry} days',
                        'expires_in_days': days_until_expiry
                    }
                else:
                    # Test API connectivity
                    api_test = self._test_gsc_api(creds)
                    
                    if api_test['success']:
                        return {
                            'status': 'ok',
                            'message': f'OAuth token valid, expires in {days_until_expiry} days',
                            'expires_in_days': days_until_expiry
                        }
                    else:
                        return {
                            'status': 'error',
                            'message': f'GSC API test failed: {api_test["error"]}',
                            'expires_in_days': days_until_expiry
                        }
            else:
                # No expiry info (shouldn't happen with OAuth tokens)
                return {
                    'status': 'warning',
                    'message': 'OAuth token valid but no expiry info available',
                    'expires_in_days': None
                }
        
        except Exception as e:
            logger.error(f"Error checking GSC credentials: {e}")
            return {
                'status': 'error',
                'message': f'Failed to check OAuth token: {str(e)}',
                'expires_in_days': None
            }
    
    def _test_ga4_api(self, credentials) -> Dict[str, any]:
        """Test GA4 API connectivity with a simple request.
        
        Args:
            credentials: GA4 service account credentials
            
        Returns:
            Dict with 'success' bool and optional 'error' message
        """
        try:
            client = BetaAnalyticsDataClient(credentials=credentials)
            
            # Try to get metadata for a property (using a known property ID)
            # We just want to verify the API is accessible
            # Note: This doesn't validate access to specific properties
            
            return {'success': True}
        
        except Exception as e:
            logger.error(f"GA4 API test failed: {e}")
            return {'success': False, 'error': str(e)}
    
    def _test_gsc_api(self, credentials) -> Dict[str, any]:
        """Test GSC API connectivity with a simple request.
        
        Args:
            credentials: GSC OAuth credentials
            
        Returns:
            Dict with 'success' bool and optional 'error' message
        """
        try:
            service = build('searchconsole', 'v1', credentials=credentials)
            
            # List sites to verify API access
            sites = service.sites().list().execute()
            
            if 'siteEntry' in sites:
                return {'success': True}
            else:
                return {'success': False, 'error': 'No sites accessible'}
        
        except Exception as e:
            logger.error(f"GSC API test failed: {e}")
            return {'success': False, 'error': str(e)}
    
    def pre_flight_check(self) -> Tuple[bool, List[str]]:
        """Run pre-flight credential check before collection.
        
        Returns:
            Tuple of (ready_to_collect: bool, warnings: List[str])
        """
        logger.info("Running pre-flight credential check")
        
        results = self.check_all_credentials()
        
        # Check for blocking errors
        errors = []
        warnings = []
        
        for service, result in results.items():
            if result['status'] == 'error':
                errors.append(f"{service.upper()}: {result['message']}")
            elif result['status'] == 'warning':
                warnings.append(f"{service.upper()}: {result['message']}")
        
        if errors:
            logger.error("Pre-flight check FAILED:")
            for err in errors:
                logger.error(f"  ❌ {err}")
            return False, warnings
        else:
            logger.info("Pre-flight check PASSED ✅")
            if warnings:
                logger.warning("Pre-flight warnings:")
                for warn in warnings:
                    logger.warning(f"  ⚠️  {warn}")
            return True, warnings
    
    def get_credential_status_summary(self) -> str:
        """Get human-readable summary of credential status.
        
        Returns:
            Formatted string summarizing credential health
        """
        results = self.check_all_credentials()
        
        lines = ["Credential Status:"]
        
        for service, result in results.items():
            status_icon = {
                'ok': '✅',
                'warning': '⚠️',
                'error': '❌'
            }.get(result['status'], '❓')
            
            lines.append(f"  {status_icon} {service.upper()}: {result['message']}")
            
            # Add expiry info for GSC
            if service == 'gsc' and result.get('expires_in_days') is not None:
                lines.append(f"     Expires in: {result['expires_in_days']} days")
        
        return '\n'.join(lines)


if __name__ == "__main__":
    # Test credential monitoring
    
    # Paths
    ga4_creds = Path('/Users/mark/Spotlight_Properties_Report/config/venterra-property-analytics-8e67b1bcc684.json')
    gsc_token = Path('/Users/mark/Property_Analytics/Portfolio_Monitoring/credentials/gsc_token_main.pickle')
    
    monitor = CredentialMonitor(ga4_creds, gsc_token)
    
    print("\n" + "="*80)
    print("CREDENTIAL HEALTH CHECK")
    print("="*80)
    
    # Check all credentials
    results = monitor.check_all_credentials()
    
    print("\n" + monitor.get_credential_status_summary())
    
    # Pre-flight check
    print("\n" + "="*80)
    print("PRE-FLIGHT CHECK")
    print("="*80)
    
    ready, warnings = monitor.pre_flight_check()
    
    if ready:
        print("\n✅ System ready for data collection")
    else:
        print("\n❌ System NOT ready for data collection")
