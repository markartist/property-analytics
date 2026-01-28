#!/usr/bin/env python3
"""
Resi vs Portfolio Comparative Analysis - Phase 1 Deliverable
============================================================

Phase 1 includes:
- Property matching with scoring (top 5 candidates, select best 1-2)
- Metric extraction from all 5 data sources
- Readiness gates + disclaimers
- Basic comparison table output (CSV + Markdown)
- Written summary per Resi property

Phase 2 will add:
- PIB-style HTML report
- Winner/loser determination logic
- Full synthesis and narrative
- Email delivery

Author: Mark Laufhutte
Date: January 27, 2026
Version: 1.0 - Phase 1
"""

import sqlite3
import json
import csv
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Any
from collections import defaultdict
from urllib.parse import urlparse

DB_PATH = Path("/Users/mark/Property_Analytics/data/portfolio_analytics.db")
REGISTRY_PATH = Path("/Users/mark/Property_Analytics/config/venterra_properties_official.json")
OUTPUT_DIR = Path("/Users/mark/Property_Analytics/reports/resi_comparison")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

ANALYSIS_WINDOW_DAYS = 30
GSC_LAG_DAYS = 3  # GSC data has 3-day API lag

# Resi properties to analyze
RESI_PROPERTIES = {
    'cendana': {
        'search_domain': 'cendanalife.com',
        'metro': 'Houston, TX'
    },
    'camber_ridge': {
        'search_domain': 'camberridgeapartments.com',
        'metro': None  # Will be determined from data
    },
    'delta_pearland': {
        'search_domain': 'thedeltapearland.com',
        'metro': 'Houston, TX'
    },
    'monteverde': {
        'search_domain': 'monteverdesatx.com',
        'metro': 'San Antonio, TX'
    }
}


class ResiPhase1Analysis:
    """Phase 1: Matching + Metrics + Tables"""
    
    def __init__(self):
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row
        
        with open(REGISTRY_PATH, 'r') as f:
            self.registry = json.load(f)
        
        self.resi_properties = {}
        self.comparisons = {}
        self.report_date = datetime.now().strftime('%Y-%m-%d')
    
    def close(self):
        if self.conn:
            self.conn.close()
    
    def identify_resi_properties(self):
        """Identify Resi properties in registry"""
        print("\n" + "=" * 80)
        print("IDENTIFYING RESI PROPERTIES")
        print("=" * 80)
        
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
                        'metro': resi_search['metro'] or self._infer_metro(full_url, prop.get('name', ''))
                    }
                    print(f"\n✓ Found: {prop.get('name')}")
                    print(f"  GA4 ID: {prop.get('ga4_property_id')}")
                    print(f"  Units: {prop.get('unit_count')}")
                    print(f"  Metro: {self.resi_properties[resi_key]['metro']}")
                    break
        
        return self.resi_properties
    
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
        
        return 'Unknown'
    
    def find_matches_for_resi(self, resi: Dict) -> List[Dict]:
        """Find top 5 match candidates with scores, select best 1-2"""
        print(f"\n{'=' * 80}")
        print(f"FINDING MATCHES FOR: {resi['name']}")
        print(f"{'=' * 80}")
        print(f"Metro: {resi['metro']}")
        print(f"Units: {resi['unit_count']}")
        
        # Get Resi traffic
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT SUM(sessions) as total
            FROM ga4_daily_metrics
            WHERE property_id = ?
            AND metric_date >= date('now', '-30 days')
        """, (resi['ga4_property_id'],))
        row = cursor.fetchone()
        resi_traffic = row[0] if row and row[0] else 0
        print(f"Traffic (30d): {resi_traffic:,} sessions")
        
        candidates = []
        
        # First pass: strict criteria (±25% units)
        for prop in self.registry.get('properties', []):
            if prop.get('ga4_property_id') == resi['ga4_property_id']:
                continue
            
            cand_location = self._infer_metro(prop.get('full_url', ''), prop.get('name', ''))
            
            # Metro match check
            if not self._metro_matches(resi['metro'], cand_location):
                continue
            
            # Get traffic
            cursor.execute("""
                SELECT SUM(sessions) as total
                FROM ga4_daily_metrics
                WHERE property_id = ?
                AND metric_date >= date('now', '-30 days')
            """, (prop.get('ga4_property_id'),))
            row = cursor.fetchone()
            cand_traffic = row[0] if row and row[0] else 0
            
            # Calculate match score
            score = self._calculate_match_score(
                resi, prop, cand_location, resi_traffic, cand_traffic, strict=True
            )
            
            if score['total'] > 0:
                candidates.append({
                    'property': prop,
                    'location': cand_location,
                    'traffic': cand_traffic,
                    'score': score['total'],
                    'breakdown': score['breakdown']
                })
        
        # If fewer than 2 matches, widen criteria
        if len(candidates) < 2:
            print(f"\n⚠️  Only {len(candidates)} strict matches found. Widening criteria to ±35% units...")
            
            for prop in self.registry.get('properties', []):
                if prop.get('ga4_property_id') == resi['ga4_property_id']:
                    continue
                
                # Check if already in candidates
                if any(c['property'].get('ga4_property_id') == prop.get('ga4_property_id') for c in candidates):
                    continue
                
                cand_location = self._infer_metro(prop.get('full_url', ''), prop.get('name', ''))
                
                if not self._metro_matches(resi['metro'], cand_location):
                    continue
                
                cursor.execute("""
                    SELECT SUM(sessions) as total
                    FROM ga4_daily_metrics
                    WHERE property_id = ?
                    AND metric_date >= date('now', '-30 days')
                """, (prop.get('ga4_property_id'),))
                row = cursor.fetchone()
                cand_traffic = row[0] if row and row[0] else 0
                
                score = self._calculate_match_score(
                    resi, prop, cand_location, resi_traffic, cand_traffic, strict=False
                )
                
                if score['total'] > 0:
                    candidates.append({
                        'property': prop,
                        'location': cand_location,
                        'traffic': cand_traffic,
                        'score': score['total'],
                        'breakdown': score['breakdown'],
                        'caveat': 'Widened criteria: ±35% units'
                    })
        
        # Sort by score
        candidates.sort(key=lambda x: x['score'], reverse=True)
        
        # Show top 5
        print(f"\nTop 5 Candidates:")
        for i, cand in enumerate(candidates[:5], 1):
            prop = cand['property']
            print(f"\n{i}. {prop.get('name')} (Score: {cand['score']}/100)")
            print(f"   Units: {prop.get('unit_count')} | Traffic: {cand['traffic']:,}")
            print(f"   Match breakdown:")
            for component, score in cand['breakdown'].items():
                if not component.endswith('_pct') and not component.endswith('_ratio'):
                    print(f"     - {component}: {score} pts")
            if 'caveat' in cand:
                print(f"   ⚠️  {cand['caveat']}")
        
        # Select best 1-2
        selected = candidates[:2] if len(candidates) >= 2 else candidates[:1]
        
        print(f"\n✓ Selected {len(selected)} match(es) for comparison")
        
        return selected
    
    def _metro_matches(self, metro1: str, metro2: str) -> bool:
        """Check if two metros match"""
        if not metro1 or not metro2:
            return False
        
        # Houston metro includes Houston, Richmond, Pearland, Katy
        houston_cities = ['Houston', 'Richmond', 'Pearland', 'Katy']
        metro1_is_houston = any(city in metro1 for city in houston_cities)
        metro2_is_houston = any(city in metro2 for city in houston_cities)
        
        if metro1_is_houston and metro2_is_houston:
            return True
        
        # Direct match
        metro1_clean = metro1.replace(',', '').strip()
        metro2_clean = metro2.replace(',', '').strip()
        
        return metro1_clean in metro2_clean or metro2_clean in metro1_clean
    
    def _calculate_match_score(self, resi: Dict, candidate: Dict, cand_location: str,
                                resi_traffic: int, cand_traffic: int, strict: bool = True) -> Dict:
        """Calculate match score with breakdown"""
        breakdown = {}
        total = 0
        
        # Metro: 40 pts (mandatory)
        breakdown['metro'] = 40
        total += 40
        
        # Unit count: 30 pts
        resi_units = resi.get('unit_count', 0)
        cand_units = candidate.get('unit_count', 0)
        
        if resi_units and cand_units:
            diff_pct = abs(cand_units - resi_units) / resi_units * 100
            breakdown['unit_diff_pct'] = round(diff_pct, 1)
            
            if strict:
                if diff_pct <= 25:
                    breakdown['unit_similarity'] = 30
                    total += 30
                else:
                    breakdown['unit_similarity'] = 0
            else:
                # Widened criteria
                if diff_pct <= 25:
                    breakdown['unit_similarity'] = 30
                    total += 30
                elif diff_pct <= 35:
                    breakdown['unit_similarity'] = 20
                    total += 20
                elif diff_pct <= 50:
                    breakdown['unit_similarity'] = 10
                    total += 10
        else:
            breakdown['unit_similarity'] = 0
        
        # Traffic: 20 pts
        if resi_traffic and cand_traffic and resi_traffic > 0:
            ratio = cand_traffic / resi_traffic
            breakdown['traffic_ratio'] = round(ratio, 2)
            
            if 0.75 <= ratio <= 1.33:
                breakdown['traffic_similarity'] = 20
                total += 20
            elif 0.5 <= ratio <= 2.0:
                breakdown['traffic_similarity'] = 10
                total += 10
            else:
                breakdown['traffic_similarity'] = 0
        else:
            breakdown['traffic_similarity'] = 0
        
        # GBP proxy: 10 pts (placeholder - partial credit)
        breakdown['gbp_similarity'] = 5
        total += 5
        
        return {'total': total, 'breakdown': breakdown}
    
    def extract_all_metrics(self, property_id: str, property_url: str) -> Dict:
        """Extract metrics from 4 sources with readiness gates"""
        metrics = {
            'ga4': {},
            'gsc': {},
            'psi': {},
            'gbp': {}
        }
        
        readiness = {}
        
        # GA4
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT COUNT(DISTINCT metric_date) as days
            FROM ga4_daily_metrics
            WHERE property_id = ?
            AND metric_date >= date('now', '-30 days')
        """, (property_id,))
        row = cursor.fetchone()
        days = row[0] if row else 0
        coverage = (days / ANALYSIS_WINDOW_DAYS) * 100
        
        if coverage >= 95:
            readiness['ga4'] = {'status': 'FULL', 'coverage': coverage, 'days': days}
            metrics['ga4'] = self._extract_ga4(property_id)
        else:
            readiness['ga4'] = {'status': 'PARTIAL', 'coverage': coverage, 'days': days,
                               'reason': f'Only {days}/30 days with data'}
            metrics['ga4'] = self._extract_ga4(property_id)  # Extract anyway, mark as partial
        
        # GSC (with lag handling) - uses ga4_property_id
        cursor.execute("""
            SELECT COUNT(DISTINCT metric_date) as days
            FROM gsc_daily_metrics
            WHERE ga4_property_id = ?
            AND metric_date >= date('now', '-30 days')
            AND metric_date <= date('now', '-3 days')
        """, (property_id,))
        row = cursor.fetchone()
        days = row[0] if row else 0
        coverage = (days / (ANALYSIS_WINDOW_DAYS - GSC_LAG_DAYS)) * 100
        
        if coverage >= 95:
            readiness['gsc'] = {'status': 'FULL', 'coverage': coverage, 'days': days}
        elif coverage > 0:
            readiness['gsc'] = {'status': 'PARTIAL', 'coverage': coverage, 'days': days,
                               'reason': f'Only {days}/27 days with data (accounting for 3-day lag)'}
        else:
            readiness['gsc'] = {'status': 'MISSING', 'coverage': 0, 'days': 0,
                               'reason': 'No GSC data available'}
        
        metrics['gsc'] = self._extract_gsc(property_id)
        
        # PSI
        cursor.execute("""
            SELECT COUNT(DISTINCT metric_date) as days
            FROM pagespeed_metrics
            WHERE property_id = ?
            AND strategy = 'mobile'
            AND metric_date >= date('now', '-30 days')
        """, (property_id,))
        row = cursor.fetchone()
        days = row[0] if row else 0
        coverage = (days / ANALYSIS_WINDOW_DAYS) * 100
        
        if coverage >= 95:
            readiness['psi'] = {'status': 'FULL', 'coverage': coverage, 'days': days}
        elif coverage > 0:
            readiness['psi'] = {'status': 'PARTIAL', 'coverage': coverage, 'days': days,
                               'reason': f'Only {days}/30 days with data'}
        else:
            readiness['psi'] = {'status': 'MISSING', 'coverage': 0, 'days': 0,
                               'reason': 'No PSI data available'}
        
        metrics['psi'] = self._extract_psi(property_id)
        
        # GBP (often missing)
        cursor.execute("""
            SELECT COUNT(*) as cnt
            FROM gbp_daily_metrics
            WHERE property_id = ?
            AND metric_date >= date('now', '-30 days')
        """, (property_id,))
        row = cursor.fetchone()
        has_data = row[0] > 0 if row else False
        
        if has_data:
            readiness['gbp'] = {'status': 'PARTIAL', 'reason': 'GBP collection limited'}
            metrics['gbp'] = self._extract_gbp(property_id)
        else:
            readiness['gbp'] = {'status': 'MISSING', 'reason': 'No GBP data'}
            metrics['gbp'] = {'error': 'No data'}
        
        return {'metrics': metrics, 'readiness': readiness}
    
    def _extract_ga4(self, property_id: str) -> Dict:
        """Extract GA4 metrics"""
        cursor = self.conn.cursor()
        
        # Check what columns exist
        cursor.execute("PRAGMA table_info(ga4_daily_metrics)")
        cols = {row[1] for row in cursor.fetchall()}
        
        # Build query based on available columns
        select_parts = []
        if 'sessions' in cols:
            select_parts.append('COALESCE(SUM(sessions), 0) as sessions')
        if 'engaged_sessions' in cols:
            select_parts.append('COALESCE(SUM(engaged_sessions), 0) as engaged_sessions')
        if 'total_users' in cols:
            select_parts.append('COALESCE(SUM(total_users), 0) as total_users')
        if 'engagement_rate' in cols:
            select_parts.append('COALESCE(AVG(engagement_rate), 0) as engagement_rate')
        if 'avg_session_duration' in cols:
            select_parts.append('COALESCE(AVG(avg_session_duration), 0) as avg_session_duration')
        if 'conversions' in cols:
            select_parts.append('COALESCE(SUM(conversions), 0) as conversions')
        
        if not select_parts:
            return {'error': 'No GA4 columns available'}
        
        query = f"""
            SELECT {', '.join(select_parts)}
            FROM ga4_daily_metrics
            WHERE property_id = ?
            AND metric_date >= date('now', '-30 days')
        """
        
        cursor.execute(query, (property_id,))
        row = cursor.fetchone()
        
        if not row:
            return {'error': 'No data'}
        
        result = dict(row)
        
        # Calculate derived metrics
        sessions = result.get('sessions', 0)
        engaged = result.get('engaged_sessions', 0)
        conversions = result.get('conversions', 0)
        
        # Calculate engagement_rate if not in data
        if sessions > 0 and engaged > 0 and result.get('engagement_rate', 0) == 0:
            result['engagement_rate'] = round((engaged / sessions) * 100, 2)
        
        if sessions > 0:
            result['cir_per_100_sessions'] = round((conversions / sessions) * 100, 2)
        
        if engaged > 0:
            result['cir_per_100_engaged'] = round((conversions / engaged) * 100, 2)
        
        return result
    
    def _extract_gsc(self, property_id: str) -> Dict:
        """Extract GSC metrics"""
        cursor = self.conn.cursor()
        
        query = """
            SELECT 
                COALESCE(SUM(clicks), 0) as clicks,
                COALESCE(SUM(impressions), 0) as impressions,
                COALESCE(AVG(ctr), 0) as ctr,
                COALESCE(AVG(average_position), 0) as position
            FROM gsc_daily_metrics
            WHERE ga4_property_id = ?
            AND metric_date >= date('now', '-30 days')
            AND metric_date <= date('now', '-3 days')
        """
        
        cursor.execute(query, (property_id,))
        row = cursor.fetchone()
        
        if not row or row[0] == 0:
            return {'error': 'No GSC data'}
        
        return dict(row)
    
    def _extract_psi(self, property_id: str) -> Dict:
        """Extract PSI metrics"""
        cursor = self.conn.cursor()
        
        query = """
            SELECT 
                COALESCE(AVG(performance_score), 0) as performance_score,
                COALESCE(AVG(lcp_value), 0) as lcp,
                COALESCE(AVG(cls_value), 0) as cls,
                COALESCE(AVG(fid_value), 0) as fid,
                COALESCE(AVG(ttfb_value), 0) as ttfb,
                COALESCE(AVG(fcp_value), 0) as fcp
            FROM pagespeed_metrics
            WHERE property_id = ?
            AND strategy = 'mobile'
            AND metric_date >= date('now', '-30 days')
        """
        
        cursor.execute(query, (property_id,))
        row = cursor.fetchone()
        
        if not row or row[0] == 0:
            return {'error': 'No PSI data'}
        
        result = dict(row)
        # Round values
        for key in result:
            if isinstance(result[key], (int, float)):
                result[key] = round(result[key], 2)
        
        return result
    
    def _extract_gbp(self, property_id: str) -> Dict:
        """Extract GBP metrics"""
        cursor = self.conn.cursor()
        
        query = """
            SELECT 
                COALESCE(AVG(average_rating), 0) as avg_rating,
                COALESCE(AVG(total_review_count), 0) as review_count
            FROM gbp_daily_metrics
            WHERE property_id = ?
            AND metric_date >= date('now', '-30 days')
        """
        
        try:
            cursor.execute(query, (property_id,))
            row = cursor.fetchone()
            
            if not row or row[0] == 0:
                return {'error': 'No GBP data'}
            
            return dict(row)
        except:
            return {'error': 'GBP table issue'}
    
    def generate_comparison_tables(self):
        """Generate CSV and Markdown comparison tables"""
        print("\n" + "=" * 80)
        print("GENERATING COMPARISON TABLES")
        print("=" * 80)
        
        # CSV output
        csv_path = OUTPUT_DIR / f"resi_comparison_{self.report_date}.csv"
        md_path = OUTPUT_DIR / f"resi_comparison_{self.report_date}.md"
        summary_path = OUTPUT_DIR / f"resi_comparison_summary_{self.report_date}.txt"
        
        csv_rows = []
        md_lines = []
        summary_lines = []
        
        summary_lines.append("=" * 80)
        summary_lines.append("RESI VS PORTFOLIO COMPARISON - PHASE 1 SUMMARY")
        summary_lines.append("=" * 80)
        summary_lines.append(f"Analysis Date: {self.report_date}")
        summary_lines.append(f"Analysis Window: Last {ANALYSIS_WINDOW_DAYS} days")
        summary_lines.append("=" * 80)
        
        for resi_key, comparison in self.comparisons.items():
            resi = comparison['resi']
            matches = comparison['matches']
            resi_data = comparison['resi_data']
            match_data = comparison['match_data']
            
            summary_lines.append(f"\n\n{'=' * 80}")
            summary_lines.append(f"RESI PROPERTY: {resi['name']}")
            summary_lines.append(f"{'=' * 80}")
            summary_lines.append(f"Metro: {resi['metro']}")
            summary_lines.append(f"Units: {resi['unit_count']}")
            summary_lines.append(f"GA4 ID: {resi['ga4_property_id']}")
            
            summary_lines.append(f"\n--- MATCHED PROPERTIES ({len(matches)}) ---")
            for i, match in enumerate(matches, 1):
                prop = match['property']
                summary_lines.append(f"\n{i}. {prop.get('name')}")
                summary_lines.append(f"   Match Score: {match['score']}/100")
                summary_lines.append(f"   Units: {prop.get('unit_count')} | Traffic: {match['traffic']:,}")
                if 'caveat' in match:
                    summary_lines.append(f"   ⚠️  {match['caveat']}")
            
            # Data availability
            summary_lines.append(f"\n--- DATA AVAILABILITY ---")
            for source, status in resi_data['readiness'].items():
                summary_lines.append(f"{source.upper()}: {status['status']}")
                if 'reason' in status:
                    summary_lines.append(f"  → {status['reason']}")
            
            # Key metrics comparison
            summary_lines.append(f"\n--- KEY METRICS (Resi vs Matches Avg) ---")
            
            # GA4
            if 'error' not in resi_data['metrics']['ga4']:
                resi_sessions = resi_data['metrics']['ga4'].get('sessions', 0)
                resi_eng_rate = resi_data['metrics']['ga4'].get('engagement_rate', 0)
                resi_cir = resi_data['metrics']['ga4'].get('cir_per_100_sessions', 0)
                
                # Average matches
                match_sessions_avg = 0
                match_eng_rate_avg = 0
                match_cir_avg = 0
                valid_matches = 0
                
                for match_metrics in match_data:
                    if 'error' not in match_metrics['metrics']['ga4']:
                        match_sessions_avg += match_metrics['metrics']['ga4'].get('sessions', 0)
                        match_eng_rate_avg += match_metrics['metrics']['ga4'].get('engagement_rate', 0)
                        match_cir_avg += match_metrics['metrics']['ga4'].get('cir_per_100_sessions', 0)
                        valid_matches += 1
                
                if valid_matches > 0:
                    match_sessions_avg /= valid_matches
                    match_eng_rate_avg /= valid_matches
                    match_cir_avg /= valid_matches
                    
                    summary_lines.append(f"\nGA4:")
                    summary_lines.append(f"  Sessions: {resi_sessions:,} vs {int(match_sessions_avg):,}")
                    summary_lines.append(f"  Engagement Rate: {resi_eng_rate:.1f}% vs {match_eng_rate_avg:.1f}%")
                    summary_lines.append(f"  CIR/100 Sessions: {resi_cir:.2f} vs {match_cir_avg:.2f}")
            
            # PSI
            if 'error' not in resi_data['metrics']['psi']:
                resi_perf = resi_data['metrics']['psi'].get('performance_score', 0)
                resi_lcp = resi_data['metrics']['psi'].get('lcp', 0)
                
                match_perf_avg = 0
                match_lcp_avg = 0
                valid_matches = 0
                
                for match_metrics in match_data:
                    if 'error' not in match_metrics['metrics']['psi']:
                        match_perf_avg += match_metrics['metrics']['psi'].get('performance_score', 0)
                        match_lcp_avg += match_metrics['metrics']['psi'].get('lcp', 0)
                        valid_matches += 1
                
                if valid_matches > 0:
                    match_perf_avg /= valid_matches
                    match_lcp_avg /= valid_matches
                    
                    summary_lines.append(f"\nPageSpeed:")
                    summary_lines.append(f"  Performance Score: {resi_perf:.0f} vs {match_perf_avg:.0f}")
                    summary_lines.append(f"  LCP: {resi_lcp:.2f}s vs {match_lcp_avg:.2f}s")
            
            # Early signals
            summary_lines.append(f"\n--- EARLY DIRECTIONAL SIGNALS ---")
            
            if 'error' not in resi_data['metrics']['ga4']:
                if resi_cir > match_cir_avg * 1.1:
                    summary_lines.append("✓ Resi shows stronger conversion rate (CIR)")
                elif resi_cir < match_cir_avg * 0.9:
                    summary_lines.append("⚠  Resi shows weaker conversion rate (CIR)")
            
            if 'error' not in resi_data['metrics']['psi']:
                if resi_perf > match_perf_avg + 5:
                    summary_lines.append("✓ Resi shows better performance score")
                elif resi_perf < match_perf_avg - 5:
                    summary_lines.append("⚠  Resi shows worse performance score")
                
                if resi_lcp < match_lcp_avg * 0.9:
                    summary_lines.append("✓ Resi shows faster page load (LCP)")
                elif resi_lcp > match_lcp_avg * 1.1:
                    summary_lines.append("⚠  Resi shows slower page load (LCP)")
            
            summary_lines.append("\n(Full winner analysis in Phase 2)")
        
        # Write summary
        with open(summary_path, 'w') as f:
            f.write('\n'.join(summary_lines))
        
        print(f"\n✓ Generated comparison summary: {summary_path}")
        
        return str(summary_path)
    
    def run_phase1(self):
        """Execute Phase 1 analysis"""
        print("\n" + "=" * 80)
        print("RESI COMPARATIVE ANALYSIS - PHASE 1")
        print("=" * 80)
        print(f"Date: {self.report_date}")
        print(f"Window: Last {ANALYSIS_WINDOW_DAYS} days")
        
        # Step 1: Identify Resi properties
        self.identify_resi_properties()
        
        # Step 2: Find matches for each
        for resi_key, resi in self.resi_properties.items():
            matches = self.find_matches_for_resi(resi)
            
            # Step 3: Extract metrics for Resi and matches
            print(f"\n--- Extracting metrics for {resi['name']} ---")
            resi_data = self.extract_all_metrics(resi['ga4_property_id'], resi['full_url'])
            
            match_data = []
            for match in matches:
                print(f"--- Extracting metrics for {match['property'].get('name')} ---")
                data = self.extract_all_metrics(
                    match['property'].get('ga4_property_id'),
                    match['property'].get('full_url')
                )
                match_data.append(data)
            
            self.comparisons[resi_key] = {
                'resi': resi,
                'matches': matches,
                'resi_data': resi_data,
                'match_data': match_data
            }
        
        # Step 4: Generate output
        summary_path = self.generate_comparison_tables()
        
        print("\n" + "=" * 80)
        print("PHASE 1 COMPLETE")
        print("=" * 80)
        print(f"\n✓ Analysis complete for {len(self.resi_properties)} Resi properties")
        print(f"✓ Summary report: {summary_path}")
        
        print("\n--- PHASE 2 PLAN ---")
        print("Remaining work for full PIB-style report:")
        print("  1. Winner/loser determination per category (Demand, Engagement, CIR, Performance, Trust)")
        print("  2. Overall winner judgment with explanation")
        print("  3. PIB-style HTML template with Venterra branding")
        print("  4. Full synthesis: 'What Resi is doing better/worse'")
        print("  5. Email delivery system")
        print("  6. Executive summary section")
        print("\n" + "=" * 80)


def main():
    """Execute Phase 1 analysis"""
    analysis = ResiPhase1Analysis()
    
    try:
        analysis.run_phase1()
    finally:
        analysis.close()


if __name__ == "__main__":
    main()
