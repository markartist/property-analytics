"""
Data Quality Validator
======================
Phase 2: Validates data quality using rule-based checks.

Usage:
    from utils.data_quality_validator import DataQualityValidator
    
    validator = DataQualityValidator(db_path)
    results = validator.validate_ga4_data(property_id, metric_date)
"""

import sqlite3
from datetime import datetime, date
from pathlib import Path
from typing import Dict, List, Tuple, Optional


class DataQualityValidator:
    """Validates data quality using configurable rules."""
    
    def __init__(self, db_path: Path):
        """
        Initialize validator.
        
        Args:
            db_path: Path to portfolio_analytics.db
        """
        self.db_path = db_path
        self.rules_cache = {}
        self._load_rules()
    
    def _load_rules(self):
        """Load validation rules from database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT rule_id, rule_name, data_source, rule_type, metric_name,
                   description, validation_sql, severity
            FROM validation_rules
            WHERE active = 1
        """)
        
        for row in cursor.fetchall():
            rule_id, rule_name, data_source, rule_type, metric_name, desc, sql, severity = row
            
            if data_source not in self.rules_cache:
                self.rules_cache[data_source] = []
            
            self.rules_cache[data_source].append({
                'rule_id': rule_id,
                'rule_name': rule_name,
                'rule_type': rule_type,
                'metric_name': metric_name,
                'description': desc,
                'validation_sql': sql,
                'severity': severity
            })
        
        conn.close()
    
    def validate_ga4_data(self, property_id: str, metric_date: date) -> Dict:
        """
        Validate GA4 data for a property and date.
        
        Args:
            property_id: GA4 property ID
            metric_date: Date of data to validate
            
        Returns:
            Validation results dictionary
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get GA4 data for validation
        cursor.execute("""
            SELECT sessions, engaged_sessions, total_users, pageviews, 
                   avg_session_duration, bounce_rate
            FROM ga4_daily_metrics
            WHERE property_id = ? AND metric_date = ?
        """, (property_id, metric_date))
        
        row = cursor.fetchone()
        if not row:
            conn.close()
            return {'exists': False, 'checks': []}
        
        sessions, engaged, users, pageviews, duration, bounce_rate = row
        
        # Run validation rules
        results = {'exists': True, 'checks': [], 'passed': 0, 'failed': 0}
        
        for rule in self.rules_cache.get('ga4', []):
            check_result = self._run_validation(
                cursor, rule, property_id, metric_date,
                data={'sessions': sessions, 'engaged_sessions': engaged,
                      'total_users': users, 'pageviews': pageviews,
                      'bounce_rate': bounce_rate}
            )
            results['checks'].append(check_result)
            
            if check_result['passed']:
                results['passed'] += 1
            else:
                results['failed'] += 1
            
            # Log to database
            self._log_check(cursor, check_result, property_id, 'ga4', metric_date)
        
        conn.commit()
        conn.close()
        
        return results
    
    def validate_gsc_data(self, property_id: str, metric_date: date) -> Dict:
        """
        Validate GSC data for a property and date.
        
        Args:
            property_id: Property ID
            metric_date: Date of data to validate
            
        Returns:
            Validation results dictionary
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get GSC data (aggregated by property and date)
        cursor.execute("""
            SELECT SUM(clicks) as clicks, SUM(impressions) as impressions,
                   AVG(ctr) as ctr, AVG(average_position) as avg_position
            FROM gsc_daily_metrics
            WHERE property_id = ? AND metric_date = ?
        """, (property_id, metric_date))
        
        row = cursor.fetchone()
        if not row or row[0] is None:
            conn.close()
            return {'exists': False, 'checks': []}
        
        clicks, impressions, ctr, position = row
        
        # Run validation rules
        results = {'exists': True, 'checks': [], 'passed': 0, 'failed': 0}
        
        for rule in self.rules_cache.get('gsc', []):
            check_result = self._run_validation(
                cursor, rule, property_id, metric_date,
                data={'clicks': clicks, 'impressions': impressions,
                      'ctr': ctr, 'avg_position': position}
            )
            results['checks'].append(check_result)
            
            if check_result['passed']:
                results['passed'] += 1
            else:
                results['failed'] += 1
            
            # Log to database
            self._log_check(cursor, check_result, property_id, 'gsc', metric_date)
        
        conn.commit()
        conn.close()
        
        return results
    
    def validate_psi_data(self, property_id: str, metric_date: date) -> Dict:
        """
        Validate PSI data for a property and date.
        
        Args:
            property_id: Property ID
            metric_date: Date of data to validate
            
        Returns:
            Validation results dictionary
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get PSI data
        cursor.execute("""
            SELECT strategy, performance_score, lcp_value, cls_value
            FROM pagespeed_metrics
            WHERE property_id = ? AND metric_date = ?
        """, (property_id, metric_date))
        
        rows = cursor.fetchall()
        if not rows:
            conn.close()
            return {'exists': False, 'checks': []}
        
        # Run validation rules
        results = {'exists': True, 'checks': [], 'passed': 0, 'failed': 0}
        
        for rule in self.rules_cache.get('psi', []):
            if rule['rule_type'] == 'existence':
                # Check both mobile and desktop exist
                strategies = {row[0] for row in rows}
                check_result = {
                    'rule_id': rule['rule_id'],
                    'rule_name': rule['rule_name'],
                    'passed': len(strategies) == 2,
                    'severity': rule['severity'],
                    'metric_value': f"{len(strategies)} strategies",
                    'expected_value': '2 strategies (mobile, desktop)',
                    'failure_reason': None if len(strategies) == 2 else f"Only found: {', '.join(strategies)}"
                }
            else:
                # Check all records
                all_passed = True
                failed_records = []
                
                for strategy, score, lcp, cls in rows:
                    data = {'performance_score': score, 'lcp_value': lcp, 'cls_value': cls}
                    passed = self._evaluate_sql(data, rule['validation_sql'])
                    
                    if not passed:
                        all_passed = False
                        failed_records.append(strategy)
                
                check_result = {
                    'rule_id': rule['rule_id'],
                    'rule_name': rule['rule_name'],
                    'passed': all_passed,
                    'severity': rule['severity'],
                    'metric_value': ', '.join(failed_records) if failed_records else 'All passed',
                    'expected_value': rule['description'],
                    'failure_reason': None if all_passed else f"Failed for: {', '.join(failed_records)}"
                }
            
            results['checks'].append(check_result)
            
            if check_result['passed']:
                results['passed'] += 1
            else:
                results['failed'] += 1
            
            # Log to database
            self._log_check(cursor, check_result, property_id, 'psi', metric_date)
        
        conn.commit()
        conn.close()
        
        return results
    
    def validate_gbp_reviews_data(self, property_id: str, days_back: int = 7) -> Dict:
        """
        Validate GBP reviews data for a property (checks recent reviews).
        
        Args:
            property_id: Property ID
            days_back: Check reviews from last N days
            
        Returns:
            Validation results dictionary
        """
        from datetime import timedelta
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get recent reviews
        cursor.execute("""
            SELECT review_id, star_rating_numeric
            FROM gbp_reviews
            WHERE property_id = ? 
            AND review_create_time >= datetime('now', ? || ' days')
        """, (property_id, -days_back))
        
        rows = cursor.fetchall()
        if not rows:
            conn.close()
            return {'exists': False, 'checks': []}
        
        # Run validation rules
        results = {'exists': True, 'checks': [], 'passed': 0, 'failed': 0}
        
        for rule in self.rules_cache.get('gbp_reviews', []):
            if rule['rule_type'] == 'existence':
                check_result = {
                    'rule_id': rule['rule_id'],
                    'rule_name': rule['rule_name'],
                    'passed': len(rows) > 0,
                    'severity': rule['severity'],
                    'metric_value': f"{len(rows)} reviews",
                    'expected_value': rule['description'],
                    'failure_reason': None if len(rows) > 0 else 'No reviews found'
                }
            else:
                # Check all reviews
                all_passed = True
                failed_reviews = 0
                
                for review_id, rating in rows:
                    data = {'star_rating': rating}
                    passed = self._evaluate_sql(data, rule['validation_sql'])
                    
                    if not passed:
                        all_passed = False
                        failed_reviews += 1
                
                check_result = {
                    'rule_id': rule['rule_id'],
                    'rule_name': rule['rule_name'],
                    'passed': all_passed,
                    'severity': rule['severity'],
                    'metric_value': f"{failed_reviews}/{len(rows)} failed" if failed_reviews else 'All passed',
                    'expected_value': rule['description'],
                    'failure_reason': None if all_passed else f"{failed_reviews} reviews failed validation"
                }
            
            results['checks'].append(check_result)
            
            if check_result['passed']:
                results['passed'] += 1
            else:
                results['failed'] += 1
            
            # Log to database (use today as metric_date)
            self._log_check(cursor, check_result, property_id, 'gbp_reviews', date.today())
        
        conn.commit()
        conn.close()
        
        return results
    
    def validate_gbp_insights_data(self, property_id: str, metric_date: date) -> Dict:
        """
        Validate GBP insights data for a property and date.
        
        Args:
            property_id: Property ID
            metric_date: Date of data to validate
            
        Returns:
            Validation results dictionary
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get GBP insights data
        cursor.execute("""
            SELECT total_profile_views, total_actions, action_rate
            FROM gbp_daily_insights
            WHERE property_id = ? AND metric_date = ?
        """, (property_id, metric_date))
        
        row = cursor.fetchone()
        if not row:
            conn.close()
            return {'exists': False, 'checks': []}
        
        views, actions, action_rate = row
        
        # Run validation rules
        results = {'exists': True, 'checks': [], 'passed': 0, 'failed': 0}
        
        for rule in self.rules_cache.get('gbp_insights', []):
            check_result = self._run_validation(
                cursor, rule, property_id, metric_date,
                data={'total_profile_views': views, 'total_actions': actions,
                      'action_rate': action_rate if action_rate else 0}
            )
            results['checks'].append(check_result)
            
            if check_result['passed']:
                results['passed'] += 1
            else:
                results['failed'] += 1
            
            # Log to database
            self._log_check(cursor, check_result, property_id, 'gbp_insights', metric_date)
        
        conn.commit()
        conn.close()
        
        return results
    
    def validate_gtmetrix_data(self, property_id: str, metric_date: date) -> Dict:
        """
        Validate GTMetrix data for a property and date.
        
        Args:
            property_id: Property ID
            metric_date: Date of data to validate
            
        Returns:
            Validation results dictionary
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get GTMetrix data
        cursor.execute("""
            SELECT pagespeed_score, onload_time_ms
            FROM gtmetrix_metrics
            WHERE property_id = ? AND metric_date = ?
        """, (property_id, metric_date))
        
        row = cursor.fetchone()
        if not row:
            conn.close()
            return {'exists': False, 'checks': []}
        
        score, load_time = row
        
        # Run validation rules
        results = {'exists': True, 'checks': [], 'passed': 0, 'failed': 0}
        
        for rule in self.rules_cache.get('gtmetrix', []):
            check_result = self._run_validation(
                cursor, rule, property_id, metric_date,
                data={'pagespeed_score': score, 'onload_time': load_time / 1000.0 if load_time else 0}
            )
            results['checks'].append(check_result)
            
            if check_result['passed']:
                results['passed'] += 1
            else:
                results['failed'] += 1
            
            # Log to database
            self._log_check(cursor, check_result, property_id, 'gtmetrix', metric_date)
        
        conn.commit()
        conn.close()
        
        return results
    
    def validate_thirtylines_data(self, property_id: str, metric_date: date) -> Dict:
        """
        Validate ThirtyLines data for a property (checks recent data).
        
        Args:
            property_id: Property ID
            metric_date: Date to check (uses most recent data near this date)
            
        Returns:
            Validation results dictionary
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get recent floorplan data for this property
        cursor.execute("""
            SELECT f.id, f.bedrooms, f.rent_from, u.units_available_now
            FROM property_floorplans f
            LEFT JOIN unit_availability u 
                ON f.property_id = u.property_id 
                AND f.floorplan_name = u.floorplan_name
                AND date(u.snapshot_date) = ?
            WHERE f.property_id = ?
        """, (metric_date, property_id))
        
        rows = cursor.fetchall()
        if not rows:
            conn.close()
            return {'exists': False, 'checks': []}
        
        # Run validation rules
        results = {'exists': True, 'checks': [], 'passed': 0, 'failed': 0}
        
        for rule in self.rules_cache.get('thirtylines', []):
            if rule['rule_type'] == 'existence':
                check_result = {
                    'rule_id': rule['rule_id'],
                    'rule_name': rule['rule_name'],
                    'passed': len(rows) > 0,
                    'severity': rule['severity'],
                    'metric_value': f"{len(rows)} floorplans",
                    'expected_value': rule['description'],
                    'failure_reason': None if len(rows) > 0 else 'No floorplan data found'
                }
            else:
                # Check all floorplans
                all_passed = True
                failed_count = 0
                
                for floorplan_id, bedrooms, rent, available_units in rows:
                    data = {
                        'bedrooms': bedrooms if bedrooms else 0,
                        'min_rent': rent if rent else 0,
                        'available_units': available_units if available_units is not None else 0
                    }
                    passed = self._evaluate_sql(data, rule['validation_sql'])
                    
                    if not passed:
                        all_passed = False
                        failed_count += 1
                
                check_result = {
                    'rule_id': rule['rule_id'],
                    'rule_name': rule['rule_name'],
                    'passed': all_passed,
                    'severity': rule['severity'],
                    'metric_value': f"{failed_count}/{len(rows)} failed" if failed_count else 'All passed',
                    'expected_value': rule['description'],
                    'failure_reason': None if all_passed else f"{failed_count} floorplans failed validation"
                }
            
            results['checks'].append(check_result)
            
            if check_result['passed']:
                results['passed'] += 1
            else:
                results['failed'] += 1
            
            # Log to database
            self._log_check(cursor, check_result, property_id, 'thirtylines', metric_date)
        
        conn.commit()
        conn.close()
        
        return results
    
    def validate_all_recent_data(self, days_back: int = 1) -> Dict:
        """
        Validate all recent data across all sources.
        
        Args:
            days_back: How many days back to validate
            
        Returns:
            Summary of validation results
        """
        from datetime import timedelta
        
        # Different data sources have different API delays
        target_date_ga4 = date.today() - timedelta(days=days_back)  # GA4: yesterday
        target_date_gsc = date.today() - timedelta(days=3)  # GSC: 3-day delay
        target_date_gbp = date.today() - timedelta(days=2)  # GBP: 2-day delay
        target_date_psi = date.today() - timedelta(days=days_back)  # PSI: yesterday
        
        results = {
            'date': target_date_ga4,
            'ga4': {'properties_checked': 0, 'total_checks': 0, 'failed_checks': 0, 'quality_score': 0, 'target_date': str(target_date_ga4)},
            'gsc': {'properties_checked': 0, 'total_checks': 0, 'failed_checks': 0, 'quality_score': 0, 'target_date': str(target_date_gsc)},
            'psi': {'properties_checked': 0, 'total_checks': 0, 'failed_checks': 0, 'quality_score': 0, 'target_date': str(target_date_psi)},
            'gbp_reviews': {'properties_checked': 0, 'total_checks': 0, 'failed_checks': 0, 'quality_score': 0, 'target_date': 'last 7 days'},
            'gbp_insights': {'properties_checked': 0, 'total_checks': 0, 'failed_checks': 0, 'quality_score': 0, 'target_date': str(target_date_gbp)},
            'gtmetrix': {'properties_checked': 0, 'total_checks': 0, 'failed_checks': 0, 'quality_score': 0, 'target_date': str(target_date_ga4)},
            'thirtylines': {'properties_checked': 0, 'total_checks': 0, 'failed_checks': 0, 'quality_score': 0, 'target_date': str(target_date_ga4)}
        }
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get all properties with GA4 data (using GA4 target date)
        cursor.execute("""
            SELECT DISTINCT property_id
            FROM ga4_daily_metrics
            WHERE metric_date = ?
        """, (target_date_ga4,))
        
        ga4_properties = [row[0] for row in cursor.fetchall()]
        
        for prop_id in ga4_properties:
            val_result = self.validate_ga4_data(prop_id, target_date_ga4)
            if val_result['exists']:
                results['ga4']['properties_checked'] += 1
                results['ga4']['total_checks'] += val_result['passed'] + val_result['failed']
                results['ga4']['failed_checks'] += val_result['failed']
                
                # Calculate and store quality score
                self._calculate_quality_score(prop_id, 'ga4', target_date_ga4, val_result)
        
        # Get all properties with GSC data (using GSC target date with 3-day delay)
        cursor.execute("""
            SELECT DISTINCT property_id
            FROM gsc_daily_metrics
            WHERE metric_date = ?
        """, (target_date_gsc,))
        
        gsc_properties = [row[0] for row in cursor.fetchall()]
        
        for prop_id in gsc_properties:
            val_result = self.validate_gsc_data(prop_id, target_date_gsc)
            if val_result['exists']:
                results['gsc']['properties_checked'] += 1
                results['gsc']['total_checks'] += val_result['passed'] + val_result['failed']
                results['gsc']['failed_checks'] += val_result['failed']
                
                # Calculate and store quality score
                self._calculate_quality_score(prop_id, 'gsc', target_date_gsc, val_result)
        
        # Get all properties with PSI data (using PSI target date)
        cursor.execute("""
            SELECT DISTINCT property_id
            FROM pagespeed_metrics
            WHERE metric_date = ?
        """, (target_date_psi,))
        
        psi_properties = [row[0] for row in cursor.fetchall()]
        
        for prop_id in psi_properties:
            val_result = self.validate_psi_data(prop_id, target_date_psi)
            if val_result['exists']:
                results['psi']['properties_checked'] += 1
                results['psi']['total_checks'] += val_result['passed'] + val_result['failed']
                results['psi']['failed_checks'] += val_result['failed']
                
                # Calculate and store quality score
                self._calculate_quality_score(prop_id, 'psi', target_date_psi, val_result)
        
        # Get all properties with GBP Reviews data (last 7 days)
        cursor.execute("""
            SELECT DISTINCT property_id
            FROM gbp_reviews
            WHERE review_create_time >= datetime('now', '-7 days')
        """)
        
        gbp_review_properties = [row[0] for row in cursor.fetchall()]
        
        for prop_id in gbp_review_properties:
            val_result = self.validate_gbp_reviews_data(prop_id, days_back=7)
            if val_result['exists']:
                results['gbp_reviews']['properties_checked'] += 1
                results['gbp_reviews']['total_checks'] += val_result['passed'] + val_result['failed']
                results['gbp_reviews']['failed_checks'] += val_result['failed']
                
                # Calculate and store quality score
                self._calculate_quality_score(prop_id, 'gbp_reviews', target_date_ga4, val_result)
        
        # Get all properties with GBP Insights data (using GBP target date with 2-day delay)
        cursor.execute("""
            SELECT DISTINCT property_id
            FROM gbp_daily_insights
            WHERE metric_date = ?
        """, (target_date_gbp,))
        
        gbp_insights_properties = [row[0] for row in cursor.fetchall()]
        
        for prop_id in gbp_insights_properties:
            val_result = self.validate_gbp_insights_data(prop_id, target_date_gbp)
            if val_result['exists']:
                results['gbp_insights']['properties_checked'] += 1
                results['gbp_insights']['total_checks'] += val_result['passed'] + val_result['failed']
                results['gbp_insights']['failed_checks'] += val_result['failed']
                
                # Calculate and store quality score
                self._calculate_quality_score(prop_id, 'gbp_insights', target_date_gbp, val_result)
        
        # Get all properties with GTMetrix data (using GA4 target date)
        cursor.execute("""
            SELECT DISTINCT property_id
            FROM gtmetrix_metrics
            WHERE metric_date = ?
        """, (target_date_ga4,))
        
        gtmetrix_properties = [row[0] for row in cursor.fetchall()]
        
        for prop_id in gtmetrix_properties:
            val_result = self.validate_gtmetrix_data(prop_id, target_date_ga4)
            if val_result['exists']:
                results['gtmetrix']['properties_checked'] += 1
                results['gtmetrix']['total_checks'] += val_result['passed'] + val_result['failed']
                results['gtmetrix']['failed_checks'] += val_result['failed']
                
                # Calculate and store quality score
                self._calculate_quality_score(prop_id, 'gtmetrix', target_date_ga4, val_result)
        
        # Get all properties with ThirtyLines data
        cursor.execute("""
            SELECT DISTINCT property_id
            FROM property_floorplans
        """)
        
        thirtylines_properties = [row[0] for row in cursor.fetchall()]
        
        for prop_id in thirtylines_properties:
            val_result = self.validate_thirtylines_data(prop_id, target_date_ga4)
            if val_result['exists']:
                results['thirtylines']['properties_checked'] += 1
                results['thirtylines']['total_checks'] += val_result['passed'] + val_result['failed']
                results['thirtylines']['failed_checks'] += val_result['failed']
                
                # Calculate and store quality score
                self._calculate_quality_score(prop_id, 'thirtylines', target_date_ga4, val_result)
        
        # Calculate overall quality scores
        for source in ['ga4', 'gsc', 'psi', 'gbp_reviews', 'gbp_insights', 'gtmetrix', 'thirtylines']:
            if results[source]['total_checks'] > 0:
                passed = results[source]['total_checks'] - results[source]['failed_checks']
                results[source]['quality_score'] = int((passed / results[source]['total_checks']) * 100)
        
        conn.close()
        
        return results
    
    def _run_validation(self, cursor, rule: Dict, property_id: str, metric_date: date, data: Dict) -> Dict:
        """Run a single validation rule."""
        passed = self._evaluate_sql(data, rule['validation_sql'])
        
        return {
            'rule_id': rule['rule_id'],
            'rule_name': rule['rule_name'],
            'passed': passed,
            'severity': rule['severity'],
            'metric_value': str(data.get(rule['metric_name'])),
            'expected_value': rule['description'],
            'failure_reason': None if passed else f"{rule['metric_name']} failed validation"
        }
    
    def _evaluate_sql(self, data: Dict, sql_expr: str) -> bool:
        """Evaluate a SQL expression against data."""
        try:
            # Create namespace with actual column names
            namespace = {}
            for key, value in data.items():
                namespace[key] = value if value is not None else 0
            
            # Simplify SQL syntax for Python
            expr = sql_expr
            expr = expr.replace(' AND ', ' and ').replace(' OR ', ' or ')
            # Convert SQL = to Python == (but not <=, >=, !=)
            import re
            expr = re.sub(r'(?<![<>!])\s*=\s*(?!=)', ' == ', expr)
            expr = expr.replace('NULLIF(', 'max(').replace('ABS(', 'abs(')
            expr = expr.replace(' CAST(', ' float(').replace(' AS REAL)', ')')
            
            # Evaluate with namespace
            result = eval(expr, {"__builtins__": {"abs": abs, "max": max, "float": float}}, namespace)
            return bool(result)
        except Exception as e:
            # Return False for evaluation errors
            return False
    
    def _log_check(self, cursor, check_result: Dict, property_id: str, data_source: str, metric_date: date):
        """Log check result to database."""
        cursor.execute("""
            INSERT INTO data_quality_checks (
                rule_id, property_id, data_source, metric_date,
                passed, metric_value, expected_value, severity, failure_reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            check_result['rule_id'],
            property_id,
            data_source,
            metric_date,
            1 if check_result['passed'] else 0,
            check_result['metric_value'],
            check_result['expected_value'],
            check_result['severity'],
            check_result['failure_reason']
        ))
    
    def _calculate_quality_score(self, property_id: str, data_source: str, metric_date: date, val_result: Dict):
        """Calculate and store quality score with GA4-specific weighting."""
        total = val_result['passed'] + val_result['failed']
        
        if total == 0:
            quality_score = 100  # No checks = assume healthy
        elif data_source == 'ga4':
            # GA4-Specific Scoring Algorithm
            # Category A (HARD): error severity - 20 points each
            # Category B (SOFT): warning severity - 5 points each
            # Category C (INFO): info severity - 0 points
            
            hard_failures = sum(1 for check in val_result['checks'] 
                               if not check['passed'] and check['severity'] == 'error')
            soft_failures = sum(1 for check in val_result['checks'] 
                               if not check['passed'] and check['severity'] == 'warning')
            info_failures = sum(1 for check in val_result['checks'] 
                               if not check['passed'] and check['severity'] == 'info')
            
            # Start at 100
            quality_score = 100
            
            # Hard failures: -20 points each (max penalty: -100)
            quality_score -= hard_failures * 20
            
            # Soft failures: -5 points each (max penalty: -40)
            soft_penalty = min(soft_failures * 5, 40)
            quality_score -= soft_penalty
            
            # Floor at 0
            quality_score = max(quality_score, 0)
            
        else:
            # Standard scoring for non-GA4 sources
            quality_score = int((val_result['passed'] / total) * 100)
        
        critical_failures = sum(1 for check in val_result['checks'] 
                               if not check['passed'] and check['severity'] in ['error', 'critical'])
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT OR REPLACE INTO data_quality_scores (
                property_id, data_source, metric_date,
                quality_score, total_checks, checks_passed, checks_failed, critical_failures
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            property_id, data_source, metric_date,
            quality_score, total, val_result['passed'], val_result['failed'], critical_failures
        ))
        
        conn.commit()
        conn.close()
