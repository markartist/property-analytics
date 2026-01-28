#!/usr/bin/env python3
"""
Phase 5: Alert Aggregation & Selective Automation
Aggregates high-confidence failures, prevents alert fatigue, enables safe automation.
"""

import sqlite3
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional
from pathlib import Path


class AlertAggregator:
    """Aggregates failures from Phases 2-4 into actionable, non-noisy alerts."""
    
    # Alert thresholds
    MIN_QUALITY_THRESHOLD = 90  # Quality score required for alert eligibility
    PERSISTENCE_REQUIRED = 2    # Failures must persist across N runs
    SUPPRESSION_WINDOW_HOURS = 24  # Prevent re-alerting within N hours
    
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.alert_rules = self._load_alert_rules()
    
    def _load_alert_rules(self) -> Dict:
        """Load alert-eligible rules from database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT alert_rule_id, rule_name, failure_source, failure_rule_id,
                   min_quality_threshold, persistence_required_runs, 
                   suppression_window_hours, severity, auto_remediation_eligible
            FROM alert_rules
            WHERE alert_eligible = 1
        """)
        
        rules = {}
        for row in cursor.fetchall():
            rules[row[3]] = {  # Key by failure_rule_id
                'alert_rule_id': row[0],
                'rule_name': row[1],
                'failure_source': row[2],
                'failure_rule_id': row[3],
                'min_quality_threshold': row[4],
                'persistence_required': row[5],
                'suppression_window_hours': row[6],
                'severity': row[7],
                'auto_remediation_eligible': row[8]
            }
        
        conn.close()
        return rules
    
    def evaluate_alert_eligibility(self, metric_date: date) -> List[Dict]:
        """
        Evaluate all failures for alert eligibility.
        
        Returns:
            List of alert-eligible failures with full context
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        eligible_alerts = []
        
        # Check Phase 3 HARD correlation failures
        eligible_alerts.extend(
            self._check_correlation_failures(cursor, metric_date)
        )
        
        # Check collection failures (from Phase 1)
        eligible_alerts.extend(
            self._check_collection_failures(cursor, metric_date)
        )
        
        conn.close()
        
        # Apply deduplication and suppression
        eligible_alerts = self._deduplicate_alerts(eligible_alerts)
        eligible_alerts = self._apply_suppression(eligible_alerts)
        
        return eligible_alerts
    
    def _check_correlation_failures(self, cursor, metric_date: date) -> List[Dict]:
        """Check Phase 3 correlation failures for alert eligibility."""
        eligible = []
        
        # Get HARD correlation failures
        cursor.execute("""
            SELECT cc.property_id, cc.correlation_id, cc.source_a_name, cc.source_a_value,
                   cc.source_b_name, cc.source_b_value, cc.failure_explanation,
                   cc.classification, cc.alert_eligible
            FROM correlation_checks cc
            WHERE cc.metric_date = ?
              AND cc.passed = 0
              AND cc.classification = 'HARD'
              AND cc.alert_eligible = 1
        """, (metric_date,))
        
        for row in cursor.fetchall():
            property_id, corr_id, src_a, val_a, src_b, val_b, explanation, classification, alert_elig = row
            
            # Check if rule is alert-eligible
            if corr_id not in self.alert_rules:
                continue
            
            rule = self.alert_rules[corr_id]
            
            # Check quality thresholds for involved sources
            quality_check = self._check_source_quality(
                cursor, property_id, metric_date, [src_a.split()[0].lower(), src_b.split()[0].lower()],
                rule['min_quality_threshold']
            )
            
            if not quality_check['passed']:
                continue
            
            # Check persistence (has this failed before?)
            persistence_check = self._check_persistence(
                cursor, property_id, corr_id, metric_date, rule['persistence_required']
            )
            
            if not persistence_check['persistent']:
                continue
            
            # Build alert payload
            eligible.append({
                'property_id': property_id,
                'alert_rule_id': rule['alert_rule_id'],
                'failure_source': 'correlation',
                'failure_rule_id': corr_id,
                'failure_classification': classification,
                'severity': rule['severity'],
                'current_value': f"{src_a}: {val_a}, {src_b}: {val_b}",
                'expected_value': 'Data should be present and consistent across sources',
                'confidence_score': 95,  # HARD failures + quality checks = high confidence
                'confidence_explanation': f"HARD correlation failure detected. {quality_check['explanation']} Failure persisted across {persistence_check['occurrence_count']} runs.",
                'recommended_action': self._get_recommended_action(corr_id, property_id),
                'auto_remediation_eligible': rule['auto_remediation_eligible']
            })
        
        return eligible
    
    def _check_collection_failures(self, cursor, metric_date: date) -> List[Dict]:
        """Check Phase 1 collection failures for alert eligibility."""
        eligible = []
        
        # Get collection failures from collection_errors table
        cursor.execute("""
            SELECT ce.property_id, ce.data_source, ce.error_type, ce.error_message,
                   COUNT(*) as error_count
            FROM collection_errors ce
            JOIN data_collections dc ON ce.collection_id = dc.collection_id
            WHERE DATE(dc.completed_at) = ?
            GROUP BY ce.property_id, ce.data_source, ce.error_type
            HAVING error_count >= 1
        """, (metric_date,))
        
        for row in cursor.fetchall():
            property_id, data_source, error_type, error_message, error_count = row
            
            # Map to alert rule
            rule_id = f"alert_collection_{data_source}_failed"
            if rule_id.split('_')[2] + '_collection' not in [r['failure_rule_id'] for r in self.alert_rules.values()]:
                continue
            
            # Find matching rule
            rule = None
            for r in self.alert_rules.values():
                if data_source in r['failure_rule_id']:
                    rule = r
                    break
            
            if not rule:
                continue
            
            # Check persistence
            persistence_check = self._check_collection_persistence(
                cursor, property_id, data_source, metric_date, rule['persistence_required']
            )
            
            if not persistence_check['persistent']:
                continue
            
            eligible.append({
                'property_id': property_id,
                'alert_rule_id': rule['alert_rule_id'],
                'failure_source': 'collection',
                'failure_rule_id': rule['failure_rule_id'],
                'failure_classification': 'HARD',
                'severity': rule['severity'],
                'current_value': f"{error_type}: {error_message}",
                'expected_value': 'Successful data collection',
                'confidence_score': 90,
                'confidence_explanation': f"{data_source.upper()} collection failed {error_count} times on {metric_date}. Failure persisted across {persistence_check['occurrence_count']} collection runs.",
                'recommended_action': f"Retry {data_source.upper()} collection. Check API credentials and quotas.",
                'auto_remediation_eligible': rule['auto_remediation_eligible']
            })
        
        return eligible
    
    def _check_source_quality(self, cursor, property_id: str, metric_date: date,
                             sources: List[str], threshold: int) -> Dict:
        """Check if involved sources meet quality threshold."""
        cursor.execute("""
            SELECT data_source, quality_score
            FROM data_quality_scores
            WHERE property_id = ? AND metric_date = ? AND data_source IN ({})
        """.format(','.join('?' * len(sources))), (property_id, metric_date, *sources))
        
        quality_scores = {row[0]: row[1] for row in cursor.fetchall()}
        
        # Check if all sources meet threshold
        failing_sources = [src for src in sources if quality_scores.get(src, 0) < threshold]
        
        if failing_sources:
            return {
                'passed': False,
                'explanation': f"Sources {failing_sources} below quality threshold ({threshold}%)"
            }
        
        return {
            'passed': True,
            'explanation': f"All involved sources ≥{threshold}% quality"
        }
    
    def _check_persistence(self, cursor, property_id: str, failure_rule_id: str,
                          metric_date: date, required_runs: int) -> Dict:
        """Check if failure has persisted across multiple runs."""
        lookback_start = metric_date - timedelta(days=required_runs)
        
        cursor.execute("""
            SELECT COUNT(DISTINCT metric_date) as occurrence_count
            FROM correlation_checks
            WHERE property_id = ? 
              AND correlation_id = ?
              AND metric_date BETWEEN ? AND ?
              AND passed = 0
        """, (property_id, failure_rule_id, lookback_start, metric_date))
        
        result = cursor.fetchone()
        occurrence_count = result[0] if result else 0
        
        return {
            'persistent': occurrence_count >= required_runs,
            'occurrence_count': occurrence_count
        }
    
    def _check_collection_persistence(self, cursor, property_id: str, data_source: str,
                                     metric_date: date, required_runs: int) -> Dict:
        """Check if collection failure has persisted."""
        lookback_start = metric_date - timedelta(days=required_runs)
        
        cursor.execute("""
            SELECT COUNT(DISTINCT DATE(dc.completed_at)) as occurrence_count
            FROM collection_errors ce
            JOIN data_collections dc ON ce.collection_id = dc.collection_id
            WHERE ce.property_id = ?
              AND ce.data_source = ?
              AND DATE(dc.completed_at) BETWEEN ? AND ?
        """, (property_id, data_source, lookback_start, metric_date))
        
        result = cursor.fetchone()
        occurrence_count = result[0] if result else 0
        
        return {
            'persistent': occurrence_count >= required_runs,
            'occurrence_count': occurrence_count
        }
    
    def _get_recommended_action(self, failure_rule_id: str, property_id: str) -> str:
        """Get recommended human action for failure type."""
        actions = {
            'corr_ga4_sessions_gsc_missing': f"Verify GSC property configuration for {property_id}. Check if site is indexed in Search Console.",
            'corr_ads_spend_no_ga4': f"Verify GA4 tracking code on landing pages. Check if campaign traffic is being filtered.",
            'corr_gsc_clicks_exceed_impressions': f"Investigate data quality issue. This is mathematically impossible and indicates corrupted GSC data."
        }
        return actions.get(failure_rule_id, "Manual investigation required.")
    
    def _deduplicate_alerts(self, alerts: List[Dict]) -> List[Dict]:
        """Remove duplicate alerts for same property+rule."""
        seen = set()
        deduped = []
        
        for alert in alerts:
            key = (alert['property_id'], alert['alert_rule_id'])
            if key not in seen:
                seen.add(key)
                deduped.append(alert)
        
        return deduped
    
    def _apply_suppression(self, alerts: List[Dict]) -> List[Dict]:
        """Apply suppression windows to prevent alert flapping."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        non_suppressed = []
        
        for alert in alerts:
            # Check if alert is currently suppressed
            cursor.execute("""
                SELECT suppression_id, suppressed_until, occurrence_count
                FROM alert_suppressions
                WHERE property_id = ?
                  AND alert_rule_id = ?
                  AND suppressed_until > CURRENT_TIMESTAMP
                ORDER BY created_at DESC
                LIMIT 1
            """, (alert['property_id'], alert['alert_rule_id']))
            
            result = cursor.fetchone()
            
            if result:
                # Alert is suppressed, update occurrence count
                supp_id, suppressed_until, occ_count = result
                cursor.execute("""
                    UPDATE alert_suppressions
                    SET last_seen_at = CURRENT_TIMESTAMP,
                        occurrence_count = ?
                    WHERE suppression_id = ?
                """, (occ_count + 1, supp_id))
                conn.commit()
                continue
            
            # Not suppressed, add to output and create suppression record
            non_suppressed.append(alert)
            
            # Create suppression record
            rule = self.alert_rules.get(alert['failure_rule_id'])
            if rule:
                suppression_hours = rule['suppression_window_hours']
                cursor.execute("""
                    INSERT INTO alert_suppressions 
                    (property_id, alert_rule_id, first_seen_at, last_seen_at,
                     suppressed_until, reason)
                    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
                            datetime('now', '+{} hours'), 'Automatic suppression after alert')
                """.format(suppression_hours), (alert['property_id'], alert['alert_rule_id']))
                conn.commit()
        
        conn.close()
        return non_suppressed
    
    def log_alert(self, alert: Dict) -> int:
        """Log alert to alert_history table. Returns alert_id."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO alert_history (
                alert_rule_id, property_id, metric_date, failure_source,
                failure_rule_id, failure_classification, severity,
                current_value, expected_value, confidence_score,
                confidence_explanation, recommended_action, alert_sent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        """, (
            alert['alert_rule_id'], alert['property_id'], date.today(),
            alert['failure_source'], alert['failure_rule_id'],
            alert['failure_classification'], alert['severity'],
            alert['current_value'], alert['expected_value'],
            alert['confidence_score'], alert['confidence_explanation'],
            alert['recommended_action']
        ))
        
        alert_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return alert_id
    
    def mark_alert_sent(self, alert_id: int):
        """Mark alert as sent after email delivery."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE alert_history
            SET alert_sent = 1, alert_sent_at = CURRENT_TIMESTAMP
            WHERE alert_id = ?
        """, (alert_id,))
        
        conn.commit()
        conn.close()
