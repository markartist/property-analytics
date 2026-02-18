#!/usr/bin/env python3
"""
Property Intelligence Brief v2 Generator

Produces decision-oriented PIB reports following the canonical v2 structure:
1. Availability Snapshot (Supply Reality)
2. Demand vs Supply Overlay
3. SEO Content Improvement Recommendations
4. Primary Online Competitor Insight
5. Action Summary

Author: Property Analytics Platform
Date: January 29, 2026
"""

import sqlite3
import json
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import sys

class PIBv2Generator:
    """Generates Property Intelligence Brief v2 reports"""
    
    def __init__(self, db_path: str):
        """Initialize generator with database connection"""
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()
    
    def get_property_info(self, encasa_short_name: str) -> Optional[Dict]:
        """Get complete property identification info"""
        self.cursor.execute("""
            SELECT 
                property_id,
                property_name,
                encasa_short_name,
                thirtylines_id,
                company_id,
                encasa_region,
                full_url,
                gsc_url,
                domain
            FROM properties
            WHERE encasa_short_name = ?
        """, (encasa_short_name,))
        
        row = self.cursor.fetchone()
        if not row:
            return None
        
        return dict(row)
    
    def get_availability_data(self, property_id: str) -> Tuple[List[Dict], str]:
        """Section 1: Get availability snapshot data"""
        self.cursor.execute("""
            SELECT 
                pf.floorplan_name,
                pf.bedrooms,
                pf.bathrooms,
                pf.sqft,
                pf.rent_from,
                pf.rent_to,
                ua.units_available_now,
                ua.units_available_30d,
                ua.units_available_60d,
                ua.snapshot_date
            FROM property_floorplans pf
            LEFT JOIN unit_availability ua ON 
                pf.property_id = ua.property_id AND 
                pf.floorplan_name = ua.floorplan_name
            WHERE pf.property_id = ?
            AND (ua.snapshot_date = (
                SELECT MAX(snapshot_date) 
                FROM unit_availability 
                WHERE property_id = pf.property_id 
                AND floorplan_name = pf.floorplan_name
            ) OR ua.snapshot_date IS NULL)
            ORDER BY pf.bedrooms, pf.bathrooms
        """, (property_id,))
        
        floorplans = [dict(row) for row in self.cursor.fetchall()]
        snapshot_date = floorplans[0]['snapshot_date'] if floorplans else None
        
        return floorplans, snapshot_date
    
    def get_demand_data(self, gsc_url: str, days: int = 30) -> Tuple[Dict, List[Dict]]:
        """Section 2: Get search demand data from GSC"""
        # Get aggregate metrics
        self.cursor.execute("""
            SELECT 
                SUM(clicks) as total_clicks,
                SUM(impressions) as total_impressions,
                AVG(ctr) as avg_ctr,
                AVG(average_position) as avg_position,
                COUNT(*) as days_data
            FROM gsc_daily_metrics
            WHERE property_id = ?
            AND metric_date >= date('now', ?)
        """, (gsc_url, f'-{days} days'))
        
        metrics = dict(self.cursor.fetchone())
        
        # Get top queries with floorplan intent classification
        self.cursor.execute("""
            SELECT 
                query,
                SUM(clicks) as total_clicks,
                SUM(impressions) as total_impressions,
                AVG(average_position) as avg_position,
                AVG(ctr) as avg_ctr
            FROM gsc_queries
            WHERE property_id = ?
            AND metric_date >= date('now', ?)
            GROUP BY query
            HAVING total_impressions > 10
            ORDER BY total_impressions DESC
            LIMIT 50
        """, (gsc_url, f'-{days} days'))
        
        queries = [dict(row) for row in self.cursor.fetchall()]
        
        return metrics, queries
    
    def classify_query_intent(self, query: str) -> str:
        """Classify search query by floorplan intent"""
        query_lower = query.lower()
        
        # Bedroom intent
        if any(x in query_lower for x in ['1 bed', '1 bedroom', 'one bed', 'studio']):
            return '1BR'
        elif any(x in query_lower for x in ['2 bed', '2 bedroom', 'two bed']):
            return '2BR'
        elif any(x in query_lower for x in ['3 bed', '3 bedroom', 'three bed']):
            return '3BR'
        elif any(x in query_lower for x in ['4 bed', '4 bedroom', 'four bed']):
            return '4BR'
        
        # Generic availability intent
        elif any(x in query_lower for x in ['availability', 'available', 'vacancy', 'units']):
            return 'Availability'
        
        # Pricing intent
        elif any(x in query_lower for x in ['price', 'rent', 'cost', 'pricing', 'rates']):
            return 'Pricing'
        
        # Location/general
        elif any(x in query_lower for x in ['apartment', 'complex', 'near', 'in ']):
            return 'General'
        
        return 'Other'
    
    def get_competitor_data(self, property_id: str) -> List[Dict]:
        """Section 4: Get competitor mapping data"""
        self.cursor.execute("""
            SELECT 
                c.competitor_id,
                c.competitor_name,
                c.competitor_url,
                c.competitor_domain,
                pc.competitor_rank
            FROM property_competitors pc
            JOIN competitors c ON pc.competitor_id = c.competitor_id
            WHERE pc.property_id = ?
            ORDER BY pc.competitor_rank
            LIMIT 5
        """, (property_id,))
        
        return [dict(row) for row in self.cursor.fetchall()]
    
    def get_traffic_data(self, property_id: str, days: int = 30) -> Dict:
        """Get GA4 traffic context"""
        self.cursor.execute("""
            SELECT 
                AVG(sessions) as avg_sessions,
                AVG(conversions) as avg_conversions,
                AVG(conversion_rate) as avg_conv_rate,
                AVG(engagement_rate) as avg_engagement,
                AVG(bounce_rate) as avg_bounce
            FROM ga4_daily_metrics
            WHERE property_id = ?
            AND metric_date >= date('now', ?)
        """, (property_id, f'-{days} days'))
        
        return dict(self.cursor.fetchone())
    
    def generate_section_1(self, floorplans: List[Dict], snapshot_date: str) -> str:
        """Generate Section 1: Availability Snapshot"""
        output = []
        output.append("## 1. Availability Snapshot (Supply Reality)")
        output.append("")
        output.append(f"**Data as of**: {snapshot_date or 'N/A'}")
        output.append("")
        
        if not floorplans:
            output.append("⚠️ **No availability data available**")
            return "\n".join(output)
        
        # Calculate totals
        total_now = sum(fp['units_available_now'] or 0 for fp in floorplans)
        total_30d = sum(fp['units_available_30d'] or 0 for fp in floorplans)
        total_60d = sum(fp['units_available_60d'] or 0 for fp in floorplans)
        
        # Floorplan table
        output.append("### Current Inventory")
        output.append("")
        output.append("| Floorplan | Type | Sqft | Rent Range | Now | 30d | 60d |")
        output.append("|-----------|------|------|------------|-----|-----|-----|")
        
        for fp in floorplans:
            name = fp['floorplan_name']
            fp_type = f"{fp['bedrooms']}bd/{fp['bathrooms']}ba"
            sqft = fp['sqft'] or '-'
            rent = f"${fp['rent_from']:,.0f}-${fp['rent_to']:,.0f}" if fp['rent_from'] and fp['rent_to'] else 'N/A'
            now = fp['units_available_now'] or 0
            d30 = fp['units_available_30d'] or 0
            d60 = fp['units_available_60d'] or 0
            
            output.append(f"| {name} | {fp_type} | {sqft} | {rent} | {now} | {d30} | {d60} |")
        
        output.append(f"| **TOTAL** | | | | **{total_now}** | **{total_30d}** | **{total_60d}** |")
        output.append("")
        
        # Identify pressure points
        high_inventory = [fp for fp in floorplans if (fp['units_available_now'] or 0) >= 5]
        low_inventory = [fp for fp in floorplans if (fp['units_available_now'] or 0) > 0 and (fp['units_available_now'] or 0) < 3]
        
        output.append("### Leasing Pressure Analysis")
        output.append("")
        
        if high_inventory:
            names = ", ".join([fp['floorplan_name'] for fp in high_inventory])
            output.append(f"**High Inventory** (5+ units): {names}")
            output.append(f"> Leasing pressure is currently concentrated in {names} floorplans.")
        
        if low_inventory:
            names = ", ".join([fp['floorplan_name'] for fp in low_inventory])
            output.append(f"**Low Inventory** (<3 units): {names}")
            output.append(f"> Limited availability in {names} - strong demand or pricing opportunity.")
        
        output.append("")
        
        return "\n".join(output)
    
    def generate_section_2(self, floorplans: List[Dict], metrics: Dict, queries: List[Dict]) -> str:
        """Generate Section 2: Demand vs Supply Overlay"""
        output = []
        output.append("## 2. Demand vs Supply Overlay")
        output.append("")
        
        if not metrics.get('total_clicks'):
            output.append("⚠️ **No search demand data available for analysis**")
            output.append("")
            output.append("**Impact**: Cannot assess which floorplans are under/over-supported by search visibility.")
            return "\n".join(output)
        
        # Search performance summary
        total_clicks = int(metrics.get('total_clicks', 0))
        total_impr = int(metrics.get('total_impressions', 0))
        avg_ctr = metrics.get('avg_ctr', 0)  # Already stored as percentage
        avg_pos = metrics.get('avg_position', 0)
        
        output.append("### Search Performance (Last 30 Days)")
        output.append("")
        output.append(f"- **Total Clicks**: {total_clicks:,}")
        output.append(f"- **Total Impressions**: {total_impr:,}")
        output.append(f"- **Avg CTR**: {avg_ctr:.2f}%")
        output.append(f"- **Avg Position**: {avg_pos:.1f}")
        output.append("")
        
        # Classify queries by floorplan intent
        intent_clicks = {}
        intent_impressions = {}
        
        for q in queries:
            intent = self.classify_query_intent(q['query'])
            intent_clicks[intent] = intent_clicks.get(intent, 0) + q['total_clicks']
            intent_impressions[intent] = intent_impressions.get(intent, 0) + q['total_impressions']
        
        # Map to floorplans
        output.append("### Demand by Floorplan Type")
        output.append("")
        output.append("| Type | Search Demand (Impressions) | Availability | Status |")
        output.append("|------|----------------------------|--------------|--------|")
        
        # Aggregate floorplans by bedroom count
        fp_by_beds = {}
        for fp in floorplans:
            beds = fp['bedrooms']
            if beds not in fp_by_beds:
                fp_by_beds[beds] = {'count': 0, 'avail_now': 0}
            fp_by_beds[beds]['count'] += 1
            fp_by_beds[beds]['avail_now'] += (fp['units_available_now'] or 0)
        
        for beds in sorted(fp_by_beds.keys()):
            br_key = f"{beds}BR"
            demand = intent_impressions.get(br_key, 0)
            avail = fp_by_beds[beds]['avail_now']
            
            # Classification
            if avail == 0:
                status = "⚠️ No inventory"
            elif demand == 0:
                status = "❌ Under-supported (no demand data)"
            elif avail > 10 and demand < 1000:
                status = "❌ Under-supported (inventory > visibility)"
            elif avail < 3 and demand > 2000:
                status = "⚠️ Over-supported (visibility > inventory)"
            else:
                status = "✅ Balanced"
            
            output.append(f"| {br_key} | {demand:,} | {avail} units | {status} |")
        
        output.append("")
        
        return "\n".join(output)
    
    def generate_section_3(self, floorplans: List[Dict], queries: List[Dict], property_info: Dict) -> str:
        """Generate Section 3: SEO Content Improvement Recommendations"""
        output = []
        output.append("## 3. SEO Content Improvement Recommendations")
        output.append("")
        
        recommendations = []
        
        # Analyze floorplan-level pages
        high_inventory_fps = [fp for fp in floorplans if (fp['units_available_now'] or 0) >= 5]
        
        if high_inventory_fps:
            for fp in high_inventory_fps[:3]:  # Top 3
                rec = {
                    'page': f"Floorplan page for {fp['floorplan_name']} ({fp['bedrooms']}bd/{fp['bathrooms']}ba)",
                    'action': f"Create or enhance dedicated floorplan page",
                    'impact': f"Support leasing {fp['units_available_now']} available units",
                    'details': [
                        f"Target keywords: '{property_info['property_name']} {fp['bedrooms']} bedroom'",
                        f"Include: pricing (${fp['rent_from']:,.0f}-${fp['rent_to']:,.0f}), {fp['sqft']} sqft, availability",
                        "Add: 360° tour, floorplan diagram, amenity list"
                    ]
                }
                recommendations.append(rec)
        
        # Analyze modifier gaps
        pricing_queries = [q for q in queries if self.classify_query_intent(q['query']) == 'Pricing']
        avail_queries = [q for q in queries if self.classify_query_intent(q['query']) == 'Availability']
        
        if len(pricing_queries) > 5:
            rec = {
                'page': "Pricing/Specials page",
                'action': "Create clear pricing overview page",
                'impact': f"Capture {sum(q['total_impressions'] for q in pricing_queries[:10]):,} monthly impressions on pricing queries",
                'details': [
                    "Show rent ranges by floorplan type",
                    "Highlight current specials/move-in offers",
                    "Include availability calendar"
                ]
            }
            recommendations.append(rec)
        
        if len(avail_queries) > 5:
            rec = {
                'page': "Real-time availability page",
                'action': "Add or improve availability page with live inventory",
                'impact': f"Convert {sum(q['total_clicks'] for q in avail_queries[:10]):,} monthly availability clicks",
                'details': [
                    "Show unit-level availability by floorplan",
                    "Include move-in dates",
                    "Add scheduling tool for tours"
                ]
            }
            recommendations.append(rec)
        
        # Output recommendations
        for i, rec in enumerate(recommendations[:5], 1):  # Top 5 only
            output.append(f"### Recommendation {i}: {rec['action']}")
            output.append("")
            output.append(f"**Target**: {rec['page']}")
            output.append(f"**Impact**: {rec['impact']}")
            output.append("")
            output.append("**Implementation**:")
            for detail in rec['details']:
                output.append(f"- {detail}")
            output.append("")
        
        if not recommendations:
            output.append("✅ **No critical content gaps identified**")
            output.append("")
            output.append("Current content coverage appears adequate for available inventory.")
        
        output.append("")
        
        return "\n".join(output)
    
    def generate_section_4(self, competitors: List[Dict], property_info: Dict) -> str:
        """Generate Section 4: Primary Online Competitor Insight"""
        output = []
        output.append("## 4. Primary Online Competitor Insight")
        output.append("")
        
        if not competitors:
            output.append("⚠️ **No competitor data available**")
            output.append("")
            output.append("**Action Needed**: Map primary competitors for {property_info['property_name']} to enable competitive analysis.")
            return "\n".join(output)
        
        # Focus on #1 competitor only
        primary = competitors[0]
        
        output.append(f"### Primary Digital Competitor: {primary['competitor_name']}")
        output.append("")
        output.append(f"**Market Position**: #{primary['competitor_rank']} competitor (by AptIQ survey)")
        output.append("")
        
        # Note: Without SEMRush data, provide framework for analysis
        output.append("#### Why They're Winning (Framework for Analysis)")
        output.append("")
        output.append("*Note: Full competitive analysis requires SEMRush integration*")
        output.append("")
        output.append("**Factors to Investigate**:")
        output.append("1. **Content Coverage**: Do they have dedicated floorplan pages? Pricing transparency?")
        output.append("2. **Keyword Alignment**: Are they targeting high-intent local keywords we're missing?")
        output.append("3. **Authority**: Domain age, backlink profile, local citations")
        output.append("4. **UX Clarity**: Clearer path to availability/pricing/contact?")
        output.append("")
        
        output.append("#### Competitive Response Recommendations")
        output.append("")
        output.append(f"1. **Benchmark their site structure** - Manual review of {primary['competitor_name']} website")
        output.append("   - Map their navigation and content hierarchy")
        output.append("   - Identify any floorplan-level pages they have that we lack")
        output.append("")
        output.append("2. **Compare pricing transparency** - Are they showing rates publicly while we hide them?")
        output.append("   - Consider showing more pricing information if they are")
        output.append("")
        
        # Show other top competitors
        if len(competitors) > 1:
            output.append("")
            output.append("**Other Top Competitors**:")
            for comp in competitors[1:4]:  # Show 2-4
                output.append(f"- #{comp['competitor_rank']}: {comp['competitor_name']}")
        
        output.append("")
        
        return "\n".join(output)
    
    def generate_section_5(self, floorplans: List[Dict], queries: List[Dict], competitors: List[Dict]) -> str:
        """Generate Section 5: Action Summary"""
        output = []
        output.append("## 5. Action Summary")
        output.append("")
        output.append("### Prioritized Actions")
        output.append("")
        
        actions = []
        
        # Action 1: High inventory floorplans
        high_inv = [fp for fp in floorplans if (fp['units_available_now'] or 0) >= 5]
        if high_inv:
            top_fp = sorted(high_inv, key=lambda x: x['units_available_now'], reverse=True)[0]
            actions.append({
                'priority': 1,
                'action': f"Create/enhance content for {top_fp['floorplan_name']} ({top_fp['bedrooms']}bd/{top_fp['bathrooms']}ba)",
                'reason': f"High inventory pressure: {top_fp['units_available_now']} units available",
                'deliverable': "Dedicated floorplan page with pricing, photos, availability",
                'timeline': "This week"
            })
        
        # Action 2: Pricing transparency
        pricing_demand = [q for q in queries if 'price' in q['query'].lower() or 'rent' in q['query'].lower()]
        if len(pricing_demand) > 10:
            actions.append({
                'priority': 2,
                'action': "Improve pricing transparency",
                'reason': f"{len(pricing_demand)} queries show pricing intent, {sum(q['total_impressions'] for q in pricing_demand):,} impressions",
                'deliverable': "Pricing page showing rent ranges by floorplan",
                'timeline': "This week"
            })
        
        # Action 3: Availability page
        avail_demand = [q for q in queries if 'availab' in q['query'].lower() or 'vacancy' in q['query'].lower()]
        if len(avail_demand) > 5:
            actions.append({
                'priority': 3,
                'action': "Add real-time availability page",
                'reason': f"Availability queries: {sum(q['total_clicks'] for q in avail_demand)} clicks",
                'deliverable': "Live availability calendar with unit-level detail",
                'timeline': "Next 2 weeks"
            })
        
        # Action 4: Competitor benchmark
        if competitors:
            actions.append({
                'priority': 4,
                'action': f"Benchmark against {competitors[0]['competitor_name']}",
                'reason': "Primary competitor - understand their content advantage",
                'deliverable': "Competitive analysis report with content gap recommendations",
                'timeline': "Next 2 weeks"
            })
        
        # Output actions
        for action in actions[:5]:  # Max 5 actions
            output.append(f"**{action['priority']}. {action['action']}**")
            output.append(f"- **Why**: {action['reason']}")
            output.append(f"- **Deliverable**: {action['deliverable']}")
            output.append(f"- **Timeline**: {action['timeline']}")
            output.append("")
        
        if not actions:
            output.append("✅ **No urgent actions identified**")
            output.append("")
            output.append("Current inventory and visibility appear well-balanced.")
        
        return "\n".join(output)
    
    def generate_pib_v2(self, encasa_short_name: str) -> str:
        """Generate complete PIB v2 report"""
        # Get property info
        prop_info = self.get_property_info(encasa_short_name)
        if not prop_info:
            return f"ERROR: Property '{encasa_short_name}' not found in database"
        
        # Header
        output = []
        output.append("# Property Intelligence Brief v2")
        output.append("")
        output.append(f"**Property**: {prop_info['property_name']}")
        output.append(f"**Region**: {prop_info['encasa_region']}")
        output.append(f"**Property Code**: {prop_info['thirtylines_id']}")
        output.append(f"**Generated**: {datetime.now().strftime('%Y-%m-%d %I:%M %p CST')}")
        output.append("")
        output.append("---")
        output.append("")
        
        # Section 1: Availability
        floorplans, snapshot_date = self.get_availability_data(prop_info['property_id'])
        output.append(self.generate_section_1(floorplans, snapshot_date))
        output.append("---")
        output.append("")
        
        # Section 2: Demand vs Supply
        metrics, queries = self.get_demand_data(prop_info['gsc_url'])
        output.append(self.generate_section_2(floorplans, metrics, queries))
        output.append("---")
        output.append("")
        
        # Section 3: SEO Recommendations
        output.append(self.generate_section_3(floorplans, queries, prop_info))
        output.append("---")
        output.append("")
        
        # Section 4: Competitor
        competitors = self.get_competitor_data(prop_info['property_id'])
        output.append(self.generate_section_4(competitors, prop_info))
        output.append("---")
        output.append("")
        
        # Section 5: Actions
        output.append(self.generate_section_5(floorplans, queries, competitors))
        
        # Footer
        output.append("")
        output.append("---")
        output.append("")
        output.append("*This is a descriptive + diagnostic brief. No forecasting, optimization, or conversion modeling.*")
        
        return "\n".join(output)
    
    def close(self):
        """Close database connection"""
        self.conn.close()


def main():
    """CLI interface"""
    if len(sys.argv) < 2:
        print("Usage: python generate_pib_v2.py <encasa_short_name>")
        print("Example: python generate_pib_v2.py Townhomes")
        sys.exit(1)
    
    property_name = sys.argv[1]
    
    # Initialize generator
    db_path = '/Users/mark/Property_Analytics/data/portfolio_analytics.db'
    generator = PIBv2Generator(db_path)
    
    # Generate report
    report = generator.generate_pib_v2(property_name)
    
    # Output to file
    output_file = f"PIB_v2_{property_name}_{datetime.now().strftime('%Y%m%d')}.md"
    with open(output_file, 'w') as f:
        f.write(report)
    
    print(f"✅ Generated: {output_file}")
    
    # Also print to stdout
    print("\n" + "=" * 80)
    print(report)
    
    generator.close()


if __name__ == "__main__":
    main()
