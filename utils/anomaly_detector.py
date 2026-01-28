#!/usr/bin/env python3
"""
Phase 4: Anomaly Detection & Behavioral Drift Layer
Detects statistically abnormal behavior without confusing campaign effects, seasonality, or volatility.
"""

import sqlite3
import statistics
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple
from pathlib import Path


class AnomalyDetector:
    """Detects level, trend, and flatline anomalies in portfolio metrics."""
    
    # Suppression thresholds
    MIN_BASELINE_DAYS = 14  # Need at least 14 days of history
    NEW_PROPERTY_DAYS = 30  # Properties <30 days old are suppressed
    MIN_MEAN_FOR_CV = 1.0   # Minimum mean to calculate coefficient of variation
    
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.rules_cache = self._load_rules()
    
    def _load_rules(self) -> List[Dict]:
        """Load anomaly rules from database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT anomaly_id, rule_name, anomaly_type, metric_name, data_source,
                   detection_logic, baseline_window_days, classification, severity,
                   score_impact, alert_eligible, suppression_conditions
            FROM anomaly_rules
            ORDER BY severity DESC
        """)
        
        rules = []
        for row in cursor.fetchall():
            rules.append({
                'anomaly_id': row[0],
                'rule_name': row[1],
                'anomaly_type': row[2],
                'metric_name': row[3],
                'data_source': row[4],
                'detection_logic': row[5],
                'baseline_window_days': row[6],
                'classification': row[7],
                'severity': row[8],
                'score_impact': row[9],
                'alert_eligible': row[10],
                'suppression_conditions': row[11]
            })
        
        conn.close()
        return rules
    
    def detect_property_anomalies(self, property_id: str, metric_date: date) -> Dict:
        """Run all anomaly checks for a property on a specific date."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        results = {
            'property_id': property_id,
            'metric_date': metric_date,
            'detections': [],
            'anomalies_detected': 0,
            'level_anomalies': 0,
            'trend_anomalies': 0,
            'flatline_anomalies': 0,
            'suppressed_anomalies': 0
        }
        
        # Check if property is new (suppress all anomalies)
        is_new_property = self._is_new_property(cursor, property_id, metric_date)
        
        # Fetch historical data for baseline calculation
        baseline_data = self._fetch_baseline_data(cursor, property_id, metric_date)
        
        # Run each anomaly rule
        for rule in self.rules_cache:
            detection = self._run_anomaly_check(
                cursor, rule, property_id, metric_date, 
                baseline_data, is_new_property
            )
            
            if detection:
                results['detections'].append(detection)
                
                if detection['detected'] and not detection['suppressed']:
                    results['anomalies_detected'] += 1
                    
                    if detection['anomaly_type'] == 'LEVEL':
                        results['level_anomalies'] += 1
                    elif detection['anomaly_type'] == 'TREND':
                        results['trend_anomalies'] += 1
                    elif detection['anomaly_type'] == 'FLATLINE':
                        results['flatline_anomalies'] += 1
                
                if detection['detected'] and detection['suppressed']:
                    results['suppressed_anomalies'] += 1
                
                # Log detection to database
                self._log_detection(cursor, detection, property_id, metric_date)
        
        conn.commit()
        conn.close()
        
        return results
    
    def detect_all_properties(self, metric_date: date) -> Dict:
        """Run anomaly detection for all properties on a date."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get all properties with data on this date
        cursor.execute("""
            SELECT DISTINCT property_id
            FROM ga4_daily_metrics
            WHERE metric_date = ?
        """, (metric_date,))
        
        property_ids = [row[0] for row in cursor.fetchall()]
        conn.close()
        
        results = {
            'metric_date': metric_date,
            'properties_checked': 0,
            'total_anomalies': 0,
            'level_anomalies': 0,
            'trend_anomalies': 0,
            'flatline_anomalies': 0,
            'suppressed_anomalies': 0,
            'avg_anomaly_score': 0
        }
        
        scores = []
        
        for prop_id in property_ids:
            prop_result = self.detect_property_anomalies(prop_id, metric_date)
            
            # Calculate anomaly score
            score = self.calculate_anomaly_score(prop_result)
            scores.append(score)
            
            # Store score in database
            self._store_anomaly_score(prop_id, metric_date, score, prop_result)
            
            results['properties_checked'] += 1
            results['total_anomalies'] += prop_result['anomalies_detected']
            results['level_anomalies'] += prop_result['level_anomalies']
            results['trend_anomalies'] += prop_result['trend_anomalies']
            results['flatline_anomalies'] += prop_result['flatline_anomalies']
            results['suppressed_anomalies'] += prop_result['suppressed_anomalies']
        
        if scores:
            results['avg_anomaly_score'] = round(statistics.mean(scores))
        
        return results
    
    def _is_new_property(self, cursor, property_id: str, metric_date: date) -> bool:
        """Check if property is too new for reliable anomaly detection."""
        first_date_query = date(metric_date.year, metric_date.month, metric_date.day) - timedelta(days=self.NEW_PROPERTY_DAYS)
        
        cursor.execute("""
            SELECT MIN(metric_date)
            FROM ga4_daily_metrics
            WHERE property_id = ?
        """, (property_id,))
        
        result = cursor.fetchone()
        if not result or not result[0]:
            return True
        
        first_date = date.fromisoformat(result[0]) if isinstance(result[0], str) else result[0]
        return first_date > first_date_query
    
    def _fetch_baseline_data(self, cursor, property_id: str, metric_date: date) -> Dict:
        """Fetch historical data for all metrics needed for baseline calculation."""
        baseline_window = 30  # Use 30 days for all baselines
        start_date = metric_date - timedelta(days=baseline_window)
        
        data = {
            'ga4_sessions': [],
            'ga4_engaged_rate': [],
            'gsc_impressions': [],
            'gsc_clicks': [],
            'psi_performance': []
        }
        
        # GA4 data
        cursor.execute("""
            SELECT sessions, engaged_sessions
            FROM ga4_daily_metrics
            WHERE property_id = ? AND metric_date BETWEEN ? AND ?
            ORDER BY metric_date
        """, (property_id, start_date, metric_date - timedelta(days=1)))
        
        for row in cursor.fetchall():
            sessions = row[0] or 0
            engaged = row[1] or 0
            data['ga4_sessions'].append(sessions)
            if sessions > 0:
                data['ga4_engaged_rate'].append(engaged / sessions)
        
        # GSC data (aggregated per day)
        cursor.execute("""
            SELECT metric_date, SUM(clicks), SUM(impressions)
            FROM gsc_daily_metrics
            WHERE property_id = ? AND metric_date BETWEEN ? AND ?
            GROUP BY metric_date
            ORDER BY metric_date
        """, (property_id, start_date, metric_date - timedelta(days=1)))
        
        for row in cursor.fetchall():
            clicks = row[1] or 0
            impressions = row[2] or 0
            data['gsc_clicks'].append(clicks)
            data['gsc_impressions'].append(impressions)
        
        # PSI data
        cursor.execute("""
            SELECT AVG(performance_score)
            FROM pagespeed_metrics
            WHERE property_id = ? AND metric_date BETWEEN ? AND ?
            GROUP BY metric_date
            ORDER BY metric_date
        """, (property_id, start_date, metric_date - timedelta(days=1)))
        
        for row in cursor.fetchall():
            if row[0]:
                data['psi_performance'].append(row[0])
        
        return data
    
    def _run_anomaly_check(self, cursor, rule: Dict, property_id: str, 
                          metric_date: date, baseline_data: Dict, 
                          is_new_property: bool) -> Optional[Dict]:
        """Execute a single anomaly detection rule."""
        
        # Initialize detection result
        detection = {
            'anomaly_id': rule['anomaly_id'],
            'anomaly_type': rule['anomaly_type'],
            'metric_name': rule['metric_name'],
            'detected': False,
            'current_value': None,
            'baseline_value': None,
            'threshold_value': None,
            'deviation_magnitude': None,
            'explanation': None,
            'suppressed': False,
            'suppression_reason': None
        }
        
        # Suppress if new property
        if is_new_property:
            detection['suppressed'] = True
            detection['suppression_reason'] = 'Property too new (<30 days history)'
            return detection
        
        # Get current value
        current_value = self._get_current_value(cursor, rule, property_id, metric_date)
        if current_value is None:
            detection['suppression_reason'] = 'No data for metric on this date'
            detection['suppressed'] = True
            return detection
        
        detection['current_value'] = current_value
        
        # Get baseline data for this metric
        baseline_key = f"{rule['data_source']}_{rule['metric_name']}"
        baseline_values = baseline_data.get(baseline_key, [])
        
        if len(baseline_values) < self.MIN_BASELINE_DAYS:
            detection['suppression_reason'] = f'Insufficient baseline data ({len(baseline_values)} days < {self.MIN_BASELINE_DAYS} required)'
            detection['suppressed'] = True
            return detection
        
        # Run detection based on anomaly type
        if rule['anomaly_type'] == 'LEVEL':
            return self._detect_level_anomaly(detection, current_value, baseline_values, rule)
        elif rule['anomaly_type'] == 'TREND':
            return self._detect_trend_anomaly(detection, baseline_values, rule, cursor, property_id, metric_date)
        elif rule['anomaly_type'] == 'FLATLINE':
            return self._detect_flatline_anomaly(detection, baseline_values, rule, cursor, property_id, metric_date)
        
        return detection
    
    def _get_current_value(self, cursor, rule: Dict, property_id: str, metric_date: date) -> Optional[float]:
        """Get current metric value for the specified date."""
        source = rule['data_source']
        metric = rule['metric_name']
        
        if source == 'ga4':
            if metric == 'sessions':
                cursor.execute("SELECT sessions FROM ga4_daily_metrics WHERE property_id = ? AND metric_date = ?", 
                             (property_id, metric_date))
            elif metric == 'engaged_rate':
                cursor.execute("SELECT engaged_sessions, sessions FROM ga4_daily_metrics WHERE property_id = ? AND metric_date = ?",
                             (property_id, metric_date))
                row = cursor.fetchone()
                if row and row[1] and row[1] > 0:
                    return (row[0] or 0) / row[1]
                return None
        
        elif source == 'gsc':
            if metric == 'clicks':
                cursor.execute("SELECT SUM(clicks) FROM gsc_daily_metrics WHERE property_id = ? AND metric_date = ?",
                             (property_id, metric_date))
            elif metric == 'impressions':
                cursor.execute("SELECT SUM(impressions) FROM gsc_daily_metrics WHERE property_id = ? AND metric_date = ?",
                             (property_id, metric_date))
        
        elif source == 'psi' and metric == 'performance_score':
            cursor.execute("SELECT AVG(performance_score) FROM pagespeed_metrics WHERE property_id = ? AND metric_date = ?",
                         (property_id, metric_date))
        
        else:
            return None
        
        row = cursor.fetchone()
        return row[0] if row and row[0] is not None else None
    
    def _detect_level_anomaly(self, detection: Dict, current_value: float, 
                             baseline_values: List[float], rule: Dict) -> Dict:
        """Detect magnitude shifts using z-score (3-sigma threshold)."""
        
        if not baseline_values or len(baseline_values) < 2:
            detection['suppressed'] = True
            detection['suppression_reason'] = 'Insufficient baseline for z-score'
            return detection
        
        mean = statistics.mean(baseline_values)
        
        # Suppress if baseline mean is too low for reliable detection
        if mean < self.MIN_MEAN_FOR_CV:
            detection['suppressed'] = True
            detection['suppression_reason'] = f'Baseline mean too low ({mean:.2f} < {self.MIN_MEAN_FOR_CV})'
            return detection
        
        try:
            stdev = statistics.stdev(baseline_values)
        except statistics.StatisticsError:
            detection['suppressed'] = True
            detection['suppression_reason'] = 'Cannot calculate stdev (zero variance)'
            return detection
        
        if stdev == 0:
            detection['suppressed'] = True
            detection['suppression_reason'] = 'Zero variance in baseline (perfectly flat)'
            return detection
        
        # Calculate z-score
        z_score = (current_value - mean) / stdev
        
        detection['baseline_value'] = round(mean, 2)
        detection['threshold_value'] = 3.0  # 3-sigma threshold
        detection['deviation_magnitude'] = round(abs(z_score), 2)
        
        # Detect if |z-score| > 3.0 (99.7% confidence)
        if abs(z_score) > 3.0:
            detection['detected'] = True
            direction = 'spike' if z_score > 0 else 'drop'
            detection['explanation'] = f"{rule['metric_name'].title()} {direction}: {current_value:.1f} (baseline: {mean:.1f}, z-score: {z_score:.2f})"
        
        return detection
    
    def _detect_trend_anomaly(self, detection: Dict, baseline_values: List[float],
                             rule: Dict, cursor, property_id: str, metric_date: date) -> Dict:
        """Detect sustained directional change over 7-day window."""
        
        # Need at least 7 days of recent data
        if len(baseline_values) < 7:
            detection['suppressed'] = True
            detection['suppression_reason'] = 'Insufficient data for trend detection (need 7+ days)'
            return detection
        
        # Get last 7 days of data (including current day)
        recent_window = baseline_values[-7:] + [detection['current_value']]
        
        # Calculate slope using simple linear regression
        slope = self._calculate_slope(recent_window)
        
        # Calculate historical slopes (rolling 7-day windows)
        historical_slopes = []
        for i in range(len(baseline_values) - 6):
            window = baseline_values[i:i+7]
            historical_slopes.append(self._calculate_slope(window))
        
        if not historical_slopes or len(historical_slopes) < 2:
            detection['suppressed'] = True
            detection['suppression_reason'] = 'Insufficient history for slope comparison'
            return detection
        
        # Calculate mean and stdev of historical slopes
        mean_slope = statistics.mean(historical_slopes)
        try:
            stdev_slope = statistics.stdev(historical_slopes)
        except statistics.StatisticsError:
            detection['suppressed'] = True
            detection['suppression_reason'] = 'Cannot calculate slope variance'
            return detection
        
        if stdev_slope == 0:
            stdev_slope = 0.01  # Prevent division by zero
        
        detection['baseline_value'] = round(mean_slope, 4)
        detection['threshold_value'] = -2.0  # -2 stdev threshold for decline
        
        # Detect if slope < -2 stdev (sustained decline)
        z_slope = (slope - mean_slope) / stdev_slope
        detection['deviation_magnitude'] = round(z_slope, 2)
        
        if z_slope < -2.0:
            detection['detected'] = True
            detection['explanation'] = f"{rule['metric_name'].title()} sustained 7-day decline (slope z-score: {z_slope:.2f})"
        
        return detection
    
    def _detect_flatline_anomaly(self, detection: Dict, baseline_values: List[float],
                                rule: Dict, cursor, property_id: str, metric_date: date) -> Dict:
        """Detect variance collapse (unnaturally constant values)."""
        
        # Need at least 7 days for flatline detection
        if len(baseline_values) < 7:
            detection['suppressed'] = True
            detection['suppression_reason'] = 'Insufficient data for flatline detection (need 7+ days)'
            return detection
        
        # Get last 7 days (including current)
        recent_window = baseline_values[-7:] + [detection['current_value']]
        
        # Calculate variance of recent window
        try:
            recent_variance = statistics.variance(recent_window)
        except statistics.StatisticsError:
            recent_variance = 0
        
        # Calculate baseline variance (from all historical data)
        try:
            baseline_variance = statistics.variance(baseline_values)
        except statistics.StatisticsError:
            detection['suppressed'] = True
            detection['suppression_reason'] = 'Cannot calculate baseline variance'
            return detection
        
        if baseline_variance == 0:
            detection['suppressed'] = True
            detection['suppression_reason'] = 'Baseline has zero variance (always flat)'
            return detection
        
        # Variance ratio
        variance_ratio = recent_variance / baseline_variance
        
        detection['baseline_value'] = round(baseline_variance, 4)
        detection['current_value'] = round(recent_variance, 4)
        
        # Threshold varies by metric
        if rule['metric_name'] == 'performance_score':
            threshold = 0.01  # PSI should vary at least 1% of historical variance
        else:
            threshold = 0.05  # GA4 engaged rate should vary at least 5%
        
        detection['threshold_value'] = threshold
        detection['deviation_magnitude'] = round(variance_ratio, 4)
        
        if variance_ratio < threshold:
            detection['detected'] = True
            detection['explanation'] = f"{rule['metric_name'].title()} flatline: 7-day variance collapsed to {variance_ratio*100:.1f}% of baseline"
        
        return detection
    
    def _calculate_slope(self, values: List[float]) -> float:
        """Calculate slope using simple linear regression."""
        n = len(values)
        if n < 2:
            return 0.0
        
        x_values = list(range(n))
        x_mean = statistics.mean(x_values)
        y_mean = statistics.mean(values)
        
        numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_values, values))
        denominator = sum((x - x_mean) ** 2 for x in x_values)
        
        if denominator == 0:
            return 0.0
        
        return numerator / denominator
    
    def _log_detection(self, cursor, detection: Dict, property_id: str, metric_date: date):
        """Log anomaly detection to database."""
        cursor.execute("""
            INSERT INTO anomaly_detections 
            (property_id, metric_date, anomaly_id, anomaly_type, metric_name,
             detected, current_value, baseline_value, threshold_value, 
             deviation_magnitude, explanation, suppressed, suppression_reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            property_id, metric_date, detection['anomaly_id'], 
            detection['anomaly_type'], detection['metric_name'],
            detection['detected'], detection['current_value'], 
            detection['baseline_value'], detection['threshold_value'],
            detection['deviation_magnitude'], detection['explanation'],
            detection['suppressed'], detection['suppression_reason']
        ))
    
    def calculate_anomaly_score(self, detection_results: Dict) -> int:
        """Calculate anomaly score (80-100 scale)."""
        score = 100
        
        # Apply penalties (capped at -20 total)
        total_penalty = 0
        
        for detection in detection_results['detections']:
            if detection['detected'] and not detection['suppressed']:
                # Get penalty from rule
                penalty = abs(detection.get('score_impact', 0))
                total_penalty += penalty
        
        # Cap total penalty at 20 points
        total_penalty = min(total_penalty, 20)
        
        score = max(score - total_penalty, 80)
        
        return score
    
    def _store_anomaly_score(self, property_id: str, metric_date: date, 
                            score: int, results: Dict):
        """Store anomaly score in database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT OR REPLACE INTO anomaly_scores
            (property_id, metric_date, anomaly_score, anomalies_detected,
             level_anomalies, trend_anomalies, flatline_anomalies, suppressed_anomalies)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            property_id, metric_date, score, results['anomalies_detected'],
            results['level_anomalies'], results['trend_anomalies'],
            results['flatline_anomalies'], results['suppressed_anomalies']
        ))
        
        conn.commit()
        conn.close()
