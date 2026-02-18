#!/usr/bin/env python3
"""
Anomaly Detector for Portfolio Monitoring
==========================================
Detects anomalies in GA4 and GSC data by comparing current values to 7-day baselines.

Key Features:
- Calculate rolling 7-day baselines for each property
- Detect deviations > 50% from baseline
- Store baselines and anomaly alerts in database
- Support for GA4 metrics (sessions, users, pageviews) and GSC metrics (clicks, impressions)
"""

import sqlite3
import logging
import json
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Tuple
from pathlib import Path
import sys

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
# DatabaseManager imported as string annotation to avoid circular imports

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class AnomalyDetector:
    """Detects anomalies in property metrics by comparing to baselines."""
    
    # Metrics to monitor
    GA4_METRICS = ['sessions', 'users', 'pageviews']
    GSC_METRICS = ['clicks', 'impressions']
    
    # Detection thresholds
    DEVIATION_THRESHOLD = 0.50  # 50% drop triggers alert
    BASELINE_WINDOW_DAYS = 7     # Use 7-day average as baseline
    MIN_BASELINE_THRESHOLDS = {
        'sessions': 20,
        'users': 20,
        'pageviews': 50,
        'clicks': 10,
        'impressions': 100
    }
    GUEST_CARD_DROP_THRESHOLD = 0.40  # 40% drop vs previous period
    GUEST_CARD_MIN_PREV = 5           # ignore very small baselines
    
    def __init__(self, db: 'DatabaseManager'):
        """Initialize anomaly detector.
        
        Args:
            db: Database manager instance
        """
        self.db = db
        self.prelaunch_property_ids = self._load_prelaunch_properties()
        logger.info("AnomalyDetector initialized")

    def _load_prelaunch_properties(self) -> set:
        """Load prelaunch property IDs from registry (lifecycle = prelaunch)."""
        try:
            registry_path = Path('/Users/mark/Property_Analytics/config/venterra_properties_official.json')
            with open(registry_path) as f:
                registry = json.load(f)
            prelaunch = {
                p.get('ga4_property_id')
                for p in registry.get('properties', [])
                if p.get('lifecycle') == 'prelaunch' and p.get('ga4_property_id')
            }
            if prelaunch:
                logger.info(f"Prelaunch properties excluded from anomalies: {len(prelaunch)}")
            return prelaunch
        except Exception as e:
            logger.warning(f"Failed to load prelaunch properties: {e}")
            return set()
    
    def calculate_baselines(self, metric_date: date) -> int:
        """Calculate 7-day rolling baselines for all active properties.
        
        For each property, calculates average values for the 7 days BEFORE metric_date.
        Stores results in property_baselines table.
        
        Args:
            metric_date: Date to calculate baselines for
            
        Returns:
            Number of properties with baselines calculated
        """
        logger.info(f"Calculating baselines for {metric_date}")
        
        # Calculate date range for baseline window
        end_date = metric_date - timedelta(days=1)  # Day before metric_date
        start_date = end_date - timedelta(days=self.BASELINE_WINDOW_DAYS - 1)  # 7 days total
        
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            
            # Get all properties that have GA4 data in the baseline window
            cursor.execute("""
                SELECT DISTINCT property_id 
                FROM ga4_daily_metrics
                WHERE metric_date BETWEEN ? AND ?
            """, (start_date, end_date))
            properties = [row[0] for row in cursor.fetchall()]
            
            logger.info(f"Calculating baselines for {len(properties)} properties "
                       f"using data from {start_date} to {end_date}")
            
            baselines_calculated = 0
            
            for prop_id in properties:
                try:
                    # Calculate GA4 baselines
                    ga4_baselines = self._calculate_ga4_baseline(cursor, prop_id, start_date, end_date)
                    
                    # Calculate GSC baselines
                    gsc_baselines = self._calculate_gsc_baseline(cursor, prop_id, start_date, end_date)
                    
                    # Only insert if we have at least some data
                    if ga4_baselines or gsc_baselines:
                        self._insert_baseline(cursor, prop_id, metric_date, ga4_baselines, gsc_baselines)
                        baselines_calculated += 1
                    else:
                        logger.debug(f"No baseline data for {prop_id}")
                        
                except Exception as e:
                    logger.error(f"Failed to calculate baseline for {prop_id}: {e}")
            
            conn.commit()
        
        logger.info(f"✅ Calculated baselines for {baselines_calculated} properties")
        return baselines_calculated
    
    def _calculate_ga4_baseline(self, cursor: sqlite3.Cursor, property_id: str,
                                start_date: date, end_date: date) -> Dict[str, float]:
        """Calculate GA4 metric baselines for a property.
        
        Args:
            cursor: Database cursor
            property_id: GA4 Property ID
            start_date: Start of baseline window
            end_date: End of baseline window
            
        Returns:
            Dict with average values for each GA4 metric
        """
        cursor.execute("""
            SELECT 
                AVG(sessions) as avg_sessions,
                AVG(total_users) as avg_users,
                AVG(pageviews) as avg_pageviews
            FROM ga4_daily_metrics
            WHERE property_id = ?
              AND metric_date BETWEEN ? AND ?
        """, (property_id, start_date, end_date))
        
        row = cursor.fetchone()
        if row and row[0] is not None:
            return {
                'sessions': row[0] or 0.0,
                'users': row[1] or 0.0,
                'pageviews': row[2] or 0.0
            }
        return {}
    
    def _calculate_gsc_baseline(self, cursor: sqlite3.Cursor, property_id: str,
                                start_date: date, end_date: date) -> Dict[str, float]:
        """Calculate GSC metric baselines for a property.
        
        Args:
            cursor: Database cursor
            property_id: GA4 Property ID
            start_date: Start of baseline window
            end_date: End of baseline window
            
        Returns:
            Dict with average values for each GSC metric
        """
        cursor.execute("""
            SELECT 
                AVG(clicks) as avg_clicks,
                AVG(impressions) as avg_impressions
            FROM gsc_daily_metrics
            WHERE property_id = ?
              AND metric_date BETWEEN ? AND ?
        """, (property_id, start_date, end_date))
        
        row = cursor.fetchone()
        if row and row[0] is not None:
            return {
                'clicks': row[0] or 0.0,
                'impressions': row[1] or 0.0
            }
        return {}
    
    def _insert_baseline(self, cursor: sqlite3.Cursor, property_id: str,
                        metric_date: date, ga4_baselines: Dict[str, float],
                        gsc_baselines: Dict[str, float]) -> None:
        """Insert baseline values into database.
        
        Args:
            cursor: Database cursor
            property_id: GA4 Property ID
            metric_date: Date baseline is for
            ga4_baselines: GA4 average values
            gsc_baselines: GSC average values
        """
        # Get property name for baseline record
        cursor.execute("SELECT property_name FROM properties WHERE property_id = ?", (property_id,))
        row = cursor.fetchone()
        prop_name = row[0] if row else property_id
        
        cursor.execute("""
            INSERT INTO property_baselines (
                property_id, property_name,
                avg_sessions_7d, avg_users_7d, avg_pageviews_7d,
                avg_gsc_clicks_7d, avg_gsc_impressions_7d,
                data_points_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(property_id) DO UPDATE SET
                property_name = excluded.property_name,
                avg_sessions_7d = excluded.avg_sessions_7d,
                avg_users_7d = excluded.avg_users_7d,
                avg_pageviews_7d = excluded.avg_pageviews_7d,
                avg_gsc_clicks_7d = excluded.avg_gsc_clicks_7d,
                avg_gsc_impressions_7d = excluded.avg_gsc_impressions_7d,
                data_points_count = excluded.data_points_count,
                last_updated = CURRENT_TIMESTAMP
        """, (
            property_id, prop_name,
            ga4_baselines.get('sessions'),
            ga4_baselines.get('users'),
            ga4_baselines.get('pageviews'),
            gsc_baselines.get('clicks'),
            gsc_baselines.get('impressions'),
            self.BASELINE_WINDOW_DAYS
        ))
    
    def detect_anomalies(self, metric_date: date) -> Dict[str, List[Dict]]:
        """Detect anomalies by comparing current values to baselines.
        
        Compares actual metrics for metric_date to the baselines calculated for that date.
        Alerts if actual value is < 50% of baseline (major drop).
        
        Args:
            metric_date: Date to check for anomalies
            
        Returns:
            Dict with 'critical' and 'warnings' lists containing anomaly details
        """
        logger.info(f"Detecting anomalies for {metric_date}")
        
        anomalies = {
            'critical': [],  # > 70% drop
            'warnings': []   # 50-70% drop
        }
        
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            
            # Get properties with baselines
            cursor.execute("""
                SELECT property_id, 
                       avg_sessions_7d, avg_users_7d, avg_pageviews_7d,
                       avg_gsc_clicks_7d, avg_gsc_impressions_7d
                FROM property_baselines
            """)
            
            for row in cursor.fetchall():
                prop_id = row[0]
                if prop_id in self.prelaunch_property_ids:
                    continue
                baselines = {
                    'sessions': row[1],
                    'users': row[2],
                    'pageviews': row[3],
                    'clicks': row[4],
                    'impressions': row[5]
                }
                
                try:
                    # Get actual values for this date
                    actuals = self._get_actual_values(cursor, prop_id, metric_date)
                    
                    # Compare each metric
                    for metric, baseline in baselines.items():
                        if baseline is None or baseline == 0:
                            continue
                        if baseline < self.MIN_BASELINE_THRESHOLDS.get(metric, 0):
                            continue
                        
                        actual = actuals.get(metric)
                        if actual is None:
                            continue
                        
                        # Calculate deviation
                        deviation_pct = (baseline - actual) / baseline
                        
                        # Alert if actual is significantly below baseline
                        if deviation_pct > self.DEVIATION_THRESHOLD:
                            severity = 'critical' if deviation_pct > 0.70 else 'high'
                            
                            anomaly = {
                                'property_id': prop_id,
                                'metric': metric,
                                'baseline': baseline,
                                'actual': actual,
                                'deviation_pct': deviation_pct,
                                'severity': severity
                            }
                            
                            # Store in database
                            self._insert_anomaly_alert(cursor, prop_id, metric_date, metric,
                                                       baseline, actual, deviation_pct, severity)
                            
                            # Add to results
                            if severity == 'critical':
                                anomalies['critical'].append(anomaly)
                            else:
                                anomalies['warnings'].append(anomaly)
                            
                            logger.warning(f"Anomaly detected: {prop_id} - {metric} "
                                         f"dropped {deviation_pct*100:.1f}% "
                                         f"(baseline: {baseline:.0f}, actual: {actual:.0f})")
                
                except Exception as e:
                    logger.error(f"Failed to detect anomalies for {prop_id}: {e}")
            
            conn.commit()

            # Guest Card anomaly detection is based on file-level "this vs prev period"
            # values in guest_card_metrics (not on property_baselines).
            self._detect_guest_card_anomalies(cursor, metric_date, anomalies)
            conn.commit()
        
        logger.info(f"Found {len(anomalies['critical'])} critical anomalies, "
                   f"{len(anomalies['warnings'])} warnings")
        return anomalies

    def _detect_guest_card_anomalies(
        self,
        cursor: sqlite3.Cursor,
        metric_date: date,
        anomalies: Dict[str, List[Dict]]
    ) -> None:
        """Detect Guest Card drops by property vs previous period."""
        run_date = metric_date.isoformat() if isinstance(metric_date, date) else str(metric_date)

        try:
            cursor.execute("""
                SELECT
                    property_code,
                    property_name,
                    COALESCE(gc_this_period, 0) AS gc_this_period,
                    COALESCE(gc_prev_period, 0) AS gc_prev_period
                FROM guest_card_metrics
                WHERE run_date = ?
            """, (run_date,))
        except sqlite3.OperationalError:
            # Table may not exist yet in older environments.
            return

        for row in cursor.fetchall():
            property_code, property_name, current_value, expected_value = row
            if expected_value < self.GUEST_CARD_MIN_PREV:
                continue

            deviation_pct = (expected_value - current_value) / expected_value if expected_value else 0.0
            if deviation_pct <= self.GUEST_CARD_DROP_THRESHOLD:
                continue

            severity = 'critical' if deviation_pct > 0.70 else 'high'
            metric_name = 'guest_card_gc_this_period'

            self._insert_anomaly_alert(
                cursor=cursor,
                property_id=property_code,
                metric_date=metric_date,
                metric_name=metric_name,
                baseline_value=float(expected_value),
                actual_value=float(current_value),
                deviation_pct=float(deviation_pct),
                severity=severity,
                property_name_override=property_name
            )

            anomaly = {
                'property_id': property_code,
                'property_name': property_name,
                'metric': metric_name,
                'baseline': float(expected_value),
                'actual': float(current_value),
                'deviation_pct': float(deviation_pct),
                'severity': severity
            }
            if severity == 'critical':
                anomalies['critical'].append(anomaly)
            else:
                anomalies['warnings'].append(anomaly)
    
    def _get_actual_values(self, cursor: sqlite3.Cursor, property_id: str,
                          metric_date: date) -> Dict[str, float]:
        """Get actual metric values for a property on a specific date.
        
        Args:
            cursor: Database cursor
            property_id: GA4 Property ID
            metric_date: Date to get values for
            
        Returns:
            Dict with actual values for each metric
        """
        actuals = {}
        
        # Get GA4 actuals
        cursor.execute("""
            SELECT sessions, total_users, pageviews
            FROM ga4_daily_metrics
            WHERE property_id = ? AND metric_date = ?
        """, (property_id, metric_date))
        
        row = cursor.fetchone()
        if row:
            actuals['sessions'] = row[0] or 0.0
            actuals['users'] = row[1] or 0.0
            actuals['pageviews'] = row[2] or 0.0
        
        # Get GSC actuals
        cursor.execute("""
            SELECT clicks, impressions
            FROM gsc_daily_metrics
            WHERE property_id = ? AND metric_date = ?
        """, (property_id, metric_date))
        
        row = cursor.fetchone()
        if row:
            actuals['clicks'] = row[0] or 0.0
            actuals['impressions'] = row[1] or 0.0
        
        return actuals
    
    def _insert_anomaly_alert(self, cursor: sqlite3.Cursor, property_id: str,
                             metric_date: date, metric_name: str,
                             baseline_value: float, actual_value: float,
                             deviation_pct: float, severity: str,
                             property_name_override: Optional[str] = None) -> None:
        """Insert anomaly alert into database.
        
        Args:
            cursor: Database cursor
            property_id: GA4 Property ID
            metric_date: Date of anomaly (not stored in table)
            metric_name: Name of metric (sessions, clicks, etc.)
            baseline_value: Expected baseline value
            actual_value: Actual value observed
            deviation_pct: Percentage deviation from baseline
            severity: 'critical' or 'high'
        """
        # Get property name
        if property_name_override:
            prop_name = property_name_override
        else:
            cursor.execute("SELECT property_name FROM properties WHERE property_id = ?", (property_id,))
            row = cursor.fetchone()
            prop_name = row[0] if row else property_id

        # Avoid duplicate unresolved alerts with identical values in a short window.
        cursor.execute("""
            SELECT 1
            FROM anomaly_alerts
            WHERE property_id = ?
              AND metric_name = ?
              AND ABS(current_value - ?) < 0.0001
              AND ABS(expected_value - ?) < 0.0001
              AND severity = ?
              AND resolved = 0
              AND detected_at >= datetime('now', '-1 day')
            LIMIT 1
        """, (property_id, metric_name, actual_value, baseline_value, severity))
        if cursor.fetchone():
            return
        
        cursor.execute("""
            INSERT INTO anomaly_alerts (
                property_id, property_name, metric_name,
                expected_value, current_value, deviation_pct,
                severity, resolved
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
        """, (property_id, prop_name, metric_name, baseline_value, actual_value,
              deviation_pct, severity))
    
    def get_recent_anomalies(self, days: int = 7) -> List[Dict]:
        """Get recent unresolved anomalies.
        
        Args:
            days: Number of days to look back (based on detected_at)
            
        Returns:
            List of anomaly records
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT 
                    property_id,
                    property_name,
                    detected_at,
                    metric_name,
                    expected_value,
                    current_value,
                    deviation_pct,
                    severity,
                    resolved
                FROM anomaly_alerts
                WHERE detected_at >= DATE('now', ? || ' days')
                  AND resolved = 0
                ORDER BY detected_at DESC, severity DESC
            """, (-days,))
            
            results = []
            for row in cursor.fetchall():
                results.append({
                    'property_id': row[0],
                    'property_name': row[1],
                    'detected_at': row[2],
                    'metric_name': row[3],
                    'baseline_value': row[4],
                    'actual_value': row[5],
                    'deviation_pct': row[6],
                    'severity': row[7],
                    'resolved': row[8]
                })
            
            return results


if __name__ == "__main__":
    # Test anomaly detection
    from src.db.database_manager import DatabaseManager
    
    db = DatabaseManager()
    detector = AnomalyDetector(db)
    
    # Calculate baselines for today
    today = date.today()
    detector.calculate_baselines(today)
    
    # Detect anomalies
    anomalies = detector.detect_anomalies(today)
    
    print(f"\n🔍 Anomaly Detection Results for {today}")
    print(f"Critical: {len(anomalies['critical'])}")
    print(f"Warnings: {len(anomalies['warnings'])}")
    
    if anomalies['critical']:
        print("\n❌ Critical Anomalies:")
        for a in anomalies['critical']:
            print(f"  {a['property_id']} - {a['metric']}: "
                  f"{a['deviation_pct']*100:.1f}% drop")
    
    if anomalies['warnings']:
        print("\n⚠️  Warnings:")
        for a in anomalies['warnings']:
            print(f"  {a['property_id']} - {a['metric']}: "
                  f"{a['deviation_pct']*100:.1f}% drop")
