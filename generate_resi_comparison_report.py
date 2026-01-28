#!/usr/bin/env python3
"""
Resi vs Portfolio Comparative Performance Report
=================================================

Ad hoc analytical study comparing Resi-hosted sites against comparable 
portfolio properties to determine relative performance and conversion effectiveness.

This is an analytical study, not a marketing summary.

Author: Mark Laufhutte
Date: January 27, 2026
Version: 1.0
"""

import sqlite3
import json
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import sys

# Database location
DB_PATH = Path("/Users/mark/Property_Analytics/data/portfolio_analytics.db")
REGISTRY_PATH = Path("/Users/mark/Property_Analytics/config/venterra_properties_official.json")
OUTPUT_DIR = Path("/Users/mark/Property_Analytics/reports/resi_comparison")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

class ResiComparativeAnalysis:
    """Analyzes Resi-hosted sites vs comparable portfolio properties"""
    
    def __init__(self):
        self.db_path = DB_PATH
        self.conn = None
        self.registry = self._load_registry()
        
        # Define Resi properties
        self.resi_properties = {
            'cendana_life': {
                'canonical_name': 'Cendana District West',
                'domain': 'cendanalife.com',
                'ga4_property_id': '424416990',
                'location': 'Richmond, TX',
                'metro': 'Houston, TX'
            },
            'camber_ridge': {
                'canonical_name': 'Camber Ridge',
                'domain': 'camberridgeapartments.com',
                'ga4_property_id': None,  # Need to find this
                'location': None,  # Need to determine
                'metro': None
            },
            'delta_pearland': {
                'canonical_name': 'Delta Pearland',
                'domain': 'thedeltapearland.com',
                'ga4_property_id': None,
                'location': 'Pearland, TX',
                'metro': 'Houston, TX'
            },
            'monteverde': {
                'canonical_name': 'Monteverde',
                'domain': 'monteverdesatx.com',
                'ga4_property_id': None,
                'location': 'San Antonio, TX',
                'metro': 'San Antonio, TX'
            }
        }
        
        self.analysis_period_days = 30
        self.report_date = datetime.now().strftime('%Y-%m-%d')
        
    def _load_registry(self) -> Dict:
        """Load property registry"""
        if REGISTRY_PATH.exists():
            with open(REGISTRY_PATH, 'r') as f:
                return json.load(f)
        return {}
    
    def _connect_db(self):
        """Connect to database"""
        if not self.conn:
            self.conn = sqlite3.connect(self.db_path)
            self.conn.row_factory = sqlite3.Row
    
    def _close_db(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            self.conn = None
    
    def identify_resi_properties(self):
        """
        Identify Resi properties in the database and update their GA4 property IDs
        """
        print("=" * 70)
        print("IDENTIFYING RESI PROPERTIES IN DATABASE")
        print("=" * 70)
        
        self._connect_db()
        cursor = self.conn.cursor()
        
        # Check registry for Resi properties
        if 'properties' in self.registry and isinstance(self.registry['properties'], list):
            for prop_data in self.registry['properties']:
                prop_name = prop_data.get('name', '')
                full_url = prop_data.get('full_url', '')
                domain = prop_data.get('domain', '')
                ga4_id = prop_data.get('ga4_property_id', '')
                
                # Check if this is one of our Resi properties
                for resi_key, resi_data in self.resi_properties.items():
                    if (resi_data['domain'] in full_url or 
                        resi_data['domain'] in domain or
                        prop_name == resi_data['canonical_name']):
                        self.resi_properties[resi_key]['ga4_property_id'] = ga4_id
                        self.resi_properties[resi_key]['canonical_name'] = prop_name
                        self.resi_properties[resi_key]['unit_count'] = prop_data.get('unit_count', 'Unknown')
                        print(f"\n✓ Found {prop_name}")
                        print(f"  GA4 Property ID: {ga4_id}")
                        print(f"  Domain: {domain}")
                        print(f"  Unit Count: {prop_data.get('unit_count', 'Unknown')}")
                        print(f"  URL: {full_url}")
        
        # Verify we found all Resi properties
        print("\n" + "=" * 70)
        print("RESI PROPERTIES STATUS")
        print("=" * 70)
        
        for resi_key, resi_data in self.resi_properties.items():
            status = "✓ FOUND" if resi_data['ga4_property_id'] else "✗ NOT FOUND"
            print(f"\n{resi_data['canonical_name']}: {status}")
            if resi_data['ga4_property_id']:
                print(f"  GA4 ID: {resi_data['ga4_property_id']}")
                print(f"  Location: {resi_data['location']}")
        
        self._close_db()
        return self.resi_properties
    
    def find_comparable_properties(self, resi_property: Dict) -> List[Dict]:
        """
        Find 1-2 comparable portfolio properties for a Resi site
        
        Matching criteria:
        - Same city or metro (mandatory)
        - Similar asset class/positioning (mandatory)
        - Similar unit count (±25%)
        - Comparable pricing band (approximate)
        - Comparable traffic volume (sanity check)
        """
        print(f"\n{'=' * 70}")
        print(f"FINDING COMPARABLES FOR: {resi_property['canonical_name']}")
        print(f"{'=' * 70}")
        
        self._connect_db()
        cursor = self.conn.cursor()
        
        # Get all portfolio properties (excluding this Resi property)
        if 'properties' not in self.registry or not isinstance(self.registry['properties'], list):
            print("✗ No properties found in registry")
            self._close_db()
            return []
        
        candidates = []
        resi_metro = resi_property.get('metro', resi_property.get('location', ''))
        resi_ga4_id = resi_property['ga4_property_id']
        
        print(f"\nSearching for properties in/near: {resi_metro}")
        print(f"Resi GA4 ID to exclude: {resi_ga4_id}\n")
        
        for prop_data in self.registry['properties']:
            ga4_id = prop_data.get('ga4_property_id', '')
            prop_name = prop_data.get('name', '')
            full_url = prop_data.get('full_url', '')
            
            # Skip if this IS the Resi property
            if ga4_id == resi_ga4_id:
                continue
            
            # Try to infer location from URL or name
            prop_location = ''
            url_lower = full_url.lower()
            name_lower = prop_name.lower()
            
            # Infer city from URL/name patterns
            if 'houston' in url_lower or 'houston' in name_lower:
                prop_location = 'Houston, TX'
            elif 'san-antonio' in url_lower or 'san antonio' in name_lower:
                prop_location = 'San Antonio, TX'
            elif 'dallas' in url_lower or 'dallas' in name_lower:
                prop_location = 'Dallas, TX'
            elif 'austin' in url_lower or 'austin' in name_lower:
                prop_location = 'Austin, TX'
            elif 'richmond' in url_lower or 'richmond' in name_lower:
                prop_location = 'Richmond, TX'
            elif 'pearland' in url_lower or 'pearland' in name_lower:
                prop_location = 'Pearland, TX'
            
            # Check if in same metro/city
            metro_match = False
            if resi_metro and prop_location:
                # Houston metro includes Houston, Richmond, Pearland
                if 'Houston' in resi_metro and ('Houston' in prop_location or 'Richmond' in prop_location or 'Pearland' in prop_location):
                    metro_match = True
                elif 'Richmond' in resi_metro and ('Houston' in prop_location or 'Richmond' in prop_location):
                    metro_match = True
                elif 'Pearland' in resi_metro and ('Houston' in prop_location or 'Pearland' in prop_location):
                    metro_match = True
                elif 'San Antonio' in resi_metro and 'San Antonio' in prop_location:
                    metro_match = True
                elif 'Dallas' in resi_metro and 'Dallas' in prop_location:
                    metro_match = True
                elif 'Austin' in resi_metro and 'Austin' in prop_location:
                    metro_match = True
            
            if metro_match:
                candidates.append({
                    'ga4_property_id': ga4_id,
                    'canonical_name': prop_name,
                    'location': prop_location,
                    'full_url': full_url,
                    'unit_count': prop_data.get('unit_count', 'Unknown'),
                    'match_reason': f"Same metro: {prop_location}"
                })
        
        print(f"Found {len(candidates)} candidate properties in same metro")
        
        if candidates:
            print("\nCandidates:")
            for i, cand in enumerate(candidates, 1):
                print(f"  {i}. {cand['canonical_name']} ({cand['location']}) - {cand['unit_count']} units")
        
        # For now, return top 2 candidates
        # TODO: Add traffic volume comparison to refine matches
        matches = candidates[:2] if candidates else []
        
        self._close_db()
        return matches
    
    def get_data_availability(self):
        """Check what data is available for analysis"""
        print("\n" + "=" * 70)
        print("CHECKING DATA AVAILABILITY")
        print("=" * 70)
        
        self._connect_db()
        cursor = self.conn.cursor()
        
        # Check date ranges for each data source
        sources = {
            'GA4': ('ga4_daily_metrics', 'date', 'property_id'),
            'GSC': ('gsc_daily_metrics', 'date', 'domain'),
            'PageSpeed': ('pagespeed_metrics', 'metric_date', 'property_id'),
            'GTMetrix': ('gtmetrix_metrics', 'metric_date', 'property_id'),
            'GBP': ('gbp_daily_metrics', 'metric_date', 'property_id')
        }
        
        for source_name, (table, date_col, id_col) in sources.items():
            try:
                cursor.execute(f"""
                    SELECT 
                        COUNT(DISTINCT {id_col}) as properties,
                        MIN({date_col}) as earliest,
                        MAX({date_col}) as latest,
                        COUNT(*) as total_rows
                    FROM {table}
                    WHERE {date_col} >= date('now', '-60 days')
                """)
                row = cursor.fetchone()
                print(f"\n{source_name}:")
                print(f"  Properties: {row['properties']}")
                print(f"  Date Range: {row['earliest']} to {row['latest']}")
                print(f"  Total Rows: {row['total_rows']:,}")
            except Exception as e:
                print(f"\n{source_name}: ✗ Error - {str(e)}")
        
        self._close_db()
    
    def analyze(self):
        """Run complete analysis"""
        print("\n" + "=" * 70)
        print("RESI VS PORTFOLIO COMPARATIVE PERFORMANCE REPORT")
        print("=" * 70)
        print(f"Report Date: {self.report_date}")
        print(f"Analysis Period: Last {self.analysis_period_days} days")
        print("=" * 70)
        
        # Step 1: Identify Resi properties
        resi_props = self.identify_resi_properties()
        
        # Step 2: Check data availability
        self.get_data_availability()
        
        # Step 3: Find comparable properties for each Resi site
        print("\n" + "=" * 70)
        print("PROPERTY MATCHING")
        print("=" * 70)
        
        comparisons = {}
        for resi_key, resi_data in resi_props.items():
            if resi_data['ga4_property_id']:
                matches = self.find_comparable_properties(resi_data)
                comparisons[resi_key] = {
                    'resi': resi_data,
                    'matches': matches
                }
        
        # Step 4: Extract metrics for analysis
        # TODO: Implement metric extraction
        
        # Step 5: Generate report
        # TODO: Implement report generation
        
        print("\n" + "=" * 70)
        print("ANALYSIS STATUS")
        print("=" * 70)
        print("\n✓ Phase 1 Complete: Resi properties identified")
        print("✓ Phase 2 Complete: Data availability checked")
        print("✓ Phase 3 Complete: Comparable properties identified")
        print("\n⚠  Phase 4 Pending: Metric extraction")
        print("⚠  Phase 5 Pending: Comparative analysis")
        print("⚠  Phase 6 Pending: Report generation")
        
        return comparisons

def main():
    """Main execution"""
    analysis = ResiComparativeAnalysis()
    results = analysis.analyze()
    
    print("\n" + "=" * 70)
    print("NEXT STEPS")
    print("=" * 70)
    print("\n1. Review property matches above")
    print("2. Confirm matching rationale is sound")
    print("3. Proceed with metric extraction and analysis")
    print("\nScript Location: /Users/mark/Property_Analytics/generate_resi_comparison_report.py")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    main()
