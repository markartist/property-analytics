#!/usr/bin/env python3
"""
Generate ThirtyLines vs GBP Property Listing Discrepancy Report

This script analyzes which properties are listed in:
1. ThirtyLines feed (unit availability data)
2. Google Business Profile (reviews/insights data)

Identifies discrepancies and generates an Excel report with:
- Properties in both feeds
- Properties missing from ThirtyLines
- Properties missing from GBP
- Coverage statistics
- GBP business names from API

Author: Data Collection System
Created: 2026-02-11
"""

import sys
import json
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Set, Optional
import requests
import pickle

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# For Excel export
try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False
    print("⚠️  pandas not available - will generate CSV instead")

# Paths
DB_PATH = Path(__file__).parent.parent.parent / "data" / "portfolio_analytics.db"
CONFIG_PATH = Path(__file__).parent.parent.parent / "config" / "venterra_properties_official.json"
GBP_NAMES_PATH = Path(__file__).parent.parent.parent / "config" / "gbp_location_names.json"
OUTPUT_DIR = Path(__file__).parent.parent.parent / "reports"

# Ensure output directory exists
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def load_gbp_names_mapping() -> Dict[str, Dict]:
    """Load GBP location names from saved mapping file.
    
    Returns:
        Dictionary mapping location_id -> {business_name, account_id, city, etc.}
    """
    try:
        if GBP_NAMES_PATH.exists():
            with open(GBP_NAMES_PATH) as f:
                return json.load(f)
        else:
            print("⚠️  GBP names mapping file not found - business names will be unavailable")
            return {}
    except Exception as e:
        print(f"⚠️  Error loading GBP names mapping: {e}")
        return {}


def load_official_registry() -> Dict:
    """Load the official property registry."""
    with open(CONFIG_PATH) as f:
        data = json.load(f)
    return {prop['name']: prop for prop in data['properties']}


def query_thirtylines_properties() -> Set[str]:
    """Query properties with ThirtyLines data."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("""
        SELECT DISTINCT p.property_name
        FROM properties p
        INNER JOIN property_floorplans pf ON p.property_id = pf.property_id
        ORDER BY p.property_name
    """)
    
    properties = {row[0] for row in cursor.fetchall()}
    conn.close()
    return properties


def query_gbp_properties() -> Dict[str, str]:
    """Query properties with GBP data and their location IDs.
    
    Returns:
        Dictionary mapping property_name -> gbp_location_id
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("""
        SELECT DISTINCT p.property_name, p.gbp_location_id
        FROM properties p
        WHERE p.gbp_location_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM gbp_reviews r 
            WHERE r.property_id = p.property_id
        )
        ORDER BY p.property_name
    """)
    
    properties = {row[0]: row[1] for row in cursor.fetchall()}
    conn.close()
    return properties


def generate_report():
    """Generate the discrepancy report."""
    print("=" * 80)
    print("THIRTYLINES vs GBP PROPERTY LISTING DISCREPANCY REPORT")
    print("=" * 80)
    print()
    
    # Load data sources
    print("📋 Loading data sources...")
    registry = load_official_registry()
    thirtylines_props = query_thirtylines_properties()
    gbp_props_dict = query_gbp_properties()
    gbp_props = set(gbp_props_dict.keys())
    
    print(f"   Official Registry: {len(registry)} properties")
    print(f"   ThirtyLines Feed: {len(thirtylines_props)} properties")
    print(f"   GBP (Reviews): {len(gbp_props)} properties")
    print()
    
    # Load GBP names mapping
    print("📍 Loading GBP location names...")
    gbp_names = load_gbp_names_mapping()
    if gbp_names:
        print(f"   ✅ Loaded {len(gbp_names)} GBP locations with business names")
    else:
        print("   ⚠️  GBP names not available")
    print()
    
    # Calculate sets
    all_registry_props = set(registry.keys())
    in_both = thirtylines_props & gbp_props
    in_thirtylines_only = thirtylines_props - gbp_props
    in_gbp_only = gbp_props - thirtylines_props
    in_neither = all_registry_props - thirtylines_props - gbp_props
    
    # Prepare detailed data for export
    report_data = []
    
    print("🔍 Analyzing property coverage...")
    print()
    
    for prop_name in sorted(all_registry_props):
        in_tl = prop_name in thirtylines_props
        in_gbp = prop_name in gbp_props
        
        # Determine status
        if in_tl and in_gbp:
            status = "Both"
        elif in_tl:
            status = "ThirtyLines Only"
        elif in_gbp:
            status = "GBP Only"
        else:
            status = "Neither"
        
        # Get GBP business name from mapping
        gbp_location_id = gbp_props_dict.get(prop_name)
        gbp_business_name = ''
        gbp_city = ''
        gbp_account = ''
        
        if gbp_location_id and gbp_names:
            location_info = gbp_names.get(gbp_location_id, {})
            gbp_business_name = location_info.get('business_name', '')
            gbp_city = location_info.get('city', '')
            gbp_account = location_info.get('account_name', '')
        
        report_data.append({
            'Property Name': prop_name,
            'In ThirtyLines': 'Yes' if in_tl else 'No',
            'In GBP': 'Yes' if in_gbp else 'No',
            'Status': status,
            'GBP Location ID': gbp_location_id or '',
            'GBP Business Name': gbp_business_name,
            'GBP City': gbp_city,
            'GBP Account': gbp_account,
            'GA4 Property ID': registry[prop_name].get('ga4_property_id', ''),
            'URL': registry[prop_name].get('full_url', ''),
            'City': registry[prop_name].get('city', ''),
            'State': registry[prop_name].get('state', '')
        })
    
    print()
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print()
    print(f"✅ In Both Feeds: {len(in_both)} properties ({len(in_both)/len(all_registry_props)*100:.1f}%)")
    print(f"📦 ThirtyLines Only: {len(in_thirtylines_only)} properties")
    print(f"📍 GBP Only: {len(in_gbp_only)} properties")
    print(f"❌ In Neither Feed: {len(in_neither)} properties")
    print()
    
    if in_thirtylines_only:
        print("Properties in ThirtyLines but NOT in GBP:")
        for prop in sorted(in_thirtylines_only):
            print(f"  - {prop}")
        print()
    
    if in_gbp_only:
        print("Properties in GBP but NOT in ThirtyLines:")
        for prop in sorted(in_gbp_only):
            print(f"  - {prop}")
        print()
    
    if in_neither:
        print("Properties in NEITHER feed:")
        for prop in sorted(in_neither):
            print(f"  - {prop}")
        print()
    
    # Generate output files
    timestamp = datetime.now().strftime('%Y-%m-%d')
    
    if HAS_PANDAS:
        # Create Excel with multiple sheets
        excel_file = OUTPUT_DIR / f"ThirtyLines_GBP_Discrepancy_Report_{timestamp}.xlsx"
        
        with pd.ExcelWriter(excel_file, engine='openpyxl') as writer:
            # Main report
            df_main = pd.DataFrame(report_data)
            df_main.to_excel(writer, sheet_name='All Properties', index=False)
            
            # Summary sheet
            summary_data = [
                ['Metric', 'Count', 'Percentage'],
                ['Total Properties', len(all_registry_props), '100.0%'],
                ['In Both Feeds', len(in_both), f"{len(in_both)/len(all_registry_props)*100:.1f}%"],
                ['ThirtyLines Only', len(in_thirtylines_only), f"{len(in_thirtylines_only)/len(all_registry_props)*100:.1f}%"],
                ['GBP Only', len(in_gbp_only), f"{len(in_gbp_only)/len(all_registry_props)*100:.1f}%"],
                ['In Neither Feed', len(in_neither), f"{len(in_neither)/len(all_registry_props)*100:.1f}%"],
                ['', '', ''],
                ['ThirtyLines Coverage', len(thirtylines_props), f"{len(thirtylines_props)/len(all_registry_props)*100:.1f}%"],
                ['GBP Coverage', len(gbp_props), f"{len(gbp_props)/len(all_registry_props)*100:.1f}%"]
            ]
            df_summary = pd.DataFrame(summary_data[1:], columns=summary_data[0])
            df_summary.to_excel(writer, sheet_name='Summary', index=False)
            
            # Filter sheets
            df_both = df_main[df_main['Status'] == 'Both']
            df_tl_only = df_main[df_main['Status'] == 'ThirtyLines Only']
            df_gbp_only = df_main[df_main['Status'] == 'GBP Only']
            df_neither = df_main[df_main['Status'] == 'Neither']
            
            if not df_both.empty:
                df_both.to_excel(writer, sheet_name='Both Feeds', index=False)
            if not df_tl_only.empty:
                df_tl_only.to_excel(writer, sheet_name='ThirtyLines Only', index=False)
            if not df_gbp_only.empty:
                df_gbp_only.to_excel(writer, sheet_name='GBP Only', index=False)
            if not df_neither.empty:
                df_neither.to_excel(writer, sheet_name='Neither Feed', index=False)
        
        print(f"✅ Excel report saved: {excel_file}")
        print()
    else:
        # Generate CSV
        csv_file = OUTPUT_DIR / f"ThirtyLines_GBP_Discrepancy_Report_{timestamp}.csv"
        import csv
        
        with open(csv_file, 'w', newline='') as f:
            fieldnames = report_data[0].keys()
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(report_data)
        
        print(f"✅ CSV report saved: {csv_file}")
        print()
    
    print("=" * 80)
    print("REPORT COMPLETE")
    print("=" * 80)


if __name__ == "__main__":
    try:
        generate_report()
    except Exception as e:
        print(f"❌ Error generating report: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
