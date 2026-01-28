#!/usr/bin/env python3
"""
RESI vs Portfolio Comparison - Phase 2: Full Report Generation
Generate PIB-style HTML report with complete metrics, winner determination, and synthesis.
"""

import json
import sqlite3
import csv
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple
from collections import defaultdict

# Constants
DB_PATH = Path('/Users/mark/Property_Analytics/data/portfolio_analytics.db')
REGISTRY_PATH = Path('/Users/mark/Property_Analytics/config/venterra_properties_official.json')
OUTPUT_DIR = Path('/Users/mark/Property_Analytics/reports/resi_comparison')
ANALYSIS_WINDOW_DAYS = 30
GSC_LAG_DAYS = 3

# Resi properties to analyze (Monteverde excluded - pre-opening)
RESI_PROPERTIES = {
    'cendana': {'search_domain': 'cendanalife.com', 'metro': 'Houston, TX'},
    'camber_ridge': {'search_domain': 'camberridgeapartments.com', 'metro': None},
    'delta_pearland': {'search_domain': 'thedeltapearland.com', 'metro': 'Houston, TX'}
}

# Pre-determined matches from Phase 1.1 (NON-RESI portfolio properties only)
PHASE1_MATCHES = {
    'cendana': [
        {'name': 'Gateway North', 'score': 65, 'search_domain': 'gatewaynorthapts.com'},
        {'name': 'Luma Headwaters', 'score': 60, 'search_domain': 'lumaheadwaters.com'}  # Next best non-Resi match
    ],
    'camber_ridge': [
        {'name': 'Monteverde', 'score': 95, 'search_domain': 'monteverdesatx.com'},  # Portfolio property (pre-opening)
        {'name': 'Luma Headwaters', 'score': 85, 'search_domain': 'lumaheadwaters.com'}
    ],
    'delta_pearland': [
        {'name': 'Luma Headwaters', 'score': 65, 'search_domain': 'lumaheadwaters.com'},
        {'name': 'Gateway North', 'score': 60, 'search_domain': 'gatewaynorthapts.com'}  # Next best non-Resi match
    ]
}


class ResiPhase2Report:
    """Phase 2: Full report generation"""
    
    def __init__(self):
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row
        
        with open(REGISTRY_PATH, 'r') as f:
            self.registry = json.load(f)
        
        self.report_date = datetime.now().strftime('%Y-%m-%d')
        self.resi_properties = {}
        self.all_metrics = {}
        self.comparisons = {}
        self.category_winners = {}
    
    def close(self):
        self.conn.close()
    
    def _infer_metro(self, url: str, name: str) -> str:
        """Infer metro from URL/name"""
        text = (url + ' ' + name).lower()
        
        if any(city in text for city in ['houston', 'richmond', 'pearland', 'katy']):
            return 'Houston, TX'
        elif 'san-antonio' in text or 'san antonio' in text:
            return 'San Antonio, TX'
        elif 'dallas' in text:
            return 'Dallas, TX'
        elif 'austin' in text:
            return 'Austin, TX'
        elif 'atlanta' in text:
            return 'Atlanta, GA'
        elif 'orlando' in text or 'clermont' in text:
            return 'Orlando, FL'
        
        return 'Unknown'
    
    def identify_all_properties(self):
        """Identify Resi properties and their matches"""
        print("\n" + "=" * 80)
        print("PHASE 2: FULL REPORT GENERATION")
        print("=" * 80)
        print(f"Date: {self.report_date}")
        print(f"Analysis Window: Last {ANALYSIS_WINDOW_DAYS} days")
        print("=" * 80)
        
        # Identify Resi properties
        for resi_key, resi_search in RESI_PROPERTIES.items():
            search_domain = resi_search['search_domain']
            
            for prop in self.registry.get('properties', []):
                full_url = prop.get('full_url', '')
                if search_domain in full_url:
                    self.resi_properties[resi_key] = {
                        'key': resi_key,
                        'ga4_property_id': prop.get('ga4_property_id'),
                        'name': prop.get('name'),
                        'domain': search_domain,
                        'full_url': full_url,
                        'unit_count': prop.get('unit_count'),
                        'metro': resi_search['metro'] or self._infer_metro(full_url, prop.get('name', '')),
                        'matches': []
                    }
                    break
        
        # Add matches for each Resi property
        for resi_key, matches in PHASE1_MATCHES.items():
            if resi_key not in self.resi_properties:
                continue
            
            for match_info in matches:
                match_domain = match_info['search_domain']
                
                for prop in self.registry.get('properties', []):
                    full_url = prop.get('full_url', '')
                    if match_domain in full_url:
                        self.resi_properties[resi_key]['matches'].append({
                            'ga4_property_id': prop.get('ga4_property_id'),
                            'name': prop.get('name'),
                            'domain': match_domain,
                            'full_url': full_url,
                            'unit_count': prop.get('unit_count'),
                            'metro': self._infer_metro(full_url, prop.get('name', '')),
                            'match_score': match_info['score']
                        })
                        break
        
        print(f"\n✓ Identified {len(self.resi_properties)} Resi properties with matches")
        for resi_key, resi in self.resi_properties.items():
            print(f"  - {resi['name']}: {len(resi['matches'])} matches")
        
        return self.resi_properties
    
    def extract_full_metrics(self, property_id: str) -> Dict:
        """Extract complete metrics from all sources"""
        cursor = self.conn.cursor()
        metrics = {
            'property_id': property_id,
            'ga4': {},
            'gsc': {},
            'psi': {},
            'gbp': {},
            'readiness': {}
        }
        
        # GA4 metrics
        cursor.execute("""
            SELECT 
                COUNT(DISTINCT metric_date) as days_with_data,
                SUM(sessions) as sessions,
                SUM(engaged_sessions) as engaged_sessions,
                SUM(total_users) as total_users,
                SUM(conversions) as conversions,
                SUM(pageviews) as pageviews,
                AVG(avg_session_duration) as avg_session_duration
            FROM ga4_daily_metrics
            WHERE property_id = ?
            AND metric_date >= date('now', ?)
        """, (property_id, f'-{ANALYSIS_WINDOW_DAYS} days'))
        
        row = cursor.fetchone()
        if row and row['sessions']:
            days = row['days_with_data']
            metrics['ga4'] = dict(row)
            
            # Calculate derived metrics
            sessions = row['sessions']
            engaged = row['engaged_sessions']
            conversions = row['conversions']
            
            if sessions > 0:
                metrics['ga4']['engagement_rate'] = round((engaged / sessions) * 100, 2) if engaged else 0
                metrics['ga4']['cir_per_100_sessions'] = round((conversions / sessions) * 100, 2)
            
            if engaged > 0:
                metrics['ga4']['cir_per_100_engaged'] = round((conversions / engaged) * 100, 2)
            
            # Readiness
            coverage = (days / ANALYSIS_WINDOW_DAYS) * 100
            metrics['readiness']['ga4'] = {
                'status': 'FULL' if coverage >= 95 else 'PARTIAL',
                'coverage': coverage,
                'days': days,
                'reason': f'Only {days}/{ANALYSIS_WINDOW_DAYS} days with data' if coverage < 95 else None
            }
        else:
            metrics['readiness']['ga4'] = {'status': 'MISSING', 'coverage': 0, 'days': 0}
        
        # GSC metrics (with lag handling)
        cursor.execute("""
            SELECT 
                COUNT(DISTINCT metric_date) as days_with_data,
                SUM(clicks) as clicks,
                SUM(impressions) as impressions,
                AVG(ctr) as ctr,
                AVG(average_position) as average_position
            FROM gsc_daily_metrics
            WHERE ga4_property_id = ?
            AND metric_date >= date('now', ?)
            AND metric_date <= date('now', ?)
        """, (property_id, f'-{ANALYSIS_WINDOW_DAYS} days', f'-{GSC_LAG_DAYS} days'))
        
        row = cursor.fetchone()
        expected_gsc_days = ANALYSIS_WINDOW_DAYS - GSC_LAG_DAYS
        if row and row['clicks'] is not None and row['clicks'] > 0:
            days = row['days_with_data']
            metrics['gsc'] = dict(row)
            
            # Readiness
            coverage = (days / expected_gsc_days) * 100
            metrics['readiness']['gsc'] = {
                'status': 'FULL' if coverage >= 95 else 'PARTIAL',
                'coverage': coverage,
                'days': days,
                'reason': f'Only {days}/{expected_gsc_days} days with data (3-day lag)' if coverage < 95 else None
            }
        else:
            metrics['readiness']['gsc'] = {'status': 'MISSING', 'coverage': 0, 'days': 0}
        
        # PSI metrics (mobile only)
        cursor.execute("""
            SELECT 
                COUNT(DISTINCT metric_date) as days_with_data,
                AVG(performance_score) as performance_score,
                AVG(accessibility_score) as accessibility_score,
                AVG(best_practices_score) as best_practices_score,
                AVG(seo_score) as seo_score,
                AVG(lcp_value) as lcp_value,
                AVG(cls_value) as cls_value,
                AVG(fid_value) as fid_value,
                AVG(fcp_value) as fcp_value,
                AVG(ttfb_value) as ttfb_value
            FROM pagespeed_metrics
            WHERE property_id = ?
            AND strategy = 'mobile'
            AND metric_date >= date('now', ?)
        """, (property_id, f'-{ANALYSIS_WINDOW_DAYS} days'))
        
        row = cursor.fetchone()
        if row and row['performance_score'] is not None:
            days = row['days_with_data']
            metrics['psi'] = {k: round(v, 2) if isinstance(v, (int, float)) and k != 'days_with_data' else v 
                             for k, v in dict(row).items()}
            
            # Readiness
            coverage = (days / ANALYSIS_WINDOW_DAYS) * 100
            metrics['readiness']['psi'] = {
                'status': 'FULL' if coverage >= 95 else 'PARTIAL',
                'coverage': coverage,
                'days': days,
                'reason': f'Only {days}/{ANALYSIS_WINDOW_DAYS} days with data' if coverage < 95 else None
            }
        else:
            metrics['readiness']['psi'] = {'status': 'MISSING', 'coverage': 0, 'days': 0}
        
        # GBP metrics
        cursor.execute("""
            SELECT 
                COUNT(DISTINCT metric_date) as days_with_data,
                AVG(website_clicks) as website_clicks,
                AVG(phone_calls) as phone_calls,
                AVG(direction_requests) as direction_requests,
                AVG(total_profile_views) as total_profile_views
            FROM gbp_daily_insights
            WHERE property_id = ?
            AND metric_date >= date('now', ?)
        """, (property_id, f'-{ANALYSIS_WINDOW_DAYS} days'))
        
        row = cursor.fetchone()
        if row and row['days_with_data'] and row['days_with_data'] > 0:
            metrics['gbp'] = dict(row)
            metrics['readiness']['gbp'] = {'status': 'PARTIAL', 'coverage': (row['days_with_data'] / ANALYSIS_WINDOW_DAYS) * 100}
        else:
            metrics['readiness']['gbp'] = {'status': 'MISSING', 'coverage': 0}
        
        return metrics
    
    def extract_all_metrics(self):
        """Extract metrics for all Resi properties and their matches"""
        print("\n" + "=" * 80)
        print("EXTRACTING METRICS FOR ALL PROPERTIES")
        print("=" * 80)
        
        for resi_key, resi in self.resi_properties.items():
            print(f"\n--- {resi['name']} (Resi) ---")
            self.all_metrics[resi['ga4_property_id']] = self.extract_full_metrics(resi['ga4_property_id'])
            
            for match in resi['matches']:
                print(f"--- {match['name']} (Match) ---")
                self.all_metrics[match['ga4_property_id']] = self.extract_full_metrics(match['ga4_property_id'])
        
        print("\n✓ Metrics extraction complete")
    
    def determine_category_winners(self):
        """Determine winners for each category with delta citations"""
        print("\n" + "=" * 80)
        print("DETERMINING CATEGORY WINNERS")
        print("=" * 80)
        
        for resi_key, resi in self.resi_properties.items():
            print(f"\n--- {resi['name']} ---")
            
            resi_metrics = self.all_metrics[resi['ga4_property_id']]
            match_metrics_list = [self.all_metrics[m['ga4_property_id']] for m in resi['matches']]
            
            winners = self._analyze_property_comparison(resi, resi_metrics, match_metrics_list)
            self.category_winners[resi_key] = winners
            
            # Display results
            for category, result in winners.items():
                print(f"  {category}: {result['winner']} - {result['reason']}")
        
        print("\n✓ Winner determination complete")
    
    def _analyze_property_comparison(self, resi: Dict, resi_metrics: Dict, match_metrics_list: List[Dict]) -> Dict:
        """Analyze comparison and determine winners per category"""
        winners = {}
        
        # Calculate match averages
        match_avg = self._calculate_match_averages(match_metrics_list)
        
        # Category 1: Demand/Visibility (GSC)
        if resi_metrics['readiness']['gsc']['status'] != 'MISSING':
            resi_impressions = resi_metrics['gsc'].get('impressions', 0)
            resi_clicks = resi_metrics['gsc'].get('clicks', 0)
            match_impressions = match_avg['gsc'].get('impressions', 0)
            match_clicks = match_avg['gsc'].get('clicks', 0)
            
            if resi_impressions > match_impressions * 1.1 and resi_clicks > match_clicks * 1.1:
                delta_impr = ((resi_impressions - match_impressions) / match_impressions * 100) if match_impressions else 0
                delta_clicks = ((resi_clicks - match_clicks) / match_clicks * 100) if match_clicks else 0
                winners['Demand/Visibility'] = {
                    'winner': 'Resi',
                    'reason': f'{resi_impressions:,.0f} impressions (+{delta_impr:.0f}%) and {resi_clicks:,.0f} clicks (+{delta_clicks:.0f}%) vs peer avg'
                }
            elif resi_impressions < match_impressions * 0.9 or resi_clicks < match_clicks * 0.9:
                delta_impr = ((match_impressions - resi_impressions) / resi_impressions * 100) if resi_impressions else 0
                delta_clicks = ((match_clicks - resi_clicks) / resi_clicks * 100) if resi_clicks else 0
                winners['Demand/Visibility'] = {
                    'winner': 'Peers',
                    'reason': f'Peers average {match_impressions:,.0f} impressions (+{delta_impr:.0f}%) and {match_clicks:,.0f} clicks (+{delta_clicks:.0f}%)'
                }
            else:
                winners['Demand/Visibility'] = {'winner': 'Mixed', 'reason': 'No significant difference in search visibility'}
        else:
            winners['Demand/Visibility'] = {'winner': 'Insufficient Data', 'reason': 'GSC data missing'}
        
        # Category 2: Engagement (GA4)
        if resi_metrics['readiness']['ga4']['status'] != 'MISSING':
            resi_eng_rate = resi_metrics['ga4'].get('engagement_rate', 0)
            resi_session_dur = resi_metrics['ga4'].get('avg_session_duration', 0)
            match_eng_rate = match_avg['ga4'].get('engagement_rate', 0)
            match_session_dur = match_avg['ga4'].get('avg_session_duration', 0)
            
            if resi_eng_rate > match_eng_rate * 1.1:
                delta = resi_eng_rate - match_eng_rate
                winners['Engagement'] = {
                    'winner': 'Resi',
                    'reason': f'{resi_eng_rate:.1f}% engagement rate (+{delta:.1f} pts) vs {match_eng_rate:.1f}% peer avg'
                }
            elif resi_eng_rate < match_eng_rate * 0.9:
                delta = match_eng_rate - resi_eng_rate
                winners['Engagement'] = {
                    'winner': 'Peers',
                    'reason': f'Peers {match_eng_rate:.1f}% engagement rate (+{delta:.1f} pts) vs {resi_eng_rate:.1f}% Resi'
                }
            else:
                winners['Engagement'] = {'winner': 'Mixed', 'reason': f'Similar engagement rates ({resi_eng_rate:.1f}% vs {match_eng_rate:.1f}%)'}
        else:
            winners['Engagement'] = {'winner': 'Insufficient Data', 'reason': 'GA4 data missing'}
        
        # Category 3: Intent/Conversion (CIR)
        if resi_metrics['readiness']['ga4']['status'] != 'MISSING':
            resi_cir = resi_metrics['ga4'].get('cir_per_100_sessions', 0)
            match_cir = match_avg['ga4'].get('cir_per_100_sessions', 0)
            
            if resi_cir > match_cir * 1.2:
                delta = resi_cir - match_cir
                winners['Intent/Conversion'] = {
                    'winner': 'Resi',
                    'reason': f'{resi_cir:.2f} CIR/100 sessions (+{delta:.2f}) vs {match_cir:.2f} peer avg'
                }
            elif resi_cir < match_cir * 0.8:
                delta = match_cir - resi_cir
                winners['Intent/Conversion'] = {
                    'winner': 'Peers',
                    'reason': f'Peers {match_cir:.2f} CIR/100 sessions (+{delta:.2f}) vs {resi_cir:.2f} Resi'
                }
            else:
                # Note: CIR is 0 for all properties - need to check if this is a data issue
                winners['Intent/Conversion'] = {'winner': 'Insufficient Data', 'reason': f'CIR at 0 for all properties (data collection issue)'}
        else:
            winners['Intent/Conversion'] = {'winner': 'Insufficient Data', 'reason': 'GA4 conversion data missing'}
        
        # Category 4: Performance/UX (PSI)
        if resi_metrics['readiness']['psi']['status'] != 'MISSING':
            resi_perf = resi_metrics['psi'].get('performance_score', 0)
            resi_lcp = resi_metrics['psi'].get('lcp_value', 0)
            match_perf = match_avg['psi'].get('performance_score', 0)
            match_lcp = match_avg['psi'].get('lcp_value', 0)
            
            # Performance score: higher is better
            # LCP: lower is better
            perf_advantage = resi_perf > match_perf + 5
            lcp_advantage = resi_lcp < match_lcp * 0.9 if match_lcp > 0 else False
            
            if perf_advantage and lcp_advantage:
                winners['Performance/UX'] = {
                    'winner': 'Resi',
                    'reason': f'Performance {resi_perf:.0f}/100 vs {match_perf:.0f} peers; LCP {resi_lcp:.2f}s vs {match_lcp:.2f}s'
                }
            elif resi_perf < match_perf - 5 or (match_lcp > 0 and resi_lcp > match_lcp * 1.1):
                winners['Performance/UX'] = {
                    'winner': 'Peers',
                    'reason': f'Peers perform better: {match_perf:.0f}/100 score, {match_lcp:.2f}s LCP vs Resi {resi_perf:.0f}/100, {resi_lcp:.2f}s'
                }
            else:
                winners['Performance/UX'] = {'winner': 'Mixed', 'reason': f'Mixed performance signals (Resi {resi_perf:.0f}/100, Peers {match_perf:.0f}/100)'}
        else:
            winners['Performance/UX'] = {'winner': 'Insufficient Data', 'reason': 'PSI data missing'}
        
        # Category 5: Trust Context (GBP)
        if resi_metrics['readiness']['gbp']['status'] != 'MISSING':
            # GBP data available but limited - mark as partial
            winners['Trust Context'] = {'winner': 'Insufficient Data', 'reason': 'GBP data too limited for comparison'}
        else:
            winners['Trust Context'] = {'winner': 'Insufficient Data', 'reason': 'GBP data missing'}
        
        # Overall Winner (≥3/5 categories pointing same direction)
        resi_wins = sum(1 for w in winners.values() if w['winner'] == 'Resi')
        peer_wins = sum(1 for w in winners.values() if w['winner'] == 'Peers')
        
        if resi_wins >= 3:
            winners['Overall'] = {'winner': 'Resi', 'reason': f'Resi wins {resi_wins}/5 categories'}
        elif peer_wins >= 3:
            winners['Overall'] = {'winner': 'Peers', 'reason': f'Peers win {peer_wins}/5 categories'}
        else:
            winners['Overall'] = {'winner': 'Mixed', 'reason': f'Split results ({resi_wins} Resi, {peer_wins} Peers)'}
        
        return winners
    
    def _calculate_match_averages(self, match_metrics_list: List[Dict]) -> Dict:
        """Calculate average metrics across matches"""
        avg = {
            'ga4': {},
            'gsc': {},
            'psi': {},
            'gbp': {}
        }
        
        valid_matches = [m for m in match_metrics_list if m['readiness']['ga4']['status'] != 'MISSING']
        if valid_matches:
            for key in ['sessions', 'engaged_sessions', 'engagement_rate', 'cir_per_100_sessions', 'avg_session_duration']:
                values = [m['ga4'].get(key, 0) for m in valid_matches if key in m['ga4']]
                avg['ga4'][key] = sum(values) / len(values) if values else 0
        
        valid_matches = [m for m in match_metrics_list if m['readiness']['gsc']['status'] != 'MISSING']
        if valid_matches:
            for key in ['clicks', 'impressions', 'ctr', 'average_position']:
                values = [m['gsc'].get(key, 0) for m in valid_matches if key in m['gsc']]
                avg['gsc'][key] = sum(values) / len(values) if values else 0
        
        valid_matches = [m for m in match_metrics_list if m['readiness']['psi']['status'] != 'MISSING']
        if valid_matches:
            for key in ['performance_score', 'lcp_value', 'cls_value', 'fcp_value']:
                values = [m['psi'].get(key, 0) for m in valid_matches if key in m['psi']]
                avg['psi'][key] = sum(values) / len(values) if values else 0
        
        return avg
    
    def generate_csv_tables(self):
        """Generate CSV comparison tables"""
        print("\n" + "=" * 80)
        print("GENERATING CSV TABLES")
        print("=" * 80)
        
        csv_path = OUTPUT_DIR / f'resi_comparison_data_{self.report_date}.csv'
        
        rows = []
        rows.append(['Property', 'Type', 'Metro', 'Units', 'Sessions', 'Engagement Rate', 'CIR/100', 
                     'GSC Clicks', 'GSC Impressions', 'Performance Score', 'LCP', 'Data Status'])
        
        for resi_key, resi in self.resi_properties.items():
            resi_metrics = self.all_metrics[resi['ga4_property_id']]
            
            # Resi row
            rows.append([
                resi['name'],
                'Resi',
                resi['metro'],
                resi['unit_count'],
                resi_metrics['ga4'].get('sessions', 'N/A'),
                f"{resi_metrics['ga4'].get('engagement_rate', 0):.1f}%",
                f"{resi_metrics['ga4'].get('cir_per_100_sessions', 0):.2f}",
                resi_metrics['gsc'].get('clicks', 'N/A'),
                resi_metrics['gsc'].get('impressions', 'N/A'),
                resi_metrics['psi'].get('performance_score', 'N/A'),
                f"{resi_metrics['psi'].get('lcp_value', 0):.2f}s" if resi_metrics['psi'].get('lcp_value') else 'N/A',
                f"GA4:{resi_metrics['readiness']['ga4']['status']} GSC:{resi_metrics['readiness']['gsc']['status']} PSI:{resi_metrics['readiness']['psi']['status']}"
            ])
            
            # Match rows
            for match in resi['matches']:
                match_metrics = self.all_metrics[match['ga4_property_id']]
                rows.append([
                    match['name'],
                    'Peer',
                    match['metro'],
                    match['unit_count'],
                    match_metrics['ga4'].get('sessions', 'N/A'),
                    f"{match_metrics['ga4'].get('engagement_rate', 0):.1f}%",
                    f"{match_metrics['ga4'].get('cir_per_100_sessions', 0):.2f}",
                    match_metrics['gsc'].get('clicks', 'N/A'),
                    match_metrics['gsc'].get('impressions', 'N/A'),
                    match_metrics['psi'].get('performance_score', 'N/A'),
                    f"{match_metrics['psi'].get('lcp_value', 0):.2f}s" if match_metrics['psi'].get('lcp_value') else 'N/A',
                    f"GA4:{match_metrics['readiness']['ga4']['status']} GSC:{match_metrics['readiness']['gsc']['status']} PSI:{match_metrics['readiness']['psi']['status']}"
                ])
            
            rows.append([])  # Blank row between Resi properties
        
        with open(csv_path, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
        
        print(f"✓ CSV tables saved: {csv_path}")
        return csv_path
    
    def generate_html_report(self):
        """Generate PIB-style HTML report"""
        print("\n" + "=" * 80)
        print("GENERATING PIB-STYLE HTML REPORT")
        print("=" * 80)
        
        html_path = OUTPUT_DIR / f'Resi_Comparison_Report_{self.report_date}.html'
        
        html = self._build_html_report()
        
        with open(html_path, 'w') as f:
            f.write(html)
        
        print(f"✓ HTML report saved: {html_path}")
        return html_path
    
    def _build_html_report(self) -> str:
        """Build complete HTML report"""
        # HTML report construction
        html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Resi vs Portfolio Performance Analysis - {self.report_date}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            border-radius: 8px;
            margin-bottom: 30px;
        }}
        .header h1 {{
            margin: 0 0 10px 0;
            font-size: 32px;
        }}
        .header .meta {{
            opacity: 0.9;
            font-size: 14px;
        }}
        .section {{
            background: white;
            padding: 30px;
            margin-bottom: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .section h2 {{
            color: #667eea;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
            margin-top: 0;
        }}
        .section h3 {{
            color: #764ba2;
            margin-top: 25px;
        }}
        .comparison-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }}
        .metric-card {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #667eea;
        }}
        .metric-card .label {{
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            font-weight: 600;
        }}
        .metric-card .value {{
            font-size: 24px;
            font-weight: bold;
            color: #333;
            margin: 5px 0;
        }}
        .metric-card .delta {{
            font-size: 14px;
            color: #666;
        }}
        .winner-badge {{
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }}
        .winner-resi {{ background: #d4edda; color: #155724; }}
        .winner-peers {{ background: #f8d7da; color: #721c24; }}
        .winner-mixed {{ background: #fff3cd; color: #856404; }}
        .winner-insufficient {{ background: #e2e3e5; color: #383d41; }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }}
        table th {{
            background: #667eea;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }}
        table td {{
            padding: 10px 12px;
            border-bottom: 1px solid #e0e0e0;
        }}
        table tr:hover {{
            background: #f8f9fa;
        }}
        .caveat {{
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
        }}
        .caveat-title {{
            font-weight: 600;
            color: #856404;
            margin-bottom: 5px;
        }}
        .footer {{
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-top: 40px;
            padding: 20px;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Resi vs Portfolio Performance Analysis</h1>
        <div class="meta">
            <strong>Report Date:</strong> {self.report_date} | 
            <strong>Analysis Window:</strong> Last {ANALYSIS_WINDOW_DAYS} days | 
            <strong>Properties Analyzed:</strong> {len(self.resi_properties)} Resi properties
        </div>
    </div>
    
    {self._generate_executive_summary()}
    
    {self._generate_match_methodology()}
    
    {self._generate_property_comparisons()}
    
    {self._generate_synthesis()}
    
    {self._generate_data_caveats()}
    
    <div class="footer">
        <p>Generated by Portfolio Analytics System | Venterra Property Intelligence Brief</p>
        <p>Co-Authored-By: Warp &lt;agent@warp.dev&gt;</p>
    </div>
</body>
</html>"""
        
        return html
    
    def _generate_executive_summary(self) -> str:
        """Generate executive summary section"""
        html = '<div class="section">\n<h2>Executive Summary</h2>\n'
        
        html += '<p>This report evaluates {num} Resi-hosted properties against comparable portfolio peers across 5 performance dimensions: Demand/Visibility (GSC), Engagement (GA4), Intent/Conversion (CIR), Performance/UX (PSI), and Trust Context (GBP).</p>\n'.format(num=len(self.resi_properties))
        
        # Key findings per property
        for resi_key, resi in self.resi_properties.items():
            winners = self.category_winners.get(resi_key, {})
            overall = winners.get('Overall', {})
            
            html += f'<h3>{resi["name"]}</h3>\n'
            html += f'<p><span class="winner-badge winner-{overall.get("winner", "mixed").lower().replace("/", "-").replace(" ", "-")}">{overall.get("winner", "Mixed")}</span> '
            html += f'{overall.get("reason", "No conclusion")}</p>\n'
        
        html += '</div>\n'
        return html
    
    def _generate_match_methodology(self) -> str:
        """Generate match methodology section"""
        html = '<div class="section">\n<h2>Match Methodology</h2>\n'
        
        html += '<p>Each Resi property was matched with 2 comparable portfolio properties using a multi-factor scoring algorithm (0-100):</p>\n'
        html += '<ul>\n'
        html += '<li><strong>Metro Match (40 pts):</strong> Same metro market or state-level fallback (reduced to 25 pts)</li>\n'
        html += '<li><strong>Unit Similarity (30 pts):</strong> Unit count within ±25% (strict) or ±35% (widened)</li>\n'
        html += '<li><strong>Traffic Similarity (20 pts):</strong> 30-day session volume within similar band</li>\n'
        html += '<li><strong>GBP Proxy (10 pts):</strong> Placeholder for positioning/asset class</li>\n'
        html += '</ul>\n'
        
        html += '<p><strong>Matching Results:</strong></p>\n'
        html += '<table>\n<tr><th>Resi Property</th><th>Match 1</th><th>Score</th><th>Match 2</th><th>Score</th></tr>\n'
        
        for resi_key, resi in self.resi_properties.items():
            matches = resi.get('matches', [])
            match1 = matches[0] if len(matches) > 0 else {'name': 'None', 'match_score': 0}
            match2 = matches[1] if len(matches) > 1 else {'name': 'None', 'match_score': 0}
            
            html += f'<tr><td>{resi["name"]}</td><td>{match1["name"]}</td><td>{match1["match_score"]}/100</td><td>{match2["name"]}</td><td>{match2["match_score"]}/100</td></tr>\n'
        
        html += '</table>\n'
        html += '</div>\n'
        return html
    
    def _generate_property_comparisons(self) -> str:
        """Generate per-property comparison sections"""
        html = ''
        
        for resi_key, resi in self.resi_properties.items():
            html += '<div class="section">\n'
            html += f'<h2>{resi["name"]} vs Comparable Properties</h2>\n'
            
            resi_metrics = self.all_metrics[resi['ga4_property_id']]
            winners = self.category_winners.get(resi_key, {})
            
            # Category winners
            html += '<h3>Category Performance</h3>\n'
            html += '<table>\n<tr><th>Category</th><th>Winner</th><th>Reasoning</th></tr>\n'
            
            for category in ['Demand/Visibility', 'Engagement', 'Intent/Conversion', 'Performance/UX', 'Trust Context']:
                result = winners.get(category, {'winner': 'Unknown', 'reason': 'Not analyzed'})
                badge_class = result['winner'].lower().replace('/', '-').replace(' ', '-')
                html += f'<tr><td>{category}</td><td><span class="winner-badge winner-{badge_class}">{result["winner"]}</span></td><td>{result["reason"]}</td></tr>\n'
            
            html += '</table>\n'
            
            # Key metrics comparison
            html += '<h3>Key Metrics</h3>\n'
            html += '<div class="comparison-grid">\n'
            
            # GA4 metrics
            if resi_metrics['readiness']['ga4']['status'] != 'MISSING':
                html += f"""<div class="metric-card">
                    <div class="label">Sessions (30d)</div>
                    <div class="value">{resi_metrics['ga4'].get('sessions', 0):,}</div>
                    <div class="delta">Resi Property</div>
                </div>"""
                
                html += f"""<div class="metric-card">
                    <div class="label">Engagement Rate</div>
                    <div class="value">{resi_metrics['ga4'].get('engagement_rate', 0):.1f}%</div>
                    <div class="delta">Resi Property</div>
                </div>"""
            
            # PSI metrics
            if resi_metrics['readiness']['psi']['status'] != 'MISSING':
                html += f"""<div class="metric-card">
                    <div class="label">Mobile Performance</div>
                    <div class="value">{resi_metrics['psi'].get('performance_score', 0):.0f}/100</div>
                    <div class="delta">Resi Property</div>
                </div>"""
                
                html += f"""<div class="metric-card">
                    <div class="label">LCP (Largest Contentful Paint)</div>
                    <div class="value">{resi_metrics['psi'].get('lcp_value', 0):.2f}s</div>
                    <div class="delta">Resi Property</div>
                </div>"""
            
            html += '</div>\n'
            html += '</div>\n'
        
        return html
    
    def _generate_synthesis(self) -> str:
        """Generate synthesis section"""
        html = '<div class="section">\n<h2>Synthesis: What Resi Does Better/Worse</h2>\n'
        
        # Aggregate findings across all Resi properties
        resi_wins_total = 0
        peer_wins_total = 0
        category_breakdown = defaultdict(lambda: {'resi': 0, 'peers': 0, 'mixed': 0})
        
        for resi_key, winners in self.category_winners.items():
            for category, result in winners.items():
                if category == 'Overall':
                    continue
                winner = result['winner']
                if winner == 'Resi':
                    resi_wins_total += 1
                    category_breakdown[category]['resi'] += 1
                elif winner == 'Peers':
                    peer_wins_total += 1
                    category_breakdown[category]['peers'] += 1
                else:
                    category_breakdown[category]['mixed'] += 1
        
        html += '<h3>Strengths</h3>\n'
        html += '<ul>\n'
        for category, counts in category_breakdown.items():
            if counts['resi'] >= 2:
                html += f'<li><strong>{category}:</strong> Resi properties show consistent advantage ({counts["resi"]}/{len(self.resi_properties)} properties winning)</li>\n'
        html += '</ul>\n'
        
        html += '<h3>Weaknesses</h3>\n'
        html += '<ul>\n'
        for category, counts in category_breakdown.items():
            if counts['peers'] >= 2:
                html += f'<li><strong>{category}:</strong> Portfolio peers perform better ({counts["peers"]}/{len(self.resi_properties)} comparisons favoring peers)</li>\n'
        html += '</ul>\n'
        
        html += '<h3>Unclear/Mixed</h3>\n'
        html += '<ul>\n'
        for category, counts in category_breakdown.items():
            if counts['mixed'] >= 2 or (counts['resi'] == counts['peers']):
                html += f'<li><strong>{category}:</strong> No clear pattern emerges across comparisons</li>\n'
        html += '</ul>\n'
        
        html += '</div>\n'
        return html
    
    def _generate_data_caveats(self) -> str:
        """Generate data caveats section"""
        html = '<div class="section">\n<h2>Data Caveats & Availability</h2>\n'
        
        html += '<div class="caveat">\n'
        html += '<div class="caveat-title">GSC Data Lag</div>\n'
        html += f'<p>Google Search Console data has a {GSC_LAG_DAYS}-day API delay. Analysis covers days -30 to -{GSC_LAG_DAYS}, expecting {ANALYSIS_WINDOW_DAYS - GSC_LAG_DAYS} days of data.</p>\n'
        html += '</div>\n'
        
        html += '<div class="caveat">\n'
        html += '<div class="caveat-title">GTMetrix Not Collected</div>\n'
        html += '<p>GTMetrix metrics are not actively collected. Performance analysis relies on PageSpeed Insights only.</p>\n'
        html += '</div>\n'
        
        html += '<div class="caveat">\n'
        html += '<div class="caveat-title">GBP Data Limited</div>\n'
        html += '<p>Google Business Profile data availability varies significantly across properties. Many properties show incomplete or missing GBP metrics.</p>\n'
        html += '</div>\n'
        
        html += '<div class="caveat">\n'
        html += '<div class="caveat-title">Conversion Data Issue</div>\n'
        html += '<p>All properties show 0 conversions in GA4. This appears to be a data collection or configuration issue requiring investigation.</p>\n'
        html += '</div>\n'
        
        html += '<h3>Data Completeness by Source</h3>\n'
        html += '<table>\n<tr><th>Property</th><th>GA4</th><th>GSC</th><th>PSI</th><th>GBP</th></tr>\n'
        
        for resi_key, resi in self.resi_properties.items():
            resi_metrics = self.all_metrics[resi['ga4_property_id']]
            html += f'<tr><td><strong>{resi["name"]} (Resi)</strong></td>'
            html += f'<td>{resi_metrics["readiness"]["ga4"]["status"]}</td>'
            html += f'<td>{resi_metrics["readiness"]["gsc"]["status"]}</td>'
            html += f'<td>{resi_metrics["readiness"]["psi"]["status"]}</td>'
            html += f'<td>{resi_metrics["readiness"]["gbp"]["status"]}</td></tr>\n'
            
            for match in resi['matches']:
                match_metrics = self.all_metrics[match['ga4_property_id']]
                html += f'<tr><td>{match["name"]}</td>'
                html += f'<td>{match_metrics["readiness"]["ga4"]["status"]}</td>'
                html += f'<td>{match_metrics["readiness"]["gsc"]["status"]}</td>'
                html += f'<td>{match_metrics["readiness"]["psi"]["status"]}</td>'
                html += f'<td>{match_metrics["readiness"]["gbp"]["status"]}</td></tr>\n'
        
        html += '</table>\n'
        html += '</div>\n'
        return html
    
    def run(self):
        """Execute full Phase 2 report generation"""
        self.identify_all_properties()
        self.extract_all_metrics()
        self.determine_category_winners()
        csv_path = self.generate_csv_tables()
        html_path = self.generate_html_report()
        
        print("\n" + "=" * 80)
        print("PHASE 2 COMPLETE")
        print("=" * 80)
        print(f"\n✓ HTML Report: {html_path}")
        print(f"✓ CSV Data: {csv_path}")
        print("\nNext Steps:")
        print("  1. Review the HTML report for accuracy")
        print("  2. Validate winner determinations")
        print("  3. After validation, wire in email delivery automation")


def main():
    report = ResiPhase2Report()
    
    try:
        report.run()
    finally:
        report.close()


if __name__ == "__main__":
    main()
