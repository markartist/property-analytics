#!/usr/bin/env python3
"""
Standalone SEMRush Competitor Analysis Test Script

Tests competitor identification and filtering logic before integration.
"""

import requests
import json
from typing import List, Dict, Optional


class CompetitorAnalyzer:
    """Analyzes competitors using SEMRush API with intelligent filtering"""
    
    # Venterra-owned domains to exclude
    VENTERRA_DOMAINS = {
        'nicolawealth.com',
        'venterra.com',
        'venterraliving.com'
    }
    
    # Service provider keywords (not actual apartment competitors)
    SERVICE_KEYWORDS = {
        'move', 'promove', 'moving', 'integrity', 'management', 'service',
        'realty', 'broker', 'realtor', 'insurance', 'mortgage', 'loan'
    }
    
    # Aggregator/marketplace sites (not direct competitors)
    AGGREGATOR_DOMAINS = {
        'apartments.com', 'zillow.com', 'trulia.com', 'apartmentguide.com',
        'rent.com', 'forrent.com', 'apartmentfinder.com', 'apartmentlist.com',
        'realtor.com', 'realpage.com', 'yardi.com', 'rentcafe.com'
    }
    
    # Social/review platforms
    PLATFORM_DOMAINS = {
        'yelp.com', 'google.com', 'facebook.com', 'instagram.com',
        'twitter.com', 'linkedin.com', 'youtube.com'
    }
    
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    def is_valid_competitor(self, domain: str, traffic: int) -> bool:
        """
        Determine if a domain is a valid apartment competitor
        
        Returns True if domain is a real apartment competitor, False otherwise
        """
        domain_lower = domain.lower()
        
        # Exclude Venterra domains
        if domain_lower in self.VENTERRA_DOMAINS:
            return False
        
        # Exclude known aggregators
        if domain_lower in self.AGGREGATOR_DOMAINS:
            return False
        
        # Exclude social/review platforms
        if domain_lower in self.PLATFORM_DOMAINS:
            return False
        
        # Exclude service providers by keyword
        for keyword in self.SERVICE_KEYWORDS:
            if keyword in domain_lower:
                return False
        
        # Exclude mega-aggregators (>500K traffic is likely a marketplace)
        if traffic > 500000:
            return False
        
        # Include domains with apartment-related keywords
        apartment_keywords = ['apartment', 'living', 'apts', 'homes', 'communities', 
                            'residence', 'place', 'village', 'heights', 'gardens',
                            'pointe', 'grove', 'creek', 'park', 'ridge']
        
        has_apartment_keyword = any(kw in domain_lower for kw in apartment_keywords)
        
        # If it has apartment keywords, it's likely valid
        if has_apartment_keyword:
            return True
        
        # Otherwise, include if traffic is reasonable (1K-100K suggests property portfolio)
        if 1000 <= traffic <= 100000:
            return True
        
        return False
    
    def get_competitors(self, domain: str, database: str = 'us', limit: int = 20) -> List[Dict]:
        """
        Get organic competitors from SEMRush API
        
        Args:
            domain: Domain to analyze
            database: SEMRush database (us, uk, etc.)
            limit: Maximum competitors to fetch
            
        Returns:
            List of competitor dictionaries with filtered results
        """
        url = (f"https://api.semrush.com/?type=domain_organic_organic"
               f"&key={self.api_key}&domain={domain}&database={database}"
               f"&display_limit={limit}&export_columns=Dn,Cr,Np,Or,Ot,Oc,Ad")
        
        try:
            response = requests.get(url, timeout=30)
            
            if response.status_code != 200:
                print(f"❌ API Error: {response.text[:200]}")
                return []
            
            lines = response.text.strip().split('\n')
            
            if len(lines) <= 1 or 'ERROR' in lines[0]:
                print(f"⚠️ No data: {response.text[:200]}")
                return []
            
            competitors = []
            
            # Parse results (skip header)
            for line in lines[1:]:
                parts = line.split(';')
                if len(parts) >= 7:
                    comp_domain = parts[0]
                    relevance = float(parts[1])
                    common_keywords = int(parts[2])
                    organic_keywords = int(parts[3])
                    traffic = int(parts[4])
                    cost = float(parts[5])
                    adwords = int(parts[6])
                    
                    # Apply filtering
                    if self.is_valid_competitor(comp_domain, traffic):
                        competitors.append({
                            'domain': comp_domain,
                            'relevance': relevance,
                            'common_keywords': common_keywords,
                            'organic_keywords': organic_keywords,
                            'traffic': traffic,
                            'cost': cost,
                            'adwords': adwords
                        })
            
            return competitors
            
        except Exception as e:
            print(f"❌ Failed to fetch competitors: {e}")
            return []
    
    def analyze_property(self, domain: str) -> Dict:
        """
        Complete competitor analysis for a property domain
        
        Returns:
            Dict with top competitors and analysis
        """
        print(f"\n🔍 Analyzing competitors for: {domain}")
        print("=" * 80)
        
        competitors = self.get_competitors(domain, limit=30)
        
        if not competitors:
            return {
                'domain': domain,
                'competitors': [],
                'top_competitor': None
            }
        
        # Sort by relevance
        competitors.sort(key=lambda x: x['relevance'], reverse=True)
        
        print(f"\n✅ Found {len(competitors)} valid competitors (after filtering)\n")
        print(f"{'Domain':<35} | {'Rel':<6} | {'Common KW':<9} | {'Traffic':<10} | {'Keywords':<10}")
        print("-" * 90)
        
        for comp in competitors[:10]:  # Show top 10
            print(f"{comp['domain']:<35} | {comp['relevance']:<6.2f} | "
                  f"{comp['common_keywords']:<9} | {comp['traffic']:<10,} | "
                  f"{comp['organic_keywords']:<10,}")
        
        # Identify top competitor
        top = competitors[0] if competitors else None
        
        if top:
            print(f"\n🎯 Top Competitor: {top['domain']}")
            print(f"   Relevance: {top['relevance']:.2%}")
            print(f"   Common Keywords: {top['common_keywords']}")
            print(f"   Their Traffic: {top['traffic']:,}/mo")
            print(f"   Their Keyword Coverage: {top['organic_keywords']:,}")
        
        return {
            'domain': domain,
            'competitors': competitors[:10],  # Top 10
            'top_competitor': top
        }


def main():
    """Test competitor analysis"""
    
    # Load API key
    with open('/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/semrush_api_key.txt') as f:
        api_key = f.read().strip()
    
    analyzer = CompetitorAnalyzer(api_key)
    
    # Test domains
    test_domains = [
        'venterraliving.com',  # Portfolio domain
        'monteverdesatx.com',  # Individual property
    ]
    
    results = []
    
    for domain in test_domains:
        result = analyzer.analyze_property(domain)
        results.append(result)
        print("\n" + "=" * 80)
    
    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    for result in results:
        print(f"\n{result['domain']}:")
        if result['top_competitor']:
            top = result['top_competitor']
            print(f"  Top Competitor: {top['domain']}")
            print(f"  Relevance: {top['relevance']:.2%}")
            print(f"  Traffic Gap: {top['traffic']:,} vs ours")
        else:
            print("  No competitors found")


if __name__ == '__main__':
    main()
