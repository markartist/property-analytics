#!/usr/bin/env python3
"""
Test script to fetch reviews for Apex West Midtown using Google My Business API v4
"""

import os
import sys
import pickle
import requests
import json
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow

# OAuth 2.0 scope for reviews
SCOPES = ['https://www.googleapis.com/auth/business.manage']

def get_credentials():
    """Get or refresh OAuth credentials"""
    creds = None
    token_path = 'credentials/gbp_token.pickle'
    
    # Load existing token if it exists
    if os.path.exists(token_path):
        with open(token_path, 'rb') as token:
            creds = pickle.load(token)
    
    # If there are no (valid) credentials available, let the user log in
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials/client_secret.json', SCOPES)
            creds = flow.run_local_server(port=0)
        # Save the credentials for the next run
        with open(token_path, 'wb') as token:
            pickle.dump(creds, token)
    
    return creds

def main():
    print("=== Testing Google My Business Reviews API ===")
    print("\nProject: authentic-reach-474618-r6")
    print("Account: 107949533411154656301 (Venterra Realty)")
    print("Location: Apex West Midtown (17062706106317913185)")
    
    # Get credentials
    creds = get_credentials()
    
    # Prepare headers
    headers = {
        'Authorization': f'Bearer {creds.token}',
        'Content-Type': 'application/json'
    }
    
    # Account and location IDs from approved access
    account_id = "107949533411154656301"
    location_id = "17062706106317913185"
    
    # Try v4 API endpoint for reviews
    reviews_url = f"https://mybusiness.googleapis.com/v4/accounts/{account_id}/locations/{location_id}/reviews"
    
    print(f"\n=== Testing v4 Reviews Endpoint ===")
    print(f"URL: {reviews_url}")
    
    reviews_response = requests.get(reviews_url, headers=headers)
    
    print(f"\nStatus Code: {reviews_response.status_code}")
    
    if reviews_response.status_code == 200:
        reviews_data = reviews_response.json()
        print(f"\n✅ SUCCESS! Got {len(reviews_data.get('reviews', []))} reviews")
        
        if 'reviews' in reviews_data and len(reviews_data['reviews']) > 0:
            print("\n=== First Review Sample ===")
            print(json.dumps(reviews_data['reviews'][0], indent=2))
            
            print("\n=== Review Structure ===")
            print("Fields available:", list(reviews_data['reviews'][0].keys()))
    else:
        print(f"\n❌ Error: {reviews_response.status_code}")
        print(f"Response: {reviews_response.text}")
        
        # Try to parse error details
        try:
            error_data = reviews_response.json()
            print("\nError details:", json.dumps(error_data, indent=2))
        except:
            pass

if __name__ == '__main__':
    main()
