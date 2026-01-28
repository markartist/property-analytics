"""
Cross-Source Correlation Validator
===================================
Phase 3: Validates data integrity across multiple sources.

Detects impossible or highly improbable cross-source states without
conflating business behavior with data failure.
"""

import sqlite3
import json
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import Dict, List, Optional


class CorrelationValidator:
    """Validates cross-source data correlations."""
    
    def __init__(self, db_path: Path):
        """
        Initialize correlation validator.
        
        Args:
            db_path: Path to portfolio_analytics.db
        """
        self.db_path = db_path
        self.rules_cache = []
        self._load_rules()
        
        # Alert eligibility thresholds
        self.ALERT_GA4_QUALITY_MIN = 90
        self.ALERT_SOURCE_QUALITY_MIN = 90
    
    def _load_rules(self):
        """Load active correlation rules from database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT correlation_id, rule_name, rule_category, classification,
                   sources_involved, description, logic_expression,
                   requires_history, history_days, severity, score_impact, alert_eligible
            FROM correlation_rules
            WHERE active = 1
            ORDER BY classification DESC, rule_category
        """)
        
        for row in cursor.fetchall():
            (corr_id, name, category, classification, sources_json, desc, logic,
             requires_hist, hist_days, severity, score_impact, alert_eligible) = row
            
            self.rules_cache.append({
                'correlation_id': corr_id,
                'rule_name': name,
                'category': category,
                'classification': classification,
                'sources': json.loads(sources_json),
                'description': desc,
                'logic': logic,
                'requires_history': bool(requires_hist),
                'history_days': hist_days,
                'severity': severity,
                'score_impact': score_impact,
                'alert_eligible': bool(alert_eligible)
            })
        
        conn.close()
    
    def validate_property_correlations(self, property_id: str, metric_date: date) -> Dict:
        """
        Validate all correlations for a property on a specific date.
        
        Args:
            property_id: Property ID to validate
            metric_date: Date to validate
            
        Returns:
            Validation results dictionary
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Fetch source data for this property/date
        sources_data = self._fetch_source_data(cursor, property_id, metric_date)
        
        # Get source quality scores
        source_qualities = self._get_source_qualities(cursor, property_id, metric_date)
        
        results = {
            'property_id': property_id,
            'metric_date': metric_date,
            'checks': [],
            'passed': 0,
            'failed': 0,
            'hard_failures': 0,
            'soft_failures': 0,
            'alert_eligible_failures': 0
        }
        
        # Run each correlation rule
        for rule in self.rules_cache:
            # Check if we have required source data
            required_sources = rule['sources']
            if not all(s in sources_data for s in required_sources):
                continue  # Skip if missing required data
            
            # Fetch historical baseline if needed
            baseline = None
            if rule['requires_history']:
                baseline = self._get_historical_baseline(
                    cursor, property_id, metric_date, 
                    required_sources, rule['history_days']
                )
            
            # Run correlation check
            check_result = self._check_correlation(
                rule, sources_data, baseline, source_qualities
            )
            
            results['checks'].append(check_result)
            
            if check_result['passed']:
                results['passed'] += 1
            else:
                results['failed'] += 1
                if check_result['classification'] == 'HARD':
                    results['hard_failures'] += 1
                else:
                    results['soft_failures'] += 1
                
                if check_result['alert_eligible']:
                    results['alert_eligible_failures'] += 1
            
            # Log check to database
            self._log_correlation_check(cursor, check_result, property_id, metric_date)
        
        conn.commit()
        conn.close()
        
        return results
    
    def _fetch_source_data(self, cursor, property_id: str, metric_date: date) -> Dict:
        """Fetch all source data for a property/date."""
        data = {}
        
        # GA4 data
        cursor.execute("""
            SELECT sessions, engaged_sessions, total_users, pageviews
            FROM ga4_daily_metrics
            WHERE property_id = ? AND metric_date = ?
        """, (property_id, metric_date))
        row = cursor.fetchone()
        if row:
            data['ga4'] = {
                'sessions': row[0] or 0,
                'engaged_sessions': row[1] or 0,
                'total_users': row[2] or 0,
                'pageviews': row[3] or 0
            }
        
        # GSC data (aggregated)
        cursor.execute("""
            SELECT SUM(clicks), SUM(impressions), AVG(ctr)
            FROM gsc_daily_metrics
            WHERE property_id = ? AND metric_date = ?
        """, (property_id, metric_date))
        row = cursor.fetchone()
        if row and row[0] is not None:
            data['gsc'] = {
                'clicks': row[0] or 0,
                'impressions': row[1] or 0,
                'ctr': row[2] or 0
            }
        
        # Google Ads data (aggregated) - skip if table doesn't exist
        try:
            cursor.execute("""
                SELECT SUM(cost), SUM(clicks), SUM(impressions), SUM(conversions)
                FROM google_ads_campaigns
                WHERE property_id = ? AND metric_date = ?
            """, (property_id, metric_date))
            row = cursor.fetchone()
            if row and row[0] is not None:
                data['google_ads'] = {
                    'cost': row[0] or 0,
                    'clicks': row[1] or 0,
                    'impressions': row[2] or 0,
                    'conversions': row[3] or 0
                }
        except sqlite3.OperationalError:
            pass  # Table doesn't exist, skip
        
        # PSI data
        cursor.execute("""
            SELECT AVG(performance_score), COUNT(DISTINCT strategy)
            FROM pagespeed_metrics
            WHERE property_id = ? AND metric_date = ?
        """, (property_id, metric_date))
        row = cursor.fetchone()
        if row and row[0] is not None:
            data['psi'] = {
                'performance_score': row[0],
                'strategy_count': row[1]
            }
        
        return data
    
    def _get_source_qualities(self, cursor, property_id: str, metric_date: date) -> Dict:
        """Get quality scores for each source."""
        qualities = {}
        
        cursor.execute("""
            SELECT data_source, quality_score
            FROM data_quality_scores
            WHERE property_id = ? AND metric_date = ?
        """, (property_id, metric_date))
        
        for row in cursor.fetchall():
            qualities[row[0]] = row[1]
        
        return qualities
    
    def _get_historical_baseline(self, cursor, property_id: str, metric_date: date,
                                 sources: List[str], days: int) -> Dict:
        """Calculate historical baseline for sources."""
        start_date = metric_date - timedelta(days=days)
        baseline = {}
        
        for source in sources:
            if source == 'ga4':
                cursor.execute("""
                    SELECT AVG(sessions), AVG(pageviews)
                    FROM ga4_daily_metrics
                    WHERE property_id = ? AND metric_date BETWEEN ? AND ?
                """, (property_id, start_date, metric_date - timedelta(days=1)))
                row = cursor.fetchone()
                if row and row[0]:
                    baseline['ga4'] = {'sessions': row[0], 'pageviews': row[1]}
            
            elif source == 'gsc':
                cursor.execute("""
                    SELECT AVG(total_clicks), AVG(total_impressions)
                    FROM (
                        SELECT SUM(clicks) as total_clicks, SUM(impressions) as total_impressions
                        FROM gsc_daily_metrics
                        WHERE property_id = ? AND metric_date BETWEEN ? AND ?
                        GROUP BY metric_date
                    )
                """, (property_id, start_date, metric_date - timedelta(days=1)))
                row = cursor.fetchone()
                if row and row[0]:
                    baseline['gsc'] = {'clicks': row[0], 'impressions': row[1]}
        
        return baseline
    
    def _check_correlation(self, rule: Dict, sources_data: Dict, 
                          baseline: Optional[Dict], qualities: Dict) -> Dict:
        """Execute a single correlation check."""
        result = {
            'correlation_id': rule['correlation_id'],
            'rule_name': rule['rule_name'],
            'classification': rule['classification'],
            'passed': True,
            'severity': rule['severity'],
            'score_impact': rule['score_impact'],
            'alert_eligible': False,
            'source_a_name': None,
            'source_a_value': None,
            'source_b_name': None,
            'source_b_value': None,
            'expected_relationship': rule['description'],
            'failure_explanation': None
        }
        
        # Check specific correlation rules
        rule_name = rule['rule_name']
        
        if rule_name == 'corr_ga4_sessions_gsc_missing':
            ga4 = sources_data.get('ga4', {})
            gsc = sources_data.get('gsc')
            
            result['source_a_name'] = 'GA4 sessions'
            result['source_a_value'] = str(ga4.get('sessions', 0))
            result['source_b_name'] = 'GSC data'
            result['source_b_value'] = 'Present' if gsc else 'Missing'
            
            if ga4.get('sessions', 0) > 0 and not gsc:
                result['passed'] = False
                result['failure_explanation'] = f"GA4 has {ga4['sessions']} sessions but GSC data is completely missing"
        
        elif rule_name == 'corr_ads_spend_no_ga4':
            ads = sources_data.get('google_ads', {})
            ga4 = sources_data.get('ga4', {})
            
            result['source_a_name'] = 'Ads spend'
            result['source_a_value'] = f"${ads.get('cost', 0):.2f}"
            result['source_b_name'] = 'GA4 sessions'
            result['source_b_value'] = str(ga4.get('sessions', 0))
            
            if ads.get('cost', 0) > 0 and ga4.get('sessions', 0) == 0:
                result['passed'] = False
                result['failure_explanation'] = f"Ads spent ${ads['cost']:.2f} but GA4 shows 0 sessions"
        
        elif rule_name == 'corr_gsc_clicks_exceed_impressions':
            gsc = sources_data.get('gsc', {})
            
            result['source_a_name'] = 'GSC clicks'
            result['source_a_value'] = str(gsc.get('clicks', 0))
            result['source_b_name'] = 'GSC impressions'
            result['source_b_value'] = str(gsc.get('impressions', 0))
            
            if gsc.get('clicks', 0) > gsc.get('impressions', 0):
                result['passed'] = False
                result['failure_explanation'] = f"Clicks ({gsc['clicks']}) > impressions ({gsc['impressions']}) - impossible"
        
        elif rule_name == 'corr_ga4_gsc_severe_divergence':
            if not baseline:
                return result  # Skip if no baseline
            
            ga4 = sources_data.get('ga4', {})
            gsc = sources_data.get('gsc', {})
            ga4_base = baseline.get('ga4', {})
            gsc_base = baseline.get('gsc', {})
            
            if ga4_base and gsc_base:
                ga4_sessions = ga4.get('sessions', 0)
                gsc_clicks = gsc.get('clicks', 0)
                ga4_baseline = ga4_base.get('sessions', 1)
                gsc_baseline = gsc_base.get('clicks', 1)
                
                # Calculate percent changes
                ga4_change = (ga4_sessions - ga4_baseline) / max(ga4_baseline, 1)
                gsc_change = (gsc_clicks - gsc_baseline) / max(gsc_baseline, 1)
                divergence = abs(ga4_change - gsc_change)
                
                result['source_a_name'] = 'GA4 change'
                result['source_a_value'] = f"{ga4_change:+.1%}"
                result['source_b_name'] = 'GSC change'
                result['source_b_value'] = f"{gsc_change:+.1%}"
                
                if divergence > 0.5:  # 50% divergence threshold
                    result['passed'] = False
                    result['failure_explanation'] = f"GA4 changed {ga4_change:+.1%}, GSC changed {gsc_change:+.1%} (divergence: {divergence:.1%})"
        
        elif rule_name == 'corr_psi_present_ga4_missing':
            psi = sources_data.get('psi')
            ga4 = sources_data.get('ga4', {})
            
            result['source_a_name'] = 'PSI score'
            result['source_a_value'] = f"{psi.get('performance_score', 0):.0f}" if psi else 'Missing'
            result['source_b_name'] = 'GA4 pageviews'
            result['source_b_value'] = str(ga4.get('pageviews', 0))
            
            if psi and ga4.get('pageviews', 0) == 0:
                result['passed'] = False
                result['failure_explanation'] = f"PSI tested (score: {psi['performance_score']:.0f}) but GA4 shows 0 pageviews"
        
        # Determine alert eligibility
        if not result['passed'] and rule['alert_eligible']:
            # Check if source qualities meet alert threshold
            ga4_quality = qualities.get('ga4', 0)
            sources_healthy = all(qualities.get(s, 0) >= self.ALERT_SOURCE_QUALITY_MIN 
                                 for s in rule['sources'] if s in qualities)
            
            if ga4_quality >= self.ALERT_GA4_QUALITY_MIN and sources_healthy:
                result['alert_eligible'] = True
        
        return result
    
    def _log_correlation_check(self, cursor, check_result: Dict, 
                               property_id: str, metric_date: date):
        """Log correlation check result to database."""
        cursor.execute("""
            INSERT INTO correlation_checks (
                correlation_id, property_id, metric_date,
                passed, classification,
                source_a_name, source_a_value,
                source_b_name, source_b_value,
                expected_relationship, failure_explanation,
                severity, score_impact, alert_eligible
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            check_result['correlation_id'],
            property_id,
            metric_date,
            1 if check_result['passed'] else 0,
            check_result['classification'],
            check_result['source_a_name'],
            check_result['source_a_value'],
            check_result['source_b_name'],
            check_result['source_b_value'],
            check_result['expected_relationship'],
            check_result['failure_explanation'],
            check_result['severity'],
            check_result['score_impact'],
            1 if check_result['alert_eligible'] else 0
        ))
    
    def calculate_correlation_score(self, property_id: str, metric_date: date, 
                                    val_result: Dict) -> int:
        """
        Calculate correlation score with capping.
        
        Scoring:
        - Start at 100
        - HARD failure: -25 points each
        - SOFT failure: -5 points each
        - Max penalty: -30 points (capped)
        - Floor: 70 (correlation can't drop below 70)
        """
        score = 100
        
        # HARD failures: -25 each
        score -= val_result['hard_failures'] * 25
        
        # SOFT failures: -5 each
        score -= val_result['soft_failures'] * 5
        
        # Cap total penalty at -30
        penalty = 100 - score
        if penalty > 30:
            score = 70  # 100 - 30 = 70
        
        # Floor at 70
        score = max(score, 70)
        
        return score
    
    def validate_all_properties(self, metric_date: date) -> Dict:
        """
        Validate correlations for all properties on a date.
        
        Args:
            metric_date: Date to validate
            
        Returns:
            Summary results
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get all properties with GA4 data (primary source)
        cursor.execute("""
            SELECT DISTINCT property_id
            FROM ga4_daily_metrics
            WHERE metric_date = ?
        """, (metric_date,))
        
        properties = [row[0] for row in cursor.fetchall()]
        conn.close()
        
        results = {
            'date': metric_date,
            'properties_checked': 0,
            'total_checks': 0,
            'failed_checks': 0,
            'hard_failures': 0,
            'soft_failures': 0,
            'alert_eligible_failures': 0,
            'avg_correlation_score': 0
        }
        
        scores = []
        
        for prop_id in properties:
            val_result = self.validate_property_correlations(prop_id, metric_date)
            
            results['properties_checked'] += 1
            results['total_checks'] += val_result['passed'] + val_result['failed']
            results['failed_checks'] += val_result['failed']
            results['hard_failures'] += val_result['hard_failures']
            results['soft_failures'] += val_result['soft_failures']
            results['alert_eligible_failures'] += val_result['alert_eligible_failures']
            
            # Calculate and store correlation score
            score = self.calculate_correlation_score(prop_id, metric_date, val_result)
            scores.append(score)
            
            # Get GA4 quality and sources_healthy status
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT quality_score FROM data_quality_scores
                WHERE property_id = ? AND data_source = 'ga4' AND metric_date = ?
            """, (prop_id, metric_date))
            row = cursor.fetchone()
            ga4_quality = row[0] if row else None
            
            # Store correlation score
            cursor.execute("""
                INSERT OR REPLACE INTO correlation_scores (
                    property_id, metric_date, correlation_score,
                    hard_failures, soft_failures, total_checks,
                    alert_eligible_failures, ga4_quality
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                prop_id, metric_date, score,
                val_result['hard_failures'], val_result['soft_failures'],
                val_result['passed'] + val_result['failed'],
                val_result['alert_eligible_failures'], ga4_quality
            ))
            
            conn.commit()
            conn.close()
        
        if scores:
            results['avg_correlation_score'] = int(sum(scores) / len(scores))
        
        return results
