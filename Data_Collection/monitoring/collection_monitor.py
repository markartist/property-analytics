"""
Collection Monitoring Utility

Provides real-time tracking and logging for data collection operations.
Used by all collectors to log performance, errors, and metadata.
"""

import sqlite3
import time
import traceback
import json
from datetime import datetime
from pathlib import Path
from contextlib import contextmanager


class CollectionMonitor:
    """Monitor and log collection operations with detailed metrics."""

    def __init__(self, db_path, collection_id, data_source):
        """
        Initialize collection monitor.

        Args:
            db_path: Path to portfolio_analytics.db
            collection_id: ID from data_collections table
            data_source: Source name (ga4, gsc, psi, etc.)
        """
        self.db_path = db_path
        self.collection_id = collection_id
        self.data_source = data_source
        self.stats = {
            'api_calls_total': 0,
            'api_calls_failed': 0,
            'rate_limit_hits': 0,
            'retry_attempts': 0,
            'response_times': []
        }

    @contextmanager
    def track_property(self, property_id):
        """
        Context manager to track individual property collection.

        Usage:
            with monitor.track_property('12345') as tracker:
                # collect data
                tracker.record_api_call(200, 150)  # status_code, response_time_ms
        """
        tracker = PropertyTracker(
            self.db_path,
            self.collection_id,
            property_id,
            self.data_source,
            self
        )

        try:
            yield tracker
            tracker.complete(status='success')
        except Exception as e:
            tracker.complete(status='failed', error=str(e))
            raise

    def record_api_call(self, status_code, response_time_ms, success=True):
        """Record an API call."""
        self.stats['api_calls_total'] += 1
        self.stats['response_times'].append(response_time_ms)

        if not success or status_code >= 400:
            self.stats['api_calls_failed'] += 1

        if status_code == 429:
            self.stats['rate_limit_hits'] += 1

    def record_retry(self):
        """Record a retry attempt."""
        self.stats['retry_attempts'] += 1

    def log_error(self, property_id, error_type, error_message,
                  error_code=None, stack_trace=None, api_response=None, retry_count=0):
        """
        Log a detailed error to collection_errors table.

        Args:
            property_id: Property ID where error occurred
            error_type: Type (api_error, timeout, auth_failure, rate_limit, validation_error)
            error_message: Human-readable error message
            error_code: HTTP status or API error code
            stack_trace: Full stack trace
            api_response: Raw API response
            retry_count: Number of retry attempts
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO collection_errors (
                collection_id, property_id, data_source, error_type,
                error_code, error_message, stack_trace, api_response, retry_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            self.collection_id, property_id, self.data_source, error_type,
            error_code, error_message, stack_trace, api_response, retry_count
        ))

        conn.commit()
        conn.close()

    def finalize(self, started_at, completed_at):
        """
        Update data_collections table with final stats.

        Args:
            started_at: Collection start timestamp
            completed_at: Collection completion timestamp
        """
        duration = (completed_at - started_at).total_seconds()
        avg_response_time = (
            sum(self.stats['response_times']) / len(self.stats['response_times'])
            if self.stats['response_times'] else 0
        )

        metadata = json.dumps({
            'response_time_p50': sorted(self.stats['response_times'])[len(self.stats['response_times'])//2] if self.stats['response_times'] else 0,
            'response_time_p95': sorted(self.stats['response_times'])[int(len(self.stats['response_times'])*0.95)] if self.stats['response_times'] else 0,
        })

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE data_collections
            SET duration_seconds = ?,
                api_calls_total = ?,
                api_calls_failed = ?,
                rate_limit_hits = ?,
                retry_attempts = ?,
                avg_response_time_ms = ?,
                collection_metadata = ?
            WHERE collection_id = ?
        """, (
            duration,
            self.stats['api_calls_total'],
            self.stats['api_calls_failed'],
            self.stats['rate_limit_hits'],
            self.stats['retry_attempts'],
            avg_response_time,
            metadata,
            self.collection_id
        ))

        conn.commit()
        conn.close()


class PropertyTracker:
    """Tracks collection for a single property."""

    def __init__(self, db_path, collection_id, property_id, data_source, parent_monitor):
        self.db_path = db_path
        self.collection_id = collection_id
        self.property_id = property_id
        self.data_source = data_source
        self.parent_monitor = parent_monitor
        self.started_at = datetime.now()
        self.api_calls = 0
        self.records_collected = 0
        self.perf_id = None
        self.outcome_status = None
        self.outcome_error = None

        # Create performance record
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO collection_performance (
                collection_id, property_id, data_source, started_at, status
            ) VALUES (?, ?, ?, ?, 'in_progress')
        """, (collection_id, property_id, data_source, self.started_at))
        self.perf_id = cursor.lastrowid
        conn.commit()
        conn.close()

    def record_api_call(self, status_code, response_time_ms, success=True):
        """Record an API call for this property."""
        self.api_calls += 1
        self.parent_monitor.record_api_call(status_code, response_time_ms, success)

    def record_data(self, records_count):
        """Record how many records were collected."""
        self.records_collected += records_count

    def set_outcome(self, status='success', error=None):
        """Explicitly override the final property outcome."""
        self.outcome_status = status
        self.outcome_error = error

    def complete(self, status='success', error=None):
        """Mark property collection as complete."""
        completed_at = datetime.now()
        duration = (completed_at - self.started_at).total_seconds()
        status = self.outcome_status or status
        error = self.outcome_error if self.outcome_error is not None else error

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE collection_performance
            SET completed_at = ?,
                duration_seconds = ?,
                api_calls = ?,
                records_collected = ?,
                status = ?,
                error_summary = ?
            WHERE perf_id = ?
        """, (completed_at, duration, self.api_calls, self.records_collected,
              status, error, self.perf_id))
        conn.commit()
        conn.close()


class CollectionAlerter:
    """Send real-time alerts for collection failures."""

    def __init__(self, db_path):
        self.db_path = db_path

    def check_and_alert(self, collection_id, data_source):
        """
        Check for errors and send immediate alert if needed.

        Returns:
            bool: True if alert was sent
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Get unresolved errors from this collection
        cursor.execute("""
            SELECT COUNT(*), GROUP_CONCAT(DISTINCT error_type)
            FROM collection_errors
            WHERE collection_id = ? AND resolved = 0
        """, (collection_id,))

        error_count, error_types = cursor.fetchone()

        if error_count > 0:
            # Get failed properties
            cursor.execute("""
                SELECT DISTINCT property_id, error_type, error_message
                FROM collection_errors
                WHERE collection_id = ? AND resolved = 0
                LIMIT 10
            """, (collection_id,))

            failed_properties = cursor.fetchall()
            conn.close()

            # Send immediate alert
            self._send_alert(data_source, error_count, error_types, failed_properties)
            return True

        conn.close()
        return False

    def _send_alert(self, data_source, error_count, error_types, failed_properties):
        """Send immediate alert email."""
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent.parent))
        from Data_Collection.utils.email_sender import EmailSender

        subject = f"🔴 IMMEDIATE: {data_source.upper()} Collection Failures ({error_count} errors)"

        props_list = "\n".join([
            f"  • {prop_id}: {error_type} - {msg[:100]}"
            for prop_id, error_type, msg in failed_properties
        ])

        body = f"""⚠️ Real-time Collection Alert

Data Source: {data_source.upper()}
Error Count: {error_count}
Error Types: {error_types}
Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Failed Properties:
{props_list}

Action Required: Check collector logs and resolve issues before daily verification.

Database: {self.db_path}
"""

        try:
            email_sender = EmailSender(verbose=False)
            email_sender.send_email(
                to_address='mlaufhutte@venterraliving.com',
                subject=subject,
                body=body
            )
            print(f"✅ Immediate alert sent for {error_count} {data_source} errors")
        except Exception as e:
            print(f"❌ Failed to send immediate alert: {e}")
