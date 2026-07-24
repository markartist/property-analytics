#!/usr/bin/env python3
"""
Google Search Console OAuth Setup
==================================

This script will:
1. Open a browser for Google OAuth authorization
2. Save the token for future use
3. Test GSC API access

Run this once to authorize, then automated scripts can use GSC API.
"""

import os
import json
from pathlib import Path
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

# OAuth scope for Search Console
SCOPES = ['https://www.googleapis.com/auth/webmasters']

# Paths
PARENT_DIR = Path(__file__).parent
CREDENTIALS_DIR = PARENT_DIR / "credentials"
TOKEN_PATH = PARENT_DIR / "Spotlight_Properties_Report" / "token.json"

# Find OAuth client secret
client_secrets = list(CREDENTIALS_DIR.glob("client_secret*.json"))
if not client_secrets:
    print("❌ No OAuth client secret found in credentials/")
    print("   Looking for: client_secret*.json")
    exit(1)

CLIENT_SECRET = client_secrets[0]
print(f"✅ Found OAuth credentials: {CLIENT_SECRET.name}")


def get_credentials():
    """Get or refresh OAuth credentials."""
    creds = None
    
    # Check if we already have a token
    if TOKEN_PATH.exists():
        print(f"\n📄 Found existing token at: {TOKEN_PATH}")
        try:
            creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
            print("✅ Loaded existing credentials")
        except Exception as e:
            print(f"⚠️  Could not load token: {e}")
            creds = None
    
    # If no valid credentials, let's get new ones
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("\n🔄 Refreshing expired credentials...")
            try:
                creds.refresh(Request())
                print("✅ Credentials refreshed")
            except Exception as e:
                print(f"⚠️  Refresh failed: {e}")
                creds = None
        
        if not creds:
            print("\n🌐 Starting OAuth flow...")
            print("   A browser window will open for authorization")
            print("   Please sign in and grant access to Google Search Console")
            
            flow = InstalledAppFlow.from_client_secrets_file(
                str(CLIENT_SECRET),
                SCOPES
            )
            
            # Run local server for OAuth callback
            creds = flow.run_local_server(port=8080)
            print("\n✅ Authorization successful!")
        
        # Save the credentials for future use
        TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(TOKEN_PATH, 'w') as token:
            token.write(creds.to_json())
        print(f"✅ Token saved to: {TOKEN_PATH}")
    
    return creds


def test_gsc_access(creds):
    """Test GSC API access by listing sites."""
    print("\n🧪 Testing GSC API access...")
    
    try:
        # Build GSC service
        service = build('searchconsole', 'v1', credentials=creds)
        
        # List sites
        sites = service.sites().list().execute()
        
        if 'siteEntry' in sites:
            site_count = len(sites['siteEntry'])
            print(f"✅ GSC API is working!")
            print(f"   Found {site_count} sites/properties\n")
            
            # Show first 5 sites
            print("📊 Sample sites:")
            for i, site in enumerate(sites['siteEntry'][:5]):
                url = site.get('siteUrl', 'Unknown')
                permission = site.get('permissionLevel', 'Unknown')
                print(f"   {i+1}. {url} ({permission})")
            
            if site_count > 5:
                print(f"   ... and {site_count - 5} more")
            
            return True
        else:
            print("⚠️  No sites found. Make sure your account has GSC properties.")
            return False
            
    except Exception as e:
        print(f"❌ GSC API test failed: {str(e)}")
        return False


def main():
    print("\n" + "="*70)
    print("GOOGLE SEARCH CONSOLE - OAUTH SETUP")
    print("="*70)
    
    # Get credentials (will prompt for OAuth if needed)
    creds = get_credentials()
    
    if not creds:
        print("\n❌ Failed to get credentials")
        return
    
    # Test access
    success = test_gsc_access(creds)
    
    if success:
        print("\n" + "="*70)
        print("✅ SETUP COMPLETE!")
        print("="*70)
        print("\nYou can now use GSC API in your scripts.")
        print(f"Token location: {TOKEN_PATH}")
        print("\nNext steps:")
        print("  1. Test GSC collector in daily collection script")
        print("  2. Set up cron job for automated collection")
    else:
        print("\n" + "="*70)
        print("⚠️  SETUP INCOMPLETE")
        print("="*70)
        print("\nOAuth succeeded but API test failed.")
        print("Check that your Google account has GSC access.")


if __name__ == "__main__":
    main()
