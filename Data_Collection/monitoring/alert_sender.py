#!/usr/bin/env python3
"""
Data Collection Alert Email System
===================================
Sends email alerts for missing or stale data in portfolio analytics.

Usage:
    python3 send_data_alerts.py [--test]
"""

from __future__ import annotations

import sys
import os
import json
import sqlite3
import subprocess
import re
import html
import importlib.util
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict
from urllib.parse import urlparse

# Import from unified structure
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from Data_Collection.collectors.guest_card_collector import GuestCardCollector
from Data_Collection.utils.bi_manual_ingest import get_pending_bi_workbooks
from Data_Collection.utils.daily_collection_closure import (
    MANUAL_DEPENDENCY_SOURCES,
    evaluate_daily_collection_closure,
    reconcile_completed_source_retry_markers,
)
from Data_Collection.utils.source_freshness_policy import (
    evaluate_source_freshness,
    is_guest_card_harvest_suspended,
    latest_recorded_date_for_source,
)
from Data_Collection.utils.gsc_indexing_actions import load_latest_indexing_action_summary
from Data_Collection.utils.email_sender import EmailSender
from apps.api.scripts.wrangler_auth import build_runtime_env as build_wrangler_runtime_env
from utils.pib_email_shell import wrap_pib_light_email


class DataAlertEmailer:
    """Sends email alerts for data collection issues."""

    def __init__(self, test_mode=False):
        self.test_mode = test_mode
        self.base_dir = Path(__file__).parent.parent.parent  # Property_Analytics root
        self.db_path = self.base_dir / 'data' / 'portfolio_analytics.db'
        self.registry_path = self.base_dir / 'config' / 'venterra_properties_official.json'
        self.mirror_report_dir = self.base_dir / 'apps' / 'api' / 'scripts' / 'generated'

        # Load property registry
        with open(self.registry_path) as f:
            registry = json.load(f)
            self.properties = {p.get('ga4_property_id', p['name']): p['name']
                             for p in registry['properties']}
            self._registry_properties = registry['properties']

        self.recipient = 'mlaufhutte@venterraliving.com'
        backup = os.getenv("EMAIL_BACKUP_RECIPIENT", "").strip()
        self.recipients = [self.recipient] + ([backup] if backup and backup != self.recipient else [])
        self.delivery_log_dir = self.base_dir / 'logs' / 'email_delivery'
        self.alert_snapshot_dir = self.base_dir / 'logs' / 'monitoring_alert_snapshots'
        self.prelaunch_property_names = set()
        self.prelaunch_gsc_urls = set()
        self.prelaunch_ga4_property_ids = set()
        self.core_failure_sources = {
            'ga4', 'gsc', 'google_ads', 'guest_card', 'unit_availability', 'd1_mirror'
        }
        self.gsc_property_lookup = {}
        self._load_prelaunch_registry_filters()
        self._build_gsc_property_lookup()

        # Create unified email sender
        if not test_mode:
            self.email_sender = EmailSender(verbose=False)

        if test_mode:
            print("🧪 TEST MODE: Email preview only (no actual send)")

    def _latest_guest_card_date(self) -> str | None:
        conn = sqlite3.connect(self.db_path)
        try:
            cursor = conn.cursor()
            row = cursor.execute("SELECT MAX(run_date) FROM guest_card_metrics").fetchone()
            return row[0] if row and row[0] else None
        except sqlite3.OperationalError:
            return None
        finally:
            conn.close()

    def _pending_guest_card_files(self) -> list[Path]:
        collector = GuestCardCollector(db_path=self.db_path)
        return collector.get_pending_files()

    def _pending_bi_workbooks(self) -> list[Path]:
        return get_pending_bi_workbooks(db_path=self.db_path)

    def _current_closure(self):
        try:
            return evaluate_daily_collection_closure(self.db_path)
        except Exception:
            return None

    def _preflight_reconcile_collection_state(self):
        if self.test_mode:
            return []
        try:
            return reconcile_completed_source_retry_markers(self.db_path)
        except Exception as exc:
            return [{
                "source": "collection_closure",
                "action": "preflight_reconcile_failed",
                "error": str(exc)[:300],
            }]

    def _failure_item_count(self, collection_failures, *, include_manual_dependency=False):
        count = 0
        for failures in (collection_failures or {}).values():
            for item in failures:
                is_manual = item.get('classification') == 'manual_dependency'
                if include_manual_dependency or not is_manual:
                    count += 1
        return count

    def _manual_dependency_count(self, collection_failures):
        return sum(
            1
            for failures in (collection_failures or {}).values()
            for item in failures
            if item.get('classification') == 'manual_dependency'
        )

    def _write_alert_snapshot(self, *, closure, collection_failures, issues, indexation_warnings, indexing_action_summary, remediation_actions):
        self.alert_snapshot_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        payload = {
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "closure": closure or {},
            "collection_failures": collection_failures or {},
            "issues": issues or {},
            "cross_source_diagnostics": self._cross_source_diagnostics(issues or {}),
            "indexation_warnings": indexation_warnings or [],
            "indexing_action_summary": indexing_action_summary or {},
            "remediation_actions": remediation_actions or [],
            "runtime_health": self._runtime_health_snapshot(),
        }
        path = self.alert_snapshot_dir / f"alert_snapshot_{timestamp}.json"
        path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
        return path

    def _runtime_health_snapshot(self):
        import_checks = {}
        for module_name in ("pypdf", "requests", "yaml", "google.analytics.data_v1beta"):
            import_checks[module_name] = importlib.util.find_spec(module_name) is not None
        db_present = self.db_path.exists()
        return {
            "python_executable": sys.executable,
            "python_version": sys.version.split()[0],
            "python3_on_path": shutil.which("python3"),
            "keeper_runtime_ready": os.getenv("PA_KEEPER_RUNTIME_READY") == "1",
            "db_path": str(self.db_path),
            "db_present": db_present,
            "db_parent_writable": os.access(self.db_path.parent, os.W_OK),
            "imports": import_checks,
        }

    def _cross_source_diagnostics(self, issues):
        ga4_problem_names = {
            str(prop_name)
            for bucket in ("missing", "stale")
            for prop_name, _ in (issues.get("ga4", {}).get(bucket, []) if issues else [])
        }
        if not ga4_problem_names:
            return []

        conn = sqlite3.connect(self.db_path)
        try:
            rows = conn.execute(
                """
                SELECT gsc_site_url, MAX(metric_date) AS latest_date
                FROM gsc_daily_metrics
                GROUP BY gsc_site_url
                """
            ).fetchall()
        finally:
            conn.close()

        latest_by_gsc = {
            self._normalize_url_key(str(url or "")): str(latest or "")
            for url, latest in rows
            if url and latest
        }
        gsc_expected = (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d')
        diagnostics = []
        for prop in self._registry_properties:
            prop_name = str(prop.get("name") or "")
            if prop_name not in ga4_problem_names:
                continue
            gsc_url = str(prop.get("gsc_url") or "").strip()
            latest_gsc = latest_by_gsc.get(self._normalize_url_key(gsc_url))
            if latest_gsc and latest_gsc >= gsc_expected:
                diagnostics.append({
                    "property": prop_name,
                    "type": "ga4_tracking_gap",
                    "message": (
                        f"GA4 is stale/missing while GSC is current through {latest_gsc} "
                        f"for {gsc_url}; verify live-site GA4 measurement/property wiring."
                    ),
                })
        return diagnostics

    def _unresolved_core_sources(self) -> dict[str, dict]:
        closure = self._current_closure() or {}
        unresolved = {}
        for item in (closure.get('unresolved_sources') or []):
            source = str(item.get('source') or '').strip().lower()
            if source:
                unresolved[source] = item
        return unresolved

    def _is_actionable_unresolved_source(self, source: str, item: dict) -> bool:
        normalized = (source or '').strip().lower()
        if normalized == 'guest_card':
            if self._pending_guest_card_files():
                return True
            expectation = evaluate_source_freshness('guest_cards', self._latest_guest_card_date())
            return expectation.status not in {'fresh', 'warning'}
        return True

    def attempt_auto_remediation(self, collection_failures=None):
        """
        Safely self-heal the most common integrity gap:
        restored guest card CSV backlog followed by a stale/failed D1 mirror.
        """
        actions = []
        if self.test_mode:
            return actions

        if is_guest_card_harvest_suspended():
            mirror_failure = self.check_d1_mirror_failure()
            if mirror_failure is not None:
                print("🛠️  Auto-remediation: running D1 mirror sync...")
                d1_script = self.base_dir / 'apps' / 'api' / 'scripts' / 'd1_mirror_sync.py'
                result = subprocess.run(
                    [sys.executable, str(d1_script)],
                    capture_output=True,
                    text=True,
                    timeout=2700,
                    env=build_wrangler_runtime_env(),
                )
                tail_source = (result.stdout or "") + ("\n" + result.stderr if result.stderr else "")
                actions.append({
                    'action': 'd1_mirror_sync',
                    'ok': result.returncode == 0,
                    'details': tail_source.strip()[-500:] or f"exit={result.returncode}",
                })
            actions.append({
                'action': 'guest_card_harvest_suspended',
                'ok': True,
                'details': 'Guest card harvest is intentionally suspended.',
            })
            return actions

        pending_files = self._pending_guest_card_files()
        latest_guest_card_date = self._latest_guest_card_date()
        guest_card_expectation = evaluate_source_freshness('guest_cards', latest_guest_card_date)
        guest_card_stale = guest_card_expectation.status == 'stale'

        guest_card_ingested = False
        if pending_files and guest_card_stale:
            print("🛠️  Auto-remediation: ingesting pending guest card CSV backlog...")
            collector = GuestCardCollector(db_path=self.db_path)
            result = collector.ingest_pending_files(collection_id=None)
            guest_card_ingested = result.files_processed > 0
            actions.append({
                'action': 'guest_card_ingest',
                'ok': result.files_failed == 0,
                'details': (
                    f"files_found={result.files_found}, files_processed={result.files_processed}, "
                    f"files_failed={result.files_failed}, rows_upserted={result.rows_upserted}"
                ),
            })

        mirror_failure = self.check_d1_mirror_failure()
        should_retry_mirror = guest_card_ingested or mirror_failure is not None
        if should_retry_mirror:
            print("🛠️  Auto-remediation: running D1 mirror sync...")
            d1_script = self.base_dir / 'apps' / 'api' / 'scripts' / 'd1_mirror_sync.py'
            result = subprocess.run(
                [sys.executable, str(d1_script)],
                capture_output=True,
                text=True,
                timeout=2700,
                env=build_wrangler_runtime_env(),
            )
            tail_source = (result.stdout or "") + ("\n" + result.stderr if result.stderr else "")
            actions.append({
                'action': 'd1_mirror_sync',
                'ok': result.returncode == 0,
                'details': tail_source.strip()[-500:] or f"exit={result.returncode}",
            })

        return actions

    def _load_prelaunch_registry_filters(self) -> None:
        """Build non-blocking filters for prelaunch/non-live properties."""
        lifecycle_tokens = (
            'prelaunch',
            'pre-launch',
            'coming soon',
            'not live',
            'lease up',
            'lease-up',
            'under construction',
            'future',
        )
        for prop in self._registry_properties:
            lifecycle = " ".join(
                [
                    str(prop.get('lifecycle') or ''),
                    str(prop.get('operational_status') or ''),
                    str(prop.get('status') or ''),
                ]
            ).lower()
            if any(token in lifecycle for token in lifecycle_tokens):
                name = (prop.get('name') or '').strip()
                if name:
                    self.prelaunch_property_names.add(name.lower())
                ga4_property_id = str(prop.get('ga4_property_id') or '').strip()
                if ga4_property_id:
                    self.prelaunch_ga4_property_ids.add(ga4_property_id)
                gsc_url = (prop.get('gsc_url') or '').strip()
                if gsc_url:
                    self.prelaunch_gsc_urls.add(gsc_url.rstrip('/').lower())

    @staticmethod
    def _normalize_url_key(url: str) -> str:
        raw = (url or '').strip()
        if not raw:
            return ''
        if raw.startswith('sc-domain:'):
            return raw.rstrip('/').lower()
        parsed = urlparse(raw)
        if parsed.scheme and parsed.netloc:
            path = parsed.path.rstrip('/')
            return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}{path}/" if path else f"{parsed.scheme.lower()}://{parsed.netloc.lower()}/"
        return raw.rstrip('/').lower()

    @staticmethod
    def _slugify(value: str) -> str:
        text = (value or '').strip().lower()
        text = re.sub(r'[^a-z0-9]+', '-', text).strip('-')
        return text

    def _build_gsc_property_lookup(self) -> None:
        lookup = {}
        for prop in self._registry_properties:
            name = (prop.get('name') or '').strip()
            if not name:
                continue
            for key in (
                prop.get('gsc_url'),
                prop.get('full_url'),
                f"https://venterraliving.com/apartments/{prop.get('url_slug', '').strip('/')}/" if prop.get('url_slug') else None,
                f"sc-domain:{prop.get('domain')}" if prop.get('domain') else None,
            ):
                normalized = self._normalize_url_key(str(key or ''))
                if normalized:
                    lookup[normalized] = name
            url_slug = self._slugify(prop.get('url_slug') or name)
            if url_slug:
                lookup[f"slug:{url_slug}"] = name
        self.gsc_property_lookup = lookup

    def _resolve_gsc_property_name(self, url: str) -> str:
        normalized = self._normalize_url_key(url)
        if normalized in self.prelaunch_gsc_urls:
            return ''

        prop_name = self.gsc_property_lookup.get(normalized)
        if prop_name:
            return prop_name

        parsed = urlparse(url)
        path_bits = [bit for bit in parsed.path.split('/') if bit]
        if len(path_bits) >= 2 and path_bits[0] == 'apartments':
            slug = self._slugify(path_bits[1])
            prop_name = self.gsc_property_lookup.get(f"slug:{slug}")
            if prop_name:
                return prop_name

        # Historical GSC sites that no longer resolve through the governed registry
        # should not page forever as stale current-property coverage.
        return ''

    def _is_prelaunch_gsc_issue(self, source: str, error_message: str) -> bool:
        """Return True when a GSC/GSC inspection failure references prelaunch property/url."""
        source_l = (source or '').lower()
        if 'gsc' not in source_l:
            return False
        text = (error_message or '').lower()
        if not text:
            return False
        if any(name in text for name in self.prelaunch_property_names):
            return True
        if any(url in text for url in self.prelaunch_gsc_urls):
            return True
        return False

    def check_collection_failures(self):
        """
        Check if recent collection jobs failed.

        Returns:
            dict: Collection failures by source
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Check for collection job failures in last 3 days
        three_days_ago = (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d')

        failures = {}

        try:
            # Check only the latest run per source inside the lookback window.
            # Older failed/partial rows should not keep paging operators once a newer
            # clean run for that source has already landed.
            cursor.execute("""
                WITH ranked_runs AS (
                    SELECT
                        data_source,
                        started_at,
                        status,
                        error_message,
                        properties_total,
                        properties_failed,
                        notes,
                        ROW_NUMBER() OVER (
                            PARTITION BY data_source
                            ORDER BY started_at DESC, collection_id DESC
                        ) AS row_rank
                    FROM data_collections
                    WHERE DATE(started_at) >= ?
                )
                SELECT
                    data_source,
                    started_at,
                    status,
                    error_message,
                    properties_total,
                    properties_failed,
                    notes
                FROM ranked_runs
                WHERE row_rank = 1
                  AND (
                    status IN ('failed', 'blocked', 'retry_scheduled', 'source_limited')
                    OR properties_failed > properties_total * 0.2
                  )
                ORDER BY started_at DESC
            """, (three_days_ago,))

            for row in cursor.fetchall():
                source, started, status, error, total, failed, notes = row
                source_l = (source or '').lower()
                # URL Inspection is advisory and can fail on non-indexed/prelaunch URLs.
                # Keep it out of collection-system critical failure classification.
                if source_l == 'gsc_url_inspection':
                    continue
                if source_l == 'semrush':
                    continue
                if source_l == 'bi_report' and not self._pending_bi_workbooks():
                    continue
                if self._is_prelaunch_gsc_issue(source, f"{error or ''} {notes or ''}"):
                    continue
                classification = 'collection_failure'
                tier = 'core' if source_l in self.core_failure_sources else 'specialty'
                if source_l in MANUAL_DEPENDENCY_SOURCES and str(status or '').lower() == 'blocked' and int(failed or 0) == 0:
                    classification = 'manual_dependency'
                    tier = 'manual_dependency'

                if source not in failures:
                    failures[source] = []

                failures[source].append({
                    'timestamp': started,
                    'status': status,
                    'error': error,
                    'properties_total': total,
                    'properties_failed': failed,
                    'tier': tier,
                    'classification': classification,
                })
        except sqlite3.OperationalError:
            # Table might not exist in older databases
            pass

        conn.close()

        mirror_failure = self.check_d1_mirror_failure()
        if mirror_failure:
            failures.setdefault('d1_mirror', []).append(mirror_failure)

        unresolved_sources = self._unresolved_core_sources()
        closure = self._current_closure() or {}
        for source, item in unresolved_sources.items():
            if not self._is_actionable_unresolved_source(source, item):
                continue
            if source in failures:
                continue
            failures.setdefault(source, []).append({
                'timestamp': closure.get('target_date') or datetime.now().strftime('%Y-%m-%d'),
                'status': item.get('status') or 'unresolved',
                'error': f"Closure unresolved: {item.get('reason') or 'source_not_closed'}",
                'properties_total': 0,
                'properties_failed': 0,
                'tier': 'manual_dependency' if item.get('reason') == 'manual_dependency' else ('core' if source in self.core_failure_sources else 'specialty'),
                'classification': 'manual_dependency' if item.get('reason') == 'manual_dependency' else 'collection_failure',
            })
        return failures

    def summarize_failure_tiers(self, collection_failures):
        core_sources = 0
        specialty_sources = 0
        for failures in (collection_failures or {}).values():
            active_failures = [item for item in failures if item.get('classification') != 'manual_dependency']
            if not active_failures:
                continue
            if any((item.get('tier') == 'core') for item in active_failures):
                core_sources += 1
            else:
                specialty_sources += 1
        return core_sources, specialty_sources

    def check_d1_mirror_failure(self):
        """Check the latest D1 mirror audit report for a failed or stale mirror."""
        report_files = sorted(
            self.mirror_report_dir.glob('d1_mirror_report_*.json'),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        if not report_files:
            return {
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'status': 'failed',
                'error': 'No D1 mirror report found',
                'properties_total': 1,
                'properties_failed': 1,
            }

        parsed_reports = []
        unreadable_latest = report_files[0]
        for report_path in report_files:
            try:
                payload = json.loads(report_path.read_text())
            except (OSError, json.JSONDecodeError):
                continue
            parsed_reports.append((report_path, payload))

        if not parsed_reports:
            return {
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'status': 'failed',
                'error': f'Latest D1 mirror report unreadable: {unreadable_latest.name}',
                'properties_total': 1,
                'properties_failed': 1,
            }

        latest, payload = parsed_reports[0]
        latest_finished = str(payload.get('finished_at_utc') or '')
        latest_day = latest_finished[:10] if latest_finished else ''
        if not latest_day:
            parts = latest.stem.split('_')
            if len(parts) >= 4 and len(parts[3]) == 8:
                latest_day = f"{parts[3][:4]}-{parts[3][4:6]}-{parts[3][6:8]}"

        if latest_day:
            same_day_success = next(
                (
                    (candidate_path, candidate_payload)
                    for candidate_path, candidate_payload in parsed_reports
                    if bool(candidate_payload.get('success'))
                    and (
                        str(candidate_payload.get('finished_at_utc') or '').startswith(latest_day)
                        or candidate_path.stem.startswith(f"d1_mirror_report_{latest_day.replace('-', '')}")
                    )
                ),
                None,
            )
            if same_day_success is not None:
                latest, payload = same_day_success

        started_at = payload.get('started_at_utc') or payload.get('finished_at_utc') or latest.stem
        if payload.get('core_success', payload.get('success')):
            return None

        failing_steps = [
            f"{step.get('name')}: {step.get('details')}"
            for step in payload.get('core_failures', [])
        ]
        if not failing_steps:
            failing_steps = [
                f"{step.get('name')}: {step.get('details')}"
                for step in payload.get('steps', [])
                if not step.get('ok')
                and step.get('name') not in {'captain_sources_to_d1.py'}
            ]
        if not failing_steps and not payload.get('core_success', payload.get('success')):
            failing_steps = [
                f"{step.get('name')}: {step.get('details')}"
                for step in payload.get('steps', [])
                if not step.get('ok')
            ]
        error = '; '.join(failing_steps) if failing_steps else 'D1 mirror reported failure'
        return {
            'timestamp': started_at,
            'status': 'failed',
            'error': error,
            'properties_total': 1,
            'properties_failed': 1,
            'tier': 'core',
        }

    def check_data_freshness(self):
        """
        Check data freshness for all collectors.

        Returns:
            dict: Issues found by data source
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        unresolved_sources = self._unresolved_core_sources()

        yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        two_days_ago = (datetime.now() - timedelta(days=2)).strftime('%Y-%m-%d')

        # GSC has 3-day data delay (confirmed by API testing), so expect data from 3 days ago
        gsc_expected = (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d')
        gsc_stale_threshold = (datetime.now() - timedelta(days=5)).strftime('%Y-%m-%d')

        issues = {
            'ga4': {'missing': [], 'stale': []},
            'gsc': {'missing': [], 'stale': []},
            'google_ads': {'missing': [], 'stale': []},
            'psi': {'missing': [], 'stale': []},
            'dataforseo': {'missing': [], 'stale': []},
            'gbp_reviews': {'missing': [], 'stale': []},
            'gbp_insights': {'missing': [], 'stale': []},
        }

        # Check GA4 data
        cursor.execute("""
            SELECT property_id, MAX(metric_date) as last_date
            FROM ga4_daily_metrics
            GROUP BY property_id
        """)
        ga4_data = {row[0]: row[1] for row in cursor.fetchall()}

        for prop_id, prop_name in self.properties.items():
            if 'ga4' in unresolved_sources:
                break
            if str(prop_id).strip() in self.prelaunch_ga4_property_ids or prop_name.lower() in self.prelaunch_property_names:
                continue
            if prop_id in ga4_data:
                last_date = ga4_data[prop_id]
                if last_date < yesterday:
                    if last_date < two_days_ago:
                        issues['ga4']['stale'].append((prop_name, last_date))
                    else:
                        issues['ga4']['missing'].append((prop_name, last_date))
            else:
                issues['ga4']['missing'].append((prop_name, 'Never'))

        # Check GSC data - map URLs to property names from registry
        cursor.execute("""
            SELECT gsc_site_url, MAX(metric_date) as last_date
            FROM gsc_daily_metrics
            GROUP BY gsc_site_url
        """)
        gsc_data = cursor.fetchall()
        gsc_latest_by_property = {}
        for url, last_date in gsc_data:
            prop_name = self._resolve_gsc_property_name(url)
            if not prop_name or prop_name.lower() in self.prelaunch_property_names:
                continue
            current = gsc_latest_by_property.get(prop_name)
            if current is None or str(last_date) > str(current):
                gsc_latest_by_property[prop_name] = last_date

        if 'gsc' not in unresolved_sources:
            for prop_name, last_date in gsc_latest_by_property.items():
            # GSC has a confirmed 3-day lag, so only flag if older than the expected availability window.
                if last_date < gsc_expected:
                    if last_date < gsc_stale_threshold:
                        issues['gsc']['stale'].append((prop_name, last_date))
                    else:
                        issues['gsc']['missing'].append((prop_name, last_date))

        # Check Google Ads freshness from canonical collection outcomes instead of raw row presence.
        # Many properties legitimately produce `no_activity` on a given day and should not be
        # treated as stale simply because no campaign rows were written for them.
        latest_ads_run = cursor.execute("""
            SELECT
                collection_date,
                status,
                properties_total,
                properties_success,
                properties_failed,
                properties_skipped,
                notes
            FROM data_collections
            WHERE data_source = 'google_ads'
            ORDER BY collection_date DESC, collection_id DESC
            LIMIT 1
        """).fetchone()
        if latest_ads_run:
            (
                ads_collection_date,
                ads_status,
                ads_total,
                ads_success,
                ads_failed,
                ads_skipped,
                ads_notes,
            ) = latest_ads_run
            ads_expected = evaluate_source_freshness('google_ads', ads_collection_date)
            ads_status_l = str(ads_status or '').lower()
            ads_total = int(ads_total or 0)
            ads_success = int(ads_success or 0)
            ads_failed = int(ads_failed or 0)
            ads_skipped = int(ads_skipped or 0)
            ads_accounted_for = ads_success + ads_failed + ads_skipped

            if ads_status_l in {'completed', 'partial', 'retry_scheduled'} and ads_failed == 0 and (
                ads_total == 0 or ads_accounted_for >= ads_total
            ):
                pass
            else:
                note_bits = [f"status={ads_status_l or 'unknown'}"]
                if ads_collection_date:
                    note_bits.append(f"collection_date={ads_collection_date}")
                if ads_total:
                    note_bits.append(
                        f"active={ads_success}, no_activity={ads_skipped}, failed={ads_failed}, total={ads_total}"
                    )
                if ads_notes:
                    note_bits.append(str(ads_notes)[:120])
                detail = " | ".join(note_bits)
                if ads_expected.status == 'stale':
                    issues['google_ads']['stale'].append(("Google Ads source", detail))
                else:
                    issues['google_ads']['missing'].append(("Google Ads source", detail))
        else:
            issues['google_ads']['missing'].append(("Google Ads source", "No collection run recorded"))

        psi_latest = latest_recorded_date_for_source(conn, 'psi')
        psi_expectation = evaluate_source_freshness('psi', psi_latest)
        if psi_expectation.status == 'stale':
            issues['psi']['stale'].append(("PSI source", psi_latest or 'Never'))
        elif psi_expectation.status == 'missing':
            issues['psi']['missing'].append(("PSI source", 'Never'))

        dataforseo_latest = latest_recorded_date_for_source(conn, 'dataforseo')
        dataforseo_expectation = evaluate_source_freshness('dataforseo', dataforseo_latest)
        if dataforseo_expectation.status == 'stale':
            issues['dataforseo']['stale'].append(("DataForSEO search intelligence", dataforseo_latest or 'Never'))
        elif dataforseo_expectation.status == 'missing':
            issues['dataforseo']['missing'].append(("DataForSEO search intelligence", 'Never'))

        gbp_reviews_latest = latest_recorded_date_for_source(conn, 'gbp_reviews')
        gbp_reviews_expectation = evaluate_source_freshness('gbp_reviews', gbp_reviews_latest)
        if gbp_reviews_expectation.status == 'stale':
            issues['gbp_reviews']['stale'].append(("GBP Reviews source", gbp_reviews_latest or 'Never'))
        elif gbp_reviews_expectation.status == 'missing':
            issues['gbp_reviews']['missing'].append(("GBP Reviews source", 'Never'))

        gbp_insights_latest = latest_recorded_date_for_source(conn, 'gbp_insights')
        gbp_insights_expectation = evaluate_source_freshness('gbp_insights', gbp_insights_latest)
        if gbp_insights_expectation.status == 'stale':
            issues['gbp_insights']['stale'].append(("GBP Insights source", gbp_insights_latest or 'Never'))
        elif gbp_insights_expectation.status == 'missing':
            issues['gbp_insights']['missing'].append(("GBP Insights source", 'Never'))

        conn.close()

        # Filter out issues with no problems
        issues = {k: v for k, v in issues.items()
                 if v['missing'] or v['stale']}

        return issues

    def check_gsc_indexation_warnings(self):
        """
        Identify true GSC URL Inspection indexation risk.

        This intentionally stays narrower than "any non-PASS URL" because Search
        Console often reports expected non-indexed states for redirects,
        alternate canonicals, specials pages, and other non-core URLs. Alert on
        business-risk states only: canonical property homepage not indexed, all
        sampled URLs for a property not indexed, or explicit robots/noindex
        signals on inspected URLs.
        """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            latest_row = conn.execute("SELECT MAX(inspection_date) AS d FROM gsc_url_inspection").fetchone()
            latest_date = latest_row["d"] if latest_row else None
            if not latest_date:
                return []

            reportable_by_id = {}
            for prop in self._registry_properties:
                name = (prop.get("name") or "").strip()
                ga4_id = str(prop.get("ga4_property_id") or "").strip()
                full_url = (prop.get("full_url") or "").strip()
                if not name or not ga4_id or not full_url:
                    continue
                if ga4_id in self.prelaunch_ga4_property_ids or name.lower() in self.prelaunch_property_names:
                    continue
                reportable_by_id[ga4_id] = {
                    "name": name,
                    "core_url": full_url.rstrip("/"),
                }

            rows = conn.execute(
                """
                SELECT
                    property_id,
                    gsc_site_url,
                    inspected_url,
                    verdict,
                    coverage_state,
                    indexing_state,
                    robots_txt_state,
                    google_canonical,
                    user_canonical
                FROM gsc_url_inspection
                WHERE inspection_date = ?
                ORDER BY property_id, inspected_url
                """,
                (latest_date,),
            ).fetchall()

            grouped = defaultdict(list)
            for row in rows:
                property_id = str(row["property_id"] or "").strip()
                if property_id in reportable_by_id:
                    grouped[property_id].append(row)

            warnings = []
            for property_id, prop_rows in grouped.items():
                prop = reportable_by_id[property_id]
                property_name = prop["name"]
                core_url = prop["core_url"]
                pass_count = sum(1 for row in prop_rows if str(row["verdict"] or "").upper() == "PASS")

                if prop_rows and pass_count == 0:
                    warnings.append({
                        "severity": "critical",
                        "property": property_name,
                        "url": core_url + "/",
                        "reason": "No inspected URLs for this property returned PASS.",
                        "inspection_date": latest_date,
                    })
                    continue

                for row in prop_rows:
                    inspected_url = str(row["inspected_url"] or "").rstrip("/")
                    verdict = str(row["verdict"] or "").upper()
                    coverage_state = str(row["coverage_state"] or "")
                    indexing_state = str(row["indexing_state"] or "")
                    robots_state = str(row["robots_txt_state"] or "")
                    state_text = " ".join([coverage_state, indexing_state, robots_state]).lower()
                    is_core_url = inspected_url == core_url

                    if is_core_url and verdict != "PASS":
                        warnings.append({
                            "severity": "critical",
                            "property": property_name,
                            "url": str(row["inspected_url"] or ""),
                            "reason": f"Canonical property URL returned {coverage_state or verdict or 'non-PASS'}.",
                            "inspection_date": latest_date,
                        })
                        continue

                    robots_blocked = robots_state and robots_state not in {"ALLOWED", "ROBOTS_TXT_STATE_UNSPECIFIED"}
                    explicit_noindex = "noindex" in state_text
                    if robots_blocked or explicit_noindex:
                        warnings.append({
                            "severity": "warning",
                            "property": property_name,
                            "url": str(row["inspected_url"] or ""),
                            "reason": (
                                f"Robots/indexing signal requires review: "
                                f"{coverage_state or 'coverage n/a'}; {indexing_state or 'indexing n/a'}; {robots_state or 'robots n/a'}."
                            ),
                            "inspection_date": latest_date,
                        })

            return warnings
        finally:
            conn.close()

    def check_gsc_indexing_action_summary(self):
        """Return the latest read-only daily GSC indexing action packet summary."""
        return load_latest_indexing_action_summary()

    def _build_indexing_action_html(self, indexing_action_summary=None):
        packet = indexing_action_summary or {}
        summary = packet.get("summary") or {}
        if not summary:
            return ""

        action_type_counts = summary.get("action_type_counts") or {}
        priority_counts = summary.get("priority_counts") or {}
        top_properties = summary.get("top_properties") or []
        action_rows = ""
        for action_type, count in sorted(action_type_counts.items(), key=lambda item: (-int(item[1]), item[0]))[:8]:
            action_rows += (
                f'<tr><td style="padding:8px;border:1px solid #e2e8f0;">{html.escape(str(action_type))}</td>'
                f'<td style="padding:8px;border:1px solid #e2e8f0;text-align:right;">{int(count)}</td></tr>'
            )
        if not action_rows:
            action_rows = '<tr><td style="padding:8px;border:1px solid #e2e8f0;" colspan="2">No actionable indexing follow-up.</td></tr>'

        priority_bits = ", ".join(f"{html.escape(str(k))}: {int(v)}" for k, v in sorted(priority_counts.items())) or "none"
        top_property_bits = ", ".join(f"{html.escape(str(name))} ({int(count)})" for name, count in top_properties[:5]) or "none"
        packet_path = html.escape(str(packet.get("latest_packet") or summary.get("packet_dir") or ""))

        return f"""
        <div style="margin-top:12px;padding:12px;border-left:4px solid #3B9189;background:#f6fffd;font-family:Arial, sans-serif;">
          <div style="font-size:16px;font-weight:700;color:#15284B;margin-bottom:6px;">GSC Indexing Action Queue</div>
          <div style="font-size:13px;color:#475569;margin-bottom:8px;line-height:1.45;">
            Inspection date: {html.escape(str(summary.get("inspection_date_human") or summary.get("inspection_date") or ""))}<br>
            Standard pages inspected: <strong>{int(summary.get("standard_pages_inspected") or 0)} / {int(summary.get("standard_page_targets") or 0)}</strong><br>
            Standard pages indexed: <strong>{int(summary.get("standard_pages_indexed") or 0)}</strong><br>
            Missing standard-page inspections: <strong>{int(summary.get("standard_pages_missing_inspection") or 0)}</strong><br>
            Actionable URLs: <strong>{int(summary.get("actionable_urls") or 0)}</strong> ({priority_bits})<br>
            Top properties: {top_property_bits}<br>
            Packet: <code>{packet_path}</code>
          </div>
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;font-size:13px;background:#ffffff;">
            <tr style="background:#f8fafc;">
              <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Action Type</th>
              <th style="padding:8px;border:1px solid #e2e8f0;text-align:right;">URLs</th>
            </tr>
            {action_rows}
          </table>
        </div>
        """

    def build_alert_html(self, issues, collection_failures=None, remediation_actions=None, indexation_warnings=None, indexing_action_summary=None):
        """Build HTML email body for data alerts."""
        indexation_warnings = indexation_warnings or []
        indexing_action_summary = indexing_action_summary or {}
        indexing_action_count = int((indexing_action_summary.get("summary") or {}).get("actionable_urls") or 0)
        total_missing = sum(len(v['missing']) for v in issues.values())
        total_stale = sum(len(v['stale']) for v in issues.values())
        collection_failure_count = self._failure_item_count(collection_failures)
        manual_dependency_count = self._manual_dependency_count(collection_failures)
        core_failure_sources, specialty_failure_sources = self.summarize_failure_tiers(collection_failures or {})
        indexation_warning_count = len(indexation_warnings)
        critical_indexation_count = sum(1 for item in indexation_warnings if item.get("severity") == "critical")

        if total_missing == 0 and total_stale == 0 and collection_failure_count == 0 and manual_dependency_count == 0 and indexation_warning_count == 0 and indexing_action_count == 0:
            return self._build_all_clear_html(indexing_action_summary=indexing_action_summary)

        if critical_indexation_count > 0 or core_failure_sources > 0 or total_missing > 10 or total_stale > 10:
            severity = "CRITICAL"
            severity_fg = "#991b1b"
            severity_bg = "#fee2e2"
        else:
            severity = "WARNING"
            severity_fg = "#92400e"
            severity_bg = "#fef3c7"

        summary_tiles = f"""
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;font-family:Arial, sans-serif;">
          <tr>
            <td style="width:25%;padding:12px;border:1px solid #e2e8f0;background:#f8fafc;">
              <div style="font-size:30px;font-weight:700;color:#15284B;">{collection_failure_count}</div>
              <div style="font-size:12px;color:#334155;">Collection Failures ({core_failure_sources} core / {specialty_failure_sources} specialty{f" / {manual_dependency_count} manual" if manual_dependency_count else ""})</div>
            </td>
            <td style="width:25%;padding:12px;border:1px solid #e2e8f0;background:#f8fafc;">
              <div style="font-size:30px;font-weight:700;color:#15284B;">{indexation_warning_count}</div>
              <div style="font-size:12px;color:#334155;">Core Indexation Warnings ({critical_indexation_count} critical)</div>
            </td>
            <td style="width:25%;padding:12px;border:1px solid #e2e8f0;background:#f8fafc;">
              <div style="font-size:30px;font-weight:700;color:#15284B;">{total_missing}</div>
              <div style="font-size:12px;color:#334155;">Missing Yesterday</div>
            </td>
            <td style="width:25%;padding:12px;border:1px solid #e2e8f0;background:#f8fafc;">
              <div style="font-size:30px;font-weight:700;color:#15284B;">{total_stale}</div>
              <div style="font-size:12px;color:#334155;">Stale (>2 days)</div>
            </td>
          </tr>
        </table>
        """

        source_names = {
            'ga4': 'Google Analytics 4',
            'gsc': 'Google Search Console',
            'google_ads': 'Google Ads',
            'psi': 'PageSpeed Insights',
            'dataforseo': 'DataForSEO Search Intelligence',
            'gbp_reviews': 'Google Business Profile Reviews',
            'gbp_insights': 'Google Business Profile Insights',
        }

        failures_html = ""
        if collection_failures:
            core_failures = {
                k: [item for item in v if item.get('tier') == 'core' and item.get('classification') != 'manual_dependency']
                for k, v in collection_failures.items()
            }
            specialty_failures = {
                k: [item for item in v if item.get('tier') == 'specialty' and item.get('classification') != 'manual_dependency']
                for k, v in collection_failures.items()
            }
            manual_dependency_waits = {
                k: [item for item in v if item.get('classification') == 'manual_dependency']
                for k, v in collection_failures.items()
            }
            core_failures = {k: v for k, v in core_failures.items() if v}
            specialty_failures = {k: v for k, v in specialty_failures.items() if v}
            manual_dependency_waits = {k: v for k, v in manual_dependency_waits.items() if v}
            active_failure_buckets = (("Core Pipeline", core_failures), ("Specialty / Sidecar Jobs", specialty_failures))
            if any(bucket for _, bucket in active_failure_buckets):
                failures_html += """
                <div style="margin-top:12px;padding:12px;border-left:4px solid #dc2626;background:#fff5f5;font-family:Arial, sans-serif;">
                  <div style="font-size:16px;font-weight:700;color:#15284B;margin-bottom:6px;">Collection Job Failures</div>
                """
                for section_title, bucket in active_failure_buckets:
                    if not bucket:
                        continue
                    failures_html += f'<div style="margin-top:10px;font-size:14px;font-weight:700;color:#7f1d1d;">{section_title}</div>'
                    for source, failures in bucket.items():
                        failures_html += f'<div style="margin-top:8px;font-size:13px;font-weight:700;color:#15284B;">{source.upper()}</div>'
                        for failure in failures:
                            timestamp = failure['timestamp']
                            status = failure['status']
                            error = failure['error'] or 'No error message'
                            total = failure['properties_total'] or 0
                            failed = failure['properties_failed'] or 0
                            failures_html += (
                                f'<div style="margin:6px 0;padding:8px;border:1px solid #fecaca;background:#ffffff;">'
                                f'<div style="font-size:12px;color:#6b7280;">{timestamp}</div>'
                                f'<div style="font-size:13px;color:#111827;"><strong>Status:</strong> {status} ({failed}/{total} failed)</div>'
                                f'<div style="font-size:12px;color:#475569;">{error[:220]}</div>'
                                '</div>'
                            )
                failures_html += "</div>"

            if manual_dependency_waits:
                failures_html += """
                <div style="margin-top:12px;padding:12px;border-left:4px solid #d97706;background:#fffbeb;font-family:Arial, sans-serif;">
                  <div style="font-size:16px;font-weight:700;color:#15284B;margin-bottom:6px;">Manual Dependency Waits</div>
                """
                for source, waits in manual_dependency_waits.items():
                    failures_html += f'<div style="margin-top:8px;font-size:13px;font-weight:700;color:#15284B;">{source.upper()}</div>'
                    for wait in waits:
                        timestamp = wait['timestamp']
                        status = wait['status']
                        error = wait['error'] or 'Waiting on manually supplied source material'
                        total = wait['properties_total'] or 0
                        failures_html += (
                            f'<div style="margin:6px 0;padding:8px;border:1px solid #fde68a;background:#ffffff;">'
                            f'<div style="font-size:12px;color:#6b7280;">{timestamp}</div>'
                            f'<div style="font-size:13px;color:#111827;"><strong>Status:</strong> {status} ({total} tracked item(s))</div>'
                            f'<div style="font-size:12px;color:#475569;">{error[:220]}</div>'
                            '</div>'
                        )
                failures_html += "</div>"

        indexation_html = ""
        if indexation_warnings:
            rows_html = ""
            for item in indexation_warnings:
                severity_label = str(item.get("severity") or "warning").upper()
                severity_color = "#991b1b" if severity_label == "CRITICAL" else "#92400e"
                rows_html += (
                    f'<tr><td style="padding:8px;border:1px solid #e2e8f0;color:{severity_color};font-weight:700;">{html.escape(severity_label)}</td>'
                    f'<td style="padding:8px;border:1px solid #e2e8f0;">{html.escape(str(item.get("property") or ""))}</td>'
                    f'<td style="padding:8px;border:1px solid #e2e8f0;word-break:break-word;">{html.escape(str(item.get("url") or ""))}</td>'
                    f'<td style="padding:8px;border:1px solid #e2e8f0;">{html.escape(str(item.get("reason") or ""))}</td></tr>'
                )
            indexation_html = f"""
            <div style="margin-top:12px;padding:12px;border-left:4px solid #d97706;background:#fffbeb;font-family:Arial, sans-serif;">
              <div style="font-size:16px;font-weight:700;color:#15284B;margin-bottom:6px;">GSC Core Indexation Warnings</div>
              <div style="font-size:13px;color:#475569;margin-bottom:8px;">
                Business-risk URL Inspection findings only. Benign non-indexed redirects, alternate canonicals, and non-core pages are not escalated here.
              </div>
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;font-size:13px;background:#ffffff;">
                <tr style="background:#f8fafc;">
                  <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Severity</th>
                  <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Property</th>
                  <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">URL</th>
                  <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Reason</th>
                </tr>
                {rows_html}
              </table>
            </div>
            """

        indexing_action_html = self._build_indexing_action_html(indexing_action_summary)

        remediation_html = ""
        if remediation_actions:
            remediation_html += """
            <div style="margin-top:12px;padding:12px;border-left:4px solid #2563eb;background:#eff6ff;font-family:Arial, sans-serif;">
              <div style="font-size:16px;font-weight:700;color:#15284B;margin-bottom:6px;">Auto-Remediation Activity</div>
            """
            for action in remediation_actions:
                status = "SUCCESS" if action.get('ok') else "FAILED"
                color = "#166534" if action.get('ok') else "#991b1b"
                remediation_html += (
                    f'<div style="margin:6px 0;padding:8px;border:1px solid #bfdbfe;background:#ffffff;">'
                    f'<div style="font-size:13px;color:#111827;"><strong>{action.get("action")}</strong> '
                    f'<span style="color:{color};font-weight:700;">{status}</span></div>'
                    f'<div style="font-size:12px;color:#475569;">{str(action.get("details") or "")[:320]}</div>'
                    '</div>'
                )
            remediation_html += "</div>"

        runtime = self._runtime_health_snapshot()
        import_status = runtime.get("imports") or {}
        import_bits = ", ".join(
            f"{name}: {'ok' if ok else 'missing'}"
            for name, ok in sorted(import_status.items())
        )
        runtime_html = f"""
            <div style="margin-top:12px;padding:12px;border-left:4px solid #3B9189;background:#f6fffd;font-family:Arial, sans-serif;">
              <div style="font-size:16px;font-weight:700;color:#15284B;margin-bottom:6px;">Runtime Health</div>
              <div style="font-size:12px;color:#475569;line-height:1.45;">
                Python: {html.escape(str(runtime.get("python_version") or ""))} at <code>{html.escape(str(runtime.get("python_executable") or ""))}</code><br>
                Keeper runtime: {'ready' if runtime.get("keeper_runtime_ready") else 'not marked ready'}<br>
                DB present/writable parent: {'yes' if runtime.get("db_present") else 'no'} / {'yes' if runtime.get("db_parent_writable") else 'no'}<br>
                Imports: {html.escape(import_bits)}
              </div>
            </div>
        """

        diagnostics = self._cross_source_diagnostics(issues)
        diagnostics_html = ""
        if diagnostics:
            rows_html = ""
            for item in diagnostics:
                rows_html += (
                    f'<div style="margin:6px 0;padding:8px;border:1px solid #bfdbfe;background:#ffffff;">'
                    f'<div style="font-size:13px;color:#15284B;font-weight:700;">{html.escape(str(item.get("property") or ""))}</div>'
                    f'<div style="font-size:12px;color:#475569;">{html.escape(str(item.get("message") or ""))}</div>'
                    '</div>'
                )
            diagnostics_html = f"""
            <div style="margin-top:12px;padding:12px;border-left:4px solid #294782;background:#eff6ff;font-family:Arial, sans-serif;">
              <div style="font-size:16px;font-weight:700;color:#15284B;margin-bottom:6px;">Cross-Source Diagnostics</div>
              {rows_html}
            </div>
            """

        issues_html = ""
        for source, data in issues.items():
            if not data['missing'] and not data['stale']:
                continue
            rows_html = ""
            for prop_name, last_date in sorted(data['missing']):
                rows_html += (
                    f'<tr><td style="padding:8px;border:1px solid #e2e8f0;">{prop_name}</td>'
                    f'<td style="padding:8px;border:1px solid #e2e8f0;">{last_date}</td>'
                    f'<td style="padding:8px;border:1px solid #e2e8f0;color:#991b1b;font-weight:700;">MISSING</td></tr>'
                )
            for prop_name, last_date in sorted(data['stale']):
                days_old = (datetime.now().date() - datetime.strptime(last_date, '%Y-%m-%d').date()).days
                rows_html += (
                    f'<tr><td style="padding:8px;border:1px solid #e2e8f0;">{prop_name}</td>'
                    f'<td style="padding:8px;border:1px solid #e2e8f0;">{last_date} ({days_old}d)</td>'
                    f'<td style="padding:8px;border:1px solid #e2e8f0;color:#92400e;font-weight:700;">STALE</td></tr>'
                )
            issues_html += f"""
            <div style="margin-top:12px;font-family:Arial, sans-serif;">
              <div style="font-size:16px;font-weight:700;color:#15284B;margin-bottom:6px;">{source_names.get(source, source.upper())}</div>
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;font-size:13px;background:#ffffff;">
                <tr style="background:#f8fafc;">
                  <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Property</th>
                  <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Last Date</th>
                  <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Issue</th>
                </tr>
                {rows_html}
              </table>
            </div>
            """

        content_html = (
            summary_tiles
            + remediation_html
            + runtime_html
            + diagnostics_html
            + failures_html
            + indexation_html
            + indexing_action_html
            + issues_html
            + f'<div style="margin-top:12px;font-family:Arial, sans-serif;font-size:12px;color:#475569;">'
              'Recommended actions: check collector logs, run manual collection, verify API credentials/quotas.<br>'
              f'Database: <code>{self.db_path}</code></div>'
        )
        return wrap_pib_light_email(
            title="Consolidated Morning Failure Alert",
            subtitle=f"Portfolio Analytics Monitoring | {datetime.now().strftime('%B %d, %Y at %I:%M %p')}",
            body_html=content_html,
            badge_text=severity,
            badge_fg=severity_fg,
            badge_bg=severity_bg,
        )

    def _build_all_clear_html(self, indexing_action_summary=None):
        """Build HTML for all-clear status."""
        indexing_action_html = self._build_indexing_action_html(indexing_action_summary)
        return wrap_pib_light_email(
            title="Data Collection Status",
            subtitle=f"Portfolio Analytics Monitoring | {datetime.now().strftime('%B %d, %Y at %I:%M %p')}",
            body_html=(
                '<div style="font-family:Arial, sans-serif;">'
                '<div style="display:inline-block;padding:5px 10px;border-radius:4px;font-size:12px;font-weight:700;color:#166534;background:#dcfce7;">ALL CLEAR</div>'
                '<div style="margin-top:12px;font-size:16px;color:#15284B;font-weight:700;">All data collectors are up to date.</div>'
                '<div style="margin-top:6px;font-size:13px;color:#475569;">No missing or stale data detected for any properties.</div>'
                '</div>'
            ) + indexing_action_html,
        )

    def get_latest_registry_validation_summary(self):
        """Return the most recent registry validation batch recorded in the DB."""
        conn = sqlite3.connect(self.db_path)
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT name FROM sqlite_master
                WHERE type='table' AND name='registry_validation_failures'
            """)
            if not cursor.fetchone():
                return None

            latest_row = cursor.execute(
                "SELECT MAX(validation_timestamp) FROM registry_validation_failures"
            ).fetchone()
            latest_ts = latest_row[0] if latest_row else None
            if not latest_ts:
                return None

            rows = cursor.execute(
                """
                SELECT severity, property_name, issue_type, latest_data_date
                FROM registry_validation_failures
                WHERE validation_timestamp = ?
                ORDER BY CASE severity
                    WHEN 'CRITICAL' THEN 1
                    WHEN 'HIGH' THEN 2
                    WHEN 'MEDIUM' THEN 3
                    ELSE 4
                END, property_name
                """,
                (latest_ts,),
            ).fetchall()
            if not rows:
                return None

            counts = defaultdict(int)
            for severity, *_ in rows:
                counts[severity] += 1

            return {
                'timestamp': latest_ts,
                'count': len(rows),
                'counts': dict(counts),
                'rows': rows[:8],
            }
        except sqlite3.OperationalError:
            return None
        finally:
            conn.close()

    def send_alert_email(self, issues, collection_failures=None, remediation_actions=None, indexation_warnings=None, indexing_action_summary=None):
        """Send alert email via Gmail SMTP."""

        # Build email
        indexation_warnings = indexation_warnings or []
        indexing_action_summary = indexing_action_summary or {}
        html_body = self.build_alert_html(issues, collection_failures, remediation_actions, indexation_warnings, indexing_action_summary)
        registry_summary = self.get_latest_registry_validation_summary()
        if registry_summary:
            counts = registry_summary['counts']
            count_bits = []
            for severity in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'):
                if counts.get(severity):
                    count_bits.append(f"{severity}: {counts[severity]}")
            summary_line = ", ".join(count_bits) if count_bits else f"Total: {registry_summary['count']}"

            rows_html = ""
            for severity, property_name, issue_type, latest_date in registry_summary['rows']:
                latest_fragment = f" ({latest_date})" if latest_date else ""
                rows_html += (
                    f'<tr><td style="padding:8px;border:1px solid #e2e8f0;">{severity}</td>'
                    f'<td style="padding:8px;border:1px solid #e2e8f0;">{property_name}</td>'
                    f'<td style="padding:8px;border:1px solid #e2e8f0;">{issue_type}{latest_fragment}</td></tr>'
                )

            registry_html = f"""
            <div style="margin-top:12px;padding:12px;border-left:4px solid #7c3aed;background:#f5f3ff;font-family:Arial, sans-serif;">
              <div style="font-size:16px;font-weight:700;color:#15284B;margin-bottom:6px;">Registry Validation Summary</div>
              <div style="font-size:13px;color:#475569;margin-bottom:8px;">
                Latest validation: {registry_summary['timestamp']}<br>
                {summary_line}
              </div>
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;font-size:13px;background:#ffffff;">
                <tr style="background:#f8fafc;">
                  <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Severity</th>
                  <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Property</th>
                  <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Issue</th>
                </tr>
                {rows_html}
              </table>
            </div>
            """
            html_body = html_body.replace("</body>", registry_html + "</body>")

        # Determine subject based on severity
        total_issues = sum(len(v['missing']) + len(v['stale']) for v in issues.values())
        collection_failure_count = self._failure_item_count(collection_failures)
        manual_dependency_count = self._manual_dependency_count(collection_failures)
        core_failure_sources, _ = self.summarize_failure_tiers(collection_failures or {})
        indexation_warning_count = len(indexation_warnings)
        critical_indexation_count = sum(1 for item in indexation_warnings if item.get("severity") == "critical")
        indexing_action_count = int((indexing_action_summary.get("summary") or {}).get("actionable_urls") or 0)

        if critical_indexation_count > 0:
            subject = f"🔴 CRITICAL: {critical_indexation_count} Core GSC Indexation Warning(s)"
        elif indexation_warning_count > 0:
            subject = f"⚠️ GSC Core Indexation Alert: {indexation_warning_count} warning(s)"
        elif indexing_action_count > 0:
            subject = f"⚠️ GSC Indexing Actions: {indexing_action_count} URL(s) need follow-up"
        elif core_failure_sources > 0:
            subject = f"🔴 CRITICAL: Consolidated Morning Failure Alert ({collection_failure_count} jobs failed)"
        elif collection_failure_count > 0:
            subject = f"⚠️ Data Collection Alert: {collection_failure_count} specialty job(s) failed"
        elif manual_dependency_count > 0:
            subject = f"⚠️ Data Collection Alert: {manual_dependency_count} manual source wait(s)"
        elif total_issues == 0:
            subject = "✅ Data Collection Status: All Clear"
        elif total_issues > 20:
            subject = f"🔴 CRITICAL: {total_issues} Data Collection Issues Detected"
        else:
            subject = f"⚠️ Data Collection Alert: {total_issues} Issues Found"

        # Plain text fallback
        plain_text = f"""Data Collection Alert

Total Issues: {total_issues}
GSC Core Indexation Warnings: {indexation_warning_count}
GSC Indexing Action URLs: {indexing_action_count}

Please view this email in an HTML-capable client for full details.

Report generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""

        if self.test_mode:
            print("\n" + "="*80)
            print("📧 EMAIL PREVIEW (Test Mode)")
            print("="*80)
            print(f"To: {', '.join(self.recipients)}")
            print(f"Subject: {subject}")
            print("\n[HTML body would be sent - preview saved to /tmp/alert_preview.html]")

            # Save preview
            with open('/tmp/alert_preview.html', 'w') as f:
                f.write(html_body)
            print("Preview saved to: /tmp/alert_preview.html")
            return True

        # Send email via unified sender
        try:
            metadata = self.email_sender.send_email_with_tracking(
                subject=subject,
                html_body=html_body,
                plain_text=plain_text,
                recipients=self.recipients,
                reply_to='mlaufhutte@venterraliving.com',
                log_path=self.delivery_log_dir / f"email_delivery_{datetime.now().strftime('%Y-%m-%d')}.jsonl",
            )

            print(f"✅ Alert email sent to {', '.join(self.recipients)}")
            print(f"   Subject: {subject}")
            print(f"   Message ID: {metadata.get('message_id')}")
            return True

        except Exception as e:
            print(f"❌ Email send failed: {e}")
            return False

    def run(self):
        """Main execution: check data and send alerts if needed."""
        print("="*80)
        print("📊 DATA COLLECTION MONITORING")
        print("="*80)
        print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()

        preflight_actions = self._preflight_reconcile_collection_state()
        if preflight_actions:
            print("Preflight reconciliation:")
            for action in preflight_actions[:10]:
                detail = action.get('error') or action.get('action') or ''
                print(f"   - {action.get('source')}: {detail}")
            print()

        closure = evaluate_daily_collection_closure(self.db_path)
        if not closure.get('ready_for_summary'):
            print(
                "⏳ Daily collection is still open; holding portfolio failure email until the retry window closes "
                f"({closure.get('summary_reason')})."
            )
            for item in (closure.get('unresolved_sources') or [])[:10]:
                print(f"   - {item.get('source')}: {item.get('status')} ({item.get('reason')})")
            print()
            return 0

        # Check collection job failures FIRST
        print("Checking collection job status...")
        collection_failures = self.check_collection_failures()

        if collection_failures:
            core_sources, specialty_sources = self.summarize_failure_tiers(collection_failures)
            active_failure_count = self._failure_item_count(collection_failures)
            manual_dependency_count = self._manual_dependency_count(collection_failures)
            banner = "🔴 CRITICAL" if core_sources > 0 else "⚠️  WARNING"
            print(
                f"{banner}: Found {active_failure_count} collection failure(s) "
                f"and {manual_dependency_count} manual dependency wait(s) "
                f"(core={core_sources}, specialty={specialty_sources})"
            )
            for source, failures in collection_failures.items():
                active_items = [item for item in failures if item.get('classification') != 'manual_dependency']
                manual_items = [item for item in failures if item.get('classification') == 'manual_dependency']
                if active_items:
                    tier = 'core' if any((item.get('tier') == 'core') for item in active_items) else 'specialty'
                    print(f"   {source.upper()} [{tier}]: {len(active_items)} failed job(s) in last 3 days")
                if manual_items:
                    print(f"   {source.upper()} [manual_dependency]: {len(manual_items)} source wait(s) in last 3 days")
        else:
            print("✅ No collection job failures detected")

        print()

        # Check data freshness
        print("Checking data freshness...")
        issues = self.check_data_freshness()

        total_issues = sum(len(v['missing']) + len(v['stale']) for v in issues.values())

        if total_issues == 0:
            print("✅ All data sources are up-to-date!")
        else:
            print(f"⚠️  Found {total_issues} data freshness issues across {len(issues)} data sources")
            for source, data in issues.items():
                missing = len(data['missing'])
                stale = len(data['stale'])
                if missing or stale:
                    print(f"   {source.upper()}: {missing} missing, {stale} stale")

        print()

        print("Checking GSC core indexation posture...")
        indexation_warnings = self.check_gsc_indexation_warnings()
        if indexation_warnings:
            critical_count = sum(1 for item in indexation_warnings if item.get("severity") == "critical")
            print(f"⚠️  Found {len(indexation_warnings)} core indexation warning(s) ({critical_count} critical)")
            for item in indexation_warnings[:10]:
                print(f"   {item.get('severity', 'warning').upper()}: {item.get('property')} - {item.get('url')}")
        else:
            print("✅ No GSC core indexation warnings detected")

        print()

        print("Checking GSC indexing action queue...")
        indexing_action_summary = self.check_gsc_indexing_action_summary()
        indexing_action_count = int((indexing_action_summary.get("summary") or {}).get("actionable_urls") or 0) if indexing_action_summary else 0
        if indexing_action_summary:
            summary = indexing_action_summary.get("summary") or {}
            print(
                "🧭 GSC indexing actions: "
                f"{indexing_action_count} actionable URL(s), "
                f"{summary.get('standard_pages_inspected', 0)} / {summary.get('standard_page_targets', 0)} standard pages inspected"
            )
        else:
            print("⚠️  No GSC indexing action packet found")

        print()

        remediation_actions = self.attempt_auto_remediation(collection_failures)
        if remediation_actions:
            print("Re-checking integrity after auto-remediation...")
            collection_failures = self.check_collection_failures()
            issues = self.check_data_freshness()
            indexation_warnings = self.check_gsc_indexation_warnings()
            indexing_action_summary = self.check_gsc_indexing_action_summary()
            print(f"   Remaining collection failures: {len(collection_failures)}")
            remaining_issues = sum(len(v['missing']) + len(v['stale']) for v in issues.values())
            print(f"   Remaining freshness issues: {remaining_issues}")
            print(f"   Remaining core indexation warnings: {len(indexation_warnings)}")
            print()

        snapshot_path = self._write_alert_snapshot(
            closure=closure,
            collection_failures=collection_failures,
            issues=issues,
            indexation_warnings=indexation_warnings,
            indexing_action_summary=indexing_action_summary,
            remediation_actions=remediation_actions,
        )
        print(f"Alert snapshot: {snapshot_path}")
        print()

        # Send alert email
        print("Sending alert email...")
        success = self.send_alert_email(issues, collection_failures, remediation_actions, indexation_warnings, indexing_action_summary)

        print()
        print("="*80)

        return 0 if success else 1


def main():
    test_mode = '--test' in sys.argv

    alerter = DataAlertEmailer(test_mode=test_mode)
    sys.exit(alerter.run())


if __name__ == '__main__':
    main()
